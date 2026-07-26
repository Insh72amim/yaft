"use client";

import {
  CreditCard,
  Landmark,
  QrCode,
  Receipt,
  Search,
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  Workflow,
  X,
  RotateCcw,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/shell";
import { api, errorMessage, isUnauthorized, money } from "@/lib/api";
import { SpendRulesModal } from "@/components/spend-rules-modal";

type Mode = "CREDIT_CARD" | "BANK" | "UPI" | "ALL";

type Summary = {
  totalSpent: number;
  totalReceived: number;
  netTotal: number;
  totalCount: number;
};

type Transaction = {
  id: string;
  accountId: string;
  accountName: string;
  accountType: string;
  accountInstitution: string | null;
  cardLast4: string | null;
  transactionDate: string;
  postedDate: string | null;
  description: string;
  details: string | null;
  amount: number;
  categoryId: string | null;
  category: string;
  categoryColor: string;
  isTransfer: boolean;
};

type Category = {
  id: string;
  name: string;
  color: string;
};

type AccountOption = {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  cardLast4: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
};

type TransactionsApiResponse = {
  summary: Summary;
  transactions: Transaction[];
  categories: Category[];
  accounts: AccountOption[];
  pagination: Pagination;
};

export default function TransactionsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("CREDIT_CARD");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");
  const [categoryId, setCategoryId] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [showFilters, setShowFilters] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TransactionsApiResponse | null>(null);
  const [error, setError] = useState("");
  const [updatingCatId, setUpdatingCatId] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        mode,
        page: String(page),
      });
      if (search.trim()) query.set("search", search.trim());
      if (typeFilter !== "ALL") query.set("type", typeFilter);
      if (categoryId !== "all") query.set("categoryId", categoryId);
      if (accountId !== "all") query.set("accountId", accountId);
      if (minAmount.trim()) query.set("minAmount", minAmount.trim());
      if (maxAmount.trim()) query.set("maxAmount", maxAmount.trim());
      if (startDate) query.set("startDate", startDate);
      if (endDate) query.set("endDate", endDate);

      const res = await api<TransactionsApiResponse>(
        `/accounts/transactions/all?${query.toString()}`,
      );
      setData(res);
    } catch (err) {
      if (isUnauthorized(err)) {
        router.replace("/login");
        return;
      }
      setError(errorMessage(err, "Failed to load transactions."));
    } finally {
      setLoading(false);
    }
  }, [mode, page, search, typeFilter, categoryId, accountId, minAmount, maxAmount, startDate, endDate, router]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setPage(1);
    setAccountId("all");
  };

  const handleCategoryUpdate = async (
    targetAccountId: string,
    transactionId: string,
    newCategoryId: string,
  ) => {
    setUpdatingCatId(transactionId);
    try {
      const res = await api<{
        id: string;
        categoryId: string | null;
        category: string;
        categoryColor: string;
      }>(`/accounts/${targetAccountId}/transactions/${transactionId}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: newCategoryId || null }),
      });

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          transactions: prev.transactions.map((tx) =>
            tx.id === transactionId
              ? {
                  ...tx,
                  categoryId: res.categoryId,
                  category: res.category,
                  categoryColor: res.categoryColor,
                }
              : tx,
          ),
        };
      });
    } catch (err) {
      setError(errorMessage(err, "Could not update transaction category."));
    } finally {
      setUpdatingCatId(null);
    }
  };

  const activeFilterCount =
    (categoryId !== "all" ? 1 : 0) +
    (typeFilter !== "ALL" ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (accountId !== "all" ? 1 : 0);

  const resetFilters = () => {
    setCategoryId("all");
    setSearch("");
    setMinAmount("");
    setMaxAmount("");
    setStartDate("");
    setEndDate("");
    setTypeFilter("ALL");
    setAccountId("all");
    setPage(1);
  };

  const filteredAccounts = data?.accounts.filter((acc) => {
    if (mode === "CREDIT_CARD") return acc.type === "CREDIT_CARD";
    if (mode === "BANK") return ["BANK", "SAVINGS", "FIXED_DEPOSIT"].includes(acc.type);
    return true;
  }) ?? [];

  return (
    <Shell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Financial Ledger</span>
          <h1>Transactions &amp; Activity</h1>
          <p>
            Filter, categorize, and track complete transaction history across Credit Cards, Bank Accounts, and UPI payments.
          </p>
        </div>
      </header>

      {/* Mode Sub-Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "12px",
          overflowX: "auto",
        }}>
        <button
          type="button"
          className={`secondary ${mode === "CREDIT_CARD" ? "active" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "10px",
            fontWeight: 600,
          }}
          onClick={() => handleModeChange("CREDIT_CARD")}>
          <CreditCard size={18} />
          <span>All Credit Cards</span>
        </button>

        <button
          type="button"
          className={`secondary ${mode === "BANK" ? "active" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "10px",
            fontWeight: 600,
          }}
          onClick={() => handleModeChange("BANK")}>
          <Landmark size={18} />
          <span>Bank Accounts</span>
        </button>

        <button
          type="button"
          className={`secondary ${mode === "UPI" ? "active" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "10px",
            fontWeight: 600,
          }}
          onClick={() => handleModeChange("UPI")}>
          <QrCode size={18} />
          <span>UPI Payments</span>
        </button>

        <button
          type="button"
          className={`secondary ${mode === "ALL" ? "active" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "10px",
            fontWeight: 600,
          }}
          onClick={() => handleModeChange("ALL")}>
          <Receipt size={18} />
          <span>All Transactions</span>
        </button>
      </div>

      {error && (
        <p className="error" role="alert" style={{ marginBottom: "16px" }}>
          {error}
        </p>
      )}

      {/* Summary KPI Cards */}
      {data?.summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}>
          <div
            className="panel"
            style={{
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}>
            <span
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}>
              <ArrowUpRight size={15} color="#ef4444" />
              {mode === "CREDIT_CARD"
                ? "Total Credit Charges"
                : mode === "BANK"
                ? "Total Outflows"
                : mode === "UPI"
                ? "Total UPI Outflow"
                : "Total Debits / Expenses"}
            </span>
            <strong
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--ink)",
              }}>
              {money(-data.summary.totalSpent)}
            </strong>
          </div>

          <div
            className="panel"
            style={{
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}>
            <span
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}>
              <ArrowDownLeft size={15} color="#10b981" />
              {mode === "CREDIT_CARD"
                ? "Total Card Refunds & Payments"
                : mode === "BANK"
                ? "Total Inflows"
                : mode === "UPI"
                ? "Total UPI Inflow"
                : "Total Credits / Income"}
            </span>
            <strong
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#10b981",
              }}>
              {money(data.summary.totalReceived)}
            </strong>
          </div>

          <div
            className="panel"
            style={{
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}>
            <span
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}>
              <Layers size={15} />
              Total Matching Records
            </span>
            <strong
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--ink)",
              }}>
              {data.summary.totalCount} records
            </strong>
          </div>
        </div>
      )}

      {/* Main Ledger Filter Control Toolbar (Matched with Overview/AccountLedger) */}
      <div
        className="panel"
        style={{
          padding: "16px",
          marginBottom: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: "1 1 auto", alignItems: "center" }}>
            {/* Category Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Tag size={15} color="var(--muted)" />
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                style={{
                  height: "38px",
                  fontSize: "13px",
                  padding: "0 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--background)",
                  color: "var(--ink)",
                  fontWeight: 600,
                  margin: 0,
                  width: "auto",
                }}>
                <option value="all">All Categories</option>
                <option value="uncategorised">Uncategorised</option>
                <option value="transfers">Internal Transfers</option>
                {(data?.categories || []).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Bar */}
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: "180px" }}>
              <Search
                size={16}
                color="var(--muted)"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                placeholder="Search description or merchant..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: "100%",
                  height: "38px",
                  fontSize: "13px",
                  paddingLeft: "36px",
                  paddingRight: search ? "32px" : "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--background)",
                  color: "var(--ink)",
                  margin: 0,
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px",
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                  }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Type Segmented Controls */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                background: "var(--background)",
                padding: "3px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
              }}>
              <button
                type="button"
                className={`secondary compact ${typeFilter === "ALL" ? "active" : ""}`}
                onClick={() => {
                  setTypeFilter("ALL");
                  setPage(1);
                }}
                style={{
                  height: "32px",
                  padding: "0 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "6px",
                }}>
                All
              </button>
              <button
                type="button"
                className={`secondary compact ${typeFilter === "EXPENSE" ? "active" : ""}`}
                onClick={() => {
                  setTypeFilter("EXPENSE");
                  setPage(1);
                }}
                style={{
                  height: "32px",
                  padding: "0 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "6px",
                  color: typeFilter === "EXPENSE" ? "#ef4444" : undefined,
                }}>
                Debits
              </button>
              <button
                type="button"
                className={`secondary compact ${typeFilter === "INCOME" ? "active" : ""}`}
                onClick={() => {
                  setTypeFilter("INCOME");
                  setPage(1);
                }}
                style={{
                  height: "32px",
                  padding: "0 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "6px",
                  color: typeFilter === "INCOME" ? "#10b981" : undefined,
                }}>
                Credits
              </button>
            </div>

            {/* Reset Button */}
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="ghost compact"
                onClick={resetFilters}
                style={{
                  height: "38px",
                  fontSize: "12px",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                }}>
                <RotateCcw size={14} /> Reset ({activeFilterCount})
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Category Rules Modal Toggle */}
            <button
              type="button"
              className="secondary compact"
              onClick={() => setShowRulesModal(true)}
              style={{
                height: "38px",
                fontSize: "12px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "0 12px",
                borderRadius: "8px",
              }}>
              <Workflow size={14} /> Category Rules
            </button>

            {/* Expand Advanced Filters Toggle */}
            <button
              type="button"
              className={`secondary compact ${showFilters ? "active" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
              style={{
                height: "38px",
                fontSize: "12px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "0 12px",
                borderRadius: "8px",
              }}>
              <SlidersHorizontal size={14} /> Filters
              {activeFilterCount > 0 && (
                <span
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    fontSize: "10px",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Expandable Advanced Filter Drawer */}
        {showFilters && (
          <div
            style={{
              paddingTop: "12px",
              borderTop: "1px solid var(--line)",
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
            }}>
            {/* Account Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Account</label>
              <select
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setPage(1);
                }}
                style={{
                  height: "34px",
                  fontSize: "12px",
                  margin: 0,
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--background)",
                  color: "var(--ink)",
                }}>
                <option value="all">
                  {mode === "CREDIT_CARD"
                    ? "All Credit Cards"
                    : mode === "BANK"
                    ? "All Bank Accounts"
                    : "All Accounts"}
                </option>
                {filteredAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}{" "}
                    {acc.cardLast4 ? `(••••${acc.cardLast4})` : acc.institution ? `· ${acc.institution}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Min Amount */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Min Amount (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value);
                  setPage(1);
                }}
                style={{
                  height: "34px",
                  fontSize: "12px",
                  width: "110px",
                  margin: 0,
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--background)",
                  color: "var(--ink)",
                }}
              />
            </div>

            {/* Max Amount */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Max Amount (₹)</label>
              <input
                type="number"
                placeholder="Max"
                value={maxAmount}
                onChange={(e) => {
                  setMaxAmount(e.target.value);
                  setPage(1);
                }}
                style={{
                  height: "34px",
                  fontSize: "12px",
                  width: "110px",
                  margin: 0,
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--background)",
                  color: "var(--ink)",
                }}
              />
            </div>

            {/* Start Date */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                style={{
                  height: "34px",
                  fontSize: "12px",
                  margin: 0,
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--background)",
                  color: "var(--ink)",
                }}
              />
            </div>

            {/* End Date */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                style={{
                  height: "34px",
                  fontSize: "12px",
                  margin: 0,
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--background)",
                  color: "var(--ink)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="loading" style={{ padding: "40px" }}>
            <span />
            <p>Loading transactions...</p>
          </div>
        ) : !data?.transactions.length ? (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              color: "var(--muted)",
            }}>
            <Receipt size={40} style={{ marginBottom: "12px", opacity: 0.5 }} />
            <h3>No transactions match your criteria</h3>
            <p style={{ fontSize: "14px", marginTop: "4px" }}>
              Try clearing your search query, adjusting amount limits, or changing dates.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              className="holdings-table"
              style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Date</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Account</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Merchant / Description</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Category</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => {
                  const isDebit = tx.amount < 0;
                  return (
                    <tr
                      key={tx.id}
                      style={{ borderBottom: "1px solid var(--line)" }}>
                      <td
                        style={{
                          padding: "12px 16px",
                          whiteSpace: "nowrap",
                          fontSize: "13px",
                          color: "var(--muted)",
                          fontWeight: 500,
                        }}>
                        {new Date(tx.transactionDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td
                        style={{
                          padding: "12px 16px",
                          whiteSpace: "nowrap",
                        }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background: "var(--card-hover)",
                            border: "1px solid var(--line)",
                          }}>
                          {tx.accountType === "CREDIT_CARD" ? (
                            <CreditCard size={13} color="var(--accent)" />
                          ) : (
                            <Landmark size={13} color="#0ea5e9" />
                          )}
                          <span>{tx.accountName}</span>
                          {tx.cardLast4 && (
                            <span style={{ opacity: 0.7, fontFamily: "monospace" }}>
                              ••••{tx.cardLast4}
                            </span>
                          )}
                        </span>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "14px",
                            color: "var(--ink)",
                          }}>
                          {tx.description}
                        </div>
                        {tx.details && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--muted)",
                              marginTop: "2px",
                            }}>
                            {tx.details}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: tx.categoryColor || "#94a3b8",
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                          <select
                            value={tx.categoryId || ""}
                            disabled={updatingCatId === tx.id}
                            style={{
                              margin: 0,
                              padding: "3px 8px",
                              fontSize: "12px",
                              width: "auto",
                              borderRadius: "6px",
                              border: "1px solid var(--line)",
                              background: "var(--background)",
                              color: "var(--ink)",
                              fontWeight: 500,
                            }}
                            onChange={(e) =>
                              handleCategoryUpdate(
                                tx.accountId,
                                tx.id,
                                e.target.value,
                              )
                            }>
                            <option value="">Uncategorised</option>
                            {data.categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                          color: isDebit ? "#ef4444" : "#10b981",
                        }}>
                        {isDebit ? money(tx.amount) : `+${money(tx.amount)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {data?.pagination && data.pagination.pages > 1 && (
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid var(--line)",
            }}>
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              Page {data.pagination.page} of {data.pagination.pages} ({data.pagination.total} total)
            </span>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="secondary compact"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                type="button"
                className="secondary compact"
                disabled={page >= data.pagination.pages}
                onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Spend Categorization Rules Modal */}
      {showRulesModal && (
        <SpendRulesModal
          categories={data?.categories || []}
          onClose={() => {
            setShowRulesModal(false);
            fetchTransactions();
          }}
        />
      )}
    </Shell>
  );
}
