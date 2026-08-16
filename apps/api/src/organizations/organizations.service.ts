import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';
import { loadPdfStatementDocument } from '../imports/pdf-statement-registry';
import { parseDynamicPayslip, PayslipParsingConfig } from '../salary/dynamic-payslip-parser';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private get orgModel() {
    return (this.prisma as any).organization;
  }

  async list(userId: string) {
    if (!this.orgModel) return [];

    const orgs = await this.orgModel.findMany({
      where: { userId },
      include: { _count: { select: { salaryStatements: true } } },
      orderBy: [{ isCurrent: 'desc' }, { name: 'asc' }],
    });
    return orgs.map((o: any) => ({
      id: o.id,
      name: o.name,
      code: o.code,
      taxId: o.taxId,
      currency: o.currency,
      color: o.color,
      parsingConfig: o.parsingConfig,
      sampleFilename: o.sampleFilename,
      isCurrent: o.isCurrent,
      statementCount: o._count.salaryStatements,
      createdAt: o.createdAt,
    }));
  }

  async get(userId: string, id: string) {
    if (!this.orgModel) throw new NotFoundException('Organization not found.');
    const org = await this.orgModel.findFirst({
      where: { id, userId },
      include: { _count: { select: { salaryStatements: true } } },
    });
    if (!org) throw new NotFoundException('Organization not found.');
    return {
      id: org.id,
      name: org.name,
      code: org.code,
      taxId: org.taxId,
      currency: org.currency,
      color: org.color,
      parsingConfig: org.parsingConfig,
      sampleFilename: org.sampleFilename,
      isCurrent: org.isCurrent,
      statementCount: org._count?.salaryStatements || 0,
      createdAt: org.createdAt,
    };
  }

  async create(userId: string, dto: CreateOrganizationDto) {
    if (!this.orgModel) throw new BadRequestException('Organization feature not available.');
    const existing = await this.orgModel.findFirst({
      where: { userId, name: dto.name.trim() },
    });
    if (existing) {
      throw new BadRequestException(`An organization named "${dto.name}" already exists.`);
    }

    const count = this.orgModel ? await this.orgModel.count({ where: { userId } }) : 0;
    const isCurrent = dto.isCurrent ?? (count === 0);

    if (isCurrent && this.orgModel) {
      await this.orgModel.updateMany({
        where: { userId },
        data: { isCurrent: false },
      });
    }

    const org = await this.orgModel.create({
      data: {
        userId,
        name: dto.name.trim(),
        code: dto.code?.trim(),
        taxId: dto.taxId?.trim(),
        currency: dto.currency?.trim() || 'INR',
        color: dto.color || '#4f46e5',
        isCurrent,
        parsingConfig: dto.parsingConfig || {
          documentAnchors: [dto.name.trim().toUpperCase()],
          fields: {
            payPeriod: { anchor: 'Pay Period' },
            grossEarnings: { anchor: 'Gross Earnings' },
            grossDeductions: { anchor: 'Total Deductions' },
            netPay: { anchor: 'Net Pay' },
          },
        },
      },
    });

    // Auto-link existing unlinked matching salary statements
    await this.prisma.salaryStatement.updateMany({
      where: {
        userId,
        organizationId: null,
        employer: { contains: org.name, mode: 'insensitive' },
      },
      data: { organizationId: org.id },
    });

    return org;
  }

  async update(userId: string, id: string, dto: UpdateOrganizationDto) {
    if (!this.orgModel) throw new NotFoundException('Organization not found.');
    const org = await this.orgModel.findFirst({ where: { id, userId } });
    if (!org) throw new NotFoundException('Organization not found.');

    if (dto.isCurrent) {
      await this.orgModel.updateMany({
        where: { userId },
        data: { isCurrent: false },
      });
    }

    const updated = await this.orgModel.update({
      where: { id: org.id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId.trim() } : {}),
        ...(dto.currency ? { currency: dto.currency.trim() } : {}),
        ...(dto.color ? { color: dto.color } : {}),
        ...(dto.isCurrent !== undefined ? { isCurrent: dto.isCurrent } : {}),
        ...(dto.parsingConfig ? { parsingConfig: dto.parsingConfig } : {}),
      },
    });

    return updated;
  }

  async remove(userId: string, id: string, purgeStatements = false) {
    if (!this.orgModel) throw new NotFoundException('Organization not found.');
    const org = await this.orgModel.findFirst({ where: { id, userId } });
    if (!org) throw new NotFoundException('Organization not found.');

    if (purgeStatements) {
      await this.prisma.salaryStatement.deleteMany({
        where: {
          userId,
          OR: [
            { organizationId: org.id },
            { employer: { equals: org.name, mode: 'insensitive' } },
          ],
        },
      });
    }

    await this.orgModel.delete({ where: { id: org.id } });
    return { success: true, message: `Organization "${org.name}" removed successfully.` };
  }

  async uploadSampleSlip(userId: string, id: string, file: Express.Multer.File, password?: string) {
    if (!this.orgModel) throw new NotFoundException('Organization not found.');
    const org = await this.orgModel.findFirst({ where: { id, userId } });
    if (!org) throw new NotFoundException('Organization not found.');

    const doc = await loadPdfStatementDocument(file.buffer, password);
    const fullText = doc.textPages.map((p) => p.text).join('\n');

    // Auto-detect anchors from sample text
    const textLines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);
    const topAnchors = textLines.slice(0, 5).filter((l) => l.length > 3 && l.length < 50);

    const generatedConfig: PayslipParsingConfig = {
      documentAnchors: topAnchors.length > 0 ? [topAnchors[0], org.name.toUpperCase()] : [org.name.toUpperCase()],
      fields: {
        payPeriod: { anchor: textLines.find((l) => /pay period|month/i.test(l))?.split(':')[0] || 'Pay Period' },
        grossEarnings: { anchor: textLines.find((l) => /gross/i.test(l))?.split(':')[0] || 'Gross Earnings' },
        grossDeductions: { anchor: textLines.find((l) => /deduction/i.test(l))?.split(':')[0] || 'Total Deductions' },
        netPay: { anchor: textLines.find((l) => /net pay|take home/i.test(l))?.split(':')[0] || 'Net Pay' },
      },
      tables: [
        { startAnchor: 'EARNINGS', endAnchor: 'DEDUCTIONS', type: 'EARNING' },
        { startAnchor: 'DEDUCTIONS', endAnchor: 'NET PAY', type: 'DEDUCTION' },
      ],
    };

    const updated = await this.orgModel.update({
      where: { id: org.id },
      data: {
        sampleFilename: file.originalname,
        parsingConfig: generatedConfig as any,
      },
    });

    const parsedSample = parseDynamicPayslip(fullText, generatedConfig, org.name);

    return {
      organization: updated,
      detectedConfig: generatedConfig,
      extractedSample: parsedSample,
    };
  }

  async testParser(userId: string, id: string, file: Express.Multer.File, configOverride?: PayslipParsingConfig, password?: string) {
    if (!this.orgModel) throw new NotFoundException('Organization not found.');
    const org = await this.orgModel.findFirst({ where: { id, userId } });
    if (!org) throw new NotFoundException('Organization not found.');

    const doc = await loadPdfStatementDocument(file.buffer, password);
    const fullText = doc.textPages.map((p) => p.text).join('\n');

    const configToUse = configOverride || (org.parsingConfig as PayslipParsingConfig) || undefined;
    const result = parseDynamicPayslip(fullText, configToUse, org.name);

    return {
      organizationName: org.name,
      filename: file.originalname,
      parsedResult: result,
    };
  }
}
