"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Plus,
  Loader2,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Tag as TagIcon,
  CreditCard,
  Landmark,
  Zap,
} from "lucide-react";
import { api, errorMessage, money } from "@/lib/api";

export type SuperCategoryOption = {
  id: string;
  name: string;
  kind: "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER" | "OTHER";
  color: string;
  icon?: string | null;
  order?: number;
  categories?: { id: string; name: string; color: string; type: string }[];
  _count?: { categories: number };
};

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

interface EnvelopesTabProps {
  categories: CategoryOption[];
  budgets: CategoryBudgetItem[];
  summary: {
    totalBudgeted: number;
    totalSpent: number;
    totalRemaining: number;
    overallPercentage: number;
    totalTransactionsCount?: number;
  };
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
  selectedCatId: string;
  setSelectedCatId: (id: string) => void;
  limitInput: string;
  setLimitInput: (limit: string) => void;
  savingBudget: boolean;
  deletingBudgetId: string | null;
  handleSaveBudget: (e: React.FormEvent) => Promise<void>;
  handleDeleteBudget: (budgetId: string) => Promise<void>;
  setEditingCategory: (cat: CategoryOption | null) => void;
  setEditCatName: (name: string) => void;
  setEditCatType: (type: "EXPENSE" | "INCOME" | "INVESTMENT") => void;
  setEditCatColor: (color: string) => void;
  setEditCatBudgetLimit: (limit: string) => void;
  onReload: () => void;
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

export function EnvelopesTab({
  categories,
  budgets,
  summary,
  selectedMonth,
  selectedYear,
  onMonthChange,
  selectedCatId,
  setSelectedCatId,
  limitInput,
  setLimitInput,
  savingBudget,
  deletingBudgetId,
  handleSaveBudget,
  handleDeleteBudget,
  setEditingCategory,
  setEditCatName,
  setEditCatType,
  setEditCatColor,
  setEditCatBudgetLimit,
  onReload,
}: EnvelopesTabProps) {
  // Active inspected category for transactions drill-down ('all' for all expenses)
  const [inspectedCategoryId, setInspectedCategoryId] = useState<string>("all");
  const [transactions, setTransactions] = useState<BudgetTransactionItem[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txError, setTxError] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [updatingCatTxId, setUpdatingCatTxId] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<"ALL" | "EXCEEDED" | "WARNING" | "OK" | "NO_LIMIT">("ALL");

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      onMonthChange(12, selectedYear - 1);
    } else {
      onMonthChange(selectedMonth - 1, selectedYear);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      onMonthChange(1, selectedYear + 1);
    } else {
      onMonthChange(selectedMonth + 1, selectedYear);
    }
  };

  const currentNow = new Date();
  const isCurrentMonth =
    selectedMonth === currentNow.getMonth() + 1 &&
    selectedYear === currentNow.getFullYear();

  const handleResetToCurrentMonth = () => {
    onMonthChange(currentNow.getMonth() + 1, currentNow.getFullYear());
  };

  // Fetch transactions for the selected category & month
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
    } catch (err) {
      setTxError(errorMessage(err, "Failed to load budget transactions."));
    } finally {
      setLoadingTx(false);
    }
  }, [selectedMonth, selectedYear, inspectedCategoryId, txSearch]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Handle re-assigning category for a transaction
  const handleReassignCategory = async (
    transactionId: string,
    accountId: string,
    newCategoryId: string,
  ) => {
    setUpdatingCatTxId(transactionId);
    try {
      await api(`/accounts/${accountId}/transactions/${transactionId}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: newCategoryId || null }),
      });
      loadTransactions();
      onReload();
    } catch (err) {
      setTxError(errorMessage(err, "Could not update transaction category."));
    } finally {
      setUpdatingCatTxId(null);
    }
  };

  // Expense categories list
  const expenseCategories = useMemo(
    () => (categories || []).filter((c) => (c?.type || "EXPENSE") === "EXPENSE"),
    [categories],
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
      const budget = (budgets || []).find((b) => b?.categoryId === cat.id);
      const status = budget ? budget.status : "NO_LIMIT";

      if (categoryStatusFilter !== "ALL") {
        if (categoryStatusFilter === "EXCEEDED" && status !== "EXCEEDED") return false;
        if (categoryStatusFilter === "WARNING" && status !== "WARNING") return false;
        if (categoryStatusFilter === "OK" && status !== "OK") return false;
        if (categoryStatusFilter === "NO_LIMIT" && budget?.hasBudget) return false;
      }

      if (categorySearch && categorySearch.trim()) {
        const q = categorySearch.toLowerCase().trim();
        return (cat.name || "").toLowerCase().includes(q);
      }

      return true;
    });
  }, [expenseCategories, budgets, categoryStatusFilter, categorySearch]);

  // Inspected category details
  const inspectedCategory = useMemo(() => {
    if (inspectedCategoryId === "all") return null;
    return (categories || []).find((c) => c?.id === inspectedCategoryId) || null;
  }, [categories, inspectedCategoryId]);

  const inspectedBudget = useMemo(() => {
    if (inspectedCategoryId === "all") return null;
    return (budgets || []).find((b) => b?.categoryId === inspectedCategoryId) || null;
  }, [budgets, inspectedCategoryId]);

  // Filtered transactions based on local search
  const filteredTransactions = useMemo(() => {
    if (!txSearch || !txSearch.trim()) return transactions || [];
    const q = txSearch.toLowerCase().trim();
    return (transactions || []).filter(
      (t) =>
        (t.description || "").toLowerCase().includes(q) ||
        (t.merchant && t.merchant.toLowerCase().includes(q)) ||
        (t.accountName && t.accountName.toLowerCase().includes(q)),
    );
  }, [transactions, txSearch]);

  const monthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Month & Period Navigation Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "var(--card)",
          border: "1px solid var(--line)",
          padding: "12px 20px",
          borderRadius: "14px",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              className="icon-button"
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{
                background: "var(--background-alt)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                color: "var(--ink)",
              }}>
              <ChevronLeft size={16} />
            </button>
            <strong
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                color: "var(--ink)",
                minWidth: "150px",
                textAlign: "center",
              }}>
              {monthLabel}
            </strong>
            <button
              type="button"
              className="icon-button"
              onClick={handleNextMonth}
              title="Next Month"
              style={{
                background: "var(--background-alt)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                color: "var(--ink)",
              }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              className="secondary compact"
              onClick={handleResetToCurrentMonth}
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "6px",
                color: "var(--green)",
              }}>
              Jump to Current Month
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
            {summary.totalTransactionsCount || transactions.length} Total Expense Transactions Logged
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              onReload();
              loadTransactions();
            }}
            title="Refresh budget & transactions data"
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              padding: "6px 10px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--muted)",
            }}>
            <RefreshCw size={13} className={loadingTx ? "spin" : ""} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}>
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            padding: "16px 20px",
            borderRadius: "14px",
          }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
            <Calendar size={12} color="var(--green)" /> Total Monthly Envelope Budget
          </span>
          <strong
            style={{
              display: "block",
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "var(--ink)",
              marginTop: "6px",
            }}>
            {money(summary.totalBudgeted * 100)}
          </strong>
          <small
            style={{
              color: "var(--muted)",
              fontSize: "11px",
              marginTop: "4px",
              display: "block",
            }}>
            Target ceiling across all envelopes
          </small>
        </div>

        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            padding: "16px 20px",
            borderRadius: "14px",
          }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#3b82f6",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
            <ArrowUpRight size={13} color="#ef4444" /> Total Monthly Expenses Spent
          </span>
          <strong
            style={{
              display: "block",
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "#ef4444",
              marginTop: "6px",
            }}>
            {money(summary.totalSpent * 100)}
          </strong>
          <small
            style={{
              color: "var(--muted)",
              fontSize: "11px",
              marginTop: "4px",
              display: "block",
            }}>
            Actual debits minus refunds for {monthLabel}
          </small>
        </div>

        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            padding: "16px 20px",
            borderRadius: "14px",
          }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: summary.totalRemaining > 0 ? "var(--green)" : "#ef4444",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
            <ArrowDownLeft size={13} color="var(--green)" /> Total Remaining In Budget
          </span>
          <strong
            style={{
              display: "block",
              fontSize: "1.6rem",
              fontWeight: 800,
              color: summary.totalRemaining > 0 ? "var(--green)" : "#ef4444",
              marginTop: "6px",
            }}>
            {money(summary.totalRemaining * 100)}
          </strong>
          <small
            style={{
              color: "var(--muted)",
              fontSize: "11px",
              marginTop: "4px",
              display: "block",
            }}>
            Remaining allowance for {monthLabel}
          </small>
        </div>

        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            padding: "16px 20px",
            borderRadius: "14px",
          }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
            <Layers size={12} color="#f59e0b" /> Budget Envelope Utilization
          </span>
          <strong
            style={{
              display: "block",
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "var(--ink)",
              marginTop: "6px",
            }}>
            {summary.overallPercentage}%
          </strong>
          <div
            style={{
              height: "6px",
              width: "100%",
              background: "var(--background-alt)",
              borderRadius: "3px",
              overflow: "hidden",
              marginTop: "8px",
            }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, summary.overallPercentage)}%`,
                background:
                  summary.overallPercentage > 100
                    ? "#ef4444"
                    : summary.overallPercentage >= 80
                    ? "#f59e0b"
                    : "var(--green)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Set/Update Monthly Envelope Target Form */}
      <section className="panel" style={{ padding: "20px" }}>
        <div className="panel-title" style={{ marginBottom: "16px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>
              Envelope Allocation
            </span>
            <h2>Assign Target Monthly Spending Limit ({monthLabel})</h2>
          </div>
        </div>

        <form
          onSubmit={handleSaveBudget}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            alignItems: "end",
          }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--muted)",
                marginBottom: "6px",
              }}>
              Expense Category
            </label>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              style={{
                width: "100%",
                height: "40px",
                fontSize: "13px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "var(--background-alt)",
                color: "var(--ink)",
                fontWeight: 600,
              }}>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--muted)",
                marginBottom: "6px",
              }}>
              Monthly Target (₹)
            </label>
            <input
              type="number"
              placeholder="e.g. 15000"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              step="100"
              style={{
                width: "100%",
                height: "40px",
                fontSize: "13px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "var(--background-alt)",
                color: "var(--ink)",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={savingBudget}
            className="secondary compact"
            style={{
              height: "40px",
              padding: "0 20px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "var(--green)",
              color: "#ffffff",
              border: "none",
              fontWeight: 700,
              borderRadius: "8px",
            }}>
            {savingBudget ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <Plus size={16} />
            )}
            <span>Save Target Envelope</span>
          </button>
        </form>
      </section>

      {/* Expense Categories & Budget Envelopes Grid */}
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
            <h2>
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
                  background: isSelected
                    ? "rgba(29, 117, 79, 0.05)"
                    : "var(--card)",
                  border: isSelected
                    ? "1.5px solid var(--green)"
                    : "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "10px 13px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "7px",
                  cursor: "pointer",
                  boxShadow: isSelected
                    ? "0 2px 8px rgba(0,0,0,0.06)"
                    : "none",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "var(--ink)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "var(--line)";
                    e.currentTarget.style.transform = "none";
                  }
                }}>
                {/* Header: Dot + Name + Count + Action Icons */}
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
                        setEditingCategory(cat);
                        setEditCatName(cat.name || "");
                        setEditCatType((cat.type as any) || "EXPENSE");
                        setEditCatColor(cat.color || "#3b82f6");
                        setEditCatBudgetLimit(
                          budget && budget.hasBudget
                            ? String(budget.monthlyLimit || "")
                            : "",
                        );
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
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}>
                      <Edit2 size={11} />
                    </button>

                    {budget && budget.hasBudget && budget.budgetId && (
                      <button
                        type="button"
                        title="Remove Envelope Target"
                        onClick={() => handleDeleteBudget(budget.budgetId!)}
                        disabled={deletingBudgetId === budget.budgetId}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: "3px",
                          cursor: "pointer",
                          color: "var(--muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: "4px",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}>
                        {deletingBudgetId === budget.budgetId ? (
                          <Loader2 size={11} className="spin" />
                        ) : (
                          <Trash2 size={11} />
                        )}
                      </button>
                    )}
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
                          setEditingCategory(cat);
                          setEditCatName(cat.name || "");
                          setEditCatType((cat.type as any) || "EXPENSE");
                          setEditCatColor(cat.color || "#3b82f6");
                          setEditCatBudgetLimit("");
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

      {/* Interactive Category Expense Transactions Ledger Explorer */}
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

        {/* Quick Category Filter Pills */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "12px",
            marginBottom: "16px",
          }}>
          <button
            type="button"
            className={`secondary compact ${inspectedCategoryId === "all" ? "active" : ""}`}
            onClick={() => setInspectedCategoryId("all")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}>
            <span>All Expenses ({summary.totalSpent ? money(summary.totalSpent * 100) : "₹0"})</span>
          </button>

          {expenseCategories.map((c) => {
            const b = budgets.find((item) => item.categoryId === c.id);
            const isCatSelected = inspectedCategoryId === c.id;
            const spent = b ? b.spentAmount : 0;
            return (
              <button
                key={c.id}
                type="button"
                className={`secondary compact ${isCatSelected ? "active" : ""}`}
                onClick={() => setInspectedCategoryId(c.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  borderLeft: `3px solid ${c.color}`,
                }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: c.color,
                  }}
                />
                <span>{c.name}</span>
                <span
                  style={{
                    fontSize: "11px",
                    color: isCatSelected ? "var(--green)" : "var(--muted)",
                    fontWeight: 700,
                  }}>
                  ({money(spent * 100)})
                </span>
              </button>
            );
          })}
        </div>

        {/* Transactions Table Content */}
        {loadingTx ? (
          <div
            className="loading"
            style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>
            <Loader2
              className="spin"
              size={24}
              style={{ margin: "0 auto 10px auto", display: "block", color: "var(--green)" }}
            />
            <p>Loading transactions for {inspectedCategory ? inspectedCategory.name : "expenses"}...</p>
          </div>
        ) : txError ? (
          <div
            style={{
              padding: "16px",
              background: "rgba(239, 68, 68, 0.1)",
              borderRadius: "10px",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
            }}>
            <AlertCircle size={16} />
            <span>{txError}</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              background: "var(--background-alt)",
              borderRadius: "12px",
              border: "1px dashed var(--line)",
            }}>
            <TagIcon size={28} color="var(--muted)" style={{ margin: "0 auto 8px auto", display: "block" }} />
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
              No transactions logged for this category in {monthLabel}
            </h3>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
              {txSearch
                ? `No transactions match search "${txSearch}".`
                : "Transactions with this category will automatically populate here as they occur."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                fontSize: "12px",
                borderCollapse: "collapse",
              }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--line)",
                    textAlign: "left",
                    color: "var(--muted)",
                  }}>
                  <th style={{ padding: "10px 8px" }}>Date</th>
                  <th style={{ padding: "10px 8px" }}>Description / Merchant</th>
                  <th style={{ padding: "10px 8px" }}>Account</th>
                  <th style={{ padding: "10px 8px" }}>Category</th>
                  <th style={{ padding: "10px 8px" }}>Tags</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const isDebit = tx.amount < 0;
                  const txDateStr = new Date(tx.transactionDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: "1px solid var(--line)",
                        transition: "background 0.1s ease",
                      }}>
                      <td
                        style={{
                          padding: "10px 8px",
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}>
                        {txDateStr}
                      </td>

                      <td style={{ padding: "10px 8px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <strong
                            style={{
                              fontSize: "13px",
                              color: "var(--ink)",
                              fontWeight: 700,
                            }}>
                            {tx.merchant || tx.description}
                          </strong>
                          {tx.rawDescription && tx.rawDescription !== tx.merchant && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--muted)",
                                maxWidth: "340px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                              {tx.rawDescription}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "var(--background-alt)",
                            border: "1px solid var(--line)",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "var(--ink)",
                          }}>
                          {tx.accountType === "CREDIT_CARD" ? (
                            <CreditCard size={12} color="#ef4444" />
                          ) : tx.accountType === "UPI_LITE" ? (
                            <Zap size={12} color="#f59e0b" />
                          ) : (
                            <Landmark size={12} color="#3b82f6" />
                          )}
                          <span>{tx.accountName}</span>
                        </span>
                      </td>

                      <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                        <select
                          value={tx.categoryId || "uncategorised"}
                          onChange={(e) =>
                            handleReassignCategory(
                              tx.id,
                              tx.accountId,
                              e.target.value === "uncategorised"
                                ? ""
                                : e.target.value,
                            )
                          }
                          disabled={updatingCatTxId === tx.id}
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            border: `1px solid ${tx.categoryColor}40`,
                            background: `${tx.categoryColor}15`,
                            color: tx.categoryColor,
                            cursor: "pointer",
                          }}>
                          <option value="uncategorised">Uncategorised</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={{ padding: "10px 8px" }}>
                        {tx.tags && tx.tags.length > 0 ? (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {tx.tags.map((tg) => (
                              <span
                                key={tg.id}
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: `${tg.color}20`,
                                  color: tg.color,
                                  fontSize: "10px",
                                  fontWeight: 700,
                                }}>
                                #{tg.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>—</span>
                        )}
                      </td>

                      <td
                        style={{
                          padding: "10px 8px",
                          textAlign: "right",
                          fontWeight: 800,
                          fontSize: "13px",
                          color: isDebit ? "#ef4444" : "var(--green)",
                          whiteSpace: "nowrap",
                        }}>
                        {isDebit
                          ? `-${money(Math.abs(tx.amount * 100))}`
                          : `+${money(Math.abs(tx.amount * 100))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
