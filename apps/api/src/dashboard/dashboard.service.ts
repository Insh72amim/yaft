import { Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import {
  ExpenseAnalyticsBucket,
  ExpenseAnalyticsLegendItem,
  ExpenseAnalyticsResponse,
  ExpenseCategoryContribution,
} from '@yaft/shared';
import { PrismaService } from '../common/prisma.service';
import { extractBeneficiaryName, getMonthDateRange, isRefundOrReversal, computeCreditCardCurrentBalance } from '../common/utils/transaction-utils';


export function classifyTransaction(
  tx: any,
  accounts: any[],
  activeVaults: any[],
  activeSips: any[] = []
): 'TRANSFER' | 'CC_PAYMENT' | 'UPI_LITE' | 'INVESTMENT' | 'OTHER' | 'EXPENSE' {
  const desc = (tx.descriptionRaw || '').toLowerCase();
  const catName = tx.category?.name || '';
  const catType = tx.category?.type || '';
  const superKind = tx.category?.superCategory?.kind || '';

  let destAccountId: string | undefined;
  for (const v of activeVaults) {
    if (v.last4 && v.accountId !== tx.accountId && tx.descriptionRaw.includes(v.last4)) {
      destAccountId = v.accountId;
      break;
    }
  }
  const destAcc = destAccountId ? accounts.find((a: any) => a.id === destAccountId) : undefined;

  if (destAcc?.type === 'CREDIT_CARD' || /^\s*(?:cc\s*transfer|credit\s*card\s*payment|cc\s*payment)\s*$/i.test(catName) || /cred\.club|cred\s+rent|cred\s+pay|credit\s*card\s*payment|cc\s*bill|billdesk.*card|payment\s*to\s*card/i.test(desc)) {
    return 'CC_PAYMENT';
  }

  if (destAcc?.type === 'UPI_LITE' || /upi\s*lite/i.test(catName) || /upi\s*lite/i.test(desc)) {
    return 'UPI_LITE';
  }

  if (tx.transferGroupId || catType === 'TRANSFER' || superKind === 'TRANSFER' || /^\s*(?:self\s*transfer|internal\s*transfer|transfer|trf)\s*$/i.test(catName) || /self\s*tra|tcd\s*no|firdftfr|own\s*acc|self\s*transfer|trf\s*to/i.test(desc) || destAccountId) {
    return 'TRANSFER';
  }

  if (catType === 'INVESTMENT' || superKind === 'INVESTMENT' || /invest|mutual|sip|stock|broker|equity|zerodha|groww|etmoney/i.test(catName) || /mutual|fund|zerodha|groww|bse|nse|sgb|nps|indiabulls|icici\s*prudential|mf\s*central|razorpay\s*mf|cams|kfintech/i.test(desc)) {
    return 'INVESTMENT';
  }

  const matchesSip = activeSips.some((sip: any) => {
    const accountMatch = !sip.sourceAccountId || sip.sourceAccountId === tx.accountId;
    const merchantLower = (tx.merchant || '').toLowerCase();
    const keywordMatch =
      (sip.billerKeyword && desc.includes(sip.billerKeyword.toLowerCase())) ||
      (sip.name && desc.includes(sip.name.toLowerCase())) ||
      (sip.destinationAccount && desc.includes(sip.destinationAccount.toLowerCase())) ||
      (sip.name && merchantLower.includes(sip.name.toLowerCase()));
    return accountMatch && keywordMatch;
  });
  if (matchesSip) return 'INVESTMENT';

  if (catType === 'OTHER' || superKind === 'OTHER' || /loan|emi|tax|penalty|bank\s*charge|annual\s*fee/i.test(catName)) {
    return 'OTHER';
  }

  return 'EXPENSE';
}

export function getAccountAssetCategory(account: { type: string; name: string; institution?: string | null }): 'SAVINGS' | 'DEPOSITS' | 'STOCKS' | 'MUTUAL_FUNDS' | 'EPFO' | 'DEBT' {
  const isLoan = account.type === 'LOAN';
  const nameLower = (account.name + ' ' + (account.institution || '')).toLowerCase();

  if (isLoan) {
    return 'DEBT';
  } else if (account.type === 'FIXED_DEPOSIT' || account.type === 'RECURRING_DEPOSIT' || nameLower.includes('fixed deposit') || nameLower.includes('recurring deposit') || nameLower.includes('rd-') || nameLower.includes('-rd') || nameLower.includes('fd-') || nameLower.includes('-fd')) {
    return 'DEPOSITS';
  } else if (account.type === 'EPFO' || nameLower.includes('epfo') || nameLower.includes('provident')) {
    return 'EPFO';
  } else if (account.type === 'MUTUAL_FUND' || nameLower.includes('mutual') || nameLower.includes('fund') || nameLower.includes('sip') || nameLower.includes('groww')) {
    return 'MUTUAL_FUNDS';
  } else if (account.type === 'STOCKS' || nameLower.includes('zerodha') || nameLower.includes('demat') || nameLower.includes('stocks')) {
    return 'STOCKS';
  } else {
    return 'SAVINGS';
  }
}

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

    // TODO: populate from activeSip model once Prisma schema is migrated
    const activeSips: any[] = [];

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






    const isRefund = (tx: (typeof monthTransactions)[0]) => {
      if (tx.amount <= 0) return false;
      const txKind = classifyTransaction(tx, accounts, activeVaults, activeSips);
      if (txKind === 'TRANSFER' || txKind === 'CC_PAYMENT' || txKind === 'UPI_LITE') return false;

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
      const txKind = classifyTransaction(tx, accounts, activeVaults, activeSips);
      const internal = txKind === 'TRANSFER';
      if (tx.amount > 0) {
        if (internal) {
          accFlow.internalInbound += amt;
        } else if (isRefund(tx)) {
          accFlow.expenses = Math.max(0, accFlow.expenses - amt);
          const catName = tx.category?.name ?? 'Uncategorised';
          const catColor = tx.category?.color ?? '#94a3b8';
          const existing = accFlow.expenseCategories.get(catName);
          if (existing) {
            existing.amount = Math.max(0, existing.amount - amt);
          }
          const overallExisting = overallExpenseCategories.get(catName);
          if (overallExisting) {
            overallExisting.amount = Math.max(0, overallExisting.amount - amt);
          }
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

        if (txKind === 'CC_PAYMENT' || (destAcc && destAcc.type === 'CREDIT_CARD')) {
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
        } else if (txKind === 'UPI_LITE' || (destAcc && destAcc.type === 'UPI_LITE')) {
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
        } else if (txKind === 'INVESTMENT') {
          accFlow.investments += amt;
          addCatAmt(accFlow.investmentCategories, catName, catColor, amt);
          addCatAmt(overallInvestmentCategories, catName, catColor, amt);
        } else if (txKind === 'OTHER') {
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

    // Collect direct CC and UPI Lite spends for intermediate layer category distribution
    const directCcCategoryMap = new Map<string, { name: string; color: string; amount: number }>();
    const directUpiLiteCategoryMap = new Map<string, { name: string; color: string; amount: number }>();
    let totalDirectCcSpend = 0;
    let totalDirectUpiLiteSpend = 0;

    monthTransactions.forEach((tx) => {
      const acc = accounts.find((a) => a.id === tx.accountId);
      if (!acc) return;
      const amt = Math.abs(Number(tx.amount));
      const txKind2 = classifyTransaction(tx, accounts, activeVaults, activeSips);
      if (tx.amount < 0 && txKind2 !== 'TRANSFER') {
        const catName = tx.category?.name ?? 'Uncategorised';
        const catColor = tx.category?.color ?? '#94a3b8';
        const isCcTransferCat = /^\s*cc transfer\s*$/i.test(catName);
        const isUpiLiteCat = /^\s*upi lite\s*$/i.test(catName);

        if (acc.type === 'CREDIT_CARD' && !isCcTransferCat) {
          totalDirectCcSpend += amt;
          const ex = directCcCategoryMap.get(catName) || { name: catName, color: catColor, amount: 0 };
          directCcCategoryMap.set(catName, { name: catName, color: catColor, amount: ex.amount + amt });
        } else if (acc.type === 'UPI_LITE' && !isUpiLiteCat) {
          totalDirectUpiLiteSpend += amt;
          const ex = directUpiLiteCategoryMap.get(catName) || { name: catName, color: catColor, amount: 0 };
          directUpiLiteCategoryMap.set(catName, { name: catName, color: catColor, amount: ex.amount + amt });
        }
      }
    });

    // Helper to distribute a settlement amount across true categories
    const distributeCategories = (
      settlementAmount: number,
      sourceCategories: Map<string, { name: string; color: string; amount: number }>,
      totalSourceSpend: number,
      fallbackName: string,
      fallbackColor: string,
    ) => {
      if (settlementAmount <= 0) return [];
      if (totalSourceSpend > 0) {
        const list: Array<{ name: string; color: string; amount: number }> = [];
        let allocated = 0;
        const entries = [...sourceCategories.values()].sort((a, b) => b.amount - a.amount);
        entries.forEach((cat, idx) => {
          if (idx === entries.length - 1) {
            const remainder = settlementAmount - allocated;
            if (remainder > 0) list.push({ name: cat.name, color: cat.color, amount: remainder });
          } else {
            const share = Math.round(settlementAmount * (cat.amount / totalSourceSpend));
            if (share > 0) {
              list.push({ name: cat.name, color: cat.color, amount: share });
              allocated += share;
            }
          }
        });
        return list.filter((c) => c.amount > 0);
      }
      return [{ name: fallbackName, color: fallbackColor, amount: settlementAmount }];
    };

    const overallDistributedCcCategories = distributeCategories(
      totalCreditCardPayments,
      directCcCategoryMap,
      totalDirectCcSpend,
      'Card Living Expenses',
      '#10b981',
    );

    const overallDistributedUpiLiteCategories = distributeCategories(
      totalUpiLiteTransfers,
      directUpiLiteCategoryMap,
      totalDirectUpiLiteSpend,
      'Daily Micro-Spends',
      '#06b6d4',
    );

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
        categories: overallDistributedCcCategories,
      },
      ...(totalUpiLiteTransfers > 0
        ? [
            {
              id: 'UPI_LITE',
              name: 'UPI Lite Transfers',
              kind: 'TRANSFER',
              color: '#06b6d4',
              amount: totalUpiLiteTransfers,
              categories: overallDistributedUpiLiteCategories,
            },
          ]
        : []),
    ].filter((sg) => sg.amount > 0);

    const accountDetailedFlows = [...savingsMap.values()].map((acc) => {
      const accountSpendingAndSettlements = acc.expenses + acc.investments + acc.other + acc.creditCardPayments + acc.upiLiteTransfers;
      const totalOutboundAmt = accountSpendingAndSettlements + acc.interbankOutbound;

      const bankDistributedCcCategories = distributeCategories(
        acc.creditCardPayments,
        directCcCategoryMap,
        totalDirectCcSpend,
        'Card Living Expenses',
        '#10b981',
      );

      const bankDistributedUpiLiteCategories = distributeCategories(
        acc.upiLiteTransfers,
        directUpiLiteCategoryMap,
        totalDirectUpiLiteSpend,
        'Daily Micro-Spends',
        '#06b6d4',
      );

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
          categories: bankDistributedCcCategories,
        },
        ...(acc.upiLiteTransfers > 0
          ? [
              {
                id: 'UPI_LITE',
                name: 'UPI Lite Transfers',
                kind: 'TRANSFER',
                color: '#06b6d4',
                amount: acc.upiLiteTransfers,
                categories: bankDistributedUpiLiteCategories,
              },
            ]
          : []),
      ].filter((sg) => sg.amount > 0);

      const accountFinalCategoriesMap = new Map<string, { name: string; color: string; amount: number }>();
      [
        ...acc.expenseCategories.values(),
        ...acc.investmentCategories.values(),
        ...acc.otherCategories.values(),
      ]
        .filter((c) => !/^\s*(?:cc transfer|upi lite|internal transfer|transfer|self transfer|credit card payment|credit card|card payment|wallet top-up|wallet transfer)\s*$/i.test(c.name))
        .forEach((c) => {
          const ex = accountFinalCategoriesMap.get(c.name) || { name: c.name, color: c.color, amount: 0 };
          accountFinalCategoriesMap.set(c.name, { ...ex, amount: ex.amount + c.amount });
        });

      const totalAccountFinalSpend = [...accountFinalCategoriesMap.values()].reduce((sum, c) => sum + c.amount, 0);

      const accountCategories = [...accountFinalCategoriesMap.values()]
        .map((c) => ({
          ...c,
          percentage: totalAccountFinalSpend > 0 ? Math.round((c.amount / totalAccountFinalSpend) * 100) : 0,
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
        const tKind = classifyTransaction(t, accounts, activeVaults, activeSips);
        const internalFlow = tKind === 'TRANSFER' || tKind === 'CC_PAYMENT' || tKind === 'UPI_LITE' || destAcc !== undefined || isCCCategory;

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
      const isPortfolio = account.type === 'MUTUAL_FUND' || account.type === 'STOCKS';
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
    [
      ...overallExpenseCategories.values(),
      ...overallInvestmentCategories.values(),
      ...overallOtherCategories.values(),
      ...overallDistributedCcCategories,
      ...overallDistributedUpiLiteCategories,
    ]
      .filter((c) => !/^\s*(?:cc transfer|upi lite|internal transfer|transfer|self transfer|credit card payment|credit card|card payment|wallet top-up|wallet transfer)\s*$/i.test(c.name))
      .forEach((c) => {
        const ex = categoriesMap.get(c.name) || { name: c.name, color: c.color, amount: 0, superGroup: (c as any).superGroup };
        categoriesMap.set(c.name, { ...ex, amount: ex.amount + c.amount });
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

    // Overall Top Outbound Beneficiaries (Merchants, Payees, P2P recipients)
    const outboundRecipientMap = new Map<string, { name: string; amount: number; count: number }>();
    monthTransactions
      .filter((t) => t.amount < 0)
      .forEach((t) => {
        // Exclude internal transfers between user's own accounts
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
        const tKind = classifyTransaction(t, accounts, activeVaults, activeSips);
        const internalFlow = tKind === 'TRANSFER' || tKind === 'CC_PAYMENT' || tKind === 'UPI_LITE' || destAcc !== undefined || isCCCategory;

        if (internalFlow) return;

        const amt = Math.abs(Number(t.amount));
        const extracted = extractBeneficiaryName(t.descriptionRaw);
        let name = extracted || t.merchant || t.descriptionRaw;
        name = name.replace(/\s+/g, ' ').trim();
        if (!name) return;

        const curr = outboundRecipientMap.get(name) || { name, amount: 0, count: 0 };
        outboundRecipientMap.set(name, {
          name,
          amount: curr.amount + amt,
          count: curr.count + 1,
        });
      });

    const topOutboundRecipients = [...outboundRecipientMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

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
      topOutboundRecipients,
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
            outboundCategories: [
              ...overallExpenseCategories.values(),
              ...overallOtherCategories.values(),
              ...overallDistributedCcCategories,
              ...overallDistributedUpiLiteCategories,
            ]
              .filter((c) => !/^\s*(cc transfer|upi lite|internal transfer)\s*$/i.test(c.name))
              .sort((a, b) => b.amount - a.amount),
            creditCardCategories: overallDistributedCcCategories,
            investmentCategories: [...overallInvestmentCategories.values()].sort((a, b) => b.amount - a.amount),
            overallCategories: [
              ...overallExpenseCategories.values(),
              ...overallInvestmentCategories.values(),
              ...overallOtherCategories.values(),
              ...overallDistributedCcCategories,
              ...overallDistributedUpiLiteCategories,
            ]
              .filter((c) => !/^\s*(cc transfer|upi lite|internal transfer)\s*$/i.test(c.name))
              .sort((a, b) => b.amount - a.amount),
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

    const currentBalances = await this.prisma.transaction.groupBy({
      by: ['accountId'],
      where: { account: { userId } },
      _sum: { amount: true },
    });
    const currentTxSum = new Map(currentBalances.map((b) => [b.accountId, Number(b._sum.amount || 0)]));

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

    const monthlyBalances = await Promise.all(
      months.map(async (m) => {
        const balancesByAccount = await this.prisma.transaction.groupBy({
          by: ['accountId'],
          where: { account: { userId }, transactionDate: { lt: m.end } },
          _sum: { amount: true },
        });
        return { label: m.label, map: new Map(balancesByAccount.map((b) => [b.accountId, Number(b._sum.amount || 0)])) };
      })
    );
    const monthlyTxSums = new Map(monthlyBalances.map((mb) => [mb.label, mb.map]));

    let savingsTotal = 0;
    let depositsTotal = 0;
    let stocksTotal = 0;
    let mutualFundsTotal = 0;
    let epfoTotal = 0;
    let debtTotal = 0;

    const accountBreakdown = accounts.map((account: any) => {
      let balance = 0;
      const isLoan = account.type === 'LOAN';
      const isPortfolio = account.type === 'MUTUAL_FUND' || account.type === 'STOCKS';
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
          const ledgerBalance = Number(account.openingBalance) + (currentTxSum.get(account.id) || 0);
          balance = ledgerBalance < 0 ? ledgerBalance : -ledgerBalance;
        }
      } else if (account.type === 'RECURRING_DEPOSIT' && (account.recurringDeposits || [])[0]) {
        const rd = account.recurringDeposits[0];
        const now = new Date();
        const todayYMD = now.toISOString().slice(0, 10);
        const paidInsts = (rd.installments || []).filter((i: any) => {
          if (i.status === 'PAID') return true;
          if (rd.autoIncrease && (new Date(i.dueDate) <= now || new Date(i.dueDate).toISOString().slice(0, 10) <= todayYMD)) return true;
          return false;
        });
        const totalDeposited = paidInsts.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
        const txSum = currentTxSum.get(account.id) || 0;
        balance = totalDeposited + Number(account.openingBalance) + txSum;
      } else {
        const ledgerBalance = Number(account.openingBalance) + (currentTxSum.get(account.id) || 0);
        const hasCompleteValuation = holdingsList.length > 0 && holdingsList.every((holding: any) => holding.currentValue !== null);
        balance = isPortfolio && hasCompleteValuation
          ? holdingsList.reduce((sum: number, holding: any) => sum + Number(holding.currentValue), 0)
          : ledgerBalance;
      }

      let category = getAccountAssetCategory(account);
      if (category === 'DEBT') {
        if (balance < 0) debtTotal += Math.abs(balance);
      } else if (category === 'DEPOSITS') {
        if (balance > 0) depositsTotal += balance;
      } else if (category === 'EPFO') {
        if (balance > 0) epfoTotal += balance;
      } else if (category === 'MUTUAL_FUNDS') {
        if (balance > 0) mutualFundsTotal += balance;
      } else if (category === 'STOCKS') {
        if (balance > 0) stocksTotal += balance;
      } else {
        if (balance > 0) savingsTotal += balance;
      }

      const investedValue = holdingsList.reduce((sum: number, h: any) => {
        if (h.averagePrice && h.quantity) {
          return sum + Number(h.averagePrice) * Number(h.quantity);
        }
        return sum;
      }, 0);

      const currentValue = holdingsList.reduce((sum: number, h: any) => {
        if (h.currentValue !== null) {
          return sum + Number(h.currentValue);
        }
        return sum;
      }, 0);

      const unrealizedPnl = currentValue - investedValue;

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        institution: account.institution,
        category,
        balance,
        investedValue: isPortfolio ? investedValue : undefined,
        currentValue: isPortfolio ? currentValue : undefined,
        unrealizedPnl: isPortfolio ? unrealizedPnl : undefined,
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
        const isLoan = account.type === 'LOAN';
        if (isLoan) {
          const loan = (account.loans || [])[0];
          if (loan) {
            const instsUpToMonth = (loan.installments || []).filter((i: any) => new Date(i.dueDate) <= m.end);
            const paidUpToMonth = instsUpToMonth.filter((i: any) => i.status === 'PAID');
            if (paidUpToMonth.length > 0) {
              const lastPaid = paidUpToMonth[paidUpToMonth.length - 1];
              debt += Math.abs(Number(lastPaid.balance));
            } else if (new Date(loan.startDate) <= m.end) {
              debt += Math.abs(Number(loan.principal));
            }
          } else {
            const cumLedger = Number(account.openingBalance) + (monthlyTxSums.get(m.label)?.get(account.id) || 0);
            debt += Math.abs(cumLedger);
          }
          return;
        }

        const cumLedger = Number(account.openingBalance) + (monthlyTxSums.get(m.label)?.get(account.id) || 0);
        const isPortfolio = account.type === 'MUTUAL_FUND' || account.type === 'STOCKS';
        const holdingsList = account.holdings || [];
        const hasCompleteValuation = holdingsList.length > 0 && holdingsList.every((holding: any) => holding.currentValue !== null);

        let bal = isPortfolio && hasCompleteValuation
          ? holdingsList.reduce((sum: number, holding: any) => sum + Number(holding.currentValue), 0)
          : cumLedger;

        if (account.type === 'RECURRING_DEPOSIT' && (account.recurringDeposits || [])[0]) {
          const rd = account.recurringDeposits[0];
          const instsUpToMonth = (rd.installments || []).filter((i: any) => new Date(i.dueDate) <= m.end);
          const paidUpToMonth = instsUpToMonth.filter((i: any) => i.status === 'PAID' || (rd.autoIncrease && new Date(i.dueDate) <= m.end));
          const depositedUpToMonth = paidUpToMonth.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
          bal = depositedUpToMonth + cumLedger;
        }

        if (bal <= 0) return;

        const category = getAccountAssetCategory(account);
        if (category === 'DEPOSITS') {
          deposits += bal;
        } else if (category === 'EPFO') {
          epfo += bal;
        } else if (category === 'MUTUAL_FUNDS') {
          mutualFunds += bal;
        } else if (category === 'STOCKS') {
          stocks += bal;
        } else if (category === 'DEBT') {
          // debt already handled above
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

  async getExpenseAnalytics(
    userId: string,
    granularity: 'month' | 'week' | 'day' = 'day',
    startDateStr?: string,
    endDateStr?: string,
    categoryId?: string,
    categoryTypes?: string[],
  ): Promise<ExpenseAnalyticsResponse> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
        endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      } else {
        startDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
        endDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
      }
    } else if (granularity === 'day') {
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    } else if (granularity === 'week') {
      const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
      startDate = new Date(Date.UTC(eightWeeksAgo.getUTCFullYear(), eightWeeksAgo.getUTCMonth(), eightWeeksAgo.getUTCDate(), 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    } else {
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    }

    const where: any = {
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


    // Calculate available category types summary across the date range
    const typeSummaries = {
      EXPENSE: { type: 'EXPENSE', label: 'Direct Expenses', count: 0, totalAmount: 0 },
      OTHER: { type: 'OTHER', label: 'Indirect / Others', count: 0, totalAmount: 0 },
      INVESTMENT: { type: 'INVESTMENT', label: 'Investments', count: 0, totalAmount: 0 },
      TRANSFER: { type: 'TRANSFER', label: 'Transfers & CC', count: 0, totalAmount: 0 },
    };

    for (const tx of transactions) {
      const txKind = classifyTransaction(tx, [], [], []);
      const t = txKind === 'CC_PAYMENT' || txKind === 'UPI_LITE' ? 'TRANSFER' : txKind;
      const absAmount = Math.abs(Number(tx.amount));
      typeSummaries[t].count += 1;
      typeSummaries[t].totalAmount += absAmount;
    }

    const availableCategoryTypes = Object.values(typeSummaries);

    // Determine active filter types (defaults strictly to EXPENSE only if not specified)
    let activeTypes: Set<string>;
    if (!categoryTypes || categoryTypes.length === 0) {
      activeTypes = new Set(['EXPENSE']);
    } else if (categoryTypes.includes('ALL')) {
      activeTypes = new Set(['EXPENSE', 'OTHER', 'INVESTMENT', 'TRANSFER']);
    } else {
      activeTypes = new Set(categoryTypes);
    }

    const expenseTxns = transactions.filter((tx) => {
      const txKind = classifyTransaction(tx, [], [], []);
      const t = txKind === 'CC_PAYMENT' || txKind === 'UPI_LITE' ? 'TRANSFER' : txKind;
      return activeTypes.has(t);
    });

    const bucketMap = new Map<string, ExpenseAnalyticsBucket>();

    if (granularity === 'month') {
      const cur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
      const endMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

      while (cur <= endMonth) {
        const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`;
        const label = cur.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        const subLabel = `${cur.getUTCFullYear()}`;
        const monthStart = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0, 23, 59, 59, 999));

        bucketMap.set(key, {
          intervalKey: key,
          label,
          subLabel,
          startDate: monthStart.toISOString().slice(0, 10),
          endDate: monthEnd.toISOString().slice(0, 10),
          totalAmount: 0,
          categories: [],
        });

        cur.setUTCMonth(cur.getUTCMonth() + 1);
      }
    } else if (granularity === 'week') {
      let curStart = new Date(startDate.getTime());
      let weekIndex = 1;

      while (curStart <= endDate) {
        const curEnd = new Date(Math.min(endDate.getTime(), curStart.getTime() + 6 * 24 * 60 * 60 * 1000 + (23 * 3600 + 59 * 60 + 59) * 1000 + 999));
        const startStr = curStart.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        const endStr = curEnd.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        const key = `W${weekIndex}_${curStart.toISOString().slice(0, 10)}`;
        const label = `W${weekIndex} (${startStr} – ${endStr})`;
        const subLabel = `${startStr} – ${endStr}`;

        bucketMap.set(key, {
          intervalKey: key,
          label,
          subLabel,
          startDate: curStart.toISOString().slice(0, 10),
          endDate: curEnd.toISOString().slice(0, 10),
          totalAmount: 0,
          categories: [],
        });

        weekIndex += 1;
        curStart = new Date(curStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    } else {
      const cur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
      const endDay = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

      while (cur <= endDay) {
        const key = cur.toISOString().slice(0, 10);
        const dayNum = cur.getUTCDate();
        const monthShort = cur.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const label = `${dayNum} ${monthShort}`;
        const subLabel = cur.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });

        bucketMap.set(key, {
          intervalKey: key,
          label,
          subLabel,
          startDate: key,
          endDate: key,
          totalAmount: 0,
          categories: [],
        });

        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    const globalCategoryMap = new Map<string, { id: string; name: string; color: string; superCategoryName?: string | null; totalAmount: number; count: number }>();
    const bucketCategoryMaps = new Map<string, Map<string, ExpenseCategoryContribution>>();
    for (const key of bucketMap.keys()) {
      bucketCategoryMaps.set(key, new Map());
    }

    let totalTransactionsCount = 0;

    for (const tx of expenseTxns) {
      const txDate = new Date(tx.transactionDate);
      let targetBucketKey: string | undefined;

      if (granularity === 'month') {
        targetBucketKey = `${txDate.getUTCFullYear()}-${String(txDate.getUTCMonth() + 1).padStart(2, '0')}`;
      } else if (granularity === 'week') {
        const txTime = txDate.getTime();
        for (const bucket of bucketMap.values()) {
          const bStart = new Date(bucket.startDate).getTime();
          const bEnd = new Date(bucket.endDate).setUTCHours(23, 59, 59, 999);
          if (txTime >= bStart && txTime <= bEnd) {
            targetBucketKey = bucket.intervalKey;
            break;
          }
        }
      } else {
        targetBucketKey = txDate.toISOString().slice(0, 10);
      }

      if (!targetBucketKey || !bucketMap.has(targetBucketKey)) continue;

      const amount = Math.abs(Number(tx.amount));
      const bucket = bucketMap.get(targetBucketKey)!;
      bucket.totalAmount += amount;
      totalTransactionsCount += 1;

      const catId = tx.categoryId || 'uncategorised';
      const catName = tx.category?.name || 'Uncategorised';
      const catColor = tx.category?.color || '#94a3b8';
      const superCatName = tx.category?.superCategory?.name || null;
      const superCatColor = tx.category?.superCategory?.color || null;

      const bCatMap = bucketCategoryMaps.get(targetBucketKey)!;
      const existing = bCatMap.get(catId);
      if (existing) {
        existing.amount += amount;
        existing.count += 1;
      } else {
        bCatMap.set(catId, {
          id: catId,
          name: catName,
          color: catColor,
          superCategoryId: tx.category?.superCategoryId || null,
          superCategoryName: superCatName,
          superCategoryColor: superCatColor,
          amount,
          percentage: 0,
          count: 1,
        });
      }

      const globalCat = globalCategoryMap.get(catId);
      if (globalCat) {
        globalCat.totalAmount += amount;
        globalCat.count += 1;
      } else {
        globalCategoryMap.set(catId, {
          id: catId,
          name: catName,
          color: catColor,
          superCategoryName: superCatName,
          totalAmount: amount,
          count: 1,
        });
      }
    }

    const buckets: ExpenseAnalyticsBucket[] = [];
    let peakBucket: { key: string; label: string; amount: number } | null = null;
    let totalExpense = 0;

    for (const bucket of bucketMap.values()) {
      const bCatMap = bucketCategoryMaps.get(bucket.intervalKey)!;
      const catList = Array.from(bCatMap.values()).sort((a, b) => b.amount - a.amount);
      if (bucket.totalAmount > 0) {
        catList.forEach((c) => {
          c.percentage = Math.round((c.amount / bucket.totalAmount) * 100);
        });
      }
      bucket.categories = catList;
      buckets.push(bucket);
      totalExpense += bucket.totalAmount;

      if (!peakBucket || bucket.totalAmount > peakBucket.amount) {
        peakBucket = {
          key: bucket.intervalKey,
          label: bucket.label,
          amount: bucket.totalAmount,
        };
      }
    }

    const intervalCount = buckets.length;
    const averagePerInterval = intervalCount > 0 ? Math.round(totalExpense / intervalCount) : 0;

    const categoryLegend: ExpenseAnalyticsLegendItem[] = Array.from(globalCategoryMap.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        superCategoryName: c.superCategoryName,
        totalAmount: c.totalAmount,
        percentage: totalExpense > 0 ? Math.round((c.totalAmount / totalExpense) * 100) : 0,
        count: c.count,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const topCategory = categoryLegend.length > 0 ? {
      name: categoryLegend[0].name,
      color: categoryLegend[0].color,
      amount: categoryLegend[0].totalAmount,
      percentage: categoryLegend[0].percentage,
    } : null;

    return {
      granularity,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      buckets,
      summary: {
        totalExpense,
        averagePerInterval,
        peakInterval: peakBucket && peakBucket.amount > 0 ? peakBucket : null,
        topCategory,
        totalTransactionsCount,
        intervalCount,
      },
      categoryLegend,
      availableCategoryTypes,
    };
  }
}
