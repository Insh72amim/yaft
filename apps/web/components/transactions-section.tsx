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
  Workflow,
  X,
  RotateCcw,
  Tag,
  Filter,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Zap,
  Calendar,
  Loader2,
  Mail,
  Eye,
  EyeOff,
  Pencil,
  Check,
  ChevronDown,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/shell";
import { api, errorMessage, isUnauthorized, money } from "@/lib/api";
import { CategoryPickerPopover } from "@/components/category-picker-popover";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { useTransactionFilters } from "@/hooks/useTransactionFilters";
import { EmailProofModal } from "@/components/email-proof-modal";
import { TransactionFilterBar } from "@/components/ledger/transaction-filter-bar";
import { BatchCategoryFloatingBar } from "@/components/ledger/batch-category-floating-bar";
import {
  TransactionCategoryCell,
  TransactionTimeWithEmailCell,
} from "@/components/ledger/transaction-cells";

type Mode = "CREDIT_CARD" | "BANK" | "UPI" | "UPI_LITE" | "ALL";

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
  categoryId?: string | null;
  category: string;
  categoryColor?: string;
  superCategory?: string | null;
  superCategoryColor?: string | null;
  superCategoryKind?: string | null;
  isTransfer: boolean;
  tags?: Array<{ id: string; name: string; color: string }>;
  emailReference?: {
    messageId?: string | null;
    subject?: string | null;
    sender?: string | null;
    date?: string | null;
    snippet?: string | null;
  } | null;
};

type TagOption = {
  id: string;
  name: string;
  color: string;
};

type Category = {
  id: string;
  name: string;
  color: string;
  type?: "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER";
  superCategoryId?: string | null;
  superCategoryName?: string | null;
  superCategoryColor?: string | null;
  superCategoryKind?: string | null;
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
  tags?: TagOption[];
  pagination: Pagination;
};

