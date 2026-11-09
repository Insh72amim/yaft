import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SalaryItemType } from '@prisma/client';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../s3/s3.service';
import { isPayslipSchema, parsePayslipPdf, PAYSLIP_SCHEMAS } from './payslip-parser';
import { parseDynamicPayslip } from './dynamic-payslip-parser';
import { loadPdfStatementDocument } from '../imports/pdf-statement-registry';
import { StatementCredentialCipher } from '../common/statement-credentials.service';
import { ManualSalaryDto } from './salary.dto';

type SalaryWithItems = Prisma.SalaryStatementGetPayload<{ include: { lineItems: true } }>;

/** Minimal shape of an Organization record used in salary matching. */
interface OrgRecord {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  isCurrent: boolean;
  currency?: string | null;
  parsingConfig?: { documentAnchors?: string[] } | null;
}

/** Shape of a line item before it is persisted (from both dynamic and standard parsers). */
interface RawLineItem {
  type: import('@prisma/client').SalaryItemType;
  description: string;
  currentAmount: number;
  ytdAmount?: number;
}

@Injectable()
export class SalaryService {
  private _cipher: StatementCredentialCipher | null = null;
  private get cipher() {
    if (!this._cipher) {
      this._cipher = new StatementCredentialCipher();
    }
    return this._cipher;
  }

  constructor(private readonly prisma: PrismaService, private readonly s3: S3Service) {}

  async upload(userId: string, file: Express.Multer.File, payslipSchema?: string, pdfPassword?: string, salaryType: string = 'SALARY') {
    if (!isPayslipSchema(payslipSchema)) throw new BadRequestException('Choose a supported payslip employer.');
    const hash = createHash('sha256').update(file.buffer).digest('hex');

    // Check user organizations for dynamic parsing
    let matchedOrg: OrgRecord | null = null;
    // `organization` is an optional model — access via index signature to avoid compile errors if the model is absent
    const prismaAny = this.prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<OrgRecord[]> }>;
    const orgs: OrgRecord[] = prismaAny['organization']
      ? await prismaAny['organization'].findMany({ where: { userId } })
      : [];
    if (payslipSchema && payslipSchema !== 'STANDARD_PAYSLIP' && payslipSchema !== 'GOLDMAN_SACHS') {
      matchedOrg = orgs.find((o) => o.id === payslipSchema || o.name.toLowerCase() === payslipSchema.toLowerCase()) ?? null;
    }

    let parsed: import('./payslip-parser').ParsedPayslip;
    if (matchedOrg) {
      const doc = await loadPdfStatementDocument(file.buffer, pdfPassword);
      const fullText = doc.textPages.map((p: { text: string }) => p.text).join('\n');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dynResult = parseDynamicPayslip(fullText, matchedOrg.parsingConfig as any, matchedOrg.name);
      parsed = {
        payPeriod: dynResult.payPeriod,
        employer: matchedOrg.name,
        employeeName: dynResult.employeeName,
        employeeNumberLast4: dynResult.employeeNumberLast4,
        currency: matchedOrg.currency || 'INR',
        grossEarnings: dynResult.grossEarnings,
        grossDeductions: dynResult.grossDeductions,
        directPayment: 0,
        netPay: dynResult.netPay,
        lineItems: dynResult.lineItems,
      };
    } else {
      parsed = await parsePayslipPdf(file.buffer, (payslipSchema as import('./payslip-parser').PayslipSchema) || 'STANDARD_PAYSLIP', pdfPassword);
      matchedOrg = orgs.find((o) => o.name.toLowerCase() === parsed.employer.toLowerCase()) ?? null;
    }

    let targetEmployer = parsed.employer;
    if (salaryType === 'BONUS') {
      targetEmployer = `${parsed.employer} (Bonus)`;
    } else if (salaryType === 'VARIABLE_PAY') {
      targetEmployer = `${parsed.employer} (Variable Pay)`;
    }

    if (!matchedOrg && parsed?.employer) {
      matchedOrg = this.findMatchingOrganization(orgs, parsed.employer, payslipSchema);
    }

    const existing = await this.prisma.salaryStatement.findFirst({
      where: {
        userId,
        OR: [
          { fileHash: hash },
          { employer: targetEmployer, payPeriod: parsed.payPeriod },
        ],
      },
    });

