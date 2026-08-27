import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isRefundOrReversal } from '@yaft/shared';
import { PrismaService } from '../common/prisma.service';

export interface SetCategoryBudgetDto {
  categoryId: string;
  monthlyLimit: number; // in major units (e.g. ₹15000) or minor units
  month?: number; // 0 for default/all, 1-12 for specific month
  year?: number;  // 0 for default/all, YYYY for specific year
}

function isNonExpenseTransaction(tx: {
  amount: bigint;
  descriptionRaw: string;
  transferGroupId?: string | null;
  account?: { type?: string };
  category?: { name?: string; type?: string; superCategory?: { kind?: string } | null } | null;
}): boolean {
  // 1. Internal transfers with transferGroupId
  if (tx.transferGroupId) return true;

  const desc = (tx.descriptionRaw || '').toLowerCase();
  const catType = tx.category?.type;
  const superKind = tx.category?.superCategory?.kind;
  const catName = (tx.category?.name || '').toLowerCase();

  // 2. Explicit Non-Expense Accounting Natures
  if (catType === 'INCOME' || superKind === 'INCOME') return true;
  if (catType === 'INVESTMENT' || superKind === 'INVESTMENT') return true;
  if (catType === 'TRANSFER' || superKind === 'TRANSFER') return true;

  // 3. Category Name checks
  if (/transfer|cc transfer|cc payment|internal transfer/i.test(catName)) return true;
  if (/invest|mutual\s*fund|sip|stock|broker|zerodha|groww|kuvera|indmoney|cams|kfintech|nps|ppf|epfo|sgb|sovereign\s*gold/i.test(catName)) return true;
  if (/income|salary|dividend|interest|freelance|bonus/i.test(catName)) return true;

  // 4. CC payment / bill payment heuristics
  if (tx.account?.type === 'CREDIT_CARD') {
    if (tx.amount > 0n) {
      const isCcBillPayment = /payment\s*received|autopay|mobile\s*banking|imps|neft|upi\s*pay|bill\s*pay|thank\s*you|credit\s*card\s*payment/i.test(desc);
      if (isCcBillPayment) return true;
    }
  }

  // 5. Bank Account to CC payments or Self-Transfers
  if (/self\s*tra|tcd\s*no|firdftfr|own\s*acc|self\s*transfer|trf\s*to/i.test(desc)) return true;
  if (/credit\s*card\s*payment|cc\s*pymt|billdesk.*credit\s*card|cred\b|cred\.club/i.test(desc)) return true;

  // 6. Positive amount that is NOT a refund/reversal
  if (tx.amount > 0n && !isRefundOrReversal(tx.descriptionRaw)) {
    return true; // Non-refund credit is income/deposit/inflow, not an expense
  }

  return false;
}

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async listBudgets(userId: string, targetYear?: number, targetMonth?: number) {
    const now = new Date();
    const year = targetYear || now.getFullYear();
    const month = targetMonth !== undefined && targetMonth !== null ? targetMonth : now.getMonth() + 1; // 1-12

    // Date range for transaction aggregation
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch user's categories
    const categories = await this.prisma.category.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        superCategory: { select: { kind: true } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    // Fetch user's set category budgets
    const budgetRecords = await (this.prisma as any).categoryBudget.findMany({
      where: { userId },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const budgetMap = new Map<string, any>();
    for (const b of budgetRecords) {
      if (b.month === month && b.year === year) {
        budgetMap.set(b.categoryId, b);
      } else if (!budgetMap.has(b.categoryId) && (b.month === 0 || b.month === null)) {
        budgetMap.set(b.categoryId, b);
      }
    }

    // Fetch actual category transactions in the target month (debits minus refunds, excluding transfers)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId, archived: false },
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
        transferGroupId: null,
      },
      select: {
        id: true,
        categoryId: true,
        amount: true,
        descriptionRaw: true,
        transferGroupId: true,
        account: {
          select: { type: true },
        },
        category: {
          select: { id: true, name: true, type: true, superCategory: { select: { kind: true } } },
        },
      },
    });

    // Map categoryId -> net spent minor units (debits - refunds) and count
    const spentMap = new Map<string, bigint>();
    const txCountMap = new Map<string, number>();
    let totalAllExpensesSpentMinor = 0n;
    let totalExpenseTxCount = 0;

    for (const tx of transactions) {
      if (isNonExpenseTransaction(tx)) {
        continue;
      }

      const catId = tx.categoryId || 'uncategorised';
      const isRefund = tx.amount > 0n && isRefundOrReversal(tx.descriptionRaw);
      const current = spentMap.get(catId) || 0n;
      const count = txCountMap.get(catId) || 0;

      if (tx.amount < 0n) {
        spentMap.set(catId, current + (-tx.amount));
        txCountMap.set(catId, count + 1);
        totalAllExpensesSpentMinor += -tx.amount;
        totalExpenseTxCount++;
      } else if (isRefund) {
        const net = current - tx.amount;
        spentMap.set(catId, net < 0n ? 0n : net);
        totalAllExpensesSpentMinor = totalAllExpensesSpentMinor > tx.amount ? totalAllExpensesSpentMinor - tx.amount : 0n;
      }
    }

    let totalBudgetedMinor = 0n;
    let totalBudgetedSpentMinor = 0n;

    // Filter to expense categories only
    const expenseCategories = categories.filter(
      (c) => (c.type || 'EXPENSE') === 'EXPENSE' && (c.superCategory?.kind || 'EXPENSE') === 'EXPENSE'
    );

    const items = expenseCategories.map((cat) => {
      const b = budgetMap.get(cat.id);
      const spentMinor = spentMap.get(cat.id) || 0n;
      const txCount = txCountMap.get(cat.id) || 0;
      const limitMinor = b ? BigInt(b.monthlyLimit) : 0n;

      if (b) {
        totalBudgetedMinor += limitMinor;
        totalBudgetedSpentMinor += spentMinor;
      }

      const spentNum = Number(spentMinor) / 100;
      const limitNum = Number(limitMinor) / 100;
      const remainingNum = limitNum > 0 ? Math.max(0, limitNum - spentNum) : 0;
      const percentage = limitNum > 0 ? Math.round((spentNum / limitNum) * 100) : 0;

      let status: 'OK' | 'WARNING' | 'EXCEEDED' | 'NO_LIMIT' = 'NO_LIMIT';
      if (limitNum > 0) {
        if (spentMinor > limitMinor) status = 'EXCEEDED';
        else if (percentage >= 80) status = 'WARNING';
        else status = 'OK';
      }

      return {
        id: b ? b.id : `cat-budget-${cat.id}`,
        budgetId: b ? b.id : null,
        hasBudget: Boolean(b),
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color,
        monthlyLimit: limitNum,
        spentAmount: spentNum,
        remainingAmount: remainingNum,
        percentage,
        status,
        transactionCount: txCount,
        month: b?.month ?? month,
        year: b?.year ?? year,
      };
    });

    const totalBudgetedNum = Number(totalBudgetedMinor) / 100;
    const totalBudgetedSpentNum = Number(totalBudgetedSpentMinor) / 100;
    const totalAllExpensesSpentNum = Number(totalAllExpensesSpentMinor) / 100;
    const totalRemainingNum = Math.max(0, totalBudgetedNum - totalBudgetedSpentNum);
    const overallPercentage = totalBudgetedNum > 0 ? Math.round((totalBudgetedSpentNum / totalBudgetedNum) * 100) : 0;

    return {
      month,
      year,
      summary: {
        totalBudgeted: totalBudgetedNum,
        totalBudgetedSpent: totalBudgetedSpentNum,
        totalSpent: totalBudgetedSpentNum,
        totalAllExpensesSpent: totalAllExpensesSpentNum,
        totalRemaining: totalRemainingNum,
        overallPercentage,
        totalTransactionsCount: totalExpenseTxCount,
      },
      budgets: items,
    };
  }

  async getBudgetTransactions(
    userId: string,
    categoryId?: string,
    targetYear?: number,
    targetMonth?: number,
    search?: string,
  ) {
    const now = new Date();
    const year = targetYear || now.getFullYear();
    const month = targetMonth !== undefined && targetMonth !== null ? targetMonth : now.getMonth() + 1;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const where: any = {
      account: { userId, archived: false },
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
      transferGroupId: null,
    };

    if (categoryId && categoryId !== 'all') {
      if (categoryId === 'uncategorised') {
        where.categoryId = null;
      } else {
        where.categoryId = categoryId;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { descriptionRaw: { contains: q, mode: 'insensitive' } },
        { merchant: { contains: q, mode: 'insensitive' } },
      ];
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, type: true, institution: true } },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            type: true,
            superCategory: { select: { kind: true } },
          },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    });

    // When viewing 'all', strictly filter out non-expenses (investments, cc transfers, internal transfers, income)
    const isViewingAll = !categoryId || categoryId === 'all';
    const relevantTransactions = isViewingAll
      ? transactions.filter((t) => !isNonExpenseTransaction(t))
      : transactions;

    let totalSpentMinor = 0n;
    let totalRefundsMinor = 0n;

    const formatted = relevantTransactions.map((t) => {
      const isRefund = t.amount > 0n && isRefundOrReversal(t.descriptionRaw);
      if (t.amount < 0n) {
        totalSpentMinor += -t.amount;
      } else if (isRefund) {
        totalRefundsMinor += t.amount;
      }

      return {
        id: t.id,
        accountId: t.accountId,
        accountName: t.account.name,
        accountType: t.account.type,
        institution: t.account.institution,
        transactionDate: t.transactionDate,
        description: t.merchant || t.descriptionRaw,
        rawDescription: t.descriptionRaw,
        merchant: t.merchant,
        amount: Number(t.amount) / 100,
        amountMinor: Number(t.amount),
        categoryId: t.categoryId,
        categoryName: t.category?.name ?? 'Uncategorised',
        categoryColor: t.category?.color ?? '#94a3b8',
        tags: t.tags.map((tg) => ({
          id: tg.tag.id,
          name: tg.tag.name,
          color: tg.tag.color,
        })),
        isRefund,
      };
    });

    const netOutflowMinor = totalSpentMinor > totalRefundsMinor ? totalSpentMinor - totalRefundsMinor : 0n;

    return {
      month,
      year,
      categoryId: categoryId || 'all',
      summary: {
        totalSpent: Number(totalSpentMinor) / 100,
        totalRefunds: Number(totalRefundsMinor) / 100,
        netOutflow: Number(netOutflowMinor) / 100,
        count: formatted.length,
      },
      transactions: formatted,
    };
  }

  async setBudget(userId: string, dto: SetCategoryBudgetDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, userId },
    });
    if (!category) {
      throw new BadRequestException('Category not found.');
    }

    if (dto.monthlyLimit <= 0) {
      throw new BadRequestException('Monthly limit must be greater than 0.');
    }

    const month = dto.month || 0;
    const year = dto.year || 0;
    const limitMinor = BigInt(Math.round(dto.monthlyLimit * 100));

    const b = await (this.prisma as any).categoryBudget.upsert({
      where: {
        userId_categoryId_month_year: {
          userId,
          categoryId: dto.categoryId,
          month,
          year,
        },
      },
      update: {
        monthlyLimit: limitMinor,
      },
      create: {
        userId,
        categoryId: dto.categoryId,
        monthlyLimit: limitMinor,
        month,
        year,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return {
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category?.name,
      categoryColor: b.category?.color,
      monthlyLimit: Number(b.monthlyLimit) / 100,
      month: b.month,
      year: b.year,
    };
  }

  async deleteBudget(userId: string, id: string) {
    const existing = await (this.prisma as any).categoryBudget.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Category budget not found.');
    }

    await (this.prisma as any).categoryBudget.delete({
      where: { id },
    });

    return { success: true, message: 'Category budget deleted.' };
  }
}
