"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Tag as TagIcon,
  Plus,
  Trash2,
  Edit2,
  Pencil,
  Sparkles,
  Calendar,
  DollarSign,
  PieChart,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  TrendingDown,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Sliders,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { api, errorMessage, money } from "@/lib/api";

type TagItem = {
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

type TagAnalytics = {
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
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    institution: string | null;
    amount: number;
  }>;
  timeline: Array<{
    date: string;
    spent: number;
    received: number;
    count: number;
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

const COLOR_PRESETS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#64748b", // Slate
];

export default function TagsPage() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Selected Tag for Detailed Analytics Inspection
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<TagAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);

  // Form Inputs
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#3b82f6");
  const [tagDescription, setTagDescription] = useState("");
  const [tagStartDate, setTagStartDate] = useState("");
  const [tagEndDate, setTagEndDate] = useState("");
  const [tagBudgetLimit, setTagBudgetLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-Tag Modal States
  const [autoTagModalId, setAutoTagModalId] = useState<string | null>(null);
  const [autoStartDate, setAutoStartDate] = useState("");
  const [autoEndDate, setAutoEndDate] = useState("");
  const [autoKeywords, setAutoKeywords] = useState("");
  const [autoTagging, setAutoTagging] = useState(false);

  const loadTags = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api<TagItem[]>("/tags");
      setTags(res || []);
    } catch (err) {
      setError(errorMessage(err, "Could not load tags."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTagAnalytics = useCallback(async (tagId: string) => {
    try {
      setLoadingAnalytics(true);
      const res = await api<TagAnalytics>(`/tags/${tagId}/analytics`);
      setAnalytics(res);
    } catch (err) {
      setError(errorMessage(err, "Could not load tag analytics."));
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    if (selectedTagId) {
      loadTagAnalytics(selectedTagId);
    } else {
      setAnalytics(null);
    }
  }, [selectedTagId, loadTagAnalytics]);

  const handleOpenCreateModal = () => {
    setEditingTag(null);
    setTagName("");
    setTagColor("#3b82f6");
    setTagDescription("");
    setTagStartDate("");
    setTagEndDate("");
    setTagBudgetLimit("");
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (tag: TagItem) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setTagDescription(tag.description || "");
    setTagStartDate(tag.startDate ? tag.startDate.split("T")[0] : "");
    setTagEndDate(tag.endDate ? tag.endDate.split("T")[0] : "");
    setTagBudgetLimit(tag.budgetLimit ? String(tag.budgetLimit) : "");
    setCreateModalOpen(true);
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      setError("Please enter a tag or event name.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    const payload = {
      name: tagName.trim(),
      color: tagColor,
      description: tagDescription.trim() || null,
      startDate: tagStartDate || null,
      endDate: tagEndDate || null,
      budgetLimit: tagBudgetLimit ? parseFloat(tagBudgetLimit) : null,
    };

    try {
      if (editingTag) {
        await api(`/tags/${editingTag.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccessMsg(`Updated tag "${payload.name}"!`);
      } else {
        await api("/tags", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccessMsg(`Created new tag "#${payload.name}"!`);
      }

      setCreateModalOpen(false);
      loadTags();
      if (selectedTagId && editingTag && selectedTagId === editingTag.id) {
        loadTagAnalytics(selectedTagId);
      }
    } catch (err) {
      setError(errorMessage(err, "Could not save tag."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete tag "#${name}"? Transactions will remain but untagged.`)) return;
    try {
      setError("");
      await api(`/tags/${id}`, { method: "DELETE" });
      setSuccessMsg(`Deleted tag "#${name}".`);
      if (selectedTagId === id) setSelectedTagId(null);
      loadTags();
    } catch (err) {
      setError(errorMessage(err, "Could not delete tag."));
    }
  };

  const handleUntagTransaction = async (txId: string) => {
    if (!selectedTagId) return;
    try {
      await api("/tags/assign", {
        method: "POST",
        body: JSON.stringify({
          transactionIds: [txId],
          tagIds: [selectedTagId],
          action: "REMOVE",
        }),
      });
      loadTagAnalytics(selectedTagId);
      loadTags();
    } catch (err) {
      setError(errorMessage(err, "Failed to remove tag from transaction."));
    }
  };

  const handleOpenAutoTagModal = (tag: TagItem) => {
    setAutoTagModalId(tag.id);
    setAutoStartDate(tag.startDate ? tag.startDate.split("T")[0] : "");
    setAutoEndDate(tag.endDate ? tag.endDate.split("T")[0] : "");
    setAutoKeywords("");
  };

  const handleRunAutoTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoTagModalId) return;
    setAutoTagging(true);
    setError("");
    setSuccessMsg("");

    const keywordsArray = autoKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      const res = await api<{ matchedCount: number; newlyTaggedCount: number }>(`/tags/${autoTagModalId}/auto-apply`, {
        method: "POST",
        body: JSON.stringify({
          startDate: autoStartDate || null,
          endDate: autoEndDate || null,
          keywords: keywordsArray.length > 0 ? keywordsArray : null,
        }),
      });

      setSuccessMsg(`Auto-tagged ${res.newlyTaggedCount} transaction${res.newlyTaggedCount === 1 ? "" : "s"}! (${res.matchedCount} matched)`);
      setAutoTagModalId(null);
      loadTags();
      if (selectedTagId === autoTagModalId) loadTagAnalytics(selectedTagId);
    } catch (err) {
      setError(errorMessage(err, "Failed to auto-apply tag."));
    } finally {
      setAutoTagging(false);
    }
  };

  const totalAllTagsSpent = tags.reduce((sum, t) => sum + t.totalSpent, 0);

  if (loading && tags.length === 0) {
    return (
      <Shell>
        <div className="panel" style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          <Loader2 className="spin" size={28} style={{ margin: "0 auto 12px auto", display: "block", color: "var(--green)" }} />
          <span>Loading Tags & Trips Dashboard...</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header Action Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)", fontWeight: 700 }}>Event & Trip Tracker</span>
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Transaction Tags & Trips</h1>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="secondary compact"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700, padding: "8px 16px", borderRadius: "10px" }}
          >
            <Plus size={16} />
            <span>Create New Tag / Trip</span>
          </button>
        </div>

        {/* Global Error & Success Alerts */}
        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {successMsg && (
          <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {/* KPI Overview Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Active Tags / Events</span>
            <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{tags.length}</strong>
            <small style={{ color: "var(--muted)", fontSize: "11px" }}>Created event trackers</small>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Total Tagged Spending</span>
            <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "#ef4444", marginTop: "4px" }}>{money(totalAllTagsSpent * 100)}</strong>
            <small style={{ color: "var(--muted)", fontSize: "11px" }}>Sum across all tags</small>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Top Event by Spend</span>
            <strong style={{ display: "block", fontSize: "1.2rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tags.length > 0 ? tags.reduce((max, t) => (t.totalSpent > max.totalSpent ? t : max), tags[0]).name : "None"}
            </strong>
            <small style={{ color: "var(--muted)", fontSize: "11px" }}>Highest volume tag</small>
          </div>
        </div>

        {/* Main Grid: Tags Cards (Left) + Detail Analytics Inspector (Right) */}
        <div style={{ display: "grid", gridTemplateColumns: selectedTagId ? "1fr 1.2fr" : "1fr", gap: "20px", alignItems: "start" }}>
          {/* Tags Cards Grid */}
          <section className="panel" style={{ padding: "20px" }}>
            <div className="panel-title" style={{ marginBottom: "16px" }}>
              <div>
                <span className="eyebrow" style={{ color: "var(--green)" }}>Event Registry</span>
                <h2>All Tags & Trips ({tags.length})</h2>
              </div>
            </div>

            {tags.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", background: "var(--background-alt)", borderRadius: "12px", border: "1px dashed var(--line)", color: "var(--muted)" }}>
                <TagIcon size={32} style={{ margin: "0 auto 12px auto", opacity: 0.5, display: "block" }} />
                <strong style={{ display: "block", fontSize: "14px", color: "var(--ink)", marginBottom: "4px" }}>No tags or trips created yet</strong>
                <span style={{ fontSize: "12px" }}>Create your first tag like "#TripToKerala" or "#DiwaliShopping" to group transactions across categories.</span>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: selectedTagId ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                {tags.map((tag) => {
                  const isSelected = selectedTagId === tag.id;
                  const hasBudget = tag.budgetLimit && tag.budgetLimit > 0;
                  const budgetPercentage = hasBudget ? Math.min(100, Math.round((tag.totalSpent / tag.budgetLimit!) * 100)) : 0;
                  const budgetExceeded = hasBudget && tag.totalSpent > tag.budgetLimit!;

                  return (
                    <div
                      key={tag.id}
                      onClick={() => setSelectedTagId(isSelected ? null : tag.id)}
                      style={{
                        background: isSelected ? "var(--background-alt)" : "var(--card)",
                        border: `1.5px solid ${isSelected ? tag.color : "var(--line)"}`,
                        borderRadius: "14px",
                        padding: "16px",
                        cursor: "pointer",
                        transition: "all 0.15s ease-in-out",
                        boxShadow: isSelected ? `0 4px 20px ${tag.color}22` : "none",
                        position: "relative",
                      }}
                    >
                      {/* Tag Name Header & Color Pill */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
                          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--ink)" }}>#{tag.name}</h3>
                        </div>

                        <div style={{ display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenAutoTagModal(tag)}
                            className="ghost compact"
                            style={{ padding: "4px", color: "var(--green)" }}
                            title="Auto-tag by date range / keywords"
                          >
                            <Zap size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(tag)}
                            className="ghost compact"
                            style={{ padding: "4px", color: "var(--muted)" }}
                            title="Edit tag"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTag(tag.id, tag.name)}
                            className="ghost compact"
                            style={{ padding: "4px", color: "#ef4444" }}
                            title="Delete tag"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Description & Date Range */}
                      {tag.description && (
                        <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {tag.description}
                        </p>
                      )}

                      {(tag.startDate || tag.endDate) && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--muted)", background: "var(--background-alt)", padding: "3px 8px", borderRadius: "6px", marginBottom: "12px", border: "1px solid var(--line)" }}>
                          <Calendar size={12} />
                          <span>
                            {tag.startDate ? new Date(tag.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Start"}
                            {" – "}
                            {tag.endDate ? new Date(tag.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Ongoing"}
                          </span>
                        </div>
                      )}

                      {/* Total Spent Amount */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Total Spend</span>
                        <strong style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ef4444" }}>{money(tag.totalSpent * 100)}</strong>
                      </div>

                      {/* Budget Progress Bar */}
                      {hasBudget && (
                        <div style={{ marginTop: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>
                            <span>Budget: {money(tag.budgetLimit! * 100)}</span>
                            <span style={{ fontWeight: 700, color: budgetExceeded ? "#ef4444" : "var(--ink)" }}>{budgetPercentage}%</span>
                          </div>
                          <div style={{ height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${budgetPercentage}%`, height: "100%", background: budgetExceeded ? "#ef4444" : tag.color, borderRadius: "3px" }} />
                          </div>
                        </div>
                      )}

                      {/* Bottom Footer Details */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--line)", fontSize: "11px", color: "var(--muted)" }}>
                        <span>{tag.transactionCount} transaction{tag.transactionCount === 1 ? "" : "s"}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 700, color: isSelected ? tag.color : "var(--muted)" }}>
                          {isSelected ? "Inspecting" : "View Breakdown"} <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Tag Detail Inspector Drawer (Right Panel) */}
          {selectedTagId && (
            <section className="panel" style={{ padding: "20px", position: "sticky", top: "20px" }}>
              {loadingAnalytics ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                  <Loader2 className="spin" size={24} style={{ margin: "0 auto 10px auto", display: "block" }} />
                  <span>Loading event analytics...</span>
                </div>
              ) : analytics ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 800, padding: "3px 10px", borderRadius: "12px", background: `${analytics.tag.color}20`, color: analytics.tag.color, marginBottom: "6px" }}>
                        #{analytics.tag.name}
                      </span>
                      <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>Event Analytics</h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedTagId(null)}
                      className="ghost compact"
                      style={{ padding: "6px" }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Summary Bar */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "var(--background-alt)", padding: "14px", borderRadius: "12px", border: "1px solid var(--line)" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Spent</span>
                      <strong style={{ display: "block", fontSize: "1.25rem", color: "#ef4444", fontWeight: 800 }}>{money(analytics.summary.totalSpent * 100)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Transactions</span>
                      <strong style={{ display: "block", fontSize: "1.25rem", color: "var(--ink)", fontWeight: 800 }}>{analytics.summary.totalCount}</strong>
                    </div>
                  </div>

                  {/* Category Breakdown Progress Bars */}
                  <div>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                      <PieChart size={16} color="var(--green)" /> Spending Breakdown by Category
                    </h3>

                    {analytics.categories.length === 0 ? (
                      <small style={{ color: "var(--muted)" }}>No expense categories recorded for this tag yet.</small>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {analytics.categories.map((cat) => (
                          <div key={cat.id}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cat.color }} />
                                {cat.name}
                              </span>
                              <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                                {money(cat.amount * 100)} <small style={{ color: "var(--muted)", fontWeight: 500 }}>({cat.percentage}%)</small>
                              </span>
                            </div>
                            <div style={{ height: "6px", background: "var(--background-alt)", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${cat.percentage}%`, height: "100%", background: cat.color, borderRadius: "3px" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Account Breakdown */}
                  <div>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Layers size={16} color="var(--green)" /> Payment Methods Used
                    </h3>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {analytics.accounts.map((acc) => (
                        <div key={acc.id} style={{ background: "var(--background-alt)", border: "1px solid var(--line)", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, color: "var(--ink)" }}>{acc.name}</span>
                          <span style={{ color: "#ef4444", fontWeight: 700 }}>{money(acc.amount * 100)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Attached Transactions Ledger */}
                  <div>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                      <TagIcon size={16} color="var(--green)" /> Tagged Transactions ({analytics.transactions.length})
                    </h3>

                    {analytics.transactions.length === 0 ? (
                      <small style={{ color: "var(--muted)" }}>No transactions tagged yet.</small>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto", paddingRight: "4px" }}>
                        {analytics.transactions.map((tx) => (
                          <div
                            key={tx.id}
                            style={{
                              background: "var(--background-alt)",
                              border: "1px solid var(--line)",
                              borderRadius: "10px",
                              padding: "10px 12px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <div style={{ overflow: "hidden" }}>
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {tx.merchant || tx.description}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: `${tx.categoryColor}20`, color: tx.categoryColor, fontWeight: 700 }}>
                                  {tx.category}
                                </span>
                                <small style={{ fontSize: "10px", color: "var(--muted)" }}>
                                  {new Date(tx.transactionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </small>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <strong style={{ fontSize: "13px", fontWeight: 700, color: tx.amount < 0 ? "#ef4444" : "#22c55e" }}>
                                {money(tx.amount * 100)}
                              </strong>

                              <button
                                type="button"
                                onClick={() => handleUntagTransaction(tx.id)}
                                className="ghost compact"
                                style={{ color: "var(--muted)", padding: "2px" }}
                                title="Remove tag from transaction"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          )}
        </div>

        {/* Create / Edit Tag Modal */}
        {createModalOpen && (
          <div className="modal-wrap" style={{ zIndex: 99999 }}>
            <button className="backdrop" onClick={() => setCreateModalOpen(false)} aria-label="Close modal" />
            <section className="modal" style={{ width: "min(460px, 90vw)", padding: "20px", borderRadius: "14px", background: "var(--card)", border: "1px solid var(--line)" }}>
              <h3 style={{ margin: "0 0 14px 0", fontSize: "1.15rem", fontWeight: 700 }}>
                {editingTag ? `Edit Tag "#${editingTag.name}"` : "Create New Tag / Trip Tracker"}
              </h3>

              <form onSubmit={handleSaveTag} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Tag / Trip Name</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "10px", top: "9px", fontSize: "14px", fontWeight: 800, color: tagColor }}>#</span>
                    <input
                      type="text"
                      placeholder="e.g. TripToKerala, Diwali2026, HomeRenovation..."
                      value={tagName}
                      onChange={(e) => setTagName(e.target.value)}
                      style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px 0 26px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>Badge Color</label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    {COLOR_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setTagColor(hex)}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: hex,
                          border: tagColor === hex ? "3px solid var(--ink)" : "2px solid transparent",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={tagColor}
                      onChange={(e) => setTagColor(e.target.value)}
                      style={{ width: "32px", height: "32px", padding: "2px", borderRadius: "8px", border: "1px solid var(--line)", cursor: "pointer" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Description / Notes (Optional)</label>
                  <textarea
                    placeholder="e.g. Family vacation expenses across Kochi, Munnar & Alleppey..."
                    value={tagDescription}
                    onChange={(e) => setTagDescription(e.target.value)}
                    rows={2}
                    style={{ width: "100%", fontSize: "13px", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", resize: "none" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Start Date</label>
                    <input
                      type="date"
                      value={tagStartDate}
                      onChange={(e) => setTagStartDate(e.target.value)}
                      style={{ width: "100%", height: "36px", fontSize: "12px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>End Date</label>
                    <input
                      type="date"
                      value={tagEndDate}
                      onChange={(e) => setTagEndDate(e.target.value)}
                      style={{ width: "100%", height: "36px", fontSize: "12px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Event Budget Cap (Optional ₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={tagBudgetLimit}
                    onChange={(e) => setTagBudgetLimit(e.target.value)}
                    style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                  <button type="button" className="ghost compact" onClick={() => setCreateModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="secondary compact" style={{ background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700 }}>
                    {submitting ? <Loader2 size={14} className="spin" /> : editingTag ? "Save Changes" : "Create Tag"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* Auto-Tag Trigger Modal */}
        {autoTagModalId && (
          <div className="modal-wrap" style={{ zIndex: 99999 }}>
            <button className="backdrop" onClick={() => setAutoTagModalId(null)} aria-label="Close auto-tag modal" />
            <section className="modal" style={{ width: "min(420px, 90vw)", padding: "20px", borderRadius: "14px", background: "var(--card)", border: "1px solid var(--line)" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                <Zap size={18} color="var(--green)" /> Auto-Apply Tag Rules
              </h3>
              <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "var(--muted)" }}>
                Automatically tag past transactions matching date bounds or description keywords.
              </p>

              <form onSubmit={handleRunAutoTag} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Start Date</label>
                    <input
                      type="date"
                      value={autoStartDate}
                      onChange={(e) => setAutoStartDate(e.target.value)}
                      style={{ width: "100%", height: "36px", fontSize: "12px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>End Date</label>
                    <input
                      type="date"
                      value={autoEndDate}
                      onChange={(e) => setAutoEndDate(e.target.value)}
                      style={{ width: "100%", height: "36px", fontSize: "12px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Keywords (Comma Separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Kerala, Kochi, Munnar, Flight..."
                    value={autoKeywords}
                    onChange={(e) => setAutoKeywords(e.target.value)}
                    style={{ width: "100%", height: "36px", fontSize: "12px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
                  <button type="button" className="ghost compact" onClick={() => setAutoTagModalId(null)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={autoTagging} className="secondary compact" style={{ background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700 }}>
                    {autoTagging ? <Loader2 size={14} className="spin" /> : "Run Auto-Tag"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </Shell>
  );
}
