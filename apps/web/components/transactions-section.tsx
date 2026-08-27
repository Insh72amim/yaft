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
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/shell";
import { api, errorMessage, isUnauthorized, money } from "@/lib/api";
import { CategoryPickerPopover } from "@/components/category-picker-popover";
import { EmailProofModal } from "@/components/email-proof-modal";

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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "EXPENSE" | "INCOME">(
    "ALL",
  );
  const [categoryGroup, setCategoryGroup] = useState<
    "ALL" | "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER"
  >("ALL");
  const [categoryId, setCategoryId] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [tagId, setTagId] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [showFilters, setShowFilters] = useState(false);
  const [showCategoryEdit, setShowCategoryEdit] = useState(false);
  const [showTagAssignModal, setShowTagAssignModal] = useState(false);
  const [selectedTagToAssign, setSelectedTagToAssign] = useState("");
  const [assigningTags, setAssigningTags] = useState(false);

  const [showRangeActionModal, setShowRangeActionModal] = useState(false);
  const [rangeStartDateTime, setRangeStartDateTime] = useState("");
  const [rangeEndDateTime, setRangeEndDateTime] = useState("");
  const [rangeTagId, setRangeTagId] = useState("");
  const [rangeAccountId, setRangeAccountId] = useState("all");
  const [rangeKeywords, setRangeKeywords] = useState("");
  const [rangeSubmitting, setRangeSubmitting] = useState(false);

  const [editingTxCatId, setEditingTxCatId] = useState<string | null>(null);
  const [editingTxTagId, setEditingTxTagId] = useState<string | null>(null);
  const [editingTxDescId, setEditingTxDescId] = useState<string | null>(null);
  const [editDescDraft, setEditDescDraft] = useState<{ merchant: string; details: string }>({
    merchant: "",
    details: "",
  });
  const [savingTxDescId, setSavingTxDescId] = useState<string | null>(null);
  const [updatingCatId, setUpdatingCatId] = useState<string | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [selectedEmailTx, setSelectedEmailTx] = useState<Transaction | null>(null);

  const startEditingTxDescription = (tx: Transaction) => {
    setEditingTxDescId(tx.id);
    setEditDescDraft({
      merchant: tx.description || "",
      details: tx.details || "",
    });
  };

  const cancelEditingTxDescription = () => {
    setEditingTxDescId(null);
    setEditDescDraft({ merchant: "", details: "" });
  };

  const handleSaveTxDescription = async (tx: Transaction) => {
    const newMerchant = editDescDraft.merchant.trim();
    const newDetails = editDescDraft.details.trim();
    if (!newMerchant && !newDetails) {
      return;
    }

    const newDescription = newMerchant || newDetails;
    const newDetailsFinal = newMerchant ? newDetails : null;

    // Optimistic UI update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === tx.id
            ? {
                ...t,
                description: newDescription,
                details: newDetailsFinal,
              }
            : t
        ),
      };
    });

    setSavingTxDescId(tx.id);
    setEditingTxDescId(null);

    try {
      await api(`/transactions/${tx.accountId}/${tx.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          merchant: newMerchant || null,
          descriptionRaw: newDetails || newMerchant,
        }),
      });
    } catch (err) {
      setError(errorMessage(err, "Failed to update transaction description."));
      void fetchTransactions();
    } finally {
      setSavingTxDescId(null);
    }
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

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TransactionsApiResponse | null>(null);
  const [error, setError] = useState("");

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

  const handleUpdateCategory = async (
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

  const handleBatchUpdateCategory = async (targetCatId: string) => {
    if (selectedTxIds.length === 0) return;
    setBatchUpdating(true);
    try {
      await api("/categories/batch-update", {
        method: "POST",
        body: JSON.stringify({
          transactionIds: selectedTxIds,
          categoryId: targetCatId || null,
        }),
      }).catch(() =>
        api("/category-rules/batch-update", {
          method: "POST",
          body: JSON.stringify({
            transactionIds: selectedTxIds,
            categoryId: targetCatId || null,
          }),
        }),
      );
      setSelectedTxIds([]);
      fetchTransactions();
    } catch (reason) {
      setError(errorMessage(reason, "Could not bulk update categories."));
    } finally {
      setBatchUpdating(false);
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

  const handleRunRangeAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rangeTagId) {
      setError("Please select a tag to apply.");
      return;
    }
    if (!rangeStartDateTime && !rangeEndDateTime && !rangeKeywords.trim()) {
      setError("Please enter a date/time range or keyword search.");
      return;
    }
    setRangeSubmitting(true);
    setError("");
    try {
      const keywordsArray = rangeKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await api<{ matchedCount: number; newlyTaggedCount: number }>("/tags/range-apply", {
        method: "POST",
        body: JSON.stringify({
          startDate: rangeStartDateTime || undefined,
          endDate: rangeEndDateTime || undefined,
          tagIds: [rangeTagId],
          accountId: rangeAccountId !== "all" ? rangeAccountId : undefined,
          keywords: keywordsArray.length > 0 ? keywordsArray : undefined,
        }),
      });

      setReconcileMsg({
        type: "success",
        text: `Applied tag to ${res.newlyTaggedCount || res.matchedCount} matching transactions in date/time range!`,
      });
      setShowRangeActionModal(false);
      fetchTransactions();
    } catch (err) {
      setError(errorMessage(err, "Could not apply range tag."));
    } finally {
      setRangeSubmitting(false);
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
                className="secondary compact"
                onClick={() => setShowTagAssignModal(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "var(--green)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                }}>
                <Tag size={14} />
                <span>Bulk Tag ({selectedTxIds.length})</span>
              </button>
            )}
            <button
              type="button"
              className={`secondary compact ${showRangeActionModal ? "active" : ""}`}
              onClick={() => setShowRangeActionModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--background-alt)",
                border: "1px solid var(--line)",
                fontWeight: 600,
              }}>
              <Calendar size={14} color="var(--green)" />
              <span>Tag by Range</span>
            </button>
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              margin: "0 0 20px 0",
              padding: "16px",
              background: "var(--background-alt)",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}>
            {/* Category Group Filter Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Group:
              </span>
              {[
                { id: "ALL", label: "All Groups" },
                { id: "EXPENSE", label: "Expense" },
                { id: "INCOME", label: "Income" },
                { id: "INVESTMENT", label: "Investment" },
                { id: "TRANSFER", label: "Transfer" },
              ].map((grp) => (
                <button
                  key={grp.id}
                  type="button"
                  className={`secondary compact ${categoryGroup === grp.id ? "active" : ""}`}
                  onClick={() => {
                    setCategoryGroup(grp.id as any);
                    setCategoryId("all");
                    setPage(1);
                  }}
                  style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "6px", fontWeight: 600 }}>
                  {grp.label}
                </button>
              ))}
            </div>

            {/* Top Row: Account Select & Category Group & Category Select & Search & Type Toggle & Reset */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
              {/* Account Dropdown */}
              <div style={{ flex: "1 1 150px", minWidth: "140px" }}>
                <select
                  value={accountId}
                  onChange={(e) => {
                    setAccountId(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: "100%",
                    height: "38px",
                    fontSize: "13px",
                    padding: "0 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "var(--background)",
                    color: "var(--ink)",
                    fontWeight: 600,
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
                      {acc.cardLast4
                        ? `(••••${acc.cardLast4})`
                        : acc.institution
                          ? `· ${acc.institution}`
                          : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Streamlined Grouped Category Filter Dropdown */}
              <div style={{ flex: "1 1 180px", minWidth: "160px" }}>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: "100%",
                    height: "38px",
                    fontSize: "13px",
                    padding: "0 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "var(--background)",
                    color: "var(--ink)",
                    fontWeight: 600,
                  }}>
                  <option value="all">
                    {categoryGroup === "ALL"
                      ? "All Categories"
                      : `All ${categoryGroup.charAt(0) + categoryGroup.slice(1).toLowerCase()} Categories`}
                  </option>
                  <option value="uncategorised">Uncategorised</option>
                  {(() => {
                    const rawCats = data?.categories || [];
                    const filtered = rawCats.filter((cat) => {
                      if (categoryGroup === "ALL") return true;
                      const kind = cat.superCategoryKind || (cat.type ? cat.type : "EXPENSE");
                      return kind === categoryGroup;
                    });
                    const groups: { [key: string]: typeof filtered } = {};
                    filtered.forEach((c) => {
                      const grp =
                        c.superCategoryName ||
                        (c.type ? `${c.type.charAt(0) + c.type.slice(1).toLowerCase()}` : "General");
                      if (!groups[grp]) groups[grp] = [];
                      groups[grp].push(c);
                    });
                    return Object.entries(groups).map(([grp, items]) => (
                      <optgroup key={grp} label={grp}>
                        {items.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>
              </div>

              {/* Tag / Event Filter Dropdown */}
              <div style={{ flex: "1 1 150px", minWidth: "140px" }}>
                <select
                  value={tagId}
                  onChange={(e) => {
                    setTagId(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: "100%",
                    height: "38px",
                    fontSize: "13px",
                    padding: "0 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "var(--background)",
                    color: "var(--ink)",
                    fontWeight: 600,
                  }}>
                  <option value="all">All Tags & Events</option>
                  {data?.tags?.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div
                style={{
                  position: "relative",
                  flex: "1 1 200px",
                  minWidth: "180px",
                }}>
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
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
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

              {/* Type Filter Segmented Controls */}
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

              {/* Reset Filters Chip */}
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

            {/* Bottom Grid: Date Range Card & Amount Range Card */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "12px",
              }}>
              {/* 📅 Date Range Card */}
              <div
                style={{
                  background: "var(--background)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  border: "1px solid var(--line)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}>
                    Date Range
                  </span>
                  {(startDate || endDate) && (
                    <small
                      style={{
                        fontSize: "11px",
                        color: "#8b5cf6",
                        fontWeight: 600,
                      }}>
                      Filter active
                    </small>
                  )}
                </div>

                {/* Quick Date Range Presets */}
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="secondary compact"
                    style={{ fontSize: "10px", padding: "2px 8px" }}
                    onClick={() => {
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
                      setStartDate(firstDay);
                      setEndDate(lastDay);
                      setPage(1);
                    }}>
                    This Month
                  </button>
                  <button
                    type="button"
                    className="secondary compact"
                    style={{ fontSize: "10px", padding: "2px 8px" }}
                    onClick={() => {
                      const end = new Date().toISOString().slice(0, 10);
                      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                      setStartDate(start);
                      setEndDate(end);
                      setPage(1);
                    }}>
                    Last 30 Days
                  </button>
                  <button
                    type="button"
                    className="secondary compact"
                    style={{ fontSize: "10px", padding: "2px 8px" }}
                    onClick={() => {
                      const end = new Date().toISOString().slice(0, 10);
                      const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                      setStartDate(start);
                      setEndDate(end);
                      setPage(1);
                    }}>
                    Last 90 Days
                  </button>
                  <button
                    type="button"
                    className="secondary compact"
                    style={{ fontSize: "10px", padding: "2px 8px" }}
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                      setPage(1);
                    }}>
                    All Time
                  </button>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        color: "var(--muted)",
                        marginBottom: "3px",
                      }}>
                      From
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setPage(1);
                      }}
                      style={{
                        width: "100%",
                        height: "34px",
                        fontSize: "12px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                        background: "var(--background-alt)",
                        color: "var(--ink)",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        color: "var(--muted)",
                        marginBottom: "3px",
                      }}>
                      To
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setPage(1);
                      }}
                      style={{
                        width: "100%",
                        height: "34px",
                        fontSize: "12px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                        background: "var(--background-alt)",
                        color: "var(--ink)",
                      }}
                    />
                  </div>
                </div>
                {/* Presets */}
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                    marginTop: "2px",
                  }}>
                  <button
                    type="button"
                    className="ghost compact"
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                    }}
                    onClick={() => {
                      const now = new Date();
                      const y = now.getUTCFullYear();
                      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
                      setStartDate(`${y}-${m}-01`);
                      setEndDate("");
                      setPage(1);
                    }}>
                    This Month
                  </button>
                  <button
                    type="button"
                    className="ghost compact"
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                    }}
                    onClick={() => {
                      const now = new Date();
                      let y = now.getUTCFullYear();
                      let m = now.getUTCMonth();
                      if (m === 0) {
                        m = 12;
                        y -= 1;
                      }
                      const mStr = String(m).padStart(2, "0");
                      setStartDate(`${y}-${mStr}-01`);
                      setEndDate(`${y}-${mStr}-31`);
                      setPage(1);
                    }}>
                    Last Month
                  </button>
                  <button
                    type="button"
                    className="ghost compact"
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                    }}
                    onClick={() => {
                      const now = new Date();
                      const today = now.toISOString().split("T")[0];
                      const d = new Date(now);
                      d.setMonth(d.getMonth() - 6);
                      setStartDate(d.toISOString().split("T")[0]);
                      setEndDate(today);
                      setPage(1);
                    }}>
                    Last 6 Months
                  </button>
                  <button
                    type="button"
                    className="ghost compact"
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                    }}
                    onClick={() => {
                      const now = new Date();
                      const y = now.getUTCFullYear();
                      const startYr = now.getUTCMonth() >= 3 ? y : y - 1;
                      setStartDate(`${startYr}-04-01`);
                      setEndDate(`${startYr + 1}-03-31`);
                      setPage(1);
                    }}>
                    This FY
                  </button>
                  <button
                    type="button"
                    className="ghost compact"
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                    }}
                    onClick={() => {
                      const now = new Date();
                      const y = now.getUTCFullYear();
                      const currentStart = now.getUTCMonth() >= 3 ? y : y - 1;
                      const prevStart = currentStart - 1;
                      setStartDate(`${prevStart}-04-01`);
                      setEndDate(`${currentStart}-03-31`);
                      setPage(1);
                    }}>
                    Previous FY
                  </button>
                </div>
              </div>

              {/* 💰 Amount Range Card */}
              <div
                style={{
                  background: "var(--background)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  border: "1px solid var(--line)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}>
                    Amount Range (₹)
                  </span>
                  {(minAmount || maxAmount) && (
                    <small
                      style={{
                        fontSize: "11px",
                        color: "#8b5cf6",
                        fontWeight: 600,
                      }}>
                      Filter active
                    </small>
                  )}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        color: "var(--muted)",
                        marginBottom: "3px",
                      }}>
                      Min ₹
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={minAmount}
                      onChange={(e) => {
                        setMinAmount(e.target.value);
                        setPage(1);
                      }}
                      style={{
                        width: "100%",
                        height: "34px",
                        fontSize: "12px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                        background: "var(--background-alt)",
                        color: "var(--ink)",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        color: "var(--muted)",
                        marginBottom: "3px",
                      }}>
                      Max ₹
                    </label>
                    <input
                      type="number"
                      placeholder="No max"
                      value={maxAmount}
                      onChange={(e) => {
                        setMaxAmount(e.target.value);
                        setPage(1);
                      }}
                      style={{
                        width: "100%",
                        height: "34px",
                        fontSize: "12px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                        background: "var(--background-alt)",
                        color: "var(--ink)",
                      }}
                    />
                  </div>
                </div>
                {/* Presets */}
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                    marginTop: "2px",
                  }}>
                  <button
                    type="button"
                    className="ghost compact"
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                    }}
                    onClick={() => {
                      setMinAmount("0");
                      setMaxAmount("1000");
                      setPage(1);
                    }}>
                    &lt; ₹1k
                  </button>
                  <button
                    type="button"
                    className="ghost compact"
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                    }}
                    onClick={() => {
                      setMinAmount("1000");
                      setMaxAmount("10000");
                      setPage(1);
                    }}>
                    ₹1k – ₹10k
                  </button>
                  <button
                    type="button"
                    className="ghost compact"
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                    }}
                    onClick={() => {
                      setMinAmount("10000");
                      setMaxAmount("50000");
                      setPage(1);
                    }}>
                    ₹10k – ₹50k
                  </button>
                  <button
                    type="button"
                    className="ghost compact"
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                    }}
                    onClick={() => {
                      setMinAmount("50000");
                      setMaxAmount("");
                      setPage(1);
                    }}>
                    &gt; ₹50k
                  </button>
                </div>
              </div>
            </div>
          </div>
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

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <time className="transaction-time-cell">
                        <span className="date-text">
                          {new Date(tx.transactionDate).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              timeZone: "Asia/Kolkata",
                            },
                          )}
                        </span>
                        <span className="time-text">
                          {new Date(tx.transactionDate).toLocaleTimeString(
                            "en-IN",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                              timeZone: "Asia/Kolkata",
                            },
                          )}
                        </span>
                      </time>

                      {tx.emailReference ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmailTx(tx);
                          }}
                          title="View source email proof (Gmail alert)"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "22px",
                            height: "22px",
                            borderRadius: "6px",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                            background: "rgba(59, 130, 246, 0.1)",
                            color: "#3b82f6",
                            cursor: "pointer",
                            padding: 0,
                            flexShrink: 0,
                            transition: "all 0.15s ease",
                          }}>
                          <Eye size={12} />
                        </button>
                      ) : (
                        <span
                          title="No email proof available"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "22px",
                            height: "22px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            background: "transparent",
                            color: "var(--muted)",
                            opacity: 0.2,
                            cursor: "not-allowed",
                            flexShrink: 0,
                          }}>
                          <EyeOff size={12} />
                        </span>
                      )}
                    </div>

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
                            flexDirection: "column",
                            gap: "6px",
                            padding: "8px",
                            background: "var(--background-alt)",
                            border: "1.5px solid var(--green)",
                            borderRadius: "8px",
                            minWidth: "260px",
                            maxWidth: "420px",
                          }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                              Merchant Name
                            </label>
                            <input
                              type="text"
                              autoFocus
                              value={editDescDraft.merchant}
                              onChange={(e) => setEditDescDraft((prev) => ({ ...prev, merchant: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void handleSaveTxDescription(tx);
                                if (e.key === "Escape") cancelEditingTxDescription();
                              }}
                              placeholder="Merchant title (e.g. ZOMATO)"
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid var(--line)",
                                background: "var(--card)",
                                color: "var(--ink)",
                                outline: "none",
                              }}
                            />
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                              Narration / Description
                            </label>
                            <input
                              type="text"
                              value={editDescDraft.details}
                              onChange={(e) => setEditDescDraft((prev) => ({ ...prev, details: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void handleSaveTxDescription(tx);
                                if (e.key === "Escape") cancelEditingTxDescription();
                              }}
                              placeholder="Raw bank narration / details"
                              style={{
                                fontSize: "11px",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid var(--line)",
                                background: "var(--card)",
                                color: "var(--ink)",
                                outline: "none",
                              }}
                            />
                          </div>

                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "2px" }}>
                            <button
                              type="button"
                              onClick={cancelEditingTxDescription}
                              style={{
                                padding: "3px 8px",
                                fontSize: "11px",
                                borderRadius: "5px",
                                border: "1px solid var(--line)",
                                background: "var(--card)",
                                color: "var(--muted)",
                                cursor: "pointer",
                              }}>
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveTxDescription(tx)}
                              disabled={savingTxDescId === tx.id}
                              style={{
                                padding: "3px 10px",
                                fontSize: "11px",
                                fontWeight: 700,
                                borderRadius: "5px",
                                border: "none",
                                background: "var(--green)",
                                color: "#ffffff",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}>
                              {savingTxDescId === tx.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <strong
                              onClick={() => startEditingTxDescription(tx)}
                              title="Click to edit description or merchant"
                              style={{ cursor: "pointer" }}>
                              {tx.description}
                            </strong>
                            <button
                              type="button"
                              onClick={() => startEditingTxDescription(tx)}
                              title="Edit description or merchant"
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
                          {tx.details && (
                            <small
                              onClick={() => startEditingTxDescription(tx)}
                              title="Click to edit narration"
                              style={{ cursor: "pointer" }}>
                              {tx.details}
                            </small>
                          )}
                        </>
                      )}
                    </div>

                    <div className="transaction-category-cell" style={{ position: "relative", zIndex: isPopoverOpen ? 100 : 1 }}>
                      <button
                        type="button"
                        className="transaction-cat-btn"
                        onClick={() => setEditingTxCatId(editingTxCatId === tx.id ? null : tx.id)}
                        title="Click to change category">
                        <div className="transaction-cat-primary">
                          <span
                            className="transaction-cat-dot"
                            style={{
                              background:
                                tx.categoryColor ||
                                (tx.categoryId ? "#3b82f6" : "#94a3b8"),
                            }}
                          />
                          <span
                            className={`transaction-cat-name ${
                              !tx.categoryId ? "uncategorised" : ""
                            }`}>
                            {tx.category || "Uncategorised"}
                          </span>
                          {tx.isTransfer && (
                            <span
                              title="Reconciled Transfer Pair"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "0 4px",
                                borderRadius: "4px",
                                background: "rgba(59, 130, 246, 0.1)",
                                color: "#3b82f6",
                                fontSize: "9px",
                                fontWeight: 800,
                                marginLeft: "2px",
                              }}>
                              ⇄
                            </span>
                          )}
                        </div>
                        {tx.superCategory && (
                          <span className="transaction-super-label">
                            {tx.superCategory}
                          </span>
                        )}
                      </button>

                      {editingTxCatId === tx.id && (
                        <CategoryPickerPopover
                          categories={data?.categories || []}
                          currentCategoryId={tx.categoryId ?? null}
                          onSelect={(newCatId) => {
                            void handleUpdateCategory(tx.accountId, tx.id, newCatId);
                            setEditingTxCatId(null);
                          }}
                          onClose={() => setEditingTxCatId(null)}
                        />
                      )}
                    </div>

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

            {/* Batch Categorization Floating Bar */}
            {selectedTxIds.length > 0 && (
              <div
                style={{
                  position: "fixed",
                  bottom: "24px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 9999,
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: "16px",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
                  padding: "10px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}>
                  {selectedTxIds.length} transaction
                  {selectedTxIds.length === 1 ? "" : "s"} selected
                </span>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <select
                    disabled={batchUpdating}
                    onChange={(e) =>
                      void handleBatchUpdateCategory(e.target.value)
                    }
                    defaultValue=""
                    style={{
                      height: "34px",
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      padding: "0 10px",
                      background: "var(--background)",
                      color: "var(--ink)",
                      cursor: "pointer",
                    }}>
                    <option value="" disabled>
                      Set category for all selected…
                    </option>
                    <option value="">Uncategorised</option>
                    {(() => {
                      const cats = data.categories || [];
                      const groups: { [key: string]: typeof cats } = {};
                      const unassigned: typeof cats = [];
                      cats.forEach((c) => {
                        const groupName = c.superCategoryName || (c.type ? `${c.type.charAt(0) + c.type.slice(1).toLowerCase()}` : "");
                        if (groupName) {
                          if (!groups[groupName]) groups[groupName] = [];
                          groups[groupName].push(c);
                        } else {
                          unassigned.push(c);
                        }
                      });
                      return (
                        <>
                          {Object.entries(groups).map(([grp, items]) => (
                            <optgroup key={grp} label={grp}>
                              {items.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          {unassigned.length > 0 && (
                            <optgroup label="General">
                              {unassigned.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>

                  <button
                    type="button"
                    className="ghost compact"
                    onClick={() => setSelectedTxIds([])}
                    style={{
                      height: "34px",
                      fontSize: "12px",
                      color: "var(--muted)",
                    }}>
                    Deselect
                  </button>
                </div>
              </div>
            )}

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
                  type="button"
                  className="secondary compact"
                  disabled={assigningTags || !selectedTagToAssign}
                  onClick={() => handleAssignTagToSelected("ADD")}
                  style={{ background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700 }}>
                  {assigningTags ? "Applying..." : "Apply Tag"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Date/Time Range Tag Modal */}
      {showRangeActionModal && (
        <div className="modal-wrap" style={{ zIndex: 99999 }}>
          <button className="backdrop" onClick={() => setShowRangeActionModal(false)} aria-label="Close range action modal" />
          <section className="modal" style={{ width: "min(460px, 90vw)", padding: "20px", borderRadius: "14px", background: "var(--card)", border: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "1.15rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={18} color="var(--green)" /> Tag by Date/Time Range
            </h3>
            <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "var(--muted)" }}>
              Apply a tag to all transactions occurring between a specific start and end date/time (e.g. #Trip, #Vacation, #Project).
            </p>

            <form onSubmit={handleRunRangeAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={rangeStartDateTime}
                    onChange={(e) => setRangeStartDateTime(e.target.value)}
                    style={{ width: "100%", height: "36px", fontSize: "12px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={rangeEndDateTime}
                    onChange={(e) => setRangeEndDateTime(e.target.value)}
                    style={{ width: "100%", height: "36px", fontSize: "12px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Select Tag to Apply *</label>
                <select
                  required
                  value={rangeTagId}
                  onChange={(e) => setRangeTagId(e.target.value)}
                  style={{ width: "100%", height: "36px", fontSize: "12px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                  <option value="">Choose a tag...</option>
                  {data?.tags?.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Merchant / Description Keywords (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Kerala, Kochi, Munnar, Indigo..."
                  value={rangeKeywords}
                  onChange={(e) => setRangeKeywords(e.target.value)}
                  style={{ width: "100%", height: "36px", fontSize: "12px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
                <button type="button" className="ghost compact" onClick={() => setShowRangeActionModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={rangeSubmitting} className="secondary compact" style={{ background: "var(--green)", color: "#ffffff", border: "none", fontWeight: 700 }}>
                  {rangeSubmitting ? <Loader2 size={14} className="spin" /> : "Apply Tag to Range"}
                </button>
              </div>
            </form>
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
