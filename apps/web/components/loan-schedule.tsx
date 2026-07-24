'use client';
import { ArrowLeft, Landmark, ReceiptText, ShieldAlert, Trash2, CheckCircle2, AlertCircle, Lock, Files } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';
import { VaultModal } from '@/components/vault-modal';
import { AccountDocuments } from '@/components/account-documents';

type LoanDetail = {
  loan: { id: string; startDate: string; principal: number; interestRate: number; emiAmount: number; emiDay: number; termMonths: number };
  installments: { id: string; number: number; dueDate: string; principalAmount: number; interestAmount: number; emiAmount: number; balance: number; status: 'PAID' | 'PAST_UNCONFIRMED' | 'FUTURE'; confirmedAt: string | null }[];
  summary: { totalInterest: number; totalPaid: number; outstanding: number; paidCount: number; totalCount: number };
};

export function LoanSchedule({ accountId, embedded }: { accountId: string; embedded?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<LoanDetail>();
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);
  const [confirmationName, setConfirmationName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const load = useCallback(() => {
    setError('');
    api<LoanDetail>(`/accounts/${accountId}/loan`).then(setData).catch((reason: unknown) => {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load loan details.'));
    });
  }, [accountId, router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setShowDocuments(false); }, [accountId]);

  const confirmPayment = async (installmentId: string) => {
    setConfirmingId(installmentId);
    try {
      await api(`/accounts/${accountId}/installments/${installmentId}/confirm`, { method: 'PATCH' });
      load();
    } catch (reason) {
      alert(errorMessage(reason, 'Could not confirm payment.'));
    } finally {
      setConfirmingId(null);
    }
  };

  const closeDelete = () => { if (!deleting) { setDeleteStep(0); setConfirmationName(''); setDeleteError(''); } };
  const deleteAccount = async () => {
    setDeleting(true); setDeleteError('');
    try {
      // The backend uses account name confirmation
      // We don't have the account object here directly in details, but we can verify against confirmation name
      // Wait, let's fetch the account name first or just assume it is the user's entry.
      // Actually, since we need to delete account, the DELETE /accounts/:id endpoint needs confirmationName.
      // We can get it from the summary / loan details institution or we can just prompt for deletion.
      // Wait, the account name is verified on the backend. How can the user know what to type if we don't display it?
      // We can display the account name (usually institution + ' Loan' or the name you gave it).
      // Let's check how delete works in AccountTransactions: `account.name` is shown.
      // Here, let's look up how we get the account name. The Loan detail endpoint doesn't return account name directly, but we can return it.
      // Wait, let's fetch it or let the backend return the account name in GET :accountId/loan response.
      // Let's modify the GET :accountId/loan endpoint to return the account name!
      // Wait, let's check accounts.controller.ts getLoanDetails endpoint:
      // It returns:
      // return { loan: { ... }, installments: [...], summary: { ... } };
      // Yes, I can add `accountName: account.name` to the return object!
      // Let's make sure it's in the return object.
      // But wait! I can just use account.name if I add it.
      // Let's add `accountName: account.name` to the GET endpoint.
    } catch (reason) {
      // ...
    }
  };

  if (!data) {
    const errorState = error ? <section className="panel account-ledger-error"><ReceiptText/><h2>Loan details unavailable</h2><p>{error}</p><Link className="secondary" href="/accounts"><ArrowLeft/>Back to accounts</Link></section> : <div className="loading"><span/><p>Loading loan schedule…</p></div>;
    return embedded ? errorState : errorState;
  }

  const { loan, installments, summary } = data;
  
  // Wait, let's fetch the accountName from our modified GET endpoint.
  const accountName = (data as any).accountName || 'Loan Account';

  const handleDelete = async () => {
    setDeleting(true); setDeleteError('');
    try {
      await api(`/accounts/${accountId}`, { method: 'DELETE', body: JSON.stringify({ confirmationName }) });
      if (embedded) window.location.reload();
      else { router.replace('/accounts'); router.refresh(); }
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setDeleteError(errorMessage(reason, 'Could not delete this account.'));
    } finally { setDeleting(false); }
  };

  const getStatusBadge = (inst: typeof installments[number]) => {
    if (inst.status === 'PAID') {
      return (
        <span className="loan-status-badge paid" title={inst.confirmedAt ? `Confirmed on ${new Date(inst.confirmedAt).toLocaleDateString('en-IN')}` : undefined}>
          <CheckCircle2 size={14} /> Paid
        </span>
      );
    }
    if (inst.status === 'PAST_UNCONFIRMED') {
      return (
        <button 
          className="loan-confirm-btn" 
          disabled={confirmingId === inst.id}
          onClick={() => confirmPayment(inst.id)}
        >
          {confirmingId === inst.id ? 'Confirming…' : 'Confirm paid'}
        </button>
      );
    }
    return (
      <span className="loan-status-badge future">
        <Lock size={12} /> Upcoming
      </span>
    );
  };

  return (
    <div className={`account-detail-content ${embedded ? 'embedded' : ''}`}>
      {/* 1. Summary Cards Top Grid */}
      <section className="summary-grid account-ledger-summary">
        <article>
          <span className="summary-icon expense"><Landmark/></span>
          <div>
            <small>Outstanding principal</small>
            <strong>{money(summary.outstanding)}</strong>
            <em>Outstanding balance</em>
          </div>
        </article>
        <article>
          <span className="summary-icon saved"><ReceiptText/></span>
          <div>
            <small>EMI amount</small>
            <strong>{money(loan.emiAmount)}</strong>
            <em>per month (due day {loan.emiDay})</em>
          </div>
        </article>
        <article>
          <span className="summary-icon income"><CheckCircle2/></span>
          <div>
            <small>Progress</small>
            <strong>{summary.paidCount} / {summary.totalCount}</strong>
            <em>EMIs completed</em>
          </div>
        </article>
        <article>
          <span className="summary-icon"><AlertCircle/></span>
          <div>
            <small>Interest rate</small>
            <strong>{loan.interestRate}%</strong>
            <em>Annual interest rate</em>
          </div>
        </article>
      </section>

      {/* 2. Tab Navigation & Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--card)', padding: '4px', borderRadius: '12px', border: '1px solid var(--line)' }}>
          <button
            type="button"
            className={`secondary compact ${!showDocuments ? 'active' : ''}`}
            onClick={() => setShowDocuments(false)}
          >
            <ReceiptText size={14} /> Schedule
          </button>
          <button
            type="button"
            className={`secondary compact ${showDocuments ? 'active' : ''}`}
            onClick={() => setShowDocuments(true)}
          >
            <Files size={14} /> Documents
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="secondary compact" onClick={() => setShowVault(true)}>
            <Lock size={14} /> Credentials
          </button>
          <button
            type="button"
            className="danger compact"
            onClick={() => setDeleteStep(1)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 3. Tab Content View */}
      {showDocuments ? (
        <AccountDocuments accountId={accountId} />
      ) : (
        <section className="panel account-ledger-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Amortisation Schedule</span>
              <h2>Installments</h2>
            </div>
            <span className="month-pill">Total Interest: {money(summary.totalInterest)}</span>
          </div>

          <div className="account-transaction-table loan-schedule-table">
            <header>
              <span>#</span>
              <span>Due Date</span>
              <span>EMI</span>
              <span>Principal</span>
              <span>Interest</span>
              <span>Outstanding</span>
              <span>Status</span>
            </header>
            {installments.map((inst) => (
              <article 
                key={inst.id} 
                className={`loan-row ${inst.status.toLowerCase()}`}
              >
                <span>{inst.number}</span>
                <time>{new Date(inst.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time>
                <b>{money(inst.emiAmount)}</b>
                <span>{money(inst.principalAmount)}</span>
                <span>{money(inst.interestAmount)}</span>
                <b>{money(inst.balance)}</b>
                <div>{getStatusBadge(inst)}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      {deleteStep > 0 && (
        <div className="modal-wrap">
          <button className="backdrop" onClick={closeDelete} aria-label="Close deletion confirmation"/>
          <section className="modal account-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <div className="delete-warning">
              <ShieldAlert/>
              <span>
                <strong>{deleteStep === 1 ? 'Permanent deletion' : 'Final confirmation'}</strong>
                <small>This action cannot be undone.</small>
              </span>
            </div>
            {deleteStep === 1 ? (
              <>
                <div>
                  <span className="eyebrow">First confirmation</span>
                  <h2 id="delete-account-title">Delete {accountName}?</h2>
                  <p>This permanently removes the loan account, the entire EMI schedule of {summary.totalCount} installments, and any saved credentials.</p>
                </div>
                <div className="modal-actions">
                  <button className="ghost" onClick={closeDelete}>Cancel</button>
                  <button className="danger" onClick={() => { setDeleteStep(2); setDeleteError(''); }}>Continue</button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="eyebrow">Second confirmation</span>
                  <h2 id="delete-account-title">Type the account name</h2>
                  <p>Enter <strong>{accountName}</strong> exactly to enable permanent deletion.</p>
                </div>
                <input 
                  autoFocus 
                  autoComplete="off" 
                  value={confirmationName} 
                  onChange={(event) => { setConfirmationName(event.target.value); setDeleteError(''); }} 
                />
                {deleteError && <p className="error">{deleteError}</p>}
                <div className="modal-actions">
                  <button className="ghost" disabled={deleting} onClick={() => { setDeleteStep(1); setConfirmationName(''); setDeleteError(''); }}>Back</button>
                  <button className="danger" disabled={deleting || confirmationName !== accountName} onClick={handleDelete}>{deleting ? 'Deleting…' : 'Permanently delete'}</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {showVault && <VaultModal accountId={accountId} onClose={() => setShowVault(false)} />}
    </div>
  );
}
