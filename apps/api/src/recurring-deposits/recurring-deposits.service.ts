import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InstallmentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateRecurringDepositDto, UpdateRecurringDepositSettingsDto } from './recurring-deposits.dto';

export interface RecurringDepositScheduleRow {
  installmentNumber: number;
  dueDate: Date;
  amount: bigint;
  accumulatedBalance: bigint;
  status: InstallmentStatus;
  confirmedAt: Date | null;
}

export type RecurringDepositDetailsResponse =
  | {
      hasSchedule: false;
      accountName: string;
      institution: string | null;
    }
  | {
      hasSchedule: true;
      accountName: string;
      institution: string | null;
      rd: {
        id: string;
        startDate: string;
        maturityDate: string | null;
        monthlyAmount: number;
        interestRate: number;
        depositDay: number;
        termMonths: number;
        maturityAmount: number;
        autoIncrease: boolean;
        sourceAccountId: string | null;
        createdAt: string;
      };
      summary: {
        totalDeposited: number;
        totalExpectedDeposit: number;
        totalInterest: number;
        maturityAmount: number;
        paidCount: number;
        totalCount: number;
        nextDepositDate: string | null;
        nextDepositAmount: number;
        progressPct: number;
      };
      installments: {
        id: string;
        number: number;
        dueDate: string;
        amount: number;
        accumulatedBalance: number;
        status: InstallmentStatus;
        confirmedAt: string | null;
      }[];
    };

