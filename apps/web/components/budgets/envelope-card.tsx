'use client';

import { Edit3, Trash2 } from 'lucide-react';
import { money } from '@/lib/api';
import { CategoryBudgetItem } from '@yaft/shared';

export interface EnvelopeCardProps {
  category: CategoryBudgetItem;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}

export function EnvelopeCard({
  category,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  isDeleting,
}: EnvelopeCardProps) {
  const percentage = category.percentage || 0;
  const isOverBudget = category.status === 'EXCEEDED';
  const isNearLimit = category.status === 'WARNING';
  const hasBudget = category.hasBudget && category.monthlyLimit > 0;

  const barColor = isOverBudget
    ? '#ef4444'
    : isNearLimit
    ? '#f59e0b'
    : 'var(--green)';

  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--card)',
        border: isSelected
          ? '2px solid var(--green)'
          : '1px solid var(--line)',
        borderRadius: '16px',
        padding: '18px 20px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isSelected
          ? '0 8px 24px rgba(29, 117, 79, 0.12)'
          : '0 2px 6px rgba(0, 0, 0, 0.02)',
      }}>
      {/* Header: Category Color Pill + Title + Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: category.categoryColor || 'var(--green)',
              flexShrink: 0,
            }}
          />
          <h3
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={category.categoryName}>
            {category.categoryName}
          </h3>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={(e) => e.stopPropagation()}>
          {hasBudget && (
            <button
              type="button"
              onClick={onEdit}
              title="Edit Limit"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'grid',
                placeItems: 'center',
              }}>
              <Edit3 size={13} />
            </button>
          )}
          {hasBudget && (
            <button
              type="button"
              onClick={onDelete}
              title="Remove Limit"
              disabled={isDeleting}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'grid',
                placeItems: 'center',
                opacity: isDeleting ? 0.5 : 1,
              }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Main Figures: Spent vs Target */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: isOverBudget ? '#ef4444' : 'var(--ink)',
              letterSpacing: '-0.02em',
            }}>
            {money(category.spentAmount * 100)}
          </span>
          {hasBudget && (
            <span
              style={{
                fontSize: '12px',
                color: 'var(--muted)',
                marginLeft: '6px',
                fontWeight: 600,
              }}>
              / {money(category.monthlyLimit * 100)}
            </span>
          )}
        </div>

        {hasBudget ? (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: barColor,
            }}>
            {percentage}%
          </span>
        ) : (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--muted)',
              background: 'var(--background-alt)',
              padding: '2px 8px',
              borderRadius: '10px',
            }}>
            No limit
          </span>
        )}
      </div>

      {/* 4px Slim Progress Bar */}
      {hasBudget && (
        <div
          style={{
            height: '4px',
            width: '100%',
            backgroundColor: 'var(--background-alt)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, percentage)}%`,
              backgroundColor: barColor,
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Footer: Tx count & remaining */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--muted)',
          marginTop: 'auto',
        }}>
        <span>{category.transactionCount} {category.transactionCount === 1 ? 'transaction' : 'transactions'}</span>
        {hasBudget && (
          <span style={{ fontWeight: 600, color: isOverBudget ? '#ef4444' : 'var(--muted)' }}>
            {isOverBudget
              ? `Exceeded by ${money(Math.abs(category.monthlyLimit - category.spentAmount) * 100)}`
              : `${money((category.monthlyLimit - category.spentAmount) * 100)} left`}
          </span>
        )}
      </div>
    </div>
  );
}
