import { AccountType, CategoryType } from '@yaft/shared';
import {
  TransactionKind,
  DemoState,
  DemoTransaction,
  DemoAccount,
  DemoCategory,
  DemoSuperCategory,
  DemoTag,
  DemoSalaryLineItem,
  generateRandomDemoState,
} from './demo-seed';

const DEMO_MODE_STORAGE_KEY = 'yaft_demo_mode';
const DEMO_STATE_STORAGE_KEY = 'yaft_guest_demo_state_v1';

export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return true;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1' || params.get('guest') === '1') {
      window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
      return true;
    }
    if (window.location.pathname.startsWith('/demo')) {
      window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
      return true;
    }
    return window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function enableDemoMode(forceNewRandomSeed = false): DemoState {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
  }
  if (forceNewRandomSeed) {
    return resetAndRandomizeDemoData();
  }
  return getDemoState();
}

export function disableDemoMode(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
  }
}

export function resetAndRandomizeDemoData(): DemoState {
  const next = generateRandomDemoState();
  saveDemoState(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('yaft-demo-data-changed'));
  }
  return next;
}

export function getDemoState(): DemoState {
  if (typeof window === 'undefined') {
    return generateRandomDemoState();
  }
  try {
    const raw = window.localStorage.getItem(DEMO_STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.accounts)) {
        return parsed;
      }
    }
  } catch {
    // Regenerate on corrupt state
  }
  const fresh = generateRandomDemoState();
  saveDemoState(fresh);
  return fresh;
}

export function saveDemoState(state: DemoState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not persist guest demo state to localStorage', err);
  }
}

function recomputeAccountBalances(state: DemoState): void {
  const sortedAsc = [...state.transactions].sort(
    (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime(),
  );
  const running = new Map<string, number>();
  for (const acc of state.accounts) {
    running.set(acc.id, acc.openingBalance || 0);
  }
  for (const tx of sortedAsc) {
    const prev = running.get(tx.accountId) ?? 0;
    const next = prev + tx.amount;
    tx.balance = next;
    running.set(tx.accountId, next);
  }
  for (const acc of state.accounts) {
    if (
      acc.type === AccountType.BANK ||
      acc.type === AccountType.SAVINGS ||
      acc.type === AccountType.CREDIT_CARD ||
      acc.type === AccountType.EPFO
    ) {
      acc.balance = running.get(acc.id) ?? acc.balance;
    } else if (acc.type === AccountType.MUTUAL_FUND || acc.type === AccountType.STOCKS) {
      const holdingsTotal = state.holdings
        .filter((h) => h.accountId === acc.id)
        .reduce((sum, h) => sum + h.currentValue, 0);
      if (holdingsTotal > 0) {
        acc.balance = holdingsTotal;
      }
    } else if (acc.type === AccountType.RECURRING_DEPOSIT) {
      const rd = state.rds[acc.id];
      if (rd) {
        const paidCount = rd.installments.filter((i) => i.status === 'PAID').length;
        acc.balance = paidCount * rd.installmentAmount;
      }
    }
  }
  state.transactions.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
}

function formatTxForLedger(tx: DemoTransaction, state: DemoState) {
  const cat = state.categories.find(
    (c) => c.id === tx.categoryId || c.name.toLowerCase() === (tx.category || '').toLowerCase(),
  );
  const superCat = cat ? state.superCategories.find((s) => s.id === cat.superCategoryId) : null;
  const acc = state.accounts.find((a) => a.id === tx.accountId);
  const resolvedTags = (tx.tagIds || [])
    .map((tid) => state.tags.find((t) => t.id === tid))
    .filter((t): t is DemoTag => Boolean(t))
    .map((t) => ({ id: t.id, name: t.name, color: t.color, icon: t.icon }));

  return {
    ...tx,
    accountId: tx.accountId,
    accountName: acc?.name || 'Account',
    accountType: acc?.type || AccountType.BANK,
    accountInstitution: acc?.institution || null,
    cardLast4: acc?.cardLast4 || acc?.vaultLast4 || null,
    transactionDate: tx.postedAt,
    postedDate: tx.postedAt,
    description: tx.merchant || tx.description,
    details: tx.description,
    amount: tx.amount,
    balance: tx.balance ?? null,
    categoryId: cat?.id || tx.categoryId || null,
    category: cat?.name || tx.category || 'Uncategorized',
    categoryColor: cat?.color || '#6366f1',
    superCategory: superCat?.name || null,
    superCategoryColor: superCat?.color || null,
    superCategoryKind: superCat?.type || null,
    isTransfer: tx.kind === TransactionKind.TRANSFER || Boolean(tx.transferPairId),
    tags: resolvedTags,
    emailReference: tx.emailReference
      ? {
          messageId: tx.emailReference.id,
          subject: tx.emailReference.subject,
          sender: tx.emailReference.fromAddress,
          date: tx.emailReference.receivedAt,
          snippet: tx.emailReference.snippet,
          rawBody: tx.emailReference.rawBody,
        }
      : null,
  };
}

function enrichAccounts(state: DemoState) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return state.accounts.map((acc) => {
    const accTxs = state.transactions.filter((t) => t.accountId === acc.id);
    const monthTxs = accTxs.filter((t) => new Date(t.postedAt) >= monthStart);
    const monthlyCredited = monthTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const monthlyDebited = monthTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    const loan = state.loans[acc.id];
    const nextLoanInst = loan?.installments.find((i) => i.status !== 'PAID');

    const rd = state.rds[acc.id];
    const nextRdInst = rd?.installments.find((i) => i.status !== 'PAID');
    const paidRdCount = rd ? rd.installments.filter((i) => i.status === 'PAID').length : 0;

    return {
      ...acc,
      monthlyCredited,
      monthlyDebited,
      holdingsCount: state.holdings.filter((h) => h.accountId === acc.id).length,
      loanId: loan?.id ?? null,
      loanOutstanding: acc.type === AccountType.LOAN ? Math.abs(acc.balance) : null,
      nextEmiDate: nextLoanInst?.dueDate ?? null,
      nextEmiAmount: nextLoanInst?.totalAmount ?? null,
      nextDepositDate: nextRdInst?.dueDate ?? null,
      nextDepositAmount: nextRdInst?.amount ?? null,
      rdDetails: rd
        ? {
            id: rd.id,
            installmentAmount: rd.installmentAmount,
            interestRate: rd.interestRate,
            tenureMonths: rd.tenureMonths,
            installmentDay: rd.installmentDay,
            startDate: rd.startDate,
            maturityDate: rd.maturityDate,
            maturityAmount: rd.maturityAmount,
            sourceAccountId: rd.sourceAccountId,
            autoConfirm: rd.autoConfirm,
            paidInstallmentsCount: paidRdCount,
            totalInstallmentsCount: rd.installments.length,
            totalDeposited: paidRdCount * rd.installmentAmount,
            pendingInstallmentsCount: rd.installments.filter((i) => i.status === 'OVERDUE').length,
          }
        : null,
    };
  });
}

function buildDashboardResponse(state: DemoState, searchParams: URLSearchParams) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let monthLabel = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  if (searchParams.get('startDate') && searchParams.get('endDate')) {
    startDate = new Date(searchParams.get('startDate')!);
    endDate = new Date(searchParams.get('endDate')!);
    monthLabel = startDate.toISOString().slice(0, 7);
  } else if (searchParams.get('month')) {
    monthLabel = searchParams.get('month')!;
    const [y, m] = monthLabel.split('-').map(Number);
    startDate = new Date(Date.UTC(y, (m || 1) - 1, 1));
    endDate = new Date(Date.UTC(y, m || 1, 0, 23, 59, 59, 999));
  } else {
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  }

  const periodTxs = state.transactions.filter((tx) => {
    const d = new Date(tx.postedAt);
    return d >= startDate && d <= endDate;
  });

  const netWorth = state.accounts.reduce((sum, a) => sum + a.balance, 0);
  const income = periodTxs
    .filter((t) => t.amount > 0 && t.kind !== TransactionKind.TRANSFER)
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = periodTxs
    .filter((t) => t.amount < 0 && t.kind === TransactionKind.EXPENSE)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const investmentsTotal = periodTxs
    .filter((t) => t.amount < 0 && t.kind === TransactionKind.INVESTMENT)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const internalTransfersTotal = periodTxs
    .filter((t) => t.amount < 0 && t.kind === TransactionKind.TRANSFER)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const savings = income - expenses;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  const catColorMap = new Map(state.categories.map((c) => [c.name, c.color]));
  const catMap = new Map<string, number>();
  for (const tx of periodTxs) {
    if (tx.amount < 0 && tx.kind !== TransactionKind.TRANSFER) {
      catMap.set(tx.category, (catMap.get(tx.category) || 0) + Math.abs(tx.amount));
    }
  }
  const categories = Array.from(catMap.entries())
    .map(([name, amount]) => ({
      name,
      color: catColorMap.get(name) || '#6366f1',
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const accMap = new Map(state.accounts.map((a) => [a.id, a]));
  const recipientMap = new Map<string, { name: string; amount: number; count: number }>();
  for (const tx of periodTxs) {
    if (tx.amount < 0 && tx.kind !== TransactionKind.TRANSFER) {
      const name = tx.merchant || tx.description.slice(0, 24);
      const entry = recipientMap.get(name) || { name, amount: 0, count: 0 };
      entry.amount += Math.abs(tx.amount);
      entry.count += 1;
      recipientMap.set(name, entry);
    }
  }

  // Build AccountFlow for MultiBankSankey
  const bankAndCardAccounts = state.accounts.filter(
    (a) => a.type === AccountType.BANK || a.type === AccountType.SAVINGS,
  );
  const flowAccounts = bankAndCardAccounts.map((acc) => {
    const accTxs = periodTxs.filter((t) => t.accountId === acc.id);
    const externalInbound = accTxs
      .filter((t) => t.amount > 0 && t.kind !== TransactionKind.TRANSFER)
      .reduce((s, t) => s + t.amount, 0);
    const internalInbound = accTxs
      .filter((t) => t.amount > 0 && t.kind === TransactionKind.TRANSFER)
      .reduce((s, t) => s + t.amount, 0);
    const accExpenses = accTxs
      .filter((t) => t.amount < 0 && t.kind === TransactionKind.EXPENSE)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const accInvestments = accTxs
      .filter((t) => t.amount < 0 && t.kind === TransactionKind.INVESTMENT)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const accCcPayments = accTxs
      .filter((t) => t.amount < 0 && (t.kind === TransactionKind.TRANSFER || t.category === 'CC Bill Payment'))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const externalOutbound = accExpenses + accInvestments;
    const totalOutbound = externalOutbound + accCcPayments;

    const accCatMap = new Map<string, number>();
    const accRecMap = new Map<string, { name: string; amount: number; count: number; isInternal?: boolean }>();
    for (const tx of accTxs) {
      if (tx.amount < 0) {
        const abs = Math.abs(tx.amount);
        accCatMap.set(tx.category, (accCatMap.get(tx.category) || 0) + abs);
        const rName = tx.merchant || tx.description.slice(0, 22);
        const rEntry = accRecMap.get(rName) || {
          name: rName,
          amount: 0,
          count: 0,
          isInternal: tx.kind === TransactionKind.TRANSFER,
        };
        rEntry.amount += abs;
        rEntry.count += 1;
        accRecMap.set(rName, rEntry);
      }
    }

    const cleanCats = Array.from(accCatMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name,
        color: catColorMap.get(name) || '#6366f1',
        amount,
        percentage: totalOutbound > 0 ? Number(((amount / totalOutbound) * 100).toFixed(1)) : 0,
      }));

    const topRecs = Array.from(accRecMap.values()).sort((a, b) => b.amount - a.amount);

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      institution: acc.institution,
      externalInbound,
      internalInbound,
      externalOutbound,
      cleanOutbound: externalOutbound,
      expenses: accExpenses,
      investments: accInvestments,
      creditCardPayments: accCcPayments,
      internalOutbound: accCcPayments,
      totalInbound: externalInbound + internalInbound,
      totalOutbound,
      cleanCategories: cleanCats,
      allCategories: cleanCats,
      categories: cleanCats,
      topRecipients: topRecs.slice(0, 5),
      topExternalRecipients: topRecs.filter((r) => !r.isInternal).slice(0, 5),
      otherExternalOutbound: { amount: 0, count: 0 },
      topInternalRecipients: topRecs.filter((r) => r.isInternal).slice(0, 5),
      otherInternalOutbound: { amount: 0, count: 0 },
    };
  });

  const supergroups = state.superCategories
    .map((sc) => {
      const scCats = state.categories.filter((c) => c.superCategoryId === sc.id);
      const scCatNames = new Set(scCats.map((c) => c.name));
      const matched = categories.filter((c) => scCatNames.has(c.name));
      const sgTotal = matched.reduce((s, c) => s + c.amount, 0);
      return {
        id: sc.id,
        name: sc.name,
        kind: sc.type,
        color: sc.color,
        amount: sgTotal,
        categories: matched.map((c) => ({
          ...c,
          percentage: sgTotal > 0 ? Number(((c.amount / sgTotal) * 100).toFixed(1)) : 0,
        })),
      };
    })
    .filter((sg) => sg.amount > 0);

  return {
    month: monthLabel,
    income,
    expenses,
    savings,
    savingsRate,
    savingsNetInbound: income,
    savingsNetOutbound: expenses + investmentsTotal,
    netWorth,
    accounts: enrichAccounts(state),
    spendAnalysis: {
      consumption: expenses,
      outboundTransfers: internalTransfersTotal,
      investments: investmentsTotal,
    },
    topOutboundRecipients: Array.from(recipientMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
    categories,
    recent: periodTxs.slice(0, 12).map((t) => ({
      id: t.id,
      date: t.postedAt,
      description: t.merchant || t.description,
      amount: t.amount,
      category: t.category,
      account: accMap.get(t.accountId)?.name || 'Account',
      isTransfer: t.kind === TransactionKind.TRANSFER,
    })),
    accountFlow: {
      accounts: flowAccounts,
      internalTransfers: [
        {
          fromAccountId: 'acc-hdfc-salary',
          fromAccountName: 'HDFC Bank Salary Account',
          toAccountId: 'acc-cc-infinia',
          toAccountName: 'HDFC Regalia Gold Credit Card',
          toAccountType: AccountType.CREDIT_CARD,
          amount: internalTransfersTotal || 3200000,
        },
      ],
      overall: {
        totalExternalInbound: income,
        totalInternalInbound: internalTransfersTotal,
        totalExternalOutbound: expenses + investmentsTotal,
        totalCreditCardPayments: internalTransfersTotal,
        totalInvestments: investmentsTotal,
        totalCleanOutbound: expenses + investmentsTotal,
        totalInternalTransfers: internalTransfersTotal,
        totalAllOutbound: expenses + investmentsTotal + internalTransfersTotal,
        supergroups,
        categoryFlow: {
          outboundCategories: categories,
          creditCardCategories: categories.slice(0, 4),
          investmentCategories: categories.filter((c) => c.name.includes('SIP') || c.name.includes('Deposit') || c.name.includes('EPFO')),
          overallCategories: categories,
        },
      },
    },
  };
}

