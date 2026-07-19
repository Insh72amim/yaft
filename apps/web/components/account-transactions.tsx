'use client';
import { ArrowLeft, ArrowRight, CalendarDays, Landmark, ReceiptText, ShieldAlert, Trash2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';
import { VaultModal } from '@/components/vault-modal';

type AccountLedger = {
  account: { id: string; name: string; type: string; institution: string | null; currency: string; openingBalance: number; balance: number };
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
  const load = useCallback(() => {
    setError('');
    api<AccountLedger>(`/accounts/${accountId}/transactions?page=${requestedPage}`).then(setData).catch((reason: unknown) => {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load this account.'));
    });
  }, [accountId, requestedPage, router]);
  useEffect(() => { load(); }, [load]);

  if (!data) {
    const errorState = error ? <section className="panel account-ledger-error"><ReceiptText/><h2>Account unavailable</h2><p>{error}</p><Link className="secondary" href="/dashboard"><ArrowLeft/>Back to overview</Link></section> : <div className="loading"><span/><p>Loading account transactions…</p></div>;
    return embedded ? errorState : <Shell>{errorState}</Shell>;
  }

  const { account, transactions, pagination } = data;
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

  const content = (
    <div className={`account-detail-content ${embedded ? 'embedded' : ''}`}>
      {!embedded && <header className="page-header"><div><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>Overview</Link><span className="eyebrow">Account ledger</span><h1>{account.name}</h1><p>{typeLabel[account.type] ?? account.type}{account.institution ? ` · ${account.institution}` : ''}</p></div><div style={{ display: 'flex', gap: '8px' }}><button className="secondary" onClick={() => setShowVault(true)}><Lock size={15}/>Credentials</button><button className="danger" onClick={() => { setDeleteStep(1); setDeleteError(''); }}><Trash2/>Delete or clear</button></div></header>}
      {embedded && <header className="embedded-header"><div><span className="eyebrow">{typeLabel[account.type] ?? account.type}</span><h2>{account.name}</h2></div><div style={{ display: 'flex', gap: '8px' }}><button className="secondary compact" onClick={() => setShowVault(true)}><Lock size={14}/>Credentials</button><Link className="secondary compact" href={`/import?accountId=${account.id}`}>Import statement</Link><button className="danger compact" onClick={() => { setDeleteStep(1); setDeleteError(''); }}><Trash2/></button></div></header>}
      <section className="summary-grid account-ledger-summary">
        <article><span className="summary-icon income"><Landmark/></span><div><small>Current balance</small><strong>{money(account.balance)}</strong><em>{account.currency}</em></div></article>
        <article><span className="summary-icon saved"><CalendarDays/></span><div><small>Opening balance</small><strong>{money(account.openingBalance)}</strong><em>Account starting point</em></div></article>
        <article><span className="summary-icon expense"><ReceiptText/></span><div><small>Transactions</small><strong>{pagination.total.toLocaleString('en-IN')}</strong><em>Reviewed ledger entries</em></div></article>
      </section>
      <section className="panel account-ledger-panel">
        <div className="panel-title"><div><span className="eyebrow">Full history</span><h2>Transactions</h2></div>{pagination.total > 0 && <span className="month-pill">{(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}</span>}</div>
        {transactions.length ? <div className="account-transaction-table">
          <header><span>Date</span><span>Description</span><span>Category</span><span>Amount</span></header>
          {transactions.map((transaction) => <article key={transaction.id}><time>{new Date(transaction.transactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time><div><strong>{transaction.description}</strong><small>{transaction.details || (transaction.postedDate ? `Posted ${new Date(transaction.postedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : 'Ledger transaction')}</small></div><span className={`category-pill ${transaction.isTransfer ? 'transfer' : ''}`}>{transaction.isTransfer ? 'Transfer' : transaction.category}</span><b className={transaction.amount > 0 ? 'positive' : ''}>{transaction.amount > 0 ? '+' : ''}{money(transaction.amount)}</b></article>)}
        </div> : <div className="account-ledger-empty"><ReceiptText/><strong>No transactions yet</strong><p>Import and approve a statement for this account to build its ledger.</p><Link className="secondary" href={`/import?accountId=${account.id}`}>Import statement</Link></div>}
        {pagination.pages > 1 && <footer className="ledger-pagination"><button className="secondary" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}><ArrowLeft/>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button className="secondary" disabled={pagination.page >= pagination.pages} onClick={() => goToPage(pagination.page + 1)}>Next<ArrowRight/></button></footer>}
      </section>
      {deleteStep > 0 && <div className="modal-wrap"><button className="backdrop" onClick={closeDelete} aria-label="Close deletion confirmation"/><section className="modal account-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><div className="delete-warning"><ShieldAlert/><span><strong>{deleteStep === 1 ? 'Select Action' : 'Final confirmation'}</strong><small>This action cannot be undone.</small></span></div>{deleteStep === 1 ? <><div><span className="eyebrow">First confirmation</span><h2 id="delete-account-title">Delete or Clear {account.name}?</h2><p>Choose whether to wipe all transactions/import history, or permanently delete the account itself.</p></div><div className="modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '12px' }}><button className="danger wide" onClick={() => { setDeleteAction('CLEAR_TRANSACTIONS'); setDeleteStep(2); setDeleteError(''); }}>Clear all transactions ({pagination.total.toLocaleString('en-IN')})</button><button className="danger wide" onClick={() => { setDeleteAction('DELETE_ACCOUNT'); setDeleteStep(2); setDeleteError(''); }}>Delete entire account</button><button className="ghost wide" onClick={closeDelete}>Cancel</button></div></> : <><div><span className="eyebrow">Second confirmation</span><h2 id="delete-account-title">Type the account name</h2><p>Enter <strong>{account.name}</strong> exactly to confirm {deleteAction === 'CLEAR_TRANSACTIONS' ? 'clearing all transactions' : 'permanent account deletion'}.</p></div><label>Account name<input autoFocus autoComplete="off" value={confirmationName} onChange={(event) => { setConfirmationName(event.target.value); setDeleteError(''); }} /></label>{deleteError && <p className="error">{deleteError}</p>}<div className="modal-actions"><button className="ghost" disabled={deleting} onClick={() => { setDeleteStep(1); setConfirmationName(''); setDeleteError(''); }}>Back</button><button className="danger" disabled={deleting || confirmationName !== account.name} onClick={handleDeleteConfirm}>{deleting ? 'Processing…' : deleteAction === 'CLEAR_TRANSACTIONS' ? 'Clear transactions' : 'Permanently delete'}</button></div></>}</section></div>}
      {showVault && <VaultModal accountId={account.id} onClose={() => setShowVault(false)} />}
    </div>
  );

  return embedded ? content : <Shell>{content}</Shell>;
}
