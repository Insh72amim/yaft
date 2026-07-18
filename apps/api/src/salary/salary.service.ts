import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SalaryItemType } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { parsePayslipPdf } from './payslip-parser';

type SalaryWithItems = Prisma.SalaryStatementGetPayload<{ include: { lineItems: true } }>;

@Injectable()
export class SalaryService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(userId: string, file: Express.Multer.File) {
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await this.prisma.salaryStatement.findFirst({ where: { userId, fileHash: hash } });
    if (duplicate) throw new ConflictException('This exact payslip was already uploaded.');
    const parsed = await parsePayslipPdf(file.buffer);
    const sameMonth = await this.prisma.salaryStatement.findFirst({ where: { userId, employer: parsed.employer, payPeriod: parsed.payPeriod } });
    if (sameMonth) throw new ConflictException('A payslip for this employer and month already exists. Discard the pending review first if you want to replace it.');
    const statement = await this.prisma.salaryStatement.create({ data: {
      userId, payPeriod: parsed.payPeriod, employer: parsed.employer, employeeName: parsed.employeeName,
      employeeNumberLast4: parsed.employeeNumberLast4, department: parsed.department, designation: parsed.designation,
      bankName: parsed.bankName, bankAccountLast4: parsed.bankAccountLast4, uanLast4: parsed.uanLast4,
      currency: parsed.currency, grossEarnings: BigInt(parsed.grossEarnings), grossDeductions: BigInt(parsed.grossDeductions),
      directPayment: BigInt(parsed.directPayment), netPay: BigInt(parsed.netPay), filename: file.originalname.slice(0, 200), fileHash: hash,
      lineItems: { create: parsed.lineItems.map((item) => ({ type: item.type, description: item.description,
        currentAmount: BigInt(item.currentAmount), ytdAmount: item.ytdAmount === undefined ? undefined : BigInt(item.ytdAmount) })) },
    }, include: { lineItems: true } });
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
    return {
      summary: { statementCount: committed.length, totalGross, totalDeductions, totalNet, employeePf, employerPf, taxes,
        latestNetPay: latest ? Number(latest.netPay) : 0 },
      pending: statements.find((statement) => statement.status === 'REVIEW') ? this.serialize(statements.find((statement) => statement.status === 'REVIEW')!) : null,
      statements: committed.map((statement) => this.serialize(statement)),
    };
  }

  async get(userId: string, statementId: string) {
    const statement = await this.prisma.salaryStatement.findFirst({ where: { id: statementId, userId }, include: { lineItems: true } });
    if (!statement) throw new NotFoundException('Salary statement not found.');
    return this.serialize(statement);
  }

  async commit(userId: string, statementId: string) {
    const statement = await this.prisma.salaryStatement.findFirst({ where: { id: statementId, userId, status: 'REVIEW' } });
    if (!statement) throw new NotFoundException('Reviewable salary statement not found.');
    await this.prisma.salaryStatement.update({ where: { id: statement.id }, data: { status: 'COMMITTED', committedAt: new Date() } });
    return this.overview(userId);
  }

  async discard(userId: string, statementId: string) {
    const statement = await this.prisma.salaryStatement.findFirst({ where: { id: statementId, userId, status: 'REVIEW' } });
    if (!statement) throw new BadRequestException('Only a pending salary review can be discarded.');
    await this.prisma.salaryStatement.delete({ where: { id: statement.id } });
  }

  private serialize(statement: SalaryWithItems) {
    const { fileHash: _fileHash, ...safe } = statement;
    return { ...safe, grossEarnings: Number(statement.grossEarnings), grossDeductions: Number(statement.grossDeductions),
      directPayment: Number(statement.directPayment), netPay: Number(statement.netPay),
      lineItems: statement.lineItems.map((item) => ({ ...item, currentAmount: Number(item.currentAmount), ytdAmount: item.ytdAmount === null ? null : Number(item.ytdAmount) })) };
  }
}
