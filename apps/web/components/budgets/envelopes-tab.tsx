'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  X,
  Check,
  Edit2,
  Trash2,
  Plus,
  Loader2,
} from 'lucide-react';
import { api, errorMessage, money } from '@/lib/api';
import { CategoryBudgetItem, CategoryOption, SuperCategoryOption, BudgetSummary } from '@yaft/shared';
import { MonthNavigationBar } from './month-navigation-bar';
import { EnvelopeMetrics } from './envelope-metrics';

export type { CategoryBudgetItem, CategoryOption, SuperCategoryOption, BudgetSummary };

interface EnvelopesTabProps {
  categories: CategoryOption[];
  budgets: CategoryBudgetItem[];
  summary: BudgetSummary;
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
  onReload: () => void;
}

export function EnvelopesTab({
  categories,
  budgets,
  summary,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onReload,
}: EnvelopesTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HAS_TARGET' | 'NO_TARGET' | 'OVER_BUDGET'>('ALL');

  // Inline editing state for quick limit updates directly in table row
  const [inlineEditingCatId, setInlineEditingCatId] = useState<string | null>(null);
  const [inlineLimitValue, setInlineLimitValue] = useState<string>('');
  const [savingInlineCatId, setSavingInlineCatId] = useState<string | null>(null);
  const [deletingCatBudgetId, setDeletingCatBudgetId] = useState<string | null>(null);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      onMonthChange(12, selectedYear - 1);
    } else {
      onMonthChange(selectedMonth - 1, selectedYear);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      onMonthChange(1, selectedYear + 1);
    } else {
      onMonthChange(selectedMonth + 1, selectedYear);
    }
  };

  const currentNow = useMemo(() => new Date(), []);
  const isCurrentMonth =
    selectedMonth === currentNow.getMonth() + 1 &&
    selectedYear === currentNow.getFullYear();

  const handleResetToCurrentMonth = () => {
    onMonthChange(currentNow.getMonth() + 1, currentNow.getFullYear());
  };

  const monthLabel = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth - 1, 1);
    return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }, [selectedMonth, selectedYear]);

  // Strictly ONLY Expense categories
  const expenseCategories = useMemo(
    () => (categories || []).filter((c) => (c?.type || 'EXPENSE') === 'EXPENSE'),
    [categories],
  );

  // Status counts for expense categories
  const counts = useMemo(() => {
    let withTarget = 0;
    let noTarget = 0;
    let overBudget = 0;

    for (const cat of expenseCategories) {
      const b = (budgets || []).find((item) => item?.categoryId === cat.id);
      if (b && b.hasBudget && b.monthlyLimit > 0) {
        withTarget++;
        if (b.status === 'EXCEEDED') {
          overBudget++;
        }
      } else {
        noTarget++;
      }
    }
    return { total: expenseCategories.length, withTarget, noTarget, overBudget };
  }, [expenseCategories, budgets]);

  // Filtered expense categories based on search and status
  const filteredExpenseCategories = useMemo(() => {
    return expenseCategories
      .filter((cat) => {
        if (!cat) return false;
        const matchesSearch =
          !searchTerm.trim() ||
          cat.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
          (cat.superCategory?.name &&
            cat.superCategory.name.toLowerCase().includes(searchTerm.toLowerCase().trim()));
        if (!matchesSearch) return false;

        const b = (budgets || []).find((item) => item?.categoryId === cat.id);
        const hasBudget = Boolean(b && b.hasBudget && b.monthlyLimit > 0);

        if (statusFilter === 'HAS_TARGET') return hasBudget;
        if (statusFilter === 'NO_TARGET') return !hasBudget;
        if (statusFilter === 'OVER_BUDGET') return hasBudget && b?.status === 'EXCEEDED';

        return true;
      })
      .sort((a, b) => {
        const budgetA = (budgets || []).find((item) => item?.categoryId === a.id);
        const budgetB = (budgets || []).find((item) => item?.categoryId === b.id);
        const hasBudgetA = Boolean(budgetA && budgetA.hasBudget && budgetA.monthlyLimit > 0);
        const hasBudgetB = Boolean(budgetB && budgetB.hasBudget && budgetB.monthlyLimit > 0);

        // Categories with limit set come first
        if (hasBudgetA && !hasBudgetB) return -1;
        if (!hasBudgetA && hasBudgetB) return 1;

        // Within each group, keep clean alphabetical order by name
        return a.name.localeCompare(b.name);
      });
  }, [expenseCategories, budgets, searchTerm, statusFilter]);

  // Handle saving an inline limit directly
  const handleSaveInlineLimit = async (catId: string) => {
    const val = parseFloat(inlineLimitValue.replace(/,/g, ''));
    if (isNaN(val) || val < 0) {
      alert('Please enter a valid target limit amount.');
      return;
    }
    setSavingInlineCatId(catId);
    try {
      await api.post('/budgets', {
        categoryId: catId,
        monthlyLimit: val,
        periodType: 'MONTHLY',
        month: selectedMonth,
        year: selectedYear,
      });
      setInlineEditingCatId(null);
      onReload();
    } catch (err) {
      alert(errorMessage(err, 'Failed to save envelope target limit.'));
    } finally {
      setSavingInlineCatId(null);
    }
  };

  // Handle deleting a budget limit directly
  const handleDeleteTargetLimit = async (budgetId: string) => {
    if (!confirm('Are you sure you want to remove this envelope target?')) return;
    setDeletingCatBudgetId(budgetId);
    try {
      await api.delete(`/budgets/${budgetId}`);
      onReload();
    } catch (err) {
      alert(errorMessage(err, 'Failed to delete envelope limit.'));
    } finally {
      setDeletingCatBudgetId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Month Navigation Bar ────────── */}
      <MonthNavigationBar
        monthLabel={monthLabel}
        isCurrentMonth={isCurrentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onResetToCurrentMonth={handleResetToCurrentMonth}
        extraRightContent={
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Envelope Budgeting for <strong style={{ color: 'var(--ink)' }}>{monthLabel}</strong>
          </span>
        }
      />

      {/* ── Summary KPI Cards ────────── */}
      <EnvelopeMetrics summary={summary} monthLabel={monthLabel} />

      {/* ── Expense Envelopes & Target Limits Table ──────────────────────────────── */}
      <section className="panel" style={{ padding: '20px', borderRadius: '14px' }}>
        {/* Table Controls Header */}
        <div
          style={{
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}>
          <div>
            <span className="eyebrow" style={{ color: 'var(--green)' }}>
              Envelope Limits &amp; Management
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              Expense Category Envelopes ({filteredExpenseCategories.length})
            </h2>
          </div>

          {/* Search and Quick Status Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--background-alt)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '4px 10px',
              }}>
              <Search size={14} color="var(--muted)" />
              <input
                type="text"
                placeholder="Search category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '12px',
                  color: 'var(--ink)',
                  outline: 'none',
                  width: '160px',
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--muted)',
                  }}>
                  <X size={13} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                style={{
                  fontSize: '11.5px',
                  fontWeight: statusFilter === 'ALL' ? 700 : 500,
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: statusFilter === 'ALL' ? '1.5px solid var(--green)' : '1px solid var(--line)',
                  background: statusFilter === 'ALL' ? 'var(--theme-soft-start)' : 'var(--background-alt)',
                  color: statusFilter === 'ALL' ? 'var(--green)' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}>
                All ({counts.total})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('HAS_TARGET')}
                style={{
                  fontSize: '11.5px',
                  fontWeight: statusFilter === 'HAS_TARGET' ? 700 : 500,
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: statusFilter === 'HAS_TARGET' ? '1.5px solid var(--green)' : '1px solid var(--line)',
                  background: statusFilter === 'HAS_TARGET' ? 'var(--theme-soft-start)' : 'var(--background-alt)',
                  color: statusFilter === 'HAS_TARGET' ? 'var(--green)' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}>
                Budgeted ({counts.withTarget})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('NO_TARGET')}
                style={{
                  fontSize: '11.5px',
                  fontWeight: statusFilter === 'NO_TARGET' ? 700 : 500,
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: statusFilter === 'NO_TARGET' ? '1.5px solid var(--line)' : '1px solid var(--line)',
                  background: statusFilter === 'NO_TARGET' ? 'var(--card)' : 'var(--background-alt)',
                  color: statusFilter === 'NO_TARGET' ? 'var(--ink)' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}>
                No Target ({counts.noTarget})
              </button>

              {counts.overBudget > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('OVER_BUDGET')}
                  style={{
                    fontSize: '11.5px',
                    fontWeight: statusFilter === 'OVER_BUDGET' ? 700 : 500,
                    padding: '4px 10px',
                    borderRadius: '20px',
                    border: '1.5px solid #ef4444',
                    background: statusFilter === 'OVER_BUDGET' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.08)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}>
                  Over Budget ({counts.overBudget})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Clean Data Table */}
        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line)' }}>
                <th style={{ width: '260px', padding: '12px 10px' }}>Expense Category</th>
                <th style={{ width: '200px', padding: '12px 10px' }}>Monthly Target Limit</th>
                <th style={{ width: '220px', padding: '12px 10px' }}>Current Outflow</th>
                <th style={{ width: '180px', padding: '12px 10px' }}>Envelope Status</th>
                <th style={{ width: '120px', padding: '12px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenseCategories.map((cat) => {
                const budget = (budgets || []).find((b) => b?.categoryId === cat.id);
                const hasBudget = budget && budget.hasBudget && budget.monthlyLimit > 0;
                const limit = budget?.monthlyLimit ?? 0;
                const spent = budget?.spentAmount ?? 0;
                const pct = budget?.percentage ?? 0;
                const status = budget?.status ?? 'NO_LIMIT';
                const txCount = budget?.transactionCount ?? 0;
                const catColor = cat.color || '#3b82f6';
                const isInlineEditing = inlineEditingCatId === cat.id;
                const isSaving = savingInlineCatId === cat.id;
                const isDeleting = deletingCatBudgetId === budget?.budgetId;

                return (
                  <tr
                    key={cat.id}
                    style={{
                      borderBottom: '1px solid var(--line)',
                      transition: 'background 0.1s ease',
                    }}>
                    {/* Column 1: Category Name, Dot, Supercategory & Tx count */}
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: catColor,
                            display: 'inline-block',
                            flexShrink: 0,
                            boxShadow: `0 0 6px ${catColor}55`,
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ color: 'var(--ink)', fontWeight: 700, fontSize: '13.5px' }}>
                              {cat.name}
                            </strong>
                            {cat.superCategory && cat.superCategory.name !== 'Expense' && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  color: 'var(--muted)',
                                  background: 'var(--background-alt)',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--line)',
                                }}>
                                {cat.superCategory.name}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {txCount} transaction{txCount === 1 ? '' : 's'} this month
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Monthly Target Limit */}
                    <td style={{ padding: '12px 10px' }}>
                      {isInlineEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ position: 'relative', width: '120px' }}>
                            <span
                              style={{
                                position: 'absolute',
                                left: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--muted)',
                                fontSize: '12px',
                                fontWeight: 700,
                              }}>
                              ₹
                            </span>
                            <input
                              type="number"
                              autoFocus
                              value={inlineLimitValue}
                              onChange={(e) => setInlineLimitValue(e.target.value)}
                              placeholder="e.g. 5000"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInlineLimit(cat.id);
                                if (e.key === 'Escape') setInlineEditingCatId(null);
                              }}
                              style={{
                                width: '100%',
                                height: '32px',
                                padding: '0 8px 0 20px',
                                fontSize: '13px',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: '1.5px solid var(--green)',
                                background: 'var(--background-alt)',
                                color: 'var(--ink)',
                                outline: 'none',
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            title="Save"
                            disabled={isSaving}
                            onClick={() => handleSaveInlineLimit(cat.id)}
                            style={{
                              background: 'var(--green)',
                              border: 'none',
                              color: '#ffffff',
                              borderRadius: '6px',
                              padding: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                            }}>
                            {isSaving ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                          </button>
                          <button
                            type="button"
                            title="Cancel"
                            onClick={() => setInlineEditingCatId(null)}
                            style={{
                              background: 'var(--background-alt)',
                              border: '1px solid var(--line)',
                              color: 'var(--muted)',
                              borderRadius: '6px',
                              padding: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                            }}>
                            <X size={13} />
                          </button>
                        </div>
                      ) : hasBudget ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid transparent',
                            transition: 'all 0.15s ease',
                          }}
                          onClick={() => {
                            setInlineEditingCatId(cat.id);
                            setInlineLimitValue(String(limit));
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--line)';
                            e.currentTarget.style.background = 'var(--background-alt)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.background = 'transparent';
                          }}>
                          <strong style={{ color: 'var(--ink)', fontSize: '13.5px' }}>
                            {money(limit * 100)}
                          </strong>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>/ mo</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setInlineEditingCatId(cat.id);
                            setInlineLimitValue('');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color: 'var(--green)',
                            background: 'rgba(29, 117, 79, 0.08)',
                            border: '1px dashed rgba(29, 117, 79, 0.3)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}>
                          <Plus size={12} /> Set Target
                        </button>
                      )}
                    </td>

                    {/* Column 3: Current Outflow & Progress */}
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '150px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <strong style={{ color: 'var(--ink)', fontSize: '13px' }}>
                            {money(spent * 100)}
                          </strong>
                          {hasBudget && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                color:
                                  status === 'EXCEEDED'
                                    ? '#ef4444'
                                    : status === 'WARNING'
                                    ? '#f59e0b'
                                    : 'var(--green)',
                              }}>
                              {pct}%
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            height: '4px',
                            width: '100%',
                            background: 'var(--background-alt)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                          }}>
                          {hasBudget ? (
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(100, Math.max(0, pct))}%`,
                                background:
                                  status === 'EXCEEDED'
                                    ? '#ef4444'
                                    : status === 'WARNING'
                                    ? '#f59e0b'
                                    : 'var(--green)',
                                borderRadius: '2px',
                              }}
                            />
                          ) : (
                            <div style={{ height: '100%', width: '0%' }} />
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Column 4: Envelope Status Badge */}
                    <td style={{ padding: '12px 10px' }}>
                      {hasBudget ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background:
                              status === 'EXCEEDED'
                                ? 'rgba(239, 68, 68, 0.1)'
                                : status === 'WARNING'
                                ? 'rgba(245, 158, 11, 0.1)'
                                : 'rgba(29, 117, 79, 0.1)',
                            color:
                              status === 'EXCEEDED'
                                ? '#ef4444'
                                : status === 'WARNING'
                                ? '#f59e0b'
                                : 'var(--green)',
                            border: `1px solid ${
                              status === 'EXCEEDED'
                                ? '#ef444433'
                                : status === 'WARNING'
                                ? '#f59e0b33'
                                : 'rgba(29, 117, 79, 0.2)'
                            }`,
                          }}>
                          {status === 'EXCEEDED'
                            ? `Over by ${money((spent - limit) * 100)}`
                            : status === 'WARNING'
                            ? `Near limit (${money((limit - spent) * 100)} left)`
                            : `${money((limit - spent) * 100)} left`}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--muted)',
                            background: 'var(--background-alt)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--line)',
                          }}>
                          No target set
                        </span>
                      )}
                    </td>

                    {/* Column 5: Clean Actions */}
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                        }}>
                        <button
                          type="button"
                          title={hasBudget ? 'Edit Target Limit' : 'Set Target Limit'}
                          onClick={() => {
                            setInlineEditingCatId(cat.id);
                            setInlineLimitValue(hasBudget ? String(limit) : '');
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--line)',
                            background: 'var(--background-alt)',
                            color: 'var(--ink)',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                          <Edit2 size={11} />
                          <span>{hasBudget ? 'Edit' : 'Set'}</span>
                        </button>

                        {hasBudget && budget?.budgetId && (
                          <button
                            type="button"
                            title="Remove Target Limit"
                            onClick={() => handleDeleteTargetLimit(budget.budgetId!)}
                            disabled={isDeleting}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #ef444433',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#ef4444',
                              fontSize: '11.5px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}>
                            {isDeleting ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredExpenseCategories.length === 0 && (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)', fontSize: '13px' }}>
            No expense categories found matching your search.
          </div>
        )}
      </section>
    </div>
  );
}