    if (existing) {
      await this.discard(userId, existing.id);
    }
    let statement: SalaryWithItems | null = null;
    try {
      statement = await this.prisma.salaryStatement.create({ data: {
        userId, payPeriod: parsed.payPeriod, employer: targetEmployer, employeeName: parsed.employeeName,
        employeeNumberLast4: parsed.employeeNumberLast4, department: parsed.department, designation: parsed.designation,
        bankName: parsed.bankName, bankAccountLast4: parsed.bankAccountLast4, uanLast4: parsed.uanLast4,
        currency: parsed.currency, grossEarnings: BigInt(parsed.grossEarnings), grossDeductions: BigInt(parsed.grossDeductions),
        directPayment: BigInt(parsed.directPayment), netPay: BigInt(parsed.netPay), filename: file.originalname.slice(0, 200), fileHash: hash,
        organizationId: matchedOrg?.id,
        lineItems: { create: parsed.lineItems.map((item: RawLineItem) => ({ type: item.type, description: item.description,
          currentAmount: BigInt(item.currentAmount), ytdAmount: item.ytdAmount === undefined ? undefined : BigInt(item.ytdAmount) })) },
      }, include: { lineItems: true } });

      if (pdfPassword) {
        const enc = this.cipher.encrypt(statement.id, pdfPassword);
        await this.prisma.salaryStatement.update({
          where: { id: statement.id },
          data: {
            pdfPasswordCipher: Buffer.from(enc.ciphertext),
            pdfPasswordIv: Buffer.from(enc.iv),
            pdfPasswordTag: Buffer.from(enc.authTag),
            pdfPasswordKeyVersion: enc.keyVersion,
          },
        });
      }

      await this.s3.uploadFile(`salaries/${userId}/${statement.id}.pdf`, file.buffer, file.mimetype || 'application/pdf');

    } catch (error) {
      if (statement) {
        await this.prisma.salaryStatement.delete({ where: { id: statement.id } }).catch(() => {});
      }
      throw new BadRequestException('Failed to store payslip.');
    }
    return this.serialize(statement);
  }

  async overview(userId: string) {
    const prismaAny = this.prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<OrgRecord[]> }>;
    const orgs: OrgRecord[] = prismaAny['organization']
      ? await prismaAny['organization'].findMany({ where: { userId } })
      : [];
    const statements = await this.prisma.salaryStatement.findMany({
      where: { userId },
      include: {
        lineItems: true,
        organization: { select: { id: true, name: true, code: true, color: true } },
      },
      orderBy: { payPeriod: 'desc' },
    });

    type StatementRow = (typeof statements)[number];
    type LineItemRow = StatementRow['lineItems'][number];

    for (const statement of statements) {
      if (!statement.organization && orgs.length > 0) {
        const matched = this.findMatchingOrganization(orgs, statement.employer);
        if (matched) {
          statement.organization = { id: matched.id, name: matched.name, code: matched.code, color: matched.color };
          statement.organizationId = matched.id;
          void this.prisma.salaryStatement.update({
            where: { id: statement.id },
            data: { organizationId: matched.id },
          }).catch(() => {});
        }
      }
    }

    const committed = statements.filter((statement) => statement.status === 'COMMITTED');
    const totalGross = committed.reduce((sum, statement) => sum + Number(statement.grossEarnings), 0);
    const totalDeductions = committed.reduce((sum, statement) => sum + Number(statement.grossDeductions), 0);
    const totalNet = committed.reduce((sum, statement) => sum + Number(statement.netPay), 0);
    const allItems = committed.flatMap((statement) => statement.lineItems);
    const employeePf = allItems.filter((item: LineItemRow) => item.type === SalaryItemType.DEDUCTION && /\bpf\b|provident fund/i.test(item.description) && !/accumulat|balance|closing|opening|ytd|total/i.test(item.description) && Number(item.currentAmount) < 5000000).reduce((sum, item: LineItemRow) => sum + Number(item.currentAmount), 0);
    const employerPf = allItems.filter((item: LineItemRow) => item.type === SalaryItemType.EMPLOYER_CONTRIBUTION && /\bpf\b|provident fund/i.test(item.description) && !/accumulat|balance|closing|opening|ytd|total/i.test(item.description) && Number(item.currentAmount) < 5000000).reduce((sum, item: LineItemRow) => sum + Number(item.currentAmount), 0);
    const taxes = allItems.filter((item: LineItemRow) => item.type === SalaryItemType.DEDUCTION && /tax/i.test(item.description) && !/accumulat|balance|closing|opening|ytd|total/i.test(item.description) && Number(item.currentAmount) < 50000000).reduce((sum, item: LineItemRow) => sum + Number(item.currentAmount), 0);
    const latest = committed[0];
    const monthly = new Map<string, { grossEarnings: number; netPay: number; tax: number }>();
    [...committed].sort((left, right) => left.payPeriod.getTime() - right.payPeriod.getTime()).forEach((statement) => {
      const month = statement.payPeriod.toISOString().slice(0, 7);
      const current = monthly.get(month) ?? { grossEarnings: 0, netPay: 0, tax: 0 };
      current.grossEarnings += Number(statement.grossEarnings);
      current.netPay += Number(statement.netPay);
      current.tax += statement.lineItems.filter((item: LineItemRow) => item.type === SalaryItemType.DEDUCTION && /tax/i.test(item.description))
        .reduce((sum, item: LineItemRow) => sum + Number(item.currentAmount), 0);
      monthly.set(month, current);
    });
    let cumulativeGross = 0;
    let cumulativeTax = 0;
    const timeline = [...monthly.entries()].map(([month, values]) => {
      cumulativeGross += values.grossEarnings;
      cumulativeTax += values.tax;
      return { month, ...values, cumulativeGross, cumulativeTax };
    });
    return {
      payslipSchemas: PAYSLIP_SCHEMAS,
      summary: { statementCount: committed.length, totalGross, totalDeductions, totalNet, employeePf, employerPf, taxes,
        latestNetPay: latest ? Number(latest.netPay) : 0 },
      timeline,
      pending: statements.find((statement) => statement.status === 'REVIEW') ? this.serialize(statements.find((statement) => statement.status === 'REVIEW')!) : null,
      statements: committed.map((statement) => this.serialize(statement)),
    };
  }

  async get(userId: string, statementId: string) {
    const statement = await this.prisma.salaryStatement.findFirst({
      where: { id: statementId, userId },
      include: {
        lineItems: true,
        organization: { select: { id: true, name: true, code: true, color: true } },
      },
    });
    if (!statement) throw new NotFoundException('Salary statement not found.');
    return this.serialize(statement);
  }

  async pendingAll(userId: string) {
    const statements = await this.prisma.salaryStatement.findMany({
      where: { userId, status: 'REVIEW' },
      include: {
        lineItems: true,
        organization: { select: { id: true, name: true, code: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return statements.map((statement) => this.serialize(statement));
  }

  async commit(userId: string, statementId: string) {
    const statement = await this.prisma.salaryStatement.findFirst({ where: { id: statementId, userId, status: 'REVIEW' } });
    if (!statement) throw new NotFoundException('Reviewable salary statement not found.');
    await this.prisma.salaryStatement.update({ where: { id: statement.id }, data: { status: 'COMMITTED', committedAt: new Date() } });
    return this.overview(userId);
  }

  async download(userId: string, statementId: string) {
    const statement = await this.prisma.salaryStatement.findFirst({ where: { id: statementId, userId } });
    if (!statement) throw new NotFoundException('Salary statement not found.');
    if (statement.filename === 'Manual Entry') {
      throw new BadRequestException('No proof document uploaded for this statement.');
    }
    const ext = path.extname(statement.filename);
    const buffer = await this.s3.downloadFile(`salaries/${userId}/${statementId}${ext}`);
    return { buffer, filename: statement.filename, payPeriod: statement.payPeriod };
  }

  async view(userId: string, statementId: string): Promise<{ buffer: Buffer; filename: string }> {
    const statement = await this.prisma.salaryStatement.findFirst({ where: { id: statementId, userId } });
    if (!statement) throw new NotFoundException('Salary statement not found.');
    if (statement.filename === 'Manual Entry') {
      throw new BadRequestException('No proof document uploaded for this statement.');
    }
    const ext = path.extname(statement.filename);
    const buffer = await this.s3.downloadFile(`salaries/${userId}/${statementId}${ext}`);

    if (statement.pdfPasswordCipher) {
      try {
        const decryptedPassword = this.cipher.decrypt(statement.id, {
          ciphertext: Buffer.from(statement.pdfPasswordCipher),
          iv: Buffer.from(statement.pdfPasswordIv!),
          authTag: Buffer.from(statement.pdfPasswordTag!),
          keyVersion: statement.pdfPasswordKeyVersion ?? 1,
        });

        // Decrypt the PDF using qpdf
        const decryptedBuffer = await this.decryptPDFWithQpdf(buffer, decryptedPassword);
        return { buffer: decryptedBuffer, filename: statement.filename };
      } catch (err) {
        console.error('PDF decryption failed, serving original:', err);
        return { buffer, filename: statement.filename };
      }
    }

    return { buffer, filename: statement.filename };
  }

  private decryptPDFWithQpdf(buffer: Buffer, password: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const tempDir = os.tmpdir();
      const rand = Math.random().toString(36).slice(2);
      const inputPath = path.join(tempDir, `input-${Date.now()}-${rand}.pdf`);
      const outputPath = path.join(tempDir, `output-${Date.now()}-${rand}.pdf`);

      fs.writeFile(inputPath, buffer)
        .then(() => {
          const qpdfExecutable = existsSync('/opt/homebrew/bin/qpdf') ? '/opt/homebrew/bin/qpdf' : 'qpdf';
          const qpdf = spawn(qpdfExecutable, [
            '--decrypt',
            '--password-file=-',
            inputPath,
            outputPath,
          ]);

          let stderr = '';
          qpdf.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          qpdf.on('close', (code) => {
            if (code !== 0) {
              Promise.all([
                fs.unlink(inputPath).catch(() => {}),
                fs.unlink(outputPath).catch(() => {}),
              ]).then(() => {
                reject(new Error(`qpdf failed with exit code ${code}: ${stderr}`));
              });
              return;
            }

            fs.readFile(outputPath)
              .then((decryptedBuffer) => {
                Promise.all([
                  fs.unlink(inputPath).catch(() => {}),
                  fs.unlink(outputPath).catch(() => {}),
                ]).then(() => {
                  resolve(decryptedBuffer);
                });
              })
              .catch((readError) => {
                Promise.all([
                  fs.unlink(inputPath).catch(() => {}),
                  fs.unlink(outputPath).catch(() => {}),
                ]).then(() => {
                  reject(readError);
                });
              });
          });

          qpdf.on('error', (err) => {
            Promise.all([
              fs.unlink(inputPath).catch(() => {}),
              fs.unlink(outputPath).catch(() => {}),
            ]).then(() => {
              reject(err);
            });
          });

          // Write password to stdin and close it
          qpdf.stdin.write(password);
          qpdf.stdin.end();
        })
        .catch(reject);
    });
  }

  async createManual(userId: string, dto: ManualSalaryDto, file?: Express.Multer.File) {
    const payPeriod = new Date(dto.payPeriod);
    const grossEarnings = BigInt(dto.grossEarnings);
    const grossDeductions = BigInt(dto.grossDeductions);
    const netPay = BigInt(dto.netPay);

    // Enforce uniqueness constraint (userId, employer, payPeriod)
    const existing = await this.prisma.salaryStatement.findFirst({
      where: {
        userId,
        employer: dto.employer,
        payPeriod,
      },
    });
    if (existing) {
      await this.discard(userId, existing.id);
    }

    // Find organization for this employer
    let matchedOrg: OrgRecord | null = null;
    const prismaAny = this.prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<OrgRecord[]> }>;
    if (prismaAny['organization']) {
      const orgs: OrgRecord[] = await prismaAny['organization'].findMany({ where: { userId } });
      matchedOrg = this.findMatchingOrganization(orgs, dto.employer);
    }

    const statement = await this.prisma.salaryStatement.create({
      data: {
        userId,
        payPeriod,
        employer: dto.employer,
        grossEarnings,
        grossDeductions,
        netPay,
        organizationId: matchedOrg?.id,
        filename: file ? file.originalname.slice(0, 200) : 'Manual Entry',
        fileHash: file ? createHash('sha256').update(file.buffer).digest('hex') : 'manual-placeholder',
        status: 'COMMITTED',
        committedAt: new Date(),
      },
    });

    if (file) {
      const ext = path.extname(file.originalname);
      const key = `salaries/${userId}/${statement.id}${ext}`;
      await this.s3.uploadFile(key, file.buffer, file.mimetype);
    } else {
      await this.prisma.salaryStatement.update({
        where: { id: statement.id },
        data: { fileHash: `manual-${statement.id}` },
      });
    }

    // Create line items for Tax and PF additions so timeline/summary calculations are correct
    const lineItems: Array<{ type: import('@prisma/client').SalaryItemType; description: string; currentAmount: bigint }> = [];
    if (dto.tax && BigInt(dto.tax) > 0n) {
      lineItems.push({ type: SalaryItemType.DEDUCTION, description: 'Income Tax', currentAmount: BigInt(dto.tax) });
    }
    if (dto.pf && BigInt(dto.pf) > 0n) {
      lineItems.push({ type: SalaryItemType.DEDUCTION, description: 'Provident Fund', currentAmount: BigInt(dto.pf) });
    }

    if (lineItems.length > 0) {
      await this.prisma.salaryStatement.update({
        where: { id: statement.id },
        data: {
          lineItems: {
            create: lineItems,
          },
        },
      });
    }

    const updated = await this.prisma.salaryStatement.findFirst({
      where: { id: statement.id },
      include: { lineItems: true },
    });

    return this.serialize(updated!);
  }

  async discard(userId: string, statementId: string) {
    const statement = await this.prisma.salaryStatement.findFirst({ where: { id: statementId, userId } });
    if (!statement) throw new BadRequestException('Salary statement not found.');
    if (statement.filename !== 'Manual Entry') {
      const ext = path.extname(statement.filename);
      const key = `salaries/${userId}/${statementId}${ext}`;
      await this.s3.deleteFile(key).catch(() => undefined);
    }
    await this.prisma.salaryStatement.delete({ where: { id: statement.id } });
  }

  private serialize(statement: SalaryWithItems & {
    organization?: { id: string; name: string; code: string | null; color: string | null } | null;
  }) {
    const { fileHash: _fileHash, ...safe } = statement;
    const orgName = statement.organization?.name;
    return {
      ...safe,
      employer: orgName || statement.employer,
      rawEmployer: statement.employer,
      grossEarnings: Number(statement.grossEarnings),
      grossDeductions: Number(statement.grossDeductions),
      directPayment: Number(statement.directPayment ?? 0),
      netPay: Number(statement.netPay),
      organization: statement.organization
        ? {
            id: statement.organization.id,
            name: statement.organization.name,
            code: statement.organization.code,
            color: statement.organization.color,
          }
        : null,
      lineItems: statement.lineItems.map((item) => ({
        ...item,
        currentAmount: Number(item.currentAmount),
        ytdAmount: item.ytdAmount === null || item.ytdAmount === undefined ? null : Number(item.ytdAmount),
      })),
    };
  }

  private findMatchingOrganization(orgs: OrgRecord[], rawEmployerName?: string, explicitOrgId?: string): OrgRecord | null {
    if (!orgs || orgs.length === 0) return null;
    if (explicitOrgId && explicitOrgId !== 'STANDARD_PAYSLIP' && explicitOrgId !== 'GOLDMAN_SACHS') {
      const explicit = orgs.find((o) => o.id === explicitOrgId || o.name.toLowerCase() === explicitOrgId.toLowerCase());
      if (explicit) return explicit;
    }

    if (!rawEmployerName) {
      return orgs.find((o) => o.isCurrent) || (orgs.length === 1 ? orgs[0] : null);
    }

    const clean = rawEmployerName.replace(/\s*\((Bonus|Variable Pay)\)$/i, '').trim().toLowerCase();

    // 1. Exact name match
    const exact = orgs.find((o) => o.name.toLowerCase() === clean);
    if (exact) return exact;

    // 2. Org code match
    const byCode = orgs.find((o) => o.code && o.code.toLowerCase() === clean);
    if (byCode) return byCode;

    // 3. Document anchors match
    const byAnchor = orgs.find((o) => {
      const anchors: string[] = o.parsingConfig?.documentAnchors || [];
      return anchors.some((a) => a && (a.toLowerCase() === clean || clean.includes(a.toLowerCase()) || a.toLowerCase().includes(clean)));
    });
    if (byAnchor) return byAnchor;

    // 4. Substring / inclusion match (e.g. "Google" matching "Google India Private Limited")
    const substring = orgs.find((o) => {
      const oName = o.name.toLowerCase();
      return oName.includes(clean) || clean.includes(oName);
    });
    if (substring) return substring;

    // 5. If only 1 organization exists or 1 isCurrent org exists, link to it
    const current = orgs.find((o) => o.isCurrent);
    if (current) return current;
    if (orgs.length === 1) return orgs[0];

    return null;
  }
}
