import { AccountType } from '@prisma/client';
import {
  computeCreditCardCurrentBalance,
  extractBeneficiaryName,
} from '../../common/utils/transaction-utils';
import {
  ClassifiableAccountRef,
  ClassifiableSipRef,
  ClassifiableTransaction,
  ClassifiableVaultRef,
  classifyTransaction,
  isInternalSettlementCategoryName,
  isTransactionRefundOrReversal,
  resolveInternalDestinationAccountId,
} from './transaction-classifier';

export interface OverviewAccountInput extends ClassifiableAccountRef {
  openingBalance: bigint | number;
  creditLimit: bigint | number | null;
  dueDay: number | null;
  transactions: readonly { amount: bigint | number }[];
  holdings?: readonly { currentValue: bigint | number | null }[];
}

export interface OverviewTransactionInput extends ClassifiableTransaction {
  id: string;
  accountId: string;
  transactionDate: Date | string;
  descriptionRaw: string;
  account: ClassifiableAccountRef;
}

export interface CategoryAmountEntry {
  name: string;
  color: string;
  amount: number;
  superGroup?: string;
}

function addCategoryAmount(
  map: Map<string, CategoryAmountEntry>,
  name: string,
  color: string,
  amount: number,
): void {
  const existing = map.get(name) || { name, color, amount: 0 };
  map.set(name, { name, color, amount: existing.amount + amount });
}

/**
 * Distributes a settlement amount (e.g. Credit Card bill payment or UPI Lite top-up)
 * proportionally across the actual underlying spend categories recorded on that channel.
 */
