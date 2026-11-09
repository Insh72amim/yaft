'use client';

import {
  ArrowLeft,
  Landmark,
  ReceiptText,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Files,
  Zap,
  Repeat,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';
import { VaultModal } from '@/components/vault-modal';
import { AccountDocuments } from '@/components/account-documents';

export type RecurringDepositDetail = {
  hasSchedule: boolean;
  accountName: string;
  institution: string | null;
  rd?: {
    id: string;
    startDate: string;
    maturityDate: string | null;
    monthlyAmount: number;
    interestRate: number;
    depositDay: number;
    termMonths: number;
    maturityAmount: number;
    autoIncrease: boolean;
    sourceAccountId: string | null;
    createdAt: string;
  };
  summary?: {
    totalDeposited: number;
    totalExpectedDeposit: number;
    totalInterest: number;
    maturityAmount: number;
    paidCount: number;
    totalCount: number;
    nextDepositDate: string | null;
    nextDepositAmount: number;
    progressPct: number;
  };
  installments?: {
    id: string;
    number: number;
    dueDate: string;
    amount: number;
    accumulatedBalance: number;
    status: 'PAID' | 'PAST_UNCONFIRMED' | 'FUTURE';
    confirmedAt: string | null;
  }[];
};

export function RecurringDepositSchedule({
  accountId,
  embedded,
}: {
  accountId: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<RecurringDepositDetail>();
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);
  const [confirmationName, setConfirmationName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const load = useCallback(() => {
    setError('');
    api<RecurringDepositDetail>(`/accounts/${accountId}/recurring-deposit`)
      .then(setData)
      .catch((reason: unknown) => {
        if (isUnauthorized(reason)) router.replace('/login');
        else setError(errorMessage(reason, 'Could not load recurring deposit details.'));
      });
  }, [accountId, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setShowDocuments(false);
  }, [accountId]);

  const confirmPayment = async (installmentId: string) => {
    setConfirmingId(installmentId);
    try {
      await api(`/accounts/${accountId}/recurring-deposit/installments/${installmentId}/confirm`, {
        method: 'PATCH',
      });
      load();
    } catch (reason) {
      alert(errorMessage(reason, 'Could not confirm deposit.'));
    } finally {
      setConfirmingId(null);
    }
  };

  const unconfirmPayment = async (installmentId: string) => {
    setConfirmingId(installmentId);
    try {
      await api(`/accounts/${accountId}/recurring-deposit/installments/${installmentId}/unconfirm`, {
        method: 'PATCH',
      });
      load();
    } catch (reason) {
      alert(errorMessage(reason, 'Could not undo deposit confirmation.'));
    } finally {
      setConfirmingId(null);
    }
  };

  const toggleAutoIncrease = async () => {
    if (!data?.rd) return;
    setTogglingAuto(true);
    try {
      const nextSetting = !data.rd.autoIncrease;
      await api(`/accounts/${accountId}/recurring-deposit/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ autoIncrease: nextSetting }),
      });
      load();
    } catch (reason) {
      alert(errorMessage(reason, 'Failed to update auto-increase settings.'));
    } finally {
      setTogglingAuto(false);
    }
  };

  const closeDelete = () => {
    if (!deleting) {
      setDeleteStep(0);
      setConfirmationName('');
      setDeleteError('');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api(`/accounts/${accountId}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmationName }),
      });
      if (embedded) window.location.reload();
      else {
        router.replace('/accounts');
        router.refresh();
      }
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setDeleteError(errorMessage(reason, 'Could not delete this account.'));
    } finally {
      setDeleting(false);
    }
  };

  if (!data) {
    const errorState = error ? (
      <section className="panel account-ledger-error">
        <ReceiptText />
        <h2>Recurring deposit details unavailable</h2>
        <p>{error}</p>
        <Link className="secondary" href="/accounts">
          <ArrowLeft /> Back to accounts
        </Link>
      </section>
    ) : (
      <div className="loading">
        <span />
        <p>Loading recurring deposit schedule…</p>
      </div>
    );
    return errorState;
  }

  if (!data.hasSchedule || !data.rd || !data.summary || !data.installments) {
    return (
      <section className="panel account-ledger-error">
        <Repeat />
        <h2>No recurring deposit schedule found</h2>
        <p>This account does not have an active recurring deposit schedule configured.</p>
        <Link className="secondary" href="/accounts">
          <ArrowLeft /> Back to accounts
        </Link>
      </section>
    );
  }

  const { rd, installments, summary, accountName } = data;

  const getStatusBadge = (inst: (typeof installments)[number]) => {
    if (inst.status === 'PAID') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="rd-status-badge paid"
            title={
              inst.confirmedAt
                ? `Confirmed on ${new Date(inst.confirmedAt).toLocaleDateString('en-IN')}`
                : undefined
            }
          >
            <CheckCircle2 size={13} /> Paid
          </span>
          {!rd.autoIncrease && (
            <button
              type="button"
              className="rd-unconfirm-btn"
              title="Undo deposit confirmation"
              disabled={confirmingId === inst.id}
              onClick={() => unconfirmPayment(inst.id)}
            >
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      );
    }

    const due = new Date(inst.dueDate);
    const now = new Date();
    const dueYMD = due.toISOString().slice(0, 10);
    const todayYMD = now.toISOString().slice(0, 10);
    const isDueOrPast = inst.status === 'PAST_UNCONFIRMED' || dueYMD <= todayYMD || due <= now;

    if (isDueOrPast) {
      return (
        <button
          className="rd-confirm-btn"
          disabled={confirmingId === inst.id}
          onClick={() => confirmPayment(inst.id)}
        >
          {confirmingId === inst.id ? 'Confirming…' : 'Confirm Deposit'}
        </button>
      );
    }

    return (
      <span className="rd-status-badge future">
        <Lock size={12} /> Upcoming
      </span>
    );
  };

  return (
    <div className={`account-detail-content ${embedded ? 'embedded' : ''}`}>
      {/* 1. Summary Cards Top Grid */}
      <section className="summary-grid account-ledger-summary">
        <article>
          <span className="summary-icon saved">
            <Landmark />
          </span>
          <div>
            <small>Total Deposited</small>
            <strong>{money(summary.totalDeposited)}</strong>
            <em>Current balance</em>
          </div>
        </article>
        <article>
          <span className="summary-icon income">
            <Repeat />
          </span>
          <div>
            <small>Monthly Deposit</small>
            <strong>{money(rd.monthlyAmount)}</strong>
            <em>Due on day {rd.depositDay}</em>
          </div>
        </article>
        <article>
          <span className="summary-icon saved">
            <Sparkles />
          </span>
          <div>
            <small>Estimated Maturity</small>
            <strong>{money(summary.maturityAmount)}</strong>
            <em>+{money(summary.totalInterest)} interest</em>
          </div>
        </article>
        <article>
          <span className="summary-icon">
            <CheckCircle2 />
          </span>
          <div>
            <small>Progress</small>
            <strong>
              {summary.paidCount} / {summary.totalCount}
            </strong>
            <em>{summary.progressPct}% completed</em>
          </div>
        </article>
      </section>

      {/* 2. Auto-Increase Setting Banner */}
      <div className={`rd-settings-banner ${rd.autoIncrease ? 'auto-on' : 'auto-off'}`}>
        <div className="rd-settings-info">
          <div className="rd-settings-badge">
            {rd.autoIncrease ? (
              <>
                <Zap size={14} className="zap-icon" />
                <span>Auto-Increase: ACTIVE</span>
              </>
            ) : (
              <>
                <AlertCircle size={14} />
                <span>Manual Confirmation: ACTIVE</span>
              </>
            )}
          </div>
          <p>
            {rd.autoIncrease ? (
              <>
                Your balance <strong>automatically increases</strong> on day{' '}
                <strong>{rd.depositDay}</strong> of each month when deposit is due.
              </>
            ) : (
              <>
                Due deposits stay as <strong>"Due for Deposit"</strong> until you click{' '}
                <strong>"Confirm Deposit"</strong> after transferring funds.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className={`rd-toggle-btn ${rd.autoIncrease ? 'secondary' : 'primary'}`}
          disabled={togglingAuto}
          onClick={toggleAutoIncrease}
        >
          {togglingAuto
            ? 'Updating…'
            : rd.autoIncrease
            ? 'Switch to Manual Confirmation'
            : '⚡ Enable Auto-Increase'}
        </button>
      </div>

      {/* 3. Tab Navigation & Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '6px',
            background: 'var(--card)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--line)',
          }}
        >
          <button
            type="button"
            className={`secondary compact ${!showDocuments ? 'active' : ''}`}
            onClick={() => setShowDocuments(false)}
          >
            <ReceiptText size={14} /> Schedule ({installments.length})
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
            title="Delete Account"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 4. Tab Content View */}
      {showDocuments ? (
        <AccountDocuments accountId={accountId} />
      ) : (
        <section className="panel account-ledger-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Recurring Deposit Schedule</span>
              <h2>Installments &amp; Progress</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="month-pill">Interest: {rd.interestRate}% p.a. (Quarterly)</span>
              <span className="month-pill">Total Gain: +{money(summary.totalInterest)}</span>
            </div>
          </div>

          <div className="account-transaction-table rd-schedule-table">
            <header>
              <span>#</span>
              <span>Due Date</span>
              <span>Deposit Amount</span>
              <span>Accumulated Balance</span>
              <span>Status</span>
            </header>
            {installments.map((inst) => (
              <article key={inst.id} className={`rd-row ${inst.status.toLowerCase()}`}>
                <span>{inst.number}</span>
                <time>
                  {new Date(inst.dueDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                </time>
                <b>{money(inst.amount)}</b>
                <b>{money(inst.accumulatedBalance)}</b>
                <div>{getStatusBadge(inst)}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 5. Delete Confirmation Modal */}
      {deleteStep > 0 && (
        <div className="modal-wrap">
          <button
            className="backdrop"
            onClick={closeDelete}
            aria-label="Close deletion confirmation"
          />
          <section
            className="modal account-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <div className="delete-warning">
              <ShieldAlert />
              <span>
                <strong>
                  {deleteStep === 1 ? 'Permanent deletion' : 'Final confirmation'}
                </strong>
                <small>This action cannot be undone.</small>
              </span>
            </div>
            {deleteStep === 1 ? (
              <>
                <div>
                  <span className="eyebrow">First confirmation</span>
                  <h2 id="delete-account-title">Delete {accountName}?</h2>
                  <p>
                    This permanently removes the recurring deposit account, the entire deposit
                    schedule of {summary.totalCount} installments, and any saved credentials.
                  </p>
                </div>
                <div className="modal-actions">
                  <button className="ghost" onClick={closeDelete}>
                    Cancel
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      setDeleteStep(2);
                      setDeleteError('');
                    }}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="eyebrow">Second confirmation</span>
                  <h2 id="delete-account-title">Type the account name</h2>
                  <p>
                    Enter <strong>{accountName}</strong> exactly to enable permanent deletion.
                  </p>
                </div>
                <input
                  autoFocus
                  autoComplete="off"
                  value={confirmationName}
                  onChange={(event) => {
                    setConfirmationName(event.target.value);
                    setDeleteError('');
                  }}
                />
                {deleteError && <p className="error">{deleteError}</p>}
                <div className="modal-actions">
                  <button
                    className="ghost"
                    disabled={deleting}
                    onClick={() => {
                      setDeleteStep(1);
                      setConfirmationName('');
                      setDeleteError('');
                    }}
                  >
                    Back
                  </button>
                  <button
                    className="danger"
                    disabled={deleting || confirmationName !== accountName}
                    onClick={handleDelete}
                  >
                    {deleting ? 'Deleting…' : 'Permanently delete'}
                  </button>
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
