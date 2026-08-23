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

export type CategoryOption = {
  id: string;
  name: string;
  type?: "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER";
  color: string;
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
    () => categories.filter((c) => (c.type || "EXPENSE") === "EXPENSE"),
    [categories],
  );

  // Inspected category details
  const inspectedCategory = useMemo(() => {
    if (inspectedCategoryId === "all") return null;
    return categories.find((c) => c.id === inspectedCategoryId) || null;
  }, [categories, inspectedCategoryId]);

  const inspectedBudget = useMemo(() => {
    if (inspectedCategoryId === "all") return null;
    return budgets.find((b) => b.categoryId === inspectedCategoryId) || null;
  }, [budgets, inspectedCategoryId]);

  // Filtered transactions based on local search
  const filteredTransactions = useMemo(() => {
    if (!txSearch.trim()) return transactions;
    const q = txSearch.toLowerCase().trim();
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
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
            marginBottom: "16px",
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

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
              View All Expenses ({summary.totalSpent ? money(summary.totalSpent * 100) : "₹0"})
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
            gap: "16px",
          }}>
          {expenseCategories.map((cat) => {
            const budget = budgets.find((b) => b.categoryId === cat.id);
            const spent = budget ? budget.spentAmount : 0;
            const limit = budget ? budget.monthlyLimit : 0;
            const pct = budget ? budget.percentage : 0;
            const status = budget ? budget.status : "NO_LIMIT";
            const txCount = budget ? budget.transactionCount : 0;
            const isSelected = inspectedCategoryId === cat.id;

            return (
              <div
                key={cat.id}
                style={{
                  background: isSelected
                    ? "rgba(29, 117, 79, 0.04)"
                    : "var(--background-alt)",
                  border: isSelected
                    ? "2px solid var(--green)"
                    : budget && budget.hasBudget
                    ? status === "EXCEEDED"
                      ? "1px solid #ef4444"
                      : status === "WARNING"
                      ? "1px solid #f59e0b"
                      : "1px solid var(--line)"
                    : "1px dashed var(--line)",
                  borderRadius: "14px",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "14px",
                  boxShadow: isSelected
                    ? "0 4px 16px rgba(0,0,0,0.06)"
                    : "none",
                  transition: "all 0.15s ease",
                }}>
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
                      gap: "10px",
                    }}>
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background: cat.color,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <strong
                        style={{
                          fontSize: "14px",
                          color: "var(--ink)",
                          display: "block",
                        }}>
                        {cat.name}
                      </strong>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--muted)",
                          fontWeight: 600,
                        }}>
                        {txCount} transaction{txCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="icon-button"
                      title="Edit Category & Monthly Envelope Limit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCategory(cat);
                        setEditCatName(cat.name);
                        setEditCatType((cat.type as any) || "EXPENSE");
                        setEditCatColor(cat.color || "#3b82f6");
                        setEditCatBudgetLimit(
                          budget && budget.hasBudget
                            ? String(budget.monthlyLimit)
                            : "",
                        );
                      }}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: "11px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        color: "var(--ink)",
                      }}>
                      <Edit2 size={12} />
                      <span>{budget && budget.hasBudget ? "Edit" : "Set Target"}</span>
                    </button>

                    {budget && budget.hasBudget && budget.budgetId && (
                      <button
                        type="button"
                        className="icon-button danger"
                        title="Remove Envelope Target"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBudget(budget.budgetId!);
                        }}
                        disabled={deletingBudgetId === budget.budgetId}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--line)",
                          borderRadius: "6px",
                          padding: "6px",
                          cursor: "pointer",
                          color: "#ef4444",
                        }}>
                        {deletingBudgetId === budget.budgetId ? (
                          <Loader2 size={13} className="spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {budget && budget.hasBudget ? (
                  <>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          marginBottom: "6px",
                        }}>
                        <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                          Spent vs Target
                        </span>
                        <span style={{ fontWeight: 800, color: "var(--ink)" }}>
                          {money(spent * 100)} / {money(limit * 100)}
                        </span>
                      </div>

                      <div
                        style={{
                          width: "100%",
                          height: "7px",
                          background: "var(--line)",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, pct)}%`,
                            background:
                              status === "EXCEEDED"
                                ? "#ef4444"
                                : status === "WARNING"
                                ? "#f59e0b"
                                : "var(--green)",
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "11px",
                      }}>
                      <span
                        style={{
                          color:
                            status === "EXCEEDED"
                              ? "#ef4444"
                              : status === "WARNING"
                              ? "#f59e0b"
                              : "var(--muted)",
                          fontWeight: 700,
                        }}>
                        {status === "EXCEEDED"
                          ? `Over budget by ${money((spent - limit) * 100)}`
                          : status === "WARNING"
                          ? `Near ceiling (${pct}%)`
                          : `${money((limit - spent) * 100)} remaining`}
                      </span>
                      <span style={{ fontWeight: 800, color: "var(--ink)" }}>
                        {pct}%
                      </span>
                    </div>
                  </>
                ) : (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                        Current Outflow:
                      </span>
                      <strong style={{ fontSize: "14px", color: "var(--ink)", fontWeight: 700 }}>
                        {money(spent * 100)}
                      </strong>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "11px",
                        color: "var(--muted)",
                      }}>
                      No target spending envelope assigned.
                    </p>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "6px",
                    borderTop: "1px solid var(--line)",
                  }}>
                  <button
                    type="button"
                    onClick={() => setInspectedCategoryId(cat.id)}
                    className={`secondary compact ${isSelected ? "active" : ""}`}
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "6px 12px",
                      borderRadius: "8px",
                    }}>
                    <span>
                      {isSelected
                        ? `Viewing ${cat.name} (${txCount})`
                        : `View Transactions (${txCount})`}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
