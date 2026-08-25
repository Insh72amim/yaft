import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InstallmentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateLoanDto } from './loans.dto';

export interface AmortisationRow {
  dueDate: Date;
  principalAmount: bigint;
  interestAmount: bigint;
  emiAmount: bigint;
  balance: bigint;
}

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  generateSchedule(
    principalPaise: bigint,
    annualRatePct: number,
    emiPaise: bigint,
    startDate: Date,
    termMonths?: number
  ): AmortisationRow[] {
    const schedule: AmortisationRow[] = [];
    let balance = BigInt(principalPaise);
    const monthlyRate = (annualRatePct / 100) / 12;

    if (Number(emiPaise) <= 0) throw new BadRequestException('EMI must be positive');

    const initialInterest = Math.round(Number(balance) * monthlyRate);
    if (Number(emiPaise) <= initialInterest) {
      throw new BadRequestException('EMI too small to cover interest; increase EMI or provide term.');
    }

    let month = 0;
    while (balance > 0n) {
      if (termMonths !== undefined && month >= termMonths) break;
      const interest = Math.round(Number(balance) * monthlyRate);
      let principalPayment = Number(emiPaise) - interest;
      if (principalPayment < 0) principalPayment = 0;
      if (BigInt(principalPayment) > balance) {
        principalPayment = Number(balance);
      }
      const emiPaid = interest + principalPayment;
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + month);

      schedule.push({
        dueDate,
        principalAmount: BigInt(principalPayment),
        interestAmount: BigInt(interest),
        emiAmount: BigInt(emiPaid),
        balance: balance - BigInt(principalPayment),
      });

      balance = balance - BigInt(principalPayment);
      month += 1;

      if (month > 600) break; // 50 years max
    }

    return schedule;
  }

  async createLoan(userId: string, dto: CreateLoanDto) {
    const account = await this.prisma.account.findFirst({ where: { id: dto.accountId, userId } });
    if (!account) throw new NotFoundException('Account not found');

    const principalPaise = BigInt(dto.principal);
    const emiPaise = BigInt(dto.emiAmount);
    const startDate = new Date(dto.startDate);

    const schedule = this.generateSchedule(
      principalPaise,
      dto.interestRate,
      emiPaise,
      startDate,
      dto.termMonths
    );

    const loan = await this.prisma.$transaction(async (tx) => {
      const createdLoan = await tx.loan.create({
        data: {
          accountId: dto.accountId,
          startDate,
          principal: principalPaise,
          interestRate: dto.interestRate.toString(),
          emiAmount: emiPaise,
          emiDay: dto.emiDay,
          termMonths: dto.termMonths ?? schedule.length,
        },
      });

      const now = new Date();
      const installmentsData = schedule.map((s) => ({
        loanId: createdLoan.id,
        dueDate: s.dueDate,
        principalAmount: s.principalAmount,
        interestAmount: s.interestAmount,
        emiAmount: s.emiAmount,
        balance: s.balance,
        status: s.dueDate < now ? InstallmentStatus.PAST_UNCONFIRMED : InstallmentStatus.FUTURE,
      }));

      await tx.loanInstallment.createMany({ data: installmentsData });
      return createdLoan;
    });

    return { loanId: loan.id, installments: schedule.length };
  }

  async listInstallments(userId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({ where: { id: loanId }, include: { account: true } });
    if (!loan || loan.account.userId !== userId) throw new NotFoundException('Loan not found');

    const installments = await this.prisma.loanInstallment.findMany({
      where: { loanId },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const dueIds = installments
      .filter((i: any) => i.status === 'FUTURE' && (i.dueDate <= now || i.dueDate.toISOString().slice(0, 10) <= todayYMD))
      .map((i: any) => i.id);

    if (dueIds.length > 0) {
      await this.prisma.loanInstallment.updateMany({
        where: { id: { in: dueIds } },
        data: { status: 'PAST_UNCONFIRMED' },
      });
      for (const inst of installments) {
        if (dueIds.includes(inst.id)) {
          inst.status = InstallmentStatus.PAST_UNCONFIRMED;
        }
      }
    }

    return installments.map((i: any) => ({
      id: i.id,
      dueDate: i.dueDate,
      principalAmount: Number(i.principalAmount),
      interestAmount: Number(i.interestAmount),
      emiAmount: Number(i.emiAmount),
      balance: Number(i.balance),
      status: i.status,
      confirmedAt: i.confirmedAt,
    }));
  }

  async confirmInstallment(userId: string, loanId: string, instId: string) {
    const loan = await this.prisma.loan.findFirst({ where: { id: loanId }, include: { account: true } });
    if (!loan || loan.account.userId !== userId) throw new NotFoundException('Loan not found');

    const inst = await this.prisma.loanInstallment.findFirst({ where: { id: instId, loanId } });
    if (!inst) throw new NotFoundException('Installment not found');
    if (inst.status === InstallmentStatus.PAID) return { ok: true };

    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const instYMD = inst.dueDate.toISOString().slice(0, 10);
    const isDueOrPast = inst.status === InstallmentStatus.PAST_UNCONFIRMED || inst.dueDate <= now || instYMD <= todayYMD;
    if (!isDueOrPast) {
      throw new BadRequestException('Future installments cannot be confirmed until their due date.');
    }

    return this.prisma.$transaction(async (tx) => {
      const confirmedAt = new Date();
      const txn = await tx.transaction.create({
        data: {
          accountId: loan.accountId,
          transactionDate: confirmedAt,
          descriptionRaw: `Loan EMI payment (${loan.id})`,
          amount: BigInt(-Number(inst.emiAmount)),
          fingerprint: `${loan.id}:${inst.id}`,
        },
      });

      const updatedInst = await tx.loanInstallment.update({
        where: { id: inst.id },
        data: { status: InstallmentStatus.PAID, confirmedAt },
      });
      return { txnId: txn.id, installmentId: updatedInst.id, ok: true };
    });
  }

  async getLoanDetails(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      include: {
        loans: {
          include: {
            installments: {
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found.');
    }

    const loan = account.loans[0];
    if (!loan) {
      throw new NotFoundException('Loan details not found for this account.');
    }

    const installments = loan.installments;
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const dueIds = installments
      .filter((i: any) => i.status === 'FUTURE' && (i.dueDate <= now || i.dueDate.toISOString().slice(0, 10) <= todayYMD))
      .map((i: any) => i.id);

    if (dueIds.length > 0) {
      await this.prisma.loanInstallment.updateMany({
        where: { id: { in: dueIds } },
        data: { status: InstallmentStatus.PAST_UNCONFIRMED },
      });
      for (const inst of installments) {
        if (dueIds.includes(inst.id)) {
          inst.status = InstallmentStatus.PAST_UNCONFIRMED;
        }
      }
    }

    const totalInterest = installments.reduce((sum: number, i: any) => sum + Number(i.interestAmount), 0);
    const paidInstallments = installments.filter((i: any) => i.status === InstallmentStatus.PAID);
    const totalPaid = paidInstallments.reduce((sum: number, i: any) => sum + Number(i.emiAmount), 0);
    const lastPaid = paidInstallments[paidInstallments.length - 1];
    const outstanding = lastPaid ? Number(lastPaid.balance) : Number(loan.principal);

    return {
      accountName: account.name,
      loan: {
        id: loan.id,
        startDate: loan.startDate.toISOString(),
        principal: Number(loan.principal),
        interestRate: Number(loan.interestRate),
        emiAmount: Number(loan.emiAmount),
        emiDay: loan.emiDay,
        termMonths: loan.termMonths,
      },
      installments: installments.map((i: any, idx: number) => ({
        id: i.id,
        number: idx + 1,
        dueDate: i.dueDate.toISOString(),
        principalAmount: Number(i.principalAmount),
        interestAmount: Number(i.interestAmount),
        emiAmount: Number(i.emiAmount),
        balance: Number(i.balance),
        status: i.status,
        confirmedAt: i.confirmedAt ? i.confirmedAt.toISOString() : null,
      })),
      summary: {
        totalInterest,
        totalPaid,
        outstanding,
        paidCount: paidInstallments.length,
        totalCount: installments.length,
      },
    };
  }

  async confirmLoanInstallment(userId: string, accountId: string, installmentId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      include: { loans: true },
    });
    if (!account) throw new NotFoundException('Account not found.');
    const loan = account.loans[0];
    if (!loan) throw new NotFoundException('Loan not found.');

    return this.confirmInstallment(userId, loan.id, installmentId);
  }
}
