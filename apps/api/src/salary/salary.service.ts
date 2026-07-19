import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SalaryItemType } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../s3/s3.service';
import { isPayslipSchema, parsePayslipPdf, PAYSLIP_SCHEMAS } from './payslip-parser';

type SalaryWithItems = Prisma.SalaryStatementGetPayload<{ include: { lineItems: true } }>;

@Injectable()
export class SalaryService {
  constructor(private readonly prisma: PrismaService, private readonly s3: S3Service) {}

  async upload(userId: string, file: Express.Multer.File, payslipSchema?: string) {
    if (!isPayslipSchema(payslipSchema)) throw new BadRequestException('Choose a supported payslip employer.');
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await this.prisma.salaryStatement.findFirst({ where: { userId, fileHash: hash } });
    if (duplicate) throw new ConflictException('This exact payslip was already uploaded.');
    const parsed = await parsePayslipPdf(file.buffer, payslipSchema);
    const sameMonth = await this.prisma.salaryStatement.findFirst({ where: { userId, employer: parsed.employer, payPeriod: parsed.payPeriod } });
    if (sameMonth) throw new ConflictException('A payslip for this employer and month already exists. Discard the pending review first if you want to replace it.');
    let statement: SalaryWithItems | null = null;
    try {
      statement = await this.prisma.salaryStatement.create({ data: {
        userId, payPeriod: parsed.payPeriod, employer: parsed.employer, employeeName: parsed.employeeName,
        employeeNumberLast4: parsed.employeeNumberLast4, department: parsed.department, designation: parsed.designation,
        bankName: parsed.bankName, bankAccountLast4: parsed.bankAccountLast4, uanLast4: parsed.uanLast4,
        currency: parsed.currency, grossEarnings: BigInt(parsed.grossEarnings), grossDeductions: BigInt(parsed.grossDeductions),
        directPayment: BigInt(parsed.directPayment), netPay: BigInt(parsed.netPay), filename: file.originalname.slice(0, 200), fileHash: hash,
        lineItems: { create: parsed.lineItems.map((item) => ({ type: item.type, description: item.description,
          currentAmount: BigInt(item.currentAmount), ytdAmount: item.ytdAmount === undefined ? undefined : BigInt(item.ytdAmount) })) },
      }, include: { lineItems: true } });
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
    const statements = await this.prisma.salaryStatement.findMany({ where: { userId }, include: { lineItems: true }, orderBy: { payPeriod: 'desc' } });
    const committed = statements.filter((statement) => statement.status === 'COMMITTED');
    const totalGross = committed.reduce((sum, statement) => sum + Number(statement.grossEarnings), 0);
    const totalDeductions = committed.reduce((sum, statement) => sum + Number(statement.grossDeductions), 0);
    const totalNet = committed.reduce((sum, statement) => sum + Number(statement.netPay), 0);
    const allItems = committed.flatMap((statement) => statement.lineItems);
    const employeePf = allItems.filter((item) => item.type === SalaryItemType.DEDUCTION && /\bpf\b|provident fund/i.test(item.description)).reduce((sum, item) => sum + Number(item.currentAmount), 0);
    const employerPf = allItems.filter((item) => item.type === SalaryItemType.EMPLOYER_CONTRIBUTION && /\bpf\b|provident fund/i.test(item.description)).reduce((sum, item) => sum + Number(item.currentAmount), 0);
    const taxes = allItems.filter((item) => item.type === SalaryItemType.DEDUCTION && /tax/i.test(item.description)).reduce((sum, item) => sum + Number(item.currentAmount), 0);
    const latest = committed[0];
    const monthly = new Map<string, { grossEarnings: number; netPay: number; tax: number }>();
    [...committed].sort((left, right) => left.payPeriod.getTime() - right.payPeriod.getTime()).forEach((statement) => {
      const month = statement.payPeriod.toISOString().slice(0, 7);
      const current = monthly.get(month) ?? { grossEarnings: 0, netPay: 0, tax: 0 };
      current.grossEarnings += Number(statement.grossEarnings);
      current.netPay += Number(statement.netPay);
      current.tax += statement.lineItems.filter((item) => item.type === SalaryItemType.DEDUCTION && /tax/i.test(item.description))
        .reduce((sum, item) => sum + Number(item.currentAmount), 0);
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
    const statement = await this.prisma.salaryStatement.findFirst({ where: { id: statementId, userId }, include: { lineItems: true } });
    if (!statement) throw new NotFoundException('Salary statement not found.');
    return this.serialize(statement);
  }

  async pendingAll(userId: string) {
    const statements = await this.prisma.salaryStatement.findMany({ where: { userId, status: 'REVIEW' },
      include: { lineItems: true }, orderBy: { createdAt: 'desc' } });
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
    const buffer = await this.s3.downloadFile(`salaries/${userId}/${statementId}.pdf`);
    return { buffer, payPeriod: statement.payPeriod };
  }

  async discard(userId: string, statementId: string) {
    const statement = await this.prisma.salaryStatement.findFirst({ where: { id: statementId, userId } });
    if (!statement) throw new BadRequestException('Salary statement not found.');
    const key = `salaries/${userId}/${statementId}.pdf`;
    await this.s3.deleteFile(key);
    await this.prisma.salaryStatement.delete({ where: { id: statement.id } });
  }

  private serialize(statement: SalaryWithItems) {
    const { fileHash: _fileHash, ...safe } = statement;
    return { ...safe, grossEarnings: Number(statement.grossEarnings), grossDeductions: Number(statement.grossDeductions),
      directPayment: Number(statement.directPayment), netPay: Number(statement.netPay),
      lineItems: statement.lineItems.map((item) => ({ ...item, currentAmount: Number(item.currentAmount), ytdAmount: item.ytdAmount === null ? null : Number(item.ytdAmount) })) };
  }
}
