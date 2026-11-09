'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash, TrendingUp } from 'lucide-react';
import { api, errorMessage, money } from '@/lib/api';
import { SipModal, type Sip } from '@/components/sip-modal';

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
