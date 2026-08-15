"use client";

import { useState } from "react";
import {
  Plus,
  Sparkles,
  Trash2,
  Pencil,
  Calendar,
  X,
  Loader2,
} from "lucide-react";
import { money } from "@/lib/api";

export type TagItem = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetLimit: number | null;
  transactionCount: number;
  totalSpent: number;
  totalReceived: number;
  netTotal: number;
  createdAt: string;
};

export type TagAnalytics = {
  tag: {
    id: string;
    name: string;
    color: string;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    budgetLimit: number | null;
  };
  summary: {
    totalCount: number;
    totalSpent: number;
    totalReceived: number;
    netTotal: number;
  };
  categories: Array<{
    id: string;
    name: string;
    color: string;
    amount: number;
    percentage: number;
  }>;
  transactions: Array<{
    id: string;
    transactionDate: string;
    description: string;
    merchant: string | null;
    amount: number;
    category: string;
    categoryColor: string;
    accountName: string;
    accountType: string;
  }>;
};

interface TagsTabProps {
  tags: TagItem[];
  inspectedTagId: string | null;
  setInspectedTagId: (id: string | null) => void;
  tagAnalytics: TagAnalytics | null;
  loadingTagAnalytics: boolean;
  selectedTagForAuto: string;
  setSelectedTagForAuto: (id: string) => void;
  autoTagStart: string;
  setAutoTagStart: (val: string) => void;
  autoTagEnd: string;
  setAutoTagEnd: (val: string) => void;
  autoTagKeywords: string;
  setAutoTagKeywords: (val: string) => void;
  applyingAutoTag: boolean;
  handleApplyAutoTag: (e: React.FormEvent) => Promise<void>;
  handleDeleteTag: (id: string, name: string) => Promise<void>;
  handleRemoveTagFromTx: (txId: string, tagId: string) => Promise<void>;
  setEditingTag: (tag: TagItem | null) => void;
  setTagName: (name: string) => void;
  setTagColor: (color: string) => void;
  setTagDesc: (desc: string) => void;
  setTagStart: (start: string) => void;
  setTagEnd: (end: string) => void;
  setTagBudget: (budget: string) => void;
  setTagModalOpen: (open: boolean) => void;
}

