import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async overview(@CurrentUser() user: { id: string }, @Query('month') month?: string) {
    const match = month?.match(/^(\d{4})-(\d{2})$/);
    const now = new Date();
    const year = match ? Number(match[1]) : now.getUTCFullYear();
    const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 1));
    const accounts = await this.prisma.account.findMany({ where: { userId: user.id, archived: false },
      include: { transactions: { select: { amount: true } }, holdings: { select: { currentValue: true } } } });
    const monthTransactions = await this.prisma.transaction.findMany({ where: { account: { userId: user.id },
      transactionDate: { gte: start, lt: end } }, include: { category: true, account: { select: { name: true } } },
      orderBy: { transactionDate: 'desc' } });
    const nonTransfers = monthTransactions.filter((item) => !item.transferGroupId);
    const income = nonTransfers.filter((item) => item.amount > 0).reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = Math.abs(nonTransfers.filter((item) => item.amount < 0).reduce((sum, item) => sum + Number(item.amount), 0));
    const balances = accounts.map((account) => {
      const ledgerBalance = Number(account.openingBalance) + account.transactions.reduce((sum, row) => sum + Number(row.amount), 0);
      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const hasCompleteValuation = account.holdings.length > 0 && account.holdings.every((holding) => holding.currentValue !== null);
      const balance = isPortfolio && hasCompleteValuation
        ? account.holdings.reduce((sum, holding) => sum + Number(holding.currentValue), 0)
        : ledgerBalance;
      return { id: account.id, name: account.name, type: account.type, balance,
        creditLimit: account.creditLimit === null ? null : Number(account.creditLimit), dueDay: account.dueDay };
    });
    const categoryMap = new Map<string, { name: string; color: string; amount: number }>();
    nonTransfers.filter((item) => item.amount < 0).forEach((item) => {
      const name = item.category?.name ?? 'Uncategorised'; const current = categoryMap.get(name);
      categoryMap.set(name, { name, color: item.category?.color ?? '#94a3b8', amount: (current?.amount ?? 0) + Math.abs(Number(item.amount)) });
    });
    return {
      month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`, income, expenses, savings: income - expenses,
      savingsRate: income > 0 ? Math.round(((income - expenses) / income) * 1000) / 10 : 0,
      netWorth: balances.reduce((sum, account) => sum + account.balance, 0), accounts: balances,
      categories: [...categoryMap.values()].sort((a, b) => b.amount - a.amount),
      recent: monthTransactions.slice(0, 8).map((item) => ({ id: item.id, date: item.transactionDate, description: item.merchant || item.descriptionRaw,
        amount: Number(item.amount), category: item.category?.name ?? 'Uncategorised', account: item.account.name, isTransfer: Boolean(item.transferGroupId) })),
    };
  }
}
