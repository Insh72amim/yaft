"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Target,
  Plus,
  Trash2,
  Edit2,
  Pencil,
  SlidersHorizontal,
  Tag,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  TrendingDown,
  Sparkles,
  PieChart,
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

export default function BudgetsPage() {
  const [activeTab, setActiveTab] = useState<"ENVELOPES" | "TAGS" | "CATEGORIES" | "RULES" | "CONFIRMATIONS">("ENVELOPES");

  // Main Data States
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudgetItem[]>([]);
  const [rules, setRules] = useState<CategoryRuleItem[]>([]);
  const [unverifiedCategories, setUnverifiedCategories] = useState<UnverifiedCategoryGroup[]>([]);
  const [tags, setTags] = useState<Array<{ id: string; name: string; color: string; description: string | null; startDate: string | null; endDate: string | null; budgetLimit: number | null; transactionCount: number; totalSpent: number }>>([]);
  const [summary, setSummary] = useState({ totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, overallPercentage: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Tag Assignment Form States
  const [tagAssignMode, setTagAssignMode] = useState<"TIME_BASED" | "KEYWORD">("TIME_BASED");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [tagStartDate, setTagStartDate] = useState("");
  const [tagEndDate, setTagEndDate] = useState("");
  const [tagKeywords, setTagKeywords] = useState("");
  const [tagCatIdFilter, setTagCatIdFilter] = useState("");
  const [applyingTag, setApplyingTag] = useState(false);

  // New Tag Modal / Inline Form State
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [newTagDesc, setNewTagDesc] = useState("");
  const [newTagStart, setNewTagStart] = useState("");
  const [newTagEnd, setNewTagEnd] = useState("");
  const [newTagBudget, setNewTagBudget] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

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
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [rulePriority, setRulePriority] = useState(0);
  const [creatingRule, setCreatingRule] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);
  const [seedingRules, setSeedingRules] = useState(false);
  const [confirmingCatId, setConfirmingCatId] = useState<string | null>(null);

  // Edit Rule Modal States
  const [editingRule, setEditingRule] = useState<CategoryRuleItem | null>(null);
  const [editRulePattern, setEditRulePattern] = useState("");
  const [editRuleMatchField, setEditRuleMatchField] = useState<"DESCRIPTION" | "MERCHANT" | "REFERENCE">("DESCRIPTION");
  const [editRuleMatchType, setEditRuleMatchType] = useState<"CONTAINS" | "EXACT" | "STARTS_WITH" | "REGEX">("CONTAINS");
  const [editRuleCategoryId, setEditRuleCategoryId] = useState("");
  const [editRulePriority, setEditRulePriority] = useState(0);
  const [updatingRule, setUpdatingRule] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [budgetRes, catRes, ruleRes, unverifiedRes, tagRes] = await Promise.all([
        api<{ summary: any; budgets: CategoryBudgetItem[] }>("/budgets").catch(() => ({ summary: { totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, overallPercentage: 0 }, budgets: [] })),
        api<any>("/categories").catch(() => []),
        api<CategoryRuleItem[]>("/category-rules").catch(() => []),
        api<UnverifiedCategoryGroup[]>("/category-rules/unverified").catch(() => []),
        api<any[]>("/tags").catch(() => []),
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
      if (!selectedTagId && tagRes && tagRes.length > 0) setSelectedTagId(tagRes[0].id);
    } catch (err) {
      setError(errorMessage(err, "Could not load budgets or categories."));
    } finally {
      setLoading(false);
    }
  }, [selectedCatId, ruleCategoryId, selectedTagId]);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      setCreatingTag(true);
      setError("");
      const created = await api<any>("/tags", {
        method: "POST",
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
          description: newTagDesc.trim() || null,
          startDate: newTagStart ? new Date(newTagStart).toISOString() : null,
          endDate: newTagEnd ? new Date(newTagEnd).toISOString() : null,
          budgetLimit: newTagBudget ? parseFloat(newTagBudget) : null,
        }),
      });
      setSuccessMsg(`Created tag "${created.name}".`);
      setNewTagName("");
      setNewTagDesc("");
      setNewTagStart("");
      setNewTagEnd("");
      setNewTagBudget("");
      setSelectedTagId(created.id);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to create tag."));
    } finally {
      setCreatingTag(false);
    }
  };

  const handleApplyTagAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTagId) {
      setError("Please select a tag to assign.");
      return;
    }
    try {
      setApplyingTag(true);
      setError("");
      setSuccessMsg("");
      const res = await api<{ matchedCount: number; assignedCount: number }>(`/tags/${selectedTagId}/auto-apply`, {
        method: "POST",
        body: JSON.stringify({
          startDate: tagStartDate ? new Date(tagStartDate).toISOString() : undefined,
          endDate: tagEndDate ? new Date(tagEndDate).toISOString() : undefined,
          keywords: tagKeywords.trim() || undefined,
          categoryId: tagCatIdFilter || undefined,
        }),
      });
      setSuccessMsg(`Successfully auto-assigned tag to ${res.assignedCount} matching transaction(s)!`);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to assign tag."));
    } finally {
      setApplyingTag(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalUnverifiedCount = unverifiedCategories.reduce((sum, g) => sum + g.unverifiedCount, 0);

  const handleSeedDefaultRules = async () => {
    setSeedingRules(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await api<{ createdCount: number; appliedCount: number }>("/category-rules/seed-defaults", { method: "POST" });
      setSuccessMsg(`Successfully loaded ${res.createdCount} standard category rules & re-categorized ${res.appliedCount} transactions!`);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to seed standard category rules."));
    } finally {
      setSeedingRules(false);
    }
  };

  const handleConfirmCategory = async (catId: string, catName: string) => {
    setConfirmingCatId(catId);
    setError("");
    try {
      const res = await api<{ updatedCount: number }>(`/category-rules/confirm-category/${catId}`, { method: "POST" });
      setSuccessMsg(`Confirmed ${res.updatedCount} transaction categorizations for "${catName}"!`);
      loadData();
    } catch (err) {
      setError(errorMessage(err, `Failed to confirm categorizations for ${catName}.`));
    } finally {
      setConfirmingCatId(null);
    }
  };

  const handleConfirmTx = async (txId: string) => {
    try {
      await api<{ updatedCount: number }>("/category-rules/confirm", {
        method: "POST",
        body: JSON.stringify({ transactionIds: [txId] }),
      });
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to confirm transaction."));
    }
  };

  // 1. Envelope Budget Handlers
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) {
      setError("Please select a category.");
      return;
    }
    const limit = parseFloat(limitInput);
    if (isNaN(limit) || limit <= 0) {
      setError("Please enter a valid monthly budget limit greater than 0.");
      return;
    }

    try {
      setSavingBudget(true);
      setError("");
      setSuccessMsg("");
      await api("/budgets", {
        method: "POST",
        body: JSON.stringify({ categoryId: selectedCatId, monthlyLimit: limit }),
      });
      setSuccessMsg("Category budget target saved successfully!");
      setLimitInput("");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to save category budget."));
    } finally {
      setSavingBudget(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      setDeletingBudgetId(id);
      setError("");
      setSuccessMsg("");
      await api(`/budgets/${id}`, { method: "DELETE" });
      setSuccessMsg("Category budget target removed.");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to delete budget."));
    } finally {
      setDeletingBudgetId(null);
    }
  };

  // 2. Category Management Handlers
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    setError("");
    setSuccessMsg("");
    try {
      const created = await api<CategoryOption>("/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCatName.trim(), color: newCatColor, type: newCatType }),
      });
      setSuccessMsg(`Created new category "${created.name}"!`);
      setNewCatName("");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Could not create category."));
    } finally {
      setCreatingCat(false);
    }
  };

  const handleOpenEditCategory = (cat: CategoryOption) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatType(cat.type || "EXPENSE");
    setEditCatColor(cat.color);
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCatName.trim()) return;
    setUpdatingCat(true);
    setError("");
    try {
      await api(`/categories/${editingCategory.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editCatName.trim(), color: editCatColor, type: editCatType }),
      });
      setSuccessMsg(`Updated category "${editCatName.trim()}"!`);
      setEditingCategory(null);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Could not update category."));
    } finally {
      setUpdatingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"? Transactions assigned to this category will be reset to Uncategorised.`)) return;
    try {
      setError("");
      await api(`/categories/${id}`, { method: "DELETE" });
      setSuccessMsg(`Deleted category "${name}".`);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Could not delete category."));
    }
  };

  // 3. Auto-Categorization Rule Handlers
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulePattern.trim() || !ruleCategoryId) {
      setError("Please enter a pattern keyword and select a category.");
      return;
    }
    setCreatingRule(true);
    setError("");
    setSuccessMsg("");
    try {
      await api("/categories/rules", {
        method: "POST",
        body: JSON.stringify({
          pattern: rulePattern.trim(),
          matchField: ruleMatchField,
          matchType: ruleMatchType,
          categoryId: ruleCategoryId,
          priority: Number(rulePriority) || 0,
        }),
      });
      setSuccessMsg(`Created rule for pattern "${rulePattern.trim()}"!`);
      setRulePattern("");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Could not create categorization rule."));
    } finally {
      setCreatingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      setError("");
      await api(`/category-rules/${id}`, { method: "DELETE" });
      setSuccessMsg("Rule deleted.");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Could not delete rule."));
    }
  };

  const handleOpenEditRule = (rule: CategoryRuleItem) => {
    setEditingRule(rule);
    setEditRulePattern(rule.pattern);
    setEditRuleMatchField(rule.matchField);
    setEditRuleMatchType(rule.matchType);
    setEditRuleCategoryId(rule.category?.id || categories[0]?.id || "");
    setEditRulePriority(rule.priority || 0);
  };

  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editRulePattern.trim()) return;
    setUpdatingRule(true);
    setError("");
    try {
      await api(`/category-rules/${editingRule.id}`, {
        method: "PUT",
        body: JSON.stringify({
          pattern: editRulePattern.trim(),
          matchField: editRuleMatchField,
          matchType: editRuleMatchType,
          categoryId: editRuleCategoryId,
          priority: Number(editRulePriority) || 0,
        }),
      });
      setSuccessMsg(`Updated rule for pattern "${editRulePattern.trim()}"!`);
      setEditingRule(null);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Could not update categorization rule."));
    } finally {
      setUpdatingRule(false);
    }
  };

  const handleApplyRulesRetroactively = async () => {
    setApplyingRules(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await api<{ updatedCount: number }>("/categories/rules/apply", { method: "POST" });
      setSuccessMsg(`Successfully applied rules! Re-categorized ${res.updatedCount} past transaction${res.updatedCount === 1 ? "" : "s"}.`);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to apply rules retroactively."));
    } finally {
      setApplyingRules(false);
    }
  };

  if (loading && categories.length === 0) {
    return (
      <Shell>
        <div className="panel" style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          <Loader2 className="spin" size={28} style={{ margin: "0 auto 12px auto", display: "block", color: "var(--green)" }} />
          <span>Loading Category Envelopes & Rules Hub...</span>
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
            <span className="eyebrow" style={{ color: "var(--green)", fontWeight: 700 }}>Smart Envelope System</span>
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Category Budgets & Rules</h1>
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
              <Tag size={15} color={activeTab === "TAGS" ? "#3b82f6" : "var(--muted)"} />
              Tag & Trip Assignment ({tags.length})
            </button>
            <button
              type="button"
              className={`secondary compact ${activeTab === "CATEGORIES" ? "active" : ""}`}
              onClick={() => setActiveTab("CATEGORIES")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, padding: "6px 14px" }}
            >
              <Tag size={15} color={activeTab === "CATEGORIES" ? "var(--green)" : "var(--muted)"} />
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
              Confirm Categorizations
              {totalUnverifiedCount > 0 && (
                <span style={{ background: "#f59e0b", color: "#000000", fontSize: "10px", fontWeight: 800, padding: "1px 6px", borderRadius: "10px" }}>
                  {totalUnverifiedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Global Error or Success Notifications */}
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

            {/* Single Consolidated Expense Categories & Real-Time Envelope Budgets Grid */}
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
                  .filter((cat) => (cat.type || "EXPENSE") === "EXPENSE")
                  .map((cat) => {
                    const b = budgets.find((item) => item.categoryId === cat.id);
                    const statusColor = !b ? "var(--muted)" : b.status === "EXCEEDED" ? "#ef4444" : b.status === "WARNING" ? "#f59e0b" : "#10b981";
                    const progressGradient = !b
                      ? "var(--line)"
                      : b.status === "EXCEEDED"
                      ? "linear-gradient(90deg, #ef4444 0%, #f87171 100%)"
                      : b.status === "WARNING"
                      ? "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)"
                      : "linear-gradient(90deg, #10b981 0%, #34d399 100%)";

                    return (
                      <div
                        key={cat.id}
                        style={{
                          background: "var(--background-alt)",
                          border: `1px solid ${b ? (b.status === "EXCEEDED" ? "rgba(239,68,68,0.4)" : b.status === "WARNING" ? "rgba(245,158,11,0.4)" : "var(--line)") : "var(--line)"}`,
                          borderRadius: "14px",
                          padding: "18px 20px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          boxShadow: b && b.status === "EXCEEDED" ? "0 4px 12px rgba(239,68,68,0.08)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: cat.color || "#3b82f6", flexShrink: 0 }} />
                            <strong style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>{cat.name}</strong>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button
                              type="button"
                              title="Edit Category & Color"
                              onClick={() => handleOpenEditCategory(cat)}
                              style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px", color: "var(--muted)", display: "flex", alignItems: "center" }}
                            >
                              <Pencil size={13} />
                            </button>

                            <span
                              style={{
                                fontSize: "10px",
                                padding: "3px 9px",
                                borderRadius: "12px",
                                fontWeight: 800,
                                background: !b ? "var(--background)" : b.status === "EXCEEDED" ? "rgba(239,68,68,0.15)" : b.status === "WARNING" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                                color: statusColor,
                                border: `1px solid ${statusColor}33`,
                              }}
                            >
                              {!b
                                ? "⚪ NO TARGET"
                                : b.status === "EXCEEDED"
                                ? "🚨 OVER BUDGET"
                                : b.status === "WARNING"
                                ? (b.percentage >= 100 ? "⚠️ 100% REACHED" : "⚠️ 80%+ REACHED")
                                : "🟢 ON TRACK"}
                            </span>
                          </div>
                        </div>

                        {b ? (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                                Spent <strong style={{ color: "var(--ink)", fontWeight: 700 }}>{money(b.spentAmount * 100)}</strong> of {money(b.monthlyLimit * 100)}
                              </span>
                              <span style={{ fontSize: "13px", fontWeight: 800, color: statusColor }}>{b.percentage}%</span>
                            </div>

                            {/* Enhanced Visual Progress Bar */}
                            <div style={{ height: "8px", width: "100%", background: "var(--background)", borderRadius: "4px", border: "1px solid var(--line)", overflow: "hidden" }}>
                              <div
                                style={{
                                  height: "100%",
                                  width: `${Math.min(100, b.percentage)}%`,
                                  background: progressGradient,
                                  transition: "width 0.4s ease-in-out",
                                  borderRadius: "4px",
                                }}
                              />
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px", paddingTop: "8px", borderTop: "1px solid var(--line)", fontSize: "12px" }}>
                              <span style={{ color: "var(--muted)" }}>
                                {b.remainingAmount > 0 ? (
                                  <>Remaining: <strong style={{ color: "var(--green)", fontWeight: 700 }}>{money(b.remainingAmount * 100)}</strong></>
                                ) : b.spentAmount > b.monthlyLimit ? (
                                  <>Over budget by: <strong style={{ color: "#ef4444", fontWeight: 700 }}>{money((b.spentAmount - b.monthlyLimit) * 100)}</strong></>
                                ) : (
                                  <>Status: <strong style={{ color: "#f59e0b", fontWeight: 700 }}>Target Met (₹0 left)</strong></>
                                )}
                              </span>

                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCatId(cat.id);
                                    setLimitInput(String(b.monthlyLimit));
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="secondary compact"
                                  style={{ fontSize: "11px", padding: "3px 8px" }}
                                >
                                  Edit Target
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteBudget(b.id)}
                                  disabled={deletingBudgetId === b.id}
                                  className="ghost compact"
                                  style={{ color: "#ef4444", padding: "3px 6px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  title="Remove envelope target"
                                >
                                  {deletingBudgetId === b.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0" }}>
                              No monthly target limit assigned for this expense category yet.
                            </div>

                            <div style={{ paddingTop: "8px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCatId(cat.id);
                                  setLimitInput("");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
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

        {/* TAB: TAG & TRIP ASSIGNMENT */}
        {activeTab === "TAGS" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
              {/* Form 1: Auto-Assign Tag (Time-Based & Keyword) */}
              <section className="panel" style={{ padding: "20px" }}>
                <div className="panel-title" style={{ marginBottom: "16px" }}>
                  <div>
                    <span className="eyebrow" style={{ color: "#3b82f6" }}>Automated Tag Assignment</span>
                    <h2>Assign Tag to Transactions (Manual & Time-Based)</h2>
                  </div>
                </div>

                <form onSubmit={handleApplyTagAssignment} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Target Tag / Trip</label>
                    <select
                      value={selectedTagId}
                      onChange={(e) => setSelectedTagId(e.target.value)}
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
                        value={tagStartDate}
                        onChange={(e) => setTagStartDate(e.target.value)}
                        style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>End Date (Time-Based)</label>
                      <input
                        type="date"
                        value={tagEndDate}
                        onChange={(e) => setTagEndDate(e.target.value)}
                        style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Merchant / Description Keywords (Optional)</label>
                    <input
                      type="text"
                      value={tagKeywords}
                      onChange={(e) => setTagKeywords(e.target.value)}
                      placeholder="e.g. Zomato, Indigo, Swiggy, Hotel"
                      style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={applyingTag || !selectedTagId}
                    className="primary"
                    style={{ alignSelf: "flex-start", marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <Sparkles size={16} />
                    <span>{applyingTag ? "Applying Tag..." : "Auto-Apply Tag to Matching Transactions"}</span>
                  </button>
                </form>
              </section>

              {/* Form 2: Quick Tag Creator */}
              <section className="panel" style={{ padding: "20px" }}>
                <div className="panel-title" style={{ marginBottom: "16px" }}>
                  <div>
                    <span className="eyebrow" style={{ color: "#3b82f6" }}>Custom Tag Creator</span>
                    <h2>Create New Tag or Vacation Trip</h2>
                  </div>
                </div>

                <form onSubmit={handleCreateTag} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Tag / Trip Name</label>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="e.g. Goa Vacation 2026, Tax Deductible"
                      required
                      style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Trip Start Date</label>
                      <input
                        type="date"
                        value={newTagStart}
                        onChange={(e) => setNewTagStart(e.target.value)}
                        style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Trip End Date</label>
                      <input
                        type="date"
                        value={newTagEnd}
                        onChange={(e) => setNewTagEnd(e.target.value)}
                        style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Trip Budget Limit (₹, Optional)</label>
                    <input
                      type="number"
                      value={newTagBudget}
                      onChange={(e) => setNewTagBudget(e.target.value)}
                      placeholder="e.g. 50000"
                      style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={creatingTag}
                    className="secondary"
                    style={{ alignSelf: "flex-start", marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <Plus size={16} />
                    <span>{creatingTag ? "Creating..." : "Create Tag / Trip"}</span>
                  </button>
                </form>
              </section>
            </div>

            {/* Tags Cards Grid */}
            <section className="panel" style={{ padding: "24px" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>All Active Tags & Trip Budgets ({tags.length})</h3>
              {tags.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "13px" }}>No tags created yet. Create a tag above to start tracking vacation trips or manual project expenses.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                  {tags.map((tag) => {
                    const hasBudget = tag.budgetLimit !== null && tag.budgetLimit > 0;
                    const pct = hasBudget ? Math.min(100, Math.round((tag.totalSpent / tag.budgetLimit!) * 100)) : 0;
                    return (
                      <div key={tag.id} style={{ background: "var(--background-alt)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: tag.color, display: "inline-block" }} />
                            <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{tag.name}</strong>
                          </div>
                          <button
                            type="button"
                            className="secondary compact"
                            style={{ fontSize: "11px" }}
                            onClick={() => { setSelectedTagId(tag.id); setTagStartDate(tag.startDate ? tag.startDate.slice(0, 10) : ""); setTagEndDate(tag.endDate ? tag.endDate.slice(0, 10) : ""); setTagKeywords(tag.name); }}>
                            Assign
                          </button>
                        </div>
                        {tag.startDate && (
                          <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginBottom: "8px" }}>
                            📅 {tag.startDate.slice(0, 10)} to {tag.endDate ? tag.endDate.slice(0, 10) : "Present"}
                          </span>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginTop: "8px" }}>
                          <span style={{ color: "var(--muted)" }}>Tagged Outflow:</span>
                          <strong style={{ color: "#ef4444" }}>{money(tag.totalSpent * 100)}</strong>
                        </div>
                        {hasBudget && (
                          <div style={{ marginTop: "8px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)", marginBottom: "2px" }}>
                              <span>Trip Limit: {money(tag.budgetLimit! * 100)}</span>
                              <span>{pct}%</span>
                            </div>
                            <div style={{ width: "100%", height: "4px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: tag.color, borderRadius: "4px" }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: MANAGE CATEGORIES */}
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
                    <option value="TRANSFER">Internal Transfer / Payment</option>
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

            {/* List of Existing Categories Grid */}
            <section className="panel" style={{ padding: "20px" }}>
              <div className="panel-title" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "var(--green)" }}>Available Categories</span>
                  <h2>Your Expense, Income, Investment & Transfer Categories ({categories.length})</h2>
                </div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {(["ALL", "EXPENSE", "INCOME", "INVESTMENT", "TRANSFER"] as const).map((t) => {
                    const count = t === "ALL" ? categories.length : categories.filter((c) => (c.type || "EXPENSE") === t).length;
                    const label = t === "ALL" ? `All (${count})` : t === "EXPENSE" ? `Expenses (${count})` : t === "INCOME" ? `Income (${count})` : t === "INVESTMENT" ? `Investments (${count})` : `Transfers (${count})`;
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`secondary compact ${manageCatFilter === t ? "active" : ""}`}
                        onClick={() => setManageCatFilter(t)}
                        style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "8px", fontWeight: 600 }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
                {categories
                  .filter((cat) => manageCatFilter === "ALL" || (cat.type || "EXPENSE") === manageCatFilter)
                  .map((c) => {
                    const catType = (c.type || "EXPENSE") as string;
                    const badgeBg = catType === "INCOME" ? "rgba(34, 197, 94, 0.12)" : catType === "INVESTMENT" ? "rgba(59, 130, 246, 0.12)" : catType === "TRANSFER" ? "rgba(168, 85, 247, 0.12)" : "rgba(239, 68, 68, 0.12)";
                    const badgeColor = catType === "INCOME" ? "#166534" : catType === "INVESTMENT" ? "#1e40af" : catType === "TRANSFER" ? "#6b21a8" : "#991b1b";
                    const badgeLabel = catType === "INCOME" ? "INCOME" : catType === "INVESTMENT" ? "INVESTMENT" : catType === "TRANSFER" ? "TRANSFER" : "EXPENSE";

                    return (
                      <div
                        key={c.id}
                        style={{
                          background: "var(--background-alt)",
                          border: "1px solid var(--line)",
                          borderRadius: "12px",
                          padding: "12px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                          <div>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", display: "block" }}>{c.name}</span>
                            <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "6px", background: badgeBg, color: badgeColor, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              {badgeLabel}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditCategory(c)}
                            className="ghost compact"
                            style={{ padding: "4px", color: "var(--muted)" }}
                            title="Edit category"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            className="ghost compact"
                            style={{ padding: "4px", color: "#ef4444" }}
                            title="Delete category"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: AUTO-CATEGORIZATION RULES */}
        {activeTab === "RULES" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Create Rule Form */}
            <section className="panel" style={{ padding: "20px" }}>
              <div className="panel-title" style={{ flexWrap: "wrap", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "var(--green)" }}>Automation Engine</span>
                  <h2>Create Auto-Categorization Rule</h2>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleSeedDefaultRules}
                    disabled={seedingRules}
                    className="secondary compact"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6", border: "1px solid rgba(139, 92, 246, 0.3)" }}
                  >
                    <Sparkles size={14} className={seedingRules ? "spin" : ""} color="#8b5cf6" />
                    {seedingRules ? "Loading Rules..." : "✨ Seed Standard Category Rules"}
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyRulesRetroactively}
                    disabled={applyingRules}
                    className="secondary compact"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700 }}
                  >
                    <Zap size={14} className={applyingRules ? "spin" : ""} color="var(--green)" />
                    {applyingRules ? "Applying..." : "Apply Rules to Past Transactions"}
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateRule} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Pattern Keyword</label>
                  <input
                    type="text"
                    placeholder="e.g. SWIGGY, ZOMATO, NETFLIX..."
                    value={rulePattern}
                    onChange={(e) => setRulePattern(e.target.value)}
                    style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Match Field</label>
                  <select
                    value={ruleMatchField}
                    onChange={(e: any) => setRuleMatchField(e.target.value)}
                    style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  >
                    <option value="DESCRIPTION">Description</option>
                    <option value="MERCHANT">Merchant</option>
                    <option value="REFERENCE">Reference</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Match Type</label>
                  <select
                    value={ruleMatchType}
                    onChange={(e: any) => setRuleMatchType(e.target.value)}
                    style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  >
                    <option value="CONTAINS">Contains</option>
                    <option value="EXACT">Exact Match</option>
                    <option value="STARTS_WITH">Starts With</option>
                    <option value="REGEX">Regular Expression</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Assign Category</label>
                  <select
                    value={ruleCategoryId}
                    onChange={(e) => setRuleCategoryId(e.target.value)}
                    style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Priority (0 = Low)</label>
                  <input
                    type="number"
                    value={rulePriority}
                    onChange={(e) => setRulePriority(parseInt(e.target.value, 10) || 0)}
                    style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingRule}
                  className="secondary compact"
                  style={{ height: "38px", padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700, borderRadius: "8px" }}
                >
                  {creatingRule ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}
                  <span>Save Rule</span>
                </button>
              </form>
            </section>

            {/* Active Rules List */}
            <section className="panel" style={{ padding: "20px" }}>
              <div className="panel-title" style={{ marginBottom: "16px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "var(--green)" }}>Rule Registry</span>
                  <h2>Active Auto-Categorization Rules ({rules.length})</h2>
                </div>
              </div>

              {rules.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", background: "var(--background-alt)", borderRadius: "12px", border: "1px dashed var(--line)", color: "var(--muted)", fontSize: "13px" }}>
                  No automation rules created yet. Use the rule builder above to match keywords automatically.
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {rules.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        background: "var(--background-alt)",
                        border: "1px solid var(--line)",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "6px", background: "var(--line)", color: "var(--ink)" }}>
                          P{r.priority}
                        </span>
                        <div>
                          <code style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", background: "var(--card)", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--line)" }}>
                            "{r.pattern}"
                          </code>
                          <span style={{ fontSize: "11px", color: "var(--muted)", marginLeft: "8px" }}>
                            in {r.matchField.toLowerCase()} ({r.matchType.toLowerCase()})
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "12px", background: "var(--card)", border: "1px solid var(--line)" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: r.category?.color || "#3b82f6" }} />
                          {r.category?.name || "Category"}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleOpenEditRule(r)}
                          className="ghost compact"
                          style={{ color: "var(--muted)", padding: "4px" }}
                          title="Edit rule"
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRule(r.id)}
                          className="ghost compact"
                          style={{ color: "#ef4444", padding: "4px" }}
                          title="Delete rule"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 4: CONFIRM CATEGORIZATIONS (CATEGORY-WISE VERIFICATION) */}
        {activeTab === "CONFIRMATIONS" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <section className="panel" style={{ padding: "20px" }}>
              <div className="panel-title" style={{ flexWrap: "wrap", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "var(--green)" }}>Auto-Categorization Review</span>
                  <h2>Confirm Categorized Transactions ({totalUnverifiedCount} Pending)</h2>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleSeedDefaultRules}
                    disabled={seedingRules}
                    className="secondary compact"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6", border: "1px solid rgba(139, 92, 246, 0.3)" }}
                  >
                    <Sparkles size={14} className={seedingRules ? "spin" : ""} color="#8b5cf6" />
                    {seedingRules ? "Loading..." : "✨ Seed Common Rules"}
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyRulesRetroactively}
                    disabled={applyingRules}
                    className="secondary compact"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700 }}
                  >
                    <Zap size={14} className={applyingRules ? "spin" : ""} color="var(--green)" />
                    {applyingRules ? "Applying..." : "Re-Sync All Rules"}
                  </button>
                </div>
              </div>

              {unverifiedCategories.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", background: "var(--background-alt)", borderRadius: "12px", border: "1px dashed var(--line)", color: "var(--muted)", fontSize: "13px" }}>
                  <CheckCircle2 size={32} color="var(--green)" style={{ margin: "0 auto 10px auto", display: "block" }} />
                  <span>All transactions are confirmed! No pending auto-categorization reviews.</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {unverifiedCategories.map((group) => (
                    <div
                      key={group.category.id}
                      style={{
                        background: "var(--background-alt)",
                        border: "1px solid var(--line)",
                        borderRadius: "14px",
                        padding: "16px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      {/* Category Header Bar */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: group.category.color }} />
                          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>{group.category.name}</h3>
                          {group.unverifiedCount > 0 ? (
                            <span style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)", color: "#f59e0b", fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "10px" }}>
                              {group.unverifiedCount} Unconfirmed
                            </span>
                          ) : (
                            <span style={{ background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)", color: "#22c55e", fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "10px" }}>
                              ✓ All Confirmed
                            </span>
                          )}
                        </div>

                        {group.unverifiedCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleConfirmCategory(group.category.id, group.category.name)}
                            disabled={confirmingCatId === group.category.id}
                            className="secondary compact"
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, background: "var(--green)", color: "#ffffff", border: "none", borderRadius: "8px" }}
                          >
                            <CheckCircle2 size={14} className={confirmingCatId === group.category.id ? "spin" : ""} />
                            {confirmingCatId === group.category.id ? "Confirming..." : `✓ Confirm All in ${group.category.name}`}
                          </button>
                        )}
                      </div>

                      {/* Transaction List under this Category */}
                      <div style={{ display: "grid", gap: "8px" }}>
                        {group.transactions.map((tx) => (
                          <div
                            key={tx.id}
                            style={{
                              background: "var(--card)",
                              border: "1px solid var(--line)",
                              borderRadius: "10px",
                              padding: "10px 14px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "10px",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{tx.merchant || tx.descriptionRaw}</span>
                              <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                                {new Date(tx.transactionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </small>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                              <strong style={{ fontSize: "13px", fontWeight: 700, color: tx.amount < 0 ? "#ef4444" : "#22c55e" }}>
                                {money(tx.amount)}
                              </strong>

                              {tx.userVerified ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "#22c55e", background: "rgba(34, 197, 94, 0.1)", padding: "3px 8px", borderRadius: "6px" }}>
                                  <CheckCircle2 size={12} /> Confirmed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmTx(tx.id)}
                                  className="secondary compact"
                                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "6px", background: "var(--background-alt)", border: "1px solid var(--line)" }}
                                >
                                  <CheckCircle2 size={12} color="var(--green)" /> Confirm
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Edit Category Modal Dialog */}
      {editingCategory && (
        <div className="modal-wrap" style={{ zIndex: 99999 }}>
          <button className="backdrop" onClick={() => setEditingCategory(null)} aria-label="Close edit modal" />
          <section className="modal" style={{ width: "min(420px, 90vw)", padding: "20px", borderRadius: "14px", background: "var(--card)", border: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: "1.1rem", fontWeight: 700 }}>Edit Category</h3>

            <form onSubmit={handleUpdateCategory} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Category Name</label>
                <input
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Category Group / Type</label>
                <select
                  value={editCatType}
                  onChange={(e: any) => setEditCatType(e.target.value)}
                  style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                  <option value="INVESTMENT">Investment & Wealth</option>
                  <option value="TRANSFER">Internal Transfer / Payment</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Badge Color</label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    type="color"
                    value={editCatColor}
                    onChange={(e) => setEditCatColor(e.target.value)}
                    style={{ width: "40px", height: "40px", padding: "2px", borderRadius: "8px", border: "1px solid var(--line)", cursor: "pointer", background: "var(--background)" }}
                  />
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "monospace" }}>{editCatColor}</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button type="button" className="ghost compact" onClick={() => setEditingCategory(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={updatingCat} className="secondary compact" style={{ background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700 }}>
                  {updatingCat ? <Loader2 size={14} className="spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Edit Rule Modal Dialog */}
      {editingRule && (
        <div className="modal-wrap" style={{ zIndex: 99999 }}>
          <button className="backdrop" onClick={() => setEditingRule(null)} aria-label="Close edit rule modal" />
          <section className="modal" style={{ width: "min(480px, 90vw)", padding: "20px", borderRadius: "14px", background: "var(--card)", border: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: "1.1rem", fontWeight: 700 }}>Edit Auto-Categorization Rule</h3>

            <form onSubmit={handleUpdateRule} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Pattern Keyword / Regex</label>
                <input
                  type="text"
                  value={editRulePattern}
                  onChange={(e) => setEditRulePattern(e.target.value)}
                  style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontFamily: "monospace" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Match Field</label>
                  <select
                    value={editRuleMatchField}
                    onChange={(e: any) => setEditRuleMatchField(e.target.value)}
                    style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  >
                    <option value="DESCRIPTION">Description</option>
                    <option value="MERCHANT">Merchant</option>
                    <option value="REFERENCE">Reference</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Match Type</label>
                  <select
                    value={editRuleMatchType}
                    onChange={(e: any) => setEditRuleMatchType(e.target.value)}
                    style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  >
                    <option value="CONTAINS">Contains</option>
                    <option value="EXACT">Exact Match</option>
                    <option value="STARTS_WITH">Starts With</option>
                    <option value="REGEX">Regular Expression</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Target Category</label>
                <select
                  value={editRuleCategoryId}
                  onChange={(e) => setEditRuleCategoryId(e.target.value)}
                  style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Priority (0 = Normal)</label>
                <input
                  type="number"
                  value={editRulePriority}
                  onChange={(e) => setEditRulePriority(parseInt(e.target.value, 10) || 0)}
                  style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button type="button" className="ghost compact" onClick={() => setEditingRule(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={updatingRule} className="secondary compact" style={{ background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700 }}>
                  {updatingRule ? <Loader2 size={14} className="spin" /> : "Save Rule Changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </Shell>
  );
}
