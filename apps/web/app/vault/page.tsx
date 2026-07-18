'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  Lock, Eye, EyeOff, CreditCard, Landmark, PiggyBank, TrendingUp,
  ChartPieIcon as ChartPie, Building2, BadgeIndianRupee, Pencil,
  Trash2, Save, X, ShieldCheck, AlertCircle, Copy, Check,
} from 'lucide-react';
import { api, errorMessage, isUnauthorized } from '@/lib/api';
import { Shell } from '@/components/shell';

// ─── Types ──────────────────────────────────────────────────────────────────
interface VaultAccount {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  currency: string;
  vault: {
    last4: string | null;
    ifsc: string | null;
    upiId: string | null;
    cardExpiryMm: number | null;
    cardExpiryYy: number | null;
    cardNetwork: string | null;
    hasAccountNumber: boolean;
    hasCardNumber: boolean;
    hasCvv: boolean;
    updatedAt: string;
  } | null;
}

interface RevealedData {
  accountNumber?: string;
  cardNumber?: string;
  cvv?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const BANK_TYPES = ['SAVINGS', 'FIXED_DEPOSIT', 'BANK'];
const CARD_TYPES = ['CREDIT_CARD'];

function isBankAccount(type: string) { return BANK_TYPES.includes(type); }
function isCardAccount(type: string) { return CARD_TYPES.includes(type); }

function getIcon(type: string) {
  if (type === 'CREDIT_CARD') return <CreditCard size={16} />;
  if (type === 'INVESTMENT') return <ChartPie size={16} />;
  if (type === 'STOCKS') return <TrendingUp size={16} />;
  if (type === 'EPFO') return <Building2 size={16} />;
  if (type === 'LOAN') return <BadgeIndianRupee size={16} />;
  if (type === 'SAVINGS') return <PiggyBank size={16} />;
  return <Landmark size={16} />;
}

function maskAccountNumber(last4: string | null) {
  return last4 ? `•••••••• ${last4}` : '••••••••••••';
}

function maskCardNumber(last4: string | null) {
  return last4 ? `•••• •••• •••• ${last4}` : '•••• •••• •••• ••••';
}

function formatCardNumber(raw: string) {
  return raw.replace(/(.{4})/g, '$1 ').trim();
}

function networkColor(network: string | null) {
  if (network === 'Visa') return '#1a1f71';
  if (network === 'Mastercard') return '#eb001b';
  if (network === 'Amex') return '#2e77bc';
  if (network === 'RuPay') return '#1c6f3e';
  return 'var(--muted)';
}

const accountSections = [
  { label: 'Bank accounts', types: ['SAVINGS', 'FIXED_DEPOSIT', 'BANK'] },
  { label: 'Credit cards', types: ['CREDIT_CARD'] },
  { label: 'Loan accounts', types: ['LOAN'] },
  { label: 'Investments', types: ['STOCKS', 'INVESTMENT'] },
  { label: 'EPFO accounts', types: ['EPFO'] },
];

// ─── CopyButton ──────────────────────────────────────────────────────────────
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };
  return (
    <button className="vault-copy-btn" onClick={copy} title="Copy to clipboard">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// ─── VaultField ──────────────────────────────────────────────────────────────
function VaultField({
  label, masked, revealed, sensitive = false,
}: {
  label: string;
  masked: string;
  revealed?: string;
  sensitive?: boolean;
}) {
  const [showing, setShowing] = useState(false);
  const display = showing && revealed ? revealed : masked;
  const canReveal = Boolean(revealed);

  return (
    <div className="vault-field">
      <span className="vault-field-label">{label}</span>
      <div className="vault-field-value">
        <code className={showing ? 'revealed' : 'masked'}>{display}</code>
        {canReveal && (
          <button
            className="vault-reveal-btn"
            onClick={() => setShowing(v => !v)}
            title={showing ? 'Hide' : 'Reveal'}
          >
            {showing ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        {showing && revealed && <CopyButton value={revealed} />}
      </div>
    </div>
  );
}

// ─── VaultCard ───────────────────────────────────────────────────────────────
function VaultCard({ account, onSaved, onDeleted }: {
  account: VaultAccount;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isBank = isBankAccount(account.type);
  const isCard = isCardAccount(account.type);
  const hasVault = Boolean(account.vault);

  const [editing, setEditing] = useState(!hasVault);
  const [revealed, setRevealed] = useState<RevealedData | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const formRef = useRef<HTMLFormElement>(null);

  const reveal = useCallback(async () => {
    setRevealing(true);
    try {
      const data = await api<RevealedData>(`/vault/${account.id}/reveal`);
      setRevealed(data);
    } catch (e) {
      setError(errorMessage(e, 'Could not reveal details.'));
    } finally {
      setRevealing(false);
    }
  }, [account.id]);

  const hideRevealed = () => setRevealed(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const body: Record<string, string | number> = {};
    const accountNumber = fd.get('accountNumber') as string;
    const ifsc = fd.get('ifsc') as string;
    const upiId = fd.get('upiId') as string;
    const cardNumber = (fd.get('cardNumber') as string)?.replace(/\s/g, '');
    const cvv = fd.get('cvv') as string;
    const mm = fd.get('cardExpiryMm') as string;
    const yy = fd.get('cardExpiryYy') as string;
    if (accountNumber) body.accountNumber = accountNumber;
    if (ifsc) body.ifsc = ifsc.toUpperCase();
    if (upiId) body.upiId = upiId;
    if (cardNumber) body.cardNumber = cardNumber;
    if (cvv) body.cvv = cvv;
    if (mm) body.cardExpiryMm = parseInt(mm, 10);
    if (yy) body.cardExpiryYy = parseInt(yy, 10);

    setSaving(true); setError('');
    try {
      await api(`/vault/${account.id}`, { method: 'PUT', body: JSON.stringify(body) });
      setEditing(false);
      setRevealed(null);
      onSaved();
    } catch (e) {
      setError(errorMessage(e, 'Could not save vault entry.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async () => {
    setDeleting(true);
    try {
      await api(`/vault/${account.id}`, { method: 'DELETE' });
      setConfirmDelete(false);
      onDeleted();
    } catch (e) {
      setError(errorMessage(e, 'Could not delete vault entry.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="vault-card panel">
      {/* Card header */}
      <header className="vault-card-header">
        <div className="vault-card-title">
          <span className={`account-icon ${account.type.toLowerCase()}`}>{getIcon(account.type)}</span>
          <div>
            <h2>{account.name}</h2>
            {account.institution && <span className="vault-institution">{account.institution}</span>}
          </div>
        </div>
        <div className="vault-card-actions">
          {hasVault && !editing && (
            <>
              <button className="ghost compact" onClick={() => { setEditing(true); setRevealed(null); }}>
                <Pencil size={14} /> Edit
              </button>
              <button className="ghost compact danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} />
              </button>
            </>
          )}
          {editing && hasVault && (
            <button className="ghost compact" onClick={() => { setEditing(false); setError(''); }}>
              <X size={14} /> Cancel
            </button>
          )}
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      {/* Empty state */}
      {!hasVault && !editing && (
        <div className="vault-empty">
          <Lock size={32} strokeWidth={1.5} />
          <strong>No details stored</strong>
          <p>Add your {isCard ? 'card' : 'account'} details to keep them secure and accessible.</p>
          <button className="primary compact" onClick={() => setEditing(true)}>
            <Lock size={14} /> Add details
          </button>
        </div>
      )}

      {/* Edit / add form */}
      {editing && (
        <form className="vault-form" ref={formRef} onSubmit={save}>
          <div className="vault-form-section">
            <span className="vault-form-section-title">
              {isCard ? 'Card details' : 'Account details'}
            </span>

            {isBank && (
              <>
                <label>
                  Account number
                  <input name="accountNumber" type="text" inputMode="numeric"
                    placeholder="e.g. 12345678901"
                    defaultValue=""
                    autoComplete="off" />
                  <small>9–18 digits, no spaces</small>
                </label>
                <label>
                  IFSC code
                  <input name="ifsc" type="text" placeholder="e.g. SBIN0001234"
                    style={{ textTransform: 'uppercase' }} autoComplete="off" />
                </label>
                <label>
                  UPI ID <span className="optional">optional</span>
                  <input name="upiId" type="text" placeholder="e.g. name@upi" autoComplete="off" />
                </label>
              </>
            )}

            {isCard && (
              <>
                <label>
                  Card number
                  <input name="cardNumber" type="text" inputMode="numeric"
                    placeholder="•••• •••• •••• ••••"
                    maxLength={23}
                    autoComplete="off"
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 19);
                      e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
                    }}
                  />
                  <small>Network (Visa / Mastercard / RuPay / Amex) is auto-detected</small>
                </label>
                <div className="vault-form-row">
                  <label>
                    Expiry month
                    <input name="cardExpiryMm" type="number" min={1} max={12} placeholder="MM" />
                  </label>
                  <label>
                    Expiry year
                    <input name="cardExpiryYy" type="number" min={25} max={99} placeholder="YY" />
                  </label>
                  <label>
                    CVV
                    <input name="cvv" type="password" inputMode="numeric"
                      maxLength={4} placeholder="•••" autoComplete="off" />
                  </label>
                </div>
              </>
            )}

            {!isBank && !isCard && (
              <p className="vault-no-sensitive">
                This account type doesn't have sensitive credentials to store. You can use the notes section in the future.
              </p>
            )}
          </div>

          {(isBank || isCard) && (
            <div className="vault-form-actions">
              <button type="submit" className="primary" disabled={saving}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save securely'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Filled / display state */}
      {hasVault && !editing && account.vault && (
        <div className="vault-details">
          {/* Reveal bar */}
          {!revealed ? (
            <div className="vault-reveal-bar">
              <div className="vault-shield">
                <ShieldCheck size={18} />
                <span>Details encrypted at rest</span>
              </div>
              <button className="secondary compact" onClick={reveal} disabled={revealing}>
                <Eye size={14} /> {revealing ? 'Decrypting…' : 'Reveal details'}
              </button>
            </div>
          ) : (
            <div className="vault-reveal-bar revealed-state">
              <div className="vault-shield active">
                <Eye size={18} />
                <span>Details visible — hide when done</span>
              </div>
              <button className="ghost compact" onClick={hideRevealed}>
                <EyeOff size={14} /> Hide all
              </button>
            </div>
          )}

          {/* Fields */}
          <div className="vault-fields-grid">
            {isBank && (
              <>
                <VaultField
                  label="Account number"
                  masked={maskAccountNumber(account.vault.last4)}
                  revealed={revealed?.accountNumber}
                />
                <VaultField
                  label="IFSC"
                  masked={account.vault.ifsc || '—'}
                  revealed={account.vault.ifsc ?? undefined}
                />
                {account.vault.upiId && (
                  <VaultField
                    label="UPI ID"
                    masked={account.vault.upiId}
                    revealed={account.vault.upiId}
                  />
                )}
              </>
            )}

            {isCard && (
              <>
                <VaultField
                  label="Card number"
                  masked={maskCardNumber(account.vault.last4)}
                  revealed={revealed?.cardNumber ? formatCardNumber(revealed.cardNumber) : undefined}
                />
                {account.vault.cardNetwork && (
                  <div className="vault-field">
                    <span className="vault-field-label">Network</span>
                    <div className="vault-field-value">
                      <span className="vault-network-badge"
                        style={{ color: networkColor(account.vault.cardNetwork) }}>
                        {account.vault.cardNetwork}
                      </span>
                    </div>
                  </div>
                )}
                {(account.vault.cardExpiryMm && account.vault.cardExpiryYy) && (
                  <div className="vault-field">
                    <span className="vault-field-label">Expiry</span>
                    <div className="vault-field-value">
                      <code className="revealed">
                        {String(account.vault.cardExpiryMm).padStart(2, '0')} / {String(account.vault.cardExpiryYy)}
                      </code>
                    </div>
                  </div>
                )}
                <VaultField
                  label="CVV"
                  masked="•••"
                  revealed={revealed?.cvv}
                  sensitive
                />
              </>
            )}
          </div>

          <p className="vault-updated">
            Last updated {new Date(account.vault.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="vault-delete-confirm">
          <AlertCircle size={16} />
          <span>Delete all stored details for <strong>{account.name}</strong>?</span>
          <button className="danger compact" onClick={deleteEntry} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button className="ghost compact" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
function VaultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<VaultAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedId = searchParams.get('account');

  const load = useCallback(async () => {
    try {
      const data = await api<VaultAccount[]>('/vault');
      setAccounts(data);
      if (!searchParams.get('account') && data.length > 0) {
        router.replace(`/vault?account=${data[0].id}`);
      }
    } catch (e) {
      if (isUnauthorized(e)) router.replace('/login');
      else setError(errorMessage(e, 'Could not load vault.'));
    } finally {
      setLoading(false);
    }
  }, [router, searchParams]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Shell><div className="loading"><span /><p>Unlocking your vault…</p></div></Shell>;

  const selected = accounts.find(a => a.id === selectedId);

  return (
    <Shell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Security</span>
          <h1>Account Vault</h1>
          <p>Your sensitive account details, encrypted and stored locally.</p>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="vault-layout">
        {/* Sidebar */}
        <aside className="vault-sidebar panel">
          <div className="vault-sidebar-header">
            <Lock size={14} />
            <span>Your accounts</span>
          </div>
          {accountSections.map(section => {
            const sectionAccounts = accounts.filter(a => section.types.includes(a.type));
            if (!sectionAccounts.length) return null;
            return (
              <div className="vault-sidebar-group" key={section.label}>
                <header>{section.label}</header>
                {sectionAccounts.map(account => {
                  const hasVault = Boolean(account.vault);
                  return (
                    <button
                      key={account.id}
                      className={`vault-sidebar-item ${selectedId === account.id ? 'active' : ''}`}
                      onClick={() => router.push(`/vault?account=${account.id}`)}
                    >
                      <span className={`account-icon ${account.type.toLowerCase()}`}>
                        {getIcon(account.type)}
                      </span>
                      <div className="vault-sidebar-item-info">
                        <strong>{account.name}</strong>
                        <small>{account.institution || account.type}</small>
                      </div>
                      <span className={`vault-status-dot ${hasVault ? 'filled' : 'empty'}`}
                        title={hasVault ? 'Details stored' : 'No details yet'} />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </aside>

        {/* Main content */}
        <main className="vault-main">
          {!selected ? (
            <div className="vault-splash">
              <div className="vault-splash-icon">
                <Lock size={40} strokeWidth={1.2} />
              </div>
              <h2>Select an account</h2>
              <p>Choose an account from the sidebar to view or add its encrypted details.</p>
            </div>
          ) : (
            <VaultCard
              key={selected.id}
              account={selected}
              onSaved={load}
              onDeleted={load}
            />
          )}
        </main>
      </div>
    </Shell>
  );
}

export default function VaultPage() {
  return (
    <Suspense fallback={<Shell><div className="loading"><span /><p>Unlocking your vault…</p></div></Shell>}>
      <VaultContent />
    </Suspense>
  );
}
