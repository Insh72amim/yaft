"use client";

import { useState, useMemo } from "react";
import {
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
  Check,
  Sparkles,
} from "lucide-react";
import { money } from "@/lib/api";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "HAS_TARGET" | "NO_TARGET" | "OVER_BUDGET">("ALL");

  // Inline editing state for quick limit updates directly in table row
  const [inlineEditingCatId, setInlineEditingCatId] = useState<string | null>(null);
  const [inlineLimitValue, setInlineLimitValue] = useState<string>("");

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

  const monthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  // Strictly ONLY Expense categories
  const expenseCategories = useMemo(
    () => (categories || []).filter((c) => (c?.type || "EXPENSE") === "EXPENSE"),
    [categories]
  );

  // Status counts for expense categories
  const counts = useMemo(() => {
    let withTarget = 0;
    let noTarget = 0;
    let overBudget = 0;

    for (const cat of expenseCategories) {
      const b = (budgets || []).find((item) => item?.categoryId === cat.id);
      if (b && b.hasBudget && b.monthlyLimit > 0) {
        withTarget++;
        if (b.status === "EXCEEDED") {
          overBudget++;
        }
      } else {
        noTarget++;
      }
    }
    return { total: expenseCategories.length, withTarget, noTarget, overBudget };
  }, [expenseCategories, budgets]);

  // Filtered expense categories based on search and status
  const filteredExpenseCategories = useMemo(() => {
    return expenseCategories.filter((cat) => {
      if (!cat) return false;
      const matchesSearch =
        !searchTerm.trim() ||
        cat.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (cat.superCategory?.name &&
          cat.superCategory.name.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      if (!matchesSearch) return false;

      const b = (budgets || []).find((item) => item?.categoryId === cat.id);
      const hasBudget = b && b.hasBudget && b.monthlyLimit > 0;

      if (statusFilter === "HAS_TARGET") return hasBudget;
      if (statusFilter === "NO_TARGET") return !hasBudget;
      if (statusFilter === "OVER_BUDGET") return hasBudget && b?.status === "EXCEEDED";

      return true;
    });
  }, [expenseCategories, budgets, searchTerm, statusFilter]);

  // Handle saving an inline limit directly
  const handleSaveInlineLimit = async (catId: string) => {
    setSelectedCatId(catId);
    setLimitInput(inlineLimitValue);
    setInlineEditingCatId(null);
    // Submit via standard form handler by simulating event
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSaveBudget(fakeEvent);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header: Month Switcher & High-Level Summary Stats */}
      <div
        className="panel"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          padding: "16px 20px",
          borderRadius: "12px",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--background-alt)",
              padding: "4px 8px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
            }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                color: "var(--ink)",
              }}>
              <ChevronLeft size={16} />
            </button>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                minWidth: "120px",
                textAlign: "center",
                color: "var(--ink)",
              }}>
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                color: "var(--ink)",
              }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={handleResetToCurrentMonth}
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                background: "transparent",
                border: "1px dashed var(--line)",
                padding: "4px 10px",
                borderRadius: "6px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}>
              <RefreshCw size={12} /> Current Month
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Total Allocated:{" "}
            <strong style={{ color: "var(--ink)", fontWeight: 800 }}>
              {money(summary.totalBudgeted * 100)}
            </strong>
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Total Spent:{" "}
            <strong style={{ color: "#ef4444", fontWeight: 800 }}>
              {money(summary.totalSpent * 100)}
            </strong>
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Utilization:{" "}
            <strong
              style={{
                color:
                  summary.overallPercentage > 100
                    ? "#ef4444"
                    : summary.overallPercentage >= 80
                    ? "#f59e0b"
                    : "var(--green)",
                fontWeight: 800,
              }}>
              {summary.overallPercentage}%
            </strong>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
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
              letterSpacing: "0.02em",
            }}>
            <Layers size={13} color="var(--green)" /> Total Envelopes Budget
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
            {counts.withTarget} of {counts.total} expense categories budgeted
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
              letterSpacing: "0.02em",
            }}>
            <ArrowUpRight size={13} color="#ef4444" /> Total Actual Outflows
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
              letterSpacing: "0.02em",
            }}>
            <ArrowDownLeft size={13} color="var(--green)" /> Remaining in Budget
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
            Remaining envelope allowance for {monthLabel}
          </small>
        </div>
      </div>

      {/* Quick Set / Assign Target Envelope Limit Form */}
      <section className="panel" style={{ padding: "20px", borderRadius: "12px" }}>
        <div className="panel-title" style={{ marginBottom: "14px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>
              Envelope Allocation
            </span>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0 }}>
              Set or Update Envelope Target Limit ({monthLabel})
            </h2>
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
              onChange={(e) => {
                setSelectedCatId(e.target.value);
                const b = (budgets || []).find((item) => item?.categoryId === e.target.value);
                if (b && b.hasBudget && b.monthlyLimit > 0) {
                  setLimitInput(String(b.monthlyLimit));
                } else {
                  setLimitInput("");
                }
              }}
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
              cursor: "pointer",
            }}>
            {savingBudget ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            <span>Save Target Limit</span>
          </button>
        </form>
      </section>

      {/* ── Redesigned Expense Envelopes & Target Limits Table ─────────────────────── */}
      <section className="panel" style={{ padding: "20px", borderRadius: "12px" }}>
        <div
          className="panel-title"
          style={{
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>
              Envelope Limits &amp; Management
            </span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
              Expense Envelopes &amp; Target Allocations ({filteredExpenseCategories.length})
            </h2>
          </div>

          {/* Search and Quick Status Filter Pills */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
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
                placeholder="Search expense category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "12px",
                  color: "var(--ink)",
                  outline: "none",
                  width: "180px",
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
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

            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                style={{
                  fontSize: "11.5px",
                  fontWeight: statusFilter === "ALL" ? 700 : 500,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid var(--line)",
                  background: statusFilter === "ALL" ? "var(--ink)" : "var(--background-alt)",
                  color: statusFilter === "ALL" ? "#ffffff" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}>
                All ({counts.total})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("HAS_TARGET")}
                style={{
                  fontSize: "11.5px",
                  fontWeight: statusFilter === "HAS_TARGET" ? 700 : 500,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid var(--line)",
                  background: statusFilter === "HAS_TARGET" ? "var(--green)" : "var(--background-alt)",
                  color: statusFilter === "HAS_TARGET" ? "#ffffff" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}>
                Budgeted ({counts.withTarget})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("NO_TARGET")}
                style={{
                  fontSize: "11.5px",
                  fontWeight: statusFilter === "NO_TARGET" ? 700 : 500,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid var(--line)",
                  background: statusFilter === "NO_TARGET" ? "var(--ink)" : "var(--background-alt)",
                  color: statusFilter === "NO_TARGET" ? "#ffffff" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}>
                No Target ({counts.noTarget})
              </button>

              {counts.overBudget > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("OVER_BUDGET")}
                  style={{
                    fontSize: "11.5px",
                    fontWeight: statusFilter === "OVER_BUDGET" ? 700 : 500,
                    padding: "4px 10px",
                    borderRadius: "20px",
                    border: "1px solid #ef444433",
                    background: statusFilter === "OVER_BUDGET" ? "#ef4444" : "rgba(239, 68, 68, 0.08)",
                    color: statusFilter === "OVER_BUDGET" ? "#ffffff" : "#ef4444",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}>
                  Over Budget ({counts.overBudget})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Clean, Modern Table */}
        <div className="table-responsive">
          <table className="data-table" style={{ width: "100%", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--line)" }}>
                <th style={{ width: "260px", padding: "12px 10px" }}>Expense Category</th>
                <th style={{ width: "220px", padding: "12px 10px" }}>Monthly Target Limit</th>
                <th style={{ width: "220px", padding: "12px 10px" }}>Current Outflow ({monthLabel})</th>
                <th style={{ width: "180px", padding: "12px 10px" }}>Envelope Status</th>
                <th style={{ width: "140px", padding: "12px 10px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenseCategories.map((cat) => {
                const budget = (budgets || []).find((b) => b?.categoryId === cat.id);
                const hasBudget = budget && budget.hasBudget && budget.monthlyLimit > 0;
                const limit = budget?.monthlyLimit ?? 0;
                const spent = budget?.spentAmount ?? 0;
                const pct = budget?.percentage ?? 0;
                const status = budget?.status ?? "NO_LIMIT";
                const txCount = budget?.transactionCount ?? 0;
                const catColor = cat.color || "#3b82f6";
                const isInlineEditing = inlineEditingCatId === cat.id;

                return (
                  <tr
                    key={cat.id}
                    style={{
                      borderBottom: "1px solid var(--line)",
                      transition: "background 0.1s ease",
                    }}>
                    {/* Column 1: Category Name, Dot, Supercategory & Tx count */}
                    <td style={{ padding: "12px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: catColor,
                            display: "inline-block",
                            flexShrink: 0,
                            boxShadow: `0 0 6px ${catColor}55`,
                          }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ color: "var(--ink)", fontWeight: 700, fontSize: "13.5px" }}>
                              {cat.name}
                            </strong>
                            {cat.superCategory && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  color: "var(--muted)",
                                  background: "var(--background-alt)",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid var(--line)",
                                }}>
                                {cat.superCategory.name}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                            {txCount} transaction{txCount === 1 ? "" : "s"} this month
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Monthly Target Limit with Inline Editing */}
                    <td style={{ padding: "12px 10px" }}>
                      {isInlineEditing ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ position: "relative", width: "120px" }}>
                            <span
                              style={{
                                position: "absolute",
                                left: "8px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "var(--muted)",
                                fontSize: "12px",
                                fontWeight: 700,
                              }}>
                              ₹
                            </span>
                            <input
                              type="number"
                              autoFocus
                              value={inlineLimitValue}
                              onChange={(e) => setInlineLimitValue(e.target.value)}
                              placeholder="e.g. 5000"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveInlineLimit(cat.id);
                                if (e.key === "Escape") setInlineEditingCatId(null);
                              }}
                              style={{
                                width: "100%",
                                height: "32px",
                                padding: "0 8px 0 20px",
                                fontSize: "13px",
                                fontWeight: 700,
                                borderRadius: "6px",
                                border: "1.5px solid var(--green)",
                                background: "var(--background-alt)",
                                color: "var(--ink)",
                                outline: "none",
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            title="Save"
                            onClick={() => handleSaveInlineLimit(cat.id)}
                            style={{
                              background: "var(--green)",
                              border: "none",
                              color: "#ffffff",
                              borderRadius: "6px",
                              padding: "6px",
                              cursor: "pointer",
                              display: "flex",
                            }}>
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            title="Cancel"
                            onClick={() => setInlineEditingCatId(null)}
                            style={{
                              background: "var(--background-alt)",
                              border: "1px solid var(--line)",
                              color: "var(--muted)",
                              borderRadius: "6px",
                              padding: "6px",
                              cursor: "pointer",
                              display: "flex",
                            }}>
                            <X size={13} />
                          </button>
                        </div>
                      ) : hasBudget ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "1px solid transparent",
                            transition: "all 0.15s ease",
                          }}
                          onClick={() => {
                            setInlineEditingCatId(cat.id);
                            setInlineLimitValue(String(limit));
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "var(--line)";
                            e.currentTarget.style.background = "var(--background-alt)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "transparent";
                            e.currentTarget.style.background = "transparent";
                          }}>
                          <strong style={{ color: "var(--ink)", fontSize: "13.5px" }}>
                            {money(limit * 100)}
                          </strong>
                          <span style={{ fontSize: "11px", color: "var(--muted)" }}>/ mo</span>
                          <Edit2 size={11} color="var(--muted)" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setInlineEditingCatId(cat.id);
                            setInlineLimitValue("");
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: "var(--green)",
                            background: "rgba(29, 117, 79, 0.08)",
                            border: "1px dashed rgba(29, 117, 79, 0.3)",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}>
                          <Plus size={12} /> Set Target Limit
                        </button>
                      )}
                    </td>

                    {/* Column 3: Current Outflow & Utilization Progress */}
                    <td style={{ padding: "12px 10px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "160px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <strong style={{ color: "var(--ink)", fontSize: "13px" }}>
                            {money(spent * 100)}
                          </strong>
                          {hasBudget && (
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
                          )}
                        </div>
                        <div
                          style={{
                            height: "4px",
                            width: "100%",
                            background: "var(--background-alt)",
                            borderRadius: "2px",
                            overflow: "hidden",
                          }}>
                          {hasBudget ? (
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
                    </td>

                    {/* Column 4: Envelope Status Badge */}
                    <td style={{ padding: "12px 10px" }}>
                      {hasBudget ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background:
                              status === "EXCEEDED"
                                ? "rgba(239, 68, 68, 0.1)"
                                : status === "WARNING"
                                ? "rgba(245, 158, 11, 0.1)"
                                : "rgba(29, 117, 79, 0.1)",
                            color:
                              status === "EXCEEDED"
                                ? "#ef4444"
                                : status === "WARNING"
                                ? "#f59e0b"
                                : "var(--green)",
                            border: `1px solid ${
                              status === "EXCEEDED"
                                ? "#ef444433"
                                : status === "WARNING"
                                ? "#f59e0b33"
                                : "rgba(29, 117, 79, 0.2)"
                            }`,
                          }}>
                          {status === "EXCEEDED"
                            ? `Over by ${money((spent - limit) * 100)}`
                            : status === "WARNING"
                            ? `Near limit (${money((limit - spent) * 100)} left)`
                            : `${money((limit - spent) * 100)} left`}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--muted)",
                            background: "var(--background-alt)",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                          }}>
                          No target set
                        </span>
                      )}
                    </td>

                    {/* Column 5: Actions */}
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          justifyContent: "flex-end",
                          alignItems: "center",
                        }}>
                        <button
                          type="button"
                          title={hasBudget ? "Edit Target Limit" : "Set Target Limit"}
                          onClick={() => {
                            setSelectedCatId(cat.id);
                            setLimitInput(hasBudget ? String(limit) : "");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            background: "var(--background-alt)",
                            color: "var(--ink)",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}>
                          <Edit2 size={11} />
                          <span>{hasBudget ? "Edit" : "Set"}</span>
                        </button>

                        {hasBudget && budget?.budgetId && (
                          <button
                            type="button"
                            title="Remove Target Limit"
                            onClick={() => handleDeleteBudget(budget.budgetId!)}
                            disabled={deletingBudgetId === budget.budgetId}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid #ef444433",
                              background: "rgba(239, 68, 68, 0.08)",
                              color: "#ef4444",
                              fontSize: "11.5px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                            }}>
                            {deletingBudgetId === budget.budgetId ? (
                              <Loader2 size={11} className="spin" />
                            ) : (
                              <Trash2 size={11} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredExpenseCategories.length === 0 && (
          <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--muted)", fontSize: "13px" }}>
            No expense categories found matching your search.
          </div>
        )}
      </section>
    </div>
  );
}
