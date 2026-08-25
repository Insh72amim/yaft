'use client';

import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export interface MonthNavigationBarProps {
  monthLabel: string;
  isCurrentMonth: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onResetToCurrentMonth: () => void;
  extraRightContent?: React.ReactNode;
}

export function MonthNavigationBar({
  monthLabel,
  isCurrentMonth,
  onPrevMonth,
  onNextMonth,
  onResetToCurrentMonth,
  extraRightContent,
}: MonthNavigationBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        padding: '12px 20px',
        borderRadius: '14px',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="icon-button"
            onClick={onPrevMonth}
            title="Previous Month"
            style={{
              background: 'var(--background-alt)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--ink)',
            }}>
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onNextMonth}
            title="Next Month"
            style={{
              background: 'var(--background-alt)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--ink)',
            }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} style={{ color: 'var(--green)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
            {monthLabel}
          </h2>
          {isCurrentMonth ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--green)',
                background: 'rgba(29, 117, 79, 0.1)',
                padding: '2px 8px',
                borderRadius: '12px',
              }}>
              Current Month
            </span>
          ) : (
            <button
              type="button"
              className="secondary compact"
              onClick={onResetToCurrentMonth}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}>
              <RefreshCw size={11} /> Reset to Today
            </button>
          )}
        </div>
      </div>

      {extraRightContent && <div>{extraRightContent}</div>}
    </div>
  );
}
