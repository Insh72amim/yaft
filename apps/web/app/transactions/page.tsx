"use client";
import {
  CreditCard,
  QrCode,
  Receipt,
  Search,
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/shell";
import { api, errorMessage, isUnauthorized, money } from "@/lib/api";

type Mode = "CREDIT_CARD" | "UPI" | "ALL";

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
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [categoryId, setCategoryId] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
  }, [mode, page, search, typeFilter, categoryId, accountId, startDate, endDate, router]);

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

  const filteredAccounts = data?.accounts.filter((acc) => {
    if (mode === "CREDIT_CARD") return acc.type === "CREDIT_CARD";
    return true;
  }) ?? [];

  return (
    <Shell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Transaction Activity</span>
          <h1>Transactions &amp; Payments</h1>
          <p>
            Unified view of all your credit card charges and UPI payment history.
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
          <span>All Activity</span>
        </button>
      </div>

      {error && (
        <p className="error" role="alert" style={{ marginBottom: "16px" }}>
          {error}
        </p>
      )}

      {/* Summary Cards */}
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
                ? "Total Credit Used / Spent"
                : mode === "UPI"
                ? "Total UPI Outflow"
                : "Total Expenses / Spent"}
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
                ? "Total Refunds & Payments"
                : mode === "UPI"
                ? "Total UPI Inflow"
                : "Total Income / Received"}
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
              Total Transactions Count
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

      {/* Filter Controls Bar */}
      <div
        className="panel"
        style={{
          padding: "16px",
          marginBottom: "24px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}>
        <div style={{ flex: "1 1 200px", position: "relative" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
            }}
          />
          <input
            type="text"
            placeholder="Search merchant or details..."
            value={search}
            style={{ paddingLeft: "36px", margin: 0 }}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          value={accountId}
          style={{ width: "auto", margin: 0 }}
          onChange={(e) => {
            setAccountId(e.target.value);
            setPage(1);
          }}>
          <option value="all">
            {mode === "CREDIT_CARD" ? "All Credit Cards" : "All Accounts"}
          </option>
          {filteredAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}{" "}
              {acc.cardLast4 ? `(••••${acc.cardLast4})` : acc.institution ? `· ${acc.institution}` : ""}
            </option>
          ))}
        </select>

        <select
          value={categoryId}
          style={{ width: "auto", margin: 0 }}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}>
          <option value="all">All Categories</option>
          <option value="uncategorised">Uncategorised</option>
          <option value="transfers">Transfers</option>
          {data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          style={{ width: "auto", margin: 0 }}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}>
          <option value="ALL">All Types</option>
          <option value="EXPENSE">Expenses Only</option>
          <option value="INCOME">Credits Only</option>
        </select>

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            type="date"
            value={startDate}
            style={{ margin: 0, width: "auto" }}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
          <span style={{ color: "var(--muted)" }}>to</span>
          <input
            type="date"
            value={endDate}
            style={{ margin: 0, width: "auto" }}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
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
            <h3>No transactions found</h3>
            <p style={{ fontSize: "14px", marginTop: "4px" }}>
              Try adjusting your search query, filters, or date range.
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
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Merchant / Details</th>
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
                            <CreditCard size={13} />
                          ) : (
                            <QrCode size={13} />
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
                        <select
                          value={tx.categoryId || ""}
                          disabled={updatingCatId === tx.id}
                          style={{
                            margin: 0,
                            padding: "4px 8px",
                            fontSize: "12px",
                            width: "auto",
                            borderRadius: "6px",
                            border: `1px solid ${tx.categoryColor || "var(--line)"}`,
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

        {/* Pagination Footer */}
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
    </Shell>
  );
}
