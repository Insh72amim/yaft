import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';
import { loadPdfStatementDocument } from '../imports/pdf-statement-registry';
import { parseDynamicPayslip, PayslipParsingConfig } from '../salary/dynamic-payslip-parser';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const orgs = await this.prisma.organization.findMany({
      where: { userId },
      include: { _count: { select: { salaryStatements: true } } },
      orderBy: { name: 'asc' },
    });
    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      code: o.code,
      taxId: o.taxId,
      currency: o.currency,
      color: o.color,
      parsingConfig: o.parsingConfig,
      sampleFilename: o.sampleFilename,
      statementCount: o._count.salaryStatements,
      createdAt: o.createdAt,
    }));
  }

  async get(userId: string, id: string) {
    const org = await this.prisma.organization.findFirst({
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
      statementCount: org._count.salaryStatements,
      createdAt: org.createdAt,
    };
  }

  async create(userId: string, dto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findFirst({
      where: { userId, name: dto.name.trim() },
    });
    if (existing) {
      throw new BadRequestException(`An organization named "${dto.name}" already exists.`);
    }

    const org = await this.prisma.organization.create({
      data: {
        userId,
        name: dto.name.trim(),
        code: dto.code?.trim(),
        taxId: dto.taxId?.trim(),
        currency: dto.currency?.trim() || 'INR',
        color: dto.color || '#4f46e5',
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

    return org;
  }

  async update(userId: string, id: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findFirst({ where: { id, userId } });
    if (!org) throw new NotFoundException('Organization not found.');

    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId.trim() } : {}),
        ...(dto.currency ? { currency: dto.currency.trim() } : {}),
        ...(dto.color ? { color: dto.color } : {}),
        ...(dto.parsingConfig ? { parsingConfig: dto.parsingConfig } : {}),
      },
    });

    return updated;
  }

  async remove(userId: string, id: string, purgeStatements = false) {
    const org = await this.prisma.organization.findFirst({ where: { id, userId } });
    if (!org) throw new NotFoundException('Organization not found.');

    if (purgeStatements) {
      await this.prisma.salaryStatement.deleteMany({
        where: { userId, organizationId: id },
      });
    }

    await this.prisma.organization.delete({ where: { id: org.id } });
    return { success: true, message: `Organization "${org.name}" removed successfully.` };
  }

  async uploadSampleSlip(userId: string, id: string, file: Express.Multer.File, password?: string) {
    const org = await this.prisma.organization.findFirst({ where: { id, userId } });
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

    const updated = await this.prisma.organization.update({
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
    const org = await this.prisma.organization.findFirst({ where: { id, userId } });
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
