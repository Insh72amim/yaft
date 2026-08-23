"use client";

import { useState } from "react";
import {
  Plus,
  Sparkles,
  Trash2,
  Pencil,
  Calendar,
  X,
  Tag as TagIcon,
  TrendingDown,
  Layers,
  ArrowRight,
  Filter,
  Check,
  AlertCircle,
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

const QUICK_PRESETS = [
  { name: "✈️ Vacation / Trip", color: "#3b82f6", desc: "Track flight, hotel & travel spends" },
  { name: "🏠 Home & Renovation", color: "#10b981", desc: "Furniture, repairs & decor" },
  { name: "💼 Business Expense", color: "#8b5cf6", desc: "Reimbursable work expenses" },
  { name: "🎁 Festival / Gifting", color: "#f59e0b", desc: "Diwali, birthdays & celebrations" },
  { name: "🚗 Road Trip", color: "#ec4899", desc: "Fuel, tolls & food on the road" },
  { name: "🩺 Medical & Care", color: "#ef4444", desc: "Doctor visits & health expenses" },
];

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
  const totalSpentAcrossTags = tags.reduce((sum, t) => sum + t.totalSpent, 0);
  const activeTripsCount = tags.filter((t) => t.startDate || t.budgetLimit).length;

  const openNewTagModal = (preset?: typeof QUICK_PRESETS[0]) => {
    setEditingTag(null);
    setTagName(preset ? preset.name : "");
    setTagColor(preset ? preset.color : "#3b82f6");
    setTagDesc(preset ? preset.desc : "");
    setTagStart("");
    setTagEnd("");
    setTagBudget("");
    setTagModalOpen(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Banner & Action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Tagging & Event Hub
            </span>
          </div>
          <h3 style={{ margin: "4px 0 0 0", fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em" }}>
            Custom Tags & Trip Governance
          </h3>
          <p style={{ margin: "3px 0 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Tag transactions manually or define automated date-range & keyword rules to govern trip budgets across all accounts.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={() => openNewTagModal()}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontWeight: 700, fontSize: "13px" }}>
          <Plus size={16} />
          <span>+ Create Custom Tag</span>
        </button>
      </div>

      {/* Summary Metrics Row */}
      {tags.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
          <div style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TagIcon size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em", display: "block" }}>Active Tags</span>
              <strong style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)" }}>{tags.length}</strong>
            </div>
          </div>

          <div style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingDown size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em", display: "block" }}>Tagged Outflow</span>
              <strong style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ef4444" }}>{money(totalSpentAcrossTags * 100)}</strong>
            </div>
          </div>

          <div style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Calendar size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em", display: "block" }}>Trips / Events</span>
              <strong style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)" }}>{activeTripsCount} Configured</strong>
            </div>
          </div>
        </div>
      )}

      {/* Main Top Grid: Auto-Apply Automation & Directory Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
        {/* Panel 1: Auto-Apply Tag Rules */}
        <section className="panel" style={{ padding: "22px", borderRadius: "14px", border: "1px solid var(--line)", background: "var(--card)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={16} />
            </div>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>Automated Tag Rule</span>
              <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>Auto-Apply Tag to Transactions</h4>
            </div>
          </div>

          <form onSubmit={handleApplyAutoTag} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>Target Tag / Trip</label>
                {tags.length === 0 && (
                  <button
                    type="button"
                    onClick={() => openNewTagModal()}
                    style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "11px", fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    + Create Tag First
                  </button>
                )}
              </div>

              <select
                value={selectedTagForAuto}
                onChange={(e) => setSelectedTagForAuto(e.target.value)}
                required
                style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                <option value="">{tags.length === 0 ? "No tags created yet (Create one first)" : "Select Tag or Trip..."}</option>
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
                style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
              />
            </div>

            <button
              type="submit"
              disabled={applyingAutoTag || !selectedTagForAuto}
              className="primary"
              style={{
                alignSelf: "flex-start",
                marginTop: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "13px",
                background: selectedTagForAuto ? "#10b981" : undefined,
                borderColor: selectedTagForAuto ? "#10b981" : undefined,
                opacity: selectedTagForAuto ? 1 : 0.5,
              }}>
              <Sparkles size={16} />
              <span>{applyingAutoTag ? "Scanning & Tagging..." : "Auto-Apply Tag to Transactions"}</span>
            </button>
          </form>
        </section>

        {/* Panel 2: Quick Directory & Presets */}
        <section className="panel" style={{ padding: "22px", borderRadius: "14px", border: "1px solid var(--line)", background: "var(--card)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Layers size={16} />
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>Active Directory</span>
                  <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>All Active Tags ({tags.length})</h4>
                </div>
              </div>
            </div>

            {tags.length === 0 ? (
              <div style={{ background: "var(--background-alt)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
                <strong style={{ fontSize: "13px", color: "var(--ink)", display: "block", marginBottom: "6px" }}>🚀 1-Click Quick Preset Tags</strong>
                <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--muted)" }}>No custom tags created yet. Choose a popular preset to get started immediately:</p>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => openNewTagModal(preset)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: "var(--card)",
                        border: `1px solid ${preset.color}40`,
                        color: "var(--ink)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}>
                      <span>{preset.name}</span>
                      <Plus size={14} style={{ color: preset.color }} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
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
                        borderRadius: "10px",
                        background: isInspected ? `${tag.color}18` : "var(--background-alt)",
                        border: isInspected ? `1.5px solid ${tag.color}` : "1px solid var(--line)",
                        cursor: "pointer",
                      }}
                      onClick={() => setInspectedTagId(isInspected ? null : tag.id)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
                        <div>
                          <strong style={{ fontSize: "13px", color: "var(--ink)", display: "block" }}>{tag.name}</strong>
                          <small style={{ fontSize: "11px", color: "var(--muted)" }}>{tag.transactionCount} transaction(s)</small>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <strong style={{ fontSize: "13px", color: "#ef4444", fontWeight: 700 }}>{money(tag.totalSpent * 100)}</strong>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id, tag.name); }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Quick Presets Bar (Always visible below header if tags exist) */}
      {tags.length > 0 && (
        <div style={{ background: "var(--card)", padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Sparkles size={14} color="#3b82f6" /> Quick Presets:
          </span>
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="secondary compact"
              onClick={() => openNewTagModal(preset)}
              style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span>{preset.name}</span>
              <Plus size={12} style={{ color: preset.color }} />
            </button>
          ))}
        </div>
      )}

      {/* Main Tag Cards Grid */}
      <div>
        <h4 style={{ margin: "0 0 14px 0", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>All Tag Folders &amp; Trip Hubs ({tags.length})</h4>
        
        {tags.length === 0 ? (
          <div style={{ background: "var(--card)", padding: "32px", borderRadius: "14px", border: "1px dashed var(--line)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TagIcon size={24} />
            </div>
            <strong style={{ fontSize: "15px", color: "var(--ink)" }}>No Custom Tags Created Yet</strong>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", maxWidth: "420px" }}>
              Tags let you group transactions across accounts into Trips, Projects, Renovations, or Reimbursable Expenses. Click below to add your first tag.
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => openNewTagModal()}
              style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <Plus size={16} />
              <span>Create First Tag</span>
            </button>
          </div>
        ) : (
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
                    transition: "transform 0.15s ease, border-color 0.15s ease",
                  }}
                  onClick={() => setInspectedTagId(isInspected ? null : tag.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
                      <div>
                        <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--ink)" }}>{tag.name}</h4>
                        {tag.description && (
                          <small style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "2px" }}>{tag.description}</small>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="icon-button"
                        title="Edit Tag"
                        onClick={() => { setEditingTag(tag); setTagName(tag.name); setTagColor(tag.color); setTagDesc(tag.description || ""); setTagStart(tag.startDate ? tag.startDate.slice(0, 10) : ""); setTagEnd(tag.endDate ? tag.endDate.slice(0, 10) : ""); setTagBudget(tag.budgetLimit ? String(tag.budgetLimit) : ""); setTagModalOpen(true); }}>
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        title="Delete Tag"
                        onClick={() => handleDeleteTag(tag.id, tag.name)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {tag.startDate && (
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "5px", background: "var(--background-alt)", padding: "4px 8px", borderRadius: "6px", width: "fit-content" }}>
                      <Calendar size={13} color="#3b82f6" />
                      <span>{tag.startDate.slice(0, 10)} — {tag.endDate ? tag.endDate.slice(0, 10) : "Present"}</span>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", margin: "10px 0" }}>
                    <div style={{ background: "var(--background-alt)", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--muted)", fontSize: "10px", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Total Outflow</span>
                      <strong style={{ color: "#ef4444", fontSize: "14px", fontWeight: 800 }}>{money(tag.totalSpent * 100)}</strong>
                    </div>
                    <div style={{ background: "var(--background-alt)", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--muted)", fontSize: "10px", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Transactions</span>
                      <strong style={{ color: "var(--ink)", fontSize: "14px", fontWeight: 800 }}>{tag.transactionCount} rows</strong>
                    </div>
                  </div>

                  {hasBudget && (
                    <div style={{ marginTop: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                        <span style={{ color: isOver ? "#ef4444" : "var(--muted)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {isOver && <AlertCircle size={12} color="#ef4444" />}
                          {isOver ? "Trip Budget Exceeded" : "Trip Budget Limit"}
                        </span>
                        <span style={{ fontWeight: 700, color: "var(--ink)" }}>{money(tag.totalSpent * 100)} / {money(tag.budgetLimit! * 100)}</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "var(--line)", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ width: `${spentPct}%`, height: "100%", background: isOver ? "#ef4444" : tag.color, borderRadius: "6px" }} />
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: isInspected ? tag.color : "#3b82f6", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {isInspected ? "Inspecting Transactions" : "View Breakdown & Transactions"}
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tag Analytics Inspection Panel */}
      {inspectedTagId && tagAnalytics && (
        <section className="panel" style={{ padding: "24px", borderRadius: "14px", border: `2px solid ${tagAnalytics.tag.color}`, background: "var(--card)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: tagAnalytics.tag.color }} />
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--ink)" }}>
                  Transaction Breakdown for "{tagAnalytics.tag.name}"
                </h3>
                {tagAnalytics.tag.startDate && (
                  <small style={{ color: "var(--muted)", fontSize: "12px" }}>
                    Time Window: {tagAnalytics.tag.startDate.slice(0, 10)} to {tagAnalytics.tag.endDate ? tagAnalytics.tag.endDate.slice(0, 10) : "Present"}
                  </small>
                )}
              </div>
            </div>
            <button type="button" className="secondary compact" onClick={() => setInspectedTagId(null)} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <X size={14} />
              <span>Close Breakdown</span>
            </button>
          </div>

          {loadingTagAnalytics ? (
            <div className="loading"><span/><p>Loading breakdown for "{tagAnalytics.tag.name}"...</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Stat Summary Tiles */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div style={{ background: "var(--background-alt)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Total Outflow</span>
                  <strong style={{ color: "#ef4444", fontSize: "1.1rem", display: "block", marginTop: "2px" }}>{money(tagAnalytics.summary.totalSpent * 100)}</strong>
                </div>
                <div style={{ background: "var(--background-alt)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Total Inflow / Refunds</span>
                  <strong style={{ color: "#10b981", fontSize: "1.1rem", display: "block", marginTop: "2px" }}>{money(tagAnalytics.summary.totalReceived * 100)}</strong>
                </div>
                <div style={{ background: "var(--background-alt)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Net Outflow</span>
                  <strong style={{ color: "var(--ink)", fontSize: "1.1rem", display: "block", marginTop: "2px" }}>{money(tagAnalytics.summary.netTotal * 100)}</strong>
                </div>
                <div style={{ background: "var(--background-alt)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Transaction Count</span>
                  <strong style={{ color: "var(--ink)", fontSize: "1.1rem", display: "block", marginTop: "2px" }}>{tagAnalytics.summary.totalCount} rows</strong>
                </div>
              </div>

              {/* Category distribution badges */}
              {tagAnalytics.categories.length > 0 && (
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Category Distribution</span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {tagAnalytics.categories.map((c) => (
                      <span key={c.id} style={{ padding: "5px 12px", borderRadius: "8px", background: `${c.color}20`, color: c.color, fontSize: "12px", fontWeight: 700, border: `1px solid ${c.color}40` }}>
                        {c.name}: {money(c.amount * 100)} ({c.percentage}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                      <th style={{ padding: "10px 8px" }}>Date</th>
                      <th style={{ padding: "10px 8px" }}>Merchant / Description</th>
                      <th style={{ padding: "10px 8px" }}>Category</th>
                      <th style={{ padding: "10px 8px" }}>Account</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Amount</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", width: "50px" }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagAnalytics.transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "10px 8px", color: "var(--muted)" }}>{new Date(tx.transactionDate).toLocaleDateString("en-IN")}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 600 }}>{tx.merchant || tx.description}</td>
                        <td style={{ padding: "10px 8px" }}>
                          <span style={{ padding: "3px 8px", borderRadius: "6px", background: `${tx.categoryColor}20`, color: tx.categoryColor, fontWeight: 700, fontSize: "11px" }}>
                            {tx.category}
                          </span>
                        </td>
                        <td style={{ padding: "10px 8px", color: "var(--muted)" }}>{tx.accountName}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 800, fontSize: "13px", color: tx.amount < 0 ? "#ef4444" : "#10b981" }}>
                          {tx.amount < 0 ? `-${money(Math.abs(tx.amount * 100))}` : `+${money(Math.abs(tx.amount * 100))}`}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center" }}>
                          <button
                            type="button"
                            className="icon-button danger"
                            title="Remove tag from transaction"
                            onClick={() => handleRemoveTagFromTx(tx.id, tagAnalytics.tag.id)}>
                            <X size={14} />
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
