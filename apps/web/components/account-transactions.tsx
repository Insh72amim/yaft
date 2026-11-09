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
import { TransactionFilterBar } from '@/components/ledger/transaction-filter-bar';
import { BatchCategoryFloatingBar } from '@/components/ledger/batch-category-floating-bar';
import { TransactionCategoryCell, TransactionTimeWithEmailCell } from '@/components/ledger/transaction-cells';
import { ActiveSipsPanel } from '@/components/account/active-sips-panel';
import { AccountFlowDiagram } from '@/components/account/account-flow-diagram';
import { AccountTimelineAudit } from '@/components/account/account-timeline-audit';

export { ActiveSipsPanel };

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
                  <TransactionFilterBar
                    categories={data?.categories || []}
                    categoryId={selectedCategoryFilterId}
                    onCategoryChange={setSelectedCategoryFilterId}
                    search={searchQuery}
                    onSearchChange={setSearchQuery}
                    typeFilter={typeFilter}
                    onTypeFilterChange={setTypeFilter}
                    startDate={startDate}
                    onStartDateChange={setStartDate}
                    endDate={endDate}
                    onEndDateChange={setEndDate}
                    minAmount={minAmount}
                    onMinAmountChange={setMinAmount}
                    maxAmount={maxAmount}
                    onMaxAmountChange={setMaxAmount}
                    activeFilterCount={activeFilterCount}
                    onResetFilters={() => {
                      setSelectedCategoryFilterId('all');
                      setSearchQuery('');
                      setMinAmount('');
                      setMaxAmount('');
                      setStartDate('');
                      setEndDate('');
                      setTypeFilter('ALL');
                    }}
                    containerMargin="0 24px 24px 24px"
                  />                )}
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
                <TransactionTimeWithEmailCell
                  transactionDate={transaction.transactionDate}
                  hasEmailProof={Boolean(transaction.emailReference)}
                  onViewEmailProof={() => setSelectedEmailTx(transaction)}
                />
                <div className="transaction-description-cell">
                  <strong>{transaction.description}</strong>
                  <small>{transaction.details || (transaction.postedDate ? `Posted ${new Date(transaction.postedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : 'Ledger transaction')}</small>
                </div>
                <TransactionCategoryCell
                  categoryId={transaction.categoryId}
                  categoryName={transaction.category}
                  categoryColor={transaction.categoryColor}
                  superCategory={transaction.superCategory}
                  isTransfer={transaction.isTransfer}
                  isPopoverOpen={isPopoverOpen}
                  categories={data.categories || []}
                  onTogglePopover={() => setEditingTxCatId(editingTxCatId === transaction.id ? null : transaction.id)}
                  onClosePopover={() => setEditingTxCatId(null)}
                  onSelectCategory={(newCatId) => {
                    void updateCategory(transaction.id, accountId, newCatId);
                  }}
                />
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

        <BatchCategoryFloatingBar
          selectedCount={selectedTxIds.length}
          batchUpdating={batchUpdating}
          batchCatPickerOpen={batchCatPickerOpen}
          onTogglePicker={() => setBatchCatPickerOpen(!batchCatPickerOpen)}
          onClosePicker={() => setBatchCatPickerOpen(false)}
          categories={data?.categories || []}
          onSelectCategory={(newCatId) => {
            void bulkUpdateCategory(selectedTxIds, newCatId);
          }}
          onDeselectAll={() => setSelectedTxIds([])}
        />

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
