import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface SetCategoryBudgetDto {
  categoryId: string;
  monthlyLimit: number; // in major units (e.g. ₹15000) or minor units
  month?: number; // 0 for default/all, 1-12 for specific month
  year?: number;  // 0 for default/all, YYYY for specific year
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

    // Fetch user's set category budgets
    const budgets = await (this.prisma as any).categoryBudget.findMany({
      where: { userId },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch actual spent per category in the target month (negative amounts = debits)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
        amount: { lt: 0 },
        categoryId: { not: null },
      },
      select: {
        categoryId: true,
        amount: true,
      },
    });

    // Map categoryId -> total spent minor units
    const spentMap = new Map<string, bigint>();
    for (const tx of transactions) {
      if (!tx.categoryId) continue;
      const absAmount = tx.amount < 0n ? -tx.amount : tx.amount;
      const current = spentMap.get(tx.categoryId) || 0n;
      spentMap.set(tx.categoryId, current + absAmount);
    }

    let totalBudgeted = 0n;
    let totalSpent = 0n;

    const items = budgets.map((b: any) => {
      const spentMinor = spentMap.get(b.categoryId) || 0n;
      const limitMinor = b.monthlyLimit;

      totalBudgeted += limitMinor;
      totalSpent += spentMinor;

      const spentNum = Number(spentMinor) / 100;
      const limitNum = Number(limitMinor) / 100;
      const remainingNum = Math.max(0, limitNum - spentNum);
      const percentage = limitNum > 0 ? Math.round((spentNum / limitNum) * 100) : 0;

      let status: 'OK' | 'WARNING' | 'EXCEEDED' = 'OK';
      if (percentage >= 100) status = 'EXCEEDED';
      else if (percentage >= 80) status = 'WARNING';

      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName: b.category.name,
        categoryColor: b.category.color,
        monthlyLimit: limitNum,
        spentAmount: spentNum,
        remainingAmount: remainingNum,
        percentage,
        status,
        month: b.month,
        year: b.year,
      };
    });

    const totalBudgetedNum = Number(totalBudgeted) / 100;
    const totalSpentNum = Number(totalSpent) / 100;
    const totalRemainingNum = Math.max(0, totalBudgetedNum - totalSpentNum);
    const overallPercentage = totalBudgetedNum > 0 ? Math.round((totalSpentNum / totalBudgetedNum) * 100) : 0;

    return {
      month,
      year,
      summary: {
        totalBudgeted: totalBudgetedNum,
        totalSpent: totalSpentNum,
        totalRemaining: totalRemainingNum,
        overallPercentage,
      },
      budgets: items,
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

    return (this.prisma as any).categoryBudget.upsert({
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
