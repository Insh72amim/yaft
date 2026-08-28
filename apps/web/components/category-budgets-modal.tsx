'use client';

import { useEffect, useState, useCallback } from 'react';
import { Target, Plus, Trash2, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';

type CategoryOption = { id: string; name: string; color: string };

type CategoryBudgetItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  monthlyLimit: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  status: 'OK' | 'WARNING' | 'EXCEEDED';
};

export function CategoryBudgetsModal({
  onClose,
  onBudgetsUpdated,
}: {
  onClose: () => void;
  onBudgetsUpdated?: () => void;
}) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [monthlyLimitInput, setMonthlyLimitInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New Category states
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');
  const [creatingCat, setCreatingCat] = useState(false);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    setError('');
    try {
      const created = await api<{ id: string; name: string; color: string }>('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
      });
      setCategories((prev) => [...prev.filter((c) => c.id !== created.id), created]);
      setSelectedCategoryId(created.id);
      setNewCatName('');
      setShowNewCatInput(false);
      setSuccessMsg(`Created category "${created.name}"!`);
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setCreatingCat(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [catRes, budgetRes] = await Promise.all([
        api<{ categories: CategoryOption[] }>('/categories'),
        api<{ budgets: CategoryBudgetItem[] }>('/budgets'),
      ]);
      setCategories(catRes.categories || []);
      setBudgets(budgetRes.budgets || []);
      if (!selectedCategoryId && catRes.categories?.length > 0) {
        setSelectedCategoryId(catRes.categories[0].id);
      }
    } catch (err: any) {
      if (isUnauthorized(err)) return;
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) {
      setError('Please select a category.');
      return;
    }
    const limit = parseFloat(monthlyLimitInput);
    if (isNaN(limit) || limit <= 0) {
      setError('Please enter a valid monthly budget limit greater than 0.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccessMsg('');
      await api('/budgets', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          monthlyLimit: limit,
        }),
      });
      setSuccessMsg('Category budget saved successfully!');
      setMonthlyLimitInput('');
      fetchData();
      if (onBudgetsUpdated) onBudgetsUpdated();
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      setDeletingId(id);
      setError('');
      setSuccessMsg('');
      await api(`/budgets/${id}`, { method: 'DELETE' });
      setSuccessMsg('Category budget removed.');
      fetchData();
      if (onBudgetsUpdated) onBudgetsUpdated();
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="modal-wrap" style={{ zIndex: 99999 }}>
      <button className="backdrop" onClick={onClose} aria-label="Close budgets modal" />
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        style={{
          width: 'min(680px, 95vw)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          borderRadius: '16px',
          background: 'var(--card)',
          border: '1px solid var(--line)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Target size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)' }}>Category Envelopes & Monthly Budgets</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                Set monthly spending targets and monitor envelope thresholds in real time
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ghost compact"
            style={{ padding: '0.4rem', borderRadius: '8px' }}
          >
            <X size={18} />
          </button>
        </header>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: 'var(--card)' }}>
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form to Set/Update Budget */}
          <form
            onSubmit={handleSaveBudget}
            style={{
              padding: '1.25rem',
              background: 'var(--background-alt)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              marginBottom: '1.5rem',
            }}
          >
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)' }}>Set Monthly Envelope Budget</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Category
                  </label>
                  <button
                    type="button"
                    className="ghost compact"
                    onClick={() => setShowNewCatInput(!showNewCatInput)}
                    style={{ fontSize: '11px', color: 'var(--green)', padding: '0 4px', fontWeight: 600 }}
                  >
                    {showNewCatInput ? 'Cancel' : '+ Custom Category'}
                  </button>
                </div>
                {showNewCatInput ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="Category name..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="input-field"
                      style={{ flex: 1, height: '36px', fontSize: '12px' }}
                    />
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      style={{ width: '36px', height: '36px', padding: '2px', borderRadius: '8px', border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--background)' }}
                    />
                    <button
                      type="button"
                      className="primary compact"
                      disabled={creatingCat || !newCatName.trim()}
                      onClick={handleCreateCategory}
                      style={{ height: '36px', padding: '0 10px', fontSize: '12px' }}
                    >
                      {creatingCat ? <Loader2 className="spin" size={13} /> : 'Save'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>
                  Monthly Target (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={monthlyLimitInput}
                  onChange={(e) => setMonthlyLimitInput(e.target.value)}
                  className="input-field"
                  style={{ width: '100%' }}
                  step="100"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="primary compact"
                style={{ height: '38px', padding: '0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
              >
                {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                <span>Save</span>
              </button>
            </div>
          </form>

          {/* Active Budgets Envelope List */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)' }}>
              Active Category Envelopes ({budgets.length})
            </h4>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                <Loader2 size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading category envelopes...</p>
              </div>
            ) : budgets.length === 0 ? (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  background: 'var(--background-alt)',
                  borderRadius: '12px',
                  border: '1px dashed var(--line)',
                }}
              >
                <Target size={28} style={{ opacity: 0.4, marginBottom: '0.5rem', color: 'var(--muted)' }} />
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 600 }}>No category budgets created yet.</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Use the form above to assign target monthly spending limits.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {budgets.map((b) => {
                  const statusColor = b.status === 'EXCEEDED' ? '#ef4444' : b.status === 'WARNING' ? '#f59e0b' : '#10b981';
                  return (
                    <div
                      key={b.id}
                      style={{
                        padding: '1rem 1.25rem',
                        background: 'var(--background-alt)',
                        border: `1px solid ${b.status === 'EXCEEDED' ? 'rgba(239,68,68,0.4)' : 'var(--line)'}`,
                        borderRadius: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: b.categoryColor || '#3b82f6',
                            }}
                          />
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' }}>{b.categoryName}</span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              background: b.status === 'EXCEEDED' ? 'rgba(239,68,68,0.15)' : b.status === 'WARNING' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                              color: statusColor,
                            }}
                          >
                            {b.status === 'EXCEEDED' ? '🚨 OVER BUDGET' : b.status === 'WARNING' ? '⚠️ 80%+ REACHED' : '🟢 ON TRACK'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                            <strong style={{ color: 'var(--ink)' }}>{money(b.spentAmount)}</strong> of {money(b.monthlyLimit)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteBudget(b.id)}
                            disabled={deletingId === b.id}
                            className="ghost compact"
                            style={{ padding: '4px 8px', color: '#ef4444' }}
                            title="Delete Budget"
                          >
                            {deletingId === b.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div
                        style={{
                          height: '8px',
                          width: '100%',
                          backgroundColor: 'var(--line)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, b.percentage)}%`,
                            backgroundColor: statusColor,
                            borderRadius: '4px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