@Injectable()
export class RecurringDepositsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate Indian Recurring Deposit maturity amount with quarterly compounding.
   * M = sum_{k=1}^N P * (1 + r/400)^((N - k + 1)/3)
   */
  calculateMaturity(monthlyAmountPaise: bigint, annualRatePct: number, termMonths: number): bigint {
    let totalMaturity = 0;
    const p = Number(monthlyAmountPaise);
    const r = annualRatePct;
    const quarterlyRate = r / 400;

    for (let k = 1; k <= termMonths; k++) {
      const remainingMonths = termMonths - k + 1;
      const quarters = remainingMonths / 3;
      const compoundFactor = Math.pow(1 + quarterlyRate, quarters);
      totalMaturity += p * compoundFactor;
    }

    return BigInt(Math.round(totalMaturity));
  }

  /**
   * Generate schedule of N installments with accurate dates and initial status.
   */
  generateSchedule(
    monthlyAmountPaise: bigint,
    annualRatePct: number,
    depositDay: number,
    startDate: Date,
    termMonths: number,
    autoIncrease: boolean = true,
  ): RecurringDepositScheduleRow[] {
    const schedule: RecurringDepositScheduleRow[] = [];
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);

    let accumulated = 0n;

    for (let k = 1; k <= termMonths; k++) {
      accumulated += monthlyAmountPaise;

      // Construct target year & month
      const targetYear = startDate.getFullYear();
      const targetMonth = startDate.getMonth() + (k - 1);
      const computedDate = new Date(Date.UTC(targetYear, targetMonth, 1));
      
      // Compute maximum days in this month to prevent invalid day rollover (e.g. Feb 30 -> Mar 2)
      const lastDayOfMonth = new Date(Date.UTC(computedDate.getUTCFullYear(), computedDate.getUTCMonth() + 1, 0)).getUTCDate();
      const actualDay = Math.min(depositDay, lastDayOfMonth);
      const dueDate = new Date(Date.UTC(computedDate.getUTCFullYear(), computedDate.getUTCMonth(), actualDay));

      const dueYMD = dueDate.toISOString().slice(0, 10);
      const isDueOrPast = dueDate <= now || dueYMD <= todayYMD;

      let status: InstallmentStatus = InstallmentStatus.FUTURE;
      let confirmedAt: Date | null = null;

      if (isDueOrPast) {
        if (autoIncrease) {
          status = InstallmentStatus.PAID;
          confirmedAt = dueDate;
        } else {
          status = InstallmentStatus.PAST_UNCONFIRMED;
        }
      }

      schedule.push({
        installmentNumber: k,
        dueDate,
        amount: monthlyAmountPaise,
        accumulatedBalance: accumulated,
        status,
        confirmedAt,
      });
    }

    return schedule;
  }

  /**
   * Create or replace Recurring Deposit schedule on an account.
   */
  async createOrUpdateSchedule(
    userId: string,
    accountId: string,
    dto: CreateRecurringDepositDto,
  ): Promise<RecurringDepositDetailsResponse> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
    });
    if (!account) throw new NotFoundException('Account not found');

    const monthlyAmountPaise = BigInt(dto.monthlyAmount);
    const startDate = new Date(dto.startDate);
    const autoIncrease = dto.autoIncrease ?? true;

    const maturityAmount = this.calculateMaturity(
      monthlyAmountPaise,
      dto.interestRate,
      dto.termMonths,
    );

    const schedule = this.generateSchedule(
      monthlyAmountPaise,
      dto.interestRate,
      dto.depositDay,
      startDate,
      dto.termMonths,
      autoIncrease,
    );

    const rd = await this.prisma.$transaction(async (tx) => {
      // Remove any existing RD records for this account
      await tx.recurringDeposit.deleteMany({ where: { accountId } });

      const createdRd = await tx.recurringDeposit.create({
        data: {
          accountId,
          startDate,
          monthlyAmount: monthlyAmountPaise,
          interestRate: dto.interestRate.toString(),
          depositDay: dto.depositDay,
          termMonths: dto.termMonths,
          maturityAmount,
          autoIncrease,
          sourceAccountId: dto.sourceAccountId ?? null,
        },
      });

      await tx.recurringDepositInstallment.createMany({
        data: schedule.map((s) => ({
          recurringDepositId: createdRd.id,
          installmentNumber: s.installmentNumber,
          dueDate: s.dueDate,
          amount: s.amount,
          accumulatedBalance: s.accumulatedBalance,
          status: s.status,
          confirmedAt: s.confirmedAt,
        })),
      });

      return createdRd;
    });

    return this.getRecurringDepositDetails(userId, accountId);
  }

  /**
   * Get full RD schedule, terms, maturity summary, and auto-process any due installments.
   */
  async getRecurringDepositDetails(
    userId: string,
    accountId: string,
  ): Promise<RecurringDepositDetailsResponse> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
      include: {
        recurringDeposits: {
          include: {
            installments: {
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    });

    if (!account) throw new NotFoundException('Account not found');

    const rd = account.recurringDeposits[0];
    if (!rd) {
      return {
        hasSchedule: false,
        accountName: account.name,
        institution: account.institution,
      };
    }

    const installments = rd.installments;
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);

    // Auto-increase balance processing on due day
    if (rd.autoIncrease) {
      const autoDueIds = installments
        .filter(
          (i) =>
            i.status !== InstallmentStatus.PAID &&
            (i.dueDate <= now || i.dueDate.toISOString().slice(0, 10) <= todayYMD),
        )
        .map((i) => i.id);

      if (autoDueIds.length > 0) {
        await this.prisma.recurringDepositInstallment.updateMany({
          where: { id: { in: autoDueIds } },
          data: { status: InstallmentStatus.PAID, confirmedAt: now },
        });
        for (const inst of installments) {
          if (autoDueIds.includes(inst.id)) {
            inst.status = InstallmentStatus.PAID;
            inst.confirmedAt = now;
          }
        }
      }
    } else {
      const unconfirmedDueIds = installments
        .filter(
          (i) =>
            i.status === InstallmentStatus.FUTURE &&
            (i.dueDate <= now || i.dueDate.toISOString().slice(0, 10) <= todayYMD),
        )
        .map((i) => i.id);

      if (unconfirmedDueIds.length > 0) {
        await this.prisma.recurringDepositInstallment.updateMany({
          where: { id: { in: unconfirmedDueIds } },
          data: { status: InstallmentStatus.PAST_UNCONFIRMED },
        });
        for (const inst of installments) {
          if (unconfirmedDueIds.includes(inst.id)) {
            inst.status = InstallmentStatus.PAST_UNCONFIRMED;
          }
        }
      }
    }

    const paidInstallments = installments.filter((i) => i.status === InstallmentStatus.PAID);
    const totalDeposited = paidInstallments.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalExpectedDeposit = Number(rd.monthlyAmount) * rd.termMonths;
    const totalInterest = rd.maturityAmount
      ? Number(rd.maturityAmount) - totalExpectedDeposit
      : 0;

    const nextInst = installments.find((i) => i.status !== InstallmentStatus.PAID);
    const nextDepositDate = nextInst ? nextInst.dueDate.toISOString() : null;
    const nextDepositAmount = nextInst ? Number(nextInst.amount) : 0;
    const maturityDate = installments.length > 0
      ? installments[installments.length - 1].dueDate.toISOString()
      : null;

    return {
      hasSchedule: true,
      accountName: account.name,
      institution: account.institution,
      rd: {
        id: rd.id,
        startDate: rd.startDate.toISOString(),
        maturityDate,
        monthlyAmount: Number(rd.monthlyAmount),
        interestRate: Number(rd.interestRate),
        depositDay: rd.depositDay,
        termMonths: rd.termMonths,
        maturityAmount: rd.maturityAmount ? Number(rd.maturityAmount) : totalExpectedDeposit,
        autoIncrease: rd.autoIncrease,
        sourceAccountId: rd.sourceAccountId,
        createdAt: rd.createdAt.toISOString(),
      },
      summary: {
        totalDeposited,
        totalExpectedDeposit,
        totalInterest,
        maturityAmount: rd.maturityAmount ? Number(rd.maturityAmount) : totalExpectedDeposit,
        paidCount: paidInstallments.length,
        totalCount: installments.length,
        nextDepositDate,
        nextDepositAmount,
        progressPct: installments.length > 0
          ? Math.round((paidInstallments.length / installments.length) * 100)
          : 0,
      },
      installments: installments.map((i, idx) => ({
        id: i.id,
        number: i.installmentNumber || idx + 1,
        dueDate: i.dueDate.toISOString(),
        amount: Number(i.amount),
        accumulatedBalance: Number(i.accumulatedBalance),
        status: i.status,
        confirmedAt: i.confirmedAt ? i.confirmedAt.toISOString() : null,
      })),
    };
  }

  /**
   * Update settings such as toggling autoIncrease or changing depositDay.
   */
  async updateSettings(
    userId: string,
    accountId: string,
    dto: UpdateRecurringDepositSettingsDto,
  ): Promise<RecurringDepositDetailsResponse> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
      include: { recurringDeposits: true },
    });
    if (!account) throw new NotFoundException('Account not found');
    const rd = account.recurringDeposits[0];
    if (!rd) throw new NotFoundException('No Recurring Deposit schedule found on this account');

    const updateData: any = {};
    if (dto.autoIncrease !== undefined) updateData.autoIncrease = dto.autoIncrease;
    if (dto.depositDay !== undefined) updateData.depositDay = dto.depositDay;
    if (dto.interestRate !== undefined) updateData.interestRate = dto.interestRate.toString();
    if (dto.monthlyAmount !== undefined) updateData.monthlyAmount = BigInt(dto.monthlyAmount);
    if (dto.sourceAccountId !== undefined) updateData.sourceAccountId = dto.sourceAccountId;

    await this.prisma.recurringDeposit.update({
      where: { id: rd.id },
      data: updateData,
    });

    // If autoIncrease was toggled ON, immediately auto-confirm all past due installments
    if (dto.autoIncrease === true) {
      const now = new Date();
      const todayYMD = now.toISOString().slice(0, 10);
      const pastInsts = await this.prisma.recurringDepositInstallment.findMany({
        where: {
          recurringDepositId: rd.id,
          status: { not: InstallmentStatus.PAID },
          OR: [
            { dueDate: { lte: now } },
          ],
        },
      });
      const duePastIds = pastInsts
        .filter((i) => i.dueDate <= now || i.dueDate.toISOString().slice(0, 10) <= todayYMD)
        .map((i) => i.id);

      if (duePastIds.length > 0) {
        await this.prisma.recurringDepositInstallment.updateMany({
          where: { id: { in: duePastIds } },
          data: { status: InstallmentStatus.PAID, confirmedAt: now },
        });
      }
    }

    return this.getRecurringDepositDetails(userId, accountId);
  }

  /**
   * Confirm an individual deposit installment manually.
   */
  async confirmInstallment(userId: string, accountId: string, installmentId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
      include: { recurringDeposits: true },
    });
    if (!account) throw new NotFoundException('Account not found');
    const rd = account.recurringDeposits[0];
    if (!rd) throw new NotFoundException('No Recurring Deposit schedule found');

    const inst = await this.prisma.recurringDepositInstallment.findFirst({
      where: { id: installmentId, recurringDepositId: rd.id },
    });
    if (!inst) throw new NotFoundException('Installment not found');

    const now = new Date();
    await this.prisma.recurringDepositInstallment.update({
      where: { id: inst.id },
      data: { status: InstallmentStatus.PAID, confirmedAt: now },
    });

    return { ok: true, installmentId: inst.id };
  }

  /**
   * Unconfirm / mark installment pending.
   */
  async unconfirmInstallment(userId: string, accountId: string, installmentId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
      include: { recurringDeposits: true },
    });
    if (!account) throw new NotFoundException('Account not found');
    const rd = account.recurringDeposits[0];
    if (!rd) throw new NotFoundException('No Recurring Deposit schedule found');

    const inst = await this.prisma.recurringDepositInstallment.findFirst({
      where: { id: installmentId, recurringDepositId: rd.id },
    });
    if (!inst) throw new NotFoundException('Installment not found');

    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const dueYMD = inst.dueDate.toISOString().slice(0, 10);
    const isPast = inst.dueDate <= now || dueYMD <= todayYMD;

    await this.prisma.recurringDepositInstallment.update({
      where: { id: inst.id },
      data: {
        status: isPast ? InstallmentStatus.PAST_UNCONFIRMED : InstallmentStatus.FUTURE,
        confirmedAt: null,
      },
    });

    return { ok: true, installmentId: inst.id };
  }
}
