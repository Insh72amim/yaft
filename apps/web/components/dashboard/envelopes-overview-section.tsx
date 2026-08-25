"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  X,
  Tag as TagIcon,
  CreditCard,
  Landmark,
  Zap,
} from "lucide-react";
import { api, errorMessage, money } from "@/lib/api";

export type CategoryOption = {
  id: string;
  name: string;
  type?: "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER" | "OTHER";
  color: string;
  superCategoryId?: string | null;
  superCategory?: {
    id: string;
    name: string;
    kind: "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER" | "OTHER";
    color: string;
  } | null;
};

export type CategoryBudgetItem = {
  id: string;
  budgetId: string | null;
  hasBudget: boolean;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  monthlyLimit: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  status: "OK" | "WARNING" | "EXCEEDED" | "NO_LIMIT";
  transactionCount: number;
  month?: number;
  year?: number;
};

export type BudgetTransactionItem = {
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
};

interface EnvelopesOverviewSectionProps {
  selectedMonth: number;
  selectedYear: number;
  monthLabel: string;
  onBudgetUpdated?: () => void;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function EnvelopesOverviewSection({
  selectedMonth,
  selectedYear,
  monthLabel,
  onBudgetUpdated,
}: EnvelopesOverviewSectionProps) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudgetItem[]>([]);
  const [summary, setSummary] = useState<{
    totalBudgeted: number;
    totalSpent: number;
    totalRemaining: number;
    overallPercentage: number;
    totalTransactionsCount?: number;
  }>({
    totalBudgeted: 0,
    totalSpent: 0,
    totalRemaining: 0,
    overallPercentage: 0,
    totalTransactionsCount: 0,
  });

  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");

  // Category inspection & filter states
  const [inspectedCategoryId, setInspectedCategoryId] = useState<string>("all");
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<
    "ALL" | "EXCEEDED" | "WARNING" | "OK" | "NO_LIMIT"
  >("ALL");

  // Transactions state
  const [transactions, setTransactions] = useState<BudgetTransactionItem[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txError, setTxError] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [updatingCatTxId, setUpdatingCatTxId] = useState<string | null>(null);