export function distributeSettlementCategories(
  settlementAmount: number,
  sourceCategories: ReadonlyMap<string, CategoryAmountEntry>,
  totalSourceSpend: number,
  fallbackName: string,
  fallbackColor: string,
): CategoryAmountEntry[] {
  if (settlementAmount <= 0) return [];
  if (totalSourceSpend > 0) {
    const list: CategoryAmountEntry[] = [];
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
}

/**
 * Pure domain aggregator that builds the complete monthly dashboard overview,
 * multi-bank Sankey flow, top recipients, and net worth summary.
 */
export function buildDashboardOverviewReport(params: {
  labelMonth: string;
  start: Date;
  end: Date;
  accounts: readonly OverviewAccountInput[];
  activeVaults: readonly ClassifiableVaultRef[];
  activeSips?: readonly ClassifiableSipRef[];
  monthTransactions: readonly OverviewTransactionInput[];
}) {
  const {
    labelMonth,
    start,
    end,
    accounts,
    activeVaults,
    activeSips = [],
    monthTransactions,
  } = params;

  const savingsAccountsList = accounts.filter((a) =>
    ['SAVINGS', 'BANK'].includes(String(a.type)),
  );

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
      expenseCategories: Map<string, CategoryAmountEntry>;
      investmentCategories: Map<string, CategoryAmountEntry>;
      otherCategories: Map<string, CategoryAmountEntry>;
      ccCategories: Map<string, CategoryAmountEntry>;
      upiLiteCategories: Map<string, CategoryAmountEntry>;
      interbankCategories: Map<string, CategoryAmountEntry>;
    }
  >();

  savingsAccountsList.forEach((acc) => {
    savingsMap.set(acc.id, {
      id: acc.id,
      name: acc.name,
      type: String(acc.type),
      institution: acc.institution ?? null,
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

  const overallExpenseCategories = new Map<string, CategoryAmountEntry>();
  const overallInvestmentCategories = new Map<string, CategoryAmountEntry>();
  const overallOtherCategories = new Map<string, CategoryAmountEntry>();
  const overallCcCategories = new Map<string, CategoryAmountEntry>();
  const overallUpiLiteCategories = new Map<string, CategoryAmountEntry>();
  const overallInterbankCategories = new Map<string, CategoryAmountEntry>();

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
    const txKind = classifyTransaction(tx, accounts, activeVaults, activeSips);
    const internal = txKind === 'TRANSFER';

    if (Number(tx.amount) > 0) {
      if (internal) {
        accFlow.internalInbound += amt;
      } else if (isTransactionRefundOrReversal(tx, accounts, activeVaults, activeSips)) {
        accFlow.expenses = Math.max(0, accFlow.expenses - amt);
        const catName = tx.category?.name ?? 'Uncategorised';
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
      const destAccountId = resolveInternalDestinationAccountId(
        tx,
        monthTransactions,
        activeVaults,
      );
      const destAcc = destAccountId ? accounts.find((a) => a.id === destAccountId) : undefined;
      const catName = tx.category?.name ?? 'Uncategorised';
      const catColor = tx.category?.color ?? '#94a3b8';

      if (txKind === 'CC_PAYMENT' || (destAcc && destAcc.type === 'CREDIT_CARD')) {
        accFlow.creditCardPayments += amt;
        addCategoryAmount(accFlow.ccCategories, catName, catColor, amt);
        addCategoryAmount(overallCcCategories, catName, catColor, amt);
        if (destAcc) {
          internalTransfersList.push({
            fromAccountId: tx.accountId,
            fromAccountName: accFlow.name,
            toAccountId: destAcc.id,
            toAccountName: destAcc.name,
            toAccountType: String(destAcc.type),
            amount: amt,
          });
        }
      } else if (txKind === 'UPI_LITE' || (destAcc && destAcc.type === 'UPI_LITE')) {
        accFlow.upiLiteTransfers += amt;
        addCategoryAmount(accFlow.upiLiteCategories, catName, catColor, amt);
        addCategoryAmount(overallUpiLiteCategories, catName, catColor, amt);
        if (destAcc) {
          internalTransfersList.push({
            fromAccountId: tx.accountId,
            fromAccountName: accFlow.name,
            toAccountId: destAcc.id,
            toAccountName: destAcc.name,
            toAccountType: String(destAcc.type),
            amount: amt,
          });
        }
      } else if (internal || (destAcc && ['SAVINGS', 'BANK'].includes(String(destAcc.type)))) {
        accFlow.interbankOutbound += amt;
        addCategoryAmount(accFlow.interbankCategories, catName, catColor, amt);
        addCategoryAmount(overallInterbankCategories, catName, catColor, amt);
        if (destAcc) {
          internalTransfersList.push({
            fromAccountId: tx.accountId,
            fromAccountName: accFlow.name,
            toAccountId: destAcc.id,
            toAccountName: destAcc.name,
            toAccountType: String(destAcc.type),
            amount: amt,
          });
          const targetFlow = savingsMap.get(destAcc.id);
          if (targetFlow && !tx.transferGroupId) {
            targetFlow.internalInbound += amt;
          }
        }
      } else if (txKind === 'INVESTMENT') {
        accFlow.investments += amt;
        addCategoryAmount(accFlow.investmentCategories, catName, catColor, amt);
        addCategoryAmount(overallInvestmentCategories, catName, catColor, amt);
      } else if (txKind === 'OTHER') {
        accFlow.other += amt;
        addCategoryAmount(accFlow.otherCategories, catName, catColor, amt);
        addCategoryAmount(overallOtherCategories, catName, catColor, amt);
      } else {
        accFlow.expenses += amt;
        addCategoryAmount(accFlow.expenseCategories, catName, catColor, amt);
        addCategoryAmount(overallExpenseCategories, catName, catColor, amt);
      }
    }
  });

  const totalExternalInbound = [...savingsMap.values()].reduce(
    (sum, acc) => sum + acc.externalInbound,
    0,
  );
  const totalInternalInbound = [...savingsMap.values()].reduce(
    (sum, acc) => sum + acc.internalInbound,
    0,
  );
  const totalExpenses = [...savingsMap.values()].reduce((sum, acc) => sum + acc.expenses, 0);
  const totalInvestments = [...savingsMap.values()].reduce(
    (sum, acc) => sum + acc.investments,
    0,
  );
  const totalOther = [...savingsMap.values()].reduce((sum, acc) => sum + acc.other, 0);
  const totalCreditCardPayments = [...savingsMap.values()].reduce(
    (sum, acc) => sum + acc.creditCardPayments,
    0,
  );
  const totalUpiLiteTransfers = [...savingsMap.values()].reduce(
    (sum, acc) => sum + acc.upiLiteTransfers,
    0,
  );
  const totalInterBankTransfers = [...savingsMap.values()].reduce(
    (sum, acc) => sum + acc.interbankOutbound,
    0,
  );

  const totalSettlementsAndSpends =
    totalExpenses +
    totalInvestments +
    totalOther +
    totalCreditCardPayments +
    totalUpiLiteTransfers;
  const totalAllOutbound = totalSettlementsAndSpends + totalInterBankTransfers;

  const directCcCategoryMap = new Map<string, CategoryAmountEntry>();
  const directUpiLiteCategoryMap = new Map<string, CategoryAmountEntry>();
  let totalDirectCcSpend = 0;
  let totalDirectUpiLiteSpend = 0;

  monthTransactions.forEach((tx) => {
    const acc = accounts.find((a) => a.id === tx.accountId);
    if (!acc) return;
    const amt = Math.abs(Number(tx.amount));
    const txKind2 = classifyTransaction(tx, accounts, activeVaults, activeSips);
    if (Number(tx.amount) < 0 && txKind2 !== 'TRANSFER') {
      const catName = tx.category?.name ?? 'Uncategorised';
      const catColor = tx.category?.color ?? '#94a3b8';
      const isCcTransferCat = /^\s*cc transfer\s*$/i.test(catName);
      const isUpiLiteCat = /^\s*upi lite\s*$/i.test(catName);

      if (acc.type === 'CREDIT_CARD' && !isCcTransferCat) {
        totalDirectCcSpend += amt;
        addCategoryAmount(directCcCategoryMap, catName, catColor, amt);
      } else if (acc.type === 'UPI_LITE' && !isUpiLiteCat) {
        totalDirectUpiLiteSpend += amt;
        addCategoryAmount(directUpiLiteCategoryMap, catName, catColor, amt);
      }
    }
  });

  const overallDistributedCcCategories = distributeSettlementCategories(
    totalCreditCardPayments,
    directCcCategoryMap,
    totalDirectCcSpend,
    'Card Living Expenses',
    '#10b981',
  );

  const overallDistributedUpiLiteCategories = distributeSettlementCategories(
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
      categories: [...overallInvestmentCategories.values()].sort(
        (a, b) => b.amount - a.amount,
      ),
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
    const accountSpendingAndSettlements =
      acc.expenses +
      acc.investments +
      acc.other +
      acc.creditCardPayments +
      acc.upiLiteTransfers;
    const totalOutboundAmt = accountSpendingAndSettlements + acc.interbankOutbound;

    const bankDistributedCcCategories = distributeSettlementCategories(
      acc.creditCardPayments,
      directCcCategoryMap,
      totalDirectCcSpend,
      'Card Living Expenses',
      '#10b981',
    );

    const bankDistributedUpiLiteCategories = distributeSettlementCategories(
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
        categories: [...acc.investmentCategories.values()].sort(
          (a, b) => b.amount - a.amount,
        ),
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

    const accountFinalCategoriesMap = new Map<string, CategoryAmountEntry>();
    [
      ...acc.expenseCategories.values(),
      ...acc.investmentCategories.values(),
      ...acc.otherCategories.values(),
    ]
      .filter((c) => !isInternalSettlementCategoryName(c.name))
      .forEach((c) => {
        const ex = accountFinalCategoriesMap.get(c.name) || {
          name: c.name,
          color: c.color,
          amount: 0,
        };
        accountFinalCategoriesMap.set(c.name, { ...ex, amount: ex.amount + c.amount });
      });

    const totalAccountFinalSpend = [...accountFinalCategoriesMap.values()].reduce(
      (sum, c) => sum + c.amount,
      0,
    );

    const accountCategories = [...accountFinalCategoriesMap.values()]
      .map((c) => ({
        ...c,
        percentage:
          totalAccountFinalSpend > 0
            ? Math.round((c.amount / totalAccountFinalSpend) * 100)
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const accountTxs = monthTransactions.filter(
      (t) => t.accountId === acc.id && Number(t.amount) < 0,
    );
    const externalRecipientsMap = new Map<
      string,
      { name: string; amount: number; count: number; isInternal: false }
    >();
    const internalRecipientsMap = new Map<
      string,
      { name: string; amount: number; count: number; isInternal: true }
    >();
    const allRecipientsMap = new Map<
      string,
      { name: string; amount: number; count: number; isInternal: boolean }
    >();

    accountTxs.forEach((t) => {
      const amt = Math.abs(Number(t.amount));
      const destAccountId = resolveInternalDestinationAccountId(
        t,
        monthTransactions,
        activeVaults,
      );
      const destAcc = destAccountId ? accounts.find((a) => a.id === destAccountId) : undefined;
      const isCCCategory = Boolean(
        t.category?.name && /^\s*cc transfer\s*$/i.test(t.category.name),
      );
      const tKind = classifyTransaction(t, accounts, activeVaults, activeSips);
      const internalFlow =
        tKind === 'TRANSFER' ||
        tKind === 'CC_PAYMENT' ||
        tKind === 'UPI_LITE' ||
        destAcc !== undefined ||
        isCCCategory;

      let name = '';
      if (destAcc) {
        name = destAcc.name;
      } else if (isCCCategory) {
        name = t.category?.name || 'Credit Card Payment';
      } else {
        name = extractBeneficiaryName(t.descriptionRaw) || t.merchant || t.descriptionRaw;
      }

      const allCurr = allRecipientsMap.get(name) || {
        name,
        amount: 0,
        count: 0,
        isInternal: internalFlow,
      };
      allRecipientsMap.set(name, {
        name,
        amount: allCurr.amount + amt,
        count: allCurr.count + 1,
        isInternal: internalFlow,
      });

      if (internalFlow) {
        const currInt = internalRecipientsMap.get(name) || {
          name,
          amount: 0,
          count: 0,
          isInternal: true,
        };
        internalRecipientsMap.set(name, {
          name,
          amount: currInt.amount + amt,
          count: currInt.count + 1,
          isInternal: true,
        });
      } else {
        const currExt = externalRecipientsMap.get(name) || {
          name,
          amount: 0,
          count: 0,
          isInternal: false,
        };
        externalRecipientsMap.set(name, {
          name,
          amount: currExt.amount + amt,
          count: currExt.count + 1,
          isInternal: false,
        });
      }
    });

    const topRecipients = [...allRecipientsMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const topExternalRecipients = [...externalRecipientsMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const topInternalRecipients = [...internalRecipientsMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const topExtSum = topExternalRecipients.reduce((s, r) => s + r.amount, 0);
    const topExtCount = topExternalRecipients.reduce((s, r) => s + r.count, 0);
    const otherExternalOutbound = {
      amount: Math.max(0, acc.expenses + acc.other + acc.investments - topExtSum),
      count: Math.max(0, accountTxs.length - topExtCount),
    };

    const topIntSum = topInternalRecipients.reduce((s, r) => s + r.amount, 0);
    const topIntCount = topInternalRecipients.reduce((s, r) => s + r.count, 0);
    const otherInternalOutbound = {
      amount: Math.max(
        0,
        acc.creditCardPayments + acc.upiLiteTransfers + acc.interbankOutbound - topIntSum,
      ),
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
  const savingsRate =
    totalExternalInbound > 0 ? Math.round((savings / totalExternalInbound) * 100) : 0;

  const mappedAccounts = accounts.map(({ transactions, holdings = [], ...account }) => {
    const isPortfolio = account.type === 'MUTUAL_FUND' || account.type === 'STOCKS';
    const hasCompleteValuation =
      holdings.length > 0 && holdings.every((holding) => holding.currentValue !== null);
    let balance =
      Number(account.openingBalance) +
      transactions.reduce((sum, item) => sum + Number(item.amount), 0);
    if (isPortfolio && hasCompleteValuation) {
      balance = holdings.reduce((sum, holding) => sum + Number(holding.currentValue), 0);
    } else if (account.type === AccountType.CREDIT_CARD) {
      balance = computeCreditCardCurrentBalance(account, [...transactions]).currentBalance;
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
    if (a.type === AccountType.CREDIT_CARD)
      return a.balance < 0 ? sum - Math.abs(a.balance) : sum;
    return sum + a.balance;
  }, 0);

  const categoriesMap = new Map<string, CategoryAmountEntry>();
  [
    ...overallExpenseCategories.values(),
    ...overallInvestmentCategories.values(),
    ...overallOtherCategories.values(),
    ...overallDistributedCcCategories,
    ...overallDistributedUpiLiteCategories,
  ]
    .filter((c) => !isInternalSettlementCategoryName(c.name))
    .forEach((c) => {
      const ex = categoriesMap.get(c.name) || {
        name: c.name,
        color: c.color,
        amount: 0,
        superGroup: c.superGroup,
      };
      categoriesMap.set(c.name, { ...ex, amount: ex.amount + c.amount });
    });
  const categories = [...categoriesMap.values()].sort((a, b) => b.amount - a.amount);

  const recent = monthTransactions.slice(0, 10).map((t) => ({
    id: t.id,
    date: t.transactionDate
      ? new Date(t.transactionDate).toISOString()
      : new Date().toISOString(),
    description: t.merchant || t.descriptionRaw,
    amount: Number(t.amount),
    category: t.category?.name ?? 'Uncategorised',
    account: t.account.name,
    isTransfer: Boolean(t.transferGroupId),
  }));

  const outboundRecipientMap = new Map<
    string,
    { name: string; amount: number; count: number }
  >();
  monthTransactions
    .filter((t) => Number(t.amount) < 0)
    .forEach((t) => {
      const destAccountId = resolveInternalDestinationAccountId(
        t,
        monthTransactions,
        activeVaults,
      );
      const destAcc = destAccountId ? accounts.find((a) => a.id === destAccountId) : undefined;
      const isCCCategory = Boolean(
        t.category?.name && /^\s*cc transfer\s*$/i.test(t.category.name),
      );
      const tKind = classifyTransaction(t, accounts, activeVaults, activeSips);
      const internalFlow =
        tKind === 'TRANSFER' ||
        tKind === 'CC_PAYMENT' ||
        tKind === 'UPI_LITE' ||
        destAcc !== undefined ||
        isCCCategory;

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
          investmentCategories: [...overallInvestmentCategories.values()].sort(
            (a, b) => b.amount - a.amount,
          ),
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
