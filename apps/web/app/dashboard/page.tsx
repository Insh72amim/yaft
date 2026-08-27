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
import { EnvelopesOverviewSection } from '@/components/dashboard/envelopes-overview-section';
import { ExpenseAnalyticsChart } from '@/components/dashboard/expense-analytics-chart';
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

  const selectedMonth = useMemo(() => {
    const d = new Date(endDate);
    return isNaN(d.getTime()) ? new Date().getMonth() + 1 : d.getUTCMonth() + 1;
  }, [endDate]);

  const selectedYear = useMemo(() => {
    const d = new Date(endDate);
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getUTCFullYear();
  }, [endDate]);

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

      {/* Expense Analytics & Stacked Subcategory Bar Chart */}
      <ExpenseAnalyticsChart
        startDate={startDate}
        endDate={endDate}
        onRefreshNeeded={() => void load()}
      />

      {/* Real-time Expense Categories & Envelopes + All Expense Transactions Ledger */}
      <EnvelopesOverviewSection
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        monthLabel={monthLabel}
        onBudgetUpdated={() => void load()}
      />

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

      {/* Per Account Spending & Top Outbound Beneficiaries Section */}
      <AccountSpendingAndBeneficiariesSection accounts={accounts} overall={overall} dateRangeText={dateRangeText} />
    </div>
  );
}

