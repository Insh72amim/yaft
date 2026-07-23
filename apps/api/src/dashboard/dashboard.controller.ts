import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';

function extractBeneficiaryName(description: string): string | null {
  if (!description) return null;
  const upiMatch = description.match(/UPI\/(?:[^\/]+\/){2,3}([^/]+)(?:\/|$)/i);
  if (upiMatch && upiMatch[1] && !/^[0-9]+$/.test(upiMatch[1].trim())) {
    return upiMatch[1].trim();
  }
  const neftMatch = description.match(/NEFT-[^-]+-([A-Z\s]+)/i);
  if (neftMatch && neftMatch[1] && !/^[0-9]+$/.test(neftMatch[1].trim())) {
    return neftMatch[1].trim();
  }
  return null;
}

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

    const accounts = await this.prisma.account.findMany({
      where: { userId: user.id, archived: false },
      include: {
        transactions: { select: { amount: true } },
        holdings: { select: { currentValue: true } },
      },
    });

    const monthTransactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId: user.id },
        transactionDate: { gte: start, lt: end },
      },
      include: {
        category: true,
        account: { select: { id: true, name: true, type: true } },
      },
      orderBy: { transactionDate: 'desc' },
    });

    const nonTransfers = monthTransactions.filter((item) => !item.transferGroupId);
    const income = nonTransfers.filter((item) => item.amount > 0).reduce((sum, item) => sum + Number(item.amount), 0);
    const totalExpenses = Math.abs(nonTransfers.filter((item) => item.amount < 0).reduce((sum, item) => sum + Number(item.amount), 0));

    // Spend Analysis Breakdown: Consumption vs Outbound Transfers vs Investments
    let outboundTotal = 0;
    let investmentTotal = 0;
    const recipientMap = new Map<string, { name: string; amount: number; count: number }>();

    nonTransfers
      .filter((item) => item.amount < 0)
      .forEach((item) => {
        const amt = Math.abs(Number(item.amount));
        const isInvestmentAccount = ['INVESTMENT', 'STOCKS', 'EPFO', 'FIXED_DEPOSIT'].includes(item.account.type);
        const isInvestmentKeyword = /MUTUAL|FUND|ZERODHA|GROWW|BSE|NSE|SGB|NPS/i.test(item.descriptionRaw);

        if (isInvestmentAccount || isInvestmentKeyword) {
          investmentTotal += amt;
        } else {
          const payee = extractBeneficiaryName(item.descriptionRaw) || item.merchant;
          if (payee) {
            outboundTotal += amt;
            const current = recipientMap.get(payee) || { name: payee, amount: 0, count: 0 };
            recipientMap.set(payee, { name: payee, amount: current.amount + amt, count: current.count + 1 });
          }
        }
      });

    const consumption = Math.max(0, totalExpenses - outboundTotal - investmentTotal);

    const balances = accounts.map((account) => {
      const ledgerBalance = Number(account.openingBalance) + account.transactions.reduce((sum, row) => sum + Number(row.amount), 0);
      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const hasCompleteValuation = account.holdings.length > 0 && account.holdings.every((holding) => holding.currentValue !== null);
      const balance = isPortfolio && hasCompleteValuation
        ? account.holdings.reduce((sum, holding) => sum + Number(holding.currentValue), 0)
        : ledgerBalance;
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        balance,
        creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
        dueDay: account.dueDay,
      };
    });

    const categoryMap = new Map<string, { name: string; color: string; amount: number }>();
    nonTransfers
      .filter((item) => item.amount < 0)
      .forEach((item) => {
        const name = item.category?.name ?? 'Uncategorised';
        const current = categoryMap.get(name);
        categoryMap.set(name, {
          name,
          color: item.category?.color ?? '#94a3b8',
          amount: (current?.amount ?? 0) + Math.abs(Number(item.amount)),
        });
      });

    const topOutboundRecipients = [...recipientMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      income,
      expenses: totalExpenses,
      savings: income - totalExpenses,
      savingsRate: income > 0 ? Math.round(((income - totalExpenses) / income) * 1000) / 10 : 0,
      netWorth: balances.reduce((sum, account) => sum + account.balance, 0),
      accounts: balances,
      spendAnalysis: {
        consumption,
        outboundTransfers: outboundTotal,
        investments: investmentTotal,
      },
      topOutboundRecipients,
      categories: [...categoryMap.values()].sort((a, b) => b.amount - a.amount),
      recent: monthTransactions.slice(0, 8).map((item) => ({
        id: item.id,
        date: item.transactionDate,
        description: item.merchant || item.descriptionRaw,
        amount: Number(item.amount),
        category: item.category?.name ?? 'Uncategorised',
        account: item.account.name,
        isTransfer: Boolean(item.transferGroupId),
      })),
    };
  }
}
