'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ShieldAlert } from 'lucide-react';
import { api, errorMessage, money } from '@/lib/api';

type TimelineMonthItem = {
  month: string;
  monthKey: string;
  inbound: number;
  internalTransfer: number;
  outbound: number;
  totalCount: number;
  status: string;
};

export function AccountTimelineAudit({ accountId }: { accountId: string }) {
  const [timeline, setTimeline] = useState<TimelineMonthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api<{ timeline: TimelineMonthItem[] }>(`/accounts/${accountId}/timeline`)
      .then((res) => {
        setTimeline(res.timeline || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(errorMessage(err, 'Could not load account monthly timeline.'));
        setLoading(false);
      });
  }, [accountId]);

  if (loading) {
    return (
      <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
        <CalendarDays size={28} style={{ margin: '0 auto 12px auto', display: 'block', color: 'var(--green)' }} />
        <span>Loading 1-Year Monthly Transaction Audit Timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel" style={{ padding: '32px', textAlign: 'center', color: '#ef4444' }}>
        <ShieldAlert size={28} style={{ margin: '0 auto 12px auto', display: 'block' }} />
        <span>{error}</span>
      </div>
    );
  }

  const totalInbound12M = timeline.reduce((sum, item) => sum + item.inbound, 0);
  const totalOutbound12M = timeline.reduce((sum, item) => sum + item.outbound, 0);
  const totalTransfers12M = timeline.reduce((sum, item) => sum + item.internalTransfer, 0);
  const totalUploadedMonths = timeline.filter((item) => item.totalCount > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '16px 20px', borderRadius: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase' }}>12-Month Total Inbound</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: 'var(--green)', marginTop: '4px' }}>+{money(totalInbound12M)}</strong>
          <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Credits &amp; Deposits</small>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '16px 20px', borderRadius: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase' }}>12-Month Internal Transfers</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>{money(totalTransfers12M)}</strong>
          <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Between owned accounts</small>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '16px 20px', borderRadius: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>12-Month Total Outbound</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>-{money(totalOutbound12M)}</strong>
          <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Debits &amp; Spends</small>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '16px 20px', borderRadius: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Uploaded Months Coverage</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>{totalUploadedMonths} / 12 Months</strong>
          <small style={{ color: 'var(--muted)', fontSize: '11px' }}>With verified transactions</small>
        </div>
      </div>

      <section className="panel" style={{ padding: '24px' }}>
        <div className="panel-title" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="eyebrow" style={{ color: 'var(--green)' }}>Statement Verification Audit</span>
            <h2>12-Month Transaction Upload Timeline</h2>
          </div>
          <span className="month-pill" style={{ fontSize: '12px' }}>Last 12 Months</span>
        </div>

        <div className="holdings-scroll">
          <table className="holdings-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Inbound (Credits)</th>
                <th>Internal Transfers</th>
                <th>Outbound (Debits)</th>
                <th>Txn Count</th>
                <th>Statement Upload Status</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row) => {
                const isUploaded = row.totalCount > 0;
                return (
                  <tr key={row.monthKey}>
                    <td>
                      <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>{row.month}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: row.inbound > 0 ? 'var(--green)' : 'var(--muted)' }}>
                        {row.inbound > 0 ? `+${money(row.inbound)}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: row.internalTransfer > 0 ? '#a855f7' : 'var(--muted)' }}>
                        {row.internalTransfer > 0 ? money(row.internalTransfer) : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: row.outbound > 0 ? '#ef4444' : 'var(--muted)' }}>
                        {row.outbound > 0 ? `-${money(row.outbound)}` : '—'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '13px' }}>{row.totalCount}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          background: isUploaded ? 'rgba(16, 185, 129, 0.15)' : 'var(--background-alt)',
                          color: isUploaded ? 'var(--green)' : 'var(--muted)',
                          border: `1px solid ${isUploaded ? 'rgba(16, 185, 129, 0.3)' : 'var(--line)'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {isUploaded ? '🟢 Uploaded & Verified' : '⚪ No Upload / No Activity'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
