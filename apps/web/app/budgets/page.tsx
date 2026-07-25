"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Target,
  Plus,
  Trash2,
  Edit2,
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

export default function BudgetsPage() {
  const [activeTab, setActiveTab] = useState<"ENVELOPES" | "CATEGORIES" | "RULES">("ENVELOPES");

  // Main Data States
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudgetItem[]>([]);
  const [rules, setRules] = useState<CategoryRuleItem[]>([]);
  const [summary, setSummary] = useState({ totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, overallPercentage: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Envelope Form States
  const [selectedCatId, setSelectedCatId] = useState("");
  const [limitInput, setLimitInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  // Category Management States
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");
  const [creatingCat, setCreatingCat] = useState(false);

  // Edit Category Modal States
  const [editingCategory, setEditingCategory] = useState<CategoryOption | null>(null);
  const [editCatName, setEditCatName] = useState("");
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [catRes, budgetRes, ruleRes] = await Promise.all([
        api<any>("/categories").catch(() => []),
        api<{ summary: any; budgets: CategoryBudgetItem[] }>("/budgets").catch(() => ({ summary: { totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, overallPercentage: 0 }, budgets: [] })),
        api<CategoryRuleItem[]>("/categories/rules").catch(() => []),
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

      if (!selectedCatId && catList.length > 0) setSelectedCatId(catList[0].id);
      if (!ruleCategoryId && catList.length > 0) setRuleCategoryId(catList[0].id);
    } catch (err) {
      setError(errorMessage(err, "Could not load budgets or categories."));
    } finally {
      setLoading(false);
    }
  }, [selectedCatId, ruleCategoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
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
        body: JSON.stringify({ name: editCatName.trim(), color: editCatColor }),
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
      await api(`/categories/rules/${id}`, { method: "DELETE" });
      setSuccessMsg("Rule deleted.");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Could not delete rule."));
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
                <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{money(summary.totalBudgeted)}</strong>
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>Combined target envelope limits</small>
              </div>

              <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#3b82f6", textTransform: "uppercase" }}>Month-To-Date Spent</span>
                <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{money(summary.totalSpent)}</strong>
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>Across budgeted categories</small>
              </div>

              <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: summary.totalRemaining > 0 ? "var(--green)" : "#ef4444", textTransform: "uppercase" }}>Remaining Capacity</span>
                <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: summary.totalRemaining > 0 ? "var(--green)" : "#ef4444", marginTop: "4px" }}>{money(summary.totalRemaining)}</strong>
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>Available envelope allowance</small>
              </div>

              <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "14px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Overall Envelope Usage</span>
                <strong style={{ display: "block", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{summary.overallPercentage}%</strong>
                <div style={{ height: "6px", width: "100%", background: "var(--background-alt)", borderRadius: "3px", overflow: "hidden", marginTop: "6px" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, summary.overallPercentage)}%`, background: summary.overallPercentage >= 100 ? "#ef4444" : summary.overallPercentage >= 80 ? "#f59e0b" : "var(--green)" }} />
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
                    {categories.map((c) => (
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

            {/* Active Envelopes List */}
            <section className="panel" style={{ padding: "20px" }}>
              <div className="panel-title" style={{ marginBottom: "16px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "var(--green)" }}>Real-Time Envelopes</span>
                  <h2>Active Category Envelope Budgets ({budgets.length})</h2>
                </div>
              </div>

              {budgets.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", background: "var(--background-alt)", borderRadius: "12px", border: "1px dashed var(--line)", color: "var(--muted)" }}>
                  <Target size={32} style={{ opacity: 0.4, margin: "0 auto 8px auto", display: "block" }} />
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>No category budgets created yet.</p>
                  <span style={{ fontSize: "12px" }}>Use the form above or pick from the category list below to assign target monthly limits.</span>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "16px" }}>
                  {budgets.map((b) => {
                    const statusColor = b.status === "EXCEEDED" ? "#ef4444" : b.status === "WARNING" ? "#f59e0b" : "#10b981";
                    const progressGradient = b.status === "EXCEEDED"
                      ? "linear-gradient(90deg, #ef4444 0%, #f87171 100%)"
                      : b.status === "WARNING"
                      ? "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)"
                      : "linear-gradient(90deg, #10b981 0%, #34d399 100%)";

                    return (
                      <div
                        key={b.id}
                        style={{
                          background: "var(--background-alt)",
                          border: `1px solid ${b.status === "EXCEEDED" ? "rgba(239,68,68,0.4)" : b.status === "WARNING" ? "rgba(245,158,11,0.4)" : "var(--line)"}`,
                          borderRadius: "14px",
                          padding: "18px 20px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "14px",
                          boxShadow: b.status === "EXCEEDED" ? "0 4px 12px rgba(239,68,68,0.08)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: b.categoryColor || "#3b82f6", flexShrink: 0 }} />
                            <strong style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>{b.categoryName}</strong>
                          </div>

                          <span
                            style={{
                              fontSize: "11px",
                              padding: "3px 10px",
                              borderRadius: "12px",
                              fontWeight: 800,
                              background: b.status === "EXCEEDED" ? "rgba(239,68,68,0.15)" : b.status === "WARNING" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                              color: statusColor,
                            }}
                          >
                            {b.status === "EXCEEDED" ? "🚨 OVER BUDGET" : b.status === "WARNING" ? "⚠️ 80%+ REACHED" : "🟢 ON TRACK"}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                            Spent <strong style={{ color: "var(--ink)", fontWeight: 700 }}>{money(b.spentAmount)}</strong> of {money(b.monthlyLimit)}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 800, color: statusColor }}>{b.percentage}%</span>
                        </div>

                        {/* Enhanced Visual Progress Bar */}
                        <div style={{ height: "10px", width: "100%", background: "var(--background)", borderRadius: "5px", border: "1px solid var(--line)", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, b.percentage)}%`,
                              background: progressGradient,
                              transition: "width 0.4s ease-in-out",
                              borderRadius: "5px",
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px", paddingTop: "10px", borderTop: "1px solid var(--line)", fontSize: "12px" }}>
                          <span style={{ color: "var(--muted)" }}>
                            {b.remainingAmount > 0 ? (
                              <>Remaining: <strong style={{ color: "var(--green)", fontWeight: 700 }}>{money(b.remainingAmount)}</strong></>
                            ) : (
                              <>Over budget by: <strong style={{ color: "#ef4444", fontWeight: 700 }}>{money(Math.abs(b.monthlyLimit - b.spentAmount))}</strong></>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteBudget(b.id)}
                            disabled={deletingBudgetId === b.id}
                            className="ghost compact"
                            style={{ color: "#ef4444", padding: "4px 8px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            title="Remove envelope target"
                          >
                            {deletingBudgetId === b.id ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* List of All Available System Categories */}
            <section className="panel" style={{ padding: "20px" }}>
              <div className="panel-title" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "var(--green)" }}>Category Directory</span>
                  <h2>All System Categories ({categories.length})</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("CATEGORIES")}
                  className="secondary compact"
                  style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Tag size={14} color="var(--green)" />
                  <span>Manage & Add Categories →</span>
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
                {categories.map((cat) => {
                  const existingBudget = budgets.find((b) => b.categoryId === cat.id);

                  return (
                    <div
                      key={cat.id}
                      style={{
                        background: "var(--background-alt)",
                        border: "1px solid var(--line)",
                        borderRadius: "12px",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                          <strong style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>{cat.name}</strong>
                        </div>

                        {existingBudget ? (
                          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "10px", background: "rgba(16,185,129,0.12)", color: "#10b981", fontWeight: 700 }}>
                            Target Set
                          </span>
                        ) : (
                          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "10px", background: "var(--line)", color: "var(--muted)", fontWeight: 600 }}>
                            No Budget
                          </span>
                        )}
                      </div>

                      {existingBudget ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)" }}>
                            <span>Target: <strong style={{ color: "var(--ink)" }}>{money(existingBudget.monthlyLimit)}/mo</strong></span>
                            <span>Spent: <strong>{money(existingBudget.spentAmount)}</strong> ({existingBudget.percentage}%)</span>
                          </div>
                          <div style={{ height: "5px", width: "100%", background: "var(--background)", borderRadius: "3px", overflow: "hidden", border: "1px solid var(--line)" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, existingBudget.percentage)}%`,
                                background: existingBudget.percentage >= 100 ? "#ef4444" : existingBudget.percentage >= 80 ? "#f59e0b" : "#10b981",
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          No monthly limit assigned yet.
                        </div>
                      )}

                      <div style={{ paddingTop: "8px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCatId(cat.id);
                            if (existingBudget) setLimitInput(String(existingBudget.monthlyLimit));
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="secondary compact"
                          style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "6px" }}
                        >
                          {existingBudget ? "Edit Envelope Target" : "+ Set Envelope Target"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                <div style={{ flex: "1 1 240px" }}>
                  <input
                    type="text"
                    placeholder="Enter category name (e.g. Subscriptions, Travel, Pets)..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Badge Color:</label>
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
                  style={{ height: "40px", padding: "0 20px", display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700, borderRadius: "8px" }}
                >
                  {creatingCat ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                  <span>Create Category</span>
                </button>
              </form>
            </section>

            {/* List of Existing Categories Grid */}
            <section className="panel" style={{ padding: "20px" }}>
              <div className="panel-title" style={{ marginBottom: "16px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "var(--green)" }}>Available Categories</span>
                  <h2>Your Expense & Income Categories ({categories.length})</h2>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                {categories.map((c) => (
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
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{c.name}</span>
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
                ))}
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
    </Shell>
  );
}
