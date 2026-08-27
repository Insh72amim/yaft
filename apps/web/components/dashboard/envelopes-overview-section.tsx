"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2,
  Search,
  Layers,
  X,
  CreditCard,
  Landmark,
  AlertCircle,
  Calendar,
  Utensils,
  Car,
  ShoppingCart,
  Zap,
  ShoppingBag,
  HeartPulse,
  Sparkles,
  Tag,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { api, errorMessage, money, formatMoney } from "@/lib/api";
import { CategoryPickerPopover, CategoryItem } from "@/components/category-picker-popover";
import { TransactionDrawer, DrawerTransactionItem } from "./transaction-drawer";

function getCategoryIcon(name: string = "", size = 15) {
  const n = name.toLowerCase();
  if (
    n.includes("food") ||
    n.includes("dining") ||
    n.includes("restaurant") ||
    n.includes("cafe") ||
    n.includes("swiggy") ||
    n.includes("zomato")
  ) {
    return <Utensils size={size} />;
  }
  if (
    n.includes("commute") ||
    n.includes("travel") ||
    n.includes("fuel") ||
    n.includes("transport") ||
    n.includes("uber") ||
    n.includes("ola") ||
    n.includes("metro")
  ) {
    return <Car size={size} />;
  }
  if (
    n.includes("grocer") ||
    n.includes("blinkit") ||
    n.includes("supermarket") ||
    n.includes("zepto") ||
    n.includes("instamart") ||
    n.includes("bigbasket")
  ) {
    return <ShoppingCart size={size} />;
  }
  if (
    n.includes("bill") ||
    n.includes("utility") ||
    n.includes("electric") ||
    n.includes("recharge") ||
    n.includes("broadband") ||
    n.includes("wifi")
  ) {
    return <Zap size={size} />;
  }
  if (
    n.includes("shop") ||
    n.includes("amazon") ||
    n.includes("flipkart") ||
    n.includes("myntra") ||
    n.includes("cloth") ||
    n.includes("fashion")
  ) {
    return <ShoppingBag size={size} />;
  }
  if (
    n.includes("health") ||
    n.includes("medical") ||
    n.includes("pharmacy") ||
    n.includes("doctor") ||
    n.includes("hospital")
  ) {
    return <HeartPulse size={size} />;
  }
  if (
    n.includes("invest") ||
    n.includes("mutual") ||
    n.includes("stock") ||
    n.includes("sip") ||
    n.includes("zerodha") ||
    n.includes("groww")
  ) {
    return <Sparkles size={size} />;
  }
  return <Tag size={size} />;
}

function formatCleanMerchant(merchant?: string, description?: string): string {
  const raw = (merchant || description || "Unknown Expense").trim();

  if (/^bharatpe\./i.test(raw)) return "BharatPe";
  if (/^paytm\./i.test(raw) || /^paytmqr/i.test(raw)) return "Paytm Merchant";
  if (/^googlepay\./i.test(raw) || /^gpay/i.test(raw)) return "Google Pay Merchant";
  if (/^phonepe\./i.test(raw)) return "PhonePe Merchant";
  if (/^hennesnmauritz/i.test(raw)) return "H&M (Hennes & Mauritz)";
  if (/^elior\s*india/i.test(raw)) return "Corporate Cafeteria";
  if (/^swiggy/i.test(raw)) return "Swiggy";
  if (/^zomato/i.test(raw)) return "Zomato";
  if (/^blinkit/i.test(raw)) return "Blinkit";
  if (/^zepto/i.test(raw)) return "Zepto";
  if (/^amazon/i.test(raw)) return "Amazon";
  if (/^flipkart/i.test(raw)) return "Flipkart";
  if (/^myntra/i.test(raw)) return "Myntra";
  if (/^uber/i.test(raw)) return "Uber";
  if (/^ola/i.test(raw)) return "Ola";
  if (/^irctc/i.test(raw)) return "IRCTC";

  if (raw === raw.toUpperCase() && raw.length > 3 && !raw.includes(".")) {
    return raw.charAt(0) + raw.slice(1).toLowerCase();
  }

  return raw;
}