export function TagsTab({
  tags,
  inspectedTagId,
  setInspectedTagId,
  tagAnalytics,
  loadingTagAnalytics,
  selectedTagForAuto,
  setSelectedTagForAuto,
  autoTagStart,
  setAutoTagStart,
  autoTagEnd,
  setAutoTagEnd,
  autoTagKeywords,
  setAutoTagKeywords,
  applyingAutoTag,
  handleApplyAutoTag,
  handleDeleteTag,
  handleRemoveTagFromTx,
  setEditingTag,
  setTagName,
  setTagColor,
  setTagDesc,
  setTagStart,
  setTagEnd,
  setTagBudget,
  setTagModalOpen,
}: TagsTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)" }}>Custom Tags</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>Tag transactions manually or set date-range rules to auto-apply tags across all accounts.</p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={() => { setEditingTag(null); setTagName(""); setTagColor("#3b82f6"); setTagDesc(""); setTagStart(""); setTagEnd(""); setTagBudget(""); setTagModalOpen(true); }}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <Plus size={16} />
          <span>Create New Tag</span>
        </button>
      </div>

      {/* Top Grid: Auto-Apply Rules & Quick Creator */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
        {/* Form 1: Auto-Assign Tag */}
        <section className="panel" style={{ padding: "20px" }}>
          <div className="panel-title" style={{ marginBottom: "16px" }}>
            <div>
              <span className="eyebrow" style={{ color: "#3b82f6" }}>Automated Tag Assignment</span>
              <h2>Auto-Apply Tag to Transactions</h2>
            </div>
          </div>

          <form onSubmit={handleApplyAutoTag} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Target Tag / Trip</label>
              <select
                value={selectedTagForAuto}
                onChange={(e) => setSelectedTagForAuto(e.target.value)}
                required
                style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                <option value="">Select Tag or Trip...</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} {t.startDate ? `(${t.startDate.slice(0, 10)})` : ''}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Start Date (Time-Based)</label>
                <input
                  type="date"
                  value={autoTagStart}
                  onChange={(e) => setAutoTagStart(e.target.value)}
                  style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>End Date (Time-Based)</label>
                <input
                  type="date"
                  value={autoTagEnd}
                  onChange={(e) => setAutoTagEnd(e.target.value)}
                  style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Merchant / Description Keywords (Optional)</label>
              <input
                type="text"
                value={autoTagKeywords}
                onChange={(e) => setAutoTagKeywords(e.target.value)}
                placeholder="e.g. Zomato, Indigo, Swiggy, Hotel"
                style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
              />
            </div>

            <button
              type="submit"
              disabled={applyingAutoTag || !selectedTagForAuto}
              className="primary"
              style={{ alignSelf: "flex-start", marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={16} />
              <span>{applyingAutoTag ? "Applying Tag..." : "Auto-Apply Tag to Transactions"}</span>
            </button>
          </form>
        </section>

        {/* Form 2: Quick Tag Cards Overview */}
        <section className="panel" style={{ padding: "20px" }}>
          <div className="panel-title" style={{ marginBottom: "16px" }}>
            <div>
              <span className="eyebrow" style={{ color: "#3b82f6" }}>Active Directory</span>
              <h2>All Active Tags ({tags.length})</h2>
            </div>
          </div>

          {tags.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "13px" }}>No tags created yet. Click "Create New Tag" above.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "280px", overflowY: "auto" }}>
              {tags.map((tag) => {
                const isInspected = inspectedTagId === tag.id;
                return (
                  <div
                    key={tag.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: isInspected ? `${tag.color}15` : "var(--background-alt)",
                      border: isInspected ? `1.5px solid ${tag.color}` : "1px solid var(--line)",
                      cursor: "pointer",
                    }}
                    onClick={() => setInspectedTagId(isInspected ? null : tag.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: tag.color }} />
                      <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{tag.name}</strong>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: 700 }}>{money(tag.totalSpent * 100)}</span>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id, tag.name); }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Main Tags Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: "16px" }}>
        {tags.map((tag) => {
          const isInspected = inspectedTagId === tag.id;
          const hasBudget = tag.budgetLimit !== null && tag.budgetLimit > 0;
          const spentPct = hasBudget ? Math.min(100, Math.round((tag.totalSpent / tag.budgetLimit!) * 100)) : 0;
          const isOver = hasBudget && tag.totalSpent > tag.budgetLimit!;

          return (
            <div
              key={tag.id}
              className="panel"
              style={{
                padding: "20px",
                borderRadius: "14px",
                border: isInspected ? `2px solid ${tag.color}` : "1px solid var(--line)",
                background: isInspected ? `${tag.color}08` : "var(--card)",
                cursor: "pointer",
              }}
              onClick={() => setInspectedTagId(isInspected ? null : tag.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: tag.color }} />
                  <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>{tag.name}</h4>
                </div>
                <div style={{ display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="icon-button"
                    title="Edit Tag"
                    onClick={() => { setEditingTag(tag); setTagName(tag.name); setTagColor(tag.color); setTagDesc(tag.description || ""); setTagStart(tag.startDate ? tag.startDate.slice(0, 10) : ""); setTagEnd(tag.endDate ? tag.endDate.slice(0, 10) : ""); setTagBudget(tag.budgetLimit ? String(tag.budgetLimit) : ""); setTagModalOpen(true); }}>
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    title="Delete Tag"
                    onClick={() => handleDeleteTag(tag.id, tag.name)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {tag.startDate && (
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Calendar size={12} />
                  <span>{tag.startDate.slice(0, 10)} — {tag.endDate ? tag.endDate.slice(0, 10) : "Present"}</span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", margin: "10px 0" }}>
                <div style={{ background: "var(--background-alt)", padding: "8px 10px", borderRadius: "8px" }}>
                  <span style={{ color: "var(--muted)", fontSize: "10px", display: "block" }}>Outflow</span>
                  <strong style={{ color: "#ef4444", fontSize: "13px" }}>{money(tag.totalSpent * 100)}</strong>
                </div>
                <div style={{ background: "var(--background-alt)", padding: "8px 10px", borderRadius: "8px" }}>
                  <span style={{ color: "var(--muted)", fontSize: "10px", display: "block" }}>Transactions</span>
                  <strong style={{ color: "var(--ink)", fontSize: "13px" }}>{tag.transactionCount} rows</strong>
                </div>
              </div>

              {hasBudget && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                    <span style={{ color: isOver ? "#ef4444" : "var(--muted)", fontWeight: 600 }}>
                      {isOver ? "⚠️ Trip Budget Exceeded" : "Trip Budget Limit"}
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--ink)" }}>{money(tag.totalSpent * 100)} / {money(tag.budgetLimit! * 100)}</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "var(--line)", borderRadius: "6px", overflow: "hidden" }}>
                    <div style={{ width: `${spentPct}%`, height: "100%", background: isOver ? "#ef4444" : tag.color, borderRadius: "6px" }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tag Analytics Inspection Panel */}
      {inspectedTagId && tagAnalytics && (
        <section className="panel" style={{ padding: "24px", marginTop: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: tagAnalytics.tag.color }} />
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)" }}>
                Breakdown for "{tagAnalytics.tag.name}"
              </h3>
            </div>
            <button type="button" className="secondary compact" onClick={() => setInspectedTagId(null)}>
              Close
            </button>
          </div>

          {loadingTagAnalytics ? (
            <div className="loading"><span/><p>Loading breakdown...</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {tagAnalytics.categories.length > 0 && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {tagAnalytics.categories.map((c) => (
                    <span key={c.id} style={{ padding: "4px 10px", borderRadius: "6px", background: `${c.color}20`, color: c.color, fontSize: "11px", fontWeight: 700 }}>
                      {c.name}: {money(c.amount * 100)} ({c.percentage}%)
                    </span>
                  ))}
                </div>
              )}

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                      <th style={{ padding: "8px" }}>Date</th>
                      <th style={{ padding: "8px" }}>Description</th>
                      <th style={{ padding: "8px" }}>Category</th>
                      <th style={{ padding: "8px" }}>Account</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>Amount</th>
                      <th style={{ padding: "8px", textAlign: "center", width: "50px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagAnalytics.transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "8px", color: "var(--muted)" }}>{new Date(tx.transactionDate).toLocaleDateString("en-IN")}</td>
                        <td style={{ padding: "8px", fontWeight: 600 }}>{tx.merchant || tx.description}</td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ padding: "2px 6px", borderRadius: "4px", background: `${tx.categoryColor}20`, color: tx.categoryColor, fontWeight: 700, fontSize: "10px" }}>
                            {tx.category}
                          </span>
                        </td>
                        <td style={{ padding: "8px", color: "var(--muted)" }}>{tx.accountName}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: tx.amount < 0 ? "#ef4444" : "#10b981" }}>
                          {tx.amount < 0 ? `-${money(Math.abs(tx.amount * 100))}` : `+${money(Math.abs(tx.amount * 100))}`}
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <button
                            type="button"
                            className="icon-button danger"
                            title="Remove tag from transaction"
                            onClick={() => handleRemoveTagFromTx(tx.id, tagAnalytics.tag.id)}>
                            <X size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
