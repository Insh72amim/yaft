"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Target,
  Plus,
  Trash2,
  Edit2,
  Pencil,
  SlidersHorizontal,
  Tag as TagIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  TrendingDown,
  Sparkles,
  PieChart,
  Calendar,
  X,
  Filter,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { api, errorMessage, money } from "@/lib/api";

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

export default function BudgetsPage() {
  return (
    <Suspense fallback={<Shell><div className="loading"><span/><p>Loading Budgets & Tags Workspace…</p></div></Shell>}>
      <BudgetsContent />
    </Suspense>
  );
}

function BudgetsContent() {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get("tab");
  const initialTab = (initialTabParam === "tags" || initialTabParam === "TAGS") ? "TAGS" : "ENVELOPES";

  const [activeTab, setActiveTab] = useState<"ENVELOPES" | "TAGS" | "CATEGORIES" | "RULES" | "CONFIRMATIONS">(initialTab);

  // Main Data States
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudgetItem[]>([]);
  const [rules, setRules] = useState<CategoryRuleItem[]>([]);
  const [unverifiedCategories, setUnverifiedCategories] = useState<UnverifiedCategoryGroup[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [summary, setSummary] = useState({ totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, overallPercentage: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Tag Analytics Inspection
  const [inspectedTagId, setInspectedTagId] = useState<string | null>(null);
  const [tagAnalytics, setTagAnalytics] = useState<TagAnalytics | null>(null);
  const [loadingTagAnalytics, setLoadingTagAnalytics] = useState(false);

  // Tag Modal State
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#3b82f6");
  const [tagDesc, setTagDesc] = useState("");
  const [tagStart, setTagStart] = useState("");
  const [tagEnd, setTagEnd] = useState("");
  const [tagBudget, setTagBudget] = useState("");
  const [savingTag, setSavingTag] = useState(false);

  // Auto-Tagging Form State
  const [selectedTagForAuto, setSelectedTagForAuto] = useState("");
  const [autoTagStart, setAutoTagStart] = useState("");
  const [autoTagEnd, setAutoTagEnd] = useState("");
  const [autoTagKeywords, setAutoTagKeywords] = useState("");
  const [autoTagCatId, setAutoTagCatId] = useState("");
  const [applyingAutoTag, setApplyingAutoTag] = useState(false);

  // Category Filter States
  const [manageCatFilter, setManageCatFilter] = useState<"ALL" | "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER">("ALL");
  const [directoryCatFilter, setDirectoryCatFilter] = useState<"ALL" | "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER">("ALL");

  // Envelope Form States
  const [selectedCatId, setSelectedCatId] = useState("");
  const [limitInput, setLimitInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  // Category Management States
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"EXPENSE" | "INCOME" | "INVESTMENT">("EXPENSE");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");
  const [creatingCat, setCreatingCat] = useState(false);

  // Edit Category Modal States
  const [editingCategory, setEditingCategory] = useState<CategoryOption | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatType, setEditCatType] = useState<"EXPENSE" | "INCOME" | "INVESTMENT">("EXPENSE");
  const [editCatColor, setEditCatColor] = useState("");
  const [updatingCat, setUpdatingCat] = useState(false);

  // Rule Builder States
  const [rulePattern, setRulePattern] = useState("");
  const [ruleMatchField, setRuleMatchField] = useState<"DESCRIPTION" | "MERCHANT" | "REFERENCE">("DESCRIPTION");
  const [ruleMatchType, setRuleMatchType] = useState<"CONTAINS" | "EXACT" | "STARTS_WITH" | "REGEX">("CONTAINS");
  const [rulePriority, setRulePriority] = useState(0);
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [creatingRule, setCreatingRule] = useState(false);
  const [seedingRules, setSeedingRules] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);

  // Edit Rule Modal States
  const [editingRule, setEditingRule] = useState<CategoryRuleItem | null>(null);
  const [editRulePattern, setEditRulePattern] = useState("");
  const [editRuleMatchField, setEditRuleMatchField] = useState<"DESCRIPTION" | "MERCHANT" | "REFERENCE">("DESCRIPTION");
  const [editRuleMatchType, setEditRuleMatchType] = useState<"CONTAINS" | "EXACT" | "STARTS_WITH" | "REGEX">("CONTAINS");
  const [editRulePriority, setEditRulePriority] = useState(0);
  const [editRuleCategoryId, setEditRuleCategoryId] = useState("");
  const [updatingRule, setUpdatingRule] = useState(false);

  // Confirmations Queue States
  const [confirmingCatId, setConfirmingCatId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [catRes, budgetRes, ruleRes, unverifiedRes, tagRes] = await Promise.all([
        api<any>("/categories").catch(() => []),
        api<{ summary: any; budgets: CategoryBudgetItem[] }>("/budgets").catch(() => ({ summary: { totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, overallPercentage: 0 }, budgets: [] })),
        api<CategoryRuleItem[]>("/category-rules").catch(() => []),
        api<UnverifiedCategoryGroup[]>("/category-rules/unverified").catch(() => []),
        api<TagItem[]>("/tags").catch(() => []),
      ]);

      const catList: CategoryOption[] = Array.isArray(catRes)
        ? catRes
        : catRes && Array.isArray(catRes.categories)
        ? catRes.categories
        : [];
      setCategories(catList);
      setBudgets(budgetRes.budgets || []);
      if (budgetRes.summary) setSummary(budgetRes.summary);
      setRules(ruleRes || []);
      setUnverifiedCategories(unverifiedRes || []);
      setTags(tagRes || []);

      if (!selectedCatId && catList.length > 0) setSelectedCatId(catList[0].id);
      if (!ruleCategoryId && catList.length > 0) setRuleCategoryId(catList[0].id);
      if (!selectedTagForAuto && tagRes.length > 0) setSelectedTagForAuto(tagRes[0].id);
    } catch (err) {
      setError(errorMessage(err, "Could not load budgets or categories."));
    } finally {
      setLoading(false);
    }
  }, [selectedCatId, ruleCategoryId, selectedTagForAuto]);

  const loadTagAnalytics = useCallback(async (tagId: string) => {
    try {
      setLoadingTagAnalytics(true);
      const res = await api<TagAnalytics>(`/tags/${tagId}/analytics`);
      setTagAnalytics(res);
    } catch (err) {
      setError(errorMessage(err, "Could not load tag analytics."));
    } finally {
      setLoadingTagAnalytics(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (inspectedTagId) {
      loadTagAnalytics(inspectedTagId);
    } else {
      setTagAnalytics(null);
    }
  }, [inspectedTagId, loadTagAnalytics]);

  const totalUnverifiedCount = unverifiedCategories.reduce((sum, g) => sum + g.unverifiedCount, 0);

  // TAG HANDLERS
  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;
    try {
      setSavingTag(true);
      setError("");
      const payload = {
        name: tagName.trim(),
        color: tagColor,
        description: tagDesc.trim() || null,
        startDate: tagStart ? new Date(tagStart).toISOString() : null,
        endDate: tagEnd ? new Date(tagEnd).toISOString() : null,
        budgetLimit: tagBudget ? parseFloat(tagBudget) : null,
      };

      if (editingTag) {
        await api(`/tags/${editingTag.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setSuccessMsg(`Tag "${tagName}" updated.`);
      } else {
        const created = await api<TagItem>("/tags", { method: "POST", body: JSON.stringify(payload) });
        setSuccessMsg(`Created tag "${created.name}".`);
        setSelectedTagForAuto(created.id);
      }
      setTagModalOpen(false);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to save tag."));
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete tag "${name}"?`)) return;
    try {
      await api(`/tags/${id}`, { method: "DELETE" });
      if (inspectedTagId === id) setInspectedTagId(null);
      setSuccessMsg(`Deleted tag "${name}".`);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Could not delete tag."));
    }
  };

  const handleApplyAutoTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTagForAuto) return;
    try {
      setApplyingAutoTag(true);
      setError("");
      const res = await api<{ matchedCount: number; assignedCount: number }>(`/tags/${selectedTagForAuto}/auto-apply`, {
        method: "POST",
        body: JSON.stringify({
          startDate: autoTagStart ? new Date(autoTagStart).toISOString() : undefined,
          endDate: autoTagEnd ? new Date(autoTagEnd).toISOString() : undefined,
          keywords: autoTagKeywords.trim() || undefined,
          categoryId: autoTagCatId || undefined,
        }),
      });
      setSuccessMsg(`Auto-assigned tag to ${res.assignedCount} matching transaction(s)!`);
      loadData();
      if (inspectedTagId === selectedTagForAuto) {
        loadTagAnalytics(selectedTagForAuto);
      }
    } catch (err) {
      setError(errorMessage(err, "Auto-tagging failed."));
    } finally {
      setApplyingAutoTag(false);
    }
  };

  // BUDGET HANDLERS
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) {
      setError("Please select a category.");
      return;
    }
    const val = parseFloat(limitInput);
    if (isNaN(val) || val <= 0) {
      setError("Please enter a positive limit amount.");
      return;
    }

    setSavingBudget(true);
    setError("");
    setSuccessMsg("");

    try {
      await api("/budgets", {
        method: "POST",
        body: JSON.stringify({ categoryId: selectedCatId, monthlyLimit: val }),
      });
      setSuccessMsg("Updated budget target.");
      setLimitInput("");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to update budget limit."));
    } finally {
      setSavingBudget(false);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    setDeletingBudgetId(budgetId);
    setError("");
    setSuccessMsg("");
    try {
      await api(`/budgets/${budgetId}`, { method: "DELETE" });
      setSuccessMsg("Removed target envelope.");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to remove envelope limit."));
    } finally {
      setDeletingBudgetId(null);
    }
  };

  // CATEGORY & RULE HANDLERS
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setCreatingCat(true);
    setError("");
    setSuccessMsg("");

    try {
      await api("/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCatName.trim(), type: newCatType, color: newCatColor }),
      });
      setSuccessMsg(`Created category "${newCatName.trim()}".`);
      setNewCatName("");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to create category."));
    } finally {
      setCreatingCat(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulePattern.trim() || !ruleCategoryId) return;

    setCreatingRule(true);
    setError("");
    setSuccessMsg("");

    try {
      await api("/category-rules", {
        method: "POST",
        body: JSON.stringify({
          pattern: rulePattern.trim(),
          matchField: ruleMatchField,
          matchType: ruleMatchType,
          priority: rulePriority,
          categoryId: ruleCategoryId,
        }),
      });
      setSuccessMsg("Created category rule.");
      setRulePattern("");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to create category rule."));
    } finally {
      setCreatingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setError("");
    setSuccessMsg("");
    try {
      await api(`/category-rules/${ruleId}`, { method: "DELETE" });
      setSuccessMsg("Deleted category rule.");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to delete rule."));
    }
  };

  if (loading && categories.length === 0) {
    return (
      <Shell>
        <div className="panel" style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          <Loader2 className="spin" size={28} style={{ margin: "0 auto 12px auto", display: "block", color: "var(--green)" }} />
          <span>Loading Category Envelopes, Tags & Rules Hub...</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header Title & Top Navigation Tabs */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)", fontWeight: 700 }}>Financial Governance & Categorization</span>
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Category Budgets, Tags & Rules</h1>
          </div>

          <div style={{ display: "flex", gap: "6px", background: "var(--background-alt)", padding: "4px", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <button
              type="button"
              className={`secondary compact ${activeTab === "ENVELOPES" ? "active" : ""}`}
              onClick={() => setActiveTab("ENVELOPES")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, padding: "6px 14px" }}
            >
              <Target size={15} color={activeTab === "ENVELOPES" ? "var(--green)" : "var(--muted)"} />
              Envelope Budgets ({budgets.length})
            </button>

            <button
              type="button"
              className={`secondary compact ${activeTab === "TAGS" ? "active" : ""}`}
              onClick={() => setActiveTab("TAGS")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, padding: "6px 14px" }}
            >
              <TagIcon size={15} color={activeTab === "TAGS" ? "#3b82f6" : "var(--muted)"} />
              Tags ({tags.length})
            </button>

            <button
              type="button"
              className={`secondary compact ${activeTab === "CATEGORIES" ? "active" : ""}`}
              onClick={() => setActiveTab("CATEGORIES")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, padding: "6px 14px" }}
            >
              <TagIcon size={15} color={activeTab === "CATEGORIES" ? "var(--green)" : "var(--muted)"} />
              Manage Categories ({categories.length})
            </button>

            <button
              type="button"
              className={`secondary compact ${activeTab === "RULES" ? "active" : ""}`}
              onClick={() => setActiveTab("RULES")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, padding: "6px 14px" }}
            >
              <SlidersHorizontal size={15} color={activeTab === "RULES" ? "var(--green)" : "var(--muted)"} />
              Auto-Rules ({rules.length})
            </button>

            <button
              type="button"
              className={`secondary compact ${activeTab === "CONFIRMATIONS" ? "active" : ""}`}
              onClick={() => setActiveTab("CONFIRMATIONS")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, padding: "6px 14px" }}
            >
              <CheckCircle2 size={15} color={activeTab === "CONFIRMATIONS" ? "var(--green)" : "var(--muted)"} />
              Confirmations
              {totalUnverifiedCount > 0 && (
                <span style={{ background: "#f59e0b", color: "#000000", fontSize: "10px", fontWeight: 800, padding: "1px 6px", borderRadius: "10px" }}>
                  {totalUnverifiedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Global Notifications */}
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

        {/* TAB 1: ENVELOPE BUDGETS */}
        {activeTab === "ENVELOPES" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* KPI Overview Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Total Monthly Budget</span>
                <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{money(summary.totalBudgeted * 100)}</strong>
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>Combined target envelope limits</small>
              </div>

              <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#3b82f6", textTransform: "uppercase" }}>Month-To-Date Spent</span>
                <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{money(summary.totalSpent * 100)}</strong>
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>Across budgeted categories</small>
              </div>

              <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: summary.totalRemaining > 0 ? "var(--green)" : "#ef4444", textTransform: "uppercase" }}>Remaining Capacity</span>
                <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: summary.totalRemaining > 0 ? "var(--green)" : "#ef4444", marginTop: "4px" }}>{money(summary.totalRemaining * 100)}</strong>
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>Available envelope allowance</small>
              </div>

              <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Overall Envelope Usage</span>
                <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{summary.overallPercentage}%</strong>
                <div style={{ height: "6px", width: "100%", background: "var(--background-alt)", borderRadius: "3px", overflow: "hidden", marginTop: "6px" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, summary.overallPercentage)}%`, background: summary.overallPercentage > 100 ? "#ef4444" : summary.overallPercentage >= 80 ? "#f59e0b" : "var(--green)" }} />
                </div>
              </div>
            </div>

            {/* Set/Update Monthly Envelope Target Form */}
            <section className="panel" style={{ padding: "20px" }}>
              <div className="panel-title" style={{ marginBottom: "16px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "var(--green)" }}>Envelope Allocation</span>
                  <h2>Assign Target Monthly Spending Limit</h2>
                </div>
              </div>

              <form onSubmit={handleSaveBudget} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>Category</label>
                  <select
                    value={selectedCatId}
                    onChange={(e) => setSelectedCatId(e.target.value)}
                    style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}
                  >
                    {categories
                      .filter((c) => (c.type || "EXPENSE") === "EXPENSE")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>Monthly Target (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={limitInput}
                    onChange={(e) => setLimitInput(e.target.value)}
                    step="100"
                    style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingBudget}
                  className="secondary compact"
                  style={{ height: "40px", padding: "0 20px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700, borderRadius: "8px" }}
                >
                  {savingBudget ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                  <span>Save Target Envelope</span>
                </button>
              </form>
            </section>

            {/* Expense Categories & Budget Envelopes Grid */}
            <section className="panel" style={{ padding: "20px" }}>
              <div className="panel-title" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "var(--green)" }}>Real-Time Envelopes & Directory</span>
                  <h2>Expense Categories & Budget Envelopes ({categories.filter((c) => (c.type || "EXPENSE") === "EXPENSE").length})</h2>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className="month-pill" style={{ fontSize: "11px" }}>
                    {budgets.length} Active Envelopes
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "16px" }}>
                {categories
                  .filter((c) => (c.type || "EXPENSE") === "EXPENSE")
                  .map((cat) => {
                    const budget = budgets.find((b) => b.categoryId === cat.id);
                    const spent = budget ? budget.spentAmount : 0;
                    const limit = budget ? budget.monthlyLimit : 0;
                    const pct = budget ? budget.percentage : 0;
                    const status = budget ? budget.status : "OK";

                    return (
                      <div
                        key={cat.id}
                        style={{
                          background: "var(--background-alt)",
                          border: budget ? (status === "EXCEEDED" ? "1px solid #ef4444" : status === "WARNING" ? "1px solid #f59e0b" : "1px solid var(--line)") : "1px dashed var(--line)",
                          borderRadius: "12px",
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: cat.color, display: "inline-block" }} />
                            <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{cat.name}</strong>
                          </div>

                          {budget && (
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                type="button"
                                className="icon-button danger"
                                title="Remove Envelope Target"
                                onClick={() => handleDeleteBudget(budget.id)}
                                disabled={deletingBudgetId === budget.id}
                              >
                                {deletingBudgetId === budget.id ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                              </button>
                            </div>
                          )}
                        </div>

                        {budget ? (
                          <>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                                <span style={{ color: "var(--muted)" }}>MTD Outflow</span>
                                <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                                  {money(spent * 100)} / {money(limit * 100)}
                                </span>
                              </div>

                              <div style={{ width: "100%", height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${Math.min(100, pct)}%`,
                                    background: status === "EXCEEDED" ? "#ef4444" : status === "WARNING" ? "#f59e0b" : "var(--green)",
                                    borderRadius: "3px",
                                  }}
                                />
                              </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                              <span style={{ color: status === "EXCEEDED" ? "#ef4444" : status === "WARNING" ? "#f59e0b" : "var(--muted)", fontWeight: 600 }}>
                                {status === "EXCEEDED" ? "Over limit" : status === "WARNING" ? "Near limit (>80%)" : `${money((limit - spent) * 100)} left`}
                              </span>
                              <span style={{ fontWeight: 700, color: "var(--ink)" }}>{pct}%</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>No monthly envelope spending limit set for this category.</p>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCatId(cat.id);
                                  setLimitInput("10000");
                                }}
                                className="secondary compact"
                                style={{ fontSize: "11px", padding: "4px 12px", borderRadius: "6px" }}
                              >
                                + Set Envelope Target
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: TAGS */}
        {activeTab === "TAGS" && (
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
                                {money(Math.abs(tx.amount))}
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
        )}

        {/* TAB 3: MANAGE CATEGORIES */}
        {activeTab === "CATEGORIES" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Create Custom Category Form */}
            <section className="panel" style={{ padding: "20px" }}>
              <div className="panel-title" style={{ marginBottom: "16px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "var(--green)" }}>Category Manager</span>
                  <h2>Create New Custom Category</h2>
                </div>
              </div>

              <form onSubmit={handleCreateCategory} style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: "1 1 220px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Category Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Stock Dividends, Pet Care..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>

                <div style={{ flex: "1 1 180px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Category Group / Type</label>
                  <select
                    value={newCatType}
                    onChange={(e: any) => setNewCatType(e.target.value)}
                    style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}
                  >
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                    <option value="INVESTMENT">Investment & Wealth</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Badge Color</label>
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    style={{ width: "40px", height: "40px", padding: "2px", borderRadius: "8px", border: "1px solid var(--line)", cursor: "pointer", background: "var(--background)" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingCat || !newCatName.trim()}
                  className="secondary compact"
                  style={{ height: "40px", padding: "0 20px", marginTop: "18px", display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700, borderRadius: "8px" }}
                >
                  {creatingCat ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                  <span>Create Category</span>
                </button>
              </form>
            </section>
          </div>
        )}

        {/* CREATE / EDIT TAG MODAL */}
        {tagModalOpen && (
          <div className="modal-wrap" style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", zIndex: 99999, background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)", padding: "20px" }}>
            <button type="button" className="backdrop" onClick={() => setTagModalOpen(false)} aria-label="Close modal" style={{ position: "absolute", inset: 0, background: "transparent", border: 0, width: "100%", height: "100%", cursor: "pointer" }} />
            <section className="modal" style={{ position: "relative", zIndex: 10, width: "min(500px, 92vw)", padding: "28px", borderRadius: "16px", background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>{editingTag ? "Edit Tag" : "Create New Tag"}</h2>
                <button type="button" className="icon-button" onClick={() => setTagModalOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={18}/></button>
              </div>
              <form onSubmit={handleSaveTag} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Tag Name</label>
                  <input
                    type="text"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="e.g. Vacation 2026 or Medical Expenses"
                    required
                    style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid var(--line)", padding: "0 12px", background: "var(--background-alt)", color: "var(--ink)" }}
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
                        style={{ width: "28px", height: "28px", borderRadius: "50%", background: c, border: tagColor === c ? "2.5px solid var(--ink)" : "none", cursor: "pointer" }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Description (Optional)</label>
                  <input
                    type="text"
                    value={tagDesc}
                    onChange={(e) => setTagDesc(e.target.value)}
                    placeholder="e.g. Summer vacation flights, hotels & dining"
                    style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid var(--line)", padding: "0 12px", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Start Date (Optional)</label>
                    <input
                      type="date"
                      value={tagStart}
                      onChange={(e) => setTagStart(e.target.value)}
                      style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid var(--line)", padding: "0 10px", background: "var(--background-alt)", color: "var(--ink)" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>End Date (Optional)</label>
                    <input
                      type="date"
                      value={tagEnd}
                      onChange={(e) => setTagEnd(e.target.value)}
                      style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid var(--line)", padding: "0 10px", background: "var(--background-alt)", color: "var(--ink)" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Tag Budget Limit (₹, Optional)</label>
                  <input
                    type="number"
                    value={tagBudget}
                    onChange={(e) => setTagBudget(e.target.value)}
                    placeholder="e.g. 50000"
                    style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid var(--line)", padding: "0 12px", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                  <button type="button" className="secondary" onClick={() => setTagModalOpen(false)}>Cancel</button>
                  <button type="submit" className="primary" disabled={savingTag}>
                    {savingTag ? "Saving..." : editingTag ? "Update Tag" : "Create Tag"}
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
