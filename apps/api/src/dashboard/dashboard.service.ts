import { Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { extractBeneficiaryName, getMonthDateRange, isRefundOrReversal } from '../common/utils/transaction-utils';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    userId: string,
    startDateStr?: string,
    endDateStr?: string,
    monthStr?: string,
  ) {
    const { start, end, labelMonth } = getMonthDateRange(startDateStr, endDateStr, monthStr);

    const accounts = await this.prisma.account.findMany({
      where: { userId, archived: false },
      include: {
        transactions: { select: { amount: true } },
        holdings: { select: { currentValue: true } },
      },
    });

    const activeVaults = await this.prisma.accountVaultEntry.findMany({
      where: { account: { userId } },
      select: { accountId: true, last4: true },
    });

    const activeSips = (this.prisma as any).activeSip
      ? await (this.prisma as any).activeSip.findMany({
          where: { userId, status: 'ACTIVE' },
        })
      : [];

    const monthTransactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
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

    const isRefund = (tx: (typeof monthTransactions)[0]) => {
      if (tx.amount <= 0) return false;
      if (isInternalTransfer(tx)) return false;

      const desc = tx.descriptionRaw.toLowerCase();
      if (tx.account.type === 'CREDIT_CARD') {
        const isCcBillPayment = /payment\s*received|autopay|mobile\s*banking|imps|neft|upi\s*pay|bill\s*pay|thank\s*you|credit\s*card\s*payment/i.test(desc);
        if (isCcBillPayment) return false;
        return true;
      }

      return isRefundOrReversal(tx.descriptionRaw);
    };

    // Savings Accounts Cash Flow
    const savingsTransactions = monthTransactions.filter((t) => ['SAVINGS', 'BANK'].includes(t.account.type));
    const savingsNonTransfers = savingsTransactions.filter((t) => !isInternalTransfer(t));

    const savingsNetInbound = savingsNonTransfers
      .filter((t) => t.amount > 0 && !isRefund(t))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const savingsNetOutbound = Math.abs(
      savingsNonTransfers
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Number(t.amount), 0),
    );

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
        const isCCCategory = Boolean(tx.category?.name && /^\s*cc transfer\s*$/i.test(tx.category.name));

        if (isCCCategory) {
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

    const accountDetailedFlows = [...savingsMap.values()].map((acc) => {
      const accountTxs = monthTransactions.filter((t) => t.accountId === acc.id && t.amount < 0);
      const totalOutboundAmt = acc.externalOutbound + acc.creditCardPayments + acc.investments + acc.internalOutbound;

      const categoryMapAcc = new Map<string, { name: string; color: string; amount: number }>();
      accountTxs.forEach((t) => {
        const name = t.category?.name ?? 'Uncategorised';
        const color = t.category?.color ?? '#94a3b8';
        const amt = Math.abs(Number(t.amount));
        const current = categoryMapAcc.get(name) || { name, color, amount: 0 };
        categoryMapAcc.set(name, { name, color, amount: current.amount + amt });
      });

      const categories = [...categoryMapAcc.values()]
        .map((c) => ({
          ...c,
          percentage: totalOutboundAmt > 0 ? Math.round((c.amount / totalOutboundAmt) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const externalRecipientsMap = new Map<string, { name: string; amount: number; count: number; isInternal: false }>();
      const internalRecipientsMap = new Map<string, { name: string; amount: number; count: number; isInternal: true }>();
      const allRecipientsMap = new Map<string, { name: string; amount: number; count: number; isInternal: boolean }>();

      accountTxs.forEach((t) => {
        const amt = Math.abs(Number(t.amount));
        let destAccountId: string | undefined;
        if (t.transferGroupId) {
          const opposite = monthTransactions.find(
            (other) => other.transferGroupId === t.transferGroupId && other.id !== t.id,
          );
          if (opposite) destAccountId = opposite.accountId;
        } else {
          for (const v of activeVaults) {
            if (v.last4 && v.accountId !== t.accountId && t.descriptionRaw.includes(v.last4)) {
              destAccountId = v.accountId;
              break;
            }
          }
        }

        const destAcc = destAccountId ? accounts.find((a) => a.id === destAccountId) : undefined;
        const isCCCategory = Boolean(t.category?.name && /^\s*cc transfer\s*$/i.test(t.category.name));
        const internal = isInternalTransfer(t);

        const isInternalFlow = destAcc !== undefined || isCCCategory || internal;

        let name = '';
        if (destAcc) {
          name = destAcc.name;
        } else if (isCCCategory) {
          name = t.category?.name || 'Credit Card Payment';
        } else {
          name = extractBeneficiaryName(t.descriptionRaw) || t.merchant || t.descriptionRaw;
        }

        const allCurr = allRecipientsMap.get(name) || { name, amount: 0, count: 0, isInternal: isInternalFlow };
        allRecipientsMap.set(name, {
          name,
          amount: allCurr.amount + amt,
          count: allCurr.count + 1,
          isInternal: isInternalFlow,
        });

        if (isInternalFlow) {
          const currInt = internalRecipientsMap.get(name) || { name, amount: 0, count: 0, isInternal: true };
          internalRecipientsMap.set(name, { name, amount: currInt.amount + amt, count: currInt.count + 1, isInternal: true });
        } else {
          const currExt = externalRecipientsMap.get(name) || { name, amount: 0, count: 0, isInternal: false };
          externalRecipientsMap.set(name, { name, amount: currExt.amount + amt, count: currExt.count + 1, isInternal: false });
        }
      });

      const topRecipients = [...allRecipientsMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
      const topExternalRecipients = [...externalRecipientsMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
      const topInternalRecipients = [...internalRecipientsMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);

      const topExtSum = topExternalRecipients.reduce((s, r) => s + r.amount, 0);
      const topExtCount = topExternalRecipients.reduce((s, r) => s + r.count, 0);
      const otherExternalOutbound = {
        amount: Math.max(0, acc.externalOutbound - topExtSum),
        count: Math.max(0, accountTxs.length - topExtCount),
      };

      const topIntSum = topInternalRecipients.reduce((s, r) => s + r.amount, 0);
      const topIntCount = topInternalRecipients.reduce((s, r) => s + r.count, 0);
      const otherInternalOutbound = {
        amount: Math.max(0, (acc.creditCardPayments + acc.investments + acc.internalOutbound) - topIntSum),
        count: Math.max(0, accountTxs.length - topIntCount),
      };

      return {
        ...acc,
        totalInbound: acc.externalInbound + acc.internalInbound,
        totalOutbound: totalOutboundAmt,
        categories,
        topRecipients,
        topExternalRecipients,
        otherExternalOutbound,
        topInternalRecipients,
        otherInternalOutbound,
      };
    });

    const categoryMapOverall = new Map<
      string,
      { name: string; color: string; amount: number }
    >();
    monthTransactions.forEach((t) => {
      if (t.amount >= 0) return;
      const name = t.category?.name ?? 'Uncategorised';
      const color = t.category?.color ?? '#94a3b8';
      const amt = Math.abs(Number(t.amount));
      const current = categoryMapOverall.get(name) || { name, color, amount: 0 };
      categoryMapOverall.set(name, { name, color, amount: current.amount + amt });
    });

    const overallCategories = [...categoryMapOverall.values()].sort((a, b) => b.amount - a.amount);
    const outboundCategories = overallCategories.filter(
      (c) => !/cc transfer|invest|mutual|sip|stock|broker/i.test(c.name),
    );
    const creditCardCategories = overallCategories.filter((c) => /cc transfer/i.test(c.name));
    const investmentCategories = overallCategories.filter((c) =>
      /invest|mutual|sip|stock|broker/i.test(c.name),
    );

    const totalExternalInbound = [...savingsMap.values()].reduce((sum, acc) => sum + acc.externalInbound, 0);
    const totalExternalOutbound = [...savingsMap.values()].reduce((sum, acc) => sum + acc.externalOutbound, 0);
    const totalInternalTransfers = [...savingsMap.values()].reduce((sum, acc) => sum + acc.internalInbound, 0);

    const savings = savingsNetInbound - savingsNetOutbound;
    const savingsRate = savingsNetInbound > 0 ? Math.round((savings / savingsNetInbound) * 100) : 0;

    const mappedAccounts = accounts.map(({ transactions, holdings = [], ...account }) => {
      const ledgerBalance = Number(account.openingBalance) + transactions.reduce((sum, item) => sum + Number(item.amount), 0);
      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const hasCompleteValuation = holdings.length > 0 && holdings.every((holding) => holding.currentValue !== null);
      const balance = isPortfolio && hasCompleteValuation
        ? holdings.reduce((sum, holding) => sum + Number(holding.currentValue), 0)
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

    const netWorth = mappedAccounts.reduce((sum, a) => {
      if (a.type === AccountType.LOAN) return sum - Math.abs(a.balance);
      if (a.type === AccountType.CREDIT_CARD) return a.balance < 0 ? sum - Math.abs(a.balance) : sum;
      return sum + a.balance;
    }, 0);

    const categoriesMap = new Map<string, { name: string; color: string; amount: number }>();
    monthTransactions.forEach((t) => {
      if (t.amount >= 0) return;
      const name = t.category?.name ?? 'Uncategorised';
      const color = t.category?.color ?? '#94a3b8';
      const absAmt = Math.abs(Number(t.amount));
      const curr = categoriesMap.get(name) || { name, color, amount: 0 };
      categoriesMap.set(name, { name, color, amount: curr.amount + absAmt });
    });
    const categories = [...categoriesMap.values()].sort((a, b) => b.amount - a.amount);

    const recent = monthTransactions.slice(0, 10).map((t) => ({
      id: t.id,
      date: t.transactionDate ? new Date(t.transactionDate).toISOString() : new Date().toISOString(),
      description: t.merchant || t.descriptionRaw,
      amount: Number(t.amount),
      category: t.category?.name ?? 'Uncategorised',
      account: t.account.name,
      isTransfer: Boolean(t.transferGroupId),
    }));

    return {
      month: labelMonth,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      income: savingsNetInbound,
      expenses: savingsNetOutbound,
      savingsNetInbound,
      savingsNetOutbound,
      savings,
      savingsRate,
      netWorth,
      accounts: mappedAccounts,
      categories,
      recent,
      accountFlow: {
        accounts: accountDetailedFlows,
        internalTransfers: internalTransfersList,
        overall: {
          totalExternalInbound,
          totalExternalOutbound,
          totalCreditCardPayments,
          totalInvestments,
          totalInternalTransfers,
          categoryFlow: {
            outboundCategories,
            creditCardCategories,
            investmentCategories,
            overallCategories,
          },
        },
      },
    };
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
            AccountType.CASH,
            AccountType.INVESTMENT,
            AccountType.STOCKS,
            AccountType.EPFO,
            AccountType.LOAN,
            AccountType.CREDIT_CARD,
          ],
        },
      },
      include: {
        transactions: {
          select: { id: true, amount: true, transactionDate: true },
          orderBy: { transactionDate: 'asc' },
        },
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
      },
    });

    const now = new Date();
    const months: { label: string; year: number; month: number; start: Date; end: Date }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const monthLabel = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + ' ' + String(year).slice(2);
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
      months.push({ label: monthLabel, year, month, start, end });
    }

    let savingsTotal = 0;
    let depositsTotal = 0;
    let stocksTotal = 0;
    let mutualFundsTotal = 0;
    let epfoTotal = 0;
    let debtTotal = 0;

    const accountBreakdown = accounts.map((account: any) => {
      let balance = 0;
      const isLoan = account.type === 'LOAN';
      const isCreditCard = account.type === 'CREDIT_CARD';
      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const holdingsList = account.holdings || [];

      if (isLoan) {
        const loan = (account.loans || [])[0];
        if (loan) {
          const paidInsts = (loan.installments || []).filter((i: any) => i.status === 'PAID');
          let loanOutstanding = Number(loan.principal);
          if (paidInsts.length > 0) {
            const lastPaid = paidInsts[paidInsts.length - 1];
            loanOutstanding = Number(lastPaid.balance);
          }
          balance = -loanOutstanding;
        } else {
          const ledgerBalance = Number(account.openingBalance) + (account.transactions || []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
          balance = ledgerBalance < 0 ? ledgerBalance : -ledgerBalance;
        }
      } else {
        const ledgerBalance = Number(account.openingBalance) + (account.transactions || []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
        const hasCompleteValuation = holdingsList.length > 0 && holdingsList.every((holding: any) => holding.currentValue !== null);
        balance = isPortfolio && hasCompleteValuation
          ? holdingsList.reduce((sum: number, holding: any) => sum + Number(holding.currentValue), 0)
          : ledgerBalance;
      }

      let category = 'SAVINGS';
      const nameLower = (account.name + ' ' + (account.institution || '')).toLowerCase();
      if (isLoan || isCreditCard) {
        category = 'DEBT';
        if (balance < 0) {
          debtTotal += Math.abs(balance);
        }
      } else if (account.type === 'FIXED_DEPOSIT' || nameLower.includes('fixed deposit') || nameLower.includes('fd-') || nameLower.includes('-fd')) {
        category = 'DEPOSITS';
        if (balance > 0) depositsTotal += balance;
      } else if (account.type === 'EPFO' || nameLower.includes('epfo') || nameLower.includes('provident')) {
        category = 'EPFO';
        if (balance > 0) epfoTotal += balance;
      } else if (account.type === 'STOCKS' || nameLower.includes('zerodha') || nameLower.includes('demat') || nameLower.includes('stocks')) {
        if (nameLower.includes('mf') || nameLower.includes('mutual fund') || nameLower.includes('groww')) {
          category = 'MUTUAL_FUNDS';
          if (balance > 0) mutualFundsTotal += balance;
        } else {
          category = 'STOCKS';
          if (balance > 0) stocksTotal += balance;
        }
      } else if (account.type === 'INVESTMENT' || nameLower.includes('mutual') || nameLower.includes('fund') || nameLower.includes('sip')) {
        category = 'MUTUAL_FUNDS';
        if (balance > 0) mutualFundsTotal += balance;
      } else {
        category = 'SAVINGS';
        if (balance > 0) savingsTotal += balance;
      }

      const investedValue = holdingsList.reduce((sum: number, h: any) => {
        if (h.averagePrice && h.quantity) {
          return sum + Number(h.averagePrice) * Number(h.quantity);
        }
        return sum;
      }, 0);

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        category,
        institution: account.institution,
        balance,
        investedValue: investedValue > 0 ? Math.round(investedValue) : null,
        unrealizedPnl: investedValue > 0 ? balance - Math.round(investedValue) : null,
        holdingCount: holdingsList.length,
        holdings: holdingsList.map((h: any) => ({
          id: h.id,
          symbol: h.asset.symbol,
          name: h.asset.name,
          category: h.asset.type,
          quantity: Number(h.quantity),
          averagePrice: h.averagePrice ? Number(h.averagePrice) : null,
          currentValue: h.currentValue ? Number(h.currentValue) : null,
          unrealizedPnl: h.unrealizedPnl ? Number(h.unrealizedPnl) : null,
          asOfDate: h.asOfDate,
        })),
      };
    });

    const totalAssets = savingsTotal + depositsTotal + stocksTotal + mutualFundsTotal + epfoTotal;
    const netWorth = totalAssets - debtTotal;

    const history = months.map((m) => {
      let savings = 0;
      let deposits = 0;
      let stocks = 0;
      let mutualFunds = 0;
      let epfo = 0;
      let debt = 0;

      accounts.forEach((account: any) => {
        if (account.type === 'LOAN') {
          const loan = (account.loans || [])[0];
          if (loan) {
            const paidUpToMonth = (loan.installments || []).filter(
              (i: any) => i.status === 'PAID' && ((i.confirmedAt && new Date(i.confirmedAt) < m.end) || new Date(i.dueDate) < m.end)
            );
            let out = Number(loan.principal);
            if (paidUpToMonth.length > 0) {
              const lastPaid = paidUpToMonth[paidUpToMonth.length - 1];
              out = Number(lastPaid.balance);
            }
            debt += out;
          } else {
            const txsUpToMonth = (account.transactions || []).filter((tx: any) => new Date(tx.transactionDate) < m.end);
            const cumLedger = Number(account.openingBalance) + txsUpToMonth.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
            debt += Math.abs(cumLedger);
          }
          return;
        }

        if (account.type === 'CREDIT_CARD') {
          const txsUpToMonth = (account.transactions || []).filter((tx: any) => new Date(tx.transactionDate) < m.end);
          const cumLedger = Number(account.openingBalance) + txsUpToMonth.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
          if (cumLedger < 0) {
            debt += Math.abs(cumLedger);
          }
          return;
        }

        const txsUpToMonth = (account.transactions || []).filter((tx: any) => new Date(tx.transactionDate) < m.end);
        const cumLedger = Number(account.openingBalance) + txsUpToMonth.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
        const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
        const holdingsList = account.holdings || [];
        const hasCompleteValuation = holdingsList.length > 0 && holdingsList.every((holding: any) => holding.currentValue !== null);
        const bal = isPortfolio && hasCompleteValuation
          ? holdingsList.reduce((sum: number, holding: any) => sum + Number(holding.currentValue), 0)
          : cumLedger;

        if (bal <= 0) return;

        const nameLower = (account.name + ' ' + (account.institution || '')).toLowerCase();
        if (account.type === 'FIXED_DEPOSIT' || nameLower.includes('fixed deposit') || nameLower.includes('fd-') || nameLower.includes('-fd')) {
          deposits += bal;
        } else if (account.type === 'EPFO' || nameLower.includes('epfo') || nameLower.includes('provident')) {
          epfo += bal;
        } else if (account.type === 'STOCKS' || nameLower.includes('zerodha') || nameLower.includes('demat') || nameLower.includes('stocks')) {
          if (nameLower.includes('mf') || nameLower.includes('mutual fund') || nameLower.includes('groww')) {
            mutualFunds += bal;
          } else {
            stocks += bal;
          }
        } else if (account.type === 'INVESTMENT' || nameLower.includes('mutual') || nameLower.includes('fund') || nameLower.includes('sip')) {
          mutualFunds += bal;
        } else {
          savings += bal;
        }
      });

      const monthAssets = savings + deposits + stocks + mutualFunds + epfo;
      const monthNetWorth = monthAssets - debt;

      return {
        month: m.label,
        year: m.year,
        monthIndex: m.month,
        netWorth: monthNetWorth,
        totalAssets: monthAssets,
        debtTotal: debt,
        savingsTotal: savings,
        depositsTotal: deposits,
        stocksTotal: stocks,
        mutualFundsTotal: mutualFunds,
        epfoTotal: epfo,
      };
    });

    const totalPositiveAssets = Math.max(1, totalAssets);
    const allocation = {
      savings: { amount: savingsTotal, percentage: Math.round((savingsTotal / totalPositiveAssets) * 100) },
      deposits: { amount: depositsTotal, percentage: Math.round((depositsTotal / totalPositiveAssets) * 100) },
      stocks: { amount: stocksTotal, percentage: Math.round((stocksTotal / totalPositiveAssets) * 100) },
      mutualFunds: { amount: mutualFundsTotal, percentage: Math.round((mutualFundsTotal / totalPositiveAssets) * 100) },
      epfo: { amount: epfoTotal, percentage: Math.round((epfoTotal / totalPositiveAssets) * 100) },
    };

    return {
      netWorth,
      totalAssets,
      debtTotal,
      savingsTotal,
      depositsTotal,
      stocksTotal,
      mutualFundsTotal,
      epfoTotal,
      allocation,
      accounts: accountBreakdown,
      history,
    };
  }
}