function AccountSpendingAndBeneficiariesSection({
  accounts,
  overall,
  dateRangeText,
}: {
  accounts: AccountFlow['accounts'];
  overall?: AccountFlow['overall'];
  dateRangeText?: string;
}) {
  const [selectedAccId, setSelectedAccId] = useState<string>('ALL');
  const [outboundTab, setOutboundTab] = useState<'EXTERNAL' | 'INTERNAL' | 'ALL'>('EXTERNAL');

  // Aggregated data for "All Banks"
  const allCategories = useMemo(() => {
    const map = new Map<string, { name: string; color: string; amount: number }>();
    for (const acc of accounts) {
      const accCats = (acc.categories || acc.cleanCategories || []).filter(
        (c) => !/^\s*(?:cc transfer|upi lite|internal transfer|transfer|self transfer|credit card payment|credit card|card payment|wallet top-up|wallet transfer)\s*$/i.test(c.name),
      );
      for (const c of accCats) {
        if (c.amount <= 0) continue;
        const key = c.name.trim().toLowerCase();
        const ex = map.get(key);
        if (ex) {
          ex.amount += c.amount;
        } else {
          map.set(key, { name: c.name.trim(), color: c.color || '#3b82f6', amount: c.amount });
        }
      }
    }
    const list = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    const sum = list.reduce((s, c) => s + c.amount, 0) || 1;
    return list.map((c) => ({
      ...c,
      percentage: Math.round((c.amount / sum) * 100),
    }));
  }, [accounts]);

  const allTotalSpent = allCategories.reduce((sum, c) => sum + c.amount, 0) || (overall?.totalExternalOutbound ? (overall.totalExternalOutbound + (overall.totalInvestments || 0)) : 0);
  const allTotalInbound = overall?.totalExternalInbound || accounts.reduce((sum, a) => sum + a.externalInbound, 0);
  const allInvestmentsTotal = overall?.totalInvestments !== undefined ? overall.totalInvestments : accounts.reduce((sum, a) => sum + (a.investments || 0), 0);
  const allInternalInbound = accounts.reduce((sum, a) => sum + (a.internalInbound || 0), 0);
  const allInternalOutbound = accounts.reduce((sum, a) => sum + (a.internalOutbound || 0), 0);

  const allTopRecipients = useMemo(() => {
    const aggregate = (getter: (acc: (typeof accounts)[0]) => Array<{ name: string; amount: number; count: number; isInternal?: boolean }> | undefined) => {
      const map = new Map<string, { name: string; amount: number; count: number; isInternal?: boolean }>();
      for (const acc of accounts) {
        const list = getter(acc) || [];
        for (const item of list) {
          const key = item.name.trim().toLowerCase();
          const ex = map.get(key);
          if (ex) {
            ex.amount += item.amount;
            ex.count += item.count;
          } else {
            map.set(key, { name: item.name.trim(), amount: item.amount, count: item.count, isInternal: item.isInternal });
          }
        }
      }
      return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    };

    const external = aggregate((a) => a.topExternalRecipients);
    const internal = aggregate((a) => a.topInternalRecipients);
    const all = aggregate((a) => a.topRecipients || a.topExternalRecipients);

    const otherExtAmt = accounts.reduce((s, a) => s + (a.otherExternalOutbound?.amount || 0), 0);
    const otherExtCount = accounts.reduce((s, a) => s + (a.otherExternalOutbound?.count || 0), 0);

    const otherIntAmt = accounts.reduce((s, a) => s + (a.otherInternalOutbound?.amount || 0), 0);
    const otherIntCount = accounts.reduce((s, a) => s + (a.otherInternalOutbound?.count || 0), 0);

    return {
      external: external.slice(0, 7),
      internal: internal.slice(0, 7),
      all: all.slice(0, 7),
      otherExternal: { amount: otherExtAmt, count: otherExtCount },
      otherInternal: { amount: otherIntAmt, count: otherIntCount },
      otherAll: { amount: otherExtAmt + otherIntAmt, count: otherExtCount + otherIntCount },
    };
  }, [accounts]);

  const isAll = selectedAccId === 'ALL';
  const activeAcc = isAll ? null : (accounts.find((a) => a.id === selectedAccId) || accounts[0]);

  const categories = isAll
    ? allCategories
    : (activeAcc?.categories || activeAcc?.cleanCategories || []).filter(
        (c) => !/^\s*(?:cc transfer|upi lite|internal transfer|transfer|self transfer|credit card payment|credit card|card payment|wallet top-up|wallet transfer)\s*$/i.test(c.name),
      );

  const totalSpent = isAll
    ? allTotalSpent
    : categories.reduce((sum, c) => sum + c.amount, 0) || Number((activeAcc as any)?.spendingAndSettlements ?? activeAcc?.cleanOutbound ?? (activeAcc?.expenses ? (activeAcc.expenses + (activeAcc.investments ?? 0) + (activeAcc.other ?? 0) + (activeAcc.creditCardPayments ?? 0)) : activeAcc?.externalOutbound));

  const totalInbound = isAll ? allTotalInbound : (activeAcc?.totalInbound || 0);
  const internalInbound = isAll ? allInternalInbound : (activeAcc?.internalInbound || 0);
  const internalOutbound = isAll ? allInternalOutbound : (activeAcc?.internalOutbound || 0);
  const investments = isAll ? allInvestmentsTotal : (activeAcc?.investments ?? 0);

  let displayRecipients: Array<{ name: string; amount: number; count: number; isInternal?: boolean }> = [];
  let otherBound: { amount: number; count: number } | undefined = undefined;

  if (isAll) {
    if (outboundTab === 'EXTERNAL') {
      displayRecipients = allTopRecipients.external;
      otherBound = allTopRecipients.otherExternal;
    } else if (outboundTab === 'INTERNAL') {
      displayRecipients = allTopRecipients.internal;
      otherBound = allTopRecipients.otherInternal;
    } else {
      displayRecipients = allTopRecipients.all;
      otherBound = allTopRecipients.otherAll;
    }
  } else if (activeAcc) {
    if (outboundTab === 'INTERNAL') {
      displayRecipients = activeAcc.topInternalRecipients || [];
      otherBound = activeAcc.otherInternalOutbound;
    } else if (outboundTab === 'ALL') {
      displayRecipients = activeAcc.topRecipients || [];
      const totalOtherAmt = (activeAcc.otherExternalOutbound?.amount || 0) + (activeAcc.otherInternalOutbound?.amount || 0);
      const totalOtherCount = (activeAcc.otherExternalOutbound?.count || 0) + (activeAcc.otherInternalOutbound?.count || 0);
      otherBound = { amount: totalOtherAmt, count: totalOtherCount };
    } else {
      displayRecipients = activeAcc.topExternalRecipients || [];
      otherBound = activeAcc.otherExternalOutbound;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Account Selector Tabs (All Banks + Individual Bank Accounts) */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {/* All Banks Master Tab */}
        <button
          type="button"
          onClick={() => setSelectedAccId('ALL')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '20px',
            border: isAll ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: isAll ? 'rgba(16, 185, 129, 0.1)' : 'var(--background-alt)',
            color: isAll ? 'var(--accent)' : 'var(--ink)',
            fontWeight: isAll ? 700 : 500,
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Building2 size={14} color={isAll ? 'var(--accent)' : 'var(--muted)'} />
          <span>All Banks</span>
          <span
            style={{
              fontSize: '10px',
              background: isAll ? 'var(--accent)' : 'var(--line)',
              color: isAll ? '#fff' : 'var(--muted)',
              padding: '1px 6px',
              borderRadius: '10px',
              fontWeight: 600,
            }}
          >
            {allTotalSpent > 0 ? `${money(allTotalSpent, true)} spent` : '₹0 spent'}
          </span>
        </button>

        {/* Individual Account Tabs */}
        {accounts.map((acc) => {
          const isSelected = selectedAccId === acc.id;
          const accCats = (acc.categories || acc.cleanCategories || []).filter(
            (c) => !/^\s*(?:cc transfer|upi lite|internal transfer|transfer|self transfer|credit card payment|credit card|card payment|wallet top-up|wallet transfer)\s*$/i.test(c.name),
          );
          const accSpendAmt = accCats.reduce((sum, c) => sum + c.amount, 0) || Number((acc as any).spendingAndSettlements ?? acc.cleanOutbound ?? acc.externalOutbound);
          const pillLabel = accSpendAmt > 0 ? `${money(accSpendAmt, true)} spent` : acc.totalInbound > 0 ? `+${money(acc.totalInbound, true)} in` : '₹0 spent';
          return (
            <button
              key={acc.id}
              type="button"
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
            <strong style={{ fontSize: '14px', color: '#10b981' }}>+{money(totalInbound)}</strong>
          </div>
          {internalInbound > 0 && (
            <span style={{ fontSize: '10px', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>
              +{money(internalInbound)} int.
            </span>
          )}
        </div>

        <div style={{ background: 'var(--background-alt)', border: '1px solid var(--line)', padding: '12px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <small style={{ color: '#ef4444', display: 'block', fontSize: '10px', fontWeight: 600 }}>
              Actual Spending
            </small>
            <strong style={{ fontSize: '14px', color: '#ef4444' }}>-{money(totalSpent)}</strong>
          </div>
          {internalOutbound > 0 && (
            <span style={{ fontSize: '10px', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>
              -{money(internalOutbound)} int.
            </span>
          )}
        </div>

        <div style={{ background: 'var(--background-alt)', border: '1px solid var(--line)', padding: '12px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <small style={{ color: '#8b5cf6', display: 'block', fontSize: '10px', fontWeight: 600 }}>Investments & SIPs</small>
            <strong style={{ fontSize: '14px', color: '#8b5cf6' }}>{money(investments)}</strong>
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
                SPENDING BY CATEGORY
              </span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)' }}>Where it went</h3>
            </div>
            <span className="month-pill" style={{ fontSize: '11px' }}>{dateRangeText || (isAll ? 'All Accounts' : activeAcc?.name)}</span>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Doughnut SVG Chart */}
            <AccountDoughnutChart categories={categories} total={totalSpent} />

            {/* Category Breakdown List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', minWidth: '160px' }}>
              {categories.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--ink)', fontWeight: 600 }}>
                    {totalInbound > 0 ? `Received ${money(totalInbound)} in transfers` : 'No transactions recorded'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {totalInbound > 0 ? 'No expenditures or outflows recorded.' : 'Import a statement to see spending breakdowns.'}
                  </span>
                </div>
              ) : (
                categories.slice(0, 8).map((cat, idx) => (
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
