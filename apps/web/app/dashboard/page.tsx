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
  Landmark,
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

type SupergroupData = {
  id: string;
  name: string;
  kind: string;
  color: string;
  amount: number;
  categories: Array<{ name: string; color: string; amount: number; percentage?: number }>;
};

type AccountFlow = {
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    institution: string | null;
    externalInbound: number;
    internalInbound: number;
    externalOutbound: number;
    cleanOutbound?: number;
    expenses?: number;
    other?: number;
    creditCardPayments?: number;
    investments?: number;
    internalOutbound: number;
    totalInbound: number;
    totalOutbound: number;
    supergroups?: SupergroupData[];
    cleanCategories?: Array<{ name: string; color: string; amount: number; percentage: number }>;
    allCategories?: Array<{ name: string; color: string; amount: number; percentage: number }>;
    categories?: Array<{ name: string; color: string; amount: number; percentage: number }>;
    topRecipients?: Array<{ name: string; amount: number; count: number; isInternal?: boolean }>;
    topExternalRecipients?: Array<{ name: string; amount: number; count: number; isInternal?: boolean }>;
    otherExternalOutbound?: { amount: number; count: number };
    topInternalRecipients?: Array<{ name: string; amount: number; count: number; isInternal?: boolean }>;
    otherInternalOutbound?: { amount: number; count: number };
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
    totalInternalInbound?: number;
    totalExternalOutbound: number;
    totalCreditCardPayments?: number;
    totalUpiLiteTransfers?: number;
    totalInterBankTransfers?: number;
    totalInvestments?: number;
    totalCleanOutbound?: number;
    totalInternalTransfers: number;
    totalAllOutbound?: number;
    supergroups?: SupergroupData[];
    categoryFlow?: {
      outboundCategories: Array<{ name: string; color: string; amount: number }>;
      creditCardCategories: Array<{ name: string; color: string; amount: number }>;
      investmentCategories: Array<{ name: string; color: string; amount: number }>;
      overallCategories: Array<{ name: string; color: string; amount: number }>;
    };
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
  const [cycleOffset, setCycleOffset] = useState(0);

  const shiftCycle = (direction: -1 | 1) => {
    const nextOffset = cycleOffset + direction;
    setCycleOffset(nextOffset);
    const refDate = new Date();
    refDate.setUTCMonth(refDate.getUTCMonth() + nextOffset);
    const def = getDefaultOverviewDateRange(refDate);
    setStartDate(def.startDate);
    setEndDate(def.endDate);
    setPresetKey('DEFAULT');
  };

  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showTransfersModal, setShowTransfersModal] = useState(false);
  const [showBudgetsModal, setShowBudgetsModal] = useState(false);
  const [budgetRefreshTrigger, setBudgetRefreshTrigger] = useState(0);


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
      setCycleOffset(0);
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

  const totalSpend = (data.categories || []).reduce((sum, category) => sum + category.amount, 0);
  let angle = 0;
  const gradient = (data.categories || []).length
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
    { name: 'Investments', types: ['STOCKS', 'MUTUAL_FUND', 'INVESTMENT'], color: '#10b981' },
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


          {/* Unified Sleek Date Control Pill with Prev/Next Period Navigation */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '4px 6px',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <button
              type="button"
              title="Navigate to Previous Period Cycle (Last Fri – Last Thu)"
              onClick={() => shiftCycle(-1)}
              style={{
                background: 'var(--card-hover)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--ink)',
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowLeft size={14} />
            </button>

            {/* Preset Selector */}
            <select
              value={presetKey}
              aria-label="Overview Time Range Preset"
              onChange={(e) => handlePresetChange(e.target.value)}
              style={{
                height: '28px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--card-hover)',
                color: 'var(--ink)',
                padding: '0 8px',
                cursor: 'pointer',
                outline: 'none',
                maxWidth: '160px',
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

            <button
              type="button"
              title="Navigate to Next Period Cycle (Last Fri – Last Thu)"
              onClick={() => shiftCycle(1)}
              style={{
                background: 'var(--card-hover)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--ink)',
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowRight size={14} />
            </button>
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
            <em>Excl. internal transfers • {startDate} to {endDate}</em>
          </div>
        </article>

        <article>
          <span className="summary-icon expense">
            <ArrowDownRight />
          </span>
          <div>
            <small>Savings Net Outbound</small>
            <strong style={{ fontSize: '1.4rem' }}>{money(data.savingsNetOutbound ?? data.expenses)}</strong>
            <em>Excl. internal transfers • {startDate} to {endDate}</em>
          </div>
        </article>

        <article>
          <span className={`summary-icon ${data.savings >= 0 ? 'income' : 'expense'}`}>
            <TrendingUp />
          </span>
          <div>
            <small>Net Cash Flow</small>
            <strong style={{ fontSize: '1.4rem', color: data.savings >= 0 ? 'var(--green)' : '#ef4444' }}>{money(data.savings)}</strong>
            <em>{startDate} to {endDate}</em>
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
            <RefreshCw size={14} />
            View Transfer Matching Candidates
          </button>
        </div>

        <MonthlyFlow
          income={data.income}
          expenses={data.expenses}
          savings={data.savings}
          accountFlow={data.accountFlow}
          dateRangeText={dateRangeLabel}
        />
      </section>

      <section className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <article className="panel spending-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Spending</span>
              <h2>Where it went</h2>
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
  dateRangeText,
}: {
  income: number;
  expenses: number;
  savings: number;
  accountFlow?: AccountFlow;
  dateRangeText?: string;
}) {
  if (!accountFlow || accountFlow.accounts.length === 0) {
    if (income <= 0) return <Empty text="No income found for this month to generate flow." />;
    return <LegacyMonthlyFlow income={income} expenses={expenses} savings={savings} />;
  }

  const { accounts, internalTransfers, overall } = accountFlow;
  const cardAndUpiTotal = (overall.totalCreditCardPayments ?? 0) + (overall.totalUpiLiteTransfers ?? 0);
  const interBankTotal = overall.totalInterBankTransfers ?? overall.totalInternalTransfers ?? 0;

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Overall Flow Summary KPI Pills */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 16px', borderRadius: '10px', fontSize: '13px' }}>
          <small style={{ color: '#10b981', display: 'block', fontSize: '11px', fontWeight: 600 }}>External Inbound</small>
          <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{money(overall.totalExternalInbound)}</strong>
        </div>
        {interBankTotal > 0 && (
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '10px 16px', borderRadius: '10px', fontSize: '13px' }}>
            <small style={{ color: '#3b82f6', display: 'block', fontSize: '11px', fontWeight: 600 }}>Inter-Bank Moved</small>
            <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{money(interBankTotal)}</strong>
          </div>
        )}
        {overall.totalInvestments !== undefined && overall.totalInvestments > 0 && (
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '10px 16px', borderRadius: '10px', fontSize: '13px' }}>
            <small style={{ color: '#8b5cf6', display: 'block', fontSize: '11px', fontWeight: 600 }}>Investments & SIPs</small>
            <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{money(overall.totalInvestments)}</strong>
          </div>
        )}
        {cardAndUpiTotal > 0 && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 16px', borderRadius: '10px', fontSize: '13px' }}>
            <small style={{ color: '#10b981', display: 'block', fontSize: '11px', fontWeight: 600 }}>Card & UPI Settlements</small>
            <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{money(cardAndUpiTotal)}</strong>
          </div>
        )}
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 16px', borderRadius: '10px', fontSize: '13px' }}>
          <small style={{ color: '#ef4444', display: 'block', fontSize: '11px', fontWeight: 600 }}>Living Spends & Loans</small>
          <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{money(overall.totalExternalOutbound)}</strong>
        </div>
      </div>

      {/* Multi-Bank Visual Sankey Diagram */}
      <div style={{ background: 'var(--background-alt)', border: '1px solid var(--line)', borderRadius: '14px', padding: '20px', width: '100%', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span className="eyebrow" style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              MULTI-BANK CASH FLOW & HIERARCHICAL SETTLEMENT SANKEY
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
              External Inbound → Funding Banks (with Inter-Bank Transfers) → Intermediate Channels (Direct Spends, Credit Cards, UPI Lite, Loans) → Final Expense Categories
            </span>
          </div>
        </div>
        <MultiBankSankeyDiagram accountFlow={accountFlow} income={income} expenses={expenses} savings={savings} />
      </div>

      {/* Per Account Spending & Top Outbound Beneficiaries Section */}
      <AccountSpendingAndBeneficiariesSection accounts={accounts} dateRangeText={dateRangeText} />
    </div>
  );
}

function AccountSpendingAndBeneficiariesSection({
  accounts,
  dateRangeText,
}: {
  accounts: AccountFlow['accounts'];
  dateRangeText?: string;
}) {
  const [selectedAccId, setSelectedAccId] = useState<string>(accounts[0]?.id || '');
  const [outboundTab, setOutboundTab] = useState<'EXTERNAL' | 'INTERNAL' | 'ALL'>('EXTERNAL');

  const activeAcc = accounts.find((a) => a.id === selectedAccId) || accounts[0];

  if (!activeAcc) return null;

  const categories = activeAcc.categories || activeAcc.cleanCategories || [];
  const totalSpent = (activeAcc as any).spendingAndSettlements ?? activeAcc.cleanOutbound ?? (activeAcc.expenses ? (activeAcc.expenses + (activeAcc.investments ?? 0) + (activeAcc.other ?? 0) + (activeAcc.creditCardPayments ?? 0)) : activeAcc.externalOutbound);

  let displayRecipients = activeAcc.topExternalRecipients || [];
  let otherBound = activeAcc.otherExternalOutbound;

  if (outboundTab === 'INTERNAL') {
    displayRecipients = activeAcc.topInternalRecipients || [];
    otherBound = activeAcc.otherInternalOutbound;
  } else if (outboundTab === 'ALL') {
    displayRecipients = activeAcc.topRecipients || [];
    const totalOtherAmt = (activeAcc.otherExternalOutbound?.amount || 0) + (activeAcc.otherInternalOutbound?.amount || 0);
    const totalOtherCount = (activeAcc.otherExternalOutbound?.count || 0) + (activeAcc.otherInternalOutbound?.count || 0);
    otherBound = { amount: totalOtherAmt, count: totalOtherCount };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Account Selector Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {accounts.map((acc) => {
          const isSelected = acc.id === activeAcc.id;
          const accSpendAmt = (acc as any).spendingAndSettlements ?? acc.cleanOutbound ?? acc.externalOutbound;
          const pillLabel = accSpendAmt > 0 ? `${money(accSpendAmt, true)} spent` : acc.totalInbound > 0 ? `+${money(acc.totalInbound, true)} in` : '₹0 spent';
          return (
            <button
              key={acc.id}
              onClick={() => setSelectedAccId(acc.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '20px',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--line)',
                background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'var(--background-alt)',
                color: isSelected ? 'var(--accent)' : 'var(--ink)',
                fontWeight: isSelected ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <Landmark size={14} color={isSelected ? 'var(--accent)' : 'var(--muted)'} />
              <span>{acc.name}</span>
              <span
                style={{
                  fontSize: '10px',
                  background: isSelected ? 'var(--accent)' : 'var(--line)',
                  color: isSelected ? '#fff' : 'var(--muted)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 600,
                }}
              >
                {pillLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Account Quick Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        <div style={{ background: 'var(--background-alt)', border: '1px solid var(--line)', padding: '12px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <small style={{ color: '#10b981', display: 'block', fontSize: '10px', fontWeight: 600 }}>Total Inbound</small>
            <strong style={{ fontSize: '14px', color: '#10b981' }}>+{money(activeAcc.totalInbound)}</strong>
          </div>
          {activeAcc.internalInbound > 0 && (
            <span style={{ fontSize: '10px', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>
              +{money(activeAcc.internalInbound)} int.
            </span>
          )}
        </div>

        <div style={{ background: 'var(--background-alt)', border: '1px solid var(--line)', padding: '12px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <small style={{ color: '#ef4444', display: 'block', fontSize: '10px', fontWeight: 600 }}>
              Spends & Settlements
            </small>
            <strong style={{ fontSize: '14px', color: '#ef4444' }}>-{money(totalSpent)}</strong>
          </div>
          {activeAcc.internalOutbound > 0 && (
            <span style={{ fontSize: '10px', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>
              -{money(activeAcc.internalOutbound)} int.
            </span>
          )}
        </div>

        <div style={{ background: 'var(--background-alt)', border: '1px solid var(--line)', padding: '12px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <small style={{ color: '#8b5cf6', display: 'block', fontSize: '10px', fontWeight: 600 }}>Investments & SIPs</small>
            <strong style={{ fontSize: '14px', color: '#8b5cf6' }}>{money(activeAcc.investments ?? 0)}</strong>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--muted)', background: 'var(--line)', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>
            Portfolio
          </span>
        </div>
      </div>

      {/* 2-Card Layout: Spending (Doughnut Chart) & Top Outbound Beneficiaries */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Card 1: SPENDING / Where it went */}
        <div style={{ background: 'var(--background-alt)', border: '1px solid var(--line)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="eyebrow" style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                SPENDING & SETTLEMENTS
              </span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)' }}>Where it went</h3>
            </div>
            <span className="month-pill" style={{ fontSize: '11px' }}>{dateRangeText || activeAcc.name}</span>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Doughnut SVG Chart */}
            <AccountDoughnutChart categories={categories} total={totalSpent} />

            {/* Category Breakdown List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', minWidth: '160px' }}>
              {categories.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--ink)', fontWeight: 600 }}>
                    {activeAcc.totalInbound > 0 ? `Received ${money(activeAcc.totalInbound)} in transfers` : 'No transactions recorded'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {activeAcc.totalInbound > 0 ? 'No expenditures or outflows recorded for this account.' : 'Import a statement for this account to see spending breakdowns.'}
                  </span>
                </div>
              ) : (
                categories.slice(0, 7).map((cat, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color || '#94a3b8', flexShrink: 0 }} />
                      <span style={{ color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cat.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <strong style={{ fontSize: '12px', color: 'var(--ink)' }}>{money(cat.amount)}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', width: '30px', textAlign: 'right' }}>{cat.percentage}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Card 2: PAYEES & MERCHANTS / Top Outbound Beneficiaries */}
        <div style={{ background: 'var(--background-alt)', border: '1px solid var(--line)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <span className="eyebrow" style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                PAYEES & MERCHANTS
              </span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)' }}>
                Top Outbound Beneficiaries
              </h3>
            </div>

            {/* Segmented Filter Pills */}
            <div style={{ display: 'inline-flex', gap: '3px', background: 'var(--background)', padding: '3px', borderRadius: '8px', border: '1px solid var(--line)', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setOutboundTab('EXTERNAL')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: outboundTab === 'EXTERNAL' ? 'var(--accent)' : 'transparent',
                  color: outboundTab === 'EXTERNAL' ? '#fff' : 'var(--muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                External
              </button>
              <button
                type="button"
                onClick={() => setOutboundTab('INTERNAL')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: outboundTab === 'INTERNAL' ? '#3b82f6' : 'transparent',
                  color: outboundTab === 'INTERNAL' ? '#fff' : 'var(--muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Internal
              </button>
              <button
                type="button"
                onClick={() => setOutboundTab('ALL')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: outboundTab === 'ALL' ? 'var(--line)' : 'transparent',
                  color: outboundTab === 'ALL' ? 'var(--ink)' : 'var(--muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                All
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            {displayRecipients.length === 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>No beneficiaries recorded for this view</span>
            ) : (
              displayRecipients.map((rec, idx) => {
                const maxAmt = displayRecipients[0]?.amount || 1;
                const barWidthPct = Math.min(100, Math.max(8, Math.round((rec.amount / maxAmt) * 100)));
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
                        <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {rec.name}
                        </span>
                        {rec.isInternal && (
                          <span style={{ fontSize: '9px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, flexShrink: 0 }}>
                            Internal
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <strong style={{ fontSize: '12.5px', color: 'var(--ink)' }}>{money(rec.amount)}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: '10.5px' }}>({rec.count} txn{rec.count === 1 ? '' : 's'})</small>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barWidthPct}%`, background: rec.isInternal ? '#3b82f6' : '#f59e0b', borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })
            )}

            {/* Other / Rest of Bounds Summary Item */}
            {otherBound && otherBound.amount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px dashed var(--line)',
                  background: 'var(--background)',
                  marginTop: '4px',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: '11.5px' }}>
                  {outboundTab === 'EXTERNAL'
                    ? 'Other External Outbounds'
                    : outboundTab === 'INTERNAL'
                    ? 'Other Internal Outbounds'
                    : 'Rest of Outbound Payments'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <strong style={{ fontSize: '12px', color: 'var(--muted)' }}>{money(otherBound.amount)}</strong>
                  <small style={{ color: 'var(--muted)', fontSize: '10.5px' }}>({otherBound.count} txns)</small>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountDoughnutChart({
  categories,
  total,
}: {
  categories: Array<{ name: string; color: string; amount: number; percentage: number }>;
  total: number;
}) {
  const r = 38;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;

  let currentOffset = 0;
  const filtered = categories.filter((c) => c.amount > 0);

  if (total <= 0 || filtered.length === 0) {
    return (
      <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" width="130" height="130">
          <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="var(--line)" strokeWidth="12" />
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <strong style={{ fontSize: '14px', color: 'var(--muted)' }}>₹0</strong>
          <span style={{ fontSize: '9px', color: 'var(--muted)' }}>total</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
        {filtered.map((cat, idx) => {
          const sliceLength = (cat.amount / total) * circumference;
          const strokeDasharray = `${sliceLength} ${circumference - sliceLength}`;
          const strokeDashoffset = -currentOffset;
          currentOffset += sliceLength;

          return (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r={r}
              fill="transparent"
              stroke={cat.color || '#3b82f6'}
              strokeWidth="12"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <strong style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 }}>
          {money(total, true)}
        </strong>
        <span style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 600 }}>total</span>
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

  // Aggregate bank-to-bank internal transfers strictly between savings/bank accounts
  const aggregatedBankTransfers = useMemo(() => {
    const map = new Map<
      string,
      { fromAccountId: string; toAccountId: string; fromAccountName: string; toAccountName: string; totalAmount: number; count: number }
    >();
    for (const it of internalTransfers) {
      if (it.toAccountType === 'CREDIT_CARD' || it.toAccountType === 'UPI_LITE') continue;
      const key = `${it.fromAccountId}_${it.toAccountId}`;
      const ex = map.get(key);
      if (ex) { ex.totalAmount += it.amount; ex.count += 1; }
      else map.set(key, { fromAccountId: it.fromAccountId, toAccountId: it.toAccountId, fromAccountName: it.fromAccountName, toAccountName: it.toAccountName, totalAmount: it.amount, count: 1 });
    }
    return [...map.values()];
  }, [internalTransfers]);

  const [hoveredBankId, setHoveredBankId] = useState<string | null>(null);
  const [hoveredFlow, setHoveredFlow] = useState<{ title: string; amount: string; color: string } | null>(null);

  const getBankColor = (index: number, name: string): string => {
    const lc = name.toLowerCase();
    if (lc.includes('hdfc')) return '#3b82f6';
    if (lc.includes('sbi'))  return '#06b6d4';
    if (lc.includes('axis')) return '#ec4899';
    if (lc.includes('pnb'))  return '#f59e0b';
    if (lc.includes('icici')) return '#8b5cf6';
    const p = ['#3b82f6', '#06b6d4', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#6366f1'];
    return p[index % p.length];
  };

  // ── Layout Dimensions ───────────────────────────────────────────────────
  const SVG_W = 1320;
  const PAD_V = 48;
  const NODE_W = 16;
  const NODE_GAP = 28;
  const MIN_BANK_H = 46;
  const LEFT_X = 160;
  const MID_X = 420;
  const HUB_X = 740;
  const CAT_X = 1050;
  const ARC_X = MID_X + NODE_W + 48;

  // 1. Determine active supergroups (Excluding Bank-to-Bank self-transfers, which are covered directly as interbank arcs)
  const activeSupergroups: SupergroupData[] = useMemo(() => {
    if (overall.supergroups && overall.supergroups.length > 0) {
      return overall.supergroups.filter((sg) => sg.id !== 'INTERNAL_TRANSFERS' && sg.amount > 0);
    }
    return [
      {
        id: 'EXPENSES',
        name: 'Living Expenses',
        kind: 'EXPENSE',
        color: '#ef4444',
        amount: overall.totalExternalOutbound,
        categories: overall.categoryFlow?.outboundCategories || [],
      },
      {
        id: 'INVESTMENTS',
        name: 'Investments',
        kind: 'INVESTMENT',
        color: '#8b5cf6',
        amount: overall.totalInvestments || 0,
        categories: overall.categoryFlow?.investmentCategories || [],
      },
      {
        id: 'CC_PAYMENTS',
        name: 'Credit Card Payments',
        kind: 'TRANSFER',
        color: '#10b981',
        amount: overall.totalCreditCardPayments || 0,
        categories: overall.categoryFlow?.creditCardCategories || [],
      },
    ].filter((sg) => sg.amount > 0);
  }, [overall]);

  // 2. Calculate per-bank volume totals
  const bankVolumes = accounts.map((a, idx) => {
    const tIn = aggregatedBankTransfers.filter((t) => t.toAccountId === a.id).reduce((s, t) => s + t.totalAmount, 0);
    const tOut = aggregatedBankTransfers.filter((t) => t.fromAccountId === a.id).reduce((s, t) => s + t.totalAmount, 0);

    const inTotal = a.externalInbound + (a.internalInbound || tIn);

    // Compute bank's contributions to active supergroups
    const sgContributions: Record<string, number> = {};
    if (a.supergroups) {
      a.supergroups.forEach((sg) => {
        if (activeSupergroups.some((asg) => asg.id === sg.id)) {
          sgContributions[sg.id] = sg.amount;
        }
      });
    } else {
      sgContributions['EXPENSES'] = a.expenses ?? a.externalOutbound;
      if ((a.investments ?? 0) > 0) sgContributions['INVESTMENTS'] = a.investments ?? 0;
      if ((a.other ?? 0) > 0) sgContributions['OTHER'] = a.other ?? 0;
      if ((a.creditCardPayments ?? 0) > 0) sgContributions['CC_PAYMENTS'] = a.creditCardPayments ?? 0;
    }

    const outTotal = Object.values(sgContributions).reduce((s, v) => s + v, 0) + tOut;

    return {
      ...a,
      color: getBankColor(idx, a.name),
      tIn,
      tOut,
      inTotal,
      outTotal,
      sgContributions,
      maxVolume: Math.max(inTotal, outTotal, 1),
    };
  });

  // 3. System volume totals & scaling
  const totalInboundVolume = bankVolumes.reduce((s, b) => s + b.inTotal, 0);
  const totalOutboundVolume = bankVolumes.reduce((s, b) => s + b.outTotal, 0);
  const maxSystemVolume = Math.max(totalInboundVolume, totalOutboundVolume, 1);

  const minHeightNeeded = Math.max(
    accounts.length * MIN_BANK_H + (accounts.length - 1) * NODE_GAP,
    activeSupergroups.length * 56 + (activeSupergroups.length - 1) * NODE_GAP,
    380,
  );
  const usableH = Math.max(460, minHeightNeeded);

  const scale = (usableH * 0.74) / maxSystemVolume;
  const flowH = (amt: number) => (amt > 0 ? Math.max(3, Math.round(amt * scale)) : 0);

  // 4. Position Stage 1: Inbound Node
  const inSlicesData = bankVolumes.filter((b) => b.inTotal > 0).map((b) => flowH(b.inTotal));
  const inboundH = Math.max(40, inSlicesData.reduce((s, h) => s + h, 0));
  const inStartY = PAD_V + (usableH - inboundH) / 2;

  // 5. Position Stage 2: Bank Nodes
  const bankNodes = bankVolumes.map((b) => {
    const sumInH = flowH(b.inTotal);
    const sumOutH = Object.values(b.sgContributions).reduce((s, v) => s + flowH(v), 0) + flowH(b.tOut);
    const nodeHeight = Math.max(MIN_BANK_H, sumInH, sumOutH);
    return {
      ...b,
      sumInH,
      sumOutH,
      height: nodeHeight,
    };
  });

  let bankCurY = PAD_V;
  const bankNodesWithY = bankNodes.map((node) => {
    const n = { ...node, x: MID_X, y: bankCurY };
    bankCurY += node.height + NODE_GAP;
    return n;
  });

  // 6. Position Stage 3: Supergroup Hub Nodes
  const supergroupNodesData = activeSupergroups.map((sg) => {
    const bankIncomingH = bankNodesWithY.reduce((sum, b) => {
      const amt = b.sgContributions[sg.id] || 0;
      return sum + flowH(amt);
    }, 0);

    const baseH = Math.max(36, bankIncomingH > 0 ? bankIncomingH : flowH(sg.amount));
    return {
      ...sg,
      height: baseH,
    };
  });

  const sgGap = 28;
  const totalSgBlockH = supergroupNodesData.reduce((s, sg) => s + sg.height, 0) + (supergroupNodesData.length - 1) * sgGap;
  const sgStartY = PAD_V + Math.max(0, (usableH - totalSgBlockH) / 2);

  let sgCurY = Math.max(PAD_V, sgStartY);
  const supergroupNodesWithY = supergroupNodesData.map((node) => {
    const n = { ...node, x: HUB_X, y: sgCurY };
    sgCurY += node.height + sgGap;
    return n;
  });

  // 7. Position Stage 4: Subgroup Category Nodes (Grouped & Ordered strictly under each parent Supergroup)
  type DisplayCategory = {
    superGroupId: string;
    superGroupName: string;
    superGroupColor: string;
    name: string;
    color: string;
    amount: number;
    height: number;
    x: number;
    y: number;
  };

  const categoryNodesWithY: DisplayCategory[] = [];
  const catGap = 10;
  let catCurY = PAD_V;

  supergroupNodesWithY.forEach((sgNode) => {
    const cats = (sgNode.categories || []).filter((c) => c.amount > 0);
    const sorted = [...cats].sort((a, b) => b.amount - a.amount);
    const topCats = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    const restAmount = rest.reduce((s, c) => s + c.amount, 0);

    const displayList = [
      ...topCats,
      ...(restAmount > 0 ? [{ name: `Other ${sgNode.name.split(' ')[0]}`, color: '#94a3b8', amount: restAmount }] : []),
    ];

    if (displayList.length === 0 && sgNode.amount > 0) {
      displayList.push({ name: sgNode.name, color: sgNode.color, amount: sgNode.amount });
    }

    displayList.forEach((c) => {
      const sliceH = Math.max(18, flowH(c.amount));
      categoryNodesWithY.push({
        superGroupId: sgNode.id,
        superGroupName: sgNode.name,
        superGroupColor: sgNode.color,
        name: c.name,
        color: c.color || sgNode.color,
        amount: c.amount,
        height: sliceH,
        x: CAT_X,
        y: catCurY,
      });
      catCurY += sliceH + catGap;
    });

    catCurY += 12; // Visual spacing between supergroup clusters
  });

  const finalSvgH = Math.max(usableH + PAD_V * 2, bankCurY + PAD_V, sgCurY + PAD_V, catCurY + PAD_V);

  // 8. Ribbon Path Helper
  const ribbon = (x1: number, yT1: number, yB1: number, x2: number, yT2: number, yB2: number) => {
    const cp = (x2 - x1) * 0.42;
    return `M ${x1} ${yT1} C ${x1 + cp} ${yT1},${x2 - cp} ${yT2},${x2} ${yT2} L ${x2} ${yB2} C ${x2 - cp} ${yB2},${x1 + cp} ${yB1},${x1} ${yB1} Z`;
  };

  // 9. Build Stage 1 -> Stage 2 Ribbons (Inbound -> Banks)
  let currInSrcY = inStartY;
  const bankInboundOffset = new Map<string, number>();
  bankNodesWithY.forEach((b) => bankInboundOffset.set(b.id, 0));

  type InSlice = { bank: (typeof bankNodesWithY)[0]; srcT: number; srcB: number; dstT: number; dstB: number };
  const inSlices: InSlice[] = [];

  for (const bank of bankNodesWithY) {
    if (bank.inTotal <= 0) continue;
    const srcH = flowH(bank.inTotal);
    const dstH = srcH;
    const dstOff = bankInboundOffset.get(bank.id)!;

    inSlices.push({
      bank,
      srcT: currInSrcY,
      srcB: currInSrcY + srcH,
      dstT: bank.y + dstOff,
      dstB: bank.y + dstOff + dstH,
    });

    currInSrcY += srcH;
    bankInboundOffset.set(bank.id, dstOff + dstH);
  }

  // 10. Build Stage 2 -> Stage 3 Ribbons (Banks -> Supergroups)
  type SgRibbon = {
    bank: (typeof bankNodesWithY)[0];
    sg: (typeof supergroupNodesWithY)[0];
    amount: number;
    srcT: number;
    srcB: number;
    dstT: number;
    dstB: number;
  };
  const bankToSgRibbons: SgRibbon[] = [];

  const bankOutOffset = new Map<string, number>();
  bankNodesWithY.forEach((b) => bankOutOffset.set(b.id, 0));

  const sgInOffset = new Map<string, number>();
  supergroupNodesWithY.forEach((sg) => sgInOffset.set(sg.id, 0));

  for (const bank of bankNodesWithY) {
    for (const sg of supergroupNodesWithY) {
      const amt = bank.sgContributions[sg.id] || 0;
      if (amt <= 0) continue;

      const sliceH = flowH(amt);
      const bOff = bankOutOffset.get(bank.id)!;
      const sgOff = sgInOffset.get(sg.id)!;

      bankToSgRibbons.push({
        bank,
        sg,
        amount: amt,
        srcT: bank.y + bOff,
        srcB: bank.y + bOff + sliceH,
        dstT: sg.y + sgOff,
        dstB: sg.y + sgOff + sliceH,
      });

      bankOutOffset.set(bank.id, bOff + sliceH);
      sgInOffset.set(sg.id, sgOff + sliceH);
    }
  }

  // 11. Build Stage 3 -> Stage 4 Ribbons (Supergroups -> Subgroup Categories)
  type CatRibbon = {
    sg: (typeof supergroupNodesWithY)[0];
    cat: DisplayCategory;
    amount: number;
    srcT: number;
    srcB: number;
    dstT: number;
    dstB: number;
  };
  const sgToCatRibbons: CatRibbon[] = [];

  const sgOutOffset = new Map<string, number>();
  supergroupNodesWithY.forEach((sg) => sgOutOffset.set(sg.id, 0));

  for (const cat of categoryNodesWithY) {
    const sg = supergroupNodesWithY.find((s) => s.id === cat.superGroupId);
    if (!sg || cat.amount <= 0) continue;

    const sliceH = flowH(cat.amount);
    const sgOff = sgOutOffset.get(sg.id)!;

    sgToCatRibbons.push({
      sg,
      cat,
      amount: cat.amount,
      srcT: sg.y + sgOff,
      srcB: sg.y + sgOff + sliceH,
      dstT: cat.y,
      dstB: cat.y + sliceH,
    });

    sgOutOffset.set(sg.id, sgOff + sliceH);
  }

  return (
    <div style={{ padding: 0, width: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Floating Hover Tooltip */}
      {hoveredFlow && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--card)',
            border: `1.5px solid ${hoveredFlow.color}`,
            borderRadius: 10,
            padding: '5px 16px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--ink)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <span>{hoveredFlow.title}</span>
          <span style={{ color: hoveredFlow.color }}>{hoveredFlow.amount}</span>
        </div>
      )}

      <svg viewBox={`0 0 ${SVG_W} ${finalSvgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          {/* Bank Inbound Gradients */}
          {bankNodesWithY.map((b) => (
            <linearGradient key={`gi-${b.id}`} id={`gi-${b.id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor={b.color} />
            </linearGradient>
          ))}

          {/* Bank to Supergroup Gradients */}
          {bankNodesWithY.flatMap((b) =>
            supergroupNodesWithY.map((sg) => (
              <linearGradient key={`g-bs-${b.id}-${sg.id}`} id={`g-bs-${b.id}-${sg.id}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={b.color} />
                <stop offset="100%" stopColor={sg.color} />
              </linearGradient>
            )),
          )}

          {/* Supergroup to Category Gradients */}
          {categoryNodesWithY.map((c, idx) => (
            <linearGradient key={`g-sc-${idx}`} id={`g-sc-${idx}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c.superGroupColor} />
              <stop offset="100%" stopColor={c.color} />
            </linearGradient>
          ))}
        </defs>

        {/* ── Stage 1 -> Stage 2: Inbound Ribbons ─────────────────── */}
        {inSlices.map(({ bank, srcT, srcB, dstT, dstB }) => {
          const act = !hoveredBankId || hoveredBankId === bank.id;
          return (
            <path
              key={`in-${bank.id}`}
              d={ribbon(LEFT_X + NODE_W, srcT, srcB, MID_X, dstT, dstB)}
              fill={`url(#gi-${bank.id})`}
              opacity={act ? 0.52 : 0.06}
              style={{ transition: 'opacity .18s', cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredBankId(bank.id);
                setHoveredFlow({
                  title: `Inbound → ${bank.name}`,
                  amount: `+${money(bank.inTotal)}`,
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

        {/* ── Stage 2 -> Stage 3: Bank to Supergroup Ribbons ─────── */}
        {bankToSgRibbons.map((r, idx) => {
          const act = !hoveredBankId || hoveredBankId === r.bank.id;
          return (
            <path
              key={`bs-ribbon-${idx}`}
              d={ribbon(MID_X + NODE_W, r.srcT, r.srcB, HUB_X, r.dstT, r.dstB)}
              fill={`url(#g-bs-${r.bank.id}-${r.sg.id})`}
              opacity={act ? 0.52 : 0.06}
              style={{ transition: 'opacity .18s', cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredBankId(r.bank.id);
                setHoveredFlow({
                  title: `${r.bank.name} → ${r.sg.name}`,
                  amount: `-${money(r.amount)}`,
                  color: r.sg.color,
                });
              }}
              onMouseLeave={() => {
                setHoveredBankId(null);
                setHoveredFlow(null);
              }}
            />
          );
        })}

        {/* ── Stage 3 -> Stage 4: Supergroup to Category Ribbons ── */}
        {sgToCatRibbons.map((r, idx) => {
          return (
            <path
              key={`sc-ribbon-${idx}`}
              d={ribbon(HUB_X + NODE_W, r.srcT, r.srcB, CAT_X, r.dstT, r.dstB)}
              fill={`url(#g-sc-${idx})`}
              opacity={0.52}
              style={{ transition: 'opacity .18s', cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredFlow({
                  title: `${r.sg.name} → ${r.cat.name}`,
                  amount: money(r.amount),
                  color: r.cat.color,
                });
              }}
              onMouseLeave={() => {
                setHoveredFlow(null);
              }}
            />
          );
        })}

        {/* ── Stage 2 Internal Bank-to-Bank Arcs ─────────────────── */}
        {aggregatedBankTransfers.map((it, idx) => {
          const fromNode = bankNodesWithY.find((b) => b.id === it.fromAccountId);
          const toNode = bankNodesWithY.find((b) => b.id === it.toAccountId);
          if (!fromNode || !toNode) return null;

          const fromY = fromNode.y + fromNode.height * 0.72;
          const toY = toNode.y + toNode.height * 0.28;
          const peakX = ARC_X + idx * 20;
          const midY = (fromY + toY) / 2;
          const sw = Math.max(2, Math.min(7, Math.round(flowH(it.totalAmount))));
          const act = !hoveredBankId || hoveredBankId === fromNode.id || hoveredBankId === toNode.id;
          const arcPath = `M ${MID_X + NODE_W} ${fromY} C ${peakX} ${fromY},${peakX} ${toY},${MID_X + NODE_W} ${toY}`;
          const fromShort = fromNode.name.split(/[\s–-]/)[0];
          const toShort = toNode.name.split(/[\s–-]/)[0];
          const label = `${fromShort} → ${toShort}  ${money(it.totalAmount)}`;

          return (
            <g
              key={`arc-${idx}`}
              style={{ opacity: act ? 1 : 0.1, transition: 'opacity .18s', cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredBankId(fromNode.id);
                setHoveredFlow({
                  title: `Inter-Bank: ${it.fromAccountName} → ${it.toAccountName}`,
                  amount: money(it.totalAmount),
                  color: fromNode.color,
                });
              }}
              onMouseLeave={() => {
                setHoveredBankId(null);
                setHoveredFlow(null);
              }}
            >
              <path d={arcPath} fill="none" stroke={fromNode.color} strokeWidth={sw} strokeOpacity={0.75} />
              <polygon
                points={`${MID_X + NODE_W},${toY} ${MID_X + NODE_W - 7},${toY - 5} ${MID_X + NODE_W - 7},${toY + 5}`}
                fill={fromNode.color}
                opacity={0.85}
              />
              <g transform={`translate(${peakX + 8}, ${midY - 10})`}>
                <rect
                  x="0"
                  y="0"
                  width={label.length * 6.5 + 12}
                  height="20"
                  rx="5"
                  fill="var(--card)"
                  stroke={fromNode.color}
                  strokeWidth="1"
                  style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))' }}
                />
                <rect
                  x="0"
                  y="0"
                  width={label.length * 6.5 + 12}
                  height="20"
                  rx="5"
                  fill={fromNode.color}
                  fillOpacity={0.08}
                />
                <text x="6" y="14" fill={fromNode.color} fontSize="10.5" fontWeight="700">
                  {label}
                </text>
              </g>
            </g>
          );
        })}

        {/* ── Stage 1 Node: External Inbound ────────────────────── */}
        <rect x={LEFT_X} y={inStartY} width={NODE_W} height={inboundH} fill="#10b981" rx="4" />
        <text x={LEFT_X - 12} y={inStartY + inboundH / 2 - 8} fill="var(--ink)" fontSize="13" fontWeight="700" textAnchor="end">
          External Inbound
        </text>
        <text x={LEFT_X - 12} y={inStartY + inboundH / 2 + 10} fill="#059669" fontSize="12" fontWeight="700" textAnchor="end">
          +{money(overall.totalExternalInbound)}
        </text>

        {/* ── Stage 2 Nodes: Bank Funding Accounts ──────────────── */}
        {bankNodesWithY.map((bank) => {
          const act = !hoveredBankId || hoveredBankId === bank.id;
          const lx = MID_X + NODE_W + 10;
          const midY = bank.y + bank.height / 2;
          return (
            <g
              key={`node-${bank.id}`}
              style={{ opacity: act ? 1 : 0.28, transition: 'opacity .18s', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredBankId(bank.id)}
              onMouseLeave={() => setHoveredBankId(null)}
            >
              <rect
                x={bank.x}
                y={bank.y}
                width={NODE_W}
                height={bank.height}
                fill={bank.color}
                rx="4"
                style={{ filter: hoveredBankId === bank.id ? `drop-shadow(0 0 7px ${bank.color})` : 'none' }}
              />
              <rect x={lx} y={midY - 7} width={6} height={6} rx="3" fill={bank.color} />
              <text x={lx + 9} y={midY - 1} fill="var(--ink)" fontSize="13" fontWeight="700">
                {bank.name}
              </text>
              <text x={lx + 9} y={midY + 14} fontSize="11">
                <tspan fill="#059669" fontWeight="700">+{money(bank.inTotal)}</tspan>
                <tspan fill="var(--muted)"> / </tspan>
                <tspan fill="#dc2626" fontWeight="700">-{money(bank.outTotal)}</tspan>
              </text>
            </g>
          );
        })}

        {/* ── Stage 3 Nodes: Supergroup Hubs ───────────────────── */}
        {supergroupNodesWithY.map((sgNode) => {
          const midY = sgNode.y + sgNode.height / 2;
          return (
            <g key={`sg-node-${sgNode.id}`}>
              <rect x={sgNode.x} y={sgNode.y} width={NODE_W} height={sgNode.height} fill={sgNode.color} rx="4" />
              <g transform={`translate(${HUB_X + NODE_W + 10}, ${midY - 17})`}>
                <rect
                  x="0"
                  y="0"
                  width={154}
                  height={34}
                  rx={6}
                  fill="var(--card)"
                  stroke={sgNode.color}
                  strokeWidth="1.2"
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.07))' }}
                />
                <rect
                  x="0"
                  y="0"
                  width={154}
                  height={34}
                  rx={6}
                  fill={sgNode.color}
                  fillOpacity={0.09}
                />
                <text x="10" y="14" fill="var(--ink)" fontSize="11.5" fontWeight="700">
                  {sgNode.name}
                </text>
                <text x="10" y="27" fill={sgNode.color} fontSize="11" fontWeight="800">
                  {money(sgNode.amount)}
                </text>
              </g>
            </g>
          );
        })}

        {/* ── Stage 4 Nodes: Subgroup Categories ──────────────── */}
        {categoryNodesWithY.map((catNode, idx) => {
          const midY = catNode.y + catNode.height / 2;
          return (
            <g key={`cat-node-${idx}-${catNode.name}`}>
              <rect x={catNode.x} y={catNode.y} width={NODE_W} height={catNode.height} fill={catNode.color} rx="4" />
              <rect x={CAT_X + NODE_W + 8} y={midY - 5} width={6} height={6} rx="3" fill={catNode.color} />
              <text x={CAT_X + NODE_W + 18} y={midY - 1} fill="var(--ink)" fontSize="12" fontWeight="700">
                {catNode.name}
              </text>
              <text x={CAT_X + NODE_W + 18} y={midY + 13} fill="var(--muted)" fontSize="11" fontWeight="600">
                {money(catNode.amount)}
              </text>
            </g>
          );
        })}
      </svg>
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