function formatCleanNarration(rawDescription?: string, merchant?: string): string | null {
  if (!rawDescription) return null;
  let clean = rawDescription.trim();

  // Strip account suffix like [HDFC Bank ••1234]
  clean = clean.replace(/\s*\[.*?••\d{4}\]/g, "").trim();

  // If it's identical to the clean merchant, do not repeat
  if (merchant && clean.toLowerCase() === merchant.toLowerCase()) {
    return null;
  }

  return clean.length > 0 ? clean : null;
}

interface DateGroup {
  dateKey: string;
  displayDate: string;
  isToday: boolean;
  isYesterday: boolean;
  totalSpentMinor: number;
  totalCount: number;
  transactions: BudgetTransactionItem[];
}

function groupTransactionsByDate(txs: BudgetTransactionItem[]): DateGroup[] {
  const groups: Map<string, DateGroup> = new Map();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  for (const tx of txs) {
    const d = new Date(tx.transactionDate);
    const dateKey = !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "unknown";

    if (!groups.has(dateKey)) {
      const isToday = dateKey === todayStr;
      const isYesterday = dateKey === yesterdayStr;
      const displayDate = !isNaN(d.getTime())
        ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : "Unknown Date";

      groups.set(dateKey, {
        dateKey,
        displayDate,
        isToday,
        isYesterday,
        totalSpentMinor: 0,
        totalCount: 0,
        transactions: [],
      });
    }

    const grp = groups.get(dateKey)!;
    grp.transactions.push(tx);
    grp.totalCount += 1;
    const minor = tx.amountMinor ?? Math.round((tx.amount || 0) * 100);
    if (minor < 0) {
      grp.totalSpentMinor += Math.abs(minor);
    }
  }

  return Array.from(groups.values());
}

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

