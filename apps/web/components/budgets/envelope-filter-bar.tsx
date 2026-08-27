'use client';

import { Search, X } from 'lucide-react';

export type EnvelopeStatusFilter = 'ALL' | 'EXCEEDED' | 'WARNING' | 'OK' | 'NO_LIMIT';

export interface EnvelopeFilterBarProps {
  statusFilter: EnvelopeStatusFilter;
  onStatusFilterChange: (filter: EnvelopeStatusFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  counts: {
    all: number;
    exceeded: number;
    warning: number;
    ok: number;
    noLimit: number;
  };
}

export function EnvelopeFilterBar({
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  counts,
}: EnvelopeFilterBarProps) {
  const filterOptions: Array<{ id: EnvelopeStatusFilter; label: string; count: number; color?: string }> = [
    { id: 'ALL', label: 'All Categories', count: counts.all },
    { id: 'EXCEEDED', label: 'Over Budget', count: counts.exceeded, color: '#ef4444' },
    { id: 'WARNING', label: 'Near Limit', count: counts.warning, color: '#f59e0b' },
    { id: 'OK', label: 'On Track', count: counts.ok, color: 'var(--green)' },
    { id: 'NO_LIMIT', label: 'No Target', count: counts.noLimit },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        margin: '12px 0 16px 0',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {filterOptions.map((opt) => {
          const isActive = statusFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onStatusFilterChange(opt.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                border: isActive
                  ? '1px solid var(--green)'
                  : '1px solid var(--line)',
                background: isActive
                  ? 'rgba(29, 117, 79, 0.12)'
                  : 'var(--card)',
                color: isActive ? 'var(--green)' : 'var(--muted)',
                transition: 'all 0.15s ease',
              }}>
              <span>{opt.label}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isActive ? 'var(--theme-soft-end)' : 'var(--background-alt)',
                  color: isActive ? 'var(--green)' : 'var(--muted)',
                  fontWeight: 700,
                }}>
                {opt.count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          minWidth: '220px',
        }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '10px',
            color: 'var(--muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder="Filter categories..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 28px 6px 30px',
            fontSize: '12px',
            borderRadius: '18px',
            border: '1px solid var(--line)',
            background: 'var(--card)',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchQueryChange('')}
            style={{
              position: 'absolute',
              right: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              display: 'grid',
              placeItems: 'center',
            }}>
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
