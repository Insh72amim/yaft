'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import {
  Lock, Eye, EyeOff, CreditCard, Landmark, PiggyBank, TrendingUp,
  ChartPieIcon as ChartPie, Building2, BadgeIndianRupee, Pencil,
  Trash2, Save, X, ShieldCheck, AlertCircle, Check, Copy, Settings2, Shield
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
  if (type === 'CREDIT_CARD') return <CreditCard size={18} />;
  if (type === 'INVESTMENT') return <ChartPie size={18} />;
  if (type === 'STOCKS') return <TrendingUp size={18} />;
  if (type === 'EPFO') return <Building2 size={18} />;
  if (type === 'LOAN') return <BadgeIndianRupee size={18} />;
  if (type === 'SAVINGS') return <PiggyBank size={18} />;
  return <Landmark size={18} />;
}

function maskAccountNumber(last4: string | null) {
  return last4 ? `•••• •••• ${last4}` : '••••••••••••';
}

function maskCardNumber(last4: string | null) {
  return last4 ? `••••  ••••  ••••  ${last4}` : '••••  ••••  ••••  ••••';
}

function formatCardNumber(raw: string) {
  return raw.replace(/(.{4})/g, '$1 ').trim();
}

// ─── CopyButton ──────────────────────────────────────────────────────────────
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };
  return (
    <button className="wallet-copy-btn" onClick={copy} title="Copy to clipboard">
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// ─── WalletCard Component ────────────────────────────────────────────────────
function WalletCard({ account, onSaved, onDeleted }: {
  account: VaultAccount;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isBank = isBankAccount(account.type);
  const isCard = isCardAccount(account.type);
  const hasVault = Boolean(account.vault);

  // States: 'front' | 'edit' | 'reveal'
  const [mode, setMode] = useState<'front' | 'edit' | 'reveal'>('front');

  const [revealed, setRevealed] = useState<RevealedData | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const formRef = useRef<HTMLFormElement>(null);

  const reveal = async () => {
    setRevealing(true);
    setError('');
    try {
      const data = await api<RevealedData>(`/vault/${account.id}/reveal`);
      setRevealed(data);
      setMode('reveal');
    } catch (e) {
      setError(errorMessage(e, 'Could not decrypt details.'));
    } finally {
      setRevealing(false);
    }
  };

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
      setMode('front');
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
      setMode('front');
      onDeleted();
    } catch (e) {
      setError(errorMessage(e, 'Could not delete vault entry.'));
    } finally {
      setDeleting(false);
    }
  };

  const cssClass = `wallet-card-face wallet-card-front ${isCard ? 'type-card' : 'type-bank'} network-${account.vault?.cardNetwork?.toLowerCase() || 'default'}`;

  // Renders the realistic "Front" of the card
  const renderFront = () => (
    <div className={cssClass}>
      <div className="wallet-card-header">
        <div className="wallet-card-title">
          {getIcon(account.type)}
          <span>{account.name}</span>
        </div>
        {isCard && <div className="wallet-card-network">{account.vault?.cardNetwork || 'Credit Card'}</div>}
        {!isCard && <div className="wallet-card-institution">{account.institution || account.type.replace('_', ' ')}</div>}
      </div>

      <div className="wallet-card-middle">
        {isCard && <div className="wallet-card-chip"></div>}
        {isCard && hasVault && (
          <div className="wallet-card-number">
            {maskCardNumber(account.vault?.last4 || null)}
          </div>
        )}
        {isBank && hasVault && (
          <div className="wallet-card-number">
            {maskAccountNumber(account.vault?.last4 || null)}
          </div>
        )}
        {!hasVault && (
          <div className="wallet-card-empty-prompt">
            <Lock size={16} /> No details stored
          </div>
        )}
      </div>

      <div className="wallet-card-footer">
        {isCard && hasVault && account.vault?.cardExpiryMm && account.vault?.cardExpiryYy && (
          <div className="wallet-card-meta">
            <small>VALID THRU</small>
            <span>{String(account.vault.cardExpiryMm).padStart(2, '0')}/{String(account.vault.cardExpiryYy)}</span>
          </div>
        )}
        {isBank && hasVault && account.vault?.ifsc && (
          <div className="wallet-card-meta">
            <small>IFSC</small>
            <span>{account.vault.ifsc}</span>
          </div>
        )}

        <div className="wallet-card-actions">
          {hasVault && (
            <button className="wallet-btn-icon" onClick={() => reveal()} title="Reveal details" disabled={revealing}>
              {revealing ? <span className="wallet-spinner"/> : <Eye size={15} />}
            </button>
          )}
          <button className="wallet-btn-icon" onClick={() => setMode('edit')} title="Edit details">
            <Pencil size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  // Renders the Edit form "Back" of the card
  const renderEdit = () => (
    <div className="wallet-card-face wallet-card-back">
      <div className="wallet-card-back-header">
        <strong>{hasVault ? 'Edit Details' : 'Add Details'}</strong>
        <button className="wallet-btn-icon" onClick={() => setMode('front')}><X size={16} /></button>
      </div>

      {error && <div className="wallet-error">{error}</div>}

      <form className="wallet-form" ref={formRef} onSubmit={save}>
        {isBank && (
          <>
            <label>
              Account Number
              <input name="accountNumber" type="text" inputMode="numeric" placeholder="e.g. 12345678901" autoComplete="off" />
            </label>
            <div className="wallet-form-row">
              <label>
                IFSC Code
                <input name="ifsc" type="text" placeholder="e.g. SBIN0001234" style={{ textTransform: 'uppercase' }} autoComplete="off" />
              </label>
              <label>
                UPI ID (Optional)
                <input name="upiId" type="text" placeholder="name@upi" autoComplete="off" />
              </label>
            </div>
          </>
        )}

        {isCard && (
          <>
            <label>
              Card Number
              <input name="cardNumber" type="text" inputMode="numeric" placeholder="•••• •••• •••• ••••" maxLength={23} autoComplete="off"
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 19);
                  e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
                }}
              />
            </label>
            <div className="wallet-form-row">
              <label>
                Expiry MM
                <input name="cardExpiryMm" type="number" min={1} max={12} placeholder="MM" />
              </label>
              <label>
                Expiry YY
                <input name="cardExpiryYy" type="number" min={25} max={99} placeholder="YY" />
              </label>
              <label>
                CVV
                <input name="cvv" type="password" inputMode="numeric" maxLength={4} placeholder="•••" autoComplete="off" />
              </label>
            </div>
          </>
        )}

        {!isBank && !isCard && (
          <p className="wallet-no-sensitive">This account type doesn't have sensitive credentials to store here.</p>
        )}

        <div className="wallet-form-actions">
          {hasVault && !confirmDelete && (
            <button type="button" className="wallet-btn danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={13}/> Delete
            </button>
          )}
          {confirmDelete && (
            <button type="button" className="wallet-btn danger-solid" onClick={deleteEntry} disabled={deleting}>
              {deleting ? '...' : 'Confirm'}
            </button>
          )}
          <div className="spacer" />
          <button type="submit" className="wallet-btn primary" disabled={saving}>
            <Save size={13}/> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );

  // Renders the Revealed "Back" of the card
  const renderReveal = () => (
    <div className="wallet-card-face wallet-card-reveal">
      <div className="wallet-card-back-header">
        <div className="wallet-shield">
          <ShieldCheck size={16} /> <strong>Decrypted Details</strong>
        </div>
        <button className="wallet-btn-icon" onClick={() => setMode('front')}><EyeOff size={16} /></button>
      </div>

      <div className="wallet-reveal-fields">
        {isBank && (
          <>
            <div className="wallet-reveal-field">
              <span>Account Number</span>
              <div>
                <code>{revealed?.accountNumber || maskAccountNumber(account.vault?.last4 || null)}</code>
                {revealed?.accountNumber && <CopyButton value={revealed.accountNumber} />}
              </div>
            </div>
            {account.vault?.ifsc && (
              <div className="wallet-reveal-field">
                <span>IFSC</span>
                <div>
                  <code>{account.vault.ifsc}</code>
                  <CopyButton value={account.vault.ifsc} />
                </div>
              </div>
            )}
            {account.vault?.upiId && (
              <div className="wallet-reveal-field">
                <span>UPI ID</span>
                <div>
                  <code>{account.vault.upiId}</code>
                  <CopyButton value={account.vault.upiId} />
                </div>
              </div>
            )}
          </>
        )}

        {isCard && (
          <>
            <div className="wallet-reveal-field">
              <span>Card Number</span>
              <div>
                <code>{revealed?.cardNumber ? formatCardNumber(revealed.cardNumber) : maskCardNumber(account.vault?.last4 || null)}</code>
                {revealed?.cardNumber && <CopyButton value={revealed.cardNumber} />}
              </div>
            </div>
            <div className="wallet-form-row">
              <div className="wallet-reveal-field">
                <span>Expiry</span>
                <div><code>{String(account.vault?.cardExpiryMm).padStart(2, '0')}/{account.vault?.cardExpiryYy}</code></div>
              </div>
              <div className="wallet-reveal-field">
                <span>CVV</span>
                <div>
                  <code>{revealed?.cvv || '•••'}</code>
                  {revealed?.cvv && <CopyButton value={revealed.cvv} />}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="wallet-reveal-footer">
        <button className="wallet-btn ghost" onClick={() => setMode('front')}>Hide Details</button>
      </div>
    </div>
  );

  return (
    <div className={`wallet-card-container ${mode !== 'front' ? 'flipped' : ''}`}>
      <div className="wallet-card-inner">
        {mode === 'front' && renderFront()}
        {mode === 'edit' && renderEdit()}
        {mode === 'reveal' && renderReveal()}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
function VaultContent() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<VaultAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api<VaultAccount[]>('/vault');
      setAccounts(data);
    } catch (e) {
      if (isUnauthorized(e)) router.replace('/login');
      else setError(errorMessage(e, 'Could not load vault.'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Shell><div className="loading"><span /><p>Unlocking your vault…</p></div></Shell>;

  const bankAccounts = accounts.filter(a => isBankAccount(a.type) || a.type === 'EPFO' || a.type === 'LOAN');
  const creditCards = accounts.filter(a => isCardAccount(a.type));
  const investments = accounts.filter(a => a.type === 'STOCKS' || a.type === 'INVESTMENT');

  return (
    <Shell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Security</span>
          <h1>Account Vault</h1>
          <p>Your sensitive account details, encrypted and stored locally on your device.</p>
        </div>
        <div className="vault-global-badge">
          <Shield size={16} /> <span>AES-256-GCM Encrypted</span>
        </div>
      </header>

      {error && <p className="error" role="alert" style={{ marginBottom: '24px' }}>{error}</p>}

      <div className="vault-sections">
        {creditCards.length > 0 && (
          <section className="vault-section">
            <h2 className="vault-section-title">Credit Cards</h2>
            <div className="vault-grid">
              {creditCards.map(acc => <WalletCard key={acc.id} account={acc} onSaved={load} onDeleted={load} />)}
            </div>
          </section>
        )}

        {bankAccounts.length > 0 && (
          <section className="vault-section">
            <h2 className="vault-section-title">Bank & Loan Accounts</h2>
            <div className="vault-grid">
              {bankAccounts.map(acc => <WalletCard key={acc.id} account={acc} onSaved={load} onDeleted={load} />)}
            </div>
          </section>
        )}

        {investments.length > 0 && (
          <section className="vault-section">
            <h2 className="vault-section-title">Investments</h2>
            <div className="vault-grid">
              {investments.map(acc => <WalletCard key={acc.id} account={acc} onSaved={load} onDeleted={load} />)}
            </div>
          </section>
        )}

        {accounts.length === 0 && !loading && (
          <div className="empty">
            <span>📭</span>
            <p>You haven't added any accounts yet. Go to Accounts to add one first.</p>
          </div>
        )}
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