function buildAssetsHistoryResponse(state: DemoState) {
  const savingsTotal = state.accounts
    .filter((a) => a.type === AccountType.BANK || a.type === AccountType.SAVINGS)
    .reduce((s, a) => s + a.balance, 0);
  const depositsTotal = state.accounts
    .filter((a) => a.type === AccountType.FIXED_DEPOSIT || a.type === AccountType.RECURRING_DEPOSIT)
    .reduce((s, a) => s + a.balance, 0);
  const stocksTotal = state.accounts
    .filter((a) => a.type === AccountType.STOCKS)
    .reduce((s, a) => s + a.balance, 0);
  const mutualFundsTotal = state.accounts
    .filter((a) => a.type === AccountType.MUTUAL_FUND)
    .reduce((s, a) => s + a.balance, 0);
  const epfoTotal = state.accounts
    .filter((a) => a.type === AccountType.EPFO)
    .reduce((s, a) => s + a.balance, 0);
  const debtTotal = state.accounts
    .filter((a) => a.type === AccountType.CREDIT_CARD || a.type === AccountType.LOAN)
    .reduce((s, a) => s + Math.abs(Math.min(0, a.balance)), 0);

  const totalAssets = savingsTotal + depositsTotal + stocksTotal + mutualFundsTotal + epfoTotal;
  const netWorth = totalAssets - debtTotal;

  const now = new Date();
  const history = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const factor = 1 - i * 0.032;
    const mSavings = Math.round(savingsTotal * Math.max(0.55, factor));
    const mDeposits = Math.round(depositsTotal * Math.max(0.6, factor));
    const mStocks = Math.round(stocksTotal * Math.max(0.5, factor));
    const mMf = Math.round(mutualFundsTotal * Math.max(0.48, factor));
    const mEpfo = Math.round(epfoTotal * Math.max(0.65, factor));
    const mDebt = Math.round(debtTotal * (1 + i * 0.025));
    const mAssets = mSavings + mDeposits + mStocks + mMf + mEpfo;
    history.push({
      month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      savings: mSavings,
      deposits: mDeposits,
      stocks: mStocks,
      mutualFunds: mMf,
      epfo: mEpfo,
      debt: mDebt,
      totalAssets: mAssets,
      netWorth: mAssets - mDebt,
    });
  }

  const pct = (val: number) => (totalAssets > 0 ? Number(((val / totalAssets) * 100).toFixed(1)) : 0);

  return {
    netWorth,
    totalAssets,
    savingsTotal,
    depositsTotal,
    stocksTotal,
    mutualFundsTotal,
    epfoTotal,
    debtTotal,
    allocation: [
      { key: 'mutualFunds', label: 'Mutual Funds', amount: mutualFundsTotal, percentage: pct(mutualFundsTotal), color: '#6366f1' },
      { key: 'stocks', label: 'Equities & Stocks', amount: stocksTotal, percentage: pct(stocksTotal), color: '#10b981' },
      { key: 'epfo', label: 'Provident Fund (EPFO)', amount: epfoTotal, percentage: pct(epfoTotal), color: '#0ea5e9' },
      { key: 'savings', label: 'Bank & Savings', amount: savingsTotal, percentage: pct(savingsTotal), color: '#22c55e' },
      { key: 'deposits', label: 'Fixed & Recurring Deposits', amount: depositsTotal, percentage: pct(depositsTotal), color: '#f59e0b' },
    ],
    history,
    accounts: state.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      institution: a.institution,
      type: a.type,
      balance: a.balance,
      creditLimit: a.creditLimit,
    })),
  };
}

function buildExpenseAnalyticsResponse(state: DemoState, searchParams: URLSearchParams) {
  const rawGranularity = (searchParams.get('granularity') || 'month').toLowerCase();
  const granularity = (rawGranularity.startsWith('day') || rawGranularity === 'daily'
    ? 'day'
    : rawGranularity.startsWith('week')
    ? 'week'
    : 'month') as 'month' | 'week' | 'day';
  const startStr = searchParams.get('startDate');
  const endStr = searchParams.get('endDate');
  const typesStr = searchParams.get('categoryTypes');
  const allowedTypes = typesStr ? typesStr.split(',').filter(Boolean) : ['EXPENSE'];

  const now = new Date();
  const startDate = startStr ? new Date(startStr) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const endDate = endStr ? new Date(endStr) : now;

  const catObjMap = new Map(state.categories.map((c) => [c.name, c]));
  const scMap = new Map(state.superCategories.map((s) => [s.id, s]));

  const filtered = state.transactions.filter((tx) => {
    const d = new Date(tx.postedAt);
    if (d < startDate || d > endDate) return false;
    if (tx.amount >= 0) return false;
    const cat = catObjMap.get(tx.category);
    const sc = cat ? scMap.get(cat.superCategoryId) : null;
    const cType = sc?.type || (tx.kind === TransactionKind.INVESTMENT ? 'INVESTMENT' : tx.kind === TransactionKind.TRANSFER ? 'INTERNAL_TRANSFER' : 'EXPENSE');
    return allowedTypes.includes(cType);
  });

  const bucketMap = new Map<
    string,
    {
      intervalKey: string;
      label: string;
      subLabel?: string;
      startDate: string;
      endDate: string;
      totalAmount: number;
      catMap: Map<string, { amount: number; count: number }>;
    }
  >();

  for (const tx of filtered) {
    const d = new Date(tx.postedAt);
    let key: string;
    let label: string;
    let bStart: Date;
    let bEnd: Date;

    if (granularity === 'day') {
      key = d.toISOString().slice(0, 10);
      label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      bStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      bEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));
    } else if (granularity === 'week') {
      const dayOfWeek = d.getUTCDay();
      bStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek));
      bEnd = new Date(Date.UTC(bStart.getUTCFullYear(), bStart.getUTCMonth(), bStart.getUTCDate() + 6, 23, 59, 59));
      key = bStart.toISOString().slice(0, 10);
      label = bStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    } else {
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
      bStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      bEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
    }

    const bucket = bucketMap.get(key) || {
      intervalKey: key,
      label,
      startDate: bStart.toISOString(),
      endDate: bEnd.toISOString(),
      totalAmount: 0,
      catMap: new Map(),
    };
    const absAmt = Math.abs(tx.amount);
    bucket.totalAmount += absAmt;
    const cEntry = bucket.catMap.get(tx.category) || { amount: 0, count: 0 };
    cEntry.amount += absAmt;
    cEntry.count += 1;
    bucket.catMap.set(tx.category, cEntry);
    bucketMap.set(key, bucket);
  }

  const buckets = Array.from(bucketMap.values())
    .sort((a, b) => a.intervalKey.localeCompare(b.intervalKey))
    .map((b) => ({
      intervalKey: b.intervalKey,
      label: b.label,
      startDate: b.startDate,
      endDate: b.endDate,
      totalAmount: b.totalAmount,
      categories: Array.from(b.catMap.entries())
        .sort((x, y) => y[1].amount - x[1].amount)
        .map(([categoryName, v]) => {
          const cat = catObjMap.get(categoryName);
          const sc = cat ? scMap.get(cat.superCategoryId) : null;
          return {
            id: cat?.id || categoryName,
            name: categoryName,
            color: cat?.color || '#6366f1',
            superCategoryId: sc?.id || null,
            superCategoryName: sc?.name || null,
            superCategoryColor: sc?.color || null,
            amount: v.amount,
            count: v.count,
            percentage: b.totalAmount > 0 ? Number(((v.amount / b.totalAmount) * 100).toFixed(1)) : 0,
          };
        }),
    }));

  const overallCatMap = new Map<string, { amount: number; count: number }>();
  let totalExpense = 0;
  for (const tx of filtered) {
    const absAmt = Math.abs(tx.amount);
    totalExpense += absAmt;
    const cEntry = overallCatMap.get(tx.category) || { amount: 0, count: 0 };
    cEntry.amount += absAmt;
    cEntry.count += 1;
    overallCatMap.set(tx.category, cEntry);
  }

  const categoryLegend = Array.from(overallCatMap.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([categoryName, v]) => {
      const cat = catObjMap.get(categoryName);
      const sc = cat ? scMap.get(cat.superCategoryId) : null;
      return {
        id: cat?.id || categoryName,
        name: categoryName,
        color: cat?.color || '#6366f1',
        superCategoryName: sc?.name || null,
        totalAmount: v.amount,
        count: v.count,
        percentage: totalExpense > 0 ? Number(((v.amount / totalExpense) * 100).toFixed(1)) : 0,
      };
    });

  const peakBucket = buckets.reduce<{ key: string; label: string; amount: number } | null>(
    (best, b) => (!best || b.totalAmount > best.amount ? { key: b.intervalKey, label: b.label, amount: b.totalAmount } : best),
    null,
  );

  return {
    granularity,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    buckets,
    summary: {
      totalExpense,
      averagePerInterval: buckets.length > 0 ? Math.round(totalExpense / buckets.length) : 0,
      peakInterval: peakBucket,
      topCategory: categoryLegend[0]
        ? {
            name: categoryLegend[0].name,
            color: categoryLegend[0].color,
            amount: categoryLegend[0].totalAmount,
            percentage: categoryLegend[0].percentage,
          }
        : null,
      totalTransactionsCount: filtered.length,
      intervalCount: buckets.length,
    },
    categoryLegend,
    availableCategoryTypes: [
      { type: 'EXPENSE', label: 'Expenses', count: filtered.length, totalAmount: totalExpense },
      { type: 'INVESTMENT', label: 'Investments', count: 18, totalAmount: 30000000 },
    ],
  };
}

