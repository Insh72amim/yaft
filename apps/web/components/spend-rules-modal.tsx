'use client';

import { useEffect, useState, useCallback } from 'react';
import { SlidersHorizontal, Plus, Trash2, RotateCcw, X, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { api, errorMessage, isUnauthorized } from '@/lib/api';

type CategoryOption = { id: string; name: string; color: string };

type CategoryRule = {
  id: string;
  pattern: string;
  matchField: 'DESCRIPTION' | 'MERCHANT' | 'REFERENCE';
  matchType: 'CONTAINS' | 'EXACT' | 'STARTS_WITH' | 'REGEX';
  categoryId: string;
  category: { id: string; name: string; color: string };
  createdAt: string;
};

export function SpendRulesModal({
  onClose,
  onRulesApplied,
  initialPattern = '',
  initialCategoryId = '',
}: {
  onClose: () => void;
  onRulesApplied?: () => void;
  initialPattern?: string;
  initialCategoryId?: string;
}) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [pattern, setPattern] = useState(initialPattern);
  const [matchType, setMatchType] = useState<'CONTAINS' | 'EXACT' | 'STARTS_WITH' | 'REGEX'>('CONTAINS');
  const [matchField, setMatchField] = useState<'DESCRIPTION' | 'MERCHANT' | 'REFERENCE'>('DESCRIPTION');
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
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
    } catch (reason) {
      setError(errorMessage(reason, 'Could not create category.'));
    } finally {
      setCreatingCat(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catsRes, rulesRes] = await Promise.all([
        api<CategoryOption[]>('/categories').catch(() => api<CategoryOption[]>('/category-rules/categories')),
        api<CategoryRule[]>('/categories/rules').catch(() => api<CategoryRule[]>('/category-rules')),
      ]);
      setCategories(catsRes || []);
      setRules(rulesRes || []);
      if (!selectedCategoryId && catsRes && catsRes.length > 0) {
        setSelectedCategoryId(catsRes[0].id);
      }
    } catch (reason) {
      if (isUnauthorized(reason)) {
        onClose();
      } else {
        setError(errorMessage(reason, 'Could not load rules and categories.'));
      }
    } finally {
      setLoading(false);
    }
  }, [onClose, selectedCategoryId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) {
      setError('Please enter a description or text pattern.');
      return;
    }
    if (!selectedCategoryId) {
      setError('Please select a category.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      await api('/categories/rules', {
        method: 'POST',
        body: JSON.stringify({
          pattern: pattern.trim(),
          matchType,
          matchField,
          categoryId: selectedCategoryId,
        }),
      }).catch(() =>
        api('/category-rules', {
          method: 'POST',
          body: JSON.stringify({
            pattern: pattern.trim(),
            matchType,
            matchField,
            categoryId: selectedCategoryId,
          }),
        }),
      );

      setPattern('');
      setSuccessMsg('Rule created successfully!');
      await loadData();
      if (onRulesApplied) onRulesApplied();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not create rule.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setDeletingId(ruleId);
    setError('');
    setSuccessMsg('');
    try {
      await api(`/categories/rules/${ruleId}`, { method: 'DELETE' }).catch(() =>
        api(`/category-rules/${ruleId}`, { method: 'DELETE' }),
      );
      setSuccessMsg('Rule deleted.');
      await loadData();
      if (onRulesApplied) onRulesApplied();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not delete rule.'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleApplyRulesToPast = async () => {
    setApplying(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api<{ updatedCount: number }>('/categories/rules/apply', { method: 'POST' }).catch(() =>
        api<{ updatedCount: number }>('/category-rules/apply', { method: 'POST' }),
      );
      setSuccessMsg(`Successfully applied rules! Updated ${res.updatedCount} past transaction${res.updatedCount === 1 ? '' : 's'}.`);
      if (onRulesApplied) onRulesApplied();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not apply rules to past transactions.'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="modal-wrap" style={{ zIndex: 99999 }}>
      <button className="backdrop" onClick={onClose} aria-label="Close rules modal" />
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        style={{
          width: 'min(720px, 95vw)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          borderRadius: '16px',
        }}
      >
        <header className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
          <div>
            <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <SlidersHorizontal size={14} color="var(--green)" /> Categorization Engine
            </span>
            <h2 style={{ fontSize: '18px', margin: '2px 0 4px' }}>Spend Auto-Categorization Rules</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              Define rules to automatically categorize transactions based on description or merchant patterns.
            </p>
          </div>
          <button type="button" className="ghost compact" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{ background: '#fff0ee', border: '1px solid #fca5a5', color: '#dc2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {successMsg && (
            <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#047857', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> {successMsg}
            </div>
          )}

          {/* Form to Add Rule */}
          <form onSubmit={handleAddRule} style={{ background: 'var(--background-alt)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  If Description/Text
                </label>
                <input
                  type="text"
                  placeholder="e.g. SWIGGY, ZOMATO, UBER"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  style={{ width: '100%', height: '36px', fontSize: '13px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--background)', color: 'var(--ink)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Match Type
                </label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as any)}
                  style={{ width: '100%', height: '36px', fontSize: '13px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--background)', color: 'var(--ink)', fontWeight: 600 }}
                >
                  <option value="CONTAINS">Contains</option>
                  <option value="EXACT">Exact Match</option>
                  <option value="STARTS_WITH">Starts With</option>
                  <option value="REGEX">Regular Expression</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    Assign Category
                  </label>
                  <button
                    type="button"
                    className="ghost compact"
                    onClick={() => setShowNewCatInput(!showNewCatInput)}
                    style={{ fontSize: '11px', color: 'var(--green)', padding: '2px 6px', fontWeight: 600 }}
                  >
                    {showNewCatInput ? 'Cancel' : '+ Custom Category'}
                  </button>
                </div>
                {showNewCatInput ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="Category name (e.g. Subscriptions)..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      style={{ flex: 1, height: '36px', fontSize: '12px', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--background)' }}
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
                      style={{ height: '36px', padding: '0 12px', fontSize: '12px' }}
                    >
                      {creatingCat ? <Loader2 className="spin" size={13} /> : 'Save'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    style={{ width: '100%', height: '36px', fontSize: '13px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--background)', color: 'var(--ink)', fontWeight: 600 }}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="primary compact"
                disabled={submitting || !pattern.trim()}
                style={{ height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {submitting ? <Loader2 className="spin" size={14} /> : <Plus size={14} />} Add Rule
              </button>
            </div>
          </form>

          {/* Active Rules Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Active Rules ({rules.length})
              </h3>
              <button
                type="button"
                className="secondary compact"
                disabled={applying || rules.length === 0}
                onClick={handleApplyRulesToPast}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '32px' }}
              >
                {applying ? <Loader2 className="spin" size={13} /> : <Sparkles size={13} color="var(--green)" />}
                Apply Rules to Past Transactions
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader2 className="spin" size={18} /> Loading rules…
              </div>
            ) : rules.length === 0 ? (
              <div style={{ background: 'var(--background-alt)', borderRadius: '12px', padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', border: '1px border-dashed var(--line)' }}>
                No rules created yet. Add your first rule above to automate category tagging.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--background-alt)', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Pattern</th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Match Type</th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Assigned Category</th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          <code style={{ background: 'var(--background-alt)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--line)', fontSize: '12px' }}>
                            {rule.pattern}
                          </code>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: '12px' }}>
                          {rule.matchType === 'CONTAINS' && 'Contains'}
                          {rule.matchType === 'EXACT' && 'Exact Match'}
                          {rule.matchType === 'STARTS_WITH' && 'Starts With'}
                          {rule.matchType === 'REGEX' && 'Regex'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: 'var(--theme-soft-start)',
                              color: 'var(--green)',
                              border: '1px solid var(--line)',
                            }}
                          >
                            {rule.category?.name || 'Category'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="danger compact"
                            disabled={deletingId === rule.id}
                            onClick={() => handleDeleteRule(rule.id)}
                            style={{ padding: '4px 8px', borderRadius: '6px' }}
                            title="Delete rule"
                          >
                            {deletingId === rule.id ? <Loader2 className="spin" size={13} /> : <Trash2 size={13} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <footer style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', background: 'var(--card)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="secondary compact" onClick={onClose} style={{ height: '34px', padding: '0 16px' }}>
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
