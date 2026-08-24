'use client';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Landmark, ReceiptText, ShieldAlert, Trash2, Lock, Settings, Plus, CreditCard, Files, Pencil, Trash, TrendingUp, Search, Filter, RotateCcw, SlidersHorizontal, X, Tag, Workflow, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';
import { VaultModal } from '@/components/vault-modal';
import { AccountDocuments } from '@/components/account-documents';
import { SipModal, type Sip } from '@/components/sip-modal';
import { SpendRulesModal } from '@/components/spend-rules-modal';

import { AccountType } from '@/lib/constants';

type CategoryOption = { id: string; name: string; color: string };

type AccountLedger = {
  account: {
    id: string;
    name: string;
    type: string;
    institution: string | null;
    currency: string;
    openingBalance: number;
    balance: number;
    creditLimit?: number | null;
    statementDay?: number | null;
    dueDay?: number | null;
    parentAccountId?: string | null;
    parentAccountName?: string | null;
    isShared?: boolean;
    isChild?: boolean;
    cardLast4?: string | null;
    cardNetwork?: string | null;
  };
  transactions: {
    id: string;
    transactionDate: string;
    postedDate: string | null;
    description: string;
    details: string | null;
    amount: number;
    categoryId?: string | null;
    category: string;
    categoryColor?: string;
    superCategory?: string | null;
    superCategoryColor?: string | null;
    superCategoryKind?: string | null;
    isTransfer: boolean;
    emailReference?: {
      messageId?: string | null;
      subject?: string | null;
      sender?: string | null;
      date?: string | null;
      snippet?: string | null;
    } | null;
  }[];
  categories?: (CategoryOption & {
    superCategoryId?: string | null;
    superCategoryName?: string | null;
    superCategoryColor?: string | null;
    superCategoryKind?: string | null;
  })[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
};

const typeLabel: Record<string, string> = {
  [AccountType.BANK]: 'Bank account',
  [AccountType.SAVINGS]: 'Savings account',
  [AccountType.FIXED_DEPOSIT]: 'Fixed deposit',
  [AccountType.CREDIT_CARD]: 'Credit card',
  [AccountType.LOAN]: 'Loan account',
  [AccountType.STOCKS]: 'Stock account',
  [AccountType.INVESTMENT]: 'Investment account',
  [AccountType.EPFO]: 'EPFO account',
  [AccountType.CASH]: 'Cash',
};

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
  const [activeTab, setActiveTab] = useState<'TRANSACTIONS' | 'FLOW' | 'TIMELINE' | 'DOCUMENTS'>('TRANSACTIONS');

  // Credit Card details edit states
  const [showEditCc, setShowEditCc] = useState(false);
  const [ccLimit, setCcLimit] = useState('');
  const [ccStatementDay, setCcStatementDay] = useState('');
  const [ccDueDay, setCcDueDay] = useState('');
  const [savingCc, setSavingCc] = useState(false);
  const [saveCcError, setSaveCcError] = useState('');

  // EPFO manual add states
  const [showAddEpfo, setShowAddEpfo] = useState(false);
  const [epfoDate, setEpfoDate] = useState('');
  const [epfoDesc, setEpfoDesc] = useState('');
  const [epfoAmount, setEpfoAmount] = useState('');
  const [epfoIsCredit, setEpfoIsCredit] = useState(true);
  const [savingEpfo, setSavingEpfo] = useState(false);
  const [saveEpfoError, setSaveEpfoError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [selectedCategoryFilterId, setSelectedCategoryFilterId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCategoryEdit, setShowCategoryEdit] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const load = useCallback(() => {
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(requestedPage));
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (selectedCategoryFilterId !== 'all') params.set('categoryId', selectedCategoryFilterId);
    if (minAmount.trim()) params.set('minAmount', minAmount.trim());
    if (maxAmount.trim()) params.set('maxAmount', maxAmount.trim());
    if (typeFilter !== 'ALL') params.set('type', typeFilter);
    if (startDate.trim()) params.set('startDate', startDate.trim());
    if (endDate.trim()) params.set('endDate', endDate.trim());

    api<AccountLedger>(`/accounts/${accountId}/transactions?${params.toString()}`).then(setData).catch((reason: unknown) => {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load this account.'));
    });
  }, [accountId, requestedPage, searchQuery, selectedCategoryFilterId, minAmount, maxAmount, typeFilter, startDate, endDate, router]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setActiveTab('TRANSACTIONS'); }, [accountId]);

  const handleUpdateCategory = async (transactionId: string, categoryId: string) => {
    try {
      await api(`/accounts/${accountId}/transactions/${transactionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ categoryId: categoryId || null }),
      });
      load();
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else alert(errorMessage(reason, 'Could not update category.'));
    }
  };

  if (!data) {
    const errorState = error ? <section className="panel account-ledger-error"><ReceiptText/><h2>Account unavailable</h2><p>{error}</p><Link className="secondary" href="/dashboard"><ArrowLeft/>Back to overview</Link></section> : <div className="loading"><span/><p>Loading account transactions…</p></div>;
    return embedded ? errorState : <Shell>{errorState}</Shell>;
  }

  const { account, transactions, pagination } = data;
  const isCreditCard = account.type === AccountType.CREDIT_CARD;
  const supportsDocuments = true;
  const supportsStatementImport = [AccountType.BANK, AccountType.SAVINGS].includes(account.type as AccountType);
  const statementImportHref = `/import?kind=BANK_STATEMENT&accountId=${encodeURIComponent(account.id)}`;
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
      {!embedded && (
        <header className="page-header">
          <div>
            <Link className="back-link" href="/dashboard">
              <ArrowLeft size={15} /> Overview
            </Link>
            <span className="eyebrow">Account ledger</span>
            <h1>{account.name}</h1>
            <p>
              {typeLabel[account.type] ?? account.type}
              {account.institution ? ` · ${account.institution}` : ''}
            </p>
          </div>
        </header>
      )}

      {/* 1. Summary Cards (Always Visible) */}
      {isCreditCard ? (
        <section className="summary-grid account-ledger-summary credit-card-ledger-summary">
          <article className="credit-card-outstanding">
            <span className="summary-icon"><CreditCard /></span>
            <div>
              <small>Outstanding</small>
              <strong>{money(cardOutstanding)}</strong>
              <em>Based on reviewed transactions</em>
            </div>
          </article>
          <article>
            <span className="summary-icon saved"><Landmark /></span>
            <div>
              <small>Available credit</small>
              <strong>{availableCredit === null ? 'Not set' : money(availableCredit)}</strong>
              <em>{account.creditLimit == null ? 'Add a credit limit in card settings' : account.isChild ? `Shared with ${account.parentAccountName || 'Primary Card'} (${money(account.creditLimit)})` : `${money(account.creditLimit)} total limit`}</em>
            </div>
          </article>
          <article>
            <span className="summary-icon expense"><CalendarDays /></span>
            <div>
              <small>Billing cycle</small>
              <strong>{account.statementDay ? `Day ${account.statementDay}` : 'Not set'}</strong>
              <em>{account.dueDay ? `Payment due on day ${account.dueDay}` : 'Payment due day not set'}</em>
            </div>
          </article>
        </section>
      ) : (
        <section className="summary-grid account-ledger-summary">
          <article>
            <span className="summary-icon income"><Landmark /></span>
            <div>
              <small>Current balance</small>
              <strong>{money(account.balance)}</strong>
            </div>
          </article>
          <article>
            <span className="summary-icon saved"><CalendarDays /></span>
            <div>
              <small>Opening balance</small>
              <strong>{money(account.openingBalance)}</strong>
            </div>
          </article>
          <article>
            <span className="summary-icon expense"><ReceiptText /></span>
            <div>
              <small>Transactions</small>
              <strong>{pagination.total.toLocaleString('en-IN')}</strong>
              <em>Reviewed ledger entries</em>
            </div>
          </article>
        </section>
      )}

      {/* 2. Tab Navigation & Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--card)', padding: '4px', borderRadius: '12px', border: '1px solid var(--line)' }}>
          <button
            type="button"
            className={`secondary compact ${activeTab === 'TRANSACTIONS' ? 'active' : ''}`}
            onClick={() => setActiveTab('TRANSACTIONS')}
          >
            <ReceiptText size={14} /> Transactions
          </button>
          <button
            type="button"
            className={`secondary compact ${activeTab === 'FLOW' ? 'active' : ''}`}
            onClick={() => setActiveTab('FLOW')}
          >
            <Workflow size={14} /> Transaction Flow
          </button>
          <button
            type="button"
            className={`secondary compact ${activeTab === 'TIMELINE' ? 'active' : ''}`}
            onClick={() => setActiveTab('TIMELINE')}
          >
            <CalendarDays size={14} /> 1-Year Timeline
          </button>
          {supportsDocuments && (
            <button
              type="button"
              className={`secondary compact ${activeTab === 'DOCUMENTS' ? 'active' : ''}`}
              onClick={() => setActiveTab('DOCUMENTS')}
            >
              <Files size={14} /> Documents
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {account.type === 'EPFO' && (
            <button type="button" className="secondary compact" onClick={openAddEpfo}>
              <Plus size={14} /> Add
            </button>
          )}
          {account.type === 'CREDIT_CARD' && (
            <button type="button" className="secondary compact" onClick={openEditCc}>
              <Settings size={14} /> Edit
            </button>
          )}
          <button type="button" className="secondary compact" onClick={() => setShowVault(true)}>
            <Lock size={14} /> Credentials
          </button>
          <button
            type="button"
            className="danger compact"
            onClick={() => {
              setDeleteStep(1);
              setDeleteError('');
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 3. Tab Content View */}
      {activeTab === 'DOCUMENTS' && supportsDocuments ? (
        <AccountDocuments accountId={account.id} />
      ) : activeTab === 'FLOW' ? (
        <AccountFlowDiagram account={account} transactions={data?.transactions || []} />
      ) : activeTab === 'TIMELINE' ? (
        <AccountTimelineAudit accountId={account.id} />
      ) : (
        <section className="panel account-ledger-panel">
          {/* Redesigned Search & Filter Control Center */}
          {(() => {
            const activeFilterCount = (selectedCategoryFilterId !== 'all' ? 1 : 0) +
              (searchQuery.trim() ? 1 : 0) +
              (startDate ? 1 : 0) +
              (endDate ? 1 : 0) +
              (minAmount ? 1 : 0) +
              (maxAmount ? 1 : 0) +
              (typeFilter !== 'ALL' ? 1 : 0);

            return (
              <>
                <div className="panel-title" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <span className="eyebrow">Full history</span>
                    <h2>Transactions</h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {pagination.total > 0 && (
                      <span className="month-pill">
                        {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`secondary compact ${showCategoryEdit ? 'active' : ''}`}
                      onClick={() => setShowCategoryEdit(!showCategoryEdit)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Tag size={14} color="var(--green)" />
                      {showCategoryEdit ? 'Done Categorising' : 'Categorise'}
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

                {(showFilters || activeFilterCount > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '0 24px 24px 24px', padding: '16px', background: 'var(--background-alt)', borderRadius: '14px', border: '1px solid var(--line)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    {/* Top Row: Category Select & Search & Type Toggle & Reset */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                      {/* Category Filter Dropdown */}
                      <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
                        <select
                          value={selectedCategoryFilterId}
                          onChange={(e) => setSelectedCategoryFilterId(e.target.value)}
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
                      <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
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
                            setSelectedCategoryFilterId('all');
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
                )}
              </>
            );
          })()}

        {transactions.length ? <div className={`account-transaction-table ${account.type === 'EPFO' ? 'has-actions' : ''}`}>
          <header>
            <span>Date</span>
            <span>Description</span>
            <span>Category</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
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
                {transaction.isTransfer ? (
                  <span className="category-pill transfer">Transfer</span>
                ) : showCategoryEdit ? (
                  <select
                    className="category-pill-select"
                    value={transaction.categoryId ?? ''}
                    onChange={(e) => void handleUpdateCategory(transaction.id, e.target.value)}
                    title="Click to change category"
                    style={{
                      display: 'inline-block',
                      width: 'auto',
                      maxWidth: '180px',
                      background: transaction.categoryId ? 'var(--theme-soft-start)' : 'var(--background-alt)',
                      border: '1px solid var(--line)',
                      borderRadius: '8px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: transaction.categoryId ? 'var(--green)' : 'var(--muted)',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="">Uncategorised</option>
                    {(() => {
                      const cats = data.categories || [];
                      const groups: { [key: string]: typeof cats } = {};
                      const unassigned: typeof cats = [];
                      cats.forEach((c: any) => {
                        const groupName = c.superCategoryName || (c.type ? `${c.type.charAt(0) + c.type.slice(1).toLowerCase()}` : "");
                        if (groupName) {
                          if (!groups[groupName]) groups[groupName] = [];
                          groups[groupName].push(c);
                        } else {
                          unassigned.push(c);
                        }
                      });
                      return (
                        <>
                          {Object.entries(groups).map(([grp, items]) => (
                            <optgroup key={grp} label={grp}>
                              {items.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          {unassigned.length > 0 && (
                            <optgroup label="General">
                              {unassigned.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                ) : (
                  <div className="transaction-cat-btn" style={{ cursor: 'default' }}>
                    <div className="transaction-cat-primary">
                      <span
                        className="transaction-cat-dot"
                        style={{ background: transaction.categoryColor || (transaction.categoryId ? "#3b82f6" : "#94a3b8") }}
                      />
                      <span className={`transaction-cat-name ${!transaction.categoryId ? 'uncategorised' : ''}`}>
                        {transaction.category || 'Uncategorised'}
                      </span>
                    </div>
                    {transaction.superCategory && (
                      <span className="transaction-super-label">
                        {transaction.superCategory}
                      </span>
                    )}
                  </div>
                )}
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
        </div> : <div className="account-ledger-empty"><ReceiptText/><strong>No transactions yet</strong><p>{account.type === 'EPFO' ? 'Add a manual transaction to populate the ledger.' : 'No transactions recorded for this account.'}</p></div>}
        {pagination.pages > 1 && <footer className="ledger-pagination"><button className="secondary" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}><ArrowLeft/>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button className="secondary" disabled={pagination.page >= pagination.pages} onClick={() => goToPage(pagination.page + 1)}>Next<ArrowRight/></button></footer>}
      </section>
      )}
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
        <div style={{ padding: '24px 20px', textAlign: 'center', background: 'var(--background-alt)', borderRadius: '12px', border: '1px dashed var(--line)', marginTop: '12px' }}>
          <TrendingUp size={24} color="#10b981" style={{ marginBottom: '6px' }} />
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>No active SIPs configured for this account yet.</p>
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

function AccountFlowDiagram({
  account,
  transactions,
}: {
  account: AccountLedger['account'];
  transactions: AccountLedger['transactions'];
}) {
  // Extract available months from transaction dates (format: YYYY-MM)
  const availableMonths = Array.from(
    new Set(
      transactions
        .map((t) => (t.transactionDate ? t.transactionDate.slice(0, 7) : ''))
        .filter((m) => Boolean(m) && /^\d{4}-\d{2}$/.test(m))
    )
  ).sort().reverse();

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const initialMonth = availableMonths.includes(currentMonthKey)
    ? currentMonthKey
    : (availableMonths[0] || currentMonthKey);

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [flowMode, setFlowMode] = useState<'TRANSACTIONS' | 'CATEGORIES'>('TRANSACTIONS');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const formatMonthLabel = (monthKey: string) => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-');
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Filter transactions by selected month
  const filteredTxns = transactions.filter((t) => t.transactionDate && t.transactionDate.startsWith(selectedMonth));

  // Inbound (> 0) and Outbound (< 0)
  const inboundTxns = filteredTxns.filter((t) => t.amount > 0);
  const outboundTxns = filteredTxns.filter((t) => t.amount < 0);

  const totalInboundMinor = inboundTxns.reduce((sum, t) => sum + t.amount, 0);
  const totalOutboundMinor = outboundTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Calculate Inbound Nodes
  let inboundNodes: { id: string; label: string; category: string; amountMinor: number; count: number; pct: number }[] = [];
  if (flowMode === 'TRANSACTIONS') {
    const sortedInbound = [...inboundTxns].sort((a, b) => b.amount - a.amount);
    const top7Inbound = sortedInbound.slice(0, 7);
    const restInbound = sortedInbound.slice(7);
    const restInboundSum = restInbound.reduce((sum, t) => sum + t.amount, 0);

    inboundNodes = top7Inbound.map((t, idx) => ({
      id: `in-${t.id || idx}`,
      label: t.description,
      category: t.category,
      amountMinor: t.amount,
      count: 1,
      pct: totalInboundMinor > 0 ? Math.round((t.amount / totalInboundMinor) * 100) : 0,
    }));

    if (restInbound.length > 0) {
      inboundNodes.push({
        id: 'in-other',
        label: `Other Inbound (${restInbound.length} txns)`,
        category: 'Multiple',
        amountMinor: restInboundSum,
        count: restInbound.length,
        pct: totalInboundMinor > 0 ? Math.round((restInboundSum / totalInboundMinor) * 100) : 0,
      });
    }
  } else {
    // CATEGORIES mode
    const catMap: Record<string, { label: string; amountMinor: number; count: number }> = {};
    inboundTxns.forEach((t) => {
      const cat = t.category || 'Uncategorized';
      if (!catMap[cat]) catMap[cat] = { label: cat, amountMinor: 0, count: 0 };
      catMap[cat].amountMinor += t.amount;
      catMap[cat].count += 1;
    });

    const sortedCats = Object.values(catMap).sort((a, b) => b.amountMinor - a.amountMinor);
    const top7Cats = sortedCats.slice(0, 7);
    const restCats = sortedCats.slice(7);
    const restCatsSum = restCats.reduce((sum, c) => sum + c.amountMinor, 0);
    const restCatsCount = restCats.reduce((sum, c) => sum + c.count, 0);

    inboundNodes = top7Cats.map((c, idx) => ({
      id: `incat-${idx}`,
      label: c.label,
      category: c.label,
      amountMinor: c.amountMinor,
      count: c.count,
      pct: totalInboundMinor > 0 ? Math.round((c.amountMinor / totalInboundMinor) * 100) : 0,
    }));

    if (restCats.length > 0) {
      inboundNodes.push({
        id: 'incat-other',
        label: `Other Categories (${restCats.length} categories)`,
        category: 'Multiple',
        amountMinor: restCatsSum,
        count: restCatsCount,
        pct: totalInboundMinor > 0 ? Math.round((restCatsSum / totalInboundMinor) * 100) : 0,
      });
    }
  }

  // Calculate Outbound Nodes
  let outboundNodes: { id: string; label: string; category: string; amountMinor: number; count: number; pct: number }[] = [];
  if (flowMode === 'TRANSACTIONS') {
    const sortedOutbound = [...outboundTxns].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const top7Outbound = sortedOutbound.slice(0, 7);
    const restOutbound = sortedOutbound.slice(7);
    const restOutboundSum = restOutbound.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    outboundNodes = top7Outbound.map((t, idx) => ({
      id: `out-${t.id || idx}`,
      label: t.description,
      category: t.category,
      amountMinor: Math.abs(t.amount),
      count: 1,
      pct: totalOutboundMinor > 0 ? Math.round((Math.abs(t.amount) / totalOutboundMinor) * 100) : 0,
    }));

    if (restOutbound.length > 0) {
      outboundNodes.push({
        id: 'out-other',
        label: `Other Outbound (${restOutbound.length} txns)`,
        category: 'Multiple',
        amountMinor: restOutboundSum,
        count: restOutbound.length,
        pct: totalOutboundMinor > 0 ? Math.round((restOutboundSum / totalOutboundMinor) * 100) : 0,
      });
    }
  } else {
    // CATEGORIES mode
    const catMap: Record<string, { label: string; amountMinor: number; count: number }> = {};
    outboundTxns.forEach((t) => {
      const cat = t.category || 'Uncategorized';
      if (!catMap[cat]) catMap[cat] = { label: cat, amountMinor: 0, count: 0 };
      catMap[cat].amountMinor += Math.abs(t.amount);
      catMap[cat].count += 1;
    });

    const sortedCats = Object.values(catMap).sort((a, b) => b.amountMinor - a.amountMinor);
    const top7Cats = sortedCats.slice(0, 7);
    const restCats = sortedCats.slice(7);
    const restCatsSum = restCats.reduce((sum, c) => sum + c.amountMinor, 0);
    const restCatsCount = restCats.reduce((sum, c) => sum + c.count, 0);

    outboundNodes = top7Cats.map((c, idx) => ({
      id: `outcat-${idx}`,
      label: c.label,
      category: c.label,
      amountMinor: c.amountMinor,
      count: c.count,
      pct: totalOutboundMinor > 0 ? Math.round((c.amountMinor / totalOutboundMinor) * 100) : 0,
    }));

    if (restCats.length > 0) {
      outboundNodes.push({
        id: 'outcat-other',
        label: `Other Categories (${restCats.length} categories)`,
        category: 'Multiple',
        amountMinor: restCatsSum,
        count: restCatsCount,
        pct: totalOutboundMinor > 0 ? Math.round((restCatsSum / totalOutboundMinor) * 100) : 0,
      });
    }
  }

  // Dynamic Height & Positioning Calculations
  const maxRows = Math.max(inboundNodes.length, outboundNodes.length, 1);
  const nodeHeight = 52;
  const gap = 14;
  const svgHeight = Math.max(460, maxRows * (nodeHeight + gap) + 80);
  const centerY = svgHeight / 2;

  const inboundTotalHeight = inboundNodes.length * nodeHeight + (inboundNodes.length - 1) * gap;
  const inboundStartY = (svgHeight - inboundTotalHeight) / 2;

  const outboundTotalHeight = outboundNodes.length * nodeHeight + (outboundNodes.length - 1) * gap;
  const outboundStartY = (svgHeight - outboundTotalHeight) / 2;

  return (
    <section className="panel" style={{ padding: '24px', overflow: 'hidden' }}>
      <div className="panel-title" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div>
          <span className="eyebrow" style={{ color: 'var(--green)' }}>Visual Ledger Diagram</span>
          <h2>Account Transaction Flow</h2>
        </div>

        {/* Filter & Mode Control Center */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Month Range Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <CalendarDays size={15} color="var(--muted)" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                background: 'var(--card)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {(availableMonths.length > 0 ? availableMonths : [currentMonthKey]).map((mKey) => (
                <option key={mKey} value={mKey}>
                  {formatMonthLabel(mKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Switcher Pills */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--paper)', padding: '3px', borderRadius: '10px', border: '1px solid var(--line)' }}>
            <button
              type="button"
              className={`secondary compact ${flowMode === 'TRANSACTIONS' ? 'active' : ''}`}
              onClick={() => setFlowMode('TRANSACTIONS')}
              style={{ height: '28px', fontSize: '11px', padding: '0 10px' }}
            >
              Top Transactions
            </button>
            <button
              type="button"
              className={`secondary compact ${flowMode === 'CATEGORIES' ? 'active' : ''}`}
              onClick={() => setFlowMode('CATEGORIES')}
              style={{ height: '28px', fontSize: '11px', padding: '0 10px' }}
            >
              By Categories
            </button>
          </div>
        </div>
      </div>

      {/* Summary Inflow / Outflow Totals */}
      <div style={{ display: 'flex', gap: '20px', fontSize: '12px', marginBottom: '16px', background: 'var(--paper)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--green)', fontWeight: 700 }}>
          Inbound Total: +{money(totalInboundMinor)} ({inboundTxns.length} entries)
        </span>
        <span style={{ color: 'var(--orange)', fontWeight: 700 }}>
          Outbound Total: -{money(totalOutboundMinor)} ({outboundTxns.length} entries)
        </span>
        <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>
          Mode: <strong>{flowMode === 'TRANSACTIONS' ? 'Individual Transactions' : 'Category Groups'}</strong> • Period: <strong>{formatMonthLabel(selectedMonth)}</strong>
        </span>
      </div>

      {filteredTxns.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          <Workflow size={36} style={{ margin: '0 auto 12px auto', display: 'block', color: 'var(--green)' }} />
          <h3>No Flow Data For Selected Filter</h3>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>
            No transaction records found for {formatMonthLabel(selectedMonth)}. Try selecting a different month or 'All Time'.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
          <svg viewBox={`0 0 1000 ${svgHeight}`} style={{ width: '100%', minWidth: '850px', height: 'auto', display: 'block' }}>
            <defs>
              <linearGradient id="inflowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--green)" stopOpacity="0.85" />
                <stop offset="100%" stopColor="var(--green)" stopOpacity="0.25" />
              </linearGradient>
              <linearGradient id="outflowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--orange)" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            {/* Inbound Flow SVG Beziers */}
            {inboundNodes.map((node, idx) => {
              const nodeCenterY = inboundStartY + idx * (nodeHeight + gap) + nodeHeight / 2;
              const strokeWidth = Math.max(2, Math.min(16, (node.amountMinor / (totalInboundMinor || 1)) * 24));
              const isHovered = hoveredNodeId === node.id;
              return (
                <path
                  key={`path-${node.id}`}
                  d={`M 230 ${nodeCenterY} C 320 ${nodeCenterY}, 320 ${centerY}, 410 ${centerY}`}
                  fill="none"
                  stroke="url(#inflowGrad)"
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  opacity={hoveredNodeId ? (isHovered ? 1 : 0.2) : 0.75}
                  style={{ transition: 'all 0.25s ease' }}
                />
              );
            })}

            {/* Outbound Flow SVG Beziers */}
            {outboundNodes.map((node, idx) => {
              const nodeCenterY = outboundStartY + idx * (nodeHeight + gap) + nodeHeight / 2;
              const strokeWidth = Math.max(2, Math.min(16, (node.amountMinor / (totalOutboundMinor || 1)) * 24));
              const isHovered = hoveredNodeId === node.id;
              return (
                <path
                  key={`path-${node.id}`}
                  d={`M 590 ${centerY} C 680 ${centerY}, 680 ${nodeCenterY}, 770 ${nodeCenterY}`}
                  fill="none"
                  stroke="url(#outflowGrad)"
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  opacity={hoveredNodeId ? (isHovered ? 1 : 0.2) : 0.75}
                  style={{ transition: 'all 0.25s ease' }}
                />
              );
            })}

            {/* Left Column: Top 7 Inbound + Other Nodes */}
            {inboundNodes.map((node, idx) => {
              const y = inboundStartY + idx * (nodeHeight + gap);
              const isHovered = hoveredNodeId === node.id;
              return (
                <g
                  key={node.id}
                  transform={`translate(10, ${y})`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width="220"
                    height={nodeHeight}
                    rx="10"
                    fill="var(--card)"
                    stroke={isHovered ? 'var(--green)' : 'var(--line)'}
                    strokeWidth={isHovered ? '2' : '1'}
                    filter={isHovered ? 'drop-shadow(0 6px 16px rgba(16,185,129,0.15))' : undefined}
                  />
                  <text x="14" y="21" fill="var(--ink)" fontSize="11" fontWeight="700">
                    {node.label.length > 24 ? `${node.label.slice(0, 24)}...` : node.label}
                  </text>
                  <text x="14" y="38" fill="var(--green)" fontSize="12" fontWeight="700">
                    +{money(node.amountMinor)}
                  </text>
                  <text x="206" y="38" textAnchor="end" fill="var(--muted)" fontSize="10">
                    {node.pct}%
                  </text>
                </g>
              );
            })}

            {/* Center Column: Selected Account Node */}
            <g transform={`translate(410, ${centerY - 55})`}>
              <rect
                width="180"
                height="110"
                rx="16"
                fill="var(--card)"
                stroke="var(--green)"
                strokeWidth="2"
                filter="drop-shadow(0 10px 30px var(--theme-shadow-color))"
              />
              <text x="90" y="26" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="700" letterSpacing="0.8">
                {(account.institution || 'BANK ACCOUNT').toUpperCase()}
              </text>
              <text x="90" y="46" textAnchor="middle" fill="var(--ink)" fontSize="14" fontWeight="800">
                {account.name.length > 18 ? `${account.name.slice(0, 18)}...` : account.name}
              </text>
              <text x="90" y="72" textAnchor="middle" fill="var(--ink)" fontSize="15" fontWeight="800">
                {money(account.balance)}
              </text>
              <text x="90" y="92" textAnchor="middle" fill="var(--muted)" fontSize="10">
                Current Balance
              </text>
            </g>

            {/* Right Column: Top 7 Outbound + Other Nodes */}
            {outboundNodes.map((node, idx) => {
              const y = outboundStartY + idx * (nodeHeight + gap);
              const isHovered = hoveredNodeId === node.id;
              return (
                <g
                  key={node.id}
                  transform={`translate(770, ${y})`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width="220"
                    height={nodeHeight}
                    rx="10"
                    fill="var(--card)"
                    stroke={isHovered ? 'var(--orange)' : 'var(--line)'}
                    strokeWidth={isHovered ? '2' : '1'}
                    filter={isHovered ? 'drop-shadow(0 6px 16px rgba(239,68,68,0.15))' : undefined}
                  />
                  <text x="14" y="21" fill="var(--ink)" fontSize="11" fontWeight="700">
                    {node.label.length > 24 ? `${node.label.slice(0, 24)}...` : node.label}
                  </text>
                  <text x="14" y="38" fill="var(--orange)" fontSize="12" fontWeight="700">
                    -{money(node.amountMinor)}
                  </text>
                  <text x="206" y="38" textAnchor="end" fill="var(--muted)" fontSize="10">
                    {node.pct}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}

type TimelineMonthItem = {
  month: string;
  monthKey: string;
  inbound: number;
  internalTransfer: number;
  outbound: number;
  totalCount: number;
  status: string;
};

function AccountTimelineAudit({ accountId }: { accountId: string }) {
  const [timeline, setTimeline] = useState<TimelineMonthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api<{ timeline: TimelineMonthItem[] }>(`/accounts/${accountId}/timeline`)
      .then((res) => {
        setTimeline(res.timeline || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(errorMessage(err, 'Could not load account monthly timeline.'));
        setLoading(false);
      });
  }, [accountId]);

  if (loading) {
    return (
      <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
        <CalendarDays size={28} style={{ margin: '0 auto 12px auto', display: 'block', color: 'var(--green)' }} />
        <span>Loading 1-Year Monthly Transaction Audit Timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel" style={{ padding: '32px', textAlign: 'center', color: '#ef4444' }}>
        <ShieldAlert size={28} style={{ margin: '0 auto 12px auto', display: 'block' }} />
        <span>{error}</span>
      </div>
    );
  }

  const totalInbound12M = timeline.reduce((sum, item) => sum + item.inbound, 0);
  const totalOutbound12M = timeline.reduce((sum, item) => sum + item.outbound, 0);
  const totalTransfers12M = timeline.reduce((sum, item) => sum + item.internalTransfer, 0);
  const totalUploadedMonths = timeline.filter((item) => item.totalCount > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 12-Month Audit Summary Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '16px 20px', borderRadius: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase' }}>12-Month Total Inbound</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: 'var(--green)', marginTop: '4px' }}>+{money(totalInbound12M)}</strong>
          <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Credits &amp; Deposits</small>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '16px 20px', borderRadius: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase' }}>12-Month Internal Transfers</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>{money(totalTransfers12M)}</strong>
          <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Between owned accounts</small>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '16px 20px', borderRadius: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>12-Month Total Outbound</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>-{money(totalOutbound12M)}</strong>
          <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Debits &amp; Spends</small>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '16px 20px', borderRadius: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Uploaded Months Coverage</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>{totalUploadedMonths} / 12 Months</strong>
          <small style={{ color: 'var(--muted)', fontSize: '11px' }}>With verified transactions</small>
        </div>
      </div>

      {/* Monthly Timeline Table Panel */}
      <section className="panel" style={{ padding: '24px' }}>
        <div className="panel-title" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="eyebrow" style={{ color: 'var(--green)' }}>Statement Verification Audit</span>
            <h2>12-Month Transaction Upload Timeline</h2>
          </div>
          <span className="month-pill" style={{ fontSize: '12px' }}>Last 12 Months</span>
        </div>

        <div className="holdings-scroll">
          <table className="holdings-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Inbound (Credits)</th>
                <th>Internal Transfers</th>
                <th>Outbound (Debits)</th>
                <th>Txn Count</th>
                <th>Statement Upload Status</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row) => {
                const isUploaded = row.totalCount > 0;
                return (
                  <tr key={row.monthKey}>
                    <td>
                      <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>{row.month}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: row.inbound > 0 ? 'var(--green)' : 'var(--muted)' }}>
                        {row.inbound > 0 ? `+${money(row.inbound)}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: row.internalTransfer > 0 ? '#a855f7' : 'var(--muted)' }}>
                        {row.internalTransfer > 0 ? money(row.internalTransfer) : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: row.outbound > 0 ? '#ef4444' : 'var(--muted)' }}>
                        {row.outbound > 0 ? `-${money(row.outbound)}` : '—'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '13px' }}>{row.totalCount}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          background: isUploaded ? 'rgba(16, 185, 129, 0.15)' : 'var(--background-alt)',
                          color: isUploaded ? 'var(--green)' : 'var(--muted)',
                          border: `1px solid ${isUploaded ? 'rgba(16, 185, 129, 0.3)' : 'var(--line)'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {isUploaded ? '🟢 Uploaded & Verified' : '⚪ No Upload / No Activity'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