function buildCreditCardsSummary(state: DemoState, searchParams: URLSearchParams) {
  const accountIdFilter = searchParams.get('accountId');
  const ccAccounts = state.accounts.filter((a) => a.type === AccountType.CREDIT_CARD);
  const selectedIds = accountIdFilter && accountIdFilter !== 'ALL' ? [accountIdFilter] : ccAccounts.map((a) => a.id);
  const catColorMap = new Map(state.categories.map((c) => [c.name, c.color]));

  const cards = ccAccounts.map((card) => {
    const cardTxs = state.transactions.filter((t) => t.accountId === card.id);
    const totalOutbound = cardTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalInbound = cardTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const outstanding = Math.abs(Math.min(0, card.balance));
    const creditLimit = card.creditLimit || 30000000;

    const poolCards = card.parentAccountId
      ? ccAccounts.filter((c) => c.id === card.parentAccountId || c.parentAccountId === card.parentAccountId)
      : ccAccounts.filter((c) => c.id === card.id || c.parentAccountId === card.id);
    const poolOutstanding = poolCards.reduce((s, c) => s + Math.abs(Math.min(0, c.balance)), 0);
    const poolAvailable = Math.max(0, creditLimit - poolOutstanding);
    const utilPct = creditLimit > 0 ? Number(((poolOutstanding / creditLimit) * 100).toFixed(1)) : 0;

    const cMap = new Map<string, number>();
    const rMap = new Map<string, { name: string; amount: number; count: number }>();
    for (const tx of cardTxs) {
      if (tx.amount < 0) {
        const abs = Math.abs(tx.amount);
        cMap.set(tx.category, (cMap.get(tx.category) || 0) + abs);
        const m = tx.merchant || tx.description.slice(0, 22);
        const re = rMap.get(m) || { name: m, amount: 0, count: 0 };
        re.amount += abs;
        re.count += 1;
        rMap.set(m, re);
      }
    }

    const cardCategories = Array.from(cMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name,
        color: catColorMap.get(name) || '#6366f1',
        amount,
        percentage: totalOutbound > 0 ? Number(((amount / totalOutbound) * 100).toFixed(1)) : 0,
      }));

    const childCards = ccAccounts.filter((c) => c.parentAccountId === card.id);

    return {
      id: card.id,
      name: card.name,
      institution: card.institution,
      cardLast4: card.cardLast4,
      cardNetwork: card.cardNetwork,
      creditLimit,
      currentBalance: card.balance,
      outstanding,
      availableCredit: poolAvailable,
      utilizationPercent: utilPct,
      statementDate: card.statementDay,
      dueDate: card.dueDay,
      isShared: poolCards.length > 1,
      isParent: childCards.length > 0,
      isChild: Boolean(card.parentAccountId),
      parentAccountId: card.parentAccountId,
      parentAccountName: card.parentAccountId ? ccAccounts.find((c) => c.id === card.parentAccountId)?.name ?? null : null,
      linkedCardNames: childCards.map((c) => c.name),
      poolCreditLimit: creditLimit,
      poolOutstanding,
      poolAvailableCredit: poolAvailable,
      poolUtilization: utilPct,
      totalInbound,
      totalOutbound,
      categories: cardCategories,
      topRecipients: Array.from(rMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 5),
      otherOutbound: { amount: 0, count: 0 },
    };
  });

  const primaryCards = cards.filter((c) => !c.isChild);
  const totalLimit = primaryCards.reduce((s, c) => s + c.creditLimit, 0);
  const totalOutstanding = cards.reduce((s, c) => s + c.outstanding, 0);

  const filteredTxs = state.transactions.filter((t) => selectedIds.includes(t.accountId));
  const totalOutbound = filteredTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalInbound = filteredTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const catMap = new Map<string, number>();
  const recMap = new Map<string, { name: string; amount: number; count: number }>();
  const monthMap = new Map<string, { spends: number; payments: number }>();

  for (const tx of filteredTxs) {
    const d = new Date(tx.postedAt);
    const mKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const mEntry = monthMap.get(mKey) || { spends: 0, payments: 0 };
    if (tx.amount < 0) {
      const abs = Math.abs(tx.amount);
      mEntry.spends += abs;
      catMap.set(tx.category, (catMap.get(tx.category) || 0) + abs);
      const mName = tx.merchant || tx.description.slice(0, 22);
      const rEntry = recMap.get(mName) || { name: mName, amount: 0, count: 0 };
      rEntry.amount += abs;
      rEntry.count += 1;
      recMap.set(mName, rEntry);
    } else {
      mEntry.payments += tx.amount;
    }
    monthMap.set(mKey, mEntry);
  }

  const accMap = new Map(state.accounts.map((a) => [a.id, a]));

  return {
    summary: {
      totalLimit,
      totalOutstanding,
      totalAvailable: Math.max(0, totalLimit - totalOutstanding),
      utilizationRate: totalLimit > 0 ? Number(((totalOutstanding / totalLimit) * 100).toFixed(1)) : 0,
      activeCardCount: cards.length,
      totalInbound,
      totalOutbound,
    },
    overallFlow: {
      categories: Array.from(catMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => ({
          name,
          color: catColorMap.get(name) || '#6366f1',
          amount,
          percentage: totalOutbound > 0 ? Number(((amount / totalOutbound) * 100).toFixed(1)) : 0,
        })),
      topRecipients: Array.from(recMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 6),
      otherOutbound: { amount: 0, count: 0 },
    },
    cards,
    monthlySpendsAndPayments: Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({
        month,
        spends: v.spends,
        payments: v.payments,
      })),
    recentTransactions: filteredTxs.slice(0, 25).map((tx) => ({
      id: tx.id,
      date: tx.postedAt,
      description: tx.merchant || tx.description,
      amount: tx.amount,
      category: tx.category,
      categoryColor: catColorMap.get(tx.category) || '#6366f1',
      accountName: accMap.get(tx.accountId)?.name || 'Credit Card',
    })),
  };
}

function buildCategoriesCatalog(state: DemoState) {
  return state.categories.map((c) => {
    const sc = state.superCategories.find((s) => s.id === c.superCategoryId);
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      type: sc?.type || CategoryType.EXPENSE,
      superCategoryId: c.superCategoryId,
      superCategoryName: sc?.name || null,
      superCategoryColor: sc?.color || null,
      superCategoryKind: sc?.type || null,
      superCategory: sc
        ? {
            id: sc.id,
            name: sc.name,
            kind: sc.type as CategoryType,
            color: sc.color,
          }
        : null,
    };
  });
}

