'use client';
import { ArrowDownRight, ArrowUpRight, CalendarDays, WalletCards, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';

type Account = { id: string; name: string; type: string; balance: number; creditLimit: number | null; dueDay: number | null };
type Owner = { id: string; name: string; email: string };
type Dashboard = { month: string; income: number; expenses: number; savings: number; savingsRate: number; netWorth: number; accounts: Account[];
  categories: { name: string; color: string; amount: number }[]; recent: { id: string; date: string; description: string; amount: number; category: string; account: string; isTransfer: boolean }[] };

export default function DashboardPage() {
  const router = useRouter(); 
  const [data, setData] = useState<Dashboard>(); 
  const [owner, setOwner] = useState<Owner>(); 
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    setError('');
    try {
      const [overview, profile] = await Promise.all([api<Dashboard>(`/dashboard?month=${encodeURIComponent(selectedMonth)}`), api<Owner>('/auth/me')]);
      setData(overview); setOwner(profile);
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load your overview.'));
    }
  }, [router, selectedMonth]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <Shell><div className="loading"><span/><p>Loading your dashboard…</p></div></Shell>;

  const totalSpend = data.categories.reduce((sum, category) => sum + category.amount, 0);
  const monthLabel = new Date(`${data.month}-02T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  
  let angle = 0; 
  const gradient = data.categories.length ? data.categories.map((category) => { 
    const start = angle; angle += totalSpend ? category.amount / totalSpend * 360 : 0; 
    return `${category.color} ${start}deg ${angle}deg`; 
  }).join(',') : '#e2e8f0 0deg 360deg';

  const assetCategories = [
    { name: 'Savings Accounts', types: ['BANK', 'SAVINGS'], color: '#3b82f6' },
    { name: 'Fixed Deposits', types: ['FIXED_DEPOSIT'], color: '#0ea5e9' },
    { name: 'Investments', types: ['STOCKS', 'INVESTMENT'], color: '#10b981' },
    { name: 'EPFO', types: ['EPFO'], color: '#f59e0b' },
  ];
  
  const assetData = assetCategories.map(cat => {
    const value = data.accounts.filter(a => cat.types.includes(a.type) && a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
    return { ...cat, value };
  }).filter(c => c.value > 0);
  
  const totalAssets = assetData.reduce((sum, c) => sum + c.value, 0);
  let assetAngle = 0;
  const assetGradient = assetData.length ? assetData.map((category) => {
    const start = assetAngle; assetAngle += totalAssets ? category.value / totalAssets * 360 : 0;
    return `${category.color} ${start}deg ${assetAngle}deg`;
  }).join(',') : '#e2e8f0 0deg 360deg';

  return (
    <Shell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Financial home</span>
          <h1>Good to see you{owner?.name ? `, ${owner.name.trim().split(/\s+/)[0]}` : ''}.</h1>
          <p>Here’s how your money moved in {monthLabel}.</p>
        </div>
        <div className="dashboard-actions">
          <label className="month-control">
            <CalendarDays/>
            <input aria-label="Dashboard month" type="month" value={selectedMonth} onChange={(event) => { if (event.target.value) setSelectedMonth(event.target.value); }} />
          </label>
        </div>
      </header>
      
      {error && <p className="error" role="alert">{error}</p>}

      <section className="hero-card">
        <div>
          <span>Net worth</span><strong>{money(data.netWorth)}</strong>
          <small><TrendingUp size={15}/>Across {data.accounts.length} account{data.accounts.length === 1 ? '' : 's'}</small>
        </div>
        <div className="hero-orbit">
          <span>{data.savingsRate}%</span><small>savings rate</small>
        </div>
      </section>

      <section className="summary-grid">
        <article><span className="summary-icon income"><ArrowUpRight/></span><div><small>Income</small><strong>{money(data.income)}</strong><em>{monthLabel}</em></div></article>
        <article><span className="summary-icon expense"><ArrowDownRight/></span><div><small>Spent</small><strong>{money(data.expenses)}</strong><em>{monthLabel}</em></div></article>
        <article><span className="summary-icon saved"><WalletCards/></span><div><small>Saved</small><strong>{money(data.savings)}</strong><em>{data.savingsRate}% of income</em></div></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel spending-panel">
          <div className="panel-title">
            <div><span className="eyebrow">Spending</span><h2>Where it went</h2></div>
            <span className="month-pill"><CalendarDays size={14}/>{monthLabel}</span>
          </div>
          {data.categories.length ? (
            <div className="spending-body">
              <div className="donut" style={{ background: `conic-gradient(${gradient})` }}>
                <div><strong>{money(data.expenses, true)}</strong><span>total</span></div>
              </div>
              <div className="legend">
                {data.categories.slice(0, 5).map((category) => (
                  <div key={category.name}>
                    <i style={{ background: category.color }}/>
                    <span>{category.name}</span>
                    <strong>{money(category.amount)}</strong>
                    <small>{totalSpend ? Math.round(category.amount / totalSpend * 100) : 0}%</small>
                  </div>
                ))}
              </div>
            </div>
          ) : <Empty text="Import a statement to see your spending pattern."/>}
        </article>

        <article className="panel spending-panel">
          <div className="panel-title">
            <div><span className="eyebrow">Assets</span><h2>Asset Allocation</h2></div>
          </div>
          {assetData.length ? (
            <div className="spending-body">
              <div className="donut" style={{ background: `conic-gradient(${assetGradient})` }}>
                <div><strong>{money(totalAssets, true)}</strong><span>total</span></div>
              </div>
              <div className="legend">
                {assetData.map((category) => (
                  <div key={category.name}>
                    <i style={{ background: category.color }}/>
                    <span>{category.name}</span>
                    <strong>{money(category.value)}</strong>
                    <small>{totalAssets ? Math.round(category.value / totalAssets * 100) : 0}%</small>
                  </div>
                ))}
              </div>
            </div>
          ) : <Empty text="No positive asset balances found."/>}
        </article>
      </section>

      <section className="panel transactions">
        <div className="panel-title"><div><span className="eyebrow">Activity</span><h2>Recent transactions</h2></div></div>
        {data.recent.length ? (
          <div className="transaction-list">
            {data.recent.map((item) => (
              <div key={item.id}>
                <span className="transaction-date">{new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                <div>
                  <strong>{item.description}</strong>
                  <small>{item.account} · {item.isTransfer ? 'Transfer' : item.category}</small>
                </div>
                <b className={item.amount > 0 ? 'positive' : ''}>{item.amount > 0 ? '+' : ''}{money(item.amount)}</b>
              </div>
            ))}
          </div>
        ) : <Empty text="Reviewed transactions will appear here."/>}
      </section>
    </Shell>
  );
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>◎</span><p>{text}</p></div>; }
