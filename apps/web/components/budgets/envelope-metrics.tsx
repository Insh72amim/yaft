'use client';

import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Layers } from 'lucide-react';
import { money } from '@/lib/api';
import { BudgetSummary } from '@yaft/shared';

export interface EnvelopeMetricsProps {
  summary: BudgetSummary;
  monthLabel: string;
}

export function EnvelopeMetrics({ summary, monthLabel }: EnvelopeMetricsProps) {
  const totalBudgeted = summary.totalBudgeted || 0;
  const totalSpent = summary.totalSpent || 0;
  const totalRemaining = summary.totalRemaining || 0;
  const overallPercentage = summary.overallPercentage || 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          padding: '16px 20px',
          borderRadius: '14px',
        }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
          <Layers size={13} color="var(--green)" /> Total Monthly Budget
        </span>
        <strong
          style={{
            display: 'block',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: 'var(--ink)',
            marginTop: '6px',
          }}>
          {money(totalBudgeted * 100)}
        </strong>
        <small
          style={{
            color: 'var(--muted)',
            fontSize: '11px',
            marginTop: '4px',
            display: 'block',
          }}>
          Target ceiling across all envelopes
        </small>
      </div>

      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          padding: '16px 20px',
          borderRadius: '14px',
        }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#3b82f6',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
          <ArrowUpRight size={13} color="#ef4444" /> Total Expenses Spent
        </span>
        <strong
          style={{
            display: 'block',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: '#ef4444',
            marginTop: '6px',
          }}>
          {money(totalSpent * 100)}
        </strong>
        <small
          style={{
            color: 'var(--muted)',
            fontSize: '11px',
            marginTop: '4px',
            display: 'block',
          }}>
          Actual debits minus refunds for {monthLabel}
        </small>
      </div>

      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          padding: '16px 20px',
          borderRadius: '14px',
        }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: totalRemaining > 0 ? 'var(--green)' : '#ef4444',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
          <ArrowDownLeft size={13} color="var(--green)" /> Total Remaining In Budget
        </span>
        <strong
          style={{
            display: 'block',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: totalRemaining > 0 ? 'var(--green)' : '#ef4444',
            marginTop: '6px',
          }}>
          {money(totalRemaining * 100)}
        </strong>
        <small
          style={{
            color: 'var(--muted)',
            fontSize: '11px',
            marginTop: '4px',
            display: 'block',
          }}>
          Remaining allowance for {monthLabel}
        </small>
      </div>

      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          padding: '16px 20px',
          borderRadius: '14px',
        }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color:
              overallPercentage > 100
                ? '#ef4444'
                : overallPercentage > 85
                ? '#f59e0b'
                : 'var(--green)',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
          <CheckCircle2 size={13} /> Budget Utilization
        </span>
        <strong
          style={{
            display: 'block',
            fontSize: '1.6rem',
            fontWeight: 800,
            color:
              overallPercentage > 100
                ? '#ef4444'
                : overallPercentage > 85
                ? '#f59e0b'
                : 'var(--green)',
            marginTop: '6px',
          }}>
          {overallPercentage}%
        </strong>
        <small
          style={{
            color: 'var(--muted)',
            fontSize: '11px',
            marginTop: '4px',
            display: 'block',
          }}>
          {overallPercentage > 100
            ? 'Budget ceiling exceeded'
            : overallPercentage > 85
            ? 'Approaching envelope ceiling'
            : 'Spending comfortably within targets'}
        </small>
      </div>
    </div>
  );
}