export function EnvelopesOverviewSection({
  selectedMonth,
  selectedYear,
  monthLabel,
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

  // Pagination for transactions table
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Active popover / drawer states
  const [activePopoverTxId, setActivePopoverTxId] = useState<string | null>(null);
  const [inspectedTx, setInspectedTx] = useState<BudgetTransactionItem | null>(null);
  const [updatingCatId, setUpdatingCatId] = useState<string | null>(null);

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

  // Strictly expense categories
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

  // Convert categories to CategoryItem format for popover
  const pickerCategories = useMemo<CategoryItem[]>(() => {
    return (categories || []).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      superCategoryId: c.superCategoryId,
      superCategoryName: c.superCategory?.name,
      superCategoryKind: c.superCategory?.kind,
      type: c.type,
    }));
  }, [categories]);

  // Handle in-place category re-assignment
  const handleCategoryChange = async (transactionId: string, newCategoryId: string) => {
    const selectedCategory = categories.find((c) => c.id === newCategoryId);
    const catName = selectedCategory?.name || "Uncategorised";
    const catColor = selectedCategory?.color || "#94a3b8";

    // Optimistic UI update
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              categoryId: newCategoryId || null,
              categoryName: catName,
              categoryColor: catColor,
            }
          : t
      )
    );

    if (inspectedTx && inspectedTx.id === transactionId) {
      setInspectedTx((prev) =>
        prev
          ? {
              ...prev,
              categoryId: newCategoryId || null,
              categoryName: catName,
              categoryColor: catColor,
            }
          : null
      );
    }

    setUpdatingCatId(transactionId);
    try {
      await api.post("/category-rules/batch-update", {
        transactionIds: [transactionId],
        categoryId: newCategoryId || null,
      });
      // Refresh totals in background
      await loadBudgetData();
    } catch (err) {
      alert(errorMessage(err, "Failed to update category."));
      await loadTransactions();
    } finally {
      setUpdatingCatId(null);
    }
  };

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return transactions.slice(start, start + pageSize);
  }, [transactions, page, pageSize]);

  // Group current page transactions by date
  const dateGroups = useMemo(() => {
    return groupTransactionsByDate(paginatedTransactions);
  }, [paginatedTransactions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "24px" }}>
      {/* ── Section 1: View-Only Expense Categories & Envelopes Grid ─────────────── */}
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

        {/* Categories Grid - View Only */}
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
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "8px",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease",
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
                {/* Header: Dot + Name + Count */}
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
                  </div>

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
                      <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                        No target
                      </span>
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
                      margin: "6px 0 4px 0",
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

      {/* ── Section 2: All Expense Transactions Explorer (Interactive Timeline) ─────────────── */}
      <section className="panel" style={{ padding: "24px", borderRadius: "16px" }}>
        {/* Header with Title & Stats */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "16px",
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
                ? `Showing charges and refunds for ${inspectedCategory.name} during ${monthLabel}. Click any row to view full details.`
                : `Showing ${transactions.length} expense transactions (${money((summary?.totalSpent ?? 0) * 100)} total outflow) during ${monthLabel}. Click any row to view full details.`}
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
                borderRadius: "10px",
                padding: "6px 12px",
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
                  width: "220px",
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
                    display: "flex",
                  }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "8px",
            marginBottom: "16px",
            scrollbarWidth: "none",
          }}>
          <button
            type="button"
            onClick={() => setInspectedCategoryId("all")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "20px",
              border: "1px solid var(--line)",
              fontSize: "12px",
              fontWeight: inspectedCategoryId === "all" ? 700 : 500,
              background: inspectedCategoryId === "all" ? "var(--ink)" : "var(--background-alt)",
              color: inspectedCategoryId === "all" ? "#ffffff" : "var(--ink)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}>
            All Expenses ({formatMoney((summary?.totalSpent ?? 0) * 100, { compact: true })})
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
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: isSelected ? `1.5px solid ${cat.color}` : "1px solid var(--line)",
                  fontSize: "12px",
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? `${cat.color}18` : "var(--card)",
                  color: isSelected ? cat.color : "var(--ink)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: cat.color,
                  }}
                />
                {cat.name} ({formatMoney(spent * 100, { compact: true })})
              </button>
            );
          })}
        </div>

        {/* Loading / Error / Empty states */}
        {loadingTx ? (
          <div style={{ textAlign: "center", padding: "48px", color: "var(--muted)" }}>
            <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px auto" }} />
            <p style={{ margin: 0, fontSize: "13px" }}>Loading expense transactions…</p>
          </div>
        ) : txError ? (
          <div style={{ textAlign: "center", padding: "32px", color: "#ef4444" }}>
            <AlertCircle size={20} style={{ margin: "0 auto 6px auto" }} />
            <p style={{ margin: 0, fontSize: "13px" }}>{txError}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--muted)", fontSize: "13px" }}>
            No expense transactions found for {inspectedCategory ? inspectedCategory.name : monthLabel}.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {dateGroups.map((group) => (
              <div key={group.dateKey} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {/* Sticky Date Timeline Group Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 12px",
                    background: "var(--background-alt)",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Calendar size={13} color="var(--green)" />
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 800,
                        color: "var(--ink)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}>
                      {group.isToday
                        ? `Today — ${group.displayDate}`
                        : group.isYesterday
                        ? `Yesterday — ${group.displayDate}`
                        : group.displayDate}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                    {group.totalCount} {group.totalCount === 1 ? "transaction" : "transactions"} • {money(group.totalSpentMinor)}
                  </span>
                </div>

                {/* Group Table */}
                <div
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    overflow: "hidden",
                    background: "var(--card)",
                  }}>
                  {group.transactions.map((tx, idx) => {
                    const isDebit = tx.amount < 0 || (tx.amountMinor ?? 0) < 0;
                    const absAmt = Math.abs(tx.amount || (tx.amountMinor ? tx.amountMinor / 100 : 0));
                    const cleanMerchant = formatCleanMerchant(tx.merchant, tx.description);
                    const cleanNarration = formatCleanNarration(tx.rawDescription, cleanMerchant);
                    const catColor = tx.categoryColor || "#3b82f6";
                    const isPopoverOpen = activePopoverTxId === tx.id;

                    return (
                      <div
                        key={tx.id}
                        onClick={() => setInspectedTx(tx)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 180px 180px 120px",
                          alignItems: "center",
                          padding: "12px 16px",
                          gap: "16px",
                          borderBottom:
                            idx === group.transactions.length - 1 ? "none" : "1px solid var(--line)",
                          cursor: "pointer",
                          transition: "background 0.12s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--background-alt)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}>
                        {/* Col 1: Avatar + Clean Merchant + Narration */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "10px",
                              background: `${catColor}15`,
                              border: `1px solid ${catColor}30`,
                              color: catColor,
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                            }}>
                            {getCategoryIcon(tx.categoryName, 16)}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <strong
                              style={{
                                color: "var(--ink)",
                                fontSize: "13.5px",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}>
                              {cleanMerchant}
                            </strong>
                            {cleanNarration && (
                              <span
                                style={{
                                  color: "var(--muted)",
                                  fontSize: "11px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  marginTop: "1px",
                                }}>
                                {cleanNarration}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Col 2: Account Badge */}
                        <div>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              color: "var(--muted)",
                              background: "var(--background-alt)",
                              border: "1px solid var(--line)",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              maxWidth: "160px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}>
                            {tx.accountType === "CREDIT_CARD" ? (
                              <CreditCard size={12} color="var(--green)" />
                            ) : (
                              <Landmark size={12} color="var(--muted)" />
                            )}
                            {tx.accountName}
                          </span>
                        </div>

                        {/* Col 3: Interactive Category Popover Dropdown + Tags */}
                        <div
                          style={{ position: "relative" }}
                          onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() =>
                              setActivePopoverTxId(isPopoverOpen ? null : tx.id)
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "6px",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              color: catColor,
                              background: `${catColor}12`,
                              border: `1px solid ${catColor}33`,
                              padding: "4px 10px",
                              borderRadius: "8px",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              maxWidth: "160px",
                            }}
                            title="Click to change category">
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: catColor,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}>
                              {tx.categoryName || "Uncategorised"}
                            </span>
                            <ChevronDown size={11} style={{ opacity: 0.7, flexShrink: 0 }} />
                          </button>

                          {isPopoverOpen && (
                            <CategoryPickerPopover
                              categories={pickerCategories}
                              currentCategoryId={tx.categoryId}
                              onSelect={(newCatId) => {
                                handleCategoryChange(tx.id, newCatId);
                                setActivePopoverTxId(null);
                              }}
                              onClose={() => setActivePopoverTxId(null)}
                            />
                          )}

                          {tx.tags && tx.tags.length > 0 && (
                            <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginTop: "4px" }}>
                              {tx.tags.map((tg) => (
                                <span
                                  key={tg.id}
                                  style={{
                                    fontSize: "9.5px",
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
                          )}
                        </div>

                        {/* Col 4: Monospace Tabular Amount */}
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontFamily: "'SF Mono', monospace",
                              fontSize: "14px",
                              fontWeight: 700,
                              letterSpacing: "-0.01em",
                              color: isDebit ? "#ef4444" : "var(--green)",
                            }}>
                            {isDebit ? `-${money(absAmt * 100)}` : `+${money(absAmt * 100)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "16px",
                  paddingTop: "14px",
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
                      padding: "5px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: page === 1 ? "var(--background-alt)" : "var(--card)",
                      color: page === 1 ? "var(--muted)" : "var(--ink)",
                      cursor: page === 1 ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}>
                    Previous
                  </button>
                  <span style={{ display: "flex", alignItems: "center", padding: "0 8px", fontWeight: 600 }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: page === totalPages ? "var(--background-alt)" : "var(--card)",
                      color: page === totalPages ? "var(--muted)" : "var(--ink)",
                      cursor: page === totalPages ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Transaction Slide-over Drawer */}
      <TransactionDrawer
        transaction={inspectedTx}
        categories={pickerCategories}
        onClose={() => setInspectedTx(null)}
        onCategoryChange={handleCategoryChange}
      />
    </div>
  );
}
