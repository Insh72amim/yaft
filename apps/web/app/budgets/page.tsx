"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Target,
  Tag as TagIcon,
  SlidersHorizontal,
  FolderPlus,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { api, errorMessage } from "@/lib/api";

import { EnvelopesTab, CategoryOption, CategoryBudgetItem } from "@/components/budgets/envelopes-tab";
import { TagsTab, TagItem, TagAnalytics } from "@/components/budgets/tags-tab";
import { CategoriesTab } from "@/components/budgets/categories-tab";
import { CategoryRulesTab, CategoryRuleItem, UnverifiedCategoryGroup } from "@/components/budgets/category-rules-tab";

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
    <Suspense fallback={<Shell><div className="loading"><span/><p>Loading Budgets &amp; Tags Workspace…</p></div></Shell>}>
      <BudgetsContent />
    </Suspense>
  );
}

function BudgetsContent() {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get("tab")?.toUpperCase();
  const initialTab: "ENVELOPES" | "TAGS" | "CATEGORIES" | "RULES" | "CONFIRMATIONS" =
    initialTabParam === "TAGS"
      ? "TAGS"
      : initialTabParam === "CATEGORIES"
      ? "CATEGORIES"
      : initialTabParam === "RULES"
      ? "RULES"
      : initialTabParam === "CONFIRMATIONS"
      ? "CONFIRMATIONS"
      : "ENVELOPES";

  const [activeTab, setActiveTab] = useState<"ENVELOPES" | "TAGS" | "CATEGORIES" | "RULES" | "CONFIRMATIONS">(initialTab);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Main Data States
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudgetItem[]>([]);
  const [rules, setRules] = useState<CategoryRuleItem[]>([]);
  const [unverifiedCategories, setUnverifiedCategories] = useState<UnverifiedCategoryGroup[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [summary, setSummary] = useState({ totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, overallPercentage: 0, totalTransactionsCount: 0 });

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
  const [applyingAutoTag, setApplyingAutoTag] = useState(false);

  // Envelope Form States
  const [selectedCatId, setSelectedCatId] = useState("");
  const [limitInput, setLimitInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  // Edit Category Modal States
  const [editingCategory, setEditingCategory] = useState<CategoryOption | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatType, setEditCatType] = useState<"EXPENSE" | "INCOME" | "INVESTMENT">("EXPENSE");
  const [editCatColor, setEditCatColor] = useState("");
  const [editCatBudgetLimit, setEditCatBudgetLimit] = useState("");

  // Rule Builder States
  const [rulePattern, setRulePattern] = useState("");
  const [ruleMatchField, setRuleMatchField] = useState<"DESCRIPTION" | "MERCHANT" | "REFERENCE">("DESCRIPTION");
  const [ruleMatchType, setRuleMatchType] = useState<"CONTAINS" | "EXACT" | "STARTS_WITH" | "REGEX">("CONTAINS");
  const [rulePriority, setRulePriority] = useState(0);
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [creatingRule, setCreatingRule] = useState(false);
  const [seedingRules, setSeedingRules] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);

  // Confirmations Queue States
  const [confirmingCatId, setConfirmingCatId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [catRes, budgetRes, ruleRes, unverifiedRes, tagRes] = await Promise.all([
        api<any>("/categories").catch(() => []),
        api<{ summary: any; budgets: CategoryBudgetItem[] }>(`/budgets?year=${selectedYear}&month=${selectedMonth}`).catch(() => ({ summary: { totalBudgeted: 0, totalSpent: 0, totalRemaining: 0, overallPercentage: 0, totalTransactionsCount: 0 }, budgets: [] })),
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
      if (!inspectedTagId && tagRes.length > 0) setInspectedTagId(tagRes[0].id);
    } catch (err) {
      setError(errorMessage(err, "Could not load budgets or categories."));
    } finally {
      setLoading(false);
    }
  }, [selectedCatId, ruleCategoryId, selectedTagForAuto, selectedMonth, selectedYear]);

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

  const totalUnverifiedCount = unverifiedCategories.reduce(
    (sum, g) => sum + (g.unverifiedCount ?? g.transactions?.length ?? 0),
    0
  );

  // TAG HANDLERS
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

  const handleRemoveTagFromTx = async (txId: string, tagId: string) => {
    try {
      await api("/tags/assign", {
        method: "POST",
        body: JSON.stringify({
          transactionIds: [txId],
          tagIds: [tagId],
          action: "REMOVE",
        }),
      });
      setSuccessMsg("Removed tag from transaction.");
      loadData();
      if (inspectedTagId) loadTagAnalytics(inspectedTagId);
    } catch (err) {
      setError(errorMessage(err, "Failed to remove tag."));
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
        body: JSON.stringify({
          categoryId: selectedCatId,
          monthlyLimit: val,
          month: selectedMonth,
          year: selectedYear,
        }),
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

  // RULE HANDLERS
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

  const handleApplyRules = async () => {
    setApplyingRules(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await api<{ updatedCount: number }>("/category-rules/apply", { method: "POST" });
      setSuccessMsg(`Retroactively categorized ${res.updatedCount || 0} transactions!`);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to apply rules retroactively."));
    } finally {
      setApplyingRules(false);
    }
  };

  const handleSeedRules = async () => {
    setSeedingRules(true);
    setError("");
    setSuccessMsg("");
    try {
      await api("/category-rules/seed-defaults", { method: "POST" });
      setSuccessMsg("Seeded default categorization rules.");
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to seed default rules."));
    } finally {
      setSeedingRules(false);
    }
  };

  const handleConfirmGroup = async (transactionIds: string[], categoryId: string) => {
    setConfirmingCatId(categoryId);
    setError("");
    setSuccessMsg("");
    try {
      await api("/category-rules/batch-update", {
        method: "POST",
        body: JSON.stringify({ transactionIds, categoryId }),
      });
      setSuccessMsg(`Categorized ${transactionIds.length} transactions!`);
      loadData();
    } catch (err) {
      setError(errorMessage(err, "Failed to confirm transaction group."));
    } finally {
      setConfirmingCatId(null);
    }
  };

  if (loading && categories.length === 0) {
    return (
      <Shell>
        <div className="panel" style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          <Loader2 className="spin" size={28} style={{ margin: "0 auto 12px auto", display: "block", color: "var(--green)" }} />
          <span>Loading Category Envelopes, Tags &amp; Rules Hub...</span>
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
            <span className="eyebrow" style={{ color: "var(--green)", fontWeight: 700 }}>Financial Governance &amp; Categorization</span>
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Category Budgets, Tags &amp; Rules</h1>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", background: "var(--background-alt)", padding: "4px", borderRadius: "10px", border: "1px solid var(--line)" }}>
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
              <FolderPlus size={15} color={activeTab === "CATEGORIES" ? "#3b82f6" : "var(--muted)"} />
              Categories ({categories.length})
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

        {/* TAB CONTENTS */}
        {activeTab === "ENVELOPES" && (
          <EnvelopesTab
            categories={categories}
            budgets={budgets}
            summary={summary}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={(m, y) => {
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
            selectedCatId={selectedCatId}
            setSelectedCatId={setSelectedCatId}
            limitInput={limitInput}
            setLimitInput={setLimitInput}
            savingBudget={savingBudget}
            deletingBudgetId={deletingBudgetId}
            handleSaveBudget={handleSaveBudget}
            handleDeleteBudget={handleDeleteBudget}
            setEditingCategory={setEditingCategory}
            setEditCatName={setEditCatName}
            setEditCatType={setEditCatType}
            setEditCatColor={setEditCatColor}
            setEditCatBudgetLimit={setEditCatBudgetLimit}
            onReload={loadData}
          />
        )}

        {activeTab === "CATEGORIES" && (
          <CategoriesTab
            categories={categories}
            onReload={loadData}
          />
        )}

        {activeTab === "TAGS" && (
          <TagsTab
            tags={tags}
            inspectedTagId={inspectedTagId}
            setInspectedTagId={setInspectedTagId}
            tagAnalytics={tagAnalytics}
            loadingTagAnalytics={loadingTagAnalytics}
            selectedTagForAuto={selectedTagForAuto}
            setSelectedTagForAuto={setSelectedTagForAuto}
            autoTagStart={autoTagStart}
            setAutoTagStart={setAutoTagStart}
            autoTagEnd={autoTagEnd}
            setAutoTagEnd={setAutoTagEnd}
            autoTagKeywords={autoTagKeywords}
            setAutoTagKeywords={setAutoTagKeywords}
            applyingAutoTag={applyingAutoTag}
            handleApplyAutoTag={handleApplyAutoTag}
            handleDeleteTag={handleDeleteTag}
            handleRemoveTagFromTx={handleRemoveTagFromTx}
            setEditingTag={setEditingTag}
            setTagName={setTagName}
            setTagColor={setTagColor}
            setTagDesc={setTagDesc}
            setTagStart={setTagStart}
            setTagEnd={setTagEnd}
            setTagBudget={setTagBudget}
            setTagModalOpen={setTagModalOpen}
          />
        )}

        {(activeTab === "RULES" || activeTab === "CONFIRMATIONS") && (
          <CategoryRulesTab
            categories={categories}
            rules={rules}
            unverifiedCategories={unverifiedCategories}
            rulePattern={rulePattern}
            setRulePattern={setRulePattern}
            ruleMatchField={ruleMatchField}
            setRuleMatchField={setRuleMatchField}
            ruleMatchType={ruleMatchType}
            setRuleMatchType={setRuleMatchType}
            rulePriority={rulePriority}
            setRulePriority={setRulePriority}
            ruleCategoryId={ruleCategoryId}
            setRuleCategoryId={setRuleCategoryId}
            creatingRule={creatingRule}
            seedingRules={seedingRules}
            applyingRules={applyingRules}
            confirmingCatId={confirmingCatId}
            handleCreateRule={handleCreateRule}
            handleDeleteRule={handleDeleteRule}
            handleApplyRules={handleApplyRules}
            handleSeedRules={handleSeedRules}
            handleConfirmGroup={handleConfirmGroup}
            activeTab={activeTab}
          />
        )}
      </div>
    </Shell>
  );
}
