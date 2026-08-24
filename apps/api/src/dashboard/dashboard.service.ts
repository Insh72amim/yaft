import { Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { extractBeneficiaryName, getMonthDateRange, isRefundOrReversal, computeCreditCardCurrentBalance } from '../common/utils/transaction-utils';

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
        category: {
          include: {
            superCategory: true,
          },
        },
        account: { select: { id: true, name: true, type: true, institution: true } },
      },
      orderBy: { transactionDate: 'desc' },
    });

    const isInternalTransfer = (tx: (typeof monthTransactions)[0]) => {
      if (tx.transferGroupId) return true;
      if (tx.category?.type === 'TRANSFER' || tx.category?.superCategory?.kind === 'TRANSFER') return true;
      if (tx.category?.name && /^\s*(?:self\s*transfer|internal\s*transfer|transfer|trf)\s*$/i.test(tx.category.name)) return true;

      const desc = tx.descriptionRaw.toLowerCase();
      if (/self\s*tra|tcd\s*no|firdftfr|own\s*acc|self\s*transfer|trf\s*to/i.test(desc)) {
        return true;
      }

      for (const v of activeVaults) {
        if (v.last4 && v.accountId !== tx.accountId && tx.descriptionRaw.includes(v.last4)) {
          return true;
        }
      }
      return false;
    };

    const isCCPayment = (tx: (typeof monthTransactions)[0], destAcc?: { type?: string }) => {
      if (destAcc?.type === 'CREDIT_CARD') return true;
      if (tx.category?.name && /^\s*(?:cc\s*transfer|credit\s*card\s*payment|cc\s*payment)\s*$/i.test(tx.category.name)) return true;
      const desc = tx.descriptionRaw.toLowerCase();
      return /cred\.club|cred\s+rent|cred\s+pay|credit\s*card\s*payment|cc\s*bill|billdesk.*card|payment\s*to\s*card/i.test(desc);
    };

    const isUpiLiteTransfer = (tx: (typeof monthTransactions)[0], destAcc?: { type?: string }) => {
      if (destAcc?.type === 'UPI_LITE') return true;
      if (tx.category?.name && /upi\s*lite/i.test(tx.category.name)) return true;
      const desc = tx.descriptionRaw.toLowerCase();
      return /upi\s*lite/i.test(desc);
    };

    const isInvestment = (tx: (typeof monthTransactions)[0]) => {
      if (tx.category?.type === 'INVESTMENT' || tx.category?.superCategory?.kind === 'INVESTMENT') return true;
      if (tx.category?.name && /invest|mutual|sip|stock|broker|equity|zerodha|groww|etmoney/i.test(tx.category.name)) return true;
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
      if (matchesSip) return true;
      const desc = tx.descriptionRaw.toLowerCase();
      return /mutual|fund|zerodha|groww|bse|nse|sgb|nps|indiabulls|icici\s*prudential|mf\s*central|razorpay\s*mf|cams|kfintech/i.test(desc);
    };

    const isOtherObligation = (tx: (typeof monthTransactions)[0]) => {
      if (tx.category?.type === 'OTHER' || tx.category?.superCategory?.kind === 'OTHER') return true;
      if (tx.category?.name && /loan|emi|tax|penalty|bank\s*charge|annual\s*fee/i.test(tx.category.name)) return true;
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

    const savingsAccountsList = accounts.filter((a) => ['SAVINGS', 'BANK'].includes(a.type));
    const savingsMap = new Map<
      string,
      {
        id: string;
        name: string;
        type: string;
        institution: string | null;
        externalInbound: number;
        internalInbound: number;
        expenses: number;
        investments: number;
        other: number;
        creditCardPayments: number;
        upiLiteTransfers: number;
        interbankOutbound: number;
        expenseCategories: Map<string, { name: string; color: string; amount: number }>;
        investmentCategories: Map<string, { name: string; color: string; amount: number }>;
        otherCategories: Map<string, { name: string; color: string; amount: number }>;
        ccCategories: Map<string, { name: string; color: string; amount: number }>;
        upiLiteCategories: Map<string, { name: string; color: string; amount: number }>;
        interbankCategories: Map<string, { name: string; color: string; amount: number }>;
      }
    >();

    savingsAccountsList.forEach((acc) => {
      savingsMap.set(acc.id, {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        institution: acc.institution,
        externalInbound: 0,
        internalInbound: 0,
        expenses: 0,
        investments: 0,
        other: 0,
        creditCardPayments: 0,
        upiLiteTransfers: 0,
        interbankOutbound: 0,
        expenseCategories: new Map(),
        investmentCategories: new Map(),
        otherCategories: new Map(),
        ccCategories: new Map(),
        upiLiteCategories: new Map(),
        interbankCategories: new Map(),
      });
    });

    const overallExpenseCategories = new Map<string, { name: string; color: string; amount: number }>();
    const overallInvestmentCategories = new Map<string, { name: string; color: string; amount: number }>();
    const overallOtherCategories = new Map<string, { name: string; color: string; amount: number }>();
    const overallCcCategories = new Map<string, { name: string; color: string; amount: number }>();
    const overallUpiLiteCategories = new Map<string, { name: string; color: string; amount: number }>();
    const overallInterbankCategories = new Map<string, { name: string; color: string; amount: number }>();

    const internalTransfersList: Array<{
      fromAccountId: string;
      fromAccountName: string;
      toAccountId: string;
      toAccountName: string;
      toAccountType?: string;
      amount: number;
    }> = [];

    const addCatAmt = (map: Map<string, { name: string; color: string; amount: number }>, name: string, color: string, amt: number) => {
      const existing = map.get(name) || { name, color, amount: 0 };
      map.set(name, { name, color, amount: existing.amount + amt });
    };

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
        const catName = tx.category?.name ?? 'Uncategorised';
        const catColor = tx.category?.color ?? '#94a3b8';

        if (isCCPayment(tx, destAcc)) {
          accFlow.creditCardPayments += amt;
          addCatAmt(accFlow.ccCategories, catName, catColor, amt);
          addCatAmt(overallCcCategories, catName, catColor, amt);
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
        } else if (isUpiLiteTransfer(tx, destAcc)) {
          accFlow.upiLiteTransfers += amt;
          addCatAmt(accFlow.upiLiteCategories, catName, catColor, amt);
          addCatAmt(overallUpiLiteCategories, catName, catColor, amt);
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
        } else if (internal || (destAcc && ['SAVINGS', 'BANK'].includes(destAcc.type))) {
          accFlow.interbankOutbound += amt;
          addCatAmt(accFlow.interbankCategories, catName, catColor, amt);
          addCatAmt(overallInterbankCategories, catName, catColor, amt);
          if (destAcc) {
            internalTransfersList.push({
              fromAccountId: tx.accountId,
              fromAccountName: accFlow.name,
              toAccountId: destAcc.id,
              toAccountName: destAcc.name,
              toAccountType: destAcc.type,
              amount: amt,
            });
            const targetFlow = savingsMap.get(destAcc.id);
            if (targetFlow && !tx.transferGroupId) {
              targetFlow.internalInbound += amt;
            }
          }
        } else if (isInvestment(tx)) {
          accFlow.investments += amt;
          addCatAmt(accFlow.investmentCategories, catName, catColor, amt);
          addCatAmt(overallInvestmentCategories, catName, catColor, amt);
        } else if (isOtherObligation(tx)) {
          accFlow.other += amt;
          addCatAmt(accFlow.otherCategories, catName, catColor, amt);
          addCatAmt(overallOtherCategories, catName, catColor, amt);
        } else {
          accFlow.expenses += amt;
          addCatAmt(accFlow.expenseCategories, catName, catColor, amt);
          addCatAmt(overallExpenseCategories, catName, catColor, amt);
        }
      }
    });

    const totalExternalInbound = [...savingsMap.values()].reduce((sum, acc) => sum + acc.externalInbound, 0);
    const totalInternalInbound = [...savingsMap.values()].reduce((sum, acc) => sum + acc.internalInbound, 0);
    const totalExpenses = [...savingsMap.values()].reduce((sum, acc) => sum + acc.expenses, 0);
    const totalInvestments = [...savingsMap.values()].reduce((sum, acc) => sum + acc.investments, 0);
    const totalOther = [...savingsMap.values()].reduce((sum, acc) => sum + acc.other, 0);
    const totalCreditCardPayments = [...savingsMap.values()].reduce((sum, acc) => sum + acc.creditCardPayments, 0);
    const totalUpiLiteTransfers = [...savingsMap.values()].reduce((sum, acc) => sum + acc.upiLiteTransfers, 0);
    const totalInterBankTransfers = [...savingsMap.values()].reduce((sum, acc) => sum + acc.interbankOutbound, 0);

    const totalSettlementsAndSpends = totalExpenses + totalInvestments + totalOther + totalCreditCardPayments + totalUpiLiteTransfers;
    const totalAllOutbound = totalSettlementsAndSpends + totalInterBankTransfers;

    const overallSupergroups = [
      {
        id: 'EXPENSES',
        name: 'Living Expenses',
        kind: 'EXPENSE',
        color: '#ef4444',
        amount: totalExpenses,
        categories: [...overallExpenseCategories.values()].sort((a, b) => b.amount - a.amount),
      },
      {
        id: 'INVESTMENTS',
        name: 'Investments',
        kind: 'INVESTMENT',
        color: '#8b5cf6',
        amount: totalInvestments,
        categories: [...overallInvestmentCategories.values()].sort((a, b) => b.amount - a.amount),
      },
      {
        id: 'OTHER',
        name: 'Loans & Obligations',
        kind: 'OTHER',
        color: '#f59e0b',
        amount: totalOther,
        categories: [...overallOtherCategories.values()].sort((a, b) => b.amount - a.amount),
      },
      {
        id: 'CC_PAYMENTS',
        name: 'Credit Card Payments',
        kind: 'TRANSFER',
        color: '#10b981',
        amount: totalCreditCardPayments,
        categories: [...overallCcCategories.values()].sort((a, b) => b.amount - a.amount),
      },
      ...(totalUpiLiteTransfers > 0
        ? [
            {
              id: 'UPI_LITE',
              name: 'UPI Lite Transfers',
              kind: 'TRANSFER',
              color: '#06b6d4',
              amount: totalUpiLiteTransfers,
              categories: [...overallUpiLiteCategories.values()].sort((a, b) => b.amount - a.amount),
            },
          ]
        : []),
    ].filter((sg) => sg.amount > 0);

    const accountDetailedFlows = [...savingsMap.values()].map((acc) => {
      const accountSpendingAndSettlements = acc.expenses + acc.investments + acc.other + acc.creditCardPayments + acc.upiLiteTransfers;
      const totalOutboundAmt = accountSpendingAndSettlements + acc.interbankOutbound;

      const accountSupergroups = [
        {
          id: 'EXPENSES',
          name: 'Living Expenses',
          kind: 'EXPENSE',
          color: '#ef4444',
          amount: acc.expenses,
          categories: [...acc.expenseCategories.values()].sort((a, b) => b.amount - a.amount),
        },
        {
          id: 'INVESTMENTS',
          name: 'Investments',
          kind: 'INVESTMENT',
          color: '#8b5cf6',
          amount: acc.investments,
          categories: [...acc.investmentCategories.values()].sort((a, b) => b.amount - a.amount),
        },
        {
          id: 'OTHER',
          name: 'Loans & Obligations',
          kind: 'OTHER',
          color: '#f59e0b',
          amount: acc.other,
          categories: [...acc.otherCategories.values()].sort((a, b) => b.amount - a.amount),
        },
        {
          id: 'CC_PAYMENTS',
          name: 'Credit Card Payments',
          kind: 'TRANSFER',
          color: '#10b981',
          amount: acc.creditCardPayments,
          categories: [...acc.ccCategories.values()].sort((a, b) => b.amount - a.amount),
        },
        ...(acc.upiLiteTransfers > 0
          ? [
              {
                id: 'UPI_LITE',
                name: 'UPI Lite Transfers',
                kind: 'TRANSFER',
                color: '#06b6d4',
                amount: acc.upiLiteTransfers,
                categories: [...acc.upiLiteCategories.values()].sort((a, b) => b.amount - a.amount),
              },
            ]
          : []),
      ].filter((sg) => sg.amount > 0);

      const accountCategories = [
        ...acc.expenseCategories.values(),
        ...acc.investmentCategories.values(),
        ...acc.otherCategories.values(),
        ...acc.ccCategories.values(),
        ...acc.upiLiteCategories.values(),
      ]
        .map((c) => ({
          ...c,
          percentage: accountSpendingAndSettlements > 0 ? Math.round((c.amount / accountSpendingAndSettlements) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const accountTxs = monthTransactions.filter((t) => t.accountId === acc.id && t.amount < 0);
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
        const internalFlow = isInternalTransfer(t) || destAcc !== undefined || isCCCategory;

        let name = '';
        if (destAcc) {
          name = destAcc.name;
        } else if (isCCCategory) {
          name = t.category?.name || 'Credit Card Payment';
        } else {
          name = extractBeneficiaryName(t.descriptionRaw) || t.merchant || t.descriptionRaw;
        }

        const allCurr = allRecipientsMap.get(name) || { name, amount: 0, count: 0, isInternal: internalFlow };
        allRecipientsMap.set(name, {
          name,
          amount: allCurr.amount + amt,
          count: allCurr.count + 1,
          isInternal: internalFlow,
        });

        if (internalFlow) {
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
        amount: Math.max(0, (acc.expenses + acc.other + acc.investments) - topExtSum),
        count: Math.max(0, accountTxs.length - topExtCount),
      };

      const topIntSum = topInternalRecipients.reduce((s, r) => s + r.amount, 0);
      const topIntCount = topInternalRecipients.reduce((s, r) => s + r.count, 0);
      const otherInternalOutbound = {
        amount: Math.max(0, (acc.creditCardPayments + acc.upiLiteTransfers + acc.interbankOutbound) - topIntSum),
        count: Math.max(0, accountTxs.length - topIntCount),
      };

      return {
        ...acc,
        externalOutbound: acc.expenses + acc.other,
        spendingAndSettlements: accountSpendingAndSettlements,
        cleanOutbound: accountSpendingAndSettlements,
        totalInbound: acc.externalInbound + acc.internalInbound,
        totalOutbound: totalOutboundAmt,
        supergroups: accountSupergroups,
        categories: accountCategories,
        cleanCategories: accountCategories,
        allCategories: accountCategories,
        topRecipients,
        topExternalRecipients,
        otherExternalOutbound,
        topInternalRecipients,
        otherInternalOutbound,
      };
    });

    const savings = totalExternalInbound - (totalExpenses + totalOther);
    const savingsRate = totalExternalInbound > 0 ? Math.round((savings / totalExternalInbound) * 100) : 0;

    const mappedAccounts = accounts.map(({ transactions, holdings = [], ...account }) => {
      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const hasCompleteValuation = holdings.length > 0 && holdings.every((holding) => holding.currentValue !== null);
      let balance = Number(account.openingBalance) + transactions.reduce((sum, item) => sum + Number(item.amount), 0);
      if (isPortfolio && hasCompleteValuation) {
        balance = holdings.reduce((sum, holding) => sum + Number(holding.currentValue), 0);
      } else if (account.type === AccountType.CREDIT_CARD) {
        balance = computeCreditCardCurrentBalance(account, transactions).currentBalance;
      }

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

    const categoriesMap = new Map<string, { name: string; color: string; amount: number; superGroup?: string }>();
    [...overallExpenseCategories.values(), ...overallInvestmentCategories.values(), ...overallOtherCategories.values(), ...overallCcCategories.values(), ...overallUpiLiteCategories.values()].forEach((c) => {
      categoriesMap.set(c.name, c);
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
      income: totalExternalInbound,
      expenses: totalExpenses + totalOther,
      savingsNetInbound: totalExternalInbound,
      savingsNetOutbound: totalSettlementsAndSpends,
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
          totalInternalInbound,
          totalExternalOutbound: totalExpenses + totalOther,
          totalInvestments,
          totalCreditCardPayments,
          totalUpiLiteTransfers,
          totalInterBankTransfers,
          totalCleanOutbound: totalSettlementsAndSpends,
          totalInternalTransfers: totalInterBankTransfers,
          totalAllOutbound,
          supergroups: overallSupergroups,
          categoryFlow: {
            outboundCategories: [...overallExpenseCategories.values(), ...overallOtherCategories.values()].sort((a, b) => b.amount - a.amount),
            creditCardCategories: [...overallCcCategories.values()].sort((a, b) => b.amount - a.amount),
            investmentCategories: [...overallInvestmentCategories.values()].sort((a, b) => b.amount - a.amount),
            overallCategories: [
              ...overallExpenseCategories.values(),
              ...overallInvestmentCategories.values(),
              ...overallOtherCategories.values(),
              ...overallCcCategories.values(),
              ...overallUpiLiteCategories.values(),
            ].sort((a, b) => b.amount - a.amount),
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
      if (isLoan) {
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
