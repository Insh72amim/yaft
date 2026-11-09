import { Injectable } from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import { ExpenseAnalyticsResponse } from '@yaft/shared';
import { PrismaService } from '../common/prisma.service';
import { getMonthDateRange } from '../common/utils/transaction-utils';
import { buildDashboardOverviewReport } from './domain/cash-flow-aggregator';
import {
  buildExpenseAnalyticsResponse,
  ExpenseGranularity,
  resolveExpenseAnalyticsDateRange,
} from './domain/expense-analytics-calculator';
import {
  buildTrailing12MonthWindows,
  computeAssetsHistoryReport,
} from './domain/net-worth-calculator';
import {
  classifyTransaction,
  getAccountAssetCategory,
} from './domain/transaction-classifier';

export { classifyTransaction, getAccountAssetCategory };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    userId: string,
    startDateStr?: string,
    endDateStr?: string,
    monthStr?: string,
  ) {
    const { start, end, labelMonth } = getMonthDateRange(
      startDateStr,
      endDateStr,
      monthStr,
    );

    const [accounts, activeVaults, monthTransactions] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId, archived: false },
        include: {
          transactions: { select: { amount: true } },
          holdings: { select: { currentValue: true } },
        },
      }),
      this.prisma.accountVaultEntry.findMany({
        where: { account: { userId } },
        select: { accountId: true, last4: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          account: { userId },
          transactionDate: { gte: start, lt: end },
        },
        include: {
          category: {
            include: {
              superCategory: true,
            },
          },
          account: { select: { id: true, name: true, type: true, institution: true } },
        },
        orderBy: { transactionDate: 'desc' },
      }),
    ]);

    return buildDashboardOverviewReport({
      labelMonth,
      start,
      end,
      accounts,
      activeVaults,
      monthTransactions,
    });
  }

  async getAssetsHistory(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: {
        userId,
        archived: false,
        type: {
          in: [
            AccountType.SAVINGS,
            AccountType.BANK,
            AccountType.FIXED_DEPOSIT,
            AccountType.RECURRING_DEPOSIT,
            AccountType.CASH,
            AccountType.MUTUAL_FUND,
            AccountType.STOCKS,
            AccountType.EPFO,
            AccountType.LOAN,
          ],
        },
      },
      include: {
        holdings: {
          include: { asset: true },
        },
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
    });

    const transactionGroupBy = this.prisma.transaction?.groupBy;
    const currentBalances = transactionGroupBy
      ? await transactionGroupBy({
          by: ['accountId'],
          where: { account: { userId } },
          _sum: { amount: true },
        })
      : [];
    const currentTxSum = new Map(
      currentBalances.map((b) => [b.accountId, Number(b._sum.amount || 0)]),
    );

    const now = new Date();
    const months = buildTrailing12MonthWindows(now);

    const monthlyBalances = await Promise.all(
      months.map(async (m) => {
        const balancesByAccount = transactionGroupBy
          ? await transactionGroupBy({
              by: ['accountId'],
              where: { account: { userId }, transactionDate: { lt: m.end } },
              _sum: { amount: true },
            })
          : [];
        return {
          label: m.label,
          map: new Map(
            balancesByAccount.map((b) => [b.accountId, Number(b._sum.amount || 0)]),
          ),
        };
      }),
    );
    const monthlyTxSums = new Map(monthlyBalances.map((mb) => [mb.label, mb.map]));

    return computeAssetsHistoryReport(accounts, currentTxSum, months, monthlyTxSums, now);
  }

  async getExpenseAnalytics(
    userId: string,
    granularity: ExpenseGranularity = 'day',
    startDateStr?: string,
    endDateStr?: string,
    categoryId?: string,
    categoryTypes?: string[],
  ): Promise<ExpenseAnalyticsResponse> {
    const { startDate, endDate } = resolveExpenseAnalyticsDateRange(
      granularity,
      startDateStr,
      endDateStr,
    );

    const where: Prisma.TransactionWhereInput = {
      account: { userId, archived: false },
      transactionDate: { gte: startDate, lte: endDate },
      amount: { lt: 0n },
    };

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        category: {
          include: {
            superCategory: true,
          },
        },
        account: { select: { id: true, name: true, type: true } },
      },
      orderBy: { transactionDate: 'asc' },
    });

    return buildExpenseAnalyticsResponse(
      transactions,
      granularity,
      startDate,
      endDate,
      categoryTypes,
    );
  }
}
