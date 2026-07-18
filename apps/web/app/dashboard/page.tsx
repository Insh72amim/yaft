'use client';
import { ArrowDownRight, ArrowUpRight, BadgeIndianRupee, Building2, CalendarDays, CreditCard, Landmark, PiggyBank, Plus, TrendingUp, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';

type Account = { id: string; name: string; type: string; balance: number; creditLimit: number | null; dueDay: number | null };
type Dashboard = { month: string; income: number; expenses: number; savings: number; savingsRate: number; netWorth: number; accounts: Account[];
  categories: { name: string; color: string; amount: number }[]; recent: { id: string; date: string; description: string; amount: number; category: string; account: string; isTransfer: boolean }[] };

const accountChoices = [
  { type: 'SAVINGS', label: 'Savings account', detail: 'Salary or everyday banking', icon: PiggyBank },
  { type: 'FIXED_DEPOSIT', label: 'Fixed deposit', detail: 'Bank FD and term deposits', icon: Landmark },
  { type: 'CREDIT_CARD', label: 'Credit card', detail: 'Limit, outstanding and due day', icon: CreditCard },
  { type: 'LOAN', label: 'Loan account', detail: 'Home, vehicle or personal loan', icon: BadgeIndianRupee },
  { type: 'STOCKS', label: 'Stock account', detail: 'Broker and demat portfolio', icon: TrendingUp },
  { type: 'EPFO', label: 'EPFO account', detail: 'Provident-fund balance', icon: Building2 },
] as const;

const accountSections = [
  { label: 'Bank accounts', types: ['SAVINGS', 'FIXED_DEPOSIT', 'BANK'] },
  { label: 'Credit cards', types: ['CREDIT_CARD'] },
  { label: 'Loan accounts', types: ['LOAN'] },
  { label: 'Stock accounts', types: ['STOCKS', 'INVESTMENT'] },
  { label: 'EPFO accounts', types: ['EPFO'] },
];

const typeLabel: Record<string, string> = { BANK: 'Bank account', SAVINGS: 'Savings account', FIXED_DEPOSIT: 'Fixed deposit',
  CREDIT_CARD: 'Credit card', LOAN: 'Loan account', STOCKS: 'Stock account', INVESTMENT: 'Investment account', EPFO: 'EPFO account', CASH: 'Cash' };

export default function DashboardPage() {
  const router = useRouter(); const [data, setData] = useState<Dashboard>(); const [error, setError] = useState(''); const [adding, setAdding] = useState(false); const [newType, setNewType] = useState('SAVINGS');
  const load = useCallback(() => api<Dashboard>('/dashboard').then(setData).catch((reason: unknown) => { if (isUnauthorized(reason)) router.replace('/login'); else setError(errorMessage(reason, 'Could not load your overview.')); }), [router]);
  useEffect(() => { load(); }, [load]);
  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const type = String(form.get('type'));
    const enteredBalance = Math.round(Number(form.get('openingBalance') || 0) * 100); const isLiability = type === 'CREDIT_CARD' || type === 'LOAN';
    await api('/accounts', { method: 'POST', body: JSON.stringify({ name: form.get('name'), institution: form.get('institution') || undefined, type,
      openingBalance: isLiability ? -Math.abs(enteredBalance) : enteredBalance, creditLimit: type === 'CREDIT_CARD' ? Math.round(Number(form.get('creditLimit') || 0) * 100) : undefined,
      dueDay: type === 'CREDIT_CARD' ? Number(form.get('dueDay') || 1) : undefined }) }); setAdding(false); load();
  }
  if (!data) return <Shell><div className="loading"><span/><p>{error || 'Building your financial picture…'}</p></div></Shell>;
  const totalSpend = data.categories.reduce((sum, category) => sum + category.amount, 0);
  let angle = 0; const gradient = data.categories.length ? data.categories.map((category) => { const start = angle; angle += totalSpend ? category.amount / totalSpend * 360 : 0; return `${category.color} ${start}deg ${angle}deg`; }).join(',') : '#e2e8f0 0deg 360deg';
  return <Shell><header className="page-header"><div><span className="eyebrow">Financial home</span><h1>Good to see you, User.</h1><p>Here’s how your money is moving this month.</p></div><button className="secondary" onClick={() => setAdding(true)}><Plus size={17}/>Add account</button></header>
    <section className="hero-card"><div><span>Net worth</span><strong>{money(data.netWorth)}</strong><small><TrendingUp size={15}/>Across {data.accounts.length} account{data.accounts.length === 1 ? '' : 's'}</small></div><div className="hero-orbit"><span>{data.savingsRate}%</span><small>savings rate</small></div></section>
    <section className="summary-grid">
      <article><span className="summary-icon income"><ArrowUpRight/></span><div><small>Income</small><strong>{money(data.income)}</strong><em>This month</em></div></article>
      <article><span className="summary-icon expense"><ArrowDownRight/></span><div><small>Spent</small><strong>{money(data.expenses)}</strong><em>This month</em></div></article>
      <article><span className="summary-icon saved"><WalletCards/></span><div><small>Saved</small><strong>{money(data.savings)}</strong><em>{data.savingsRate}% of income</em></div></article>
    </section>
    <section className="dashboard-grid"><article className="panel spending-panel"><div className="panel-title"><div><span className="eyebrow">Spending</span><h2>Where it went</h2></div><span className="month-pill"><CalendarDays size={14}/>{new Date(`${data.month}-02`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span></div>
      {data.categories.length ? <div className="spending-body"><div className="donut" style={{ background: `conic-gradient(${gradient})` }}><div><strong>{money(data.expenses, true)}</strong><span>total</span></div></div><div className="legend">{data.categories.slice(0, 5).map((category) => <div key={category.name}><i style={{ background: category.color }}/><span>{category.name}</span><strong>{money(category.amount)}</strong><small>{totalSpend ? Math.round(category.amount / totalSpend * 100) : 0}%</small></div>)}</div></div> : <Empty text="Import a statement to see your spending pattern."/>}
    </article><article className="panel accounts-panel"><div className="panel-title"><div><span className="eyebrow">Balances</span><h2>Your accounts</h2></div></div><div className="account-groups">{accountSections.map((section) => { const accounts = data.accounts.filter((account) => section.types.includes(account.type)); return <section className="account-group" key={section.label}><header><strong>{section.label}</strong><span>{accounts.length}</span></header>{accounts.length ? <div className="account-list">{accounts.map((account) => <AccountRow account={account} key={account.id}/>)}</div> : <p>No account added</p>}</section>; })}</div></article></section>
    <section className="panel transactions"><div className="panel-title"><div><span className="eyebrow">Activity</span><h2>Recent transactions</h2></div></div>{data.recent.length ? <div className="transaction-list">{data.recent.map((item) => <div key={item.id}><span className="transaction-date">{new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span><div><strong>{item.description}</strong><small>{item.account} · {item.isTransfer ? 'Transfer' : item.category}</small></div><b className={item.amount > 0 ? 'positive' : ''}>{item.amount > 0 ? '+' : ''}{money(item.amount)}</b></div>)}</div> : <Empty text="Reviewed transactions will appear here."/>}</section>
    {adding && <div className="modal-wrap"><button className="backdrop" onClick={() => setAdding(false)} aria-label="Close"/><form className="modal account-modal" onSubmit={addAccount}><div><span className="eyebrow">New account</span><h2>What kind of account?</h2><p>Choose a clear financial category. You’ll only see fields relevant to it.</p></div><input type="hidden" name="type" value={newType}/><div className="account-choice-groups"><span>Bank accounts</span><div className="account-choice-grid bank-choices">{accountChoices.slice(0, 2).map((choice) => <AccountChoice key={choice.type} choice={choice} selected={newType === choice.type} onSelect={setNewType}/>)}</div><span>Other financial accounts</span><div className="account-choice-grid">{accountChoices.slice(2).map((choice) => <AccountChoice key={choice.type} choice={choice} selected={newType === choice.type} onSelect={setNewType}/>)}</div></div><div className="account-fields"><label>Account name<input name="name" required placeholder={accountPlaceholder(newType)} /></label><label>{newType === 'STOCKS' ? 'Broker' : newType === 'EPFO' ? 'Organisation / employer' : 'Institution'}<input name="institution" placeholder={institutionPlaceholder(newType)} /></label><label>{balanceLabel(newType)} (₹)<input name="openingBalance" type="number" min="0" step="0.01" defaultValue="0" /></label>{newType === 'CREDIT_CARD' && <div className="form-row"><label>Card limit (₹)<input name="creditLimit" type="number" min="0" required /></label><label>Payment due day<input name="dueDay" type="number" min="1" max="31" required /></label></div>}</div><div className="modal-actions"><button type="button" className="ghost" onClick={() => setAdding(false)}>Cancel</button><button className="primary">Add {typeLabel[newType].toLowerCase()}</button></div></form></div>}
  </Shell>;
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>◎</span><p>{text}</p></div>; }

function AccountChoice({ choice, selected, onSelect }: { choice: typeof accountChoices[number]; selected: boolean; onSelect: (type: string) => void }) {
  const Icon = choice.icon; return <button type="button" className={`account-choice ${selected ? 'selected' : ''}`} onClick={() => onSelect(choice.type)}><Icon/><span><strong>{choice.label}</strong><small>{choice.detail}</small></span></button>;
}

function AccountRow({ account }: { account: Account }) {
  const used = account.creditLimit ? Math.min(100, Math.round(Math.abs(Math.min(account.balance, 0)) / account.creditLimit * 100)) : 0;
  const Icon = account.type === 'CREDIT_CARD' ? CreditCard : account.type === 'STOCKS' || account.type === 'INVESTMENT' ? TrendingUp : account.type === 'EPFO' ? Building2 : account.type === 'LOAN' ? BadgeIndianRupee : account.type === 'SAVINGS' ? PiggyBank : Landmark;
  return <div className="account-row"><span className={`account-icon ${account.type.toLowerCase()}`}><Icon/></span><div><strong>{account.name}</strong><small>{typeLabel[account.type] ?? account.type}{account.dueDay ? ` · due day ${account.dueDay}` : ''}</small>{account.creditLimit ? <span className="util"><i style={{ width: `${used}%` }}/></span> : null}</div><b>{money(account.balance)}</b></div>;
}

function accountPlaceholder(type: string) { return ({ SAVINGS: 'e.g. HDFC Salary Account', FIXED_DEPOSIT: 'e.g. SBI 2-Year FD', CREDIT_CARD: 'e.g. ICICI Amazon Pay', LOAN: 'e.g. HDFC Home Loan', STOCKS: 'e.g. Zerodha Demat', EPFO: 'e.g. EPFO - Current Employer' } as Record<string, string>)[type]; }
function institutionPlaceholder(type: string) { return ({ STOCKS: 'e.g. Zerodha', EPFO: 'e.g. Acme India', LOAN: 'e.g. HDFC Bank' } as Record<string, string>)[type] ?? 'e.g. HDFC Bank'; }
function balanceLabel(type: string) { return type === 'CREDIT_CARD' ? 'Current outstanding' : type === 'LOAN' ? 'Outstanding principal' : type === 'STOCKS' ? 'Current portfolio value' : type === 'EPFO' ? 'Current EPFO balance' : type === 'FIXED_DEPOSIT' ? 'Current deposit value' : 'Current balance'; }
