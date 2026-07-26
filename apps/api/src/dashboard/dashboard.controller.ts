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
  async overview(
    @CurrentUser() user: { id: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    let start: Date;
    let end: Date;
    let labelMonth = '';

    if (startDate && endDate) {
      start = new Date(`${startDate}T00:00:00.000Z`);
      end = new Date(`${endDate}T23:59:59.999Z`);
      labelMonth = `${startDate} to ${endDate}`;
    } else {
      const match = month?.match(/^(\d{4})-(\d{2})$/);
      const year = match ? Number(match[1]) : now.getUTCFullYear();
      const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
      start = new Date(Date.UTC(year, monthIndex, 1));
      end = new Date(Date.UTC(year, monthIndex + 1, 1));
      labelMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    }

    const accounts = await this.prisma.account.findMany({
      where: { userId: user.id, archived: false },
      include: {
        transactions: { select: { amount: true } },
        holdings: { select: { currentValue: true } },
      },
    });

    const activeVaults = await this.prisma.accountVaultEntry.findMany({
      where: { account: { userId: user.id } },
      select: { accountId: true, last4: true },
    });

    const activeSips = (this.prisma as any).activeSip
      ? await (this.prisma as any).activeSip.findMany({
          where: { userId: user.id, status: 'ACTIVE' },
        })
      : [];

    const monthTransactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId: user.id },
        transactionDate: { gte: start, lt: end },
      },
      include: {
        category: true,
        account: { select: { id: true, name: true, type: true, institution: true } },
      },
      orderBy: { transactionDate: 'desc' },
    });

    const isInternalTransfer = (tx: (typeof monthTransactions)[0]) => {
      if (tx.transferGroupId) return true;
      for (const v of activeVaults) {
        if (v.last4 && v.accountId !== tx.accountId && tx.descriptionRaw.includes(v.last4)) {
          return true;
        }
      }
      return false;
    };

    // Calculate Savings Net Inbound and Net Outbound across all SAVINGS/BANK accounts (excluding internal transfers)
    const savingsTransactions = monthTransactions.filter((t) => ['SAVINGS', 'BANK'].includes(t.account.type));
    const savingsNonTransfers = savingsTransactions.filter((t) => !isInternalTransfer(t));

    const savingsNetInbound = savingsNonTransfers
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const savingsNetOutbound = Math.abs(
      savingsNonTransfers
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Number(t.amount), 0),
    );

    // Detailed Account-Level Cash Flow (external inbounds, internal transfers, external outbounds)
    const savingsAccountsList = accounts.filter((a) => ['SAVINGS', 'BANK'].includes(a.type));
    const savingsMap = new Map<
      string,
      {
        id: string;
        name: string;
        type: string;
        institution: string | null;
        externalInbound: number;
        externalOutbound: number;
        creditCardPayments: number;
        investments: number;
        internalInbound: number;
        internalOutbound: number;
      }
    >();

    savingsAccountsList.forEach((acc) => {
      savingsMap.set(acc.id, {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        institution: acc.institution,
        externalInbound: 0,
        externalOutbound: 0,
        creditCardPayments: 0,
        investments: 0,
        internalInbound: 0,
        internalOutbound: 0,
      });
    });

    const internalTransfersList: Array<{
      fromAccountId: string;
      fromAccountName: string;
      toAccountId: string;
      toAccountName: string;
      toAccountType?: string;
      amount: number;
    }> = [];

    monthTransactions.forEach((tx) => {
      const accFlow = savingsMap.get(tx.accountId);
      if (!accFlow) return;

      const amt = Math.abs(Number(tx.amount));
      const internal = isInternalTransfer(tx);

      if (tx.amount > 0) {
        if (internal) {
          accFlow.internalInbound += amt;
        } else {
          accFlow.externalInbound += amt;
        }
      } else {
        let destAccountId: string | undefined;
        if (tx.transferGroupId) {
          const opposite = monthTransactions.find(
            (other) => other.transferGroupId === tx.transferGroupId && other.id !== tx.id,
          );
          if (opposite) destAccountId = opposite.accountId;
        } else {
          for (const v of activeVaults) {
            if (v.last4 && v.accountId !== tx.accountId && tx.descriptionRaw.includes(v.last4)) {
              destAccountId = v.accountId;
              break;
            }
          }
        }

        const destAcc = destAccountId ? accounts.find((a) => a.id === destAccountId) : undefined;
        const isCCCategory = tx.category?.name && /CC TRANSFER|CREDIT CARD|CC PAYMENT|CARD BILL|CC BILL/i.test(tx.category.name);

        if (destAcc?.type === 'CREDIT_CARD' || isCCCategory) {
          accFlow.creditCardPayments += amt;
          if (destAcc) {
            internalTransfersList.push({
              fromAccountId: tx.accountId,
              fromAccountName: accFlow.name,
              toAccountId: destAcc.id,
              toAccountName: destAcc.name,
              toAccountType: destAcc.type,
              amount: amt,
            });
          }
        } else if (internal) {
          accFlow.internalOutbound += amt;
          if (destAcc) {
            internalTransfersList.push({
              fromAccountId: tx.accountId,
              fromAccountName: accFlow.name,
              toAccountId: destAcc.id,
              toAccountName: destAcc.name,
              toAccountType: destAcc.type,
              amount: amt,
            });
          }
        } else {
          const matchesSip = activeSips.some((sip: any) => {
            const accountMatch = !sip.sourceAccountId || sip.sourceAccountId === tx.accountId;
            const descLower = tx.descriptionRaw.toLowerCase();
            const merchantLower = (tx.merchant || '').toLowerCase();
            const keywordMatch =
              (sip.billerKeyword && descLower.includes(sip.billerKeyword.toLowerCase())) ||
              (sip.name && descLower.includes(sip.name.toLowerCase())) ||
              (sip.destinationAccount && descLower.includes(sip.destinationAccount.toLowerCase())) ||
              (sip.name && merchantLower.includes(sip.name.toLowerCase()));
            return accountMatch && keywordMatch;
          });

          const isInvestmentCategory = tx.category?.name && /INVEST|MUTUAL|SIP|STOCK|BROKER/i.test(tx.category.name);
          const isInvestmentKeyword = /MUTUAL|FUND|ZERODHA|GROWW|BSE|NSE|SGB|NPS|INDIABULLS|ICICI PRUDENTIAL|MF CENTRAL|RAZORPAY MF|SIP/i.test(tx.descriptionRaw);

          if (matchesSip || isInvestmentCategory || isInvestmentKeyword) {
            accFlow.investments += amt;
          } else {
            accFlow.externalOutbound += amt;
          }
        }
      }
    });

    const totalCreditCardPayments = [...savingsMap.values()].reduce((sum, acc) => sum + acc.creditCardPayments, 0);
    const totalInvestments = [...savingsMap.values()].reduce((sum, acc) => sum + acc.investments, 0);

    const accountFlowData = {
      accounts: [...savingsMap.values()].map((acc) => ({
        ...acc,
        totalInbound: acc.externalInbound + acc.internalInbound,
        totalOutbound: acc.externalOutbound + acc.creditCardPayments + acc.investments + acc.internalOutbound,
      })),
      internalTransfers: internalTransfersList,
      overall: {
        totalExternalInbound: savingsNetInbound,
        totalExternalOutbound: Math.max(0, savingsNetOutbound - totalInvestments - totalCreditCardPayments),
        totalCreditCardPayments,
        totalInvestments,
        totalInternalTransfers: internalTransfersList.reduce((sum, item) => sum + item.amount, 0),
      },
    };

    const nonTransfers = monthTransactions.filter((item) => !isInternalTransfer(item));
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
        const isInvestmentKeyword = /MUTUAL|FUND|ZERODHA|GROWW|BSE|NSE|SGB|NPS|SIP/i.test(item.descriptionRaw);

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

    const savingsMonthTransactions = monthTransactions.filter((item) =>
      ['SAVINGS', 'BANK'].includes(item.account.type),
    );

    return {
      month: labelMonth,
      income,
      expenses: totalExpenses,
      savings: income - totalExpenses,
      savingsRate: income > 0 ? Math.round(((income - totalExpenses) / income) * 1000) / 10 : 0,
      savingsNetInbound,
      savingsNetOutbound,
      accountFlow: accountFlowData,
      netWorth: balances.reduce((sum, account) => sum + account.balance, 0),
      accounts: balances,
      spendAnalysis: {
        consumption,
        outboundTransfers: outboundTotal,
        investments: investmentTotal,
      },
      topOutboundRecipients,
      categories: [...categoryMap.values()].sort((a, b) => b.amount - a.amount),
      recent: savingsMonthTransactions.slice(0, 8).map((item) => ({
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

  @Get('assets-history')
  async getAssetsHistory(@CurrentUser() user: { id: string }) {
    const accounts = await this.prisma.account.findMany({
      where: { userId: user.id, archived: false },
      include: {
        transactions: {
          select: { id: true, amount: true, transactionDate: true },
          orderBy: { transactionDate: 'asc' },
        },
        holdings: {
          include: { asset: true },
        },
      },
    });

    const now = new Date();
    const months: { label: string; year: number; month: number; start: Date; end: Date }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const monthLabel = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + ' ' + String(year).slice(2);
      const start = new Date(Date.UTC(year, month, 1));
      const end = new Date(Date.UTC(year, month + 1, 1));
      months.push({ label: monthLabel, year, month, start, end });
    }

    let liquidCashTotal = 0;
    let equitiesTotal = 0;
    let epfoTotal = 0;
    let debtTotal = 0;

    const accountBreakdown = accounts.map((account: any) => {
      const ledgerBalance = Number(account.openingBalance) + (account.transactions || []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const holdingsList = account.holdings || [];
      const hasCompleteValuation = holdingsList.length > 0 && holdingsList.every((holding: any) => holding.currentValue !== null);
      const balance = isPortfolio && hasCompleteValuation
        ? holdingsList.reduce((sum: number, holding: any) => sum + Number(holding.currentValue), 0)
        : ledgerBalance;

      if (['SAVINGS', 'BANK', 'CASH', 'FD', 'FIXED_DEPOSIT'].includes(account.type)) {
        if (balance > 0) liquidCashTotal += balance;
      } else if (['INVESTMENT', 'STOCKS', 'MUTUAL_FUND'].includes(account.type)) {
        if (balance > 0) equitiesTotal += balance;
      } else if (account.type === 'EPFO') {
        if (balance > 0) epfoTotal += balance;
      } else if (['LOAN', 'CREDIT_CARD'].includes(account.type)) {
        if (balance < 0) debtTotal += Math.abs(balance);
      }

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        institution: account.institution,
        balance,
        holdingCount: holdingsList.length,
        holdings: holdingsList.map((h: any) => ({
          symbol: h.asset?.symbol ?? 'ASSET',
          name: h.asset?.name ?? 'Asset Position',
          category: h.asset?.sector ?? 'General',
          quantity: Number(h.quantity),
          currentValue: h.currentValue !== null ? Number(h.currentValue) : null,
        })),
      };
    });

    const netWorth = liquidCashTotal + equitiesTotal + epfoTotal - debtTotal;

    const history = months.map((m) => {
      let liquid = 0;
      let equities = 0;
      let epfo = 0;
      let debt = 0;

      accounts.forEach((account: any) => {
        const txsUpToMonth = (account.transactions || []).filter((tx: any) => new Date(tx.transactionDate) < m.end);
        const cumLedger = Number(account.openingBalance) + txsUpToMonth.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
        const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
        const holdingsList = account.holdings || [];
        const hasCompleteValuation = holdingsList.length > 0 && holdingsList.every((holding: any) => holding.currentValue !== null);
        const bal = isPortfolio && hasCompleteValuation
          ? holdingsList.reduce((sum: number, holding: any) => sum + Number(holding.currentValue), 0)
          : cumLedger;

        if (['SAVINGS', 'BANK', 'CASH', 'FD', 'FIXED_DEPOSIT'].includes(account.type)) {
          if (bal > 0) liquid += bal;
        } else if (['INVESTMENT', 'STOCKS', 'MUTUAL_FUND'].includes(account.type)) {
          if (bal > 0) equities += bal;
        } else if (account.type === 'EPFO') {
          if (bal > 0) epfo += bal;
        } else if (['LOAN', 'CREDIT_CARD'].includes(account.type)) {
          if (bal < 0) debt += Math.abs(bal);
        }
      });

      const monthNetWorth = liquid + equities + epfo - debt;

      return {
        month: m.label,
        liquid,
        equities,
        epfo,
        debt,
        netWorth: monthNetWorth,
      };
    });

    const totalAssets = liquidCashTotal + equitiesTotal + epfoTotal;
    const allocation = {
      liquidCash: { amount: liquidCashTotal, percentage: totalAssets > 0 ? Math.round((liquidCashTotal / totalAssets) * 1000) / 10 : 0 },
      equities: { amount: equitiesTotal, percentage: totalAssets > 0 ? Math.round((equitiesTotal / totalAssets) * 1000) / 10 : 0 },
      epfo: { amount: epfoTotal, percentage: totalAssets > 0 ? Math.round((epfoTotal / totalAssets) * 1000) / 10 : 0 },
      debt: { amount: debtTotal, percentage: totalAssets > 0 ? Math.round((debtTotal / totalAssets) * 1000) / 10 : 0 },
    };

    return {
      netWorth,
      liquidCashTotal,
      equitiesTotal,
      epfoTotal,
      debtTotal,
      totalAssets,
      allocation,
      accounts: accountBreakdown,
      history,
    };
  }
}
