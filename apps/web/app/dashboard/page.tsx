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
    creditCardPayments?: number;
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
    toAccountType?: string;
    amount: number;
  }>;
  overall: {
    totalExternalInbound: number;
    totalExternalOutbound: number;
    totalCreditCardPayments?: number;
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

function getLastDayOfWeekInMonth(year: number, month: number, targetDayOfWeek: number): string {
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
  const day = lastDayOfMonth.getUTCDay();
  const diff = (day - targetDayOfWeek + 7) % 7;
  lastDayOfMonth.setUTCDate(lastDayOfMonth.getUTCDate() - diff);
  return lastDayOfMonth.toISOString().slice(0, 10);
}

function getDefaultOverviewDateRange(referenceDate = new Date()): { startDate: string; endDate: string } {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();

  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;

  const startDate = getLastDayOfWeekInMonth(prevYear, prevMonth, 5); // 5 = Friday
  const endDate = getLastDayOfWeekInMonth(year, month, 4); // 4 = Thursday

  return { startDate, endDate };
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard>();
  const [owner, setOwner] = useState<Owner>();
  const [error, setError] = useState('');

  const [dateRange, setDateRange] = useState(() => getDefaultOverviewDateRange());
  const [startDate, setStartDate] = useState(() => dateRange.startDate);
  const [endDate, setEndDate] = useState(() => dateRange.endDate);
  const [presetKey, setPresetKey] = useState('DEFAULT');

  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showTransfersModal, setShowTransfersModal] = useState(false);
  const [showBudgetsModal, setShowBudgetsModal] = useState(false);
  const [budgetRefreshTrigger, setBudgetRefreshTrigger] = useState(0);
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const query = new URLSearchParams({
        startDate,
        endDate,
      });
      const [overview, profile] = await Promise.all([
        api<Dashboard>(`/dashboard?${query.toString()}`),
        api<Owner>('/auth/me'),
      ]);
      setData(overview);
      setOwner(profile);
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load your overview.'));
    }
  }, [router, startDate, endDate]);

  useEffect(() => {
    const savedPreset = localStorage.getItem("yaft_default_date_preset");
    if (savedPreset && savedPreset !== "DEFAULT") {
      handlePresetChange(savedPreset);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePresetChange = (preset: string) => {
    setPresetKey(preset);
    const now = new Date();
    if (preset === 'DEFAULT') {
      const def = getDefaultOverviewDateRange(now);
      setStartDate(def.startDate);
      setEndDate(def.endDate);
    } else if (preset === 'THIS_MONTH') {
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, '0');
      setStartDate(`${y}-${m}-01`);
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'LAST_MONTH') {
      let y = now.getUTCFullYear();
      let m = now.getUTCMonth();
      if (m === 0) {
        m = 12;
        y -= 1;
      }
      const mStr = String(m).padStart(2, '0');
      setStartDate(`${y}-${mStr}-01`);
      setEndDate(`${y}-${mStr}-31`);
    } else if (preset === 'LAST_6_MONTHS') {
      const today = now.toISOString().slice(0, 10);
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(today);
    } else if (preset === 'THIS_FY') {
      const y = now.getUTCFullYear();
      const startYr = now.getUTCMonth() >= 3 ? y : y - 1;
      setStartDate(`${startYr}-04-01`);
      setEndDate(`${startYr + 1}-03-31`);
    }
  };

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

  const dateRangeLabel = startDate && endDate
    ? `${new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })} – ${new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
    : data.month;

  const monthLabel = dateRangeLabel;

  const totalSpend = data.categories.reduce((sum, category) => sum + category.amount, 0);
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
          <p>Overview of {dateRangeLabel}.</p>
        </div>
        <div className="dashboard-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button type="button" className="secondary compact" onClick={handleReconcileTransfers} disabled={reconciling}>
            <RefreshCw size={14} className={reconciling ? 'spin' : ''} />
            {reconciling ? 'Matching…' : 'Match Transfers'}
          </button>

          {/* Unified Sleek Date Control Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '4px 8px',
              gap: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            {/* Preset Selector */}
            <select
              value={presetKey}
              aria-label="Overview Time Range Preset"
              onChange={(e) => handlePresetChange(e.target.value)}
              style={{
                height: '30px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--card-hover)',
                color: 'var(--ink)',
                padding: '0 8px',
                cursor: 'pointer',
                outline: 'none',
                maxWidth: '170px',
              }}
            >
              <option value="DEFAULT">Last Fri – Last Thu</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="LAST_6_MONTHS">Last 6 Months</option>
              <option value="THIS_FY">This FY</option>
              <option value="CUSTOM">Custom Range</option>
            </select>

            <span style={{ height: '18px', width: '1px', background: 'var(--line)' }} />

            {/* Date Range Controls */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CalendarDays size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
              <input
                type="date"
                aria-label="Start Date"
                value={startDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setStartDate(e.target.value);
                    setPresetKey('CUSTOM');
                  }
                }}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: '2px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  outline: 'none',
                  width: '110px',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>–</span>
              <input
                type="date"
                aria-label="End Date"
                value={endDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setEndDate(e.target.value);
                    setPresetKey('CUSTOM');
                  }
                }}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: '2px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  outline: 'none',
                  width: '110px',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '24px' }}>
        <article>
          <span className="summary-icon income">
            <ArrowUpRight />
          </span>
          <div>
            <small>Savings Net Inbound</small>
            <strong style={{ fontSize: '1.4rem' }}>{money(data.savingsNetInbound ?? data.income)}</strong>
            <em>Excl. internal transfers</em>
          </div>
        </article>

        <article>
          <span className="summary-icon expense">
            <ArrowDownRight />
          </span>
          <div>
            <small>Savings Net Outbound</small>
            <strong style={{ fontSize: '1.4rem' }}>{money(data.savingsNetOutbound ?? data.expenses)}</strong>
            <em>Excl. internal transfers</em>
          </div>
        </article>

        <article>
          <span className={`summary-icon ${data.savings >= 0 ? 'income' : 'expense'}`}>
            <TrendingUp />
          </span>
          <div>
            <small>Net Cash Flow</small>
            <strong style={{ fontSize: '1.4rem', color: data.savings >= 0 ? 'var(--green)' : '#ef4444' }}>{money(data.savings)}</strong>
            <em>{data.savings >= 0 ? '🟢 Net Surplus' : '🔴 Net Deficit'} in {monthLabel}</em>
          </div>
        </article>

        <article>
          <span className="summary-icon saved">
            <WalletCards />
          </span>
          <div>
            <small>Savings Rate</small>
            <strong style={{ fontSize: '1.4rem', color: 'var(--ink)' }}>{data.savingsRate}%</strong>
            <em>Of inbound income saved</em>
          </div>
        </article>
      </section>

      <section className="panel monthly-flow-panel" style={{ marginBottom: '24px' }}>
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="eyebrow">Cash Flow</span>
            <h2>Savings Accounts Cash Flow & Transfers</h2>
          </div>
          <button type="button" className="secondary compact" onClick={() => setShowTransfersModal(true)}>
            <RefreshCw size={14} className={reconciling ? 'spin' : ''} />
            View Transfer Matching Candidates
          </button>
        </div>

        <MonthlyFlow
          income={data.income}
          expenses={data.expenses}
          savings={data.savings}
          accountFlow={data.accountFlow}
        />
      </section>

      <section className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
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

        <article className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title" style={{ marginBottom: '16px' }}>
            <div>
              <span className="eyebrow">Payees & Merchants</span>
              <h2>Top Outbound Beneficiaries</h2>
            </div>
            <span className="month-pill">
              <Send size={14} color="#f59e0b" />
              P2P & Vendors
            </span>
          </div>

          {data.topOutboundRecipients && data.topOutboundRecipients.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
              {data.topOutboundRecipients.slice(0, 5).map((rec) => {
                const pct = data.expenses > 0 ? Math.min(100, Math.round((rec.amount / data.expenses) * 100)) : 0;
                return (
                  <div key={rec.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '12px' }}>
                      <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{rec.name}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        <strong style={{ color: 'var(--ink)' }}>{money(rec.amount)}</strong> ({rec.count} txn{rec.count === 1 ? '' : 's'})
                      </span>
                    </div>
                    <div style={{ height: '6px', width: '100%', background: 'var(--background-alt)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#f59e0b', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', background: 'var(--background-alt)', borderRadius: '10px', color: 'var(--muted)', fontSize: '12px', marginTop: 'auto', marginBottom: 'auto' }}>
              No major merchant or P2P outbound transactions recorded for {monthLabel}.
            </div>
          )}
        </article>
      </section>

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
            <small style={{ color: '#8b5cf6', display: 'block', fontSize: '11px', fontWeight: 600 }}>Investments</small>
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
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(230px, 1fr))`, gap: '14px' }}>
        {accounts.map((acc) => (
          <div
            key={acc.id}
            style={{
              background: 'var(--background-alt)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '14px 12px',
              display: 'grid',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
              <div>
                <strong style={{ fontSize: '13px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.name}</strong>
                {acc.institution && <small style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>{acc.institution}</small>}
              </div>
              <span style={{ fontSize: '9px', background: 'var(--line)', padding: '2px 6px', borderRadius: '10px', fontWeight: 600, flexShrink: 0 }}>
                {acc.type}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px' }}>
              <div style={{ background: 'var(--background)', padding: '8px 5px', borderRadius: '6px', border: '1px solid var(--line)', overflow: 'hidden' }}>
                <small style={{ color: '#10b981', display: 'block', fontSize: '9.5px', fontWeight: 600, marginBottom: '2px' }}>Inbound</small>
                <strong style={{ fontSize: '12px', color: '#10b981', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  +{money(acc.externalInbound)}
                </strong>
                {acc.internalInbound > 0 && (
                  <div style={{ fontSize: '9.5px', color: '#3b82f6', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    + {money(acc.internalInbound)} int.
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--background)', padding: '8px 5px', borderRadius: '6px', border: '1px solid var(--line)', overflow: 'hidden' }}>
                <small style={{ color: '#ef4444', display: 'block', fontSize: '9.5px', fontWeight: 600, marginBottom: '2px' }}>Outbound</small>
                <strong style={{ fontSize: '12px', color: '#ef4444', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  -{money(acc.externalOutbound)}
                </strong>
                {acc.internalOutbound > 0 && (
                  <div style={{ fontSize: '9.5px', color: '#3b82f6', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    - {money(acc.internalOutbound)} int.
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--background)', padding: '8px 5px', borderRadius: '6px', border: (acc.investments ?? 0) > 0 ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--line)', overflow: 'hidden' }}>
                <small style={{ color: '#8b5cf6', display: 'block', fontSize: '9.5px', fontWeight: 600, marginBottom: '2px' }}>Investments</small>
                <strong style={{ fontSize: '12px', color: (acc.investments ?? 0) > 0 ? '#8b5cf6' : 'var(--muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {money(acc.investments ?? 0)}
                </strong>
                <div style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  SIP & MF
                </div>
              </div>
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

  // Aggregate bank-to-bank internal transfers by (fromAccountId -> toAccountId) pair
  const aggregatedBankTransfers = useMemo(() => {
    const map = new Map<
      string,
      {
        fromAccountId: string;
        toAccountId: string;
        fromAccountName: string;
        toAccountName: string;
        totalAmount: number;
        count: number;
      }
    >();

    for (const it of internalTransfers) {
      if (it.toAccountType === 'CREDIT_CARD') continue; // Credit card payments go to CC Destination Node
      const key = `${it.fromAccountId}_${it.toAccountId}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalAmount += it.amount;
        existing.count += 1;
      } else {
        map.set(key, {
          fromAccountId: it.fromAccountId,
          toAccountId: it.toAccountId,
          fromAccountName: it.fromAccountName,
          toAccountName: it.toAccountName,
          totalAmount: it.amount,
          count: 1,
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

  const BANK_NODE_GAP = 28;
  const startY = 40;

  // Compute exact volume for each bank account
  const bankVolumes = accounts.map((a) => {
    // Inbound transfers received from other bank accounts
    const bankTransfersIn = aggregatedBankTransfers
      .filter((t) => t.toAccountId === a.id)
      .reduce((sum, t) => sum + t.totalAmount, 0);
    // Outbound transfers sent to other bank accounts
    const bankTransfersOut = aggregatedBankTransfers
      .filter((t) => t.fromAccountId === a.id)
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const inTotal = a.externalInbound + bankTransfersIn;
    const outTotal = a.externalOutbound + (a.creditCardPayments || 0) + (a.investments || 0) + bankTransfersOut;
    return {
      ...a,
      bankTransfersIn,
      bankTransfersOut,
      inTotal,
      outTotal,
      maxVolume: Math.max(inTotal, outTotal, 1),
    };
  });

  const totalSystemVolume = bankVolumes.reduce((sum, v) => sum + v.maxVolume, 0) || 1;
  const totalMinHeightNeeded = accounts.length * 54 + (accounts.length - 1) * BANK_NODE_GAP;
  const usableH = Math.max(420, totalMinHeightNeeded);
  const availableH = usableH - (accounts.length - 1) * BANK_NODE_GAP;
  const SVG_HEIGHT = usableH + startY * 2;
  const SVG_WIDTH = 1120;

  const leftX = 160;
  const middleX = 490;
  const rightX = 840;
  const nodeW = 18;

  let currentY = startY;
  const bankNodes = bankVolumes.map((acc, idx) => {
    const rawProp = acc.maxVolume / totalSystemVolume;
    const height = Math.max(54, Math.round(availableH * rawProp));
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

  // Left Node: External Inbound
  const activeInboundBanks = bankNodes.filter((b) => b.externalInbound > 0);
  const sumInbound = activeInboundBanks.reduce((sum, a) => sum + a.externalInbound, 0) || 1;
  const inboundNodeH = Math.max(50, Math.min(usableH * 0.65, activeInboundBanks.length * 38));
  const inboundNodeStartY = startY + (usableH - inboundNodeH) / 2;

  let currLeftSourceY = inboundNodeStartY;
  const inboundSlices = bankNodes.map((bank) => {
    if (bank.externalInbound <= 0) {
      return { bank, srcTopY: currLeftSourceY, srcBotY: currLeftSourceY, dstTopY: bank.y, dstBotY: bank.y };
    }
    const share = bank.externalInbound / sumInbound;
    const srcSliceH = Math.max(6, share * inboundNodeH);
    const srcTopY = currLeftSourceY;
    const srcBotY = srcTopY + srcSliceH;
    currLeftSourceY += srcSliceH;

    // Target slice height on bank node left edge
    const dstScale = bank.height / bank.maxVolume;
    const dstSliceH = Math.max(6, bank.externalInbound * dstScale);
    const dstTopY = bank.y;
    const dstBotY = dstTopY + dstSliceH;

    return { bank, srcTopY, srcBotY, dstTopY, dstBotY };
  });

  // Right Destination Nodes:
  // 1. External Outbound
  // 2. Credit Card Payments (Internal)
  // 3. Mutual Funds & Investments
  const hasCreditCardPayments = (overall.totalCreditCardPayments || 0) > 0;
  const hasInvestments = (overall.totalInvestments || 0) > 0;

  const totalRightVolume =
    (overall.totalExternalOutbound || 0) +
    (overall.totalCreditCardPayments || 0) +
    (overall.totalInvestments || 0) || 1;

  const destCount = 1 + (hasCreditCardPayments ? 1 : 0) + (hasInvestments ? 1 : 0);
  const destGap = 24;
  const totalDestAvailableH = usableH * 0.75 - (destCount - 1) * destGap;

  const outboundNodeH = Math.max(46, Math.round(totalDestAvailableH * ((overall.totalExternalOutbound || 0) / totalRightVolume)));
  const ccNodeH = hasCreditCardPayments
    ? Math.max(40, Math.round(totalDestAvailableH * ((overall.totalCreditCardPayments || 0) / totalRightVolume)))
    : 0;
  const investmentNodeH = hasInvestments
    ? Math.max(40, Math.round(totalDestAvailableH * ((overall.totalInvestments || 0) / totalRightVolume)))
    : 0;

  const totalDestBlockH = outboundNodeH + (hasCreditCardPayments ? ccNodeH + destGap : 0) + (hasInvestments ? investmentNodeH + destGap : 0);
  const outboundRightY = startY + (usableH - totalDestBlockH) / 2;
  const ccRightY = outboundRightY + outboundNodeH + (hasCreditCardPayments ? destGap : 0);
  const investmentRightY = ccRightY + (hasCreditCardPayments ? ccNodeH : 0) + (hasInvestments ? destGap : 0);

  // Outbound Ribbons: External Outbound
  const activeOutboundBanks = bankNodes.filter((b) => b.externalOutbound > 0);
  const sumOutbound = activeOutboundBanks.reduce((sum, a) => sum + a.externalOutbound, 0) || 1;
  let currOutboundDstY = outboundRightY;

  const outboundSlices = bankNodes.map((bank) => {
    if (bank.externalOutbound <= 0) {
      return { bank, srcTopY: bank.y, srcBotY: bank.y, dstTopY: currOutboundDstY, dstBotY: currOutboundDstY };
    }
    const dstShare = bank.externalOutbound / sumOutbound;
    const dstSliceH = Math.max(6, dstShare * outboundNodeH);
    const dstTopY = currOutboundDstY;
    const dstBotY = dstTopY + dstSliceH;
    currOutboundDstY += dstSliceH;

    const scale = bank.height / bank.maxVolume;
    const srcSliceH = Math.max(6, bank.externalOutbound * scale);
    const srcTopY = bank.y;
    const srcBotY = srcTopY + srcSliceH;

    return { bank, srcTopY, srcBotY, dstTopY, dstBotY };
  });

  // Outbound Ribbons: Credit Card Payments
  const activeCcBanks = bankNodes.filter((b) => (b.creditCardPayments || 0) > 0);
  const sumCc = activeCcBanks.reduce((sum, a) => sum + (a.creditCardPayments || 0), 0) || 1;
  let currCcDstY = ccRightY;

  const ccSlices = bankNodes.map((bank) => {
    const ccAmt = bank.creditCardPayments || 0;
    if (ccAmt <= 0) return { bank, srcTopY: bank.y, srcBotY: bank.y, dstTopY: currCcDstY, dstBotY: currCcDstY };

    const dstShare = ccAmt / sumCc;
    const dstSliceH = Math.max(6, dstShare * ccNodeH);
    const dstTopY = currCcDstY;
    const dstBotY = dstTopY + dstSliceH;
    currCcDstY += dstSliceH;

    const scale = bank.height / bank.maxVolume;
    const extOutH = bank.externalOutbound * scale;
    const srcSliceH = Math.max(6, ccAmt * scale);
    const srcTopY = bank.y + extOutH;
    const srcBotY = srcTopY + srcSliceH;

    return { bank, srcTopY, srcBotY, dstTopY, dstBotY };
  });

  // Outbound Ribbons: Investments
  const activeInvBanks = bankNodes.filter((b) => (b.investments || 0) > 0);
  const sumInvestments = activeInvBanks.reduce((sum, a) => sum + (a.investments || 0), 0) || 1;
  let currInvDstY = investmentRightY;

  const investmentSlices = bankNodes.map((bank) => {
    const invAmt = bank.investments || 0;
    if (invAmt <= 0) return { bank, srcTopY: bank.y, srcBotY: bank.y, dstTopY: currInvDstY, dstBotY: currInvDstY };

    const dstShare = invAmt / sumInvestments;
    const dstSliceH = Math.max(6, dstShare * investmentNodeH);
    const dstTopY = currInvDstY;
    const dstBotY = dstTopY + dstSliceH;
    currInvDstY += dstSliceH;

    const scale = bank.height / bank.maxVolume;
    const extOutH = bank.externalOutbound * scale;
    const ccH = (bank.creditCardPayments || 0) * scale;
    const srcSliceH = Math.max(6, invAmt * scale);
    const srcTopY = bank.y + extOutH + ccH;
    const srcBotY = srcTopY + srcSliceH;

    return { bank, srcTopY, srcBotY, dstTopY, dstBotY };
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
            <linearGradient key={`grad-cc-${bank.id}`} id={`grad-cc-${bank.id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={bank.color} />
              <stop offset="100%" stopColor="#f59e0b" />
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
        {inboundSlices.map(({ bank, srcTopY, srcBotY, dstTopY, dstBotY }) => {
          if (bank.externalInbound <= 0) return null;
          const midX = (leftX + nodeW + bank.x) / 2;
          const midY = (srcTopY + dstTopY) / 2;
          const isHighlighted = !hoveredBankId || hoveredBankId === bank.id;
          return (
            <path
              key={`in-${bank.id}`}
              d={sankeyLink(leftX + nodeW, srcTopY, srcBotY, bank.x, dstTopY, dstBotY)}
              fill={`url(#grad-in-${bank.id})`}
              opacity={isHighlighted ? '0.5' : '0.08'}
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

        {/* 2a. Outbound Bezier Ribbons from Bank Nodes to External Outbound */}
        {outboundSlices.map(({ bank, srcTopY, srcBotY, dstTopY, dstBotY }) => {
          if (bank.externalOutbound <= 0) return null;
          const midX = (bank.x + nodeW + rightX) / 2;
          const midY = (srcTopY + dstTopY) / 2;
          const isHighlighted = !hoveredBankId || hoveredBankId === bank.id;
          return (
            <path
              key={`out-${bank.id}`}
              d={sankeyLink(bank.x + nodeW, srcTopY, srcBotY, rightX, dstTopY, dstBotY)}
              fill={`url(#grad-out-${bank.id})`}
              opacity={isHighlighted ? '0.5' : '0.08'}
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

        {/* 2b. Credit Card Payment Ribbons from Bank Nodes to Credit Card Payments (Internal) */}
        {hasCreditCardPayments &&
          ccSlices.map(({ bank, srcTopY, srcBotY, dstTopY, dstBotY }) => {
            const ccAmt = bank.creditCardPayments || 0;
            if (ccAmt <= 0) return null;
            const midX = (bank.x + nodeW + rightX) / 2;
            const midY = (srcTopY + dstTopY) / 2;
            const isHighlighted = !hoveredBankId || hoveredBankId === bank.id;
            return (
              <path
                key={`cc-${bank.id}`}
                d={sankeyLink(bank.x + nodeW, srcTopY, srcBotY, rightX, dstTopY, dstBotY)}
                fill={`url(#grad-cc-${bank.id})`}
                opacity={isHighlighted ? '0.6' : '0.08'}
                style={{ transition: 'opacity 0.2s ease', cursor: 'pointer' }}
                className="sankey-path hover-opacity"
                onMouseEnter={() => {
                  setHoveredBankId(bank.id);
                  setHoveredFlow({
                    title: `${bank.name} ⟶ Credit Card Payments (Internal)`,
                    amount: `-${money(ccAmt)}`,
                    x: midX,
                    y: midY,
                    color: '#f59e0b',
                  });
                }}
                onMouseLeave={() => {
                  setHoveredBankId(null);
                  setHoveredFlow(null);
                }}
              />
            );
          })}

        {/* 2c. Investment Bezier Ribbons from Bank Nodes to Mutual Funds & Investments */}
        {hasInvestments &&
          investmentSlices.map(({ bank, srcTopY, srcBotY, dstTopY, dstBotY }) => {
            const invAmt = bank.investments || 0;
            if (invAmt <= 0) return null;
            const midX = (bank.x + nodeW + rightX) / 2;
            const midY = (srcTopY + dstTopY) / 2;
            const isHighlighted = !hoveredBankId || hoveredBankId === bank.id;
            return (
              <path
                key={`inv-${bank.id}`}
                d={sankeyLink(bank.x + nodeW, srcTopY, srcBotY, rightX, dstTopY, dstBotY)}
                fill={`url(#grad-inv-${bank.id})`}
                opacity={isHighlighted ? '0.6' : '0.08'}
                style={{ transition: 'opacity 0.2s ease', cursor: 'pointer' }}
                className="sankey-path hover-opacity"
                onMouseEnter={() => {
                  setHoveredBankId(bank.id);
                  setHoveredFlow({
                    title: `${bank.name} ⟶ Mutual Funds & Investments`,
                    amount: `+${money(invAmt)}`,
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

        {/* 3. Bank-to-Bank Internal Transfer Channels & Clean Badges */}
        {aggregatedBankTransfers.map((it, idx) => {
          const fromNode = bankNodes.find((b) => b.id === it.fromAccountId);
          const toNode = bankNodes.find((b) => b.id === it.toAccountId);
          if (!fromNode || !toNode) return null;

          const fromY = fromNode.y + fromNode.height - 12;
          const toY = toNode.y + Math.min(16, toNode.height * 0.3);
          const baseMidY = (fromY + toY) / 2;

          const verticalShift = (idx - (aggregatedBankTransfers.length - 1) / 2) * 34;
          const badgeY = baseMidY + verticalShift;
          const curveCpX = middleX + 115 + Math.abs(verticalShift) * 0.5;
          const badgeCenterX = middleX + 115;

          const transferPath = `
            M ${middleX + nodeW} ${fromY}
            C ${curveCpX} ${fromY}, ${curveCpX} ${toY}, ${middleX + nodeW} ${toY}
          `;

          const bandWidth = Math.max(3, Math.min(10, Math.round(it.totalAmount / 15000)));
          const labelText = `${it.fromAccountName.split(' ')[0]} ⟶ ${it.toAccountName.split(' ')[0]}: ${money(it.totalAmount)}${it.count > 1 ? ` (${it.count})` : ''}`;
          const badgeW = Math.max(160, labelText.length * 7 + 22);
          const isHighlighted = !hoveredBankId || hoveredBankId === fromNode.id || hoveredBankId === toNode.id;

          return (
            <g key={`aggr-it-${idx}`} style={{ transition: 'opacity 0.2s ease', opacity: isHighlighted ? 1 : 0.12 }}>
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
                y={badgeY - 12}
                width={badgeW}
                height="24"
                rx="12"
                fill="var(--card)"
                stroke={fromNode.color}
                strokeWidth="1.5"
                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))', cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoveredBankId(fromNode.id);
                  setHoveredFlow({
                    title: `Internal Transfer: ${it.fromAccountName} ⟶ ${it.toAccountName} (${it.count} tx)`,
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
                🔄 {labelText}
              </text>
            </g>
          );
        })}

        {/* 4. Node Rectangles & Labels */}
        {/* Left Node: External Inbound */}
        <rect x={leftX} y={inboundNodeStartY} width={nodeW} height={inboundNodeH} fill="#10b981" rx="4" />
        <text x={leftX - 14} y={inboundNodeStartY + inboundNodeH / 2 - 10} fill="var(--ink)" fontSize="15" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="end">
          External Inbound
        </text>
        <text x={leftX - 14} y={inboundNodeStartY + inboundNodeH / 2 + 12} fill="#059669" fontSize="13" fontWeight="700" textAnchor="end">
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
              <text x={bank.x + nodeW + 12} y={bank.y + Math.min(18, bank.height / 2 - 2)} fill="var(--ink)" fontSize="14" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="start">
                {bank.name}
              </text>
              <text x={bank.x + nodeW + 12} y={bank.y + Math.min(34, bank.height / 2 + 14)} fontSize="11" fontWeight="500" textAnchor="start">
                <tspan fill="var(--muted)">In: </tspan>
                <tspan fill="#059669" fontWeight="700">+{money(bank.inTotal)}</tspan>
                <tspan fill="var(--muted)"> · Out: </tspan>
                <tspan fill="#dc2626" fontWeight="700">-{money(bank.outTotal)}</tspan>
              </text>
            </g>
          );
        })}

        {/* Right Node 1: External Outbound */}
        <rect x={rightX} y={outboundRightY} width={nodeW} height={outboundNodeH} fill="#ef4444" rx="4" />
        <text x={rightX + nodeW + 14} y={outboundRightY + outboundNodeH / 2 - 10} fill="var(--ink)" fontSize="15" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="start">
          External Outbound
        </text>
        <text x={rightX + nodeW + 14} y={outboundRightY + outboundNodeH / 2 + 12} fill="#dc2626" fontSize="13" fontWeight="700" textAnchor="start">
          -{money(overall.totalExternalOutbound)}
        </text>

        {/* Right Node 2: Credit Card Payments (Internal) */}
        {hasCreditCardPayments && (
          <g>
            <rect x={rightX} y={ccRightY} width={nodeW} height={ccNodeH} fill="#f59e0b" rx="4" />
            <text x={rightX + nodeW + 14} y={ccRightY + ccNodeH / 2 - 10} fill="var(--ink)" fontSize="14" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="start">
              Credit Card Payments (Internal)
            </text>
            <text x={rightX + nodeW + 14} y={ccRightY + ccNodeH / 2 + 12} fill="#d97706" fontSize="13" fontWeight="700" textAnchor="start">
              -{money(overall.totalCreditCardPayments || 0)}
            </text>
          </g>
        )}

        {/* Right Node 3: Mutual Funds & Investments */}
        {hasInvestments && (
          <g>
            <rect x={rightX} y={investmentRightY} width={nodeW} height={investmentNodeH} fill="#8b5cf6" rx="4" />
            <text x={rightX + nodeW + 14} y={investmentRightY + investmentNodeH / 2 - 10} fill="var(--ink)" fontSize="14" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="start">
              Mutual Funds & Investments
            </text>
            <text x={rightX + nodeW + 14} y={investmentRightY + investmentNodeH / 2 + 12} fill="#7c3aed" fontSize="13" fontWeight="700" textAnchor="start">
              +{money(overall.totalInvestments || 0)}
            </text>
          </g>
        )}

        {/* 5. Floating Interactive Hover Tooltip */}
        {hoveredFlow && (
          <g pointerEvents="none">
            <rect
              x={hoveredFlow.x - 140}
              y={hoveredFlow.y - 28}
              width="280"
              height="44"
              rx="10"
              fill="var(--card)"
              stroke={hoveredFlow.color}
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.15))' }}
            />
            <text x={hoveredFlow.x} y={hoveredFlow.y - 10} fill="var(--ink)" fontSize="11" fontWeight="700" fontFamily="var(--font-manrope)" textAnchor="middle">
              {hoveredFlow.title}
            </text>
            <text x={hoveredFlow.x} y={hoveredFlow.y + 8} fill={hoveredFlow.color} fontSize="13" fontWeight="800" textAnchor="middle">
              {hoveredFlow.amount}
            </text>
            </g>
        )}
      </svg>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hover-opacity { transition: opacity 0.2s ease-in-out; cursor: pointer; }
        .hover-opacity:hover { opacity: 0.85; }
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
