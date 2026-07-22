'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock, Eye, EyeOff, CreditCard, Landmark, PiggyBank, TrendingUp,
  ChartPieIcon as ChartPie, Building2, BadgeIndianRupee, Pencil,
  Trash2, Save, X, Check, Copy
} from 'lucide-react';
import { api, errorMessage, isUnauthorized } from '@/lib/api';
import { CardScanner, type CardScanResult } from '@/components/card-scanner';

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

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };
  return (
    <button type="button" className="wallet-copy-btn" onClick={copy} title="Copy to clipboard">
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export function VaultModal({ 
  accountId, 
  onClose,
  onChanged,
}: { 
  accountId: string; 
  onClose: () => void;
  onChanged?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [account, setAccount] = useState<VaultAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // WalletCard states
  const [mode, setMode] = useState<'front' | 'edit'>('front');
  const [revealed, setRevealed] = useState<RevealedData | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState('');

  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<VaultAccount>(`/vault/${accountId}`);
      setAccount(data);
    } catch (e) {
      if (isUnauthorized(e)) router.replace('/login');
      else setError(errorMessage(e, 'Could not load vault details.'));
    } finally {
      setLoading(false);
    }
  }, [accountId, router]);

  useEffect(() => { void load(); }, [load]);

  if (loading || !account) {
    return (
      <div className="modal-wrap">
        <button className="backdrop" onClick={onClose} aria-label="Close vault" />
        <div style={{ padding: '24px', background: 'var(--card)', borderRadius: '12px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="loading"><span /><p>Unlocking details…</p></div>
        </div>
      </div>
    );
  }

  const isBank = isBankAccount(account.type);
  const isCard = isCardAccount(account.type);
  const hasVault = Boolean(account.vault);

  const reveal = async () => {
    if (revealed) {
      setRevealed(null);
      setActionError('');
      return;
    }
    setRevealing(true);
    setActionError('');
    try {
      const data = await api<RevealedData>(`/vault/${account.id}/reveal`);
      setRevealed(data);
    } catch (e) {
      setActionError(errorMessage(e, 'Could not decrypt details.'));
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

    setSaving(true); setActionError('');
    try {
      await api(`/vault/${account.id}`, { method: 'PUT', body: JSON.stringify(body) });
      setRevealed(null);
      setMode('front');
      await load();
      await onChanged?.();
    } catch (e) {
      setActionError(errorMessage(e, 'Could not save vault entry.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async () => {
    setDeleting(true);
    try {
      await api(`/vault/${account.id}`, { method: 'DELETE' });
      setConfirmDelete(false);
      setRevealed(null);
      setMode('front');
      await load();
      await onChanged?.();
    } catch (e) {
      setActionError(errorMessage(e, 'Could not delete vault entry.'));
    } finally {
      setDeleting(false);
    }
  };

  const cssClass = `wallet-card-face wallet-card-front ${isCard ? 'type-card' : 'type-bank'} network-${account.vault?.cardNetwork?.toLowerCase() || 'default'}`;

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
            <span>{revealed?.cardNumber ? formatCardNumber(revealed.cardNumber) : maskCardNumber(account.vault?.last4 || null)}</span>
            {revealed?.cardNumber && <CopyButton value={revealed.cardNumber} />}
          </div>
        )}
        {isBank && hasVault && (
          <div className="wallet-card-number">
            <span>{revealed?.accountNumber || maskAccountNumber(account.vault?.last4 || null)}</span>
            {revealed?.accountNumber && <CopyButton value={revealed.accountNumber} />}
          </div>
        )}
        {!hasVault && (
          <div className="wallet-card-empty-prompt">
            <Lock size={16} /> No details stored
          </div>
        )}
        {actionError && <div className="wallet-front-error" role="alert">{actionError}</div>}
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
        {isCard && revealed?.cvv && (
          <div className="wallet-card-meta">
            <small>CVV</small>
            <span className="wallet-card-cvv">{revealed.cvv}<CopyButton value={revealed.cvv} /></span>
          </div>
        )}

        <div className="wallet-card-actions">
          {hasVault && (
            <button type="button" className="wallet-btn-icon" onClick={() => reveal()} title={revealed ? 'Hide details' : 'Reveal details'} disabled={revealing}>
              {revealing ? <span className="wallet-spinner"/> : revealed ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          <button type="button" className="wallet-btn-icon" onClick={() => { setRevealed(null); setMode('edit'); }} title="Edit details">
            <Pencil size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderEdit = () => (
    <div className="wallet-card-face wallet-card-back">
      <div className="wallet-card-back-header">
        <strong>{hasVault ? 'Edit Details' : 'Add Details'}</strong>
        <button type="button" className="wallet-btn-icon" onClick={() => setMode('front')}><X size={16} /></button>
      </div>

      {actionError && <div className="wallet-error">{actionError}</div>}

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
            <CardScanner onResult={(r: CardScanResult) => {
              const form = formRef.current;
              if (!form) return;
              if (r.cardNumber) {
                const inp = form.elements.namedItem('cardNumber') as HTMLInputElement;
                if (inp) inp.value = r.cardNumber.replace(/(.{4})/g, '$1 ').trim();
              }
              if (r.expiryMm) {
                const inp = form.elements.namedItem('cardExpiryMm') as HTMLInputElement;
                if (inp) inp.value = String(r.expiryMm);
              }
              if (r.expiryYy) {
                const inp = form.elements.namedItem('cardExpiryYy') as HTMLInputElement;
                if (inp) inp.value = String(r.expiryYy);
              }
              if (r.cvv) {
                const inp = form.elements.namedItem('cvv') as HTMLInputElement;
                if (inp) inp.value = r.cvv;
              }
            }} />
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

  return (
    <div className="modal-wrap">
      <button className="backdrop" onClick={onClose} aria-label="Close vault modal" />
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '380px', margin: '0 auto' }}>
        {error && <p className="error" style={{ marginBottom: '16px' }}>{error}</p>}
        <div className={`wallet-card-container ${mode !== 'front' ? 'flipped' : ''} ${mode === 'edit' ? 'edit-mode' : ''}`}>
          <div className="wallet-card-inner">
            {mode === 'front' && renderFront()}
            {mode === 'edit' && renderEdit()}
          </div>
        </div>
      </div>
    </div>
  );
}
