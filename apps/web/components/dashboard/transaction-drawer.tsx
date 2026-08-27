'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Landmark,
  Copy,
  Check,
  Calendar,
  Layers,
  FileText,
  Tag,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Pencil,
  Loader2,
} from 'lucide-react';
import { api, errorMessage, money } from '@/lib/api';
import { CategoryItem } from '@/components/category-picker-popover';

export interface DrawerTransactionItem {
  id: string;
  accountId: string;
  accountName: string;
  accountType: string;
  institution?: string;
  transactionDate: string;
  description: string;
  rawDescription?: string;
  merchant?: string;
  amount: number;
  amountMinor?: number;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  tags: { id: string; name: string; color: string }[];
  isRefund?: boolean;
}

interface TransactionDrawerProps {
  transaction: DrawerTransactionItem | null;
  categories: CategoryItem[];
  onClose: () => void;
  onCategoryChange: (transactionId: string, categoryId: string) => void;
  onTransactionUpdated?: (
    transactionId: string,
    updates: { merchant?: string; rawDescription?: string; description?: string }
  ) => void;
}

export function TransactionDrawer({
  transaction,
  categories,
  onClose,
  onCategoryChange,
  onTransactionUpdated,
}: TransactionDrawerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editingMerchant, setEditingMerchant] = useState(false);
  const [merchantDraft, setMerchantDraft] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setMerchantDraft(transaction.merchant || transaction.description || '');
      setEditingMerchant(false);
    }
  }, [transaction?.id]);

  if (!transaction) return null;

  const handleSaveMerchant = async () => {
    if (!transaction) return;
    setSavingField('merchant');
    try {
      await api(`/transactions/${transaction.accountId}/${transaction.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          merchant: merchantDraft.trim() || null,
        }),
      });
      onTransactionUpdated?.(transaction.id, {
        merchant: merchantDraft.trim() || undefined,
        description: merchantDraft.trim() || transaction.description,
      });
      setEditingMerchant(false);
    } catch (err) {
      alert(errorMessage(err, 'Failed to update merchant name.'));
    } finally {
      setSavingField(null);
    }
  };

  const isDebit = transaction.amount < 0 || (transaction.amountMinor ?? 0) < 0;
  const absAmtMinor = Math.abs(
    transaction.amountMinor ?? Math.round((transaction.amount || 0) * 100),
  );

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const txDate = new Date(transaction.transactionDate);
  const formattedDate = !isNaN(txDate.getTime())
    ? txDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : transaction.transactionDate;

  const formattedTime = !isNaN(txDate.getTime())
    ? txDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Drawer Panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          height: '100%',
          background: 'var(--card)',
          borderLeft: '1px solid var(--line)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--green)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>
              Transaction Details
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--background-alt)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--muted)',
              display: 'grid',
              placeItems: 'center',
            }}>
            <X size={16} />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            flex: 1,
          }}>
          {/* Main Amount Card */}
          <div
            style={{
              background: 'var(--background-alt)',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
                background: isDebit ? 'rgba(239, 68, 68, 0.12)' : 'rgba(29, 117, 79, 0.12)',
                color: isDebit ? '#ef4444' : 'var(--green)',
              }}>
              {isDebit ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
              {isDebit ? 'Expense / Outflow' : 'Refund / Inflow'}
            </span>

            <span
              style={{
                fontFamily: "'SF Mono', monospace",
                fontSize: '32px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: isDebit ? '#ef4444' : 'var(--green)',
              }}>
              {isDebit ? `-${money(absAmtMinor)}` : `+${money(absAmtMinor)}`}
            </span>

            {editingMerchant ? (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                <input
                  type="text"
                  autoFocus
                  value={merchantDraft}
                  onChange={(e) => setMerchantDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveMerchant();
                    if (e.key === 'Escape') setEditingMerchant(false);
                  }}
                  placeholder="Merchant name (e.g. ZOMATO)"
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--background-alt)',
                    color: 'var(--ink)',
                    outline: 'none',
                    width: '100%',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingMerchant(false)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      border: '1px solid var(--line)',
                      background: 'var(--card)',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                    }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveMerchant()}
                    disabled={savingField === 'merchant'}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--green)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                    {savingField === 'merchant' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <h4
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                  }}>
                  {transaction.merchant || transaction.description}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingMerchant(true)}
                  title="Edit merchant name"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.7,
                  }}>
                  <Pencil size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Key Metadata Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Date & Time */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--background-alt)',
                  border: '1px solid var(--line)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--muted)',
                  flexShrink: 0,
                }}>
                <Calendar size={16} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>
                  Date &amp; Time
                </span>
                <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{formattedDate}</strong>
                {formattedTime && (
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                    <Clock size={11} style={{ display: 'inline', marginRight: '4px' }} />
                    {formattedTime}
                  </span>
                )}
              </div>
            </div>

            {/* Account */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--background-alt)',
                  border: '1px solid var(--line)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--muted)',
                  flexShrink: 0,
                }}>
                {transaction.accountType === 'CREDIT_CARD' ? (
                  <CreditCard size={16} />
                ) : (
                  <Landmark size={16} />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>
                  Payment Source / Account
                </span>
                <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>
                  {transaction.accountName}
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                  {transaction.institution || transaction.accountType.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Category with inline selector */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: `${transaction.categoryColor || '#3b82f6'}18`,
                  border: `1px solid ${transaction.categoryColor || '#3b82f6'}40`,
                  display: 'grid',
                  placeItems: 'center',
                  color: transaction.categoryColor || 'var(--green)',
                  flexShrink: 0,
                }}>
                <Layers size={16} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>
                  Category
                </span>
                <div style={{ marginTop: '4px' }}>
                  <select
                    value={transaction.categoryId || ''}
                    onChange={(e) => onCategoryChange(transaction.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--background-alt)',
                      color: 'var(--ink)',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                    }}>
                    <option value="">(Uncategorised)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Tags */}
            {transaction.tags && transaction.tags.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--background-alt)',
                    border: '1px solid var(--line)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--muted)',
                    flexShrink: 0,
                  }}>
                  <Tag size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>
                    Tags
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {transaction.tags.map((tg) => (
                      <span
                        key={tg.id}
                        style={{
                          fontSize: '11.5px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: `${tg.color}20`,
                          color: tg.color,
                          fontWeight: 600,
                          border: `1px solid ${tg.color}40`,
                        }}>
                        {tg.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Raw Bank Narration Box */}
          {transaction.rawDescription && (
            <div
              style={{
                background: 'var(--background-alt)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '14px 16px',
              }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    letterSpacing: '0.05em',
                  }}>
                  Raw Bank Statement Narration
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(transaction.rawDescription!, 'narration')}
                  title="Copy raw narration"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                  }}>
                  {copiedField === 'narration' ? (
                    <>
                      <Check size={12} color="var(--green)" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--ink)',
                  fontFamily: "'SF Mono', monospace",
                  wordBreak: 'break-word',
                  lineHeight: '1.4',
                }}>
                {transaction.rawDescription}
              </p>
            </div>
          )}

          {/* Transaction ID */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--muted)',
              borderTop: '1px solid var(--line)',
              paddingTop: '12px',
            }}>
            <span>Tx ID: {transaction.id.slice(0, 16)}...</span>
            <button
              type="button"
              onClick={() => copyToClipboard(transaction.id, 'id')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
              }}>
              {copiedField === 'id' ? <Check size={11} color="var(--green)" /> : <Copy size={11} />}
              {copiedField === 'id' ? 'Copied' : 'Copy ID'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
