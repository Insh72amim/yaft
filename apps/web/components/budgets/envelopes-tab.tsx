"use client";

import { useState, useMemo } from "react";
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
  FolderPlus,
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
  const [typeFilter, setTypeFilter] = useState<"ALL" | "EXPENSE" | "INCOME" | "INVESTMENT">("EXPENSE");

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

  // Expense categories list
  const expenseCategories = useMemo(
    () => (categories || []).filter((c) => (c?.type || "EXPENSE") === "EXPENSE"),
    [categories]
  );

  // Filtered categories for configuration table
  const filteredCategories = useMemo(() => {
    return (categories || []).filter((cat) => {
      if (!cat) return false;
      const matchesSearch =
        !searchTerm.trim() ||
        cat.name.toLowerCase().includes(searchTerm.toLowerCase().trim());
      if (!matchesSearch) return false;

      if (typeFilter !== "ALL" && (cat.type || "EXPENSE") !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [categories, searchTerm, typeFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Bar: Month Navigation & Status Summary */}
      <div
        className="panel"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          padding: "16px 20px",
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
              <RefreshCw size={12} /> Reset to Current Month
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Total Budgeted: <strong style={{ color: "var(--ink)" }}>{money(summary.totalBudgeted * 100)}</strong>
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Target Utilization: <strong style={{ color: summary.overallPercentage > 100 ? "#ef4444" : "var(--green)" }}>{summary.overallPercentage}%</strong>
          </div>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
            }}>
            <Layers size={12} color="var(--green)" /> Total Envelopes Budget
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
            Sum of all assigned envelope targets
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
            <ArrowUpRight size={13} color="#ef4444" /> Total Actual Spent
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
            Actual outflows for {monthLabel}
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
      </div>

      {/* Set or Update Budget Envelope Form */}
      <section className="panel" style={{ padding: "20px" }}>
        <div className="panel-title" style={{ marginBottom: "16px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>
              Envelope Configuration
            </span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
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
              cursor: "pointer",
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

      {/* Category Envelopes & Target Limits Configuration Table */}
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
              Envelope Limits &amp; Management
            </span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
              All Envelopes &amp; Category Limits ({filteredCategories.length})
            </h2>
          </div>

          {/* Search and Type Filter */}
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
                placeholder="Search categories..."
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

            <div style={{ display: "flex", gap: "4px" }}>
              {(["EXPENSE", "INCOME", "ALL"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    fontSize: "11px",
                    fontWeight: typeFilter === t ? 700 : 500,
                    background: typeFilter === t ? "var(--ink)" : "var(--background-alt)",
                    color: typeFilter === t ? "#ffffff" : "var(--muted)",
                    cursor: "pointer",
                  }}>
                  {t === "ALL" ? "All Types" : t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: "100%", fontSize: "13px" }}>
            <thead>
              <tr>
                <th style={{ width: "240px" }}>Category Name</th>
                <th style={{ width: "140px" }}>Type</th>
                <th style={{ width: "180px" }}>Monthly Target Limit</th>
                <th style={{ width: "160px" }}>Current Spend ({monthLabel})</th>
                <th style={{ width: "120px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((cat) => {
                const budget = (budgets || []).find((b) => b?.categoryId === cat.id);
                const hasBudget = budget && budget.hasBudget;
                const limit = budget?.monthlyLimit ?? 0;
                const spent = budget?.spentAmount ?? 0;
                const catColor = cat.color || "#3b82f6";

                return (
                  <tr key={cat.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: catColor,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <strong style={{ color: "var(--ink)", fontWeight: 700 }}>
                          {cat.name}
                        </strong>
                        {cat.superCategory && (
                          <span
                            style={{
                              fontSize: "10.5px",
                              color: "var(--muted)",
                              background: "var(--background-alt)",
                              padding: "1px 6px",
                              borderRadius: "4px",
                            }}>
                            {cat.superCategory.name}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background:
                            cat.type === "INCOME"
                              ? "rgba(16, 185, 129, 0.1)"
                              : "rgba(59, 130, 246, 0.1)",
                          color: cat.type === "INCOME" ? "var(--green)" : "#3b82f6",
                        }}>
                        {cat.type || "EXPENSE"}
                      </span>
                    </td>

                    <td>
                      {hasBudget ? (
                        <strong style={{ color: "var(--ink)", fontSize: "13px" }}>
                          {money(limit * 100)} / month
                        </strong>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: "12px" }}>
                          No target set
                        </span>
                      )}
                    </td>

                    <td>
                      <span style={{ color: spent > 0 ? "var(--ink)" : "var(--muted)", fontWeight: 600 }}>
                        {money(spent * 100)}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                        <button
                          type="button"
                          title="Edit Target Limit"
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
                          <span>{hasBudget ? "Edit Limit" : "Set Limit"}</span>
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
      </section>
    </div>
  );
}
