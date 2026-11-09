'use client';
import { ArrowLeft, ArrowRight, ArrowUpRight, ArrowDownLeft, CalendarDays, Landmark, ReceiptText, ShieldAlert, Trash2, Lock, Settings, Plus, CreditCard, Files, Pencil, Trash, TrendingUp, Search, Filter, RotateCcw, RefreshCw, SlidersHorizontal, X, Tag, Workflow, Mail, Eye, EyeOff, Scale, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';
import { VaultModal } from '@/components/vault-modal';
import { AccountDocuments } from '@/components/account-documents';
import { SipModal, type Sip } from '@/components/sip-modal';
import { SpendRulesModal } from '@/components/spend-rules-modal';
import { CategoryPickerPopover } from '@/components/category-picker-popover';
import { useTransactionMutations } from '@/hooks/useTransactionMutations';
import { useTransactionFilters } from '@/hooks/useTransactionFilters';
import { EmailProofModal } from '@/components/email-proof-modal';

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
    monthlyAverageBalance?: number | null;
    monthInflow?: number | null;
    monthOutflow?: number | null;
    monthNet?: number | null;
    monthCreditCount?: number | null;
    monthDebitCount?: number | null;
    monthTotalCount?: number | null;
    creditLimit?: number | null;
    statementDay?: number | null;
    dueDay?: number | null;
    parentAccountId?: string | null;
    parentAccountName?: string | null;
    isShared?: boolean;
    isChild?: boolean;
    cardLast4?: string | null;
    cardNetwork?: string | null;
    emailSyncEnabled?: boolean;
  };
  transactions: {
    id: string;
    transactionDate: string;
    postedDate: string | null;
    description: string;
    details: string | null;
    amount: number;
    balance?: number | null;
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
  [AccountType.RECURRING_DEPOSIT]: 'Recurring deposit',
  [AccountType.CREDIT_CARD]: 'Credit card',
  [AccountType.LOAN]: 'Loan account',
  [AccountType.STOCKS]: 'Stock account',
  [AccountType.MUTUAL_FUND]: 'Mutual Funds account',
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
  const [clearDays, setClearDays] = useState<number | null>(30);
  const [confirmationName, setConfirmationName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [activeTab, setActiveTab] = useState<'TRANSACTIONS' | 'FLOW' | 'TIMELINE' | 'DOCUMENTS'>('TRANSACTIONS');

  // Account details edit states
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [editName, setEditName] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editOpeningBalance, setEditOpeningBalance] = useState('');
  const [ccLimit, setCcLimit] = useState('');
  const [ccStatementDay, setCcStatementDay] = useState('');
  const [ccDueDay, setCcDueDay] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [saveAccountError, setSaveAccountError] = useState('');

  // Email sync states
  const [updatingEmailSync, setUpdatingEmailSync] = useState(false);
  const [syncingBankEmail, setSyncingBankEmail] = useState(false);
  const [emailSyncNotice, setEmailSyncNotice] = useState<string | null>(null);
  const [editEmailSync, setEditEmailSync] = useState(false);

  // EPFO manual add states
  const [showAddEpfo, setShowAddEpfo] = useState(false);
  const [epfoDate, setEpfoDate] = useState('');
  const [epfoDesc, setEpfoDesc] = useState('');
  const [epfoAmount, setEpfoAmount] = useState('');
  const [epfoIsCredit, setEpfoIsCredit] = useState(true);
  const [savingEpfo, setSavingEpfo] = useState(false);
  const [saveEpfoError, setSaveEpfoError] = useState('');
  const {
    editingTxCatId, setEditingTxCatId,
    batchUpdating,
    batchCatPickerOpen, setBatchCatPickerOpen,
    error: mutationsError, setError: setMutationsError,
    updateCategory,
    deleteTransaction,
    bulkUpdateCategory
  } = useTransactionMutations({ onMutated: () => load(), setData });

  const {
    search: searchQuery, setSearch: setSearchQuery,
    typeFilter, setTypeFilter,
    categoryId: selectedCategoryFilterId, setCategoryId: setSelectedCategoryFilterId,
    minAmount, setMinAmount,
    maxAmount, setMaxAmount,
    startDate, setStartDate,
    endDate, setEndDate,
    hasActiveFilters,
    clearFilters
  } = useTransactionFilters();




                const [showFilters, setShowFilters] = useState(false);
  const [showCategoryEdit, setShowCategoryEdit] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
      const [showRulesModal, setShowRulesModal] = useState(false);
    const [selectedEmailTx, setSelectedEmailTx] = useState<AccountLedger['transactions'][0] | null>(null);

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

  useEffect(() => { setActiveTab('TRANSACTIONS'); setSelectedTxIds([]); }, [accountId]);
  useEffect(() => { setSelectedTxIds([]); }, [requestedPage, selectedCategoryFilterId, searchQuery, minAmount, maxAmount, typeFilter, startDate, endDate]);

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
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

      if (!data) {
    const errorState = error ? <section className="panel account-ledger-error"><ReceiptText/><h2>Account unavailable</h2><p>{error}</p><Link className="secondary" href="/dashboard"><ArrowLeft/>Back to overview</Link></section> : <div className="loading"><span/><p>Loading account transactions…</p></div>;
    return embedded ? errorState : <Shell>{errorState}</Shell>;
  }

  const { account, transactions, pagination } = data;
  const isCreditCard = account.type === AccountType.CREDIT_CARD;
  const supportsDocuments = true;
  const isSavingsOrBank = [AccountType.BANK, AccountType.SAVINGS].includes(account.type as AccountType);
  const supportsStatementImport = isSavingsOrBank;
  const statementImportHref = `/import?kind=BANK_STATEMENT&accountId=${encodeURIComponent(account.id)}`;
  const cardOutstanding = Math.max(0, -account.balance);
  const availableCredit = account.creditLimit == null ? null : Math.max(0, account.creditLimit - cardOutstanding);
  const maskedCardNumber = account.cardLast4 ? `••••  ••••  ••••  ${account.cardLast4}` : 'Card number not stored';
  const goToPage = (page: number) => router.push(`/accounts?page=${page}&account=${accountId}`);
  const CLEAR_PRESETS: { days: number | null; label: string }[] = [
    { days: 15, label: '15 Days' },
    { days: 30, label: '30 Days' },
    { days: 60, label: '60 Days' },
    { days: 90, label: '90 Days' },
    { days: 180, label: '180 Days' },
    { days: 365, label: '1 Year' },
    { days: null, label: 'All Time' },
  ];

  const getClearRangeInfo = (days: number | null) => {
    if (days === null) {
      return {
        label: 'All Time',
        desc: 'Clear all transactions in this account and reset opening balance to ₹0.00.',
        rangeText: 'All historical transactions up to today',
      };
    }
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() - days);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return {
      label: days >= 365 ? `${Math.round(days / 365)} Year` : `${days} Days`,
      desc: `Clear transactions dated on or after ${fmt(cutoff)} (from ${fmt(cutoff)} to ${fmt(today)}).`,
      rangeText: `${fmt(cutoff)} – ${fmt(today)} (Today)`,
    };
  };

  const closeDelete = () => {
    if (!deleting) {
      setDeleteStep(0);
      setConfirmationName('');
      setDeleteError('');
      setClearDays(30);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true); setDeleteError('');
    try {
      const endpoint = deleteAction === 'CLEAR_TRANSACTIONS'
        ? `/accounts/${account.id}/transactions`
        : `/accounts/${account.id}`;
      const payload: { confirmationName: string; days?: number } = { confirmationName };
      if (deleteAction === 'CLEAR_TRANSACTIONS' && clearDays !== null) {
        payload.days = clearDays;
      }
      await api<{ deletedCount?: number; message?: string } | void>(endpoint, {
        method: 'DELETE',
        body: JSON.stringify(payload),
      });
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

  const openEditAccount = () => {
    setEditName(account.name);
    setEditInstitution(account.institution || '');
    setEditOpeningBalance(account.openingBalance !== undefined ? String(account.openingBalance / 100) : '0');
    setCcLimit(account.creditLimit ? String(account.creditLimit / 100) : '');
    setCcStatementDay(account.statementDay ? String(account.statementDay) : '');
    setCcDueDay(account.dueDay ? String(account.dueDay) : '');
    setEditEmailSync(Boolean(account.emailSyncEnabled));
    setSaveAccountError('');
    setShowEditAccount(true);
  };

  const handleSaveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingAccount(true);
    setSaveAccountError('');
    try {
      const body: any = {
        name: editName.trim(),
        institution: editInstitution.trim() || null,
      };
      if (account.type === 'CREDIT_CARD') {
        body.creditLimit = ccLimit ? Math.round(Number(ccLimit) * 100) : null;
        body.statementDay = ccStatementDay ? Number(ccStatementDay) : null;
        body.dueDay = ccDueDay ? Number(ccDueDay) : null;
      } else {
        body.openingBalance = editOpeningBalance !== '' ? Math.round(Number(editOpeningBalance) * 100) : 0;
        if (isSavingsOrBank) {
          body.emailSyncEnabled = editEmailSync;
        }
      }
      await api(`/accounts/${accountId}`, { method: 'PATCH', body: JSON.stringify(body) });
      setShowEditAccount(false);
      load();
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setSaveAccountError(errorMessage(reason, 'Could not save account details.'));
    } finally {
      setSavingAccount(false);
    }
  };

  const handleToggleEmailSync = async () => {
    if (!account || updatingEmailSync) return;
    const currentStatus = Boolean(account.emailSyncEnabled);
    const newStatus = !currentStatus;
    setUpdatingEmailSync(true);
    setEmailSyncNotice(null);
    try {
      await api(`/accounts/${account.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ emailSyncEnabled: newStatus }),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              account: {
                ...prev.account,
                emailSyncEnabled: newStatus,
              },
            }
          : prev,
      );
      setEmailSyncNotice(newStatus ? 'Email sync enabled' : 'Email sync disabled');
      setTimeout(() => setEmailSyncNotice(null), 3500);
      load();
    } catch (err: any) {
      alert(errorMessage(err, 'Failed to update email sync status.'));
    } finally {
      setUpdatingEmailSync(false);
    }
  };

  const handleSyncBankEmails = async () => {
    if (!account || syncingBankEmail) return;
    setSyncingBankEmail(true);
    setEmailSyncNotice(null);
    try {
      const res = await api<any>('/email-ingestion/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          accountScope: 'CUSTOM',
          targetAccountIds: [account.id],
          days: 90,
        }),
      });
      setEmailSyncNotice(res.message || 'Email sync complete.');
      setTimeout(() => setEmailSyncNotice(null), 5000);
      load();
    } catch (err: any) {
      alert(errorMessage(err, 'Failed to sync bank emails. Make sure your Gmail account is connected in the Import section.'));
    } finally {
      setSyncingBankEmail(false);
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
        <section className="summary-grid account-ledger-summary four-cards">
          <article>
            <span className="summary-icon income"><Landmark /></span>
            <div>
              <small>Current balance</small>
              <strong>{money(account.balance)}</strong>
              <em>Net available balance</em>
            </div>
          </article>
          <article>
            <span className="summary-icon saved"><Scale /></span>
            <div>
              <small>Monthly avg balance (MAB)</small>
              <strong>{money(account.monthlyAverageBalance ?? account.balance)}</strong>
              <em>Daily average this month</em>
            </div>
          </article>
          <article>
            <span className="summary-icon income"><ArrowDownLeft /></span>
            <div>
              <small>Money in ({new Date().toLocaleString('en-IN', { month: 'short' })})</small>
              <strong style={{ color: 'var(--green)' }}>+{money(account.monthInflow ?? 0)}</strong>
              <em>{account.monthCreditCount ? `${account.monthCreditCount} credit entries` : 'No credits this month'}</em>
            </div>
          </article>
          <article>
            <span className="summary-icon expense"><ArrowUpRight /></span>
            <div>
              <small>Money out ({new Date().toLocaleString('en-IN', { month: 'short' })})</small>
              <strong style={{ color: 'var(--red)' }}>-{money(account.monthOutflow ?? 0)}</strong>
              <em>
                {account.monthNet !== undefined && account.monthNet !== null
                  ? `Net: ${account.monthNet >= 0 ? '+' : ''}${money(account.monthNet)}`
                  : `${pagination.total.toLocaleString('en-IN')} total entries`}
              </em>
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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {isSavingsOrBank && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className={`secondary compact ${account.emailSyncEnabled ? 'active' : ''}`}
                onClick={handleToggleEmailSync}
                disabled={updatingEmailSync}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: account.emailSyncEnabled ? 'rgba(59, 130, 246, 0.12)' : undefined,
                  borderColor: account.emailSyncEnabled ? 'rgba(59, 130, 246, 0.4)' : undefined,
                  color: account.emailSyncEnabled ? 'var(--accent, #3b82f6)' : undefined,
                  fontWeight: 600,
                  cursor: updatingEmailSync ? 'wait' : 'pointer',
                }}
                title={account.emailSyncEnabled ? "Email sync is enabled for this bank account. Click to turn off." : "Click to enable email transaction sync for this bank account"}
              >
                <Mail size={14} style={{ color: account.emailSyncEnabled ? 'var(--accent, #3b82f6)' : 'currentColor' }} />
                <span>Email Sync: {account.emailSyncEnabled ? 'ON' : 'OFF'}</span>
              </button>

              {account.emailSyncEnabled && (
                <button
                  type="button"
                  className="secondary compact"
                  onClick={handleSyncBankEmails}
                  disabled={syncingBankEmail}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(59, 130, 246, 0.08)',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    color: 'var(--accent, #3b82f6)',
                    fontWeight: 600,
                  }}
                  title={`Sync emails specifically for ${account.name}`}
                >
                  <RefreshCw size={13} className={syncingBankEmail ? 'spin' : ''} />
                  {syncingBankEmail ? 'Syncing…' : 'Sync Email'}
                </button>
              )}
            </div>
          )}

          {emailSyncNotice && (
            <span
              style={{
                fontSize: '12px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--green, #10b981)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                fontWeight: 500,
              }}
            >
              {emailSyncNotice}
            </span>
          )}

          {account.type === 'EPFO' && (
            <button type="button" className="secondary compact" onClick={openAddEpfo}>
              <Plus size={14} /> Add
            </button>
          )}
          <button type="button" className="secondary compact" onClick={openEditAccount}>
            <Settings size={14} /> Edit
          </button>
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
            title="Delete account or clear transactions"
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
                          {(() => {
                            const rawCats = data?.categories || [];
                            const groups: { [key: string]: typeof rawCats } = {};
                            rawCats.forEach((c: any) => {
                              const grp =
                                c.superCategoryName ||
                                (c.type ? `${c.type.charAt(0) + c.type.slice(1).toLowerCase()}` : "General");
                              if (!groups[grp]) groups[grp] = [];
                              groups[grp].push(c);
                            });
                            return Object.entries(groups).map(([grp, items]) => (
                              <optgroup key={grp} label={grp}>
                                {items.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </option>
                                ))}
                              </optgroup>
                            ));
                          })()}
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
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => {
                            const now = new Date();
                            const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
                            setStartDate(first); setEndDate(last);
                          }}>This Month</button>
                          <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => {
                            const now = new Date();
                            const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
                            const last = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
                            setStartDate(first); setEndDate(last);
                          }}>Last Month</button>
                          <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => {
                            const now = new Date();
                            const first = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().slice(0, 10);
                            const last = now.toISOString().slice(0, 10);
                            setStartDate(first); setEndDate(last);
                          }}>Last 6 Months</button>
                          <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => {
                            const now = new Date();
                            const curYear = now.getFullYear();
                            const isAfterMarch = now.getMonth() >= 3;
                            const fyStart = isAfterMarch ? `${curYear}-04-01` : `${curYear - 1}-04-01`;
                            const fyEnd = isAfterMarch ? `${curYear + 1}-03-31` : `${curYear}-03-31`;
                            setStartDate(fyStart); setEndDate(fyEnd);
                          }}>This FY</button>
                          <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} onClick={() => {
                            const now = new Date();
                            const curYear = now.getFullYear();
                            const isAfterMarch = now.getMonth() >= 3;
                            const prevFyStart = isAfterMarch ? `${curYear - 1}-04-01` : `${curYear - 2}-04-01`;
                            const prevFyEnd = isAfterMarch ? `${curYear}-03-31` : `${curYear - 1}-03-31`;
                            setStartDate(prevFyStart); setEndDate(prevFyEnd);
                          }}>Previous FY</button>
                        </div>
                      </div>

                      {/* Amount Range with Presets */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, color: 'var(--muted)' }}>Amount Range (₹)</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>Min ₹</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={minAmount}
                              onChange={(e) => setMinAmount(e.target.value)}
                              style={{ width: '100%', height: '34px', fontSize: '12px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>Max ₹</label>
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

        {transactions.length ? <div className={`account-transaction-table ${account.type === 'EPFO' ? 'has-actions' : ''} ${showCategoryEdit ? 'has-checkboxes' : ''}`}>
          <header>
            {showCategoryEdit && (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={Boolean(transactions.length && selectedTxIds.length === transactions.length)}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                />
              </span>
            )}
            <span>Date</span>
            <span>Description</span>
            <span>Category</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span style={{ textAlign: 'right' }}>Balance</span>
            {account.type === 'EPFO' && <span style={{ textAlign: 'center' }}>Action</span>}
          </header>
          {transactions.map((transaction) => {
            const isPopoverOpen = editingTxCatId === transaction.id;
            return (
              <article
                key={transaction.id}
                className={`transaction-row ${isPopoverOpen ? "has-popover-open" : ""}`}
                style={{ position: "relative", zIndex: isPopoverOpen ? 100 : 1 }}>
                {showCategoryEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedTxIds.includes(transaction.id)}
                      onChange={() => toggleSelectTx(transaction.id)}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <time className="transaction-time-cell">
                    <span className="date-text">{new Date(transaction.transactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
                    <span className="time-text">{new Date(transaction.transactionDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}</span>
                  </time>
                  {transaction.emailReference ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEmailTx(transaction);
                      }}
                      title="View source email proof (Gmail alert)"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Eye size={12} />
                    </button>
                  ) : (
                    <span
                      title="No email proof available"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        background: 'transparent',
                        color: 'var(--muted)',
                        opacity: 0.2,
                        cursor: 'not-allowed',
                        flexShrink: 0,
                      }}
                    >
                      <EyeOff size={12} />
                    </span>
                  )}
                </div>
                <div className="transaction-description-cell">
                  <strong>{transaction.description}</strong>
                  <small>{transaction.details || (transaction.postedDate ? `Posted ${new Date(transaction.postedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : 'Ledger transaction')}</small>
                </div>
                <div className="transaction-category-cell" style={{ position: 'relative', zIndex: isPopoverOpen ? 100 : 1 }}>
                <button
                  type="button"
                  className="transaction-cat-btn"
                  onClick={() => setEditingTxCatId(editingTxCatId === transaction.id ? null : transaction.id)}
                  title="Click to change category">
                  <div className="transaction-cat-primary">
                    <span
                      className="transaction-cat-dot"
                      style={{ background: transaction.categoryColor || (transaction.categoryId ? "#3b82f6" : "#94a3b8") }}
                    />
                    <span className={`transaction-cat-name ${!transaction.categoryId ? 'uncategorised' : ''}`}>
                      {transaction.category || 'Uncategorised'}
                    </span>
                    {transaction.isTransfer && (
                      <span
                        title="Reconciled Transfer Pair"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0 4px",
                          borderRadius: "4px",
                          background: "rgba(59, 130, 246, 0.1)",
                          color: "#3b82f6",
                          fontSize: "9px",
                          fontWeight: 800,
                          marginLeft: "2px",
                        }}>
                        ⇄
                      </span>
                    )}
                  </div>
                  {transaction.superCategory && (
                    <span className="transaction-super-label">
                      {transaction.superCategory}
                    </span>
                  )}
                </button>

                {editingTxCatId === transaction.id && (
                  <CategoryPickerPopover
                    categories={data.categories || []}
                    currentCategoryId={transaction.categoryId ?? null}
                    onSelect={(newCatId) => {
                      void updateCategory(transaction.id, accountId, newCatId);
                      setEditingTxCatId(null);
                    }}
                    onClose={() => setEditingTxCatId(null)}
                  />
                )}
              </div>
              <b className={`transaction-amount-cell ${transaction.amount > 0 ? 'positive' : 'negative'}`}>
                {transaction.amount > 0 ? '+' : ''}{money(transaction.amount)}
              </b>
              <span className={`transaction-balance-cell ${transaction.balance !== undefined && transaction.balance !== null && transaction.balance < 0 ? 'negative' : ''}`}>
                {transaction.balance !== undefined && transaction.balance !== null ? money(transaction.balance) : '—'}
              </span>
              {account.type === 'EPFO' && (
                <button
                  className="danger compact"
                  style={{ padding: '6px', minWidth: '0', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                  onClick={() => deleteTransaction(transaction.id, accountId)}
                  title="Delete transaction"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </article>
            );
          })}
        </div> : <div className="account-ledger-empty"><ReceiptText/><strong>No transactions yet</strong><p>{account.type === 'EPFO' ? 'Add a manual transaction to populate the ledger.' : 'No transactions recorded for this account.'}</p></div>}

        {/* Batch Categorization Floating Bar */}
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
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="secondary compact"
                disabled={batchUpdating}
                onClick={() => setBatchCatPickerOpen(!batchCatPickerOpen)}
                style={{
                  height: '34px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  background: 'var(--background)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                }}
              >
                <span>{batchUpdating ? 'Updating…' : 'Set category for all selected…'}</span>
                <ChevronDown size={13} style={{ color: 'var(--muted)' }} />
              </button>

              {batchCatPickerOpen && (
                <CategoryPickerPopover
                  categories={data?.categories || []}
                  currentCategoryId={null}
                  onSelect={(newCatId) => {
                    void bulkUpdateCategory(selectedTxIds, newCatId);
                    setBatchCatPickerOpen(false);
                  }}
                  onClose={() => setBatchCatPickerOpen(false)}
                />
              )}

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

        {pagination.pages > 1 && <footer className="ledger-pagination"><button className="secondary" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}><ArrowLeft/>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button className="secondary" disabled={pagination.page >= pagination.pages} onClick={() => goToPage(pagination.page + 1)}>Next<ArrowRight/></button></footer>}
      </section>
      )}
      {deleteStep > 0 && (
        <div className="modal-wrap">
          <button className="backdrop" onClick={closeDelete} aria-label="Close deletion confirmation" />
          <section className="modal account-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <div className="delete-warning">
              <ShieldAlert />
              <span>
                <strong>
                  {deleteStep === 1
                    ? 'Select Action'
                    : deleteStep === 2
                    ? 'Bulk Clear Transactions'
                    : 'Final Confirmation'}
                </strong>
                <small>This action cannot be undone.</small>
              </span>
            </div>

            {deleteStep === 1 && (
              <>
                <div>
                  <span className="eyebrow">Step 1 · Choose Option</span>
                  <h2 id="delete-account-title">Manage or Delete {account.name}</h2>
                  <p style={{ margin: '4px 0 14px', fontSize: '13px', color: 'var(--muted)' }}>
                    Choose whether to wipe transactions in bulk from today backwards, or permanently delete the account itself.
                  </p>
                </div>
                <div className="modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="danger wide"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '12px 14px', gap: '3px', textAlign: 'left' }}
                    onClick={() => {
                      setDeleteAction('CLEAR_TRANSACTIONS');
                      setClearDays(30);
                      setDeleteStep(2);
                      setDeleteError('');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px' }}>
                      <RotateCcw size={15} /> Clear transactions in bulk…
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85 }}>
                      Wipe transactions from today backwards (15, 30, 60, 90, 180 days, 1 year, or all time).
                    </span>
                  </button>
                  <button
                    type="button"
                    className="danger wide"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '12px 14px', gap: '3px', textAlign: 'left' }}
                    onClick={() => {
                      setDeleteAction('DELETE_ACCOUNT');
                      setDeleteStep(3);
                      setDeleteError('');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px' }}>
                      <Trash2 size={15} /> Delete entire account
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85 }}>
                      Permanently remove this account, all history, documents, and credentials.
                    </span>
                  </button>
                  <button type="button" className="ghost wide" onClick={closeDelete} style={{ marginTop: '4px' }}>Cancel</button>
                </div>
              </>
            )}

            {deleteStep === 2 && (
              <>
                <div>
                  <span className="eyebrow">Step 2 of 3 · Timeframe selection</span>
                  <h2 id="delete-account-title">Bulk Clear Transactions</h2>
                  <p style={{ margin: '4px 0 12px', fontSize: '13px', color: 'var(--muted)' }}>
                    Select a timeframe from <strong>today backwards</strong> to clear transactions from <strong>{account.name}</strong>.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))', gap: '8px', margin: '10px 0 14px' }}>
                  {CLEAR_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={`secondary ${clearDays === preset.days ? 'active' : ''}`}
                      style={{
                        height: '36px',
                        fontSize: '12px',
                        fontWeight: 600,
                        ...(clearDays === preset.days
                          ? { background: 'var(--ink)', color: 'var(--canvas)', borderColor: 'var(--ink)' }
                          : {}),
                      }}
                      onClick={() => setClearDays(preset.days)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                      Target Window: {getClearRangeInfo(clearDays).label}
                    </span>
                    <span className="month-pill" style={{ fontSize: '10px' }}>
                      Today Backwards
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                    📅 <strong>{getClearRangeInfo(clearDays).rangeText}</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    {getClearRangeInfo(clearDays).desc}
                  </div>
                </div>

                <div className="modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" className="ghost" onClick={() => { setDeleteStep(1); setDeleteError(''); }}>Back</button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setDeleteStep(3);
                      setDeleteError('');
                    }}
                  >
                    Next: Confirm Deletion
                  </button>
                </div>
              </>
            )}

            {deleteStep === 3 && (
              <>
                <div>
                  <span className="eyebrow">Final confirmation</span>
                  <h2 id="delete-account-title">Type the account name</h2>
                  <p style={{ margin: '4px 0 10px', fontSize: '13px' }}>
                    Enter <strong>{account.name}</strong> exactly to confirm{' '}
                    {deleteAction === 'CLEAR_TRANSACTIONS' ? (
                      <>clearing <strong>{getClearRangeInfo(clearDays).label}</strong> ({getClearRangeInfo(clearDays).rangeText})</>
                    ) : (
                      'permanent account deletion'
                    )}.
                  </p>
                </div>
                <label>
                  Account name
                  <input
                    autoFocus
                    autoComplete="off"
                    value={confirmationName}
                    placeholder={account.name}
                    onChange={(event) => {
                      setConfirmationName(event.target.value);
                      setDeleteError('');
                    }}
                  />
                </label>
                {deleteError && <p className="error">{deleteError}</p>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="ghost"
                    disabled={deleting}
                    onClick={() => {
                      setDeleteStep(deleteAction === 'CLEAR_TRANSACTIONS' ? 2 : 1);
                      setConfirmationName('');
                      setDeleteError('');
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={deleting || confirmationName.trim().toLowerCase() !== account.name.trim().toLowerCase()}
                    onClick={handleDeleteConfirm}
                  >
                    {deleting
                      ? 'Processing…'
                      : deleteAction === 'CLEAR_TRANSACTIONS'
                      ? `Clear ${getClearRangeInfo(clearDays).label}`
                      : 'Permanently delete'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {showVault && <VaultModal accountId={account.id} onClose={() => setShowVault(false)} onChanged={load} />}

      {showEditAccount && (
        <div className="modal-wrap">
          <button className="backdrop" onClick={() => setShowEditAccount(false)} aria-label="Close edit modal" />
          <section className="modal" role="dialog" aria-modal="true" style={{ width: 'min(440px, 100%)' }}>
            <header className="modal-header">
              <h2>{account.type === 'CREDIT_CARD' ? 'Edit Card Details' : 'Edit Account Details'}</h2>
            </header>
            <form onSubmit={handleSaveAccount} style={{ display: 'grid', gap: '14px', marginTop: '10px' }}>
              <label>Account Name
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. SBI - Savings" />
              </label>
              {account.type !== 'CREDIT_CARD' && (
                <>
                  <label>Institution / Bank
                    <input type="text" value={editInstitution} onChange={(e) => setEditInstitution(e.target.value)} placeholder="e.g. State Bank of India" />
                  </label>
                  <label>Opening Balance (₹)
                    <input type="number" step="0.01" value={editOpeningBalance} onChange={(e) => setEditOpeningBalance(e.target.value)} placeholder="0.00" />
                    <small style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                      Initial account balance prior to any recorded transactions. The ledger running balance will recalculate from this value.
                    </small>
                  </label>
                  {isSavingsOrBank && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
                      <input
                        type="checkbox"
                        checked={editEmailSync}
                        onChange={(e) => setEditEmailSync(e.target.checked)}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>Enable Automated Email Alert Ingestion</span>
                    </label>
                  )}
                </>
              )}
              {account.type === 'CREDIT_CARD' && (
                <>
                  <label>Credit Limit (INR)
                    <input type="number" required min={0} value={ccLimit} onChange={(e) => setCcLimit(e.target.value)} placeholder="e.g. 100000" />
                  </label>
                  <label>Statement Cycle Day (1-31)
                    <input type="number" required min={1} max={31} value={ccStatementDay} onChange={(e) => setCcStatementDay(e.target.value)} placeholder="e.g. 15" />
                  </label>
                  <label>Payment Due Day (1-31)
                    <input type="number" required min={1} max={31} value={ccDueDay} onChange={(e) => setCcDueDay(e.target.value)} placeholder="e.g. 5" />
                  </label>
                </>
              )}
              {saveAccountError && <p className="error">{saveAccountError}</p>}
              <div className="modal-actions" style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="ghost" onClick={() => setShowEditAccount(false)}>Cancel</button>
                <button type="submit" className="primary" disabled={savingAccount}>{savingAccount ? 'Saving…' : 'Save Details'}</button>
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
      {selectedEmailTx && selectedEmailTx.emailReference && (
        <EmailProofModal
          data={{
            accountName: account.name,
            accountType: account.type,
            cardLast4: account.cardLast4,
            amount: selectedEmailTx.amount,
            emailReference: selectedEmailTx.emailReference,
          }}
          onClose={() => setSelectedEmailTx(null)}
        />
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