export function TransactionsSection({
  embedded,
  forceMode,
}: {
  embedded?: boolean;
  forceMode?: Mode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(forceMode || "BANK");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TransactionsApiResponse | null>(null);
  const [error, setError] = useState("");
  const {
    search, setSearch,
    typeFilter, setTypeFilter,
    categoryId, setCategoryId,
    accountId, setAccountId,
    tagId, setTagId,
    minAmount, setMinAmount,
    maxAmount, setMaxAmount,
    startDate, setStartDate,
    endDate, setEndDate,
    hasActiveFilters,
    clearFilters
  } = useTransactionFilters();



const [editingTxTagId, setEditingTxTagId] = useState<string | null>(null);
  const {
    editingTxCatId, setEditingTxCatId,
    updatingCatId,
    editingTxDescId, setEditingTxDescId,
    editMerchantDraft, setEditMerchantDraft,
    savingTxDescId,
    batchUpdating,
    batchCatPickerOpen, setBatchCatPickerOpen,
    error: mutationsError, setError: setMutationsError,
    updateCategory,
    updateMerchant,
    deleteTransaction,
    bulkUpdateCategory
  } = useTransactionMutations({ onMutated: () => fetchTransactions(), setData });
  const [categoryGroup, setCategoryGroup] = useState<
    "ALL" | "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER"
  >("ALL");

  const [showFilters, setShowFilters] = useState(false);
  const [showCategoryEdit, setShowCategoryEdit] = useState(false);
  const [showTagAssignModal, setShowTagAssignModal] = useState(false);
  const [selectedTagToAssign, setSelectedTagToAssign] = useState("");
  const [assigningTags, setAssigningTags] = useState(false);

              const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
      const [selectedEmailTx, setSelectedEmailTx] = useState<Transaction | null>(null);

  const startEditingTxMerchant = (tx: Transaction) => {
    setEditingTxDescId(tx.id);
    setEditMerchantDraft(tx.description || "");
  };

  const cancelEditingTxMerchant = () => {
    setEditingTxDescId(null);
    setEditMerchantDraft("");
  };

    const handleSingleTxTagAssign = async (
    txId: string,
    tagId: string,
    currentTags?: Array<{ id: string }>,
  ) => {
    const isTagged = currentTags?.some((t) => t.id === tagId);
    try {
      await api("/tags/assign", {
        method: "POST",
        body: JSON.stringify({
          transactionIds: [txId],
          tagIds: [tagId],
          action: isTagged ? "REMOVE" : "ADD",
        }),
      });
      fetchTransactions();
    } catch (err) {
      setError(errorMessage(err, "Could not update tag."));
    }
  };
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);





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
      if (categoryGroup !== "ALL") query.set("categoryGroup", categoryGroup);
      if (categoryId !== "all") query.set("categoryId", categoryId);
      if (accountId !== "all") query.set("accountId", accountId);
      if (tagId !== "all") query.set("tagId", tagId);
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
  }, [
    mode,
    page,
    search,
    typeFilter,
    categoryGroup,
    categoryId,
    accountId,
    minAmount,
    maxAmount,
    startDate,
    endDate,
    router,
  ]);

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const getDateRangeText = (start?: string, end?: string) => {
    if (start && end) {
      return `${formatDateLabel(start)} — ${formatDateLabel(end)}`;
    }
    if (start) {
      return `From ${formatDateLabel(start)} onwards`;
    }
    if (end) {
      return `Up to ${formatDateLabel(end)}`;
    }
    return "All-Time Full History";
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setPage(1);
    setAccountId("all");
    setSelectedTxIds([]);
  };

  const handleReconcileTransfers = async () => {
    setReconciling(true);
    setReconcileMsg(null);
    try {
      const res = await api<{ matchedPairsCount: number }>(
        "/transfers/reconcile",
        { method: "POST" },
      );
      await fetchTransactions();
      setReconcileMsg({
        type: "success",
        text: `Transfer matching finished — linked ${res.matchedPairsCount} new internal transfer pair${res.matchedPairsCount === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      setReconcileMsg({
        type: "error",
        text: errorMessage(err, "Failed to reconcile transfers."),
      });
    } finally {
      setReconciling(false);
      // auto-dismiss after 6 s
      setTimeout(() => setReconcileMsg(null), 6000);
    }
  };

    const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (!data?.transactions) return;
    if (selectedTxIds.length === data.transactions.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(data.transactions.map((t) => t.id));
    }
  };

    const handleAssignTagToSelected = async (action: "ADD" | "REMOVE" | "SET") => {
    if (selectedTxIds.length === 0 || !selectedTagToAssign) return;
    setAssigningTags(true);
    try {
      await api("/tags/assign", {
        method: "POST",
        body: JSON.stringify({
          transactionIds: selectedTxIds,
          tagIds: [selectedTagToAssign],
          action,
        }),
      });
      setShowTagAssignModal(false);
      setSelectedTxIds([]);
      fetchTransactions();
    } catch (err) {
      setError(errorMessage(err, "Could not assign tags."));
    } finally {
      setAssigningTags(false);
    }
  };

  const activeFilterCount =
    (categoryGroup !== "ALL" ? 1 : 0) +
    (categoryId !== "all" ? 1 : 0) +
    (tagId !== "all" ? 1 : 0) +
    (typeFilter !== "ALL" ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (accountId !== "all" ? 1 : 0);

  const resetFilters = () => {
    setCategoryGroup("ALL");
    setCategoryId("all");
    setTagId("all");
    setSearch("");
    setMinAmount("");
    setMaxAmount("");
    setStartDate("");
    setEndDate("");
    setTypeFilter("ALL");
    setAccountId("all");
    setPage(1);
  };

  const filteredAccounts =
    (data?.accounts || []).filter((acc) => {
      if (mode === "CREDIT_CARD") return acc.type === "CREDIT_CARD";
      if (mode === "BANK") return ["BANK", "SAVINGS"].includes(acc.type);
      if (mode === "UPI_LITE") return acc.type === "UPI_LITE";
      return ["BANK", "SAVINGS", "CREDIT_CARD", "UPI_LITE"].includes(acc.type);
    });

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {!embedded && (
        <header className="page-header">
          <div>
            <span className="eyebrow">Financial Ledger</span>
            <h1>Transactions &amp; Activity</h1>
            <p>
              Filter, categorize, and track complete transaction history across
              Credit Cards, Bank Accounts, and UPI payments.
            </p>
          </div>
          <button
            type="button"
            className="secondary compact"
            onClick={handleReconcileTransfers}
            disabled={reconciling}
            style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
            <RefreshCw size={14} className={reconciling ? "spin" : ""} />
            {reconciling ? "Matching…" : "Match Transfers"}
          </button>
        </header>
      )}

      {/* Reconcile result toast */}
      {reconcileMsg && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "12px",
            marginBottom: "8px",
            fontSize: "13px",
            fontWeight: 500,
            background:
              reconcileMsg.type === "success"
                ? "rgba(29,117,79,0.08)"
                : "rgba(201,75,69,0.08)",
            border: `1px solid ${reconcileMsg.type === "success" ? "rgba(29,117,79,0.2)" : "rgba(201,75,69,0.2)"}`,
            color:
              reconcileMsg.type === "success" ? "var(--green)" : "var(--red)",
          }}>
          {reconcileMsg.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{reconcileMsg.text}</span>
          <button
            type="button"
            onClick={() => setReconcileMsg(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              padding: "0 2px",
              lineHeight: 1,
            }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Mode Sub-Tabs (hidden if forceMode is supplied) */}
      {!forceMode && (
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
            <CreditCard size={18} color="#ef4444" />
            <span>Credit Cards</span>
          </button>

          <button
            type="button"
            className={`secondary ${mode === "UPI_LITE" ? "active" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              fontWeight: 600,
            }}
            onClick={() => handleModeChange("UPI_LITE")}>
            <Zap size={18} color="#f59e0b" />
            <span>UPI Lite</span>
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
            <Layers size={18} color="#3b82f6" />
            <span>All Accounts</span>
          </button>
        </div>
      )}

      {error && (
        <p className="error" role="alert" style={{ marginBottom: "16px" }}>
          {error}
        </p>
      )}

      {/* Summary KPI Cards */}
      {!embedded && data?.summary && (
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
            <small
              style={{
                fontSize: "11px",
                color: "var(--muted)",
                marginTop: "2px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
              }}>
              <Calendar size={12} color="var(--green)" />
              <span>{getDateRangeText(startDate, endDate)}</span>
            </small>
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
            <small
              style={{
                fontSize: "11px",
                color: "var(--muted)",
                marginTop: "2px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
              }}>
              <Calendar size={12} color="var(--green)" />
              <span>{getDateRangeText(startDate, endDate)}</span>
            </small>
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
            <small
              style={{
                fontSize: "11px",
                color: "var(--muted)",
                marginTop: "2px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
              }}>
              <Calendar size={12} color="var(--green)" />
              <span>{getDateRangeText(startDate, endDate)}</span>
            </small>
          </div>
        </div>
      )}

      {/* Main Ledger Control Panel */}
      <div className="panel transactions" style={{ marginBottom: "24px" }}>
        <div
          className="panel-title"
          style={{
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            marginBottom: "16px",
          }}>
          <div>
            <span className="eyebrow">Full history</span>
            <h2>
              {mode === "CREDIT_CARD"
                ? "Credit Card Transactions"
                : mode === "BANK"
                  ? "Bank Account Transactions"
                  : mode === "UPI"
                    ? "UPI Payment Activity"
                    : "All Ledger Transactions"}
            </h2>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}>
            {data && data.pagination.total > 0 && (
              <span className="month-pill">
                {(data.pagination.page - 1) * data.pagination.pageSize + 1}–
                {Math.min(
                  data.pagination.page * data.pagination.pageSize,
                  data.pagination.total,
                )}{" "}
                of {data.pagination.total}
              </span>
            )}
            <button
              type="button"
              className={`secondary compact ${showCategoryEdit ? "active" : ""}`}
              onClick={() => {
                setShowCategoryEdit(!showCategoryEdit);
                if (showCategoryEdit) setSelectedTxIds([]);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}>
              <Tag size={14} color="var(--green)" />
              {showCategoryEdit ? "Done Categorising" : "Select & Edit"}
            </button>
            {selectedTxIds.length > 0 && (
              <button
                type="button"
                className="primary compact"
                onClick={() => setShowTagAssignModal(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 700,
                }}>
                <Tag size={14} />
                <span>Bulk Tag ({selectedTxIds.length})</span>
              </button>
            )}
            <button
              type="button"
              className={`secondary compact ${
                showFilters || activeFilterCount > 0 ? "active" : ""
              }`}
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}>
              <Filter size={14} />
              {showFilters ? "Hide Filters" : "Filter Ledger"}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
        </div>

        {/* Toggleable Search & Filter Control Center */}
        {(showFilters || activeFilterCount > 0) && (
          <TransactionFilterBar
            categories={data?.categories || []}
            categoryId={categoryId}
            onCategoryChange={(val) => {
              setCategoryId(val);
              setPage(1);
            }}
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            typeFilter={typeFilter}
            onTypeFilterChange={(val) => {
              setTypeFilter(val);
              setPage(1);
            }}
            startDate={startDate}
            onStartDateChange={(val) => {
              setStartDate(val);
              setPage(1);
            }}
            endDate={endDate}
            onEndDateChange={(val) => {
              setEndDate(val);
              setPage(1);
            }}
            minAmount={minAmount}
            onMinAmountChange={(val) => {
              setMinAmount(val);
              setPage(1);
            }}
            maxAmount={maxAmount}
            onMaxAmountChange={(val) => {
              setMaxAmount(val);
              setPage(1);
            }}
            activeFilterCount={activeFilterCount}
            onResetFilters={resetFilters}
            categoryGroup={categoryGroup}
            onCategoryGroupChange={(grp) => {
              setCategoryGroup(grp);
              setCategoryId("all");
              setPage(1);
            }}
            accounts={filteredAccounts}
            accountId={accountId}
            onAccountChange={(val) => {
              setAccountId(val);
              setPage(1);
            }}
            allAccountsLabel={
              mode === "CREDIT_CARD"
                ? "All Credit Cards"
                : mode === "BANK"
                  ? "All Bank Accounts"
                  : "All Accounts"
            }
            tags={data?.tags || []}
            tagId={tagId}
            onTagChange={(val) => {
              setTagId(val);
              setPage(1);
            }}
          />
        )}

        {/* Transactions Table & Checkboxes */}
        {loading ? (
          <div className="loading" style={{ padding: "40px" }}>
            <span />
            <p>Loading transactions...</p>
          </div>
        ) : !data?.transactions?.length ? (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              color: "var(--muted)",
            }}>
            <Receipt size={40} style={{ marginBottom: "12px", opacity: 0.5 }} />
            <h3>No transactions match your criteria</h3>
            <p style={{ fontSize: "14px", marginTop: "4px" }}>
              Try clearing your search query, adjusting amount limits, or
              changing dates.
            </p>
          </div>
        ) : (
          <>
            <div
              className={`account-transaction-table has-account ${showCategoryEdit ? "has-checkboxes" : ""}`}>
              <header>
                {showCategoryEdit && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                    <input
                      type="checkbox"
                      checked={Boolean(
                        data?.transactions?.length &&
                        selectedTxIds.length === data.transactions.length,
                      )}
                      onChange={toggleSelectAll}
                      style={{
                        cursor: "pointer",
                        width: "15px",
                        height: "15px",
                      }}
                    />
                  </span>
                )}
                <span>Date</span>
                <span>Account</span>
                <span>Merchant / Description</span>
                <span>Category</span>
                <span style={{ textAlign: "right" }}>Amount</span>
              </header>

              {data.transactions.map((tx) => {
                const isDebit = tx.amount < 0;
                const isPopoverOpen = editingTxCatId === tx.id;
                return (
                  <article
                    key={tx.id}
                    className={`transaction-row ${isPopoverOpen ? "has-popover-open" : ""}`}
                    style={{ position: "relative", zIndex: isPopoverOpen ? 100 : 1 }}>
                    {showCategoryEdit && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                        <input
                          type="checkbox"
                          checked={selectedTxIds.includes(tx.id)}
                          onChange={() => toggleSelectTx(tx.id)}
                          style={{
                            cursor: "pointer",
                            width: "15px",
                            height: "15px",
                          }}
                        />
                      </div>
                    )}

                    <TransactionTimeWithEmailCell
                      transactionDate={tx.transactionDate}
                      hasEmailProof={Boolean(tx.emailReference)}
                      onViewEmailProof={() => setSelectedEmailTx(tx)}
                    />

                    <div
                      className="transaction-account-cell"
                      style={{ overflow: "hidden", minWidth: 0 }}>
                      <span
                        title={tx.accountName}
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
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                        {tx.accountType === "CREDIT_CARD" ? (
                          <CreditCard
                            size={13}
                            color="var(--accent)"
                            style={{ flexShrink: 0 }}
                          />
                        ) : (
                          <Landmark
                            size={13}
                            color="#0ea5e9"
                            style={{ flexShrink: 0 }}
                          />
                        )}
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                          {tx.accountName}
                        </span>
                        {tx.cardLast4 && (
                          <span
                            style={{
                              opacity: 0.7,
                              fontFamily: "monospace",
                              flexShrink: 0,
                            }}>
                            ••••{tx.cardLast4}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="transaction-description-cell" style={{ position: "relative" }}>
                      {editingTxDescId === tx.id ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 0",
                            flexWrap: "wrap",
                          }}>
                          <input
                            type="text"
                            autoFocus
                            value={editMerchantDraft}
                            onChange={(e) => setEditMerchantDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void updateMerchant(tx.id, tx.accountId, editMerchantDraft);
                              if (e.key === "Escape") cancelEditingTxMerchant();
                            }}
                            placeholder="Merchant name (e.g. ZOMATO)"
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1.5px solid var(--green)",
                              background: "var(--card)",
                              color: "var(--ink)",
                              outline: "none",
                              minWidth: "160px",
                              maxWidth: "260px",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => void updateMerchant(tx.id, tx.accountId, editMerchantDraft)}
                            disabled={savingTxDescId === tx.id}
                            title="Save merchant name"
                            style={{
                              padding: "4px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              borderRadius: "5px",
                              border: "none",
                              background: "var(--green)",
                              color: "var(--accent-contrast, #ffffff)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}>
                            {savingTxDescId === tx.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingTxMerchant}
                            title="Cancel"
                            style={{
                              padding: "4px 7px",
                              fontSize: "11px",
                              borderRadius: "5px",
                              border: "1px solid var(--line)",
                              background: "var(--card)",
                              color: "var(--muted)",
                              cursor: "pointer",
                            }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <strong
                            onClick={() => startEditingTxMerchant(tx)}
                            title="Click to edit merchant name"
                            style={{ cursor: "pointer" }}>
                            {tx.description}
                          </strong>
                          <button
                            type="button"
                            onClick={() => startEditingTxMerchant(tx)}
                            title="Edit merchant name"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--muted)",
                              padding: "0 2px",
                              opacity: 0.6,
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}>
                            <Pencil size={11} />
                          </button>
                          {tx.tags && tx.tags.length > 0 && (
                            <div style={{ display: "inline-flex", gap: "4px", flexWrap: "wrap" }}>
                              {tx.tags.map((t) => (
                                <span
                                  key={t.id}
                                  title="Click to remove tag"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleSingleTxTagAssign(tx.id, t.id, tx.tags);
                                  }}
                                  style={{
                                    fontSize: "10px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    background: `${t.color}20`,
                                    color: t.color,
                                    fontWeight: 700,
                                    border: `1px solid ${t.color}40`,
                                    cursor: "pointer",
                                  }}>
                                  #{t.name} ×
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Inline Tag Assignment Dropdown / Button */}
                          {editingTxTagId === tx.id ? (
                            <select
                              autoFocus
                              value=""
                              onBlur={() => setEditingTxTagId(null)}
                              onChange={(e) => {
                                if (e.target.value) {
                                  void handleSingleTxTagAssign(tx.id, e.target.value, tx.tags);
                                }
                                setEditingTxTagId(null);
                              }}
                              style={{
                                fontSize: "10px",
                                padding: "1px 4px",
                                borderRadius: "4px",
                                background: "var(--card)",
                                border: "1px solid var(--line)",
                                color: "var(--ink)",
                                fontWeight: 600,
                                cursor: "pointer",
                                outline: "none",
                              }}>
                              <option value="">Select tag...</option>
                              {(data?.tags || []).map((t) => {
                                const isAssigned = tx.tags?.some((existing) => existing.id === t.id);
                                return (
                                  <option key={t.id} value={t.id}>
                                    {isAssigned ? "✓ Remove #" : "+ Add #"}{t.name}
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingTxTagId(tx.id)}
                              title="Add or remove tag for this transaction"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "10px",
                                color: "var(--muted)",
                                padding: "0 4px",
                                opacity: 0.75,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "2px",
                              }}>
                              <Tag size={10} />
                              <span>+ tag</span>
                            </button>
                          )}
                        </div>
                      )}
                      {tx.details && <small style={{ color: "var(--muted)" }}>{tx.details}</small>}
                    </div>

                    <TransactionCategoryCell
                      categoryId={tx.categoryId}
                      categoryName={tx.category}
                      categoryColor={tx.categoryColor}
                      superCategory={tx.superCategory}
                      isTransfer={tx.isTransfer}
                      isPopoverOpen={isPopoverOpen}
                      categories={data?.categories || []}
                      onTogglePopover={() =>
                        setEditingTxCatId(editingTxCatId === tx.id ? null : tx.id)
                      }
                      onClosePopover={() => setEditingTxCatId(null)}
                      onSelectCategory={(newCatId) => {
                        void updateCategory(tx.id, tx.accountId, newCatId);
                      }}
                    />

                    <b
                      className={`transaction-amount-cell ${
                        isDebit ? "negative" : "positive"
                      }`}>
                      {isDebit ? money(tx.amount) : `+${money(tx.amount)}`}
                    </b>
                  </article>
                );
              })}
            </div>

            <BatchCategoryFloatingBar
              selectedCount={selectedTxIds.length}
              batchUpdating={batchUpdating}
              batchCatPickerOpen={batchCatPickerOpen}
              onTogglePicker={() => setBatchCatPickerOpen(!batchCatPickerOpen)}
              onClosePicker={() => setBatchCatPickerOpen(false)}
              categories={data.categories || []}
              onSelectCategory={(newCatId) => {
                void bulkUpdateCategory(selectedTxIds, newCatId);
              }}
              onDeselectAll={() => setSelectedTxIds([])}
            />

            {/* Pagination Controls */}
            {data?.pagination && data.pagination.pages > 1 && (
              <footer
                className="ledger-pagination"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "16px",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--line)",
                }}>
                <button
                  type="button"
                  className="secondary compact"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ArrowLeft size={14} /> Previous
                </button>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Page {data.pagination.page} of {data.pagination.pages} (
                  {data.pagination.total} total)
                </span>
                <button
                  type="button"
                  className="secondary compact"
                  disabled={page >= data.pagination.pages}
                  onClick={() =>
                    setPage((p) => Math.min(data.pagination.pages, p + 1))
                  }>
                  Next <ArrowRight size={14} />
                </button>
              </footer>
            )}
          </>
        )}
      </div>

      {/* Bulk Tag Assignment Modal */}
      {showTagAssignModal && (
        <div className="modal-wrap" style={{ zIndex: 99999 }}>
          <button className="backdrop" onClick={() => setShowTagAssignModal(false)} aria-label="Close tag assignment modal" />
          <section className="modal" style={{ width: "min(420px, 90vw)", padding: "20px", borderRadius: "14px", background: "var(--card)", border: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <Tag size={18} color="var(--green)" /> Tag {selectedTxIds.length} Selected Transaction{selectedTxIds.length === 1 ? "" : "s"}
            </h3>
            <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "var(--muted)" }}>
              Select an event or custom tag to apply or remove from selected items.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>Select Tag</label>
                <select
                  value={selectedTagToAssign}
                  onChange={(e) => setSelectedTagToAssign(e.target.value)}
                  style={{ width: "100%", height: "38px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 700 }}>
                  <option value="">Choose tag / event...</option>
                  {data?.tags?.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="ghost compact"
                  disabled={assigningTags || !selectedTagToAssign}
                  onClick={() => handleAssignTagToSelected("REMOVE")}
                  style={{ color: "#ef4444" }}>
                  Remove Tag
                </button>
                <button
                  type="submit"
                  className="primary compact"
                  disabled={assigningTags || !selectedTagToAssign}
                  onClick={() => handleAssignTagToSelected("ADD")}
                  style={{ fontWeight: 700 }}>
                  {assigningTags ? "Applying..." : "Apply Tag"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {selectedEmailTx && selectedEmailTx.emailReference && (
        <EmailProofModal
          data={{
            accountName: selectedEmailTx.accountName,
            accountType: selectedEmailTx.accountType,
            cardLast4: selectedEmailTx.cardLast4,
            amount: selectedEmailTx.amount,
            emailReference: selectedEmailTx.emailReference,
          }}
          onClose={() => setSelectedEmailTx(null)}
        />
      )}
    </div>
  );

  return embedded ? content : <Shell>{content}</Shell>;
}
