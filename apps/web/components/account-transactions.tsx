'use client';
import { ArrowLeft, ArrowRight, CalendarDays, Landmark, ReceiptText, ShieldAlert, Trash2, Lock, Settings, Plus, CreditCard, Files, Pencil, Trash, TrendingUp, Search, Filter, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';
import { VaultModal } from '@/components/vault-modal';
import { AccountDocuments } from '@/components/account-documents';
import { SipModal, type Sip } from '@/components/sip-modal';

type AccountLedger = {
  account: { id: string; name: string; type: string; institution: string | null; currency: string; openingBalance: number; balance: number;
    creditLimit?: number | null; statementDay?: number | null; dueDay?: number | null; cardLast4?: string | null; cardNetwork?: string | null };
  transactions: { id: string; transactionDate: string; postedDate: string | null; description: string; details: string | null;
    amount: number; category: string; isTransfer: boolean }[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
};

const typeLabel: Record<string, string> = { BANK: 'Bank account', SAVINGS: 'Savings account', FIXED_DEPOSIT: 'Fixed deposit',
  CREDIT_CARD: 'Credit card', LOAN: 'Loan account', STOCKS: 'Stock account', INVESTMENT: 'Investment account', EPFO: 'EPFO account', CASH: 'Cash' };

export function AccountTransactions({ accountId, embedded }: { accountId: string; embedded?: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const [data, setData] = useState<AccountLedger>();
  const [error, setError] = useState('');
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteAction, setDeleteAction] = useState<'CLEAR_TRANSACTIONS' | 'DELETE_ACCOUNT'>('CLEAR_TRANSACTIONS');
  const [confirmationName, setConfirmationName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  // Credit Card details edit states
  const [showEditCc, setShowEditCc] = useState(false);
  const [ccLimit, setCcLimit] = useState('');
  const [ccStatementDay, setCcStatementDay] = useState('');
  const [ccDueDay, setCcDueDay] = useState('');
  const [savingCc, setSavingCc] = useState(false);
  const [saveCcError, setSaveCcError] = useState('');

  // EPFO manual transaction states
  const [showAddEpfo, setShowAddEpfo] = useState(false);
  const [epfoDesc, setEpfoDesc] = useState('');
  const [epfoAmount, setEpfoAmount] = useState('');
  const [epfoDate, setEpfoDate] = useState('');
  const [epfoIsCredit, setEpfoIsCredit] = useState(true);
  const [savingEpfo, setSavingEpfo] = useState(false);
  const [saveEpfoError, setSaveEpfoError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(() => {
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(requestedPage));
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (minAmount.trim()) params.set('minAmount', minAmount.trim());
    if (maxAmount.trim()) params.set('maxAmount', maxAmount.trim());
    if (typeFilter !== 'ALL') params.set('type', typeFilter);
    if (startDate.trim()) params.set('startDate', startDate.trim());
    if (endDate.trim()) params.set('endDate', endDate.trim());

    api<AccountLedger>(`/accounts/${accountId}/transactions?${params.toString()}`).then(setData).catch((reason: unknown) => {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load this account.'));
    });
  }, [accountId, requestedPage, searchQuery, minAmount, maxAmount, typeFilter, startDate, endDate, router]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setShowDocuments(false); }, [accountId]);

  if (!data) {
    const errorState = error ? <section className="panel account-ledger-error"><ReceiptText/><h2>Account unavailable</h2><p>{error}</p><Link className="secondary" href="/dashboard"><ArrowLeft/>Back to overview</Link></section> : <div className="loading"><span/><p>Loading account transactions…</p></div>;
    return embedded ? errorState : <Shell>{errorState}</Shell>;
  }

  const { account, transactions, pagination } = data;
  const isCreditCard = account.type === 'CREDIT_CARD';
  const supportsDocuments = ['BANK', 'SAVINGS'].includes(account.type);
  const supportsStatementImport = ['BANK', 'SAVINGS', 'CREDIT_CARD'].includes(account.type);
  const statementImportKind = isCreditCard ? 'CREDIT_CARD_STATEMENT' : 'BANK_STATEMENT';
  const statementImportHref = `/import?kind=${statementImportKind}&accountId=${encodeURIComponent(account.id)}`;
  const cardOutstanding = Math.max(0, -account.balance);
  const availableCredit = account.creditLimit == null ? null : Math.max(0, account.creditLimit - cardOutstanding);
  const maskedCardNumber = account.cardLast4 ? `••••  ••••  ••••  ${account.cardLast4}` : 'Card number not stored';
  const goToPage = (page: number) => router.push(`/accounts?page=${page}&account=${accountId}`);
  const closeDelete = () => { if (!deleting) { setDeleteStep(0); setConfirmationName(''); setDeleteError(''); } };
  const handleDeleteConfirm = async () => {
    setDeleting(true); setDeleteError('');
    try {
      const endpoint = deleteAction === 'CLEAR_TRANSACTIONS'
        ? `/accounts/${account.id}/transactions`
        : `/accounts/${account.id}`;
      await api<void>(endpoint, { method: 'DELETE', body: JSON.stringify({ confirmationName }) });
      if (deleteAction === 'CLEAR_TRANSACTIONS') {
        closeDelete();
        load();
      } else {
        if (embedded) window.location.reload();
        else { router.replace('/dashboard'); router.refresh(); }
      }
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setDeleteError(errorMessage(reason, `Could not ${deleteAction === 'CLEAR_TRANSACTIONS' ? 'clear transactions' : 'delete this account'}.`));
    } finally { setDeleting(false); }
  };

  const openEditCc = () => {
    setCcLimit(account.creditLimit ? String(account.creditLimit / 100) : '');
    setCcStatementDay(account.statementDay ? String(account.statementDay) : '');
    setCcDueDay(account.dueDay ? String(account.dueDay) : '');
    setSaveCcError('');
    setShowEditCc(true);
  };

  const handleSaveCc = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCc(true);
    setSaveCcError('');
    try {
      const body = {
        creditLimit: ccLimit ? Math.round(Number(ccLimit) * 100) : null,
        statementDay: ccStatementDay ? Number(ccStatementDay) : null,
        dueDay: ccDueDay ? Number(ccDueDay) : null,
      };
      await api(`/accounts/${accountId}`, { method: 'PATCH', body: JSON.stringify(body) });
      setShowEditCc(false);
      load();
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setSaveCcError(errorMessage(reason, 'Could not save card details.'));
    } finally {
      setSavingCc(false);
    }
  };

  const openAddEpfo = () => {
    setEpfoDesc('EPFO Contribution');
    setEpfoAmount('');
    setEpfoDate(new Date().toISOString().slice(0, 10));
    setEpfoIsCredit(true);
    setSaveEpfoError('');
    setShowAddEpfo(true);
  };

  const handleAddEpfo = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingEpfo(true);
    setSaveEpfoError('');
    try {
      const amt = Math.round(Number(epfoAmount) * 100);
      const body = {
        description: epfoDesc,
        amount: epfoIsCredit ? amt : -amt,
        transactionDate: new Date(epfoDate).toISOString(),
      };
      await api(`/accounts/${accountId}/transactions`, { method: 'POST', body: JSON.stringify(body) });
      setShowAddEpfo(false);
      load();
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setSaveEpfoError(errorMessage(reason, 'Could not log transaction.'));
    } finally {
      setSavingEpfo(false);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api(`/accounts/${accountId}/transactions/${transactionId}`, { method: 'DELETE' });
      load();
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else alert(errorMessage(reason, 'Could not delete this transaction.'));
    }
  };

  const content = (
    <div className={`account-detail-content ${embedded ? 'embedded' : ''}`}>
      {!embedded && <header className="page-header"><div><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>Overview</Link><span className="eyebrow">Account ledger</span><h1>{account.name}</h1><p>{typeLabel[account.type] ?? account.type}{account.institution ? ` · ${account.institution}` : ''}</p></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {account.type === 'EPFO' && <button className="secondary" onClick={openAddEpfo}><Plus size={15}/>Add transaction</button>}
        {account.type === 'CREDIT_CARD' && <button className="secondary" onClick={openEditCc}><Settings size={15}/>Edit card</button>}
        {supportsDocuments && <button className={`secondary account-view-button ${!showDocuments ? 'active' : ''}`} aria-pressed={!showDocuments} onClick={() => setShowDocuments(false)}><ReceiptText size={15}/>Transactions</button>}
        {supportsDocuments && <button className={`secondary account-view-button ${showDocuments ? 'active' : ''}`} aria-pressed={showDocuments} onClick={() => setShowDocuments(true)}><Files size={15}/>Documents</button>}
        {supportsStatementImport && <Link className="secondary" href={statementImportHref}>Import statement</Link>}
        {['STOCKS', 'INVESTMENT'].includes(account.type) && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const el = document.getElementById('active-sips-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <TrendingUp size={15} color="#8b5cf6" /> SIPs
          </button>
        )}
        <button className="secondary" onClick={() => setShowVault(true)}><Lock size={15}/>Credentials</button>
        <button className="danger" onClick={() => { setDeleteStep(1); setDeleteError(''); }}><Trash2/>Delete or clear</button>
      </div></header>}
      {embedded && <header className={`embedded-header ${isCreditCard ? 'credit-card-embedded-header' : ''}`}><div><span className="eyebrow">{typeLabel[account.type] ?? account.type}</span><h2>{account.name}</h2>{isCreditCard && <p className="credit-card-embedded-number"><CreditCard size={14}/>{maskedCardNumber}{account.cardNetwork ? <em>{account.cardNetwork}</em> : null}</p>}</div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {account.type === 'EPFO' && <button className="secondary compact" onClick={openAddEpfo}><Plus size={14}/>Add</button>}
        {account.type === 'CREDIT_CARD' && <button className="secondary compact" onClick={openEditCc}><Settings size={14}/>Edit</button>}
        {supportsDocuments && <button className={`secondary compact account-view-button ${!showDocuments ? 'active' : ''}`} aria-pressed={!showDocuments} onClick={() => setShowDocuments(false)}><ReceiptText size={14}/>Transactions</button>}
        {supportsDocuments && <button className={`secondary compact account-view-button ${showDocuments ? 'active' : ''}`} aria-pressed={showDocuments} onClick={() => setShowDocuments(true)}><Files size={14}/>Documents</button>}
        {supportsStatementImport && <Link className="secondary compact" href={statementImportHref}>Import statement</Link>}
        {['STOCKS', 'INVESTMENT'].includes(account.type) && (
          <button
            type="button"
            className="secondary compact"
            onClick={() => {
              const el = document.getElementById('active-sips-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <TrendingUp size={14} color="#8b5cf6" /> SIPs
          </button>
        )}
        <button className="secondary compact" onClick={() => setShowVault(true)}><Lock size={14}/>Credentials</button>
        <button className="danger compact" onClick={() => { setDeleteStep(1); setDeleteError(''); }}><Trash2/></button>
      </div></header>}
      {showDocuments ? (
        <AccountDocuments accountId={account.id} />
      ) : <>{isCreditCard ? <section className="summary-grid account-ledger-summary credit-card-ledger-summary">
        <article className="credit-card-outstanding"><span className="summary-icon"><CreditCard/></span><div><small>Outstanding</small><strong>{money(cardOutstanding)}</strong><em>Based on reviewed transactions</em></div></article>
        <article><span className="summary-icon saved"><Landmark/></span><div><small>Available credit</small><strong>{availableCredit === null ? 'Not set' : money(availableCredit)}</strong><em>{account.creditLimit == null ? 'Add a credit limit in card settings' : `${money(account.creditLimit)} total limit`}</em></div></article>
        <article><span className="summary-icon expense"><CalendarDays/></span><div><small>Billing cycle</small><strong>{account.statementDay ? `Day ${account.statementDay}` : 'Not set'}</strong><em>{account.dueDay ? `Payment due on day ${account.dueDay}` : 'Payment due day not set'}</em></div></article>
      </section> : <section className="summary-grid account-ledger-summary">
        <article><span className="summary-icon income"><Landmark/></span><div><small>Current balance</small><strong>{money(account.balance)}</strong></div></article>
        <article><span className="summary-icon saved"><CalendarDays/></span><div><small>Opening balance</small><strong>{money(account.openingBalance)}</strong></div></article>
        <article><span className="summary-icon expense"><ReceiptText/></span><div><small>Transactions</small><strong>{pagination.total.toLocaleString('en-IN')}</strong><em>Reviewed ledger entries</em></div></article>
      </section>}

      {['STOCKS', 'INVESTMENT'].includes(account.type) && (
        <ActiveSipsPanel accountId={account.id} />
      )}

      <section className="panel account-ledger-panel">
        <div className="panel-title"><div><span className="eyebrow">Full history</span><h2>Transactions</h2></div>{pagination.total > 0 && <span className="month-pill">{(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}</span>}</div>

        {/* Redesigned Search & Filter Control Center */}
        {(() => {
          const activeFilterCount = (searchQuery.trim() ? 1 : 0) +
            (startDate ? 1 : 0) +
            (endDate ? 1 : 0) +
            (minAmount ? 1 : 0) +
            (maxAmount ? 1 : 0) +
            (typeFilter !== 'ALL' ? 1 : 0);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0 24px 0', padding: '16px', background: 'var(--background-alt)', borderRadius: '14px', border: '1px solid var(--line)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              {/* Top Row: Search & Type Toggle & Reset */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* Search Bar */}
                <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
                  <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Search description or merchant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                      transition: 'border-color 0.2s',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
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
                    onClick={() => setTypeFilter('ALL')}
                    style={{ height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px' }}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`secondary compact ${typeFilter === 'EXPENSE' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('EXPENSE')}
                    style={{ height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px', color: typeFilter === 'EXPENSE' ? '#ef4444' : undefined }}
                  >
                    Debits
                  </button>
                  <button
                    type="button"
                    className={`secondary compact ${typeFilter === 'INCOME' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('INCOME')}
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
                      setSearchQuery('');
                      setMinAmount('');
                      setMaxAmount('');
                      setStartDate('');
                      setEndDate('');
                      setTypeFilter('ALL');
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
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ width: '100%', height: '34px', fontSize: '12px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>To</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ width: '100%', height: '34px', fontSize: '12px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
                      />
                    </div>
                  </div>
                  {/* Presets */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { const now = new Date(); const y = now.getUTCFullYear(); const m = String(now.getUTCMonth() + 1).padStart(2, '0'); setStartDate(`${y}-${m}-01`); setEndDate(''); }}>This Month</button>
                    <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { const now = new Date(); let y = now.getUTCFullYear(); let m = now.getUTCMonth(); if (m === 0) { m = 12; y -= 1; } const mStr = String(m).padStart(2, '0'); setStartDate(`${y}-${mStr}-01`); setEndDate(`${y}-${mStr}-31`); }}>Last Month</button>
                    <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { const now = new Date(); const today = now.toISOString().split('T')[0]; const d = new Date(now); d.setMonth(d.getMonth() - 6); setStartDate(d.toISOString().split('T')[0]); setEndDate(today); }}>Last 6 Months</button>
                    <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { const now = new Date(); const y = now.getUTCFullYear(); const startYr = now.getUTCMonth() >= 3 ? y : y - 1; setStartDate(`${startYr}-04-01`); setEndDate(`${startYr + 1}-03-31`); }}>This FY</button>
                    <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { const now = new Date(); const y = now.getUTCFullYear(); const currentStart = now.getUTCMonth() >= 3 ? y : y - 1; const prevStart = currentStart - 1; setStartDate(`${prevStart}-04-01`); setEndDate(`${currentStart}-03-31`); }}>Previous FY</button>
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
                        onChange={(e) => setMinAmount(e.target.value)}
                        style={{ width: '100%', height: '34px', fontSize: '12px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>Max ₹</label>
                      <input
                        type="number"
                        placeholder="No max"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        style={{ width: '100%', height: '34px', fontSize: '12px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
                      />
                    </div>
                  </div>
                  {/* Presets */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { setMinAmount('0'); setMaxAmount('1000'); }}>&lt; ₹1k</button>
                    <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { setMinAmount('1000'); setMaxAmount('10000'); }}>₹1k – ₹10k</button>
                    <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { setMinAmount('10000'); setMaxAmount('50000'); }}>₹10k – ₹50k</button>
                    <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => { setMinAmount('50000'); setMaxAmount(''); }}>&gt; ₹50k</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        {transactions.length ? <div className={`account-transaction-table ${account.type === 'EPFO' ? 'has-actions' : ''}`}>
          <header>
            <span>Date</span>
            <span>Description</span>
            <span>Category</span>
            <span>Amount</span>
            {account.type === 'EPFO' && <span style={{ textAlign: 'center' }}>Action</span>}
          </header>
          {transactions.map((transaction) => (
            <article key={transaction.id} className="transaction-row">
              <time className="transaction-time-cell">
                <span className="date-text">{new Date(transaction.transactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}</span>
                <span className="time-text">{new Date(transaction.transactionDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })}</span>
              </time>
              <div className="transaction-description-cell">
                <strong>{transaction.description}</strong>
                <small>{transaction.details || (transaction.postedDate ? `Posted ${new Date(transaction.postedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : 'Ledger transaction')}</small>
              </div>
              <div className="transaction-category-cell">
                <span className={`category-pill ${transaction.isTransfer ? 'transfer' : ''}`}>{transaction.isTransfer ? 'Transfer' : transaction.category}</span>
              </div>
              <b className={`transaction-amount-cell ${transaction.amount > 0 ? 'positive' : 'negative'}`}>
                {transaction.amount > 0 ? '+' : ''}{money(transaction.amount)}
              </b>
              {account.type === 'EPFO' && (
                <button
                  className="danger compact"
                  style={{ padding: '6px', minWidth: '0', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                  onClick={() => handleDeleteTransaction(transaction.id)}
                  title="Delete transaction"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </article>
          ))}
        </div> : <div className="account-ledger-empty"><ReceiptText/><strong>No transactions yet</strong><p>{account.type === 'EPFO' ? 'Add a manual transaction to populate the ledger.' : 'Import and approve a statement for this account to build its ledger.'}</p>{supportsStatementImport && <Link className="secondary" href={statementImportHref}>Import statement</Link>}</div>}
        {pagination.pages > 1 && <footer className="ledger-pagination"><button className="secondary" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}><ArrowLeft/>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button className="secondary" disabled={pagination.page >= pagination.pages} onClick={() => goToPage(pagination.page + 1)}>Next<ArrowRight/></button></footer>}
      </section>
      </>}
      {deleteStep > 0 && <div className="modal-wrap"><button className="backdrop" onClick={closeDelete} aria-label="Close deletion confirmation"/><section className="modal account-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><div className="delete-warning"><ShieldAlert/><span><strong>{deleteStep === 1 ? 'Select Action' : 'Final confirmation'}</strong><small>This action cannot be undone.</small></span></div>{deleteStep === 1 ? <><div><span className="eyebrow">First confirmation</span><h2 id="delete-account-title">Delete or Clear {account.name}?</h2><p>Choose whether to wipe all transactions/import history, or permanently delete the account itself.</p></div><div className="modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '12px' }}><button className="danger wide" onClick={() => { setDeleteAction('CLEAR_TRANSACTIONS'); setDeleteStep(2); setDeleteError(''); }}>Clear all transactions ({pagination.total.toLocaleString('en-IN')})</button><button className="danger wide" onClick={() => { setDeleteAction('DELETE_ACCOUNT'); setDeleteStep(2); setDeleteError(''); }}>Delete entire account</button><button className="ghost wide" onClick={closeDelete}>Cancel</button></div></> : <><div><span className="eyebrow">Second confirmation</span><h2 id="delete-account-title">Type the account name</h2><p>Enter <strong>{account.name}</strong> exactly to confirm {deleteAction === 'CLEAR_TRANSACTIONS' ? 'clearing all transactions' : 'permanent account deletion'}.</p></div><label>Account name<input autoFocus autoComplete="off" value={confirmationName} onChange={(event) => { setConfirmationName(event.target.value); setDeleteError(''); }} /></label>{deleteError && <p className="error">{deleteError}</p>}<div className="modal-actions"><button className="ghost" disabled={deleting} onClick={() => { setDeleteStep(1); setConfirmationName(''); setDeleteError(''); }}>Back</button><button className="danger" disabled={deleting || confirmationName !== account.name} onClick={handleDeleteConfirm}>{deleting ? 'Processing…' : deleteAction === 'CLEAR_TRANSACTIONS' ? 'Clear transactions' : 'Permanently delete'}</button></div></>}</section></div>}
      {showVault && <VaultModal accountId={account.id} onClose={() => setShowVault(false)} onChanged={load} />}

      {showEditCc && (
        <div className="modal-wrap">
          <button className="backdrop" onClick={() => setShowEditCc(false)} aria-label="Close edit modal" />
          <section className="modal" role="dialog" aria-modal="true" style={{ width: 'min(440px, 100%)' }}>
            <header className="modal-header">
              <h2>Edit Card Details</h2>
            </header>
            <form onSubmit={handleSaveCc} style={{ display: 'grid', gap: '14px', marginTop: '10px' }}>
              <label>Credit Limit (INR)
                <input type="number" required min={0} value={ccLimit} onChange={(e) => setCcLimit(e.target.value)} placeholder="e.g. 100000" />
              </label>
              <label>Statement Cycle Day (1-31)
                <input type="number" required min={1} max={31} value={ccStatementDay} onChange={(e) => setCcStatementDay(e.target.value)} placeholder="e.g. 15" />
              </label>
              <label>Payment Due Day (1-31)
                <input type="number" required min={1} max={31} value={ccDueDay} onChange={(e) => setCcDueDay(e.target.value)} placeholder="e.g. 5" />
              </label>
              {saveCcError && <p className="error">{saveCcError}</p>}
              <div className="modal-actions" style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="ghost" onClick={() => setShowEditCc(false)}>Cancel</button>
                <button type="submit" className="primary" disabled={savingCc}>{savingCc ? 'Saving…' : 'Save Details'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showAddEpfo && (
        <div className="modal-wrap">
          <button className="backdrop" onClick={() => setShowAddEpfo(false)} aria-label="Close add transaction modal" />
          <section className="modal" role="dialog" aria-modal="true" style={{ width: 'min(440px, 100%)' }}>
            <header className="modal-header">
              <h2>Add EPFO Transaction</h2>
            </header>
            <form onSubmit={handleAddEpfo} style={{ display: 'grid', gap: '14px', marginTop: '10px' }}>
              <label>Date
                <input type="date" required value={epfoDate} onChange={(e) => setEpfoDate(e.target.value)} />
              </label>
              <label>Description
                <input type="text" required value={epfoDesc} onChange={(e) => setEpfoDesc(e.target.value)} placeholder="e.g. Employer Contribution" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <button type="button" className={`secondary ${epfoIsCredit ? 'active' : ''}`} style={{ height: '36px', fontSize: '12px' }} onClick={() => setEpfoIsCredit(true)}>Credit (Deposit)</button>
                <button type="button" className={`secondary ${!epfoIsCredit ? 'active' : ''}`} style={{ height: '36px', fontSize: '12px' }} onClick={() => setEpfoIsCredit(false)}>Debit (Withdrawal)</button>
              </div>
              <label>Amount (INR)
                <input type="number" required min={1} value={epfoAmount} onChange={(e) => setEpfoAmount(e.target.value)} placeholder="e.g. 5000" />
              </label>
              {saveEpfoError && <p className="error">{saveEpfoError}</p>}
              <div className="modal-actions" style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="ghost" onClick={() => setShowAddEpfo(false)}>Cancel</button>
                <button type="submit" className="primary" disabled={savingEpfo}>{savingEpfo ? 'Adding…' : 'Add Transaction'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );

  return embedded ? content : <Shell>{content}</Shell>;
}

export function ActiveSipsPanel({ accountId }: { accountId: string }) {
  const [sips, setSips] = useState<Sip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSip, setEditingSip] = useState<Sip | null>(null);

  const loadSips = useCallback(() => {
    setLoading(true);
    api<Sip[]>(`/investments/sips?accountId=${accountId}`)
      .then((res) => {
        setSips(res || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [accountId]);

  useEffect(() => {
    loadSips();
  }, [loadSips]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this active SIP?')) return;
    try {
      await api(`/investments/sips/${id}`, { method: 'DELETE' });
      loadSips();
    } catch (err) {
      alert(errorMessage(err, 'Failed to delete SIP.'));
    }
  };

  return (
    <section id="active-sips-section" className="panel" style={{ marginBottom: '20px' }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="eyebrow" style={{ color: '#10b981' }}>Automated Investments</span>
          <h2>Active SIPs</h2>
        </div>
        <button
          type="button"
          className="secondary compact"
          onClick={() => {
            setEditingSip(null);
            setShowModal(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={14} /> Add Active SIP
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>Loading active SIPs...</div>
      ) : sips.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginTop: '12px' }}>
          {sips.map((sip) => (
            <div
              key={sip.id}
              style={{
                background: 'var(--background-alt)',
                borderRadius: '10px',
                padding: '14px 16px',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{sip.name}</strong>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: '#d1fae5', color: '#065f46', fontWeight: 700 }}>
                    {sip.status}
                  </span>
                </div>
                {sip.folioNumber && <small style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>Folio: {sip.folioNumber}</small>}
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981', margin: '4px 0 8px 0' }}>
                  {money(sip.amount)} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted)' }}>/ {sip.frequency.toLowerCase()}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>SIP Debit Day: <strong>{sip.sipDay}th</strong> of month</span>
                  <span>
                    Payment Source:{' '}
                    <strong>{sip.sourceAccountName ? `${sip.sourceAccountName}${sip.sourceAccountLast4 ? ` (•••• ${sip.sourceAccountLast4})` : ''}` : 'Not linked'}</strong>
                  </span>
                  {sip.destinationAccount && (
                    <span>
                      Payment Destination: <strong>{sip.destinationAccount}</strong>
                    </span>
                  )}
                  {sip.billerKeyword && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Statement Keyword: {sip.billerKeyword}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--line)' }}>
                <button
                  type="button"
                  className="ghost compact"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                  onClick={() => {
                    setEditingSip(sip);
                    setShowModal(true);
                  }}
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  type="button"
                  className="ghost compact"
                  style={{ fontSize: '12px', padding: '4px 8px', color: '#ef4444' }}
                  onClick={() => handleDelete(sip.id)}
                >
                  <Trash size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', background: 'var(--background-alt)', borderRadius: '8px', border: '1px dashed var(--line)', marginTop: '12px' }}>
          <TrendingUp size={24} color="#10b981" style={{ marginBottom: '6px' }} />
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--muted)' }}>No active SIPs added for this account yet.</p>
          <button
            type="button"
            className="secondary compact"
            onClick={() => {
              setEditingSip(null);
              setShowModal(true);
            }}
          >
            <Plus size={14} /> Add Active SIP
          </button>
        </div>
      )}

      {showModal && (
        <SipModal
          accountId={accountId}
          sip={editingSip}
          onClose={() => setShowModal(false)}
          onSaved={loadSips}
        />
      )}
    </section>
  );
}
