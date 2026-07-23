'use client';
import { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';

export type Sip = {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  folioNumber: string | null;
  amount: number;
  frequency: string;
  sipDay: number;
  sourceAccountId: string | null;
  sourceAccountName: string | null;
  sourceAccountLast4: string | null;
  billerKeyword: string | null;
  status: string;
};

type SipModalProps = {
  accountId: string;
  sip?: Sip | null;
  onClose: () => void;
  onSaved: () => void;
};

export function SipModal({ accountId, sip, onClose, onSaved }: SipModalProps) {
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; institution: string | null }[]>([]);
  const [name, setName] = useState(sip?.name ?? '');
  const [folioNumber, setFolioNumber] = useState(sip?.folioNumber ?? '');
  const [amount, setAmount] = useState(sip ? String(sip.amount) : '');
  const [frequency, setFrequency] = useState(sip?.frequency ?? 'MONTHLY');
  const [sipDay, setSipDay] = useState(sip ? String(sip.sipDay) : '10');
  const [sourceAccountId, setSourceAccountId] = useState(sip?.sourceAccountId ?? '');
  const [billerKeyword, setBillerKeyword] = useState(sip?.billerKeyword ?? '');
  const [status, setStatus] = useState(sip?.status ?? 'ACTIVE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ id: string; name: string; type: string; institution: string | null }[]>('/accounts')
      .then((res) => {
        const banks = (res || []).filter((a) => a.type === 'SAVINGS' || a.type === 'BANK');
        setBankAccounts(banks);
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Mutual fund / SIP name is required.');
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return setError('Please enter a valid monthly amount.');

    setSaving(true);
    setError('');

    try {
      if (sip) {
        await api(`/investments/sips/${sip.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            folioNumber,
            amount: parsedAmount,
            frequency,
            sipDay: parseInt(sipDay, 10) || 10,
            sourceAccountId: sourceAccountId || null,
            billerKeyword,
            status,
          }),
        });
      } else {
        await api('/investments/sips', {
          method: 'POST',
          body: JSON.stringify({
            accountId,
            name,
            folioNumber,
            amount: parsedAmount,
            frequency,
            sipDay: parseInt(sipDay, 10) || 10,
            sourceAccountId: sourceAccountId || null,
            billerKeyword,
            status,
          }),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save active SIP.'));
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-card" style={{ background: 'var(--background)', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '100%', border: '1px solid var(--line)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{sip ? 'Edit Active SIP' : 'Add Active SIP'}</h3>
          </div>
          <button type="button" className="ghost compact" onClick={onClose} style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="alert error" style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', color: '#ef4444', background: '#fee2e2' }}>{error}</div>}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Mutual Fund / Scheme Name *</label>
            <input
              type="text"
              placeholder="e.g. Parag Parikh Flexi Cap Fund"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', height: '36px', padding: '0 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Monthly Amount (₹) *</label>
              <input
                type="number"
                placeholder="5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                style={{ width: '100%', height: '36px', padding: '0 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Debit Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="10"
                value={sipDay}
                onChange={(e) => setSipDay(e.target.value)}
                style={{ width: '100%', height: '36px', padding: '0 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Payment Source Account (Bank)</label>
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              style={{ width: '100%', height: '36px', padding: '0 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
            >
              <option value="">Select linked bank account...</option>
              {bankAccounts.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name} {bank.institution ? `(${bank.institution})` : ''}
                </option>
              ))}
            </select>
            <small style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>Account from which payment will be debited for this SIP</small>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Folio Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 91029381/22"
                value={folioNumber}
                onChange={(e) => setFolioNumber(e.target.value)}
                style={{ width: '100%', height: '36px', padding: '0 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Statement Keyword / Biller</label>
              <input
                type="text"
                placeholder="e.g. BSE MEMBERS, ZERODHA"
                value={billerKeyword}
                onChange={(e) => setBillerKeyword(e.target.value)}
                style={{ width: '100%', height: '36px', padding: '0 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="submit" className="primary" disabled={saving} style={{ flex: 1, height: '38px' }}>
              {saving ? 'Saving...' : sip ? 'Update SIP' : 'Add Active SIP'}
            </button>
            <button type="button" className="secondary" onClick={onClose} style={{ height: '38px' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
