'use client';
import { ArrowLeft, ArrowRight, CalendarDays, Landmark, ReceiptText, ShieldAlert, Trash2, Lock, Settings, Plus, CreditCard, Files } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';
import { VaultModal } from '@/components/vault-modal';
import { AccountDocuments } from '@/components/account-documents';

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

  const load = useCallback(() => {
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(requestedPage));
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (minAmount.trim()) params.set('minAmount', minAmount.trim());
    if (maxAmount.trim()) params.set('maxAmount', maxAmount.trim());
    if (typeFilter !== 'ALL') params.set('type', typeFilter);

    api<AccountLedger>(`/accounts/${accountId}/transactions?${params.toString()}`).then(setData).catch((reason: unknown) => {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load this account.'));
    });
  }, [accountId, requestedPage, searchQuery, minAmount, maxAmount, typeFilter, router]);
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
    setCcLimit(account.creditLimit ? String(account.creditLimit) : '');
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
        creditLimit: ccLimit ? Number(ccLimit) : null,
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
      const amt = Number(epfoAmount);
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
        <button className="secondary" onClick={() => setShowVault(true)}><Lock size={15}/>Credentials</button>
        <button className="danger" onClick={() => { setDeleteStep(1); setDeleteError(''); }}><Trash2/>Delete or clear</button>
      </div></header>}
      {embedded && <header className={`embedded-header ${isCreditCard ? 'credit-card-embedded-header' : ''}`}><div><span className="eyebrow">{typeLabel[account.type] ?? account.type}</span><h2>{account.name}</h2>{isCreditCard && <p className="credit-card-embedded-number"><CreditCard size={14}/>{maskedCardNumber}{account.cardNetwork ? <em>{account.cardNetwork}</em> : null}</p>}</div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {account.type === 'EPFO' && <button className="secondary compact" onClick={openAddEpfo}><Plus size={14}/>Add</button>}
        {account.type === 'CREDIT_CARD' && <button className="secondary compact" onClick={openEditCc}><Settings size={14}/>Edit</button>}
        {supportsDocuments && <button className={`secondary compact account-view-button ${!showDocuments ? 'active' : ''}`} aria-pressed={!showDocuments} onClick={() => setShowDocuments(false)}><ReceiptText size={14}/>Transactions</button>}
        {supportsDocuments && <button className={`secondary compact account-view-button ${showDocuments ? 'active' : ''}`} aria-pressed={showDocuments} onClick={() => setShowDocuments(true)}><Files size={14}/>Documents</button>}
        {supportsStatementImport && <Link className="secondary compact" href={statementImportHref}>Import statement</Link>}
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
      <section className="panel account-ledger-panel">
        <div className="panel-title"><div><span className="eyebrow">Full history</span><h2>Transactions</h2></div>{pagination.total > 0 && <span className="month-pill">{(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}</span>}</div>

        {/* Amount & Search Filter Bar */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', margin: '12px 0 8px 0', padding: '12px 14px', background: 'var(--background-alt)', borderRadius: '10px', border: '1px solid var(--line)' }}>
          <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
            <input
              type="text"
              placeholder="Search description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', height: '36px', fontSize: '13px', paddingLeft: '10px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background)', color: 'var(--ink)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Amount (₹):</span>
            <input
              type="number"
              placeholder="Min ₹"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              style={{ width: '90px', height: '36px', fontSize: '13px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background)', color: 'var(--ink)' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>to</span>
            <input
              type="number"
              placeholder="Max ₹"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              style={{ width: '90px', height: '36px', fontSize: '13px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background)', color: 'var(--ink)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" className={`secondary compact ${typeFilter === 'ALL' ? 'active' : ''}`} onClick={() => setTypeFilter('ALL')} style={{ height: '36px', fontSize: '12px' }}>All</button>
            <button type="button" className={`secondary compact ${typeFilter === 'EXPENSE' ? 'active' : ''}`} onClick={() => setTypeFilter('EXPENSE')} style={{ height: '36px', fontSize: '12px', color: typeFilter === 'EXPENSE' ? '#ef4444' : undefined }}>Debits</button>
            <button type="button" className={`secondary compact ${typeFilter === 'INCOME' ? 'active' : ''}`} onClick={() => setTypeFilter('INCOME')} style={{ height: '36px', fontSize: '12px', color: typeFilter === 'INCOME' ? '#10b981' : undefined }}>Credits</button>
          </div>
          {(searchQuery || minAmount || maxAmount || typeFilter !== 'ALL') && (
            <button
              type="button"
              className="ghost compact"
              onClick={() => {
                setSearchQuery('');
                setMinAmount('');
                setMaxAmount('');
                setTypeFilter('ALL');
              }}
              style={{ height: '36px', fontSize: '12px' }}
            >
              Reset Filters
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, alignSelf: 'center', marginRight: '4px' }}>Presets:</span>
          <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => { setMinAmount('0'); setMaxAmount('1000'); }}>&lt; ₹1,000</button>
          <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => { setMinAmount('1000'); setMaxAmount('10000'); }}>₹1k – ₹10k</button>
          <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => { setMinAmount('10000'); setMaxAmount('50000'); }}>₹10k – ₹50k</button>
          <button type="button" className="ghost compact" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => { setMinAmount('50000'); setMaxAmount(''); }}>&gt; ₹50,000</button>
        </div>
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
