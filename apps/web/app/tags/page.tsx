"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  Target,
  SlidersHorizontal,
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

type CategoryOption = { id: string; name: string; type?: "EXPENSE" | "INCOME" | "INVESTMENT"; color: string };

type CategoryBudgetItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  monthlyLimit: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  status: "OK" | "WARNING" | "EXCEEDED";
};

type CategoryRuleItem = {
  id: string;
  pattern: string;
  matchField: "DESCRIPTION" | "MERCHANT" | "REFERENCE";
  matchType: "CONTAINS" | "EXACT" | "STARTS_WITH" | "REGEX";
  priority: number;
  category: { id: string; name: string; color: string };
};

type UnverifiedCategoryGroup = {
  category: { id: string; name: string; color: string };
  totalCount: number;
  unverifiedCount: number;
  transactions: Array<{
    id: string;
    transactionDate: string;
    descriptionRaw: string;
    merchant: string | null;
    amount: number;
    userVerified: boolean;
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
  return (
    <Suspense fallback={<Shell><div className="loading"><span/><p>Loading Tags & Budgets…</p></div></Shell>}>
      <TagsPageContent />
    </Suspense>
  );
}

function TagsPageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "category_budgets" ? "BUDGETS" : "TAGS";

  const [activeTab, setActiveTab] = useState<"TAGS" | "BUDGETS" | "UNVERIFIED">(initialTab);

  // TAGS STATE
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<TagAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [createTagModalOpen, setCreateTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#3b82f6");
  const [tagDescription, setTagDescription] = useState("");
  const [tagStartDate, setTagStartDate] = useState("");
  const [tagEndDate, setTagEndDate] = useState("");
  const [tagBudgetLimit, setTagBudgetLimit] = useState("");
  const [submittingTag, setSubmittingTag] = useState(false);

  const [autoTagModalId, setAutoTagModalId] = useState<string | null>(null);
  const [autoStartDate, setAutoStartDate] = useState("");
  const [autoEndDate, setAutoEndDate] = useState("");
  const [autoKeywords, setAutoKeywords] = useState("");
  const [autoCategoryId, setAutoCategoryId] = useState("");
  const [autoTagging, setAutoTagging] = useState(false);

  // BUDGETS & CATEGORIES STATE
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudgetItem[]>([]);
  const [rules, setRules] = useState<CategoryRuleItem[]>([]);
  const [unverifiedGroups, setUnverifiedGroups] = useState<UnverifiedCategoryGroup[]>([]);
  const [loadingBudgets, setLoadingBudgets] = useState(false);

  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetMonthlyLimit, setBudgetMonthlyLimit] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const [rulePattern, setRulePattern] = useState("");
  const [ruleMatchField, setRuleMatchField] = useState<"DESCRIPTION" | "MERCHANT" | "REFERENCE">("DESCRIPTION");
  const [ruleMatchType, setRuleMatchType] = useState<"CONTAINS" | "EXACT" | "STARTS_WITH" | "REGEX">("CONTAINS");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [savingRule, setSavingRule] = useState(false);

  const [editingRule, setEditingRule] = useState<CategoryRuleItem | null>(null);
  const [editRulePattern, setEditRulePattern] = useState("");
  const [editRuleCategoryId, setEditRuleCategoryId] = useState("");

  const [selectedTxIds, setSelectedTxIds] = useState<Record<string, boolean>>({});
  const [batchTargetCatId, setBatchTargetCatId] = useState("");
  const [batchProcessing, setBatchProcessing] = useState(false);

  // LOAD DATA
  const loadTagsData = useCallback(async () => {
    try {
      setLoadingTags(true);
      setError("");
      const [tagsRes, catRes] = await Promise.all([
        api<TagItem[]>("/tags"),
        api<CategoryOption[]>("/categories").catch(() => []),
      ]);
      setTags(tagsRes || []);
      setAllCategories(catRes || []);
    } catch (err) {
      setError(errorMessage(err, "Could not load tags."));
    } finally {
      setLoadingTags(false);
    }
  }, []);

  const loadBudgetsData = useCallback(async () => {
    try {
      setLoadingBudgets(true);
      setError("");
      const [budgetsRes, rulesRes, unverifiedRes] = await Promise.all([
        api<CategoryBudgetItem[]>("/budgets").catch(() => []),
        api<CategoryRuleItem[]>("/category-rules").catch(() => []),
        api<UnverifiedCategoryGroup[]>("/category-rules/unverified").catch(() => []),
      ]);
      setBudgets(budgetsRes || []);
      setRules(rulesRes || []);
      setUnverifiedGroups(unverifiedRes || []);
    } catch (err) {
      setError(errorMessage(err, "Could not load budget management data."));
    } finally {
      setLoadingBudgets(false);
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
    loadTagsData();
    loadBudgetsData();
  }, [loadTagsData, loadBudgetsData]);

  useEffect(() => {
    if (selectedTagId) {
      loadTagAnalytics(selectedTagId);
    } else {
      setAnalytics(null);
    }
  }, [selectedTagId, loadTagAnalytics]);

  // TAG HANDLERS
  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;
    try {
      setSubmittingTag(true);
      setError("");
      const payload = {
        name: tagName.trim(),
        color: tagColor,
        description: tagDescription.trim() || null,
        startDate: tagStartDate ? new Date(tagStartDate).toISOString() : null,
        endDate: tagEndDate ? new Date(tagEndDate).toISOString() : null,
        budgetLimit: tagBudgetLimit ? parseFloat(tagBudgetLimit) : null,
      };

      if (editingTag) {
        await api(`/tags/${editingTag.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setSuccessMsg(`Tag "${tagName}" updated.`);
      } else {
        await api("/tags", { method: "POST", body: JSON.stringify(payload) });
        setSuccessMsg(`Tag "${tagName}" created.`);
      }
      setCreateTagModalOpen(false);
      loadTagsData();
      if (selectedTagId === editingTag?.id) {
        loadTagAnalytics(selectedTagId);
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to save tag."));
    } finally {
      setSubmittingTag(false);
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the tag "${name}"? Transactions will remain but won't have this tag.`)) return;
    try {
      await api(`/tags/${id}`, { method: "DELETE" });
      if (selectedTagId === id) setSelectedTagId(null);
      setSuccessMsg(`Tag "${name}" removed.`);
      loadTagsData();
    } catch (err) {
      setError(errorMessage(err, "Could not delete tag."));
    }
  };

  const handleAutoApplyTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoTagModalId) return;
    try {
      setAutoTagging(true);
      setError("");
      const res = await api<{ matchedCount: number; assignedCount: number }>(`/tags/${autoTagModalId}/auto-apply`, {
        method: "POST",
        body: JSON.stringify({
          startDate: autoStartDate ? new Date(autoStartDate).toISOString() : undefined,
          endDate: autoEndDate ? new Date(autoEndDate).toISOString() : undefined,
          keywords: autoKeywords.trim() || undefined,
          categoryId: autoCategoryId || undefined,
        }),
      });
      setSuccessMsg(`Auto-applied tag to ${res.assignedCount} matching transactions!`);
      setAutoTagModalId(null);
      loadTagsData();
      if (selectedTagId === autoTagModalId) {
        loadTagAnalytics(autoTagModalId);
      }
    } catch (err) {
      setError(errorMessage(err, "Auto-tagging failed."));
    } finally {
      setAutoTagging(false);
    }
  };

  // BUDGET HANDLERS
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetCategoryId || !budgetMonthlyLimit) return;
    try {
      setSavingBudget(true);
      setError("");
      await api("/budgets", {
        method: "POST",
        body: JSON.stringify({
          categoryId: budgetCategoryId,
          monthlyLimit: parseFloat(budgetMonthlyLimit),
        }),
      });
      setSuccessMsg("Category budget limit updated.");
      setBudgetCategoryId("");
      setBudgetMonthlyLimit("");
      loadBudgetsData();
    } catch (err) {
      setError(errorMessage(err, "Failed to set budget limit."));
    } finally {
      setSavingBudget(false);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      await api(`/budgets/${budgetId}`, { method: "DELETE" });
      setSuccessMsg("Budget limit removed.");
      loadBudgetsData();
    } catch (err) {
      setError(errorMessage(err, "Could not delete budget."));
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulePattern.trim() || !ruleCategoryId) return;
    try {
      setSavingRule(true);
      setError("");
      await api("/category-rules", {
        method: "POST",
        body: JSON.stringify({
          pattern: rulePattern.trim(),
          matchField: ruleMatchField,
          matchType: ruleMatchType,
          categoryId: ruleCategoryId,
        }),
      });
      setSuccessMsg("Category auto-rule created.");
      setRulePattern("");
      setRuleCategoryId("");
      loadBudgetsData();
    } catch (err) {
      setError(errorMessage(err, "Failed to create rule."));
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api(`/category-rules/${id}`, { method: "DELETE" });
      setSuccessMsg("Rule deleted.");
      loadBudgetsData();
    } catch (err) {
      setError(errorMessage(err, "Could not delete rule."));
    }
  };

  const handleVerifyBatch = async (transactionIds: string[], verified: boolean, targetCatId?: string) => {
    try {
      setBatchProcessing(true);
      setError("");
      await api("/category-rules/batch-update", {
        method: "POST",
        body: JSON.stringify({
          transactionIds,
          userVerified: verified,
          categoryId: targetCatId || undefined,
        }),
      });
      setSuccessMsg(`Updated ${transactionIds.length} transactions.`);
      setSelectedTxIds({});
      loadBudgetsData();
    } catch (err) {
      setError(errorMessage(err, "Batch verification failed."));
    } finally {
      setBatchProcessing(false);
    }
  };

  return (
    <Shell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Financial Categorization & Tracking</span>
          <h1>Tags, Trips & Budget Management</h1>
          <p>Organize transactions with custom tags, track vacation/trip budgets, and set category monthly spending limits.</p>
        </div>
      </header>

      {/* Primary Sub-Tab Selector */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "24px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
        <button
          type="button"
          className={`secondary ${activeTab === "TAGS" ? "active" : ""}`}
          onClick={() => setActiveTab("TAGS")}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontWeight: 700 }}>
          <TagIcon size={18} color="#3b82f6" />
          <span>Custom Tags & Trip Budgets</span>
          <span style={{ background: "#3b82f6", color: "#fff", fontSize: "11px", padding: "1px 7px", borderRadius: "10px", fontWeight: 800 }}>
            {tags.length}
          </span>
        </button>

        <button
          type="button"
          className={`secondary ${activeTab === "BUDGETS" ? "active" : ""}`}
          onClick={() => setActiveTab("BUDGETS")}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontWeight: 700 }}>
          <Target size={18} color="#10b981" />
          <span>Category Budgets & Auto-Rules</span>
          <span style={{ background: "var(--card-hover)", color: "var(--ink)", fontSize: "11px", padding: "1px 7px", borderRadius: "10px", fontWeight: 800 }}>
            {budgets.length}
          </span>
        </button>

        <button
          type="button"
          className={`secondary ${activeTab === "UNVERIFIED" ? "active" : ""}`}
          onClick={() => setActiveTab("UNVERIFIED")}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontWeight: 700 }}>
          <Zap size={18} color="#f59e0b" />
          <span>Rule Verification Queue</span>
          {unverifiedGroups.reduce((acc, g) => acc + g.unverifiedCount, 0) > 0 && (
            <span style={{ background: "#f59e0b", color: "#fff", fontSize: "11px", padding: "1px 7px", borderRadius: "10px", fontWeight: 800 }}>
              {unverifiedGroups.reduce((acc, g) => acc + g.unverifiedCount, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Global Alerts */}
      {error && <div className="error-banner" style={{ marginBottom: "16px" }}><AlertCircle size={16}/><span>{error}</span></div>}
      {successMsg && <div className="notice-banner" style={{ marginBottom: "16px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "12px 16px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.2)" }}><CheckCircle2 size={16}/><span>{successMsg}</span></div>}

      {/* TAB 1: TAGS & TRIPS */}
      {activeTab === "TAGS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Header Action Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)" }}>All Active Tags & Trip Budgets</h3>
            <button
              type="button"
              className="primary"
              onClick={() => { setEditingTag(null); setTagName(""); setTagColor("#3b82f6"); setTagDescription(""); setTagStartDate(""); setTagEndDate(""); setTagBudgetLimit(""); setCreateTagModalOpen(true); }}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <Plus size={16} />
              <span>Create New Tag / Trip</span>
            </button>
          </div>

          {loadingTags ? (
            <div className="loading"><span/><p>Loading tags and trip budgets...</p></div>
          ) : tags.length === 0 ? (
            <div className="panel empty-state" style={{ padding: "40px", textAlign: "center" }}>
              <TagIcon size={40} style={{ color: "var(--muted)", marginBottom: "12px" }} />
              <h4>No Tags Created Yet</h4>
              <p style={{ color: "var(--muted)", fontSize: "13px", maxWidth: "420px", margin: "0 auto 20px auto" }}>
                Tags let you group transactions across accounts for special events, vacations (Trips), projects, or tax deduction tracking.
              </p>
              <button
                type="button"
                className="primary"
                onClick={() => setCreateTagModalOpen(true)}>
                Create Your First Tag
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {tags.map((tag) => {
                const isSelected = selectedTagId === tag.id;
                const hasBudget = tag.budgetLimit !== null && tag.budgetLimit > 0;
                const spentPercentage = hasBudget ? Math.min(100, Math.round((tag.totalSpent / tag.budgetLimit!) * 100)) : 0;
                const isOverBudget = hasBudget && tag.totalSpent > tag.budgetLimit!;

                return (
                  <div
                    key={tag.id}
                    className={`panel ${isSelected ? "selected-card" : ""}`}
                    style={{
                      padding: "20px",
                      borderRadius: "14px",
                      border: isSelected ? `2px solid ${tag.color}` : "1px solid var(--line)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      background: isSelected ? `${tag.color}08` : "var(--card)",
                    }}
                    onClick={() => setSelectedTagId(isSelected ? null : tag.id)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: tag.color, display: "inline-block" }} />
                        <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>{tag.name}</h4>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="icon-button"
                          title="Auto-Apply Tag"
                          onClick={() => { setAutoTagModalId(tag.id); setAutoStartDate(tag.startDate ? tag.startDate.split("T")[0] : ""); setAutoEndDate(tag.endDate ? tag.endDate.split("T")[0] : ""); setAutoKeywords(tag.name); }}>
                          <Sparkles size={14} color="var(--primary)" />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Edit Tag"
                          onClick={() => { setEditingTag(tag); setTagName(tag.name); setTagColor(tag.color); setTagDescription(tag.description || ""); setTagStartDate(tag.startDate ? tag.startDate.split("T")[0] : ""); setTagEndDate(tag.endDate ? tag.endDate.split("T")[0] : ""); setTagBudgetLimit(tag.budgetLimit ? String(tag.budgetLimit) : ""); setCreateTagModalOpen(true); }}>
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

                    {tag.description && <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 12px 0" }}>{tag.description}</p>}

                    {(tag.startDate || tag.endDate) && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted)", marginBottom: "12px", background: "var(--background-alt)", padding: "4px 8px", borderRadius: "6px" }}>
                        <Calendar size={12} />
                        <span>
                          {tag.startDate ? new Date(tag.startDate).toLocaleDateString("en-IN") : "Start"} — {tag.endDate ? new Date(tag.endDate).toLocaleDateString("en-IN") : "Present"}
                        </span>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", marginBottom: "12px" }}>
                      <div style={{ background: "var(--background-alt)", padding: "8px 10px", borderRadius: "8px" }}>
                        <span style={{ color: "var(--muted)", fontSize: "10px", display: "block" }}>Total Outflow</span>
                        <strong style={{ color: "#ef4444", fontSize: "13px" }}>{money(tag.totalSpent * 100)}</strong>
                      </div>
                      <div style={{ background: "var(--background-alt)", padding: "8px 10px", borderRadius: "8px" }}>
                        <span style={{ color: "var(--muted)", fontSize: "10px", display: "block" }}>Tagged Count</span>
                        <strong style={{ color: "var(--ink)", fontSize: "13px" }}>{tag.transactionCount} transactions</strong>
                      </div>
                    </div>

                    {/* Budget Progress Bar */}
                    {hasBudget && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                          <span style={{ color: isOverBudget ? "#ef4444" : "var(--muted)", fontWeight: 600 }}>
                            {isOverBudget ? "⚠️ Budget Exceeded" : "Trip / Tag Budget"}
                          </span>
                          <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                            {money(tag.totalSpent * 100)} / {money(tag.budgetLimit! * 100)}
                          </span>
                        </div>
                        <div style={{ width: "100%", height: "6px", background: "var(--line)", borderRadius: "10px", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${spentPercentage}%`,
                              height: "100%",
                              background: isOverBudget ? "#ef4444" : spentPercentage > 85 ? "#f59e0b" : tag.color,
                              borderRadius: "10px",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected Tag Analytics View */}
          {selectedTagId && analytics && (
            <div className="panel" style={{ padding: "24px", marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: analytics.tag.color }} />
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)" }}>
                    Analytics & Breakdown for "{analytics.tag.name}"
                  </h3>
                </div>
                <button type="button" className="secondary compact" onClick={() => setSelectedTagId(null)}>
                  Close Inspection
                </button>
              </div>

              {loadingAnalytics ? (
                <div className="loading"><span/><p>Loading analytics...</p></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Category Distribution */}
                  {analytics.categories.length > 0 && (
                    <div>
                      <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>Category Breakdown</h4>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {analytics.categories.map((c) => (
                          <span key={c.id} style={{ padding: "6px 12px", borderRadius: "8px", background: `${c.color}20`, color: c.color, fontSize: "12px", fontWeight: 700 }}>
                            {c.name}: {money(c.amount * 100)} ({c.percentage}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transactions Table */}
                  <div>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>
                      Tagged Transactions ({analytics.transactions.length})
                    </h4>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                            <th style={{ padding: "8px" }}>Date</th>
                            <th style={{ padding: "8px" }}>Description</th>
                            <th style={{ padding: "8px" }}>Category</th>
                            <th style={{ padding: "8px" }}>Account</th>
                            <th style={{ padding: "8px", textAlign: "right" }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.transactions.map((tx) => (
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
                                {money(Math.abs(tx.amount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CATEGORY BUDGETS & RULES */}
      {activeTab === "BUDGETS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Top Form Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
            {/* Set Category Monthly Limit */}
            <div className="panel" style={{ padding: "20px" }}>
              <h4 style={{ margin: "0 0 6px 0", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>Set Category Monthly Limit</h4>
              <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "var(--muted)" }}>Set budget spending limits for specific expense categories.</p>
              <form onSubmit={handleSaveBudget} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Category</label>
                  <select
                    value={budgetCategoryId}
                    onChange={(e) => setBudgetCategoryId(e.target.value)}
                    required
                    style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 10px", background: "var(--background-alt)", color: "var(--ink)" }}>
                    <option value="">Select Category...</option>
                    {allCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Monthly Budget Limit (₹)</label>
                  <input
                    type="number"
                    value={budgetMonthlyLimit}
                    onChange={(e) => setBudgetMonthlyLimit(e.target.value)}
                    placeholder="e.g. 15000"
                    required
                    style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 10px", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>
                <button type="submit" className="primary" disabled={savingBudget} style={{ alignSelf: "flex-start", marginTop: "4px" }}>
                  {savingBudget ? "Saving..." : "Save Budget Limit"}
                </button>
              </form>
            </div>

            {/* Create Auto-Categorization Rule */}
            <div className="panel" style={{ padding: "20px" }}>
              <h4 style={{ margin: "0 0 6px 0", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>Create Auto-Categorization Rule</h4>
              <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "var(--muted)" }}>Automatically match merchant names or text patterns to categories.</p>
              <form onSubmit={handleCreateRule} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Pattern</label>
                    <input
                      type="text"
                      value={rulePattern}
                      onChange={(e) => setRulePattern(e.target.value)}
                      placeholder="e.g. SWIGGY or ZOMATO"
                      required
                      style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 10px", background: "var(--background-alt)", color: "var(--ink)" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Match</label>
                    <select
                      value={ruleMatchType}
                      onChange={(e) => setRuleMatchType(e.target.value as any)}
                      style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 6px", background: "var(--background-alt)", color: "var(--ink)" }}>
                      <option value="CONTAINS">Contains</option>
                      <option value="EXACT">Exact</option>
                      <option value="STARTS_WITH">Starts With</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Target Category</label>
                  <select
                    value={ruleCategoryId}
                    onChange={(e) => setRuleCategoryId(e.target.value)}
                    required
                    style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 10px", background: "var(--background-alt)", color: "var(--ink)" }}>
                    <option value="">Select Target Category...</option>
                    {allCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="primary" disabled={savingRule} style={{ alignSelf: "flex-start", marginTop: "4px" }}>
                  {savingRule ? "Creating Rule..." : "Create Category Rule"}
                </button>
              </form>
            </div>
          </div>

          {/* Active Category Budgets List */}
          <div className="panel" style={{ padding: "24px" }}>
            <h4 style={{ margin: "0 0 16px 0", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>Category Monthly Limits & Spending</h4>
            {loadingBudgets ? (
              <div className="loading"><span/><p>Loading budgets...</p></div>
            ) : budgets.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "13px" }}>No category budget limits set yet.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                {budgets.map((b) => (
                  <div key={b.id} style={{ background: "var(--background-alt)", padding: "16px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 700, color: b.categoryColor, fontSize: "13px" }}>{b.categoryName}</span>
                      <button type="button" className="icon-button danger" onClick={() => handleDeleteBudget(b.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                      <span style={{ color: "var(--muted)" }}>Spent / Limit</span>
                      <strong>{money(b.spentAmount * 100)} / {money(b.monthlyLimit * 100)}</strong>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "var(--line)", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, b.percentage)}%`, height: "100%", background: b.status === "EXCEEDED" ? "#ef4444" : b.status === "WARNING" ? "#f59e0b" : "#10b981", borderRadius: "6px" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: UNVERIFIED QUEUE */}
      {activeTab === "UNVERIFIED" && (
        <div className="panel" style={{ padding: "24px" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>Rule Verification & Batch Categorization</h4>
          <p style={{ margin: "0 0 20px 0", fontSize: "12px", color: "var(--muted)" }}>Review transactions auto-categorized by rules and confirm accuracy.</p>
          {unverifiedGroups.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "13px" }}>All transactions are verified! No pending auto-categorizations.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {unverifiedGroups.map((group) => (
                <div key={group.category.id} style={{ background: "var(--background-alt)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontWeight: 700, color: group.category.color, fontSize: "14px" }}>
                      {group.category.name} ({group.unverifiedCount} unverified)
                    </span>
                    <button
                      type="button"
                      className="primary compact"
                      onClick={() => handleVerifyBatch(group.transactions.map((t) => t.id), true)}>
                      Confirm All in {group.category.name}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {group.transactions.map((tx) => (
                      <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                        <span>{new Date(tx.transactionDate).toLocaleDateString("en-IN")} — <strong>{tx.merchant || tx.descriptionRaw}</strong></span>
                        <strong style={{ color: tx.amount < 0 ? "#ef4444" : "#10b981" }}>{money(Math.abs(tx.amount))}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT TAG MODAL */}
      {createTagModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateTagModalOpen(false)}>
          <div className="modal-content panel" style={{ maxWidth: "480px", width: "100%", padding: "24px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{editingTag ? "Edit Tag / Trip" : "Create New Tag or Trip"}</h3>
              <button type="button" className="icon-button" onClick={() => setCreateTagModalOpen(false)}><X size={18}/></button>
            </div>
            <form onSubmit={handleSaveTag} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Tag / Trip Name</label>
                <input
                  type="text"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g. Goa Trip 2026 or Medical Expenses"
                  required
                  style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 10px", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Color Badge</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTagColor(c)}
                      style={{ width: "26px", height: "26px", borderRadius: "50%", background: c, border: tagColor === c ? "2px solid var(--ink)" : "none", cursor: "pointer" }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Description (Optional)</label>
                <input
                  type="text"
                  value={tagDescription}
                  onChange={(e) => setTagDescription(e.target.value)}
                  placeholder="e.g. Summer vacation flights, hotels & dining"
                  style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 10px", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Start Date</label>
                  <input
                    type="date"
                    value={tagStartDate}
                    onChange={(e) => setTagStartDate(e.target.value)}
                    style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 8px", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>End Date</label>
                  <input
                    type="date"
                    value={tagEndDate}
                    onChange={(e) => setTagEndDate(e.target.value)}
                    style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 8px", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Trip Budget Limit (₹, Optional)</label>
                <input
                  type="number"
                  value={tagBudgetLimit}
                  onChange={(e) => setTagBudgetLimit(e.target.value)}
                  placeholder="e.g. 50000"
                  style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 10px", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" className="secondary" onClick={() => setCreateTagModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary" disabled={submittingTag}>
                  {submittingTag ? "Saving..." : editingTag ? "Update Tag" : "Create Tag"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUTO TAG MODAL */}
      {autoTagModalId && (
        <div className="modal-backdrop" onClick={() => setAutoTagModalId(null)}>
          <div className="modal-content panel" style={{ maxWidth: "440px", width: "100%", padding: "24px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Auto-Apply Tag to Past Transactions</h3>
              <button type="button" className="icon-button" onClick={() => setAutoTagModalId(null)}><X size={18}/></button>
            </div>
            <form onSubmit={handleAutoApplyTag} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Keywords (Comma-separated)</label>
                <input
                  type="text"
                  value={autoKeywords}
                  onChange={(e) => setAutoKeywords(e.target.value)}
                  placeholder="e.g. Zomato, Swiggy, Uber"
                  style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 10px", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>From Date</label>
                  <input
                    type="date"
                    value={autoStartDate}
                    onChange={(e) => setAutoStartDate(e.target.value)}
                    style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 8px", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>To Date</label>
                  <input
                    type="date"
                    value={autoEndDate}
                    onChange={(e) => setAutoEndDate(e.target.value)}
                    style={{ width: "100%", height: "36px", borderRadius: "6px", border: "1px solid var(--line)", padding: "0 8px", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" className="secondary" onClick={() => setAutoTagModalId(null)}>Cancel</button>
                <button type="submit" className="primary" disabled={autoTagging}>
                  {autoTagging ? "Applying Tag..." : "Apply Tag Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
