import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountType, InstallmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { ClearTransactionsDto, CreateAccountDto, DeleteAccountDto, UpdateAccountDto } from './accounts.dto';
import { StatementCredentialsService } from '../common/statement-credentials.service';
import { AccountDocumentsService } from '../account-documents/account-documents.service';
import { LoansService } from '../loans/loans.service';
import { RecurringDepositsService } from '../recurring-deposits/recurring-deposits.service';

const SUPPORTED_SAVINGS_INSTITUTIONS = [
  'Axis Bank',
  'Punjab National Bank',
  'State Bank of India',
];

const SUPPORTED_STOCK_BROKERS = [
  'Zerodha',
  'Groww',
];

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: StatementCredentialsService,
    private readonly accountDocuments: AccountDocumentsService,
    private readonly loansService: LoansService,
    private readonly recurringDepositsService: RecurringDepositsService,
  ) {}

  async listAccounts(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    // Parallel SQL queries: Fetch accounts metadata and aggregate sums directly in PostgreSQL
    const [accounts, lifetimeSums, monthCreditSums, monthDebitSums] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId, archived: false },
        orderBy: { createdAt: 'desc' },
        include: {
          holdings: { select: { currentValue: true } },
          statementCredential: { select: { accountId: true } },
          vaultEntry: { select: { last4: true, cardNetwork: true } },
          parentAccount: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
          childAccounts: { select: { id: true, name: true, creditLimit: true } },
          loans: {
            include: {
              installments: {
                orderBy: { dueDate: 'asc' },
              },
            },
          },
          recurringDeposits: {
            include: {
              installments: {
                orderBy: { dueDate: 'asc' },
              },
            },
          },
        },
      }),
      this.prisma.transaction.groupBy({
        by: ['accountId'],
        where: { account: { userId, archived: false } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['accountId'],
        where: {
          account: { userId, archived: false },
          transactionDate: { gte: startOfMonth, lt: endOfMonth },
          amount: { gt: 0n },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['accountId'],
        where: {
          account: { userId, archived: false },
          transactionDate: { gte: startOfMonth, lt: endOfMonth },
          amount: { lt: 0n },
        },
        _sum: { amount: true },
      }),
    ]);

    const lifetimeSumMap = new Map<string, number>(
      lifetimeSums.map((g) => [g.accountId, Number(g._sum.amount ?? 0n)])
    );
    const monthCreditMap = new Map<string, number>(
      monthCreditSums.map((g) => [g.accountId, Number(g._sum.amount ?? 0n)])
    );
    const monthDebitMap = new Map<string, number>(
      monthDebitSums.map((g) => [g.accountId, Math.abs(Number(g._sum.amount ?? 0n))])
    );

    return accounts.map(({ holdings = [], statementCredential, vaultEntry, parentAccount, childAccounts = [], loans = [], recurringDeposits = [], ...account }) => {
      if (account.type === AccountType.LOAN) {
        const loan = loans[0];
        let balance = Number(account.openingBalance);
        let loanOutstanding = loan ? Number(loan.principal) : 0;
        let nextEmiDate: Date | null = null;
        let nextEmiAmount = 0;
        let paidInstallments = 0;
        let totalInstallments = 0;

        if (loan) {
          totalInstallments = loan.installments.length;
          const paidInsts = loan.installments.filter((i) => i.status === InstallmentStatus.PAID);
          paidInstallments = paidInsts.length;

          if (paidInsts.length > 0) {
            const lastPaid = paidInsts[paidInsts.length - 1];
            loanOutstanding = Number(lastPaid.balance);
          }

          balance = -loanOutstanding;

          const nextInst = loan.installments.find((i) => i.status !== InstallmentStatus.PAID);
          if (nextInst) {
            nextEmiDate = nextInst.dueDate;
            nextEmiAmount = Number(nextInst.emiAmount);
          }
        }

        return {
          ...account,
          openingBalance: Number(account.openingBalance),
          creditLimit: null,
          balance,
          monthlyCredited: 0,
          monthlyDebited: 0,
          hasStatementPassword: false,
          loanOutstanding,
          nextEmiDate: nextEmiDate ? nextEmiDate.toISOString() : null,
          nextEmiAmount,
          paidInstallments,
          totalInstallments,
        };
      }

      if (account.type === AccountType.RECURRING_DEPOSIT) {
        const rd = recurringDeposits[0];
        let balance = Number(account.openingBalance) + (lifetimeSumMap.get(account.id) ?? 0);
        let paidInstallments = 0;
        let totalInstallments = 0;
        let nextDepositDate: string | null = null;
        let nextDepositAmount = 0;
        let rdDetails: {
          id: string; startDate: string; monthlyAmount: number; interestRate: number;
          depositDay: number; termMonths: number; maturityAmount: number; autoIncrease: boolean;
          totalDeposited: number; totalInterest: number; paidCount: number; totalCount: number;
          nextDepositDate: string | null; nextDepositAmount: number;
        } | null = null;

        if (rd) {
          totalInstallments = rd.installments.length;
          const now = new Date();
          const todayYMD = now.toISOString().slice(0, 10);

          const paidInsts = rd.installments.filter((i) => {
            if (i.status === InstallmentStatus.PAID) return true;
            if (rd.autoIncrease && (new Date(i.dueDate) <= now || new Date(i.dueDate).toISOString().slice(0, 10) <= todayYMD)) {
              return true;
            }
            return false;
          });

          paidInstallments = paidInsts.length;
          const totalDeposited = paidInsts.reduce((sum, i) => sum + Number(i.amount), 0);
          const totalExpectedDeposit = Number(rd.monthlyAmount) * rd.termMonths;
          const totalInterest = rd.maturityAmount ? Number(rd.maturityAmount) - totalExpectedDeposit : 0;

          balance = totalDeposited + (lifetimeSumMap.get(account.id) ?? 0);

          const nextInst = rd.installments.find((i) => {
            if (i.status === InstallmentStatus.PAID) return false;
            if (rd.autoIncrease && (new Date(i.dueDate) <= now || new Date(i.dueDate).toISOString().slice(0, 10) <= todayYMD)) return false;
            return true;
          });

          if (nextInst) {
            nextDepositDate = new Date(nextInst.dueDate).toISOString();
            nextDepositAmount = Number(nextInst.amount);
          }

          rdDetails = {
            id: rd.id,
            startDate: new Date(rd.startDate).toISOString(),
            monthlyAmount: Number(rd.monthlyAmount),
            interestRate: Number(rd.interestRate),
            depositDay: rd.depositDay,
            termMonths: rd.termMonths,
            maturityAmount: rd.maturityAmount ? Number(rd.maturityAmount) : totalExpectedDeposit,
            autoIncrease: rd.autoIncrease,
            totalDeposited,
            totalInterest,
            paidCount: paidInstallments,
            totalCount: totalInstallments,
            nextDepositDate,
            nextDepositAmount,
          };
        }

        return {
          ...account,
          openingBalance: Number(account.openingBalance),
          creditLimit: null,
          balance,
          monthlyCredited: monthCreditMap.get(account.id) ?? 0,
          monthlyDebited: monthDebitMap.get(account.id) ?? 0,
          hasStatementPassword: false,
          paidInstallments,
          totalInstallments,
          nextDepositDate,
          nextDepositAmount,
          rdDetails,
        };
      }

      const isPortfolio = account.type === 'MUTUAL_FUND' || account.type === 'STOCKS';
      const hasCompleteValuation = holdings.length > 0 && holdings.every((holding) => holding.currentValue !== null);

      const txSum = lifetimeSumMap.get(account.id) ?? 0;
      let balance = Number(account.openingBalance) + txSum;

      if (isPortfolio && hasCompleteValuation) {
        balance = holdings.reduce((sum, holding) => sum + Number(holding.currentValue), 0);
      }

      const monthlyCredited = monthCreditMap.get(account.id) ?? 0;
      const monthlyDebited = monthDebitMap.get(account.id) ?? 0;

      const effectiveCreditLimit = account.creditLimit !== null
        ? Number(account.creditLimit)
        : (parentAccount?.creditLimit !== null && parentAccount?.creditLimit !== undefined ? Number(parentAccount.creditLimit) : null);

      return {
        ...account,
        openingBalance: Number(account.openingBalance),
        creditLimit: effectiveCreditLimit,
        balance,
        monthlyCredited,
        monthlyDebited,
        cardLast4: account.type === AccountType.CREDIT_CARD ? vaultEntry?.last4 ?? null : null,
        cardNetwork: account.type === AccountType.CREDIT_CARD ? vaultEntry?.cardNetwork ?? null : null,
        hasStatementPassword: Boolean(statementCredential),
        parentAccountId: account.parentAccountId ?? null,
        parentAccountName: parentAccount?.name ?? null,
        isShared: Boolean(account.parentAccountId || (childAccounts && childAccounts.length > 0)),
        isChild: Boolean(account.parentAccountId),
        childAccountCount: childAccounts?.length ?? 0,
      };
    });
  }

  async createAccount(userId: string, dto: CreateAccountDto) {
    const institution = dto.institution?.trim();
    if (dto.type === AccountType.SAVINGS && !SUPPORTED_SAVINGS_INSTITUTIONS.some((bank) => bank === institution)) {
      throw new BadRequestException('Choose Axis Bank, Punjab National Bank, or State Bank of India for a savings account.');
    }
    if (dto.type === AccountType.STOCKS && !SUPPORTED_STOCK_BROKERS.some((broker) => broker === institution)) {
      throw new BadRequestException('Choose Zerodha or Groww for a stock account.');
    }

    let validatedParentAccountId: string | null = null;
    let statementDay = dto.statementDay;
    let dueDay = dto.dueDay;
    let creditLimit = dto.creditLimit !== undefined ? BigInt(dto.creditLimit) : undefined;

    if (dto.parentAccountId) {
      if (dto.type !== AccountType.CREDIT_CARD) {
        throw new BadRequestException('Only credit cards can be linked under a shared limit/bill.');
      }
      const parentCard = await this.prisma.account.findFirst({
        where: { id: dto.parentAccountId, userId, archived: false, type: AccountType.CREDIT_CARD },
      });
      if (!parentCard) {
        throw new BadRequestException('Selected parent credit card was not found.');
      }
      if (parentCard.parentAccountId) {
        throw new BadRequestException('The selected parent card is already linked to another card. Multi-level nesting is not supported.');
      }
      validatedParentAccountId = parentCard.id;
      if (statementDay === undefined && parentCard.statementDay) {
        statementDay = parentCard.statementDay;
      }
      if (dueDay === undefined && parentCard.dueDay) {
        dueDay = parentCard.dueDay;
      }
      if (creditLimit === undefined && parentCard.creditLimit) {
        creditLimit = parentCard.creditLimit;
      }
    }

    if (dto.type === AccountType.LOAN) {
      if (!dto.loanStartDate || !dto.loanPrincipal || !dto.loanInterestRate || !dto.loanEmiAmount || !dto.loanEmiDay || !dto.loanTermMonths) {
        throw new BadRequestException('All loan details are required.');
      }

      const principalBig = BigInt(dto.loanPrincipal);
      const openingBalance = -principalBig;

      const schedule = this.loansService.generateSchedule(
        principalBig,
        dto.loanInterestRate,
        BigInt(dto.loanEmiAmount),
        new Date(dto.loanStartDate),
        dto.loanTermMonths,
      );

      const now = new Date();

      const result = await this.prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            userId,
            name: dto.name.trim(),
            type: dto.type,
            institution,
            currency: dto.currency?.toUpperCase() ?? 'INR',
            openingBalance,
          },
        });

        const loan = await tx.loan.create({
          data: {
            accountId: account.id,
            startDate: new Date(dto.loanStartDate!),
            principal: principalBig,
            interestRate: dto.loanInterestRate!.toString(),
            emiAmount: BigInt(dto.loanEmiAmount!),
            emiDay: dto.loanEmiDay!,
            termMonths: dto.loanTermMonths!,
          },
        });

        await tx.loanInstallment.createMany({
          data: schedule.map((inst) => {
            const isPast = inst.dueDate <= now;
            return {
              loanId: loan.id,
              dueDate: inst.dueDate,
              principalAmount: inst.principalAmount,
              interestAmount: inst.interestAmount,
              emiAmount: inst.emiAmount,
              balance: inst.balance,
              status: isPast ? InstallmentStatus.PAST_UNCONFIRMED : InstallmentStatus.FUTURE,
            };
          }),
        });

        return account;
      });

      return {
        ...result,
        openingBalance: Number(result.openingBalance),
        creditLimit: null,
        hasStatementPassword: false,
      };
    }

    if (dto.type === AccountType.RECURRING_DEPOSIT && dto.rdMonthlyAmount && dto.rdInterestRate && dto.rdDepositDay && dto.rdTermMonths && dto.rdStartDate) {
      const monthlyAmountBig = BigInt(dto.rdMonthlyAmount);
      const startDate = new Date(dto.rdStartDate);
      const autoIncrease = dto.rdAutoIncrease !== undefined ? Boolean(dto.rdAutoIncrease) : true;

      const maturityAmount = this.recurringDepositsService.calculateMaturity(
        monthlyAmountBig,
        dto.rdInterestRate,
        dto.rdTermMonths,
      );

      const schedule = this.recurringDepositsService.generateSchedule(
        monthlyAmountBig,
        dto.rdInterestRate,
        dto.rdDepositDay,
        startDate,
        dto.rdTermMonths,
        autoIncrease,
      );

      const result = await this.prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            userId,
            name: dto.name.trim(),
            type: dto.type,
            institution,
            currency: dto.currency?.toUpperCase() ?? 'INR',
            openingBalance: 0n,
          },
        });

        const rd = await tx.recurringDeposit.create({
          data: {
            accountId: account.id,
            startDate,
            monthlyAmount: monthlyAmountBig,
            interestRate: dto.rdInterestRate!.toString(),
            depositDay: dto.rdDepositDay!,
            termMonths: dto.rdTermMonths!,
            maturityAmount,
            autoIncrease,
          },
        });

        await tx.recurringDepositInstallment.createMany({
          data: schedule.map((inst) => ({
            recurringDepositId: rd.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate,
            amount: inst.amount,
            accumulatedBalance: inst.accumulatedBalance,
            status: inst.status,
            confirmedAt: inst.confirmedAt,
          })),
        });

        return account;
      });

      return {
        ...result,
        openingBalance: Number(result.openingBalance),
        creditLimit: null,
        hasStatementPassword: false,
      };
    }

    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type,
        institution,
        currency: dto.currency?.toUpperCase() ?? 'INR',
        openingBalance: BigInt(dto.openingBalance ?? 0),
        creditLimit,
        statementDay,
        dueDay,
        parentAccountId: validatedParentAccountId,
      },
      include: {
        parentAccount: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
      },
    });

    const effectiveCreditLimit = account.creditLimit !== null
      ? Number(account.creditLimit)
      : (account.parentAccount?.creditLimit !== null && account.parentAccount?.creditLimit !== undefined ? Number(account.parentAccount.creditLimit) : null);

    return {
      ...account,
      openingBalance: Number(account.openingBalance),
      creditLimit: effectiveCreditLimit,
      hasStatementPassword: false,
      parentAccountId: account.parentAccountId ?? null,
      parentAccountName: account.parentAccount?.name ?? null,
      isShared: Boolean(account.parentAccountId),
      isChild: Boolean(account.parentAccountId),
    };
  }

  async updateAccount(userId: string, accountId: string, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      include: { childAccounts: { select: { id: true } } },
    });
    if (!account) throw new NotFoundException('Account not found.');

    /** Typed update payload — using explicit scalar/relation field names to avoid as-any casts. */
    const updateData: {
      name?: string;
      institution?: string | null;
      openingBalance?: bigint;
      creditLimit?: bigint | null;
      statementDay?: number | null;
      dueDay?: number | null;
      parentAccountId?: string | null;
      emailSyncEnabled?: boolean;
    } = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.institution !== undefined) updateData.institution = dto.institution;
    if (dto.openingBalance !== undefined) updateData.openingBalance = BigInt(dto.openingBalance);
    if (dto.creditLimit !== undefined) updateData.creditLimit = dto.creditLimit !== null ? BigInt(dto.creditLimit) : null;
    if (dto.statementDay !== undefined) updateData.statementDay = dto.statementDay;
    if (dto.dueDay !== undefined) updateData.dueDay = dto.dueDay;
    if (dto.emailSyncEnabled !== undefined) updateData.emailSyncEnabled = dto.emailSyncEnabled;

    if (dto.parentAccountId !== undefined) {
      if (dto.parentAccountId) {
        if (account.type !== AccountType.CREDIT_CARD) {
          throw new BadRequestException('Only credit cards can be linked under a shared limit/bill.');
        }
        if (dto.parentAccountId === account.id) {
          throw new BadRequestException('A card cannot link to itself.');
        }
        if (account.childAccounts && account.childAccounts.length > 0) {
          throw new BadRequestException('This card has other cards linked to it and cannot become a child card.');
        }
        const parentCard = await this.prisma.account.findFirst({
          where: { id: dto.parentAccountId, userId, archived: false, type: AccountType.CREDIT_CARD },
        });
        if (!parentCard) {
          throw new BadRequestException('Selected parent credit card was not found.');
        }
        if (parentCard.parentAccountId) {
          throw new BadRequestException('The selected parent card is already linked to another card. Multi-level nesting is not supported.');
        }
        updateData.parentAccountId = parentCard.id;
      } else {
        updateData.parentAccountId = null;
      }
    }

    const updated = await this.prisma.account.update({
      where: { id: account.id },
      data: updateData,
      include: {
        parentAccount: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
        childAccounts: { select: { id: true, name: true, creditLimit: true } },
      },
    });

    const effectiveCreditLimit = updated.creditLimit !== null
      ? Number(updated.creditLimit)
      : (updated.parentAccount?.creditLimit !== null && updated.parentAccount?.creditLimit !== undefined ? Number(updated.parentAccount.creditLimit) : null);

    return {
      ...updated,
      openingBalance: Number(updated.openingBalance),
      creditLimit: effectiveCreditLimit,
      parentAccountId: updated.parentAccountId ?? null,
      parentAccountName: updated.parentAccount?.name ?? null,
      isShared: Boolean(updated.parentAccountId || (updated.childAccounts && updated.childAccounts.length > 0)),
      isChild: Boolean(updated.parentAccountId),
      childAccountCount: updated.childAccounts?.length ?? 0,
    };
  }

  async forgetStatementPassword(userId: string, accountId: string) {
    await this.credentials.forget(userId, accountId);
  }

  async deleteAccount(userId: string, accountId: string, dto: DeleteAccountDto) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true, name: true } });
    if (!account) throw new NotFoundException('Account not found.');
    if (dto.confirmationName !== account.name) throw new BadRequestException('Enter the account name exactly to confirm deletion.');
    await this.accountDocuments.purgeForAccount(userId, account.id);
    await this.prisma.$transaction(async (tx) => {
      const linkedTransfers = await tx.transaction.findMany({
        where: { accountId: account.id, transferGroupId: { not: null } },
        select: { transferGroupId: true },
      });
      const transferGroupIds = [...new Set(linkedTransfers.flatMap((item) => item.transferGroupId ? [item.transferGroupId] : []))];
      if (transferGroupIds.length) {
        await tx.transaction.updateMany({
          where: { accountId: { not: account.id }, account: { userId }, transferGroupId: { in: transferGroupIds } },
          data: { transferGroupId: null },
        });
      }
      await tx.account.delete({ where: { id: account.id } });
    });
  }

  async clearTransactions(userId: string, accountId: string, dto: ClearTransactionsDto) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true, name: true } });
    if (!account) throw new NotFoundException('Account not found.');
    if (dto.confirmationName.trim().toLowerCase() !== account.name.trim().toLowerCase()) {
      throw new BadRequestException('Enter the account name exactly to confirm clearing transactions.');
    }

    let dateFilter: { gte: Date } | undefined = undefined;
    if (dto.days && dto.days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - dto.days);
      cutoff.setHours(0, 0, 0, 0);
      dateFilter = { gte: cutoff };
    }

    const txWhere: Prisma.TransactionWhereInput = {
      accountId: account.id,
      ...(dateFilter ? { transactionDate: dateFilter } : {}),
    };

    let deletedCount = 0;
    await this.prisma.$transaction(async (tx) => {
      const targetTxs = await tx.transaction.findMany({
        where: txWhere,
        select: { id: true, transferGroupId: true },
      });

      if (targetTxs.length === 0) return;

      const transferGroupIds = [...new Set(targetTxs.flatMap((item) => item.transferGroupId ? [item.transferGroupId] : []))];
      if (transferGroupIds.length) {
        await tx.transaction.updateMany({
          where: { accountId: { not: account.id }, account: { userId }, transferGroupId: { in: transferGroupIds } },
          data: { transferGroupId: null },
        });
      }
      const deleteResult = await tx.transaction.deleteMany({ where: txWhere });
      deletedCount = deleteResult.count;

      if (!dto.days) {
        await tx.importBatch.deleteMany({ where: { accountId: account.id } });
        await tx.account.update({ where: { id: account.id }, data: { openingBalance: 0n } });
      }
    });

    return {
      deletedCount,
      message: dto.days
        ? `Successfully cleared ${deletedCount} transaction(s) from the last ${dto.days} days.`
        : `Successfully cleared all ${deletedCount} transaction(s).`,
    };
  }
}