  // Pagination for transactions table
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Quick edit envelope modal state
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<CategoryOption | null>(null);
  const [editLimitInput, setEditLimitInput] = useState("");
  const [savingEditLimit, setSavingEditLimit] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  // Load categories and budget limits for the selected month/year
  const loadBudgetData = useCallback(async () => {
    setLoadingData(true);
    setDataError("");
    try {
      const [catsRes, budgetsRes] = await Promise.all([
        api<CategoryOption[]>("/categories"),
        api<{
          budgets: CategoryBudgetItem[];
          summary: {
            totalBudgeted: number;
            totalSpent: number;
            totalRemaining: number;
            overallPercentage: number;
            totalTransactionsCount?: number;
          };
        }>(`/budgets?month=${selectedMonth}&year=${selectedYear}`),
      ]);

      setCategories(catsRes || []);
      setBudgets(budgetsRes.budgets || []);
      setSummary(
        budgetsRes.summary || {
          totalBudgeted: 0,
          totalSpent: 0,
          totalRemaining: 0,
          overallPercentage: 0,
          totalTransactionsCount: 0,
        }
      );
    } catch (err) {
      setDataError(errorMessage(err, "Failed to load budget envelopes."));
    } finally {
      setLoadingData(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadBudgetData();
  }, [loadBudgetData]);

  // Load transactions based on month and inspected category filter
  const loadTransactions = useCallback(async () => {
    setLoadingTx(true);
    setTxError("");
    try {
      const query = new URLSearchParams({
        month: String(selectedMonth),
        year: String(selectedYear),
      });
      if (inspectedCategoryId && inspectedCategoryId !== "all") {
        query.set("categoryId", inspectedCategoryId);
      }
      if (txSearch.trim()) {
        query.set("search", txSearch.trim());
      }

      const res = await api<{
        transactions: BudgetTransactionItem[];
        summary: {
          totalSpent: number;
          totalRefunds: number;
          netOutflow: number;
          count: number;
        };
      }>(`/budgets/transactions?${query.toString()}`);
      setTransactions(res.transactions || []);
      setPage(1);
    } catch (err) {
      setTxError(errorMessage(err, "Failed to load budget transactions."));
    } finally {
      setLoadingTx(false);
    }
  }, [selectedMonth, selectedYear, inspectedCategoryId, txSearch]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Re-assign transaction category
  const handleReassignCategory = async (
    transactionId: string,
    accountId: string,
    newCategoryId: string
  ) => {
    setUpdatingCatTxId(transactionId);
    try {
      await api(`/accounts/${accountId}/transactions/${transactionId}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: newCategoryId || null }),
      });
      loadTransactions();
      loadBudgetData();
      onBudgetUpdated?.();
    } catch (err) {
      setTxError(errorMessage(err, "Could not update transaction category."));
    } finally {
      setUpdatingCatTxId(null);
    }
  };

  // Quick save target limit for category
  const handleSaveQuickLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudgetCategory) return;
    setSavingEditLimit(true);
    try {
      const val = parseFloat(editLimitInput.replace(/,/g, ""));
      if (isNaN(val) || val < 0) {
        throw new Error("Enter a valid amount.");
      }
      await api("/budgets", {
        method: "POST",
        body: JSON.stringify({
          categoryId: editingBudgetCategory.id,
          monthlyLimit: val,
          periodType: "MONTHLY",
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      setEditingBudgetCategory(null);
      loadBudgetData();
      onBudgetUpdated?.();
    } catch (err) {
      alert(errorMessage(err, "Failed to save budget limit."));
    } finally {
      setSavingEditLimit(false);
    }
  };

  // Quick delete target limit
  const handleDeleteQuickLimit = async (budgetId: string) => {
    if (!confirm("Are you sure you want to remove this envelope target?")) return;
    setDeletingBudgetId(budgetId);
    try {
      await api(`/budgets/${budgetId}`, { method: "DELETE" });
      setEditingBudgetCategory(null);
      loadBudgetData();
      onBudgetUpdated?.();
    } catch (err) {
      alert(errorMessage(err, "Failed to remove budget limit."));
    } finally {
      setDeletingBudgetId(null);
    }
  };

  // Expense categories
  const expenseCategories = useMemo(
    () => (categories || []).filter((c) => (c?.type || "EXPENSE") === "EXPENSE"),
    [categories]
  );

  // Category counts by status for quick filter pills
  const categoryCounts = useMemo(() => {
    let exceeded = 0;
    let warning = 0;
    let ok = 0;
    let noLimit = 0;

    for (const cat of expenseCategories || []) {
      if (!cat) continue;
      const budget = (budgets || []).find((b) => b?.categoryId === cat.id);
      if (!budget || !budget.hasBudget) {
        noLimit++;
      } else if (budget.status === "EXCEEDED") {
        exceeded++;
      } else if (budget.status === "WARNING") {
        warning++;
      } else {
        ok++;
      }
    }
    return { exceeded, warning, ok, noLimit, total: (expenseCategories || []).length };
  }, [expenseCategories, budgets]);

  // Filtered expense categories based on search query and status pill
  const filteredExpenseCategories = useMemo(() => {
    return (expenseCategories || []).filter((cat) => {
      if (!cat) return false;
      const matchesSearch =
        !categorySearch.trim() ||
        cat.name.toLowerCase().includes(categorySearch.toLowerCase().trim());

      if (!matchesSearch) return false;

      const budget = (budgets || []).find((b) => b?.categoryId === cat.id);
      const status = budget?.status || "NO_LIMIT";

      if (categoryStatusFilter === "ALL") return true;
      if (categoryStatusFilter === "EXCEEDED") return status === "EXCEEDED";
      if (categoryStatusFilter === "WARNING") return status === "WARNING";
      if (categoryStatusFilter === "OK") return status === "OK";
      if (categoryStatusFilter === "NO_LIMIT") return !budget || !budget.hasBudget || status === "NO_LIMIT";

      return true;
    });
  }, [expenseCategories, budgets, categorySearch, categoryStatusFilter]);

  const inspectedCategory = useMemo(() => {
    if (!inspectedCategoryId || inspectedCategoryId === "all") return null;
    return (categories || []).find((c) => c?.id === inspectedCategoryId) || null;
  }, [categories, inspectedCategoryId]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return transactions.slice(start, start + pageSize);
  }, [transactions, page, pageSize]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "24px" }}>
      {/* ── Section 1: Expense Categories & Budget Envelopes Grid ─────────────────── */}
      <section className="panel" style={{ padding: "20px" }}>
        <div
          className="panel-title"
          style={{
            marginBottom: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>
              Real-Time Outflows &amp; Envelope Status
            </span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
              Expense Categories &amp; Envelopes ({expenseCategories.length}) — {monthLabel}
            </h2>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`secondary compact ${inspectedCategoryId === "all" ? "active" : ""}`}
              onClick={() => setInspectedCategoryId("all")}
              style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: "8px",
                background: inspectedCategoryId === "all" ? "var(--ink)" : "var(--background-alt)",
                color: inspectedCategoryId === "all" ? "#ffffff" : "var(--ink)",
                border: "1px solid var(--line)",
                cursor: "pointer",
              }}>
              View All Expenses ({summary?.totalSpent ? money(summary.totalSpent * 100) : "₹0"})
            </button>
          </div>
        </div>

        {/* Quick Status Filter Pills & Search Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "16px",
          }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setCategoryStatusFilter("ALL")}
              style={{
                fontSize: "11.5px",
                fontWeight: categoryStatusFilter === "ALL" ? 700 : 500,
                padding: "4px 10px",
                borderRadius: "20px",
                border: "1px solid var(--line)",
                background: categoryStatusFilter === "ALL" ? "var(--ink)" : "var(--background-alt)",
                color: categoryStatusFilter === "ALL" ? "var(--card)" : "var(--muted)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}>
              All ({categoryCounts.total})
            </button>
            {categoryCounts.exceeded > 0 && (
              <button
                type="button"
                onClick={() => setCategoryStatusFilter("EXCEEDED")}
                style={{
                  fontSize: "11.5px",
                  fontWeight: categoryStatusFilter === "EXCEEDED" ? 700 : 500,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid #ef444433",
                  background: categoryStatusFilter === "EXCEEDED" ? "#ef4444" : "rgba(239, 68, 68, 0.08)",
                  color: categoryStatusFilter === "EXCEEDED" ? "#ffffff" : "#ef4444",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}>
                Over Budget ({categoryCounts.exceeded})
              </button>
            )}
            {categoryCounts.warning > 0 && (
              <button
                type="button"
                onClick={() => setCategoryStatusFilter("WARNING")}
                style={{
                  fontSize: "11.5px",
                  fontWeight: categoryStatusFilter === "WARNING" ? 700 : 500,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid #f59e0b33",
                  background: categoryStatusFilter === "WARNING" ? "#f59e0b" : "rgba(245, 158, 11, 0.08)",
                  color: categoryStatusFilter === "WARNING" ? "#ffffff" : "#f59e0b",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}>
                Near Limit ({categoryCounts.warning})
              </button>
            )}
            {categoryCounts.ok > 0 && (
              <button
                type="button"
                onClick={() => setCategoryStatusFilter("OK")}
                style={{
                  fontSize: "11.5px",
                  fontWeight: categoryStatusFilter === "OK" ? 700 : 500,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid var(--line)",
                  background: categoryStatusFilter === "OK" ? "var(--green)" : "var(--background-alt)",
                  color: categoryStatusFilter === "OK" ? "#ffffff" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}>
                On Track ({categoryCounts.ok})
              </button>
            )}
            {categoryCounts.noLimit > 0 && (
              <button
                type="button"
                onClick={() => setCategoryStatusFilter("NO_LIMIT")}
                style={{
                  fontSize: "11.5px",
                  fontWeight: categoryStatusFilter === "NO_LIMIT" ? 700 : 500,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid var(--line)",
                  background: categoryStatusFilter === "NO_LIMIT" ? "var(--ink)" : "var(--background-alt)",
                  color: categoryStatusFilter === "NO_LIMIT" ? "var(--card)" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}>
                No Target ({categoryCounts.noLimit})
              </button>
            )}
          </div>

          <div style={{ position: "relative", minWidth: "180px", maxWidth: "240px", flex: "1" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Search categories..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              style={{
                width: "100%",
                height: "32px",
                fontSize: "12px",
                padding: "0 10px 0 30px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "var(--background-alt)",
                color: "var(--ink)",
              }}
            />
            {categorySearch && (
              <button
                type="button"
                onClick={() => setCategorySearch("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: 0,
                }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Categories Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: "10px",
          }}>
          {(filteredExpenseCategories || []).map((cat) => {
            if (!cat) return null;
            const budget = (budgets || []).find((b) => b?.categoryId === cat.id);
            const spent = budget?.spentAmount ?? 0;
            const limit = budget?.monthlyLimit ?? 0;
            const pct = budget?.percentage ?? 0;
            const status = budget?.status ?? "NO_LIMIT";
            const txCount = budget?.transactionCount ?? 0;
            const isSelected = inspectedCategoryId === cat.id;
            const catColor = cat.color || "#3b82f6";
            const catName = cat.name || "Unnamed Category";

            return (
              <div
                key={cat.id}
                onClick={() => setInspectedCategoryId(cat.id)}
                style={{
                  background: isSelected ? "rgba(29, 117, 79, 0.05)" : "var(--card)",
                  border: isSelected ? "1.5px solid var(--green)" : "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "10px 13px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "7px",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}>
                {/* Header: Dot + Name + Count + Edit Icon */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      minWidth: 0,
                    }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: catColor,
                        display: "inline-block",
                        flexShrink: 0,
                        boxShadow: `0 0 5px ${catColor}55`,
                      }}
                    />
                    <strong
                      style={{
                        fontSize: "12.5px",
                        color: "var(--ink)",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                      {catName}
                    </strong>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--muted)",
                        fontWeight: 600,
                        background: "var(--background-alt)",
                        padding: "1px 5px",
                        borderRadius: "8px",
                        flexShrink: 0,
                      }}>
                      {txCount}
                    </span>
                  </div>

                  <div
                    style={{ display: "flex", gap: "2px", alignItems: "center" }}
                    onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      title={budget && budget.hasBudget ? "Edit Target Limit" : "Set Target Limit"}
                      onClick={() => {
                        setEditingBudgetCategory(cat);
                        setEditLimitInput(budget && budget.hasBudget ? String(budget.monthlyLimit || "") : "");
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: "3px",
                        cursor: "pointer",
                        color: "var(--muted)",
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: "4px",
                      }}>
                      <Edit2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Amounts & Percentage Row */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                    }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                      <span style={{ fontSize: "1.02rem", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                        {money(spent * 100)}
                      </span>
                      {budget && budget.hasBudget ? (
                        <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                          / {money(limit * 100)}
                        </span>
                      ) : (
                        <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                          spent
                        </span>
                      )}
                    </div>

                    {budget && budget.hasBudget ? (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          color:
                            status === "EXCEEDED"
                              ? "#ef4444"
                              : status === "WARNING"
                              ? "#f59e0b"
                              : "var(--green)",
                        }}>
                        {pct}%
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBudgetCategory(cat);
                          setEditLimitInput("");
                        }}
                        style={{
                          fontSize: "10.5px",
                          color: "var(--green)",
                          fontWeight: 600,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}>
                        + Set Target
                      </button>
                    )}
                  </div>

                  {/* Slim Progress Track */}
                  <div
                    style={{
                      width: "100%",
                      height: "3.5px",
                      background: "var(--background-alt)",
                      borderRadius: "2px",
                      overflow: "hidden",
                      margin: "5px 0 4px 0",
                    }}>
                    {budget && budget.hasBudget ? (
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, Math.max(0, pct))}%`,
                          background:
                            status === "EXCEEDED"
                              ? "#ef4444"
                              : status === "WARNING"
                              ? "#f59e0b"
                              : "var(--green)",
                          borderRadius: "2px",
                        }}
                      />
                    ) : (
                      <div style={{ height: "100%", width: "0%" }} />
                    )}
                  </div>
                </div>

                {/* Status Footer Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "10.5px",
                  }}>
                  {budget && budget.hasBudget ? (
                    <span
                      style={{
                        color:
                          status === "EXCEEDED"
                            ? "#ef4444"
                            : status === "WARNING"
                            ? "#f59e0b"
                            : "var(--muted)",
                        fontWeight: 600,
                      }}>
                      {status === "EXCEEDED"
                        ? `Over by ${money(((spent || 0) - (limit || 0)) * 100)}`
                        : status === "WARNING"
                        ? `Near ceiling (${money(((limit || 0) - (spent || 0)) * 100)} left)`
                        : `${money(((limit || 0) - (spent || 0)) * 100)} left`}
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: "10.5px" }}>
                      No target set
                    </span>
                  )}

                  {isSelected && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "var(--green)",
                      }}>
                      Viewing ledger &darr;
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredExpenseCategories.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--muted)", fontSize: "13px" }}>
            No categories match your search or filter.
          </div>
        )}
      </section>

      {/* ── Section 2: All Expense Transactions Explorer ────────────────────────── */}
      <section className="panel" style={{ padding: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "20px",
            borderBottom: "1px solid var(--line)",
            paddingBottom: "16px",
          }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {inspectedCategory ? (
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: inspectedCategory.color,
                    display: "inline-block",
                  }}
                />
              ) : (
                <Layers size={18} color="var(--green)" />
              )}
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>
                {inspectedCategory
                  ? `${inspectedCategory.name} Transactions`
                  : `All Expense Transactions (${monthLabel})`}
              </h2>
            </div>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "12px",
                color: "var(--muted)",
              }}>
              {inspectedCategory
                ? `Showing all charges and refunds for ${inspectedCategory.name} during ${monthLabel}.`
                : `Showing all categorized and unbudgeted expense transactions during ${monthLabel}.`}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--background-alt)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "4px 10px",
              }}>
              <Search size={14} color="var(--muted)" />
              <input
                type="text"
                placeholder="Search merchant or narration..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "12px",
                  color: "var(--ink)",
                  outline: "none",
                  width: "200px",
                }}
              />
              {txSearch && (
                <button
                  type="button"
                  onClick={() => setTxSearch("")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    color: "var(--muted)",
                  }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Filter Pills (Horizontal Scroll) */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "12px",
            marginBottom: "16px",
            scrollbarWidth: "thin",
          }}>
          <button
            type="button"
            onClick={() => setInspectedCategoryId("all")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              fontSize: "12px",
              fontWeight: inspectedCategoryId === "all" ? 700 : 500,
              background: inspectedCategoryId === "all" ? "var(--ink)" : "var(--background-alt)",
              color: inspectedCategoryId === "all" ? "#ffffff" : "var(--ink)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
            All Expenses ({summary?.totalSpent ? money(summary.totalSpent * 100) : "₹0"})
          </button>

          {(expenseCategories || []).map((cat) => {
            if (!cat) return null;
            const b = (budgets || []).find((item) => item?.categoryId === cat.id);
            const spent = b?.spentAmount ?? 0;
            const isSelected = inspectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setInspectedCategoryId(cat.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: isSelected ? `1.5px solid ${cat.color}` : "1px solid var(--line)",
                  fontSize: "12px",
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? `${cat.color}15` : "var(--card)",
                  color: isSelected ? cat.color : "var(--ink)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: cat.color,
                  }}
                />
                {cat.name} ({money(spent * 100)})
              </button>
            );
          })}
        </div>

        {/* Transactions Table */}
        {loadingTx ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
            <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px auto" }} />
            <p style={{ margin: 0, fontSize: "13px" }}>Loading transactions…</p>
          </div>
        ) : txError ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#ef4444" }}>
            <AlertCircle size={20} style={{ margin: "0 auto 6px auto" }} />
            <p style={{ margin: 0, fontSize: "13px" }}>{txError}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)", fontSize: "13px" }}>
            No expense transactions found for {inspectedCategory ? inspectedCategory.name : monthLabel}.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: "100%", fontSize: "12.5px" }}>
              <thead>
                <tr>
                  <th style={{ width: "110px" }}>Date</th>
                  <th>Description / Merchant</th>
                  <th style={{ width: "160px" }}>Account</th>
                  <th style={{ width: "160px" }}>Category</th>
                  <th style={{ width: "120px" }}>Tags</th>
                  <th style={{ width: "110px", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx) => {
                  const isDebit = tx.amount < 0 || tx.amountMinor! < 0;
                  const absAmt = Math.abs(tx.amount || (tx.amountMinor ? tx.amountMinor / 100 : 0));
                  return (
                    <tr key={tx.id}>
                      <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {new Date(tx.transactionDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong style={{ color: "var(--ink)" }}>{tx.merchant || tx.description}</strong>
                          {tx.rawDescription && tx.rawDescription !== tx.merchant && (
                            <small style={{ color: "var(--muted)", fontSize: "10.5px" }}>
                              {tx.rawDescription}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            color: "var(--muted)",
                            background: "var(--background-alt)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}>
                          {tx.accountType === "CREDIT_CARD" ? (
                            <CreditCard size={11} />
                          ) : (
                            <Landmark size={11} />
                          )}
                          {tx.accountName}
                        </span>
                      </td>
                      <td>
                        <select
                          value={tx.categoryId || ""}
                          disabled={updatingCatTxId === tx.id}
                          onChange={(e) => handleReassignCategory(tx.id, tx.accountId, e.target.value)}
                          style={{
                            fontSize: "11.5px",
                            padding: "3px 6px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            background: "var(--card)",
                            color: tx.categoryColor || "var(--ink)",
                            fontWeight: 600,
                            maxWidth: "140px",
                          }}>
                          <option value="">Uncategorised</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {tx.tags && tx.tags.length > 0 ? (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {tx.tags.map((tg) => (
                              <span
                                key={tg.id}
                                style={{
                                  fontSize: "10px",
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  background: `${tg.color}20`,
                                  color: tg.color,
                                  fontWeight: 600,
                                }}>
                                {tg.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <strong
                          style={{
                            color: isDebit ? "#ef4444" : "var(--green)",
                            fontWeight: 700,
                          }}>
                          {isDebit ? `-${money(absAmt * 100)}` : `+${money(absAmt * 100)}`}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "16px",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--line)",
                  fontSize: "12px",
                  color: "var(--muted)",
                }}>
                <span>
                  Showing {(page - 1) * pageSize + 1}–
                  {Math.min(transactions.length, page * pageSize)} of {transactions.length}
                </span>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      background: page === 1 ? "var(--background-alt)" : "var(--card)",
                      color: page === 1 ? "var(--muted)" : "var(--ink)",
                      cursor: page === 1 ? "not-allowed" : "pointer",
                    }}>
                    Previous
                  </button>
                  <span style={{ display: "flex", alignItems: "center", padding: "0 8px" }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      background: page === totalPages ? "var(--background-alt)" : "var(--card)",
                      color: page === totalPages ? "var(--muted)" : "var(--ink)",
                      cursor: page === totalPages ? "not-allowed" : "pointer",
                    }}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Quick Edit Envelope Target Modal */}
      {editingBudgetCategory && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setEditingBudgetCategory(null)}>
          <div
            className="panel"
            style={{
              maxWidth: "400px",
              width: "100%",
              padding: "24px",
              borderRadius: "12px",
              background: "var(--card)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: editingBudgetCategory.color,
                  }}
                />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                  {editingBudgetCategory.name} Envelope
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBudgetCategory(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickLimit}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "var(--muted)",
                  marginBottom: "6px",
                  fontWeight: 600,
                }}>
                Monthly Target Limit (₹) for {monthLabel}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="e.g. 5000"
                value={editLimitInput}
                onChange={(e) => setEditLimitInput(e.target.value)}
                style={{
                  width: "100%",
                  height: "38px",
                  fontSize: "14px",
                  fontWeight: 700,
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--background-alt)",
                  color: "var(--ink)",
                  marginBottom: "16px",
                }}
              />

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                {(() => {
                  const existingBudget = (budgets || []).find(
                    (b) => b?.categoryId === editingBudgetCategory.id
                  );
                  if (existingBudget && existingBudget.hasBudget && existingBudget.budgetId) {
                    return (
                      <button
                        type="button"
                        onClick={() => handleDeleteQuickLimit(existingBudget.budgetId!)}
                        disabled={deletingBudgetId === existingBudget.budgetId}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid #ef444433",
                          background: "rgba(239, 68, 68, 0.08)",
                          color: "#ef4444",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          marginRight: "auto",
                        }}>
                        {deletingBudgetId === existingBudget.budgetId ? (
                          <Loader2 size={12} className="spin" />
                        ) : (
                          "Remove Target"
                        )}
                      </button>
                    );
                  }
                  return null;
                })()}

                <button
                  type="button"
                  onClick={() => setEditingBudgetCategory(null)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "var(--background-alt)",
                    color: "var(--ink)",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditLimit}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--green)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}>
                  {savingEditLimit ? <Loader2 size={12} className="spin" /> : "Save Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
