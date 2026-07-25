'use client';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  WalletCards,
  TrendingUp,
  SlidersHorizontal,
  RefreshCw,
  Send,
  Building2,
  PieChart,
  Check,
  Trash2,
  Plus,
  Search,
  RotateCcw,
  X,
  Filter,
  Sparkles,
  Target,
  Tag,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { Shell } from '@/components/shell';
import { SpendRulesModal } from '@/components/spend-rules-modal';
import { CategoryBudgetsModal } from '@/components/category-budgets-modal';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';

type Account = { id: string; name: string; type: string; balance: number; creditLimit: number | null; dueDay: number | null };
type Owner = { id: string; name: string; email: string };
type Category = { id: string; name: string; color: string };
type CategoryRule = {
  id: string;
  pattern: string;
  matchField: 'DESCRIPTION' | 'MERCHANT' | 'REFERENCE';
  matchType: 'CONTAINS' | 'EXACT' | 'STARTS_WITH' | 'REGEX';
  priority: number;
  category: { id: string; name: string; color: string };
};

type TransferSuggestion = {
  debit: { id: string; account: string; amount: number; date: string; description: string };
  credit: { id: string; account: string; amount: number; date: string; description: string };
};

type AccountFlow = {
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    institution: string | null;
    externalInbound: number;
    externalOutbound: number;
    investments?: number;
    internalInbound: number;
    internalOutbound: number;
    totalInbound: number;
    totalOutbound: number;
  }>;
  internalTransfers: Array<{
    fromAccountId: string;
    fromAccountName: string;
    toAccountId: string;
    toAccountName: string;
    amount: number;
  }>;
  overall: {
    totalExternalInbound: number;
    totalExternalOutbound: number;
    totalInvestments?: number;
    totalInternalTransfers: number;
  };
};