function buildTransactionsPage(state: DemoState, accountId: string | null, searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = Math.max(1, Number(searchParams.get('pageSize') || searchParams.get('limit') || 25));
  const search = (searchParams.get('search') || '').trim().toLowerCase();
  const category = searchParams.get('category') || searchParams.get('categoryId');
  const superCategoryId = searchParams.get('superCategoryId');
  const mode = searchParams.get('mode');
  const tagId = searchParams.get('tagId');
  const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : null;
  const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : null;
  const accIdsParam = searchParams.get('accountIds') || searchParams.get('accountId');
  const allowedAccountIds = accIdsParam && accIdsParam !== 'ALL'
    ? accIdsParam.split(',').filter(Boolean)
    : accountId
    ? [accountId]
    : null;

  const accMap = new Map(state.accounts.map((a) => [a.id, a]));

  let filtered = state.transactions.filter((tx) => {
    if (allowedAccountIds && !allowedAccountIds.includes(tx.accountId)) return false;
    const acc = accMap.get(tx.accountId);
    if (mode === 'CREDIT_CARD' && acc?.type !== AccountType.CREDIT_CARD) return false;
    if (mode === 'BANK' && acc?.type === AccountType.CREDIT_CARD) return false;
    if (mode === 'UPI' && !tx.description.toUpperCase().includes('UPI')) return false;
    if (search) {
      const hay = `${tx.description} ${tx.merchant || ''} ${tx.category} ${tx.notes || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (category && category !== 'ALL' && tx.category !== category && tx.categoryId !== category) return false;
    if (superCategoryId && superCategoryId !== 'ALL') {
      const catObj = state.categories.find((c) => c.id === tx.categoryId || c.name === tx.category);
      if (!catObj || catObj.superCategoryId !== superCategoryId) return false;
    }
    if (tagId && tagId !== 'ALL' && !(tx.tagIds || []).includes(tagId)) return false;
    if (startDate && new Date(tx.postedAt) < startDate) return false;
    if (endDate && new Date(tx.postedAt) > endDate) return false;
    return true;
  });

  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  filtered = [...filtered].sort((a, b) => {
    const diff = new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime();
    return sortOrder === 'asc' ? diff : -diff;
  });

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalSpent = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalReceived = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const targetAcc = accountId ? accMap.get(accountId) : null;

  return {
    account: targetAcc
      ? {
          ...targetAcc,
          monthInflow: totalReceived,
          monthOutflow: totalSpent,
          monthNet: totalReceived - totalSpent,
          monthCreditCount: filtered.filter((t) => t.amount > 0).length,
          monthDebitCount: filtered.filter((t) => t.amount < 0).length,
          monthTotalCount: filtered.length,
          parentAccountName: targetAcc.parentAccountId ? accMap.get(targetAcc.parentAccountId)?.name ?? null : null,
          isShared: Boolean(targetAcc.parentAccountId),
          isChild: Boolean(targetAcc.parentAccountId),
        }
      : undefined,
    summary: {
      totalSpent,
      totalReceived,
      netTotal: totalReceived - totalSpent,
      totalCount: total,
    },
    transactions: slice.map((t) => formatTxForLedger(t, state)),
    categories: buildCategoriesCatalog(state),
    accounts: state.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution,
      cardLast4: a.cardLast4 || a.vaultLast4 || null,
    })),
    tags: state.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    pagination: {
      page,
      pageSize,
      total,
      pages,
      totalCount: total,
      limit: pageSize,
      totalPages: pages,
    },
  };
}

function buildBudgetsResponse(state: DemoState, searchParams: URLSearchParams) {
  const now = new Date();
  const month = Number(searchParams.get('month') || now.getUTCMonth() + 1);
  const year = Number(searchParams.get('year') || now.getUTCFullYear());

  const expenseCategories = state.categories.filter((c) => {
    const sc = state.superCategories.find((s) => s.id === c.superCategoryId);
    return sc?.type === CategoryType.EXPENSE;
  });

  const mStart = new Date(Date.UTC(year, month - 1, 1));
  const mEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const monthTxs = state.transactions.filter((tx) => {
    const d = new Date(tx.postedAt);
    return d >= mStart && d <= mEnd && tx.amount < 0 && tx.kind !== TransactionKind.TRANSFER;
  });

  let totalBudgeted = 0;
  let totalSpent = 0;

  const budgets = expenseCategories.map((cat) => {
    const bItem =
      state.budgets.find((b) => b.categoryId === cat.id && b.month === month && b.year === year) ||
      state.budgets.find((b) => b.categoryId === cat.id);
    const monthlyLimit = bItem ? bItem.amount : 0; // In Rupees
    const catTxs = monthTxs.filter((t) => t.categoryId === cat.id || t.category === cat.name);
    const spentPaise = catTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
    const spentAmount = Math.round(spentPaise / 100); // In Rupees

    totalBudgeted += monthlyLimit;
    totalSpent += spentAmount;

    const percentage = monthlyLimit > 0 ? Number(((spentAmount / monthlyLimit) * 100).toFixed(1)) : 0;
    const status: 'OK' | 'WARNING' | 'EXCEEDED' | 'NO_LIMIT' =
      monthlyLimit <= 0
        ? 'NO_LIMIT'
        : percentage > 100
        ? 'EXCEEDED'
        : percentage >= 80
        ? 'WARNING'
        : 'OK';

    return {
      id: bItem?.id || `b-cat-${cat.id}`,
      budgetId: bItem?.id ?? null,
      hasBudget: monthlyLimit > 0,
      categoryId: cat.id,
      categoryName: cat.name,
      categoryIcon: cat.icon,
      categoryColor: cat.color,
      monthlyLimit,
      spentAmount,
      remainingAmount: monthlyLimit - spentAmount,
      percentage,
      percentageUsed: percentage,
      status,
      isOverBudget: monthlyLimit > 0 && spentAmount > monthlyLimit,
      transactionCount: catTxs.length,
    };
  });

  const overallPercentage = totalBudgeted > 0 ? Number(((totalSpent / totalBudgeted) * 100).toFixed(1)) : 0;

  return {
    month,
    year,
    summary: {
      totalBudgeted,
      totalBudgetedSpent: totalSpent,
      totalSpent,
      totalAllExpensesSpent: totalSpent,
      totalRemaining: totalBudgeted - totalSpent,
      overallPercentage,
      overallPercentageUsed: overallPercentage,
      totalTransactionsCount: monthTxs.length,
    },
    budgets,
    categories: budgets,
  };
}

function buildSalaryOverviewResponse(state: DemoState) {
  const statementsAsc = [...state.salaryStatements].sort(
    (a, b) => new Date(a.payPeriod).getTime() - new Date(b.payPeriod).getTime(),
  );
  const totalGross = statementsAsc.reduce((s, st) => s + st.grossEarnings, 0);
  const totalDeductions = statementsAsc.reduce((s, st) => s + st.grossDeductions, 0);
  const totalNet = statementsAsc.reduce((s, st) => s + st.netPay, 0);
  const taxes = statementsAsc.reduce((s, st) => {
    const tds = st.lineItems.find((li) => li.name.toLowerCase().includes('tax') || li.name.toLowerCase().includes('tds'));
    return s + (tds?.currentAmount || 0);
  }, 0);
  const employeePf = statementsAsc.reduce((s, st) => {
    const pf = st.lineItems.find((li) => li.name.toLowerCase().includes('pf') || li.name.toLowerCase().includes('provident'));
    return s + (pf?.currentAmount || 0);
  }, 0);

  let cumGross = 0;
  let cumTax = 0;
  const timeline = statementsAsc.map((st) => {
    const mTax =
      st.lineItems.find((li) => li.name.toLowerCase().includes('tax') || li.name.toLowerCase().includes('tds'))
        ?.currentAmount || 0;
    cumGross += st.grossEarnings;
    cumTax += mTax;
    return {
      month: st.payPeriod,
      grossEarnings: st.grossEarnings,
      netPay: st.netPay,
      tax: mTax,
      cumulativeGross: cumGross,
      cumulativeTax: cumTax,
    };
  });

  const detailedStatements = statementsAsc
    .slice()
    .reverse()
    .map((st) => {
      const org = state.organizations.find((o) => o.id === st.organizationId) || state.organizations[0];
      return {
        id: st.id,
        payPeriod: st.payPeriod,
        employer: st.organizationName,
        employeeName: state.user.name,
        department: org?.department || 'Platform Engineering',
        designation: org?.designation || 'Senior Staff Engineer',
        bankName: 'HDFC Bank',
        bankAccountLast4: '0001',
        uanLast4: '1645',
        grossEarnings: st.grossEarnings,
        grossDeductions: st.grossDeductions,
        netPay: st.netPay,
        filename: st.sourceFileName || `Payslip_${st.payPeriod.slice(0, 7)}.pdf`,
        organization: org
          ? {
              id: org.id,
              name: org.name,
              code: 'ACME',
              color: '#10b981',
            }
          : null,
        lineItems: st.lineItems.map((li) => ({
          id: li.id,
          type: li.type,
          description: li.name,
          currentAmount: li.currentAmount,
          ytdAmount: li.ytdAmount,
        })),
      };
    });

  return {
    summary: {
      statementCount: detailedStatements.length,
      totalGross,
      totalDeductions,
      totalNet,
      employeePf,
      employerPf: employeePf,
      taxes,
      latestNetPay: detailedStatements[0]?.netPay ?? 0,
    },
    timeline,
    statements: detailedStatements,
  };
}

function buildImportCatalog(state: DemoState) {
  const bankAccIds = state.accounts
    .filter((a) => a.type === AccountType.BANK || a.type === AccountType.SAVINGS)
    .map((a) => a.id);
  const ccAccIds = state.accounts.filter((a) => a.type === AccountType.CREDIT_CARD).map((a) => a.id);
  const brokerAccIds = state.accounts
    .filter((a) => a.type === AccountType.STOCKS || a.type === AccountType.MUTUAL_FUND)
    .map((a) => a.id);

  return {
    accounts: state.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution,
      currency: a.currency,
      hasStatementPassword: a.hasSavedStatementPassword,
    })),
    organizations: state.organizations.map((o, idx) => ({
      id: o.id,
      name: o.name,
      code: 'ACME',
      isCurrent: idx === 0,
    })),
    options: [
      {
        kind: 'BANK_STATEMENT',
        label: 'Bank or Card Statement',
        description: 'PDF or spreadsheet statements from HDFC, Axis, SBI, ICICI, or PNB',
        sources: [
          {
            source: 'AXIS',
            label: 'Axis Bank Statement',
            description: 'Axis Bank savings or priority account PDF statement',
            extensions: ['.pdf', '.csv'],
            maxBytes: 10 * 1024 * 1024,
            accountRequired: false,
            commitMode: 'REVIEW_REQUIRED',
            pdfPasswordSupported: true,
            rememberPasswordSupported: true,
            eligibleAccountIds: bankAccIds,
          },
          {
            source: 'SBI',
            label: 'State Bank of India (SBI)',
            description: 'SBI YONO savings account PDF statement',
            extensions: ['.pdf'],
            maxBytes: 10 * 1024 * 1024,
            accountRequired: false,
            commitMode: 'REVIEW_REQUIRED',
            pdfPasswordSupported: true,
            rememberPasswordSupported: true,
            eligibleAccountIds: bankAccIds,
          },
          {
            source: 'HDFC_CC',
            label: 'HDFC Credit Card',
            description: 'HDFC Regalia / Infinia / Tata Neu credit card statement',
            extensions: ['.pdf'],
            maxBytes: 10 * 1024 * 1024,
            accountRequired: false,
            commitMode: 'REVIEW_REQUIRED',
            pdfPasswordSupported: true,
            rememberPasswordSupported: true,
            eligibleAccountIds: ccAccIds,
          },
          {
            source: 'AXIS_CC',
            label: 'Axis Credit Card',
            description: 'Axis Atlas / Magnus / Flipkart credit card statement',
            extensions: ['.pdf'],
            maxBytes: 10 * 1024 * 1024,
            accountRequired: false,
            commitMode: 'REVIEW_REQUIRED',
            pdfPasswordSupported: true,
            rememberPasswordSupported: true,
            eligibleAccountIds: ccAccIds,
          },
        ],
      },
      {
        kind: 'SALARY_PAYSLIP',
        label: 'Salary Payslip',
        description: 'Monthly payroll PDF with earnings, PF, and tax deductions',
        sources: state.organizations.map((o, idx) => ({
          source: `ORG_${o.id}`,
          label: o.name,
          description: `Payslip layout configured for ${o.name}`,
          extensions: ['.pdf'],
          maxBytes: 10 * 1024 * 1024,
          accountRequired: false,
          commitMode: 'REVIEW_REQUIRED',
          pdfPasswordSupported: false,
          rememberPasswordSupported: false,
          eligibleAccountIds: bankAccIds,
          isCurrent: idx === 0,
        })),
      },
      {
        kind: 'BROKER_HOLDINGS',
        label: 'Broker Holdings',
        description: 'Zerodha Kite or Groww equity & mutual fund holdings report',
        sources: [
          {
            source: 'ZERODHA_KITE',
            label: 'Zerodha Console Holdings',
            description: 'XLSX or CSV holdings export from Zerodha Console',
            extensions: ['.xlsx', '.csv', '.pdf'],
            maxBytes: 10 * 1024 * 1024,
            accountRequired: true,
            commitMode: 'IMMEDIATE_ATOMIC_REPLACEMENT',
            pdfPasswordSupported: false,
            rememberPasswordSupported: false,
            eligibleAccountIds: brokerAccIds,
          },
          {
            source: 'GROWW',
            label: 'Groww Mutual Fund Report',
            description: 'Holdings report exported from Groww',
            extensions: ['.xlsx', '.csv', '.pdf'],
            maxBytes: 10 * 1024 * 1024,
            accountRequired: true,
            commitMode: 'IMMEDIATE_ATOMIC_REPLACEMENT',
            pdfPasswordSupported: false,
            rememberPasswordSupported: false,
            eligibleAccountIds: brokerAccIds,
          },
        ],
      },
    ],
  };
}

function buildPendingImportsForUi(state: DemoState) {
  const categories = state.categories.map((c) => ({ id: c.id, name: c.name, color: c.color }));
  return state.pendingImports.map((imp) => {
    const acc = state.accounts.find((a) => a.id === imp.accountId) || state.accounts[1] || state.accounts[0];
    const staged = (imp.rows || []).map((r, idx) => {
      const cat = state.categories.find((c) => c.name === r.category);
      return {
        id: r.id,
        rowNumber: idx + 1,
        transactionDate: r.postedAt,
        postedDate: r.postedAt,
        descriptionRaw: r.description,
        merchant: r.description.slice(0, 24),
        amount: r.amount,
        reference: `REF${10000 + idx}`,
        categoryId: cat?.id || state.categories[0]?.id || null,
        isDuplicate: r.status === 'DUPLICATE',
        include: r.status !== 'DUPLICATE' && r.status !== 'EXCLUDED',
        confidence: 0.95,
        emailReference: null,
      };
    });

    return {
      kind: 'BANK_STATEMENT' as const,
      source: 'AXIS',
      mode: 'REVIEW_REQUIRED' as const,
      createdAt: imp.createdAt,
      review: {
        id: imp.id,
        filename: imp.fileName,
        status: 'PENDING',
        rowCount: staged.length,
        createdAt: imp.createdAt,
        account: {
          id: acc.id,
          name: acc.name,
          institution: acc.institution,
          last4: acc.vaultLast4 || acc.cardLast4 || '0002',
        },
        categories,
        staged,
        statementBalance: imp.closingBalance ?? acc.balance,
      },
      actions: {
        commit: `/imports/${imp.id}/commit`,
        discard: `/imports/${imp.id}`,
        updateRow: `/imports/${imp.id}/rows/{rowId}`,
      },
    };
  });
}

export function getDemoPdfPreviewHtml(title: string, subtitle: string, state?: DemoState, statementId?: string): string {
  const st = state?.salaryStatements.find((s) => s.id === statementId);
  const rowsHtml = st
    ? st.lineItems
        .map(
          (li) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${li.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:${li.type === 'EARNING' ? '#15803d' : '#b91c1c'};font-weight:600;">${li.type}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;">₹${(li.currentAmount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>`,
        )
        .join('')
    : `
      <tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">Sample Statement Entry #1</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">VERIFIED</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹1,45,000.00</td></tr>
      <tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">Sample Statement Entry #2</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">VERIFIED</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹25,000.00</td></tr>
    `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
    .sheet { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    h1 { margin: 12px 0 4px; font-size: 20px; }
    p.sub { margin: 0 0 24px; color: #64748b; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; }
    th { text-align: left; padding: 10px 12px; background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 12px; color: #64748b; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="sheet">
    <span class="badge">YAFT Guest Sandbox Preview</span>
    <h1>${title}</h1>
    <p class="sub">${subtitle} &bull; Synthetic Demo Document (Local In-Browser Preview)</p>
    <table>
      <thead>
        <tr><th>Component / Particulars</th><th>Type</th><th style="text-align:right;">Amount (INR)</th></tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    ${
      st
        ? `<div style="text-align:right;font-size:15px;font-weight:700;color:#0f172a;">Net Disbursed Pay: ₹${(st.netPay / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>`
        : ''
    }
    <div class="footer">
      <span>Generated locally in YAFT Guest Sandbox</span>
      <span>Zero server uploads &bull; 100% synthetic fixture</span>
    </div>
  </div>
</body>
</html>`;
}

export async function handleDemoDownload(path: string, filename: string, _bodyPayload?: any): Promise<void> {
  const state = getDemoState();
  let content = '';
  let mime = 'application/json';

  if (path.startsWith('/backup/export')) {
    content = JSON.stringify(state, null, 2);
    mime = 'application/json';
  } else {
    content = getDemoPdfPreviewHtml(filename, `Downloaded from ${path}`, state);
    mime = 'text/html';
  }

  const blob = new Blob([content], { type: mime });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') && mime === 'text/html' ? `${filename}.html` : filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function parseBody(body: any): any {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (body instanceof FormData) {
    const out: Record<string, any> = {};
    body.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  return body;
}

export async function handleDemoApi<T>(rawPath: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const [pathname, queryString] = rawPath.split('?');
  const searchParams = new URLSearchParams(queryString || '');
  const body = parseBody(init.body);
  const state = getDemoState();

  // 1. Auth
  if (pathname === '/auth/me') {
    return state.user as unknown as T;
  }
  if (pathname === '/auth/login' || pathname === '/auth/register') {
    if (body.name) state.user.name = body.name;
    if (body.email) state.user.email = body.email;
    saveDemoState(state);
    return state.user as unknown as T;
  }
  if (pathname === '/auth/logout') {
    return undefined as unknown as T;
  }

  // 2. Dashboard
  if (pathname === '/dashboard' && method === 'GET') {
    return buildDashboardResponse(state, searchParams) as unknown as T;
  }
  if (pathname === '/dashboard/assets-history' && method === 'GET') {
    return buildAssetsHistoryResponse(state) as unknown as T;
  }
  if (pathname === '/dashboard/expense-analytics' && method === 'GET') {
    return buildExpenseAnalyticsResponse(state, searchParams) as unknown as T;
  }

  // 3. Accounts & Credit Cards
  if (pathname === '/accounts' && method === 'GET') {
    return enrichAccounts(state) as unknown as T;
  }
  if (pathname === '/accounts' && method === 'POST') {
    const newId = `acc-custom-${Date.now()}`;
    const balMinor = typeof body.balance === 'number' ? body.balance : 0;
    const newAcc: DemoAccount = {
      id: newId,
      name: body.name || 'New Account',
      institution: body.institution || 'HDFC Bank',
      type: (body.type as AccountType) || AccountType.BANK,
      currency: body.currency || 'INR',
      balance: balMinor,
      openingBalance: typeof body.openingBalance === 'number' ? body.openingBalance : balMinor,
      creditLimit: typeof body.creditLimit === 'number' ? body.creditLimit : null,
      statementDay: body.statementDay ?? null,
      dueDay: body.dueDay ?? null,
      parentAccountId: body.parentAccountId ?? null,
      cardLast4: body.cardLast4 ?? null,
      cardNetwork: body.cardNetwork ?? null,
      hasSavedStatementPassword: false,
      emailSyncEnabled: Boolean(body.emailSyncEnabled),
      vaultLast4: body.cardLast4 || String(Math.floor(1000 + Math.random() * 9000)),
    };
    state.accounts.push(newAcc);
    if (newAcc.type === AccountType.LOAN) {
      state.loans[newId] = {
        id: `loan-${newId}`,
        principalAmount: body.principalAmount || Math.abs(balMinor) || 50000000,
        interestRate: String(body.interestRate || '8.50'),
        tenureMonths: Number(body.tenureMonths || 24),
        emiAmount: Number(body.emiAmount || 2250000),
        emiDueDay: Number(body.dueDay || 5),
        startDate: body.startDate || new Date().toISOString(),
        sourceAccountId: body.sourceAccountId || null,
        installments: [],
      };
    } else if (newAcc.type === AccountType.RECURRING_DEPOSIT) {
      state.rds[newId] = {
        id: `rd-${newId}`,
        installmentAmount: Number(body.installmentAmount || 1000000),
        interestRate: String(body.interestRate || '7.00'),
        tenureMonths: Number(body.tenureMonths || 12),
        installmentDay: Number(body.installmentDay || 10),
        startDate: body.startDate || new Date().toISOString(),
        maturityDate: null,
        maturityAmount: null,
        sourceAccountId: body.sourceAccountId || null,
        autoConfirm: Boolean(body.autoConfirm),
        installments: [],
      };
    }
    saveDemoState(state);
    return enrichAccounts(state).find((a) => a.id === newId) as unknown as T;
  }

  if (pathname === '/accounts/credit-cards/summary' && method === 'GET') {
    return buildCreditCardsSummary(state, searchParams) as unknown as T;
  }

  if (pathname === '/accounts/transactions/all' && method === 'GET') {
    return buildTransactionsPage(state, null, searchParams) as unknown as T;
  }

  const accMatch = pathname.match(/^\/accounts\/([^/]+)$/);
  if (accMatch) {
    const accId = decodeURIComponent(accMatch[1]);
    if (method === 'PATCH') {
      const target = state.accounts.find((a) => a.id === accId);
      if (target) {
        Object.assign(target, body);
        recomputeAccountBalances(state);
        saveDemoState(state);
      }
      return enrichAccounts(state).find((a) => a.id === accId) as unknown as T;
    }
    if (method === 'DELETE') {
      state.accounts = state.accounts.filter((a) => a.id !== accId);
      state.transactions = state.transactions.filter((t) => t.accountId !== accId);
      state.holdings = state.holdings.filter((h) => h.accountId !== accId);
      state.sips = state.sips.filter((s) => s.accountId !== accId);
      delete state.loans[accId];
      delete state.rds[accId];
      delete state.documents[accId];
      delete state.vaults[accId];
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  const stmtPwdMatch = pathname.match(/^\/accounts\/([^/]+)\/statement-password$/);
  if (stmtPwdMatch && method === 'DELETE') {
    const accId = decodeURIComponent(stmtPwdMatch[1]);
    const target = state.accounts.find((a) => a.id === accId);
    if (target) target.hasSavedStatementPassword = false;
    saveDemoState(state);
    return undefined as unknown as T;
  }

  // Account Transactions
  const accTxsMatch = pathname.match(/^\/accounts\/([^/]+)\/transactions$/);
  if (accTxsMatch) {
    const accId = decodeURIComponent(accTxsMatch[1]);
    if (method === 'GET') {
      return buildTransactionsPage(state, accId, searchParams) as unknown as T;
    }
    if (method === 'POST') {
      const catObj = state.categories.find((c) => c.id === body.categoryId || c.name === body.category);
      const newTx: DemoTransaction = {
        id: `tx-manual-${Date.now()}`,
        accountId: accId,
        postedAt: body.postedAt || body.transactionDate ? new Date(body.postedAt || body.transactionDate).toISOString() : new Date().toISOString(),
        description: body.description || 'Manual Transaction',
        merchant: body.merchant || body.description || 'Manual Entry',
        category: catObj?.name || body.category || 'Uncategorized',
        categoryId: catObj?.id || body.categoryId || null,
        categoryVerified: true,
        amount: Number(body.amount || 0),
        kind: (body.kind as TransactionKind) || (Number(body.amount) >= 0 ? TransactionKind.INCOME : TransactionKind.EXPENSE),
        notes: body.notes || null,
        tagIds: Array.isArray(body.tagIds) ? body.tagIds : [],
      };
      state.transactions.unshift(newTx);
      recomputeAccountBalances(state);
      saveDemoState(state);
      return formatTxForLedger(newTx, state) as unknown as T;
    }
    if (method === 'DELETE') {
      state.transactions = state.transactions.filter((t) => t.accountId !== accId);
      recomputeAccountBalances(state);
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  const singleTxMatch =
    pathname.match(/^\/accounts\/([^/]+)\/transactions\/([^/]+)$/) ||
    pathname.match(/^\/transactions\/([^/]+)\/([^/]+)$/);
  if (singleTxMatch) {
    const accId = decodeURIComponent(singleTxMatch[1]);
    const txId = decodeURIComponent(singleTxMatch[2]);
    if (method === 'PATCH') {
      const tx = state.transactions.find((t) => t.id === txId && t.accountId === accId) || state.transactions.find((t) => t.id === txId);
      if (tx) {
        if (body.categoryId !== undefined || body.category !== undefined) {
          const catObj = state.categories.find((c) => c.id === body.categoryId || c.name === body.category);
          if (catObj) {
            tx.categoryId = catObj.id;
            tx.category = catObj.name;
          } else if (body.category) {
            tx.category = body.category;
          }
          tx.categoryVerified = true;
        }
        if (body.description !== undefined) tx.description = body.description;
        if (body.merchant !== undefined) tx.merchant = body.merchant;
        if (body.notes !== undefined) tx.notes = body.notes;
        if (body.amount !== undefined) tx.amount = Number(body.amount);
        if (body.postedAt !== undefined || body.transactionDate !== undefined) {
          tx.postedAt = new Date(body.postedAt || body.transactionDate).toISOString();
        }
        if (body.kind !== undefined) tx.kind = body.kind;
        if (body.categoryVerified !== undefined) tx.categoryVerified = Boolean(body.categoryVerified);
        recomputeAccountBalances(state);
        saveDemoState(state);
        return formatTxForLedger(tx, state) as unknown as T;
      }
    }
    if (method === 'DELETE') {
      state.transactions = state.transactions.filter((t) => t.id !== txId);
      recomputeAccountBalances(state);
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  // Account Timeline
  const timelineMatch = pathname.match(/^\/accounts\/([^/]+)\/timeline$/);
  if (timelineMatch && method === 'GET') {
    const accId = decodeURIComponent(timelineMatch[1]);
    const now = new Date();
    const timeline = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0, 23, 59, 59));
      const mTxs = state.transactions.filter((t) => t.accountId === accId && new Date(t.postedAt) >= d && new Date(t.postedAt) <= mEnd);
      const emailCount = mTxs.filter((t) => Boolean(t.emailReference)).length;
      const pdfCount = mTxs.length - emailCount;
      const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      timeline.push({
        month: monthKey,
        status: mTxs.length === 0 ? 'MISSING' : i === 0 ? 'PARTIAL_EMAIL' : 'STATEMENT_IMPORTED',
        totalTransactions: mTxs.length,
        pdfCount,
        emailCount,
        manualCount: 0,
        statementImport:
          mTxs.length > 0 && i > 0
            ? {
                id: `imp-${accId}-${monthKey}`,
                fileName: `Statement_${monthKey}.pdf`,
                createdAt: mEnd.toISOString(),
                committedAt: mEnd.toISOString(),
                totalRows: mTxs.length,
              }
            : null,
      });
    }
    return { timeline } as unknown as T;
  }

  // Loan & Installments
  const loanMatch = pathname.match(/^\/accounts\/([^/]+)\/loan$/);
  if (loanMatch && method === 'GET') {
    const accId = decodeURIComponent(loanMatch[1]);
    const acc = state.accounts.find((a) => a.id === accId);
    const loan = state.loans[accId];
    return {
      account: acc,
      loan: loan || null,
    } as unknown as T;
  }

  const loanInstConfirm = pathname.match(/^\/accounts\/([^/]+)\/installments\/([^/]+)\/confirm$/);
  if (loanInstConfirm && method === 'PATCH') {
    const accId = decodeURIComponent(loanInstConfirm[1]);
    const instId = decodeURIComponent(loanInstConfirm[2]);
    const loan = state.loans[accId];
    const inst = loan?.installments.find((i) => i.id === instId);
    if (inst) {
      inst.status = 'PAID';
      inst.paidAt = new Date().toISOString();
      const acc = state.accounts.find((a) => a.id === accId);
      if (acc && inst.principalAmount) {
        acc.balance = Math.min(0, acc.balance + inst.principalAmount);
      }
      saveDemoState(state);
    }
    return { ok: true } as unknown as T;
  }

  // Recurring Deposit & Installments
  const rdMatch = pathname.match(/^\/accounts\/([^/]+)\/recurring-deposit$/);
  if (rdMatch && method === 'GET') {
    const accId = decodeURIComponent(rdMatch[1]);
    const acc = state.accounts.find((a) => a.id === accId);
    const rd = state.rds[accId];
    return {
      account: acc,
      recurringDeposit: rd
        ? {
            ...rd,
            sourceAccount: rd.sourceAccountId
              ? state.accounts.find((a) => a.id === rd.sourceAccountId) || null
              : null,
          }
        : null,
    } as unknown as T;
  }

  const rdSettingsMatch = pathname.match(/^\/accounts\/([^/]+)\/recurring-deposit\/settings$/);
  if (rdSettingsMatch && method === 'PATCH') {
    const accId = decodeURIComponent(rdSettingsMatch[1]);
    const rd = state.rds[accId];
    if (rd) {
      if (body.sourceAccountId !== undefined) rd.sourceAccountId = body.sourceAccountId;
      if (body.autoConfirm !== undefined) rd.autoConfirm = Boolean(body.autoConfirm);
      saveDemoState(state);
    }
    return { ok: true } as unknown as T;
  }

  const rdInstConfirm = pathname.match(/^\/accounts\/([^/]+)\/recurring-deposit\/installments\/([^/]+)\/(confirm|unconfirm)$/);
  if (rdInstConfirm && method === 'PATCH') {
    const accId = decodeURIComponent(rdInstConfirm[1]);
    const instId = decodeURIComponent(rdInstConfirm[2]);
    const action = rdInstConfirm[3];
    const rd = state.rds[accId];
    const inst = rd?.installments.find((i) => i.id === instId);
    if (inst) {
      if (action === 'confirm') {
        inst.status = 'PAID';
        inst.paidAt = new Date().toISOString();
      } else {
        inst.status = 'PENDING';
        inst.paidAt = null;
      }
      recomputeAccountBalances(state);
      saveDemoState(state);
    }
    return { ok: true } as unknown as T;
  }

  // Account Documents
  const docsMatch = pathname.match(/^\/accounts\/([^/]+)\/documents$/);
  if (docsMatch) {
    const accId = decodeURIComponent(docsMatch[1]);
    if (method === 'GET') {
      return (state.documents[accId] || []) as unknown as T;
    }
    if (method === 'POST') {
      const list = state.documents[accId] || [];
      const created = {
        id: `doc-${Date.now()}`,
        accountId: accId,
        name: 'Uploaded_Sandbox_Document.pdf',
        mimeType: 'application/pdf' as const,
        byteSize: 184320,
        createdAt: new Date().toISOString(),
      };
      list.unshift(created);
      state.documents[accId] = list;
      saveDemoState(state);
      return list as unknown as T;
    }
  }

  const singleDocMatch = pathname.match(/^\/accounts\/([^/]+)\/documents\/([^/]+)(?:\/(reupload))?$/);
  if (singleDocMatch) {
    const accId = decodeURIComponent(singleDocMatch[1]);
    const docId = decodeURIComponent(singleDocMatch[2]);
    const isReupload = singleDocMatch[3] === 'reupload';
    const list = state.documents[accId] || [];
    const target = list.find((d) => d.id === docId);
    if (isReupload && method === 'POST' && target) {
      target.createdAt = new Date().toISOString();
      saveDemoState(state);
      return target as unknown as T;
    }
    if (method === 'PATCH' && target) {
      if (body.name) target.name = body.name;
      saveDemoState(state);
      return target as unknown as T;
    }
    if (method === 'DELETE') {
      state.documents[accId] = list.filter((d) => d.id !== docId);
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  // 4. Vault
  const vaultMatch = pathname.match(/^\/vault\/([^/]+)(?:\/(reveal))?$/);
  if (vaultMatch) {
    const accId = decodeURIComponent(vaultMatch[1]);
    const isReveal = vaultMatch[2] === 'reveal';
    const acc = state.accounts.find((a) => a.id === accId);
    const entry = state.vaults[accId] || {
      accountId: accId,
      accountNumber: `50100${acc?.vaultLast4 || '0001'}`,
      customerId: '10000001',
      ifsc: acc?.vaultIfsc || 'HDFC0000001',
      upiId: acc?.vaultUpiId || 'demo@okhdfcbank',
      branch: 'Bengaluru Main Branch',
      nominee: 'Registered Nominee',
      registeredMobile: '+91 98000 00000',
      registeredEmail: state.user.email,
      statementPassword: 'DEMO1234',
      notes: 'Stored locally in Guest Sandbox.',
      customFields: [],
      updatedAt: new Date().toISOString(),
    };

    if (method === 'GET') {
      if (isReveal) {
        return {
          accountId: accId,
          hasData: true,
          updatedAt: entry.updatedAt,
          data: {
            accountNumber: entry.accountNumber,
            customerId: entry.customerId,
            ifsc: entry.ifsc,
            upiId: entry.upiId,
            branch: entry.branch,
            nominee: entry.nominee,
            registeredMobile: entry.registeredMobile,
            registeredEmail: entry.registeredEmail,
            statementPassword: entry.statementPassword,
            notes: entry.notes,
            customFields: entry.customFields,
          },
        } as unknown as T;
      }
      return {
        accountId: accId,
        hasData: Boolean(state.vaults[accId]),
        updatedAt: entry.updatedAt,
        masked: {
          accountNumber: entry.accountNumber ? `••••••••${entry.accountNumber.slice(-4)}` : null,
          customerId: entry.customerId ? `••••${entry.customerId.slice(-4)}` : null,
          ifsc: entry.ifsc || null,
          upiId: entry.upiId || null,
          branch: entry.branch || null,
          nominee: entry.nominee || null,
          registeredMobile: entry.registeredMobile || null,
          registeredEmail: entry.registeredEmail || null,
          hasStatementPassword: Boolean(entry.statementPassword),
          hasNotes: Boolean(entry.notes),
          customFieldCount: entry.customFields?.length || 0,
        },
      } as unknown as T;
    }
    if (method === 'PUT') {
      state.vaults[accId] = {
        ...entry,
        ...body,
        accountId: accId,
        updatedAt: new Date().toISOString(),
      };
      if (acc && body.accountNumber) {
        acc.vaultLast4 = String(body.accountNumber).slice(-4);
      }
      saveDemoState(state);
      return { ok: true } as unknown as T;
    }
    if (method === 'DELETE') {
      delete state.vaults[accId];
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  // 5. Investments & SIPs
  if (pathname === '/investments/portfolio' && method === 'GET') {
    const invAccounts = state.accounts
      .filter((a) => a.type === AccountType.STOCKS || a.type === AccountType.MUTUAL_FUND)
      .map((acc) => {
        const accHoldings = state.holdings.filter((h) => h.accountId === acc.id);
        const investedValue = accHoldings.reduce((s, h) => s + Math.round(parseFloat(h.quantity) * h.averagePrice), 0);
        const currentValue = accHoldings.reduce((s, h) => s + h.currentValue, 0);
        const unrealizedPnl = currentValue - investedValue;
        return {
          id: acc.id,
          name: acc.name,
          institution: acc.institution,
          type: acc.type,
          currency: acc.currency,
          balance: currentValue,
          holdingsCount: accHoldings.length,
          investedValue,
          currentValue,
          unrealizedPnl,
          unrealizedPnlPct: investedValue > 0 ? ((unrealizedPnl / investedValue) * 100).toFixed(2) : '0.00',
          holdings: accHoldings,
        };
      });
    return {
      accounts: invAccounts,
      holdings: state.holdings,
    } as unknown as T;
  }

  const refreshQuotesMatch = pathname.match(/^\/investments\/([^/]+)\/(refresh-quotes|refresh-navs|sync-zerodha|sync-groww)$/);
  if (refreshQuotesMatch && method === 'POST') {
    const accId = decodeURIComponent(refreshQuotesMatch[1]);
    let updated = 0;
    for (const h of state.holdings) {
      if (h.accountId === accId) {
        const deltaPct = Math.random() * 0.03 - 0.008;
        h.previousClosingPrice = Math.max(100, Math.round(h.previousClosingPrice * (1 + deltaPct)));
        const qty = parseFloat(h.quantity);
        const invested = Math.round(qty * h.averagePrice);
        h.currentValue = Math.round(qty * h.previousClosingPrice);
        h.unrealizedPnl = h.currentValue - invested;
        h.unrealizedPnlPct = invested > 0 ? ((h.unrealizedPnl / invested) * 100).toFixed(2) : '0.00';
        updated++;
      }
    }
    recomputeAccountBalances(state);
    saveDemoState(state);
    return { updated, failed: 0, imported: updated, message: `Updated ${updated} holdings in Guest Sandbox.` } as unknown as T;
  }

  if (pathname === '/investments/sips') {
    if (method === 'GET') {
      const accId = searchParams.get('accountId');
      const list = accId ? state.sips.filter((s) => s.accountId === accId) : state.sips;
      return list.map((s) => ({
        ...s,
        account: state.accounts.find((a) => a.id === s.accountId) || { id: s.accountId, name: 'Mutual Fund Account', institution: 'Groww' },
      })) as unknown as T;
    }
    if (method === 'POST') {
      const created = {
        id: `sip-${Date.now()}`,
        accountId: body.accountId || 'acc-mf-groww',
        schemeName: body.schemeName || 'New Mutual Fund SIP',
        isin: body.isin || null,
        folioNumber: body.folioNumber || null,
        amount: Number(body.amount || 1000000),
        frequency: body.frequency || 'MONTHLY',
        sipDay: body.sipDay ?? 5,
        startDate: body.startDate || new Date().toISOString(),
        nextInstallmentDate: body.nextInstallmentDate || new Date().toISOString(),
        status: body.status || 'ACTIVE',
        autoPayAccount: body.autoPayAccount || null,
        notes: body.notes || null,
      };
      state.sips.push(created);
      saveDemoState(state);
      return created as unknown as T;
    }
  }

  const singleSipMatch = pathname.match(/^\/investments\/sips\/([^/]+)$/);
  if (singleSipMatch) {
    const sipId = decodeURIComponent(singleSipMatch[1]);
    if (method === 'PATCH') {
      const target = state.sips.find((s) => s.id === sipId);
      if (target) Object.assign(target, body);
      saveDemoState(state);
      return target as unknown as T;
    }
    if (method === 'DELETE') {
      state.sips = state.sips.filter((s) => s.id !== sipId);
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  // 6. Super Categories, Categories & Category Rules
  if (pathname === '/super-categories') {
    if (method === 'GET') {
      return state.superCategories.map((sc, idx) => {
        const scCats = state.categories.filter((c) => c.superCategoryId === sc.id);
        return {
          ...sc,
          kind: sc.type,
          order: idx,
          categories: scCats.map((c) => ({
            ...c,
            type: sc.type,
            _count: {
              transactions: state.transactions.filter((t) => t.categoryId === c.id || t.category === c.name).length,
            },
          })),
          _count: { categories: scCats.length },
        };
      }) as unknown as T;
    }
    if (method === 'POST') {
      const sc: DemoSuperCategory = {
        id: `sc-${Date.now()}`,
        name: body.name || 'Custom Group',
        type: body.kind || body.type || CategoryType.EXPENSE,
        icon: body.icon || 'Folder',
        color: body.color || '#6366f1',
        isSystem: false,
      };
      state.superCategories.push(sc);
      saveDemoState(state);
      return { ...sc, kind: sc.type } as unknown as T;
    }
  }

  const scMatch = pathname.match(/^\/super-categories\/([^/]+)$/);
  if (scMatch) {
    const scId = decodeURIComponent(scMatch[1]);
    if (method === 'PUT') {
      const target = state.superCategories.find((s) => s.id === scId);
      if (target) {
        Object.assign(target, body);
        if (body.kind) target.type = body.kind;
      }
      saveDemoState(state);
      return target as unknown as T;
    }
    if (method === 'DELETE') {
      state.superCategories = state.superCategories.filter((s) => s.id !== scId);
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  if (pathname === '/categories') {
    if (method === 'GET') {
      return buildCategoriesCatalog(state) as unknown as T;
    }
    if (method === 'POST') {
      const cat: DemoCategory = {
        id: `cat-${Date.now()}`,
        name: body.name || 'New Category',
        icon: body.icon || 'Tag',
        color: body.color || '#10b981',
        superCategoryId: body.superCategoryId || 'sc-expense',
        isSystem: false,
      };
      state.categories.push(cat);
      saveDemoState(state);
      return buildCategoriesCatalog(state).find((c) => c.id === cat.id) as unknown as T;
    }
  }

  const catMatch = pathname.match(/^\/categories\/([^/]+)$/);
  if (catMatch && !['rules', 'batch-update'].includes(catMatch[1])) {
    const catId = decodeURIComponent(catMatch[1]);
    if (method === 'PUT') {
      const target = state.categories.find((c) => c.id === catId);
      if (target) Object.assign(target, body);
      saveDemoState(state);
      return buildCategoriesCatalog(state).find((c) => c.id === catId) as unknown as T;
    }
    if (method === 'DELETE') {
      state.categories = state.categories.filter((c) => c.id !== catId);
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  if ((pathname === '/category-rules' || pathname === '/categories/rules') && method === 'GET') {
    return state.categoryRules.map((r) => {
      const cat = state.categories.find((c) => c.id === r.categoryId);
      const sc = cat ? state.superCategories.find((s) => s.id === cat.superCategoryId) : null;
      return {
        id: r.id,
        pattern: r.pattern,
        matchField: 'DESCRIPTION',
        matchType: r.isRegex ? 'REGEX' : 'CONTAINS',
        priority: r.priority,
        categoryId: r.categoryId,
        categoryName: cat?.name || 'Uncategorized',
        categoryColor: cat?.color || '#6366f1',
        category: cat
          ? {
              id: cat.id,
              name: cat.name,
              color: cat.color,
              superCategory: sc ? { id: sc.id, name: sc.name, color: sc.color, kind: sc.type } : null,
            }
          : null,
      };
    }) as unknown as T;
  }

  if ((pathname === '/category-rules' || pathname === '/categories/rules') && method === 'POST') {
    const rule = {
      id: `rule-${Date.now()}`,
      name: body.name || body.pattern || 'Custom Rule',
      pattern: body.pattern || '',
      isRegex: body.matchType === 'REGEX' || Boolean(body.isRegex),
      categoryId: body.categoryId || state.categories[0]?.id || 'cat-food',
      priority: Number(body.priority || 5),
    };
    state.categoryRules.unshift(rule);
    saveDemoState(state);
    return rule as unknown as T;
  }

  const ruleDelMatch = pathname.match(/^\/(?:category-rules|categories\/rules)\/([^/]+)$/);
  if (ruleDelMatch && method === 'DELETE') {
    const ruleId = decodeURIComponent(ruleDelMatch[1]);
    state.categoryRules = state.categoryRules.filter((r) => r.id !== ruleId);
    saveDemoState(state);
    return undefined as unknown as T;
  }

  if (
    (pathname === '/category-rules/apply' ||
      pathname === '/categories/rules/apply' ||
      pathname === '/category-rules/seed-defaults') &&
    method === 'POST'
  ) {
    let updatedCount = 0;
    for (const tx of state.transactions) {
      for (const rule of state.categoryRules) {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(`${tx.description} ${tx.merchant || ''}`)) {
          const cat = state.categories.find((c) => c.id === rule.categoryId);
          if (cat && tx.categoryId !== cat.id) {
            tx.categoryId = cat.id;
            tx.category = cat.name;
            updatedCount++;
          }
          break;
        }
      }
    }
    saveDemoState(state);
    return { updatedCount, seededCount: state.categoryRules.length } as unknown as T;
  }

  if (pathname === '/category-rules/unverified' && method === 'GET') {
    const unverified = state.transactions.filter((t) => !t.categoryVerified);
    const groupMap = new Map<string, DemoTransaction[]>();
    for (const tx of unverified) {
      const cid = tx.categoryId || 'cat-food';
      const list = groupMap.get(cid) || [];
      list.push(tx);
      groupMap.set(cid, list);
    }
    const groups = Array.from(groupMap.entries()).map(([categoryId, txs]) => {
      const cat = state.categories.find((c) => c.id === categoryId) || state.categories[0];
      const sc = cat ? state.superCategories.find((s) => s.id === cat.superCategoryId) : null;
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color,
        category: {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          superCategory: sc ? { name: sc.name, color: sc.color, kind: sc.type } : null,
        },
        unverifiedCount: txs.length,
        totalCount: txs.length,
        sampleDescriptions: txs.slice(0, 3).map((t) => t.merchant || t.description),
        transactionIds: txs.map((t) => t.id),
        transactions: txs.map((t) => ({
          id: t.id,
          transactionDate: t.postedAt,
          descriptionRaw: t.description,
          merchant: t.merchant,
          amount: t.amount,
          userVerified: false,
        })),
      };
    });
    return groups as unknown as T;
  }

  if ((pathname === '/category-rules/batch-update' || pathname === '/categories/batch-update') && method === 'POST') {
    const ids: string[] = Array.isArray(body.transactionIds) ? body.transactionIds : [];
    const cat = state.categories.find((c) => c.id === body.categoryId || c.name === body.category);
    for (const tx of state.transactions) {
      if (ids.includes(tx.id)) {
        if (cat) {
          tx.categoryId = cat.id;
          tx.category = cat.name;
        }
        tx.categoryVerified = true;
      }
    }
    saveDemoState(state);
    return { updatedCount: ids.length } as unknown as T;
  }

  // 7. Budgets
  if (pathname === '/budgets') {
    if (method === 'GET') {
      return buildBudgetsResponse(state, searchParams) as unknown as T;
    }
    if (method === 'POST') {
      const month = Number(body.month || new Date().getUTCMonth() + 1);
      const year = Number(body.year || new Date().getUTCFullYear());
      const amount = Number(body.monthlyLimit ?? body.amount ?? 0);
      const existing = state.budgets.find(
        (b) => b.categoryId === body.categoryId && b.month === month && b.year === year,
      );
      if (existing) {
        existing.amount = amount;
      } else {
        state.budgets.push({
          id: `b-${Date.now()}`,
          categoryId: body.categoryId,
          month,
          year,
          amount,
        });
      }
      saveDemoState(state);
      return buildBudgetsResponse(state, new URLSearchParams({ month: String(month), year: String(year) })) as unknown as T;
    }
  }

  if (pathname === '/budgets/transactions' && method === 'GET') {
    const now = new Date();
    const month = Number(searchParams.get('month') || now.getUTCMonth() + 1);
    const year = Number(searchParams.get('year') || now.getUTCFullYear());
    const categoryId = searchParams.get('categoryId');

    const mStart = new Date(Date.UTC(year, month - 1, 1));
    const mEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const cat = state.categories.find((c) => c.id === categoryId);

    const txs = state.transactions.filter((tx) => {
      const d = new Date(tx.postedAt);
      if (d < mStart || d > mEnd) return false;
      if (categoryId && tx.categoryId !== categoryId && tx.category !== cat?.name) return false;
      return tx.kind !== TransactionKind.TRANSFER;
    });

    const totalSpentPaise = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalRefundsPaise = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

    return {
      month,
      year,
      category: cat ? { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color } : null,
      summary: {
        totalSpent: Math.round(totalSpentPaise / 100),
        totalRefunds: Math.round(totalRefundsPaise / 100),
        netOutflow: Math.round((totalSpentPaise - totalRefundsPaise) / 100),
        transactionCount: txs.length,
      },
      transactions: txs.map((tx) => {
        const acc = state.accounts.find((a) => a.id === tx.accountId);
        const c = state.categories.find((catItem) => catItem.id === tx.categoryId || catItem.name === tx.category);
        return {
          id: tx.id,
          postedAt: tx.postedAt,
          description: tx.description,
          merchant: tx.merchant,
          amount: Math.round(tx.amount / 100),
          amountMinor: tx.amount,
          kind: tx.kind,
          notes: tx.notes || null,
          account: {
            id: acc?.id || tx.accountId,
            name: acc?.name || 'Account',
            institution: acc?.institution || null,
            type: acc?.type || AccountType.BANK,
          },
          category: c ? { id: c.id, name: c.name, icon: c.icon, color: c.color } : null,
          tags: (tx.tagIds || [])
            .map((tid) => state.tags.find((t) => t.id === tid))
            .filter((t): t is DemoTag => Boolean(t)),
        };
      }),
    } as unknown as T;
  }

  const budgetDelMatch = pathname.match(/^\/budgets\/([^/]+)$/);
  if (budgetDelMatch && method === 'DELETE') {
    const bid = decodeURIComponent(budgetDelMatch[1]);
    state.budgets = state.budgets.filter((b) => b.id !== bid);
    saveDemoState(state);
    return undefined as unknown as T;
  }

  // 8. Tags
  if (pathname === '/tags') {
    if (method === 'GET') {
      return state.tags.map((tag) => {
        const tagTxs = state.transactions.filter((t) => (t.tagIds || []).includes(tag.id));
        const spentPaise = tagTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const recPaise = tagTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        return {
          ...tag,
          transactionCount: tagTxs.length,
          totalSpent: Math.round(spentPaise / 100),
          totalReceived: Math.round(recPaise / 100),
          netTotal: Math.round((spentPaise - recPaise) / 100),
        };
      }) as unknown as T;
    }
    if (method === 'POST') {
      const newTag: DemoTag = {
        id: `tag-${Date.now()}`,
        name: body.name || 'New Tag',
        color: body.color || '#6366f1',
        icon: body.icon || 'Tag',
        description: body.description || null,
        budgetLimit: body.budgetLimit ? Number(body.budgetLimit) : null,
        keywords: Array.isArray(body.keywords) ? body.keywords : [],
      };
      state.tags.push(newTag);
      saveDemoState(state);
      return { ...newTag, transactionCount: 0, totalSpent: 0, totalReceived: 0, netTotal: 0 } as unknown as T;
    }
  }

  if (pathname === '/tags/assign' && method === 'POST') {
    const txIds: string[] = Array.isArray(body.transactionIds) ? body.transactionIds : [];
    const tagIds: string[] = Array.isArray(body.tagIds) ? body.tagIds : [];
    for (const tx of state.transactions) {
      if (txIds.includes(tx.id)) {
        tx.tagIds = tagIds;
      }
    }
    saveDemoState(state);
    return { updatedCount: txIds.length } as unknown as T;
  }

  const tagAutoApplyMatch = pathname.match(/^\/tags\/([^/]+)\/auto-apply$/);
  if (tagAutoApplyMatch && method === 'POST') {
    const tagId = decodeURIComponent(tagAutoApplyMatch[1]);
    const tag = state.tags.find((t) => t.id === tagId);
    let matchedCount = 0;
    const kwList = body.keywords
      ? String(body.keywords)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : tag?.keywords || [];
    if (tag && kwList.length > 0) {
      for (const tx of state.transactions) {
        const hay = `${tx.description} ${tx.merchant || ''}`.toUpperCase();
        if (kwList.some((kw) => hay.includes(kw.toUpperCase()))) {
          if (!tx.tagIds.includes(tagId)) {
            tx.tagIds.push(tagId);
            matchedCount++;
          }
        }
      }
      saveDemoState(state);
    }
    return { matchedCount, assignedCount: matchedCount } as unknown as T;
  }

  const tagAnalyticsMatch = pathname.match(/^\/tags\/([^/]+)\/analytics$/);
  if (tagAnalyticsMatch && method === 'GET') {
    const tagId = decodeURIComponent(tagAnalyticsMatch[1]);
    const tag = state.tags.find((t) => t.id === tagId) || state.tags[0];
    const tagTxs = state.transactions.filter((t) => (t.tagIds || []).includes(tagId));
    const spentPaise = tagTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const recPaise = tagTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalSpent = Math.round(spentPaise / 100);
    const totalReceived = Math.round(recPaise / 100);

    const catMap = new Map<string, { name: string; color: string; icon: string; amount: number; count: number }>();
    for (const tx of tagTxs) {
      if (tx.amount < 0) {
        const c = state.categories.find((cat) => cat.id === tx.categoryId || cat.name === tx.category);
        const key = c?.name || tx.category || 'Uncategorized';
        const entry = catMap.get(key) || {
          name: key,
          color: c?.color || '#6366f1',
          icon: c?.icon || 'Tag',
          amount: 0,
          count: 0,
        };
        entry.amount += Math.round(Math.abs(tx.amount) / 100);
        entry.count += 1;
        catMap.set(key, entry);
      }
    }

    return {
      tag,
      summary: {
        transactionCount: tagTxs.length,
        totalSpent,
        totalReceived,
        netTotal: totalSpent - totalReceived,
        budgetLimit: tag?.budgetLimit ?? null,
        budgetUsedPercent: tag?.budgetLimit ? Number(((totalSpent / tag.budgetLimit) * 100).toFixed(1)) : null,
      },
      categoryBreakdown: Array.from(catMap.values()).map((c) => ({
        ...c,
        percentage: totalSpent > 0 ? Number(((c.amount / totalSpent) * 100).toFixed(1)) : 0,
      })),
      transactions: tagTxs.map((tx) => {
        const acc = state.accounts.find((a) => a.id === tx.accountId);
        const c = state.categories.find((cat) => cat.id === tx.categoryId || cat.name === tx.category);
        return {
          id: tx.id,
          postedAt: tx.postedAt,
          description: tx.description,
          merchant: tx.merchant,
          amount: Math.round(tx.amount / 100),
          kind: tx.kind,
          account: { id: acc?.id || tx.accountId, name: acc?.name || 'Account', institution: acc?.institution || '' },
          category: c ? { id: c.id, name: c.name, color: c.color, icon: c.icon } : null,
        };
      }),
    } as unknown as T;
  }

  const singleTagMatch = pathname.match(/^\/tags\/([^/]+)$/);
  if (singleTagMatch) {
    const tagId = decodeURIComponent(singleTagMatch[1]);
    if (method === 'PUT') {
      const target = state.tags.find((t) => t.id === tagId);
      if (target) Object.assign(target, body);
      saveDemoState(state);
      return target as unknown as T;
    }
    if (method === 'DELETE') {
      state.tags = state.tags.filter((t) => t.id !== tagId);
      for (const tx of state.transactions) {
        tx.tagIds = (tx.tagIds || []).filter((id) => id !== tagId);
      }
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  // 9. Transfers
  if (pathname === '/transfers/suggestions' && method === 'GET') {
    const unlinkedDebits = state.transactions.filter(
      (t) => t.amount < 0 && !t.transferPairId && t.description.includes('CRED'),
    );
    const suggestions = [];
    for (const outTx of unlinkedDebits) {
      const inTx = state.transactions.find(
        (t) =>
          t.amount === Math.abs(outTx.amount) &&
          !t.transferPairId &&
          t.accountId !== outTx.accountId &&
          Math.abs(new Date(t.postedAt).getTime() - new Date(outTx.postedAt).getTime()) <= 86400000 * 4,
      );
      if (inTx) {
        const outAcc = state.accounts.find((a) => a.id === outTx.accountId);
        const inAcc = state.accounts.find((a) => a.id === inTx.accountId);
        suggestions.push({
          debit: {
            id: outTx.id,
            account: outAcc?.name || 'Bank Account',
            amount: outTx.amount,
            date: outTx.postedAt,
            description: outTx.description,
          },
          credit: {
            id: inTx.id,
            account: inAcc?.name || 'Credit Card',
            amount: inTx.amount,
            date: inTx.postedAt,
            description: inTx.description,
          },
        });
      }
    }
    return suggestions as unknown as T;
  }

  if (pathname === '/transfers/link' && method === 'POST') {
    const pairId = `pair-${Date.now()}`;
    const outId = body.debitId || body.outgoingId;
    const inId = body.creditId || body.incomingId;
    const outTx = state.transactions.find((t) => t.id === outId);
    const inTx = state.transactions.find((t) => t.id === inId);
    if (outTx && inTx) {
      outTx.transferPairId = pairId;
      outTx.transferAccountId = inTx.accountId;
      outTx.kind = TransactionKind.TRANSFER;
      outTx.categoryVerified = true;
      inTx.transferPairId = pairId;
      inTx.transferAccountId = outTx.accountId;
      inTx.kind = TransactionKind.TRANSFER;
      inTx.categoryVerified = true;
      saveDemoState(state);
    }
    return { ok: true } as unknown as T;
  }

  if (pathname === '/transfers/reconcile' && method === 'POST') {
    return { linkedCount: 1 } as unknown as T;
  }

  // 10. Salary & Organizations
  if (pathname === '/organizations') {
    if (method === 'GET') {
      return state.organizations.map((org, idx) => ({
        ...org,
        code: 'ACME',
        color: '#10b981',
        isCurrent: idx === 0,
        _count: {
          statements: state.salaryStatements.filter((s) => s.organizationId === org.id).length,
        },
      })) as unknown as T;
    }
    if (method === 'POST') {
      const org = {
        id: `org-${Date.now()}`,
        name: body.name || 'New Employer Pvt Ltd',
        employeeId: body.employeeId || 'EMP-101',
        pfNumber: body.pfNumber || null,
        uan: body.uan || null,
        pan: body.pan || null,
        bankAccount: body.bankAccount || null,
        designation: body.designation || 'Software Engineer',
        department: body.department || 'Engineering',
        location: body.location || 'Bengaluru',
        dateOfJoining: body.dateOfJoining || null,
        parsingConfig: body.parsingConfig || null,
      };
      state.organizations.push(org);
      saveDemoState(state);
      return org as unknown as T;
    }
  }

  const orgActionMatch = pathname.match(/^\/organizations\/([^/]+)(?:\/(sample-slip|test-parser))?$/);
  if (orgActionMatch) {
    const orgId = decodeURIComponent(orgActionMatch[1]);
    const subAction = orgActionMatch[2];
    const org = state.organizations.find((o) => o.id === orgId);

    if (subAction === 'sample-slip' || subAction === 'test-parser') {
      const latest = state.salaryStatements[0];
      return {
        extractedText: `PAYSLIP FOR THE MONTH OF ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}\nOrganization: ${org?.name || 'Acme Technologies'}\nEmployee ID: ${org?.employeeId || 'EMP-IN-4092'}\nBasic Salary: 1,35,000.00\nHRA: 67,500.00\nSpecial Allowance: 72,000.00\nProvident Fund: 21,600.00\nIncome Tax (TDS): 38,000.00\nProfessional Tax: 200.00\nNet Pay: 2,14,700.00`,
        suggestedConfig: org?.parsingConfig || {
          institutionName: org?.name || 'Acme Technologies',
          anchors: ['PAYSLIP FOR THE MONTH OF'],
          earningsKeywords: ['Basic Salary', 'HRA', 'Special Allowance'],
          deductionsKeywords: ['Provident Fund', 'Income Tax (TDS)', 'Professional Tax'],
        },
        previewResult: {
          payPeriod: latest?.payPeriod || new Date().toISOString(),
          grossEarnings: latest?.grossEarnings || 27450000,
          grossDeductions: latest?.grossDeductions || 5980000,
          netPay: latest?.netPay || 21470000,
          paidDays: 30,
          lopDays: 0,
          lineItems: latest?.lineItems || [],
        },
      } as unknown as T;
    }

    if (method === 'PUT' && org) {
      Object.assign(org, body);
      saveDemoState(state);
      return org as unknown as T;
    }
    if (method === 'DELETE') {
      state.organizations = state.organizations.filter((o) => o.id !== orgId);
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  if (pathname === '/salary-statements' && method === 'GET') {
    return buildSalaryOverviewResponse(state) as unknown as T;
  }

  if (pathname === '/salary-statements/manual' && method === 'POST') {
    const org = state.organizations.find((o) => o.id === body.organizationId) || state.organizations[0];
    const items: DemoSalaryLineItem[] = Array.isArray(body.lineItems)
      ? body.lineItems.map((li: any, idx: number) => ({
          id: `li-man-${Date.now()}-${idx}`,
          name: li.name || li.description || 'Component',
          type: li.type || 'EARNING',
          currentAmount: Number(li.currentAmount || 0),
          ytdAmount: li.ytdAmount ? Number(li.ytdAmount) : null,
        }))
      : [];
    const grossEarnings =
      Number(body.grossEarnings) || items.filter((i) => i.type === 'EARNING').reduce((s, i) => s + i.currentAmount, 0);
    const grossDeductions =
      Number(body.grossDeductions) || items.filter((i) => i.type === 'DEDUCTION').reduce((s, i) => s + i.currentAmount, 0);
    const netPay = Number(body.netPay) || grossEarnings - grossDeductions;
    const stmt = {
      id: `sal-man-${Date.now()}`,
      organizationId: org?.id || 'org-acme',
      organizationName: org?.name || 'Acme Technologies India Pvt Ltd',
      payPeriod: body.payPeriod ? new Date(body.payPeriod).toISOString() : new Date().toISOString(),
      grossEarnings,
      grossDeductions,
      netPay,
      paidDays: body.paidDays ?? 30,
      lopDays: body.lopDays ?? 0,
      regime: body.regime || 'NEW_REGIME',
      sourceFileName: null,
      hasFile: false,
      status: 'COMMITTED',
      createdAt: new Date().toISOString(),
      lineItems: items,
      transactionId: null,
    };
    state.salaryStatements.unshift(stmt);
    saveDemoState(state);
    return stmt as unknown as T;
  }

  const salStmtMatch = pathname.match(/^\/salary-statements\/([^/]+)(?:\/(commit))?$/);
  if (salStmtMatch) {
    const stmtId = decodeURIComponent(salStmtMatch[1]);
    const isCommit = salStmtMatch[2] === 'commit';
    if (isCommit && method === 'POST') {
      state.pendingImports = state.pendingImports.filter((p) => p.id !== stmtId);
      saveDemoState(state);
      return { ok: true } as unknown as T;
    }
    if (method === 'DELETE') {
      state.salaryStatements = state.salaryStatements.filter((s) => s.id !== stmtId);
      state.pendingImports = state.pendingImports.filter((p) => p.id !== stmtId);
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  // 11. Unified Imports & Email Ingestion
  if (pathname === '/imports/unified/options' && method === 'GET') {
    return buildImportCatalog(state) as unknown as T;
  }

  if (pathname === '/imports/unified/pending' && method === 'GET') {
    return buildPendingImportsForUi(state) as unknown as T;
  }

  if (pathname === '/imports/unified/history' && method === 'GET') {
    return state.importHistory.map((h) => ({
      id: h.id,
      sourceType: h.kind === 'SALARY' ? 'SALARY_PAYSLIP' : 'BANK_STATEMENT',
      filename: h.fileName,
      status: h.status,
      rowCount: h.totalRows,
      createdAt: h.createdAt,
      committedAt: h.committedAt,
      accountName: h.accountName || h.organizationName || 'HDFC Bank Salary Account',
      accountType: h.kind === 'SALARY' ? 'BANK' : 'SAVINGS',
      accountInstitution: h.institution,
      totalSpent: 4850000,
      totalReceived: h.netPay || 21470000,
      categories: [
        { name: 'Food & Dining', color: '#f97316', amount: 850000, count: 6 },
        { name: 'Groceries', color: '#10b981', amount: 1120000, count: 8 },
      ],
    })) as unknown as T;
  }

  if (pathname === '/imports/unified/upload' && method === 'POST') {
    const newReviewId = `imp-staged-${Date.now()}`;
    const targetAcc = state.accounts.find((a) => a.id === body.accountId) || state.accounts[1] || state.accounts[0];
    const staged: DemoState['pendingImports'][0] = {
      id: newReviewId,
      kind: 'STATEMENT',
      status: 'PENDING',
      fileName: 'Sandbox_Uploaded_Statement.pdf',
      institution: targetAcc.institution || 'Axis Bank',
      createdAt: new Date().toISOString(),
      accountId: targetAcc.id,
      accountName: targetAcc.name,
      accountType: targetAcc.type,
      organizationId: null,
      organizationName: null,
      payPeriod: null,
      netPay: null,
      grossEarnings: null,
      grossDeductions: null,
      paidDays: null,
      lopDays: null,
      lineItems: [],
      totalRows: 3,
      newRows: 3,
      duplicateRows: 0,
      conflictRows: 0,
      openingBalance: targetAcc.balance,
      closingBalance: targetAcc.balance - 214000,
      statementStart: new Date(Date.now() - 86400000 * 7).toISOString(),
      statementEnd: new Date().toISOString(),
      rows: [
        {
          id: `row-${Date.now()}-1`,
          postedAt: new Date().toISOString(),
          description: 'UPI/DR/STARBUCKS COFFEE INDIA/sbux@hdfcbank',
          amount: -48000,
          balance: targetAcc.balance - 48000,
          kind: TransactionKind.EXPENSE,
          category: 'Food & Dining',
          status: 'NEW',
        },
        {
          id: `row-${Date.now()}-2`,
          postedAt: new Date(Date.now() - 86400000).toISOString(),
          description: 'UPI/DR/BLINKIT GROCERIES/blinkit@axis',
          amount: -92000,
          balance: targetAcc.balance - 140000,
          kind: TransactionKind.EXPENSE,
          category: 'Groceries',
          status: 'NEW',
        },
        {
          id: `row-${Date.now()}-3`,
          postedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          description: 'UPI/DR/UBER INDIA SYSTEMS/uber@icici',
          amount: -74000,
          balance: targetAcc.balance - 214000,
          kind: TransactionKind.EXPENSE,
          category: 'Transport & Fuel',
          status: 'NEW',
        },
      ],
    };
    state.pendingImports.unshift(staged);
    saveDemoState(state);
    const uiPending = buildPendingImportsForUi(state).find((p) => p.review.id === newReviewId)!;
    return uiPending as unknown as T;
  }

  const importRowPatchMatch = pathname.match(/^\/imports\/([^/]+)\/rows\/([^/]+)$/);
  if (importRowPatchMatch && method === 'PATCH') {
    const impId = decodeURIComponent(importRowPatchMatch[1]);
    const rowId = decodeURIComponent(importRowPatchMatch[2]);
    const pending = state.pendingImports.find((p) => p.id === impId);
    const row = pending?.rows?.find((r) => r.id === rowId);
    if (row) {
      if (body.include !== undefined) {
        row.status = body.include ? 'NEW' : 'EXCLUDED';
      }
      if (body.categoryId) {
        const cat = state.categories.find((c) => c.id === body.categoryId);
        if (cat) row.category = cat.name;
      }
      if (body.descriptionRaw) row.description = body.descriptionRaw;
      saveDemoState(state);
    }
    const uiPending = buildPendingImportsForUi(state).find((p) => p.review.id === impId);
    return { review: uiPending?.review } as unknown as T;
  }

  const importActionMatch = pathname.match(/^\/imports\/([^/]+)(?:\/(commit))?$/);
  if (importActionMatch) {
    const impId = decodeURIComponent(importActionMatch[1]);
    const isCommit = importActionMatch[2] === 'commit';
    const pending = state.pendingImports.find((p) => p.id === impId);

    if (method === 'GET' && pending) {
      const uiPending = buildPendingImportsForUi(state).find((p) => p.review.id === impId);
      return uiPending?.review as unknown as T;
    }

    if (isCommit && method === 'POST' && pending) {
      const rowsToCommit = (pending.rows || []).filter((r) => r.status === 'NEW');
      for (const r of rowsToCommit) {
        const catObj = state.categories.find((c) => c.name === r.category);
        state.transactions.unshift({
          id: `tx-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          accountId: pending.accountId || 'acc-axis-savings',
          postedAt: r.postedAt,
          description: r.description,
          merchant: r.description.slice(0, 22),
          category: r.category,
          categoryId: catObj?.id || null,
          categoryVerified: true,
          amount: r.amount,
          balance: r.balance,
          kind: r.kind,
          tagIds: [],
        });
      }
      state.pendingImports = state.pendingImports.filter((p) => p.id !== impId);
      state.importHistory.unshift({
        id: pending.id,
        kind: pending.kind,
        status: 'COMMITTED',
        fileName: pending.fileName,
        institution: pending.institution,
        createdAt: pending.createdAt,
        committedAt: new Date().toISOString(),
        accountId: pending.accountId,
        accountName: pending.accountName,
        organizationId: pending.organizationId,
        organizationName: pending.organizationName,
        payPeriod: pending.payPeriod,
        netPay: pending.netPay,
        totalRows: pending.totalRows,
        newRows: rowsToCommit.length,
        duplicateRows: pending.duplicateRows,
        conflictRows: pending.conflictRows,
      });
      recomputeAccountBalances(state);
      saveDemoState(state);
      return { committedCount: rowsToCommit.length } as unknown as T;
    }

    if (method === 'DELETE' && pending) {
      state.pendingImports = state.pendingImports.filter((p) => p.id !== impId);
      saveDemoState(state);
      return undefined as unknown as T;
    }
  }

  // Email Ingestion
  if (pathname === '/email-ingestion/google/config' && method === 'GET') {
    return {
      configured: true,
      connected: state.emailAccounts.length > 0,
      email: state.emailAccounts[0]?.email || state.user.email,
      accounts: state.emailAccounts,
      connectedAccounts: state.emailAccounts,
    } as unknown as T;
  }
  if (pathname === '/email-ingestion/logs' && method === 'GET') {
    return state.emailLogs.map((l) => ({
      ...l,
      createdAt: l.processedAt,
      alertsParsed: l.status === 'IMPORTED' ? 1 : 0,
      sourceSnippet: l.subject,
    })) as unknown as T;
  }
  if (pathname === '/email-ingestion/google/sync' && method === 'POST') {
    const nowIso = new Date().toISOString();
    state.emailAccounts.forEach((a) => {
      a.lastSyncedAt = nowIso;
    });
    saveDemoState(state);
    return {
      message: 'Scanned 14 recent bank & card emails in Guest Sandbox (all alerts reconciled).',
      accountsProcessed: state.emailAccounts.length,
      messagesScanned: 14,
      transactionsCreated: 2,
      skipped: 12,
      failed: 0,
    } as unknown as T;
  }
  if (pathname.startsWith('/email-ingestion/google/disconnect') && method === 'DELETE') {
    state.emailAccounts = [];
    saveDemoState(state);
    return { message: 'Disconnected Google Account in Guest Sandbox.' } as unknown as T;
  }

  // 12. Backup & Google Drive
  if (pathname === '/backup/drive/config' && method === 'GET') {
    return {
      connected: state.driveConfig.connected,
      email: state.driveConfig.email,
      autoBackupEnabled: state.driveConfig.backupFrequency !== 'MANUAL',
      hasAutoPassphrase: true,
      lastBackupAt: state.driveConfig.lastBackupAt,
      lastBackupStatus: 'SUCCESS',
      lastBackupError: null,
    } as unknown as T;
  }
  if (pathname === '/backup/drive/revisions' && method === 'GET') {
    return [
      {
        id: 'rev-demo-1',
        modifiedTime: state.driveConfig.lastBackupAt || new Date().toISOString(),
        size: 418290,
        keepForever: true,
      },
      {
        id: 'rev-demo-2',
        modifiedTime: new Date(Date.now() - 86400000 * 7).toISOString(),
        size: 392100,
        keepForever: false,
      },
    ] as unknown as T;
  }
  if (pathname === '/backup/drive/settings' && method === 'PUT') {
    state.driveConfig.backupFrequency = body.autoBackupEnabled ? 'WEEKLY' : 'MANUAL';
    saveDemoState(state);
    return { ok: true } as unknown as T;
  }
  if (pathname === '/backup/drive/sync' && method === 'POST') {
    state.driveConfig.lastBackupAt = new Date().toISOString();
    saveDemoState(state);
    return { fileId: 'rev-demo-latest', modifiedTime: state.driveConfig.lastBackupAt } as unknown as T;
  }
  if (pathname === '/backup/drive/disconnect' && method === 'DELETE') {
    state.driveConfig.connected = false;
    saveDemoState(state);
    return { ok: true } as unknown as T;
  }
  if ((pathname === '/backup/drive/restore' || pathname === '/backup/restore') && method === 'POST') {
    return {
      accountsRestored: state.accounts.length,
      transactionsRestored: state.transactions.length,
      categoriesRestored: state.categories.length,
      documentsRestored: 3,
      salariesRestored: state.salaryStatements.length,
      organizationsRestored: state.organizations.length,
      holdingsRestored: state.holdings.length,
      filesRestored: 3,
    } as unknown as T;
  }

  return {} as unknown as T;
}