type Dashboard = {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  savingsNetInbound?: number;
  savingsNetOutbound?: number;
  accountFlow?: AccountFlow;
  netWorth: number;
  accounts: Account[];
  spendAnalysis?: {
    consumption: number;
    outboundTransfers: number;
    investments: number;
  };
  topOutboundRecipients?: Array<{ name: string; amount: number; count: number }>;
  categories: { name: string; color: string; amount: number }[];
  recent: { id: string; date: string; description: string; amount: number; category: string; account: string; isTransfer: boolean }[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard>();
  const [owner, setOwner] = useState<Owner>();
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showTransfersModal, setShowTransfersModal] = useState(false);
  const [showBudgetsModal, setShowBudgetsModal] = useState(false);
  const [budgetRefreshTrigger, setBudgetRefreshTrigger] = useState(0);
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [overview, profile] = await Promise.all([
        api<Dashboard>(`/dashboard?month=${encodeURIComponent(selectedMonth)}`),
        api<Owner>('/auth/me'),
      ]);
      setData(overview);
      setOwner(profile);
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load your overview.'));
    }
  }, [router, selectedMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReconcileTransfers = async () => {
    setReconciling(true);
    try {
      const res = await api<{ matchedPairsCount: number }>('/transfers/reconcile', { method: 'POST' });
      await load();
      alert(`Transfer Matching Engine finished: linked ${res.matchedPairsCount} new internal transfer pair(s).`);
    } catch (err) {
      alert(errorMessage(err, 'Failed to reconcile transfers.'));
    } finally {
      setReconciling(false);
    }
  };

  if (!data)
    return (
      <Shell>
        <div className="loading">
          <span />
          <p>Loading your dashboard…</p>
        </div>
      </Shell>
    );

  const totalSpend = data.categories.reduce((sum, category) => sum + category.amount, 0);
  const monthLabel = new Date(`${data.month}-02T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  let angle = 0;
  const gradient = data.categories.length
    ? data.categories
        .map((category) => {
          const start = angle;
          angle += totalSpend ? (category.amount / totalSpend) * 360 : 0;
          return `${category.color} ${start}deg ${angle}deg`;
        })
        .join(',')
    : '#e2e8f0 0deg 360deg';

  const assetCategories = [
    { name: 'Savings Accounts', types: ['BANK', 'SAVINGS'], color: '#3b82f6' },
    { name: 'Fixed Deposits', types: ['FIXED_DEPOSIT'], color: '#0ea5e9' },
    { name: 'Investments', types: ['STOCKS', 'INVESTMENT'], color: '#10b981' },
    { name: 'EPFO', types: ['EPFO'], color: '#f59e0b' },
  ];

  const assetData = assetCategories
    .map((cat) => {
      const value = data.accounts.filter((a) => cat.types.includes(a.type) && a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
      return { ...cat, value };
    })
    .filter((c) => c.value > 0);

  const totalAssets = assetData.reduce((sum, c) => sum + c.value, 0);
  let assetAngle = 0;
  const assetGradient = assetData.length
    ? assetData
        .map((category) => {
          const start = assetAngle;
          assetAngle += totalAssets ? (category.value / totalAssets) * 360 : 0;
          return `${category.color} ${start}deg ${assetAngle}deg`;
        })
        .join(',')
    : '#e2e8f0 0deg 360deg';

  return (
    <Shell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Financial home</span>
          <h1>Good to see you{owner?.name ? `, ${owner.name.trim().split(/\s+/)[0]}` : ''}.</h1>
          <p>Here’s how your money moved in {monthLabel}.</p>
        </div>
        <div className="dashboard-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button type="button" className="secondary compact" onClick={handleReconcileTransfers} disabled={reconciling}>
            <RefreshCw size={14} className={reconciling ? 'spin' : ''} />
            {reconciling ? 'Matching…' : 'Match Transfers'}
          </button>
          <label className="month-control">
            <CalendarDays />
            <input
              aria-label="Dashboard month"
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                if (event.target.value) setSelectedMonth(event.target.value);
              }}
            />
          </label>
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="hero-card">
        <div>
          <span>Monthly Cash Flow</span>
          <strong>{money(data.savings)}</strong>
          <small>
            <TrendingUp size={15} />
            {data.savings >= 0 ? 'Net Surplus' : 'Net Deficit'} in {monthLabel}
          </small>
        </div>
        <div className="hero-orbit">
          <span>{data.savingsRate}%</span>
          <small>savings rate</small>
        </div>
      </section>

      <section className="summary-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <article>
          <span className="summary-icon income">
            <ArrowUpRight />
          </span>
          <div>
            <small>Savings Net Inbound</small>
            <strong>{money(data.savingsNetInbound ?? data.income)}</strong>
            <em>Excl. internal transfers</em>
          </div>
        </article>
        <article>
          <span className="summary-icon expense">
            <ArrowDownRight />
          </span>
          <div>
            <small>Savings Net Outbound</small>
            <strong>{money(data.savingsNetOutbound ?? data.expenses)}</strong>
            <em>Excl. internal transfers</em>
          </div>
        </article>
        <article>
          <span className="summary-icon income">
            <TrendingUp />
          </span>
          <div>
            <small>Total Income</small>
            <strong>{money(data.income)}</strong>
            <em>{monthLabel}</em>
          </div>
        </article>
        <article>
          <span className="summary-icon saved">
            <WalletCards />
          </span>
          <div>
            <small>Saved</small>
            <strong>{money(data.savings)}</strong>
            <em>{data.savingsRate}% of income</em>
          </div>
        </article>
      </section>

      {/* Spend Analyser Breakdown Bar */}
      {data.spendAnalysis && (
        <section className="panel" style={{ marginBottom: '24px', padding: '20px' }}>
          <div className="panel-title" style={{ marginBottom: '16px' }}>
            <div>
              <span className="eyebrow">Spend Analyser</span>
              <h2>Money Movement Classification</h2>
            </div>
            <button type="button" className="secondary compact" onClick={() => setShowTransfersModal(true)}>
              View Transfer Matching Candidates
            </button>
          </div>
          <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <div style={{ background: 'var(--background-alt)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PieChart size={14} color="#ef4444" /> Direct Consumption
              </small>
              <strong style={{ display: 'block', fontSize: '20px', margin: '4px 0', fontFamily: 'var(--font-manrope)' }}>
                {money(data.spendAnalysis.consumption)}
              </strong>
              <em style={{ fontSize: '10px', color: 'var(--muted)', fontStyle: 'normal' }}>Dining, bills, shopping & retail</em>
            </div>
            <div style={{ background: 'var(--background-alt)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Send size={14} color="#f59e0b" /> External Outbound Transfers
              </small>
              <strong style={{ display: 'block', fontSize: '20px', margin: '4px 0', fontFamily: 'var(--font-manrope)' }}>
                {money(data.spendAnalysis.outboundTransfers)}
              </strong>
              <em style={{ fontSize: '10px', color: 'var(--muted)', fontStyle: 'normal' }}>UPI & NEFT transfers to individuals</em>
            </div>
            <div style={{ background: 'var(--background-alt)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={14} color="#10b981" /> Mutual Funds & Investments
              </small>
              <strong style={{ display: 'block', fontSize: '20px', margin: '4px 0', fontFamily: 'var(--font-manrope)' }}>
                {money(data.spendAnalysis.investments)}
              </strong>
              <em style={{ fontSize: '10px', color: 'var(--muted)', fontStyle: 'normal' }}>SIPs, broker deposits & EPFO</em>
            </div>
          </div>

          {data.topOutboundRecipients && data.topOutboundRecipients.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
              <span className="eyebrow" style={{ fontSize: '10px' }}>
                Top External Recipients (P2P / Outbound)
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                {data.topOutboundRecipients.map((rec) => (
                  <div
                    key={rec.name}
                    style={{
                      background: 'var(--background)',
                      border: '1px solid var(--line)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <strong>{rec.name}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                      {money(rec.amount)} ({rec.count} txn{rec.count === 1 ? '' : 's'})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
        <article className="panel spending-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Spending</span>
              <h2>Where it went in {monthLabel}</h2>
            </div>
            <span className="month-pill">
              <CalendarDays size={14} />
              {monthLabel}
            </span>
          </div>
          {data.categories.length ? (
            <div className="spending-body">
              <div className="donut" style={{ background: `conic-gradient(${gradient})` }}>
                <div>
                  <strong>{money(data.expenses, true)}</strong>
                  <span>total</span>
                </div>
              </div>
              <div className="legend">
                {data.categories.slice(0, 8).map((category) => (
                  <div key={category.name}>
                    <i style={{ background: category.color }} />
                    <span>{category.name}</span>
                    <strong>{money(category.amount)}</strong>
                    <small>{totalSpend ? Math.round((category.amount / totalSpend) * 100) : 0}%</small>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty text="Import a statement to see your spending pattern." />
          )}
        </article>
      </section>

      <section className="panel monthly-flow-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Cash Flow</span>
            <h2>Savings Accounts Cash Flow & Transfers</h2>
          </div>
        </div>
        <CategoryBudgetsWidget refreshTrigger={budgetRefreshTrigger} onManage={() => setShowBudgetsModal(true)} />

        <MonthlyFlow
          income={data.income}
          expenses={data.expenses}
          savings={data.savings}
          accountFlow={data.accountFlow}
        />
      </section>

      <GlobalTransactionExplorer />

      {/* Category Rules Modal */}
      {showRulesModal && <CategoryRulesModal onClose={() => setShowRulesModal(false)} onUpdate={() => void load()} />}

      {/* Category Budgets Modal */}
      {showBudgetsModal && (
        <CategoryBudgetsModal
          onClose={() => setShowBudgetsModal(false)}
          onBudgetsUpdated={() => setBudgetRefreshTrigger((prev) => prev + 1)}
        />
      )}

      {/* Transfer Matching Candidate Modal */}
      {showTransfersModal && <TransferReconcilerModal onClose={() => setShowTransfersModal(false)} onUpdate={() => void load()} />}
    </Shell>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <span>◎</span>
      <p>{text}</p>
    </div>
  );
}

function GlobalTransactionExplorer() {
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [selectedCategoryFilterId, setSelectedCategoryFilterId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showCategoryEdit, setShowCategoryEdit] = useState(false);

  // Spend Rules & Batch Categorization states
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [ruleInitialPattern, setRuleInitialPattern] = useState('');
  const [ruleInitialCategoryId, setRuleInitialCategoryId] = useState('');
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [batchUpdating, setBatchUpdating] = useState(false);

  const [data, setData] = useState<{
    transactions: {
      id: string;
      accountId: string;
      accountName: string;
      accountType: string;
      transactionDate: string;
      description: string;
      details: string | null;
      amount: number;
      categoryId?: string | null;
      category: string;
      isTransfer: boolean;
    }[];
    categories?: { id: string; name: string; color: string }[];
    totalAmount: number;
    pagination: { page: number; pageSize: number; total: number; pages: number };
  }>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ id: string; name: string; type: string }[]>('/accounts')
      .then((res) => setAccounts((res || []).filter((a) => a.type === 'SAVINGS' || a.type === 'BANK')))
      .catch(() => {});
  }, []);

  const fetchTransactions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '20');
    if (selectedAccountId !== 'all') params.set('accountId', selectedAccountId);
    if (selectedCategoryFilterId !== 'all') params.set('categoryId', selectedCategoryFilterId);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (minAmount.trim()) params.set('minAmount', minAmount.trim());
    if (maxAmount.trim()) params.set('maxAmount', maxAmount.trim());
    if (typeFilter !== 'ALL') params.set('type', typeFilter);
    if (startDate.trim()) params.set('startDate', startDate.trim());
    if (endDate.trim()) params.set('endDate', endDate.trim());

    api<any>(`/accounts/all-transactions?${params.toString()}`)
      .then((res) => {
        if (res && res.transactions) {
          const savingsOnlyTxns = res.transactions.filter(
            (t: any) => t.accountType === 'SAVINGS' || t.accountType === 'BANK',
          );
          setData({
            ...res,
            transactions: savingsOnlyTxns,
          });
        } else {
          setData(res);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, selectedAccountId, selectedCategoryFilterId, searchQuery, minAmount, maxAmount, typeFilter, startDate, endDate]);

  const handleUpdateCategory = async (accountId: string, transactionId: string, categoryId: string) => {
    try {
      await api(`/accounts/${accountId}/transactions/${transactionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ categoryId: categoryId || null }),
      });
      fetchTransactions();
    } catch (reason) {
      alert(errorMessage(reason, 'Could not update category.'));
    }
  };

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (!data?.transactions) return;
    if (selectedTxIds.length === data.transactions.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(data.transactions.map((t) => t.id));
    }
  };

  const handleBatchUpdateCategory = async (categoryId: string) => {
    if (selectedTxIds.length === 0) return;
    setBatchUpdating(true);
    try {
      await api('/categories/batch-update', {
        method: 'POST',
        body: JSON.stringify({
          transactionIds: selectedTxIds,
          categoryId: categoryId || null,
        }),
      }).catch(() =>
        api('/category-rules/batch-update', {
          method: 'POST',
          body: JSON.stringify({
            transactionIds: selectedTxIds,
            categoryId: categoryId || null,
          }),
        }),
      );
      setSelectedTxIds([]);
      fetchTransactions();
    } catch (reason) {
      alert(errorMessage(reason, 'Could not bulk update categories.'));
    } finally {
      setBatchUpdating(false);
    }
  };

  const handleCreateRuleFromSelection = () => {
    if (selectedTxIds.length === 0 || !data?.transactions) return;
    const firstTx = data.transactions.find((t) => selectedTxIds.includes(t.id));
    if (firstTx) {
      const cleanKeyword = firstTx.description.split('/')[0].split('-')[0].trim();
      setRuleInitialPattern(cleanKeyword || firstTx.description);
      setRuleInitialCategoryId(firstTx.categoryId || '');
      setShowRulesModal(true);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const activeFilterCount = (selectedAccountId !== 'all' ? 1 : 0) +
    (selectedCategoryFilterId !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0) +
    (typeFilter !== 'ALL' ? 1 : 0);

  return (
    <section className="panel transactions">
      <div className="panel-title" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div>
          <span className="eyebrow">Full history</span>
          <h2>Transactions</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {data && data.pagination.total > 0 && (
            <span className="month-pill">
              {(data.pagination.page - 1) * data.pagination.pageSize + 1}–{Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} of {data.pagination.total}
            </span>
          )}
          <button
            type="button"
            className={`secondary compact ${showCategoryEdit ? 'active' : ''}`}
            onClick={() => {
              setShowCategoryEdit(!showCategoryEdit);
              if (showCategoryEdit) setSelectedTxIds([]);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Tag size={14} color="var(--green)" />
            {showCategoryEdit ? 'Done Categorising' : 'Categorise'}
          </button>
          <button
            type="button"
            className="secondary compact"
            onClick={() => {
              setRuleInitialPattern('');
              setRuleInitialCategoryId('');
              setShowRulesModal(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <SlidersHorizontal size={14} color="var(--green)" />
            Category Rules
          </button>
          <button
            type="button"
            className={`secondary compact ${showFilters || activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Filter size={14} />
            {showFilters ? 'Hide Filters' : 'Filter Ledger'}
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>
      </div>

      {/* Redesigned Toggleable Search & Filter Control Center */}
      {(showFilters || activeFilterCount > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '0 0 20px 0', padding: '16px', background: 'var(--background-alt)', borderRadius: '14px', border: '1px solid var(--line)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          {/* Top Row: Account Select & Category Select & Search & Type Toggle & Reset */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Account Dropdown */}
            <div style={{ flex: '1 1 160px', minWidth: '150px' }}>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  fontSize: '13px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--background)',
                  color: 'var(--ink)',
                  fontWeight: 600,
                }}
              >
                <option value="all">All Bank Accounts</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter Dropdown */}
            <div style={{ flex: '1 1 160px', minWidth: '150px' }}>
              <select
                value={selectedCategoryFilterId}
                onChange={(e) => {
                  setSelectedCategoryFilterId(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  fontSize: '13px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--background)',
                  color: 'var(--ink)',
                  fontWeight: 600,
                }}
              >
                <option value="all">All Categories</option>
                <option value="uncategorised">Uncategorised</option>
                <option value="transfers">Internal Transfers</option>
                {(data?.categories || []).map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Bar */}
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
              <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search description or merchant..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  fontSize: '13px',
                  paddingLeft: '36px',
                  paddingRight: searchQuery ? '32px' : '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--background)',
                  color: 'var(--ink)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Type Filter Segmented Controls */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--background)', padding: '3px', borderRadius: '8px', border: '1px solid var(--line)' }}>
              <button
                type="button"
                className={`secondary compact ${typeFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => {
                  setTypeFilter('ALL');
                  setPage(1);
                }}
                style={{ height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px' }}
              >
                All
              </button>
              <button
                type="button"
                className={`secondary compact ${typeFilter === 'EXPENSE' ? 'active' : ''}`}
                onClick={() => {
                  setTypeFilter('EXPENSE');
                  setPage(1);
                }}
                style={{ height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px', color: typeFilter === 'EXPENSE' ? '#ef4444' : undefined }}
              >
                Debits
              </button>
              <button
                type="button"
                className={`secondary compact ${typeFilter === 'INCOME' ? 'active' : ''}`}
                onClick={() => {
                  setTypeFilter('INCOME');
                  setPage(1);
                }}
                style={{ height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px', color: typeFilter === 'INCOME' ? '#10b981' : undefined }}
              >
                Credits
              </button>
            </div>

            {/* Reset Filters Chip */}
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="ghost compact"
                onClick={() => {
                  setSelectedAccountId('all');
                  setSelectedCategoryFilterId('all');
                  setSearchQuery('');
                  setMinAmount('');
                  setMaxAmount('');
                  setStartDate('');
                  setEndDate('');
                  setTypeFilter('ALL');
                  setPage(1);
                }}
                style={{ height: '38px', fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                <RotateCcw size={14} /> Reset ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Bottom Grid: Date Range Card & Amount Range Card */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {/* 📅 Date Range Card */}
            <div style={{ background: 'var(--background)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date Range</span>
                {(startDate || endDate) && <small style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600 }}>Filter active</small>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPage(1);
                    }}
                    style={{ width: '100%', height: '34px', fontSize: '12px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                    style={{ width: '100%', height: '34px', fontSize: '12px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
                  />
                </div>
              </div>
              {/* Presets */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { const now = new Date(); const y = now.getUTCFullYear(); const m = String(now.getUTCMonth() + 1).padStart(2, '0'); setStartDate(`${y}-${m}-01`); setEndDate(''); setPage(1); }}>This Month</button>
                <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { const now = new Date(); let y = now.getUTCFullYear(); let m = now.getUTCMonth(); if (m === 0) { m = 12; y -= 1; } const mStr = String(m).padStart(2, '0'); setStartDate(`${y}-${mStr}-01`); setEndDate(`${y}-${mStr}-31`); setPage(1); }}>Last Month</button>
                <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { const now = new Date(); const today = now.toISOString().split('T')[0]; const d = new Date(now); d.setMonth(d.getMonth() - 6); setStartDate(d.toISOString().split('T')[0]); setEndDate(today); setPage(1); }}>Last 6 Months</button>
                <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { const now = new Date(); const y = now.getUTCFullYear(); const startYr = now.getUTCMonth() >= 3 ? y : y - 1; setStartDate(`${startYr}-04-01`); setEndDate(`${startYr + 1}-03-31`); setPage(1); }}>This FY</button>
                <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { const now = new Date(); const y = now.getUTCFullYear(); const currentStart = now.getUTCMonth() >= 3 ? y : y - 1; const prevStart = currentStart - 1; setStartDate(`${prevStart}-04-01`); setEndDate(`${currentStart}-03-31`); setPage(1); }}>Previous FY</button>
              </div>
            </div>

            {/* 💰 Amount Range Card */}
            <div style={{ background: 'var(--background)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount Range (₹)</span>
                {(minAmount || maxAmount) && <small style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600 }}>Filter active</small>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>Min ₹</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={minAmount}
                    onChange={(e) => {
                      setMinAmount(e.target.value);
                      setPage(1);
                    }}
                    style={{ width: '100%', height: '34px', fontSize: '12px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>Max ₹</label>
                  <input
                    type="number"
                    placeholder="No max"
                    value={maxAmount}
                    onChange={(e) => {
                      setMaxAmount(e.target.value);
                      setPage(1);
                    }}
                    style={{ width: '100%', height: '34px', fontSize: '12px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
                  />
                </div>
              </div>
              {/* Presets */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { setMinAmount('0'); setMaxAmount('1000'); setPage(1); }}>&lt; ₹1k</button>
                <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { setMinAmount('1000'); setMaxAmount('10000'); setPage(1); }}>₹1k – ₹10k</button>
                <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { setMinAmount('10000'); setMaxAmount('50000'); setPage(1); }}>₹10k – ₹50k</button>
                <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { setMinAmount('50000'); setMaxAmount(''); setPage(1); }}>&gt; ₹50k</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading" style={{ padding: '24px 0' }}>
          <span />
          <p>Filtering transactions…</p>
        </div>
      ) : data?.transactions.length ? (
        <>
          <div className={`account-transaction-table ${showCategoryEdit ? 'has-checkboxes' : ''}`}>
            <header>
              {showCategoryEdit && (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(data?.transactions.length && selectedTxIds.length === data.transactions.length)}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                </span>
              )}
              <span>Date</span>
              <span>Description</span>
              <span>Category</span>
              <span style={{ textAlign: 'right' }}>Amount</span>
            </header>
            {data.transactions.map((item) => (
              <article key={item.id} className="transaction-row">
                {showCategoryEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedTxIds.includes(item.id)}
                      onChange={() => toggleSelectTx(item.id)}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                  </div>
                )}
                <time className="transaction-time-cell">
                  <span className="date-text">{new Date(item.transactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}</span>
                  <span className="time-text">{new Date(item.transactionDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })}</span>
                </time>
                <div className="transaction-description-cell">
                  <strong>{item.description}</strong>
                  <small>{item.accountName}{item.details ? ` · ${item.details}` : ''}</small>
                </div>
                <div className="transaction-category-cell">
                  {item.isTransfer ? (
                    <span className="category-pill transfer">Transfer</span>
                  ) : (
                    <select
                      className="category-pill-select"
                      value={item.categoryId ?? ''}
                      onChange={(e) => void handleUpdateCategory(item.accountId, item.id, e.target.value)}
                      title="Click to change category"
                      style={{
                        display: 'inline-block',
                        width: 'auto',
                        maxWidth: '160px',
                        background: item.categoryId ? 'var(--theme-soft-start)' : 'var(--background-alt)',
                        border: '1px solid var(--line)',
                        borderRadius: '8px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: item.categoryId ? 'var(--green)' : 'var(--muted)',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="">Uncategorised</option>
                      {(data.categories || []).map((cat: any) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <b className={`transaction-amount-cell ${item.amount > 0 ? 'positive' : 'negative'}`}>
                  {item.amount > 0 ? '+' : ''}{money(item.amount)}
                </b>
              </article>
            ))}
          </div>

          {selectedTxIds.length > 0 && (
            <div
              style={{
                position: 'fixed',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9999,
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '16px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                {selectedTxIds.length} transaction{selectedTxIds.length === 1 ? '' : 's'} selected
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  disabled={batchUpdating}
                  onChange={(e) => void handleBatchUpdateCategory(e.target.value)}
                  defaultValue=""
                  style={{
                    height: '34px',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--background)',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>Set Category for All...</option>
                  <option value="">Uncategorised</option>
                  {(data?.categories || []).map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="secondary compact"
                  onClick={handleCreateRuleFromSelection}
                  style={{ height: '34px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sparkles size={14} color="var(--green)" /> Create Rule
                </button>

                <button
                  type="button"
                  className="ghost compact"
                  onClick={() => setSelectedTxIds([])}
                  style={{ height: '34px', fontSize: '12px', color: 'var(--muted)' }}
                >
                  Deselect
                </button>
              </div>
            </div>
          )}

          {data.pagination.pages > 1 && (
            <footer className="ledger-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="secondary compact"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ArrowLeft size={14} /> Previous
              </button>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Page {page} of {data.pagination.pages}
              </span>
              <button
                type="button"
                className="secondary compact"
                disabled={page >= data.pagination.pages}
                onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
              >
                Next <ArrowRight size={14} />
              </button>
            </footer>
          )}
        </>
      ) : (
        <Empty text="No transactions match the selected amount range or filters." />
      )}

      {showRulesModal && (
        <SpendRulesModal
          onClose={() => setShowRulesModal(false)}
          onRulesApplied={() => fetchTransactions()}
          initialPattern={ruleInitialPattern}
          initialCategoryId={ruleInitialCategoryId}
        />
      )}
    </section>
  );
}

function CategoryRulesModal({ onClose, onUpdate }: { onClose: () => void; onUpdate: () => void }) {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [matchField, setMatchField] = useState<'DESCRIPTION' | 'MERCHANT' | 'REFERENCE'>('DESCRIPTION');
  const [matchType, setMatchType] = useState<'CONTAINS' | 'EXACT' | 'STARTS_WITH' | 'REGEX'>('CONTAINS');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([api<CategoryRule[]>('/category-rules'), api<Category[]>('/categories')]);
      setRules(r);
      setCategories(c);
      if (c.length > 0 && !categoryId) setCategoryId(c[0].id);
    } catch (err) {
      setError(errorMessage(err, 'Could not load rules.'));
    }
  }, [categoryId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern || !categoryId) return;
    setBusy(true);
    setError('');
    try {
      await api('/category-rules', {
        method: 'POST',
        body: JSON.stringify({ pattern, categoryId, matchField, matchType }),
      });
      setPattern('');
      await loadData();
      onUpdate();
    } catch (err) {
      setError(errorMessage(err, 'Failed to create rule.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api(`/category-rules/${id}`, { method: 'DELETE' });
      await loadData();
      onUpdate();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete rule.'));
    }
  };

  const handleApplyRetroactive = async () => {
    setBusy(true);
    try {
      const res = await api<{ updatedCount: number }>('/category-rules/apply', { method: 'POST' });
      alert(`Applied rules to past transactions: updated ${res.updatedCount} transaction(s).`);
      onUpdate();
    } catch (err) {
      setError(errorMessage(err, 'Failed to apply rules.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-wrap">
      <button className="backdrop" onClick={onClose} aria-label="Close modal" />
      <section className="modal" style={{ maxWidth: '640px', width: '100%' }}>
        <header className="modal-header">
          <h2>Spend Auto-Categorization Rules</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Define rules to automatically categorize transactions based on description or merchant patterns.</p>
        </header>

        {error && <p className="error">{error}</p>}

        <form onSubmit={handleAddRule} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr auto', gap: '10px', margin: '16px 0', alignItems: 'end' }}>
          <label>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>If description/text</span>
            <input
              type="text"
              required
              placeholder="e.g. SWIGGY, ZOMATO"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              style={{ fontSize: '12px', padding: '8px' }}
            />
          </label>
          <label>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Match type</span>
            <select
              value={matchType}
              onChange={(e) => setMatchType(e.target.value as any)}
              style={{ fontSize: '12px', padding: '8px', width: '100%', height: '37px', borderRadius: '6px', border: '1px solid var(--line)' }}
            >
              <option value="CONTAINS">Contains</option>
              <option value="EXACT">Exact</option>
              <option value="STARTS_WITH">Starts with</option>
              <option value="REGEX">Regex</option>
            </select>
          </label>
          <label>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Assign Category</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ fontSize: '12px', padding: '8px', width: '100%', height: '37px', borderRadius: '6px', border: '1px solid var(--line)' }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary" disabled={busy} style={{ height: '37px', padding: '0 14px' }}>
            <Plus size={14} /> Add
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 10px' }}>
          <strong style={{ fontSize: '13px' }}>Active Rules ({rules.length})</strong>
          <button type="button" className="secondary compact" onClick={handleApplyRetroactive} disabled={busy || rules.length === 0}>
            <RefreshCw size={12} /> Apply Rules to Past Transactions
          </button>
        </div>

        <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'grid', gap: '8px' }}>
          {rules.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--background-alt)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            >
              <div>
                <strong>&quot;{r.pattern}&quot;</strong>
                <span style={{ color: 'var(--muted)', marginLeft: '8px', fontSize: '11px' }}>
                  ({r.matchType.toLowerCase()}) →
                </span>
                <span style={{ marginLeft: '6px', fontWeight: 600, color: r.category?.color }}>{r.category?.name}</span>
              </div>
              <button type="button" className="danger compact icon-only" onClick={() => void handleDeleteRule(r.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {rules.length === 0 && <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '16px' }}>No rules created yet.</p>}
        </div>

        <div className="modal-actions" style={{ marginTop: '20px', justifyContent: 'flex-end' }}>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function TransferReconcilerModal({ onClose, onUpdate }: { onClose: () => void; onUpdate: () => void }) {
  const [suggestions, setSuggestions] = useState<TransferSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<TransferSuggestion[]>('/transfers/suggestions');
      setSuggestions(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  const handleLink = async (txId1: string, txId2: string) => {
    setBusyId(txId1);
    try {
      await api('/transfers/link', {
        method: 'POST',
        body: JSON.stringify({ txId1, txId2 }),
      });
      await loadSuggestions();
      onUpdate();
    } catch (err) {
      alert(errorMessage(err, 'Failed to link transfer.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="modal-wrap">
      <button className="backdrop" onClick={onClose} aria-label="Close modal" />
      <section className="modal" style={{ maxWidth: '680px', width: '100%' }}>
        <header className="modal-header">
          <h2>Potential Internal Transfer Candidates</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            These unlinked transactions have matching opposite amounts across different accounts within a close date window.
          </p>
        </header>

        {loading ? (
          <p style={{ padding: '20px', textAlign: 'center', fontSize: '12px' }}>Scanning potential matches…</p>
        ) : (
          <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'grid', gap: '12px', margin: '16px 0' }}>
            {suggestions.map((s) => (
              <div
                key={s.debit.id + s.credit.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr auto',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'var(--background-alt)',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <small style={{ color: '#ef4444', fontWeight: 600, display: 'block' }}>Debit ({s.debit.account})</small>
                  <strong>{money(s.debit.amount)}</strong>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{s.debit.description}</div>
                </div>

                <div style={{ color: 'var(--muted)', fontWeight: 'bold' }}>⟷</div>

                <div>
                  <small style={{ color: '#10b981', fontWeight: 600, display: 'block' }}>Credit ({s.credit.account})</small>
                  <strong>+{money(s.credit.amount)}</strong>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{s.credit.description}</div>
                </div>

                <button
                  type="button"
                  className="primary compact"
                  disabled={busyId === s.debit.id}
                  onClick={() => void handleLink(s.debit.id, s.credit.id)}
                >
                  <Check size={12} /> Confirm Match
                </button>
              </div>
            ))}
            {suggestions.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '24px' }}>
                No unlinked transfer candidates detected right now.
              </p>
            )}
          </div>
        )}

        <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function CategoryBudgetsWidget({ refreshTrigger, onManage }: { refreshTrigger: number; onManage: () => void }) {
  const [data, setData] = useState<{
    summary: { totalBudgeted: number; totalSpent: number; totalRemaining: number; overallPercentage: number };
    budgets: Array<{
      id: string;
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      monthlyLimit: number;
      spentAmount: number;
      remainingAmount: number;
      percentage: number;
      status: 'OK' | 'WARNING' | 'EXCEEDED';
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBudgets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<{
        summary: { totalBudgeted: number; totalSpent: number; totalRemaining: number; overallPercentage: number };
        budgets: any[];
      }>('/budgets');
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets, refreshTrigger]);

  const budgets = data?.budgets || [];
  const summary = data?.summary || { totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, overallPercentage: 0 };

  return (
    <section className="panel" style={{ padding: '20px', marginBottom: '24px' }}>
      <div className="panel-title" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Target size={14} color="#3b82f6" /> Envelope Budget Tracker
          </span>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Category Envelopes & Target Limits</h2>
        </div>
        <button type="button" className="secondary compact" onClick={onManage} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Target size={14} /> Set / Manage Budgets
        </button>
      </div>

      {/* Summary Pills Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '14px 18px', borderRadius: '12px' }}>
          <small style={{ color: '#3b82f6', fontSize: '11px', fontWeight: 600, display: 'block' }}>Total Monthly Budgeted</small>
          <strong style={{ fontSize: '18px' }}>{money(summary.totalBudgeted)}</strong>
        </div>
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '14px 18px', borderRadius: '12px' }}>
          <small style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600, display: 'block' }}>Total Spent ({summary.overallPercentage}%)</small>
          <strong style={{ fontSize: '18px' }}>{money(summary.totalSpent)}</strong>
        </div>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '14px 18px', borderRadius: '12px' }}>
          <small style={{ color: '#10b981', fontSize: '11px', fontWeight: 600, display: 'block' }}>Remaining Safe-to-Spend</small>
          <strong style={{ fontSize: '18px' }}>{money(summary.totalRemaining)}</strong>
        </div>
      </div>

      {/* Envelope Cards Grid */}
      {loading ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
          Loading category budgets...
        </div>
      ) : budgets.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px border-dashed var(--border)' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>No category envelope budgets configured yet.</p>
          <button type="button" className="primary compact" onClick={onManage} style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Create Category Budget
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {budgets.map((b) => {
            const statusColor = b.status === 'EXCEEDED' ? '#ef4444' : b.status === 'WARNING' ? '#f59e0b' : '#10b981';
            return (
              <div
                key={b.id}
                style={{
                  background: 'var(--background-alt)',
                  border: `1px solid ${b.status === 'EXCEEDED' ? 'rgba(239,68,68,0.4)' : 'var(--line)'}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: b.categoryColor || '#3b82f6' }} />
                    <strong style={{ fontSize: '13px' }}>{b.categoryName}</strong>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      background: b.status === 'EXCEEDED' ? 'rgba(239,68,68,0.15)' : b.status === 'WARNING' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                      color: statusColor,
                    }}
                  >
                    {b.status === 'EXCEEDED' ? '🚨 EXCEEDED' : b.status === 'WARNING' ? '⚠️ 80%+' : '🟢 OK'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                  <span>Spent: <strong>{money(b.spentAmount)}</strong></span>
                  <span>Target: <strong>{money(b.monthlyLimit)}</strong></span>
                </div>

                {/* Progress bar */}
                <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, b.percentage)}%`, backgroundColor: statusColor, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MonthlyFlow({
  income,
  expenses,
  savings,
  accountFlow,
}: {
  income: number;
  expenses: number;
  savings: number;
  accountFlow?: AccountFlow;
}) {
  if (!accountFlow || accountFlow.accounts.length === 0) {
    if (income <= 0) return <Empty text="No income found for this month to generate flow." />;
    return <LegacyMonthlyFlow income={income} expenses={expenses} savings={savings} />;
  }

  const { accounts, internalTransfers, overall } = accountFlow;

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Overall Flow Summary Pills */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 16px', borderRadius: '10px', fontSize: '13px' }}>
          <small style={{ color: '#10b981', display: 'block', fontSize: '11px', fontWeight: 600 }}>Overall External Inbound</small>
          <strong style={{ fontSize: '16px' }}>{money(overall.totalExternalInbound)}</strong>
        </div>
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '10px 16px', borderRadius: '10px', fontSize: '13px' }}>
          <small style={{ color: '#3b82f6', display: 'block', fontSize: '11px', fontWeight: 600 }}>Internal Transfers Moved</small>
          <strong style={{ fontSize: '16px' }}>{money(overall.totalInternalTransfers)}</strong>
        </div>
        {overall.totalInvestments !== undefined && overall.totalInvestments > 0 && (
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '10px 16px', borderRadius: '10px', fontSize: '13px' }}>
            <small style={{ color: '#8b5cf6', display: 'block', fontSize: '11px', fontWeight: 600 }}>Mutual Funds & SIP Investments</small>
            <strong style={{ fontSize: '16px' }}>{money(overall.totalInvestments)}</strong>
          </div>
        )}
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 16px', borderRadius: '10px', fontSize: '13px' }}>
          <small style={{ color: '#ef4444', display: 'block', fontSize: '11px', fontWeight: 600 }}>Overall External Outbound</small>
          <strong style={{ fontSize: '16px' }}>{money(overall.totalExternalOutbound)}</strong>
        </div>
      </div>

      {/* Multi-Bank Visual Sankey Diagram */}
      <div style={{ background: 'var(--background-alt)', border: '1px solid var(--line)', borderRadius: '14px', padding: '20px', width: '100%', overflowX: 'auto' }}>
        <span className="eyebrow" style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '12px' }}>
          Multi-Bank Cash Flow & Internal Transfer Sankey Diagram
        </span>
        <MultiBankSankeyDiagram accountFlow={accountFlow} income={income} expenses={expenses} savings={savings} />
      </div>

      {/* Per Savings Account Flow Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`, gap: '16px' }}>
        {accounts.map((acc) => (
          <div
            key={acc.id}
            style={{
              background: 'var(--background-alt)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '16px',
              display: 'grid',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
              <div>
                <strong style={{ fontSize: '14px', display: 'block' }}>{acc.name}</strong>
                {acc.institution && <small style={{ fontSize: '11px', color: 'var(--muted)' }}>{acc.institution}</small>}
              </div>
              <span style={{ fontSize: '10px', background: 'var(--line)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                {acc.type}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: (acc.investments ?? 0) > 0 ? '1fr 1fr 1fr' : '1fr 1fr', gap: '10px', fontSize: '12px' }}>
              <div style={{ background: 'var(--background)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <small style={{ color: '#10b981', display: 'block', fontSize: '10px', fontWeight: 600 }}>Inbound</small>
                <strong style={{ fontSize: '14px', color: '#10b981' }}>+{money(acc.externalInbound)}</strong>
                {acc.internalInbound > 0 && (
                  <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '4px' }}>
                    + {money(acc.internalInbound)} internal
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--background)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <small style={{ color: '#ef4444', display: 'block', fontSize: '10px', fontWeight: 600 }}>Outbound</small>
                <strong style={{ fontSize: '14px', color: '#ef4444' }}>-{money(acc.externalOutbound)}</strong>
                {acc.internalOutbound > 0 && (
                  <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '4px' }}>
                    - {money(acc.internalOutbound)} internal
                  </div>
                )}
              </div>

              {(acc.investments ?? 0) > 0 && (
                <div style={{ background: 'var(--background)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <small style={{ color: '#8b5cf6', display: 'block', fontSize: '10px', fontWeight: 600 }}>Mutual Funds & SIPs</small>
                  <strong style={{ fontSize: '14px', color: '#8b5cf6' }}>{money(acc.investments ?? 0)}</strong>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                    SIP & MF debits
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', paddingTop: '4px' }}>
              <span>Total Inbound: <strong>{money(acc.totalInbound)}</strong></span>
              <span>Total Outbound: <strong>{money(acc.totalOutbound)}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MultiBankSankeyDiagram({
  accountFlow,
  income,
  expenses,
  savings,
}: {
  accountFlow: AccountFlow;
  income: number;
  expenses: number;
  savings: number;
}) {
  const { accounts, internalTransfers, overall } = accountFlow;

  // Consolidate / aggregate internal transfers by (fromAccountId -> toAccountId) pair
  const aggregatedTransfers = useMemo(() => {
    const map = new Map<string, {
      fromAccountId: string;
      toAccountId: string;
      fromAccountName: string;
      toAccountName: string;
      totalAmount: number;
      count: number;
      items: { id?: string; amount: number }[];
    }>();

    for (const it of internalTransfers) {
      const key = `${it.fromAccountId}_${it.toAccountId}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalAmount += it.amount;
        existing.count += 1;
        existing.items.push({ id: (it as any).id, amount: it.amount });
      } else {
        map.set(key, {
          fromAccountId: it.fromAccountId,
          toAccountId: it.toAccountId,
          fromAccountName: it.fromAccountName,
          toAccountName: it.toAccountName,
          totalAmount: it.amount,
          count: 1,
          items: [{ id: (it as any).id, amount: it.amount }],
        });
      }
    }

    return [...map.values()];
  }, [internalTransfers]);

  const [hoveredBankId, setHoveredBankId] = useState<string | null>(null);
  const [hoveredFlow, setHoveredFlow] = useState<{
    title: string;
    amount: string;
    x: number;
    y: number;
    color: string;
  } | null>(null);

  const BANK_COLOR_PALETTE = ['#3b82f6', '#06b6d4', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#6366f1'];
  const getBankColor = (index: number, name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('hdfc')) return '#3b82f6';
    if (lower.includes('sbi')) return '#06b6d4';
    if (lower.includes('axis')) return '#ec4899';
    if (lower.includes('pnb')) return '#f59e0b';
    if (lower.includes('icici')) return '#8b5cf6';
    return BANK_COLOR_PALETTE[index % BANK_COLOR_PALETTE.length];
  };

  const BANK_NODE_GAP = 24;
  const startY = 40;

  // Compute bank node bar heights proportional to each bank's transaction volume
  const bankVolumes = accounts.map((a) => Math.max(a.totalInbound, a.totalOutbound, 1));
  const totalVolumeSum = bankVolumes.reduce((sum, v) => sum + v, 0) || 1;

  const totalMinHeightNeeded = accounts.length * 38 + (accounts.length - 1) * BANK_NODE_GAP;
  const usableH = Math.max(340, totalMinHeightNeeded);
  const availableH = usableH - (accounts.length - 1) * BANK_NODE_GAP;
  const SVG_HEIGHT = usableH + startY * 2;
  const SVG_WIDTH = 1050;

  const leftX = 180;
  const middleX = 525;
  const rightX = 820;
  const nodeW = 18;

  let currentY = startY;
  const bankNodes = accounts.map((acc, idx) => {
    const vol = Math.max(acc.totalInbound, acc.totalOutbound, 1);
    const rawProp = vol / totalVolumeSum;
    const height = Math.max(38, Math.round(availableH * rawProp));
    const color = getBankColor(idx, acc.name);
    const node = {
      ...acc,
      x: middleX,
      y: currentY,
      height,
      color,
    };
    currentY += height + BANK_NODE_GAP;
    return node;
  });

  // Calculate Left Bar Inbound Slices (Proportional height & vertically centered)
  const activeInboundBanks = bankNodes.filter((b) => b.externalInbound > 0);
  const sumInbound = activeInboundBanks.reduce((sum, a) => sum + (a.externalInbound || 0), 0) || 1;

  const inboundSpanH = activeInboundBanks.length === 0 ? 40 : Math.max(40, Math.min(usableH * 0.6, activeInboundBanks.length * 32));
  const inboundNodeStartY = startY + (usableH - inboundSpanH) / 2;
  const inboundNodeH = inboundSpanH;

  let currLeftY = inboundNodeStartY;
  const inboundSlices = bankNodes.map((bank) => {
    if (bank.externalInbound <= 0) return { bank, topY: currLeftY, botY: currLeftY };
    const share = bank.externalInbound / sumInbound;
    const sliceH = Math.max(8, share * inboundSpanH);
    const topY = currLeftY;
    const botY = topY + sliceH;
    currLeftY += sliceH;
    return { bank, topY, botY };
  });

  // Calculate Right Bar Slices: External Outbound vs Mutual Funds & Investments
  const activeOutboundBanks = bankNodes.filter((b) => b.externalOutbound > 0);
  const sumOutbound = activeOutboundBanks.reduce((sum, a) => sum + (a.externalOutbound || 0), 0) || 1;

  const hasInvestments = (overall.totalInvestments || 0) > 0;
  const totalRightSum = (overall.totalExternalOutbound || 0) + (overall.totalInvestments || 0) || 1;

  const outboundSpanH = activeOutboundBanks.length === 0 ? 40 : Math.max(60, Math.min(usableH * 0.65, activeOutboundBanks.length * 36));
  const outboundNodeH = hasInvestments
    ? Math.max(40, Math.round(usableH * 0.6 * ((overall.totalExternalOutbound || 0) / totalRightSum)))
    : outboundSpanH;
  const investmentNodeH = hasInvestments
    ? Math.max(36, Math.round(usableH * 0.25 * ((overall.totalInvestments || 0) / totalRightSum)))
    : 0;

  const outboundRightY = startY + (usableH - (outboundNodeH + (hasInvestments ? investmentNodeH + 20 : 0))) / 2;
  const investmentRightY = outboundRightY + outboundNodeH + 20;

  let currRightY = outboundRightY;
  const outboundSlices = bankNodes.map((bank) => {
    if (bank.externalOutbound <= 0) return { bank, topY: currRightY, botY: currRightY };
    const share = bank.externalOutbound / sumOutbound;
    const sliceH = Math.max(6, share * outboundNodeH);
    const topY = currRightY;
    const botY = topY + sliceH;
    currRightY += sliceH;
    return { bank, topY, botY };
  });

  const activeInvBanks = bankNodes.filter((b) => (b.investments || 0) > 0);
  const sumInvestments = activeInvBanks.reduce((sum, a) => sum + (a.investments || 0), 0) || 1;
  let currInvY = investmentRightY;
  const investmentSlices = bankNodes.map((bank) => {
    if ((bank.investments || 0) <= 0) return { bank, topY: currInvY, botY: currInvY };
    const share = (bank.investments || 0) / sumInvestments;
    const sliceH = Math.max(6, share * investmentNodeH);
    const topY = currInvY;
    const botY = topY + sliceH;
    currInvY += sliceH;
    return { bank, topY, botY };
  });

  const sankeyLink = (x1: number, y1Top: number, y1Bot: number, x2: number, y2Top: number, y2Bot: number) => {
    const cp = (x2 - x1) * 0.45;
    return `
      M ${x1} ${y1Top}
      C ${x1 + cp} ${y1Top}, ${x2 - cp} ${y2Top}, ${x2} ${y2Top}
      L ${x2} ${y2Bot}
      C ${x2 - cp} ${y2Bot}, ${x1 + cp} ${y1Bot}, ${x1} ${y1Bot}
      Z
    `;
  };

  return (
    <div className="beautiful-flow-wrapper" style={{ padding: '0', border: 'none', background: 'transparent', width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="beautiful-flow-svg" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          {bankNodes.map((bank) => (
            <linearGradient key={`grad-in-${bank.id}`} id={`grad-in-${bank.id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor={bank.color} />
            </linearGradient>
          ))}

          {bankNodes.map((bank) => (
            <linearGradient key={`grad-out-${bank.id}`} id={`grad-out-${bank.id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={bank.color} />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          ))}

          {bankNodes.map((bank) => (
            <linearGradient key={`grad-inv-${bank.id}`} id={`grad-inv-${bank.id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={bank.color} />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          ))}
        </defs>

        {/* 1. Inbound Bezier Ribbons from Left Bar to Bank Nodes */}
        {inboundSlices.map(({ bank, topY, botY }) => {
          if (bank.externalInbound <= 0) return null;
          const midX = (leftX + nodeW + bank.x) / 2;
          const midY = (topY + bank.y + 4) / 2;
          const isHighlighted = !hoveredBankId || hoveredBankId === bank.id;
          return (
            <path
              key={`in-${bank.id}`}
              d={sankeyLink(leftX + nodeW, topY, botY, bank.x, bank.y + 2, bank.y + Math.max(6, bank.height * 0.45))}
              fill={`url(#grad-in-${bank.id})`}
              opacity={isHighlighted ? '0.45' : '0.08'}
              style={{ transition: 'opacity 0.2s ease', cursor: 'pointer' }}
              className="sankey-path hover-opacity"
              onMouseEnter={() => {
                setHoveredBankId(bank.id);
                setHoveredFlow({
                  title: `External Inbound ⟶ ${bank.name}`,
                  amount: `+${money(bank.externalInbound)}`,
                  x: midX,
                  y: midY,
                  color: '#10b981',
                });
              }}
              onMouseLeave={() => {
                setHoveredBankId(null);
                setHoveredFlow(null);
              }}
            />
          );
        })}

        {/* 2. Outbound Bezier Ribbons from Bank Nodes to Right Bar */}
        {outboundSlices.map(({ bank, topY, botY }) => {
          if (bank.externalOutbound <= 0) return null;
          const midX = (bank.x + nodeW + rightX) / 2;
          const midY = (bank.y + Math.max(6, bank.height * 0.45) + topY) / 2;
          const isHighlighted = !hoveredBankId || hoveredBankId === bank.id;
          return (
            <path
              key={`out-${bank.id}`}
              d={sankeyLink(bank.x + nodeW, bank.y + Math.max(6, bank.height * 0.45), bank.y + bank.height - 2, rightX, topY, botY)}
              fill={`url(#grad-out-${bank.id})`}
              opacity={isHighlighted ? '0.45' : '0.08'}
              style={{ transition: 'opacity 0.2s ease', cursor: 'pointer' }}
              className="sankey-path hover-opacity"
              onMouseEnter={() => {
                setHoveredBankId(bank.id);
                setHoveredFlow({
                  title: `${bank.name} ⟶ External Outbound`,
                  amount: `-${money(bank.externalOutbound)}`,
                  x: midX,
                  y: midY,
                  color: '#ef4444',
                });
              }}
              onMouseLeave={() => {
                setHoveredBankId(null);
                setHoveredFlow(null);
              }}
            />
          );
        })}

        {/* 2b. Investment Bezier Ribbons from Bank Nodes to Mutual Funds & Investments */}
        {hasInvestments &&
          investmentSlices.map(({ bank, topY, botY }) => {
            if ((bank.investments || 0) <= 0) return null;
            const midX = (bank.x + nodeW + rightX) / 2;
            const midY = (bank.y + Math.max(6, bank.height * 0.45) + topY) / 2;
            const isHighlighted = !hoveredBankId || hoveredBankId === bank.id;
            return (
              <path
                key={`inv-${bank.id}`}
                d={sankeyLink(bank.x + nodeW, bank.y + Math.max(6, bank.height * 0.3), bank.y + bank.height * 0.7, rightX, topY, botY)}
                fill={`url(#grad-inv-${bank.id})`}
                opacity={isHighlighted ? '0.55' : '0.08'}
                style={{ transition: 'opacity 0.2s ease', cursor: 'pointer' }}
                className="sankey-path hover-opacity"
                onMouseEnter={() => {
                  setHoveredBankId(bank.id);
                  setHoveredFlow({
                    title: `${bank.name} ⟶ Mutual Funds & Investments`,
                    amount: `+${money(bank.investments || 0)}`,
                    x: midX,
                    y: midY,
                    color: '#8b5cf6',
                  });
                }}
                onMouseLeave={() => {
                  setHoveredBankId(null);
                  setHoveredFlow(null);
                }}
              />
            );
          })}

        {/* 3. Aggregated Internal Transfer Bezier Flow Bands & Clean Badges */}
        {aggregatedTransfers.map((it, idx) => {
          const fromNode = bankNodes.find((b) => b.id === it.fromAccountId);
          const toNode = bankNodes.find((b) => b.id === it.toAccountId);
          if (!fromNode || !toNode) return null;

          const fromY = fromNode.y + fromNode.height / 2;
          const toY = toNode.y + toNode.height / 2;
          const baseMidY = (fromY + toY) / 2;

          // Stagger multiple aggregated transfer pairs vertically & horizontally (x = 360)
          const verticalShift = (idx - (aggregatedTransfers.length - 1) / 2) * 36;
          const badgeY = baseMidY + verticalShift;
          const curveCpX = middleX - 170 - Math.abs(verticalShift) * 0.8;
          const badgeCenterX = middleX - 165; // Position at x = 360 (open space)

          const transferPath = `
            M ${middleX} ${fromY}
            C ${curveCpX} ${fromY}, ${curveCpX} ${toY}, ${middleX} ${toY}
          `;

          const bandWidth = Math.max(3, Math.min(14, Math.round(it.totalAmount / 10000)));
          const labelText = `${it.fromAccountName.split(' ')[0]} ⟶ ${it.toAccountName.split(' ')[0]}: ${money(it.totalAmount)}${it.count > 1 ? ` (${it.count})` : ''}`;
          const badgeW = Math.max(160, labelText.length * 7.2);
          const isHighlighted = !hoveredBankId || hoveredBankId === fromNode.id || hoveredBankId === toNode.id;

          return (
            <g key={`aggr-it-${idx}`} style={{ transition: 'opacity 0.2s ease', opacity: isHighlighted ? 1 : 0.2 }}>
              <path
                d={transferPath}
                fill="none"
                stroke={fromNode.color}
                strokeWidth={bandWidth}
                strokeDasharray="6,4"
                opacity="0.85"
              />
              <rect
                x={badgeCenterX - badgeW / 2}
                y={badgeY - 13}
                width={badgeW}
                height="26"
                rx="8"
                fill="var(--card)"
                stroke={fromNode.color}
                strokeWidth="1.5"
                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))', cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoveredBankId(fromNode.id);
                  setHoveredFlow({
                    title: `Internal Transfer: ${it.fromAccountName} ⟶ ${it.toAccountName} (${it.count} transaction${it.count === 1 ? '' : 's'})`,
                    amount: money(it.totalAmount),
                    x: badgeCenterX,
                    y: badgeY,
                    color: fromNode.color,
                  });
                }}
                onMouseLeave={() => {
                  setHoveredBankId(null);
                  setHoveredFlow(null);
                }}
              />
              <text
                x={badgeCenterX}
                y={badgeY + 4}
                fill={fromNode.color}
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {labelText}
              </text>
            </g>
          );
        })}

        {/* 4. Node Rectangles & Labels */}
        {/* Left Node: External Inbound (Scaled height & centered) */}
        <rect x={leftX} y={inboundNodeStartY} width={nodeW} height={inboundNodeH} fill="#10b981" rx="4" />
        <text x={leftX - 14} y={inboundNodeStartY + inboundNodeH / 2 - 10} fill="var(--ink)" fontSize="15" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="end">
          External Inbound
        </text>
        <text x={leftX - 14} y={inboundNodeStartY + inboundNodeH / 2 + 12} fill="#10b981" fontSize="13" fontWeight="600" textAnchor="end">
          +{money(overall.totalExternalInbound)}
        </text>

        {/* Middle Nodes: Individual Bank Accounts */}
        {bankNodes.map((bank) => {
          const isHighlighted = !hoveredBankId || hoveredBankId === bank.id;
          return (
            <g
              key={`node-${bank.id}`}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s ease', opacity: isHighlighted ? 1 : 0.3 }}
              onMouseEnter={() => setHoveredBankId(bank.id)}
              onMouseLeave={() => setHoveredBankId(null)}
            >
              <rect
                x={bank.x}
                y={bank.y}
                width={nodeW}
                height={bank.height}
                fill={bank.color}
                rx="4"
                style={{
                  filter: hoveredBankId === bank.id ? `drop-shadow(0 0 10px ${bank.color})` : 'none',
                }}
              />
              <text x={bank.x + nodeW + 12} y={bank.y + Math.min(22, bank.height / 2)} fill="var(--ink)" fontSize="14" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="start">
                {bank.name}
              </text>
              <text x={bank.x + nodeW + 12} y={bank.y + Math.min(38, bank.height / 2 + 16)} fill="var(--muted)" fontSize="11" fontWeight="500" textAnchor="start">
                In: {money(bank.totalInbound)} · Out: {money(bank.totalOutbound)}
              </text>
            </g>
          );
        })}

        {/* Right Node 1: External Outbound */}
        <rect x={rightX} y={outboundRightY} width={nodeW} height={outboundNodeH} fill="#ef4444" rx="4" />
        <text x={rightX + nodeW + 14} y={outboundRightY + outboundNodeH / 2 - 10} fill="var(--ink)" fontSize="15" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="start">
          External Outbound
        </text>
        <text x={rightX + nodeW + 14} y={outboundRightY + outboundNodeH / 2 + 12} fill="#ef4444" fontSize="13" fontWeight="600" textAnchor="start">
          -{money(overall.totalExternalOutbound)}
        </text>

        {/* Right Node 2: Mutual Funds & Investments (if present) */}
        {hasInvestments && (
          <g>
            <rect x={rightX} y={investmentRightY} width={nodeW} height={investmentNodeH} fill="#8b5cf6" rx="4" />
            <text x={rightX + nodeW + 14} y={investmentRightY + investmentNodeH / 2 - 10} fill="var(--ink)" fontSize="14" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="start">
              Mutual Funds & Investments
            </text>
            <text x={rightX + nodeW + 14} y={investmentRightY + investmentNodeH / 2 + 12} fill="#8b5cf6" fontSize="13" fontWeight="600" textAnchor="start">
              +{money(overall.totalInvestments || 0)}
            </text>
          </g>
        )}

        {/* 5. Floating Interactive Hover Tooltip */}
        {hoveredFlow && (
          <g pointerEvents="none">
            <rect
              x={hoveredFlow.x - 140}
              y={hoveredFlow.y - 24}
              width="280"
              height="44"
              rx="8"
              fill="#0f172a"
              stroke={hoveredFlow.color}
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.6))' }}
            />
            <text x={hoveredFlow.x} y={hoveredFlow.y - 6} fill="#f8fafc" fontSize="12" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="middle">
              {hoveredFlow.title}
            </text>
            <text x={hoveredFlow.x} y={hoveredFlow.y + 12} fill={hoveredFlow.color} fontSize="13" fontWeight="800" textAnchor="middle">
              {hoveredFlow.amount}
            </text>
          </g>
        )}
      </svg>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hover-opacity { transition: opacity 0.2s ease-in-out; cursor: pointer; }
        .hover-opacity:hover { opacity: 0.75; }
      `,
        }}
      />
    </div>
  );
}


function LegacyMonthlyFlow({ income, expenses, savings }: { income: number; expenses: number; savings: number }) {
  const expensePct = Math.min(100, Math.max(0, (expenses / income) * 100));
  const savingsPct = Math.max(0, 100 - expensePct);

  const H = 280;
  const gap = 30;
  const startY = 60;
  const nodeW = 16;

  const H_exp = H * (expensePct / 100);
  const H_sav = H * (savingsPct / 100);

  const sankeyLink = (x1: number, y1Top: number, y1Bot: number, x2: number, y2Top: number, y2Bot: number) => {
    const cp = (x2 - x1) * 0.45;
    return `
      M ${x1} ${y1Top}
      C ${x1 + cp} ${y1Top}, ${x2 - cp} ${y2Top}, ${x2} ${y2Top}
      L ${x2} ${y2Bot}
      C ${x2 - cp} ${y2Bot}, ${x1 + cp} ${y1Bot}, ${x1} ${y1Bot}
      Z
    `;
  };

  return (
    <div className="beautiful-flow-wrapper" style={{ padding: '0', border: 'none', background: 'transparent' }}>
      <svg viewBox="0 0 1000 400" className="beautiful-flow-svg" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="sankey-l1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="sankey-l2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="sankey-l3" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        <path d={sankeyLink(165, startY, startY + H, 450, startY, startY + H)} fill="url(#sankey-l1)" opacity="0.25" className="sankey-path hover-opacity" />

        {H_exp > 0 && (
          <path d={sankeyLink(466, startY, startY + H_exp, 750, startY, startY + H_exp)} fill="url(#sankey-l2)" opacity="0.25" className="sankey-path hover-opacity" />
        )}

        {H_sav > 0 && (
          <path
            d={sankeyLink(466, startY + H_exp, startY + H, 750, startY + H_exp + gap, startY + H_exp + gap + H_sav)}
            fill="url(#sankey-l3)"
            opacity="0.25"
            className="sankey-path hover-opacity"
          />
        )}

        <rect x={150} y={startY} width={nodeW} height={H} fill="#3b82f6" rx="4" />
        <rect x={450} y={startY} width={nodeW} height={H} fill="#94a3b8" rx="4" />
        {H_exp > 0 && <rect x={750} y={startY} width={nodeW} height={H_exp} fill="#ef4444" rx="4" />}
        {H_sav > 0 && <rect x={750} y={startY + H_exp + gap} width={nodeW} height={H_sav} fill="#10b981" rx="4" />}

        <text x={135} y={startY + H / 2 - 12} fill="var(--ink)" fontSize="17" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="end">
          Total Income
        </text>
        <text x={135} y={startY + H / 2 + 12} fill="var(--muted)" fontSize="15" fontWeight="500" textAnchor="end">
          {money(income, true)}
        </text>

        <text x={458} y={startY - 16} fill="var(--ink)" fontSize="17" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="middle">
          Bank Account
        </text>
        <text x={458} y={startY + H + 24} fill="var(--muted)" fontSize="15" fontWeight="500" textAnchor="middle">
          {money(income, true)}
        </text>

        {H_exp > 0 && (
          <>
            <text x={780} y={startY + H_exp / 2 - 12} fill="var(--ink)" fontSize="17" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="start">
              Spent ({Math.round(expensePct)}%)
            </text>
            <text x={780} y={startY + H_exp / 2 + 12} fill="var(--muted)" fontSize="15" fontWeight="500" textAnchor="start">
              {money(expenses, true)}
            </text>
          </>
        )}

        {H_sav > 0 && (
          <>
            <text
              x={780}
              y={startY + H_exp + gap + H_sav / 2 - 12}
              fill="var(--ink)"
              fontSize="17"
              fontWeight="700"
              fontFamily="var(--font-manrope)"
              textAnchor="start"
            >
              Saved ({Math.round(savingsPct)}%)
            </text>
            <text x={780} y={startY + H_exp + gap + H_sav / 2 + 12} fill="var(--muted)" fontSize="15" fontWeight="500" textAnchor="start">
              {money(savings, true)}
            </text>
          </>
        )}
      </svg>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hover-opacity { transition: opacity 0.2s ease-in-out; }
        .hover-opacity:hover { opacity: 0.6; }
      `,
        }}
      />
    </div>
  );
}
