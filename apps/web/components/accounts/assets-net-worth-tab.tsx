"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Eye,
  EyeOff,
  Search,
  Layers,
  PiggyBank,
  Landmark,
  TrendingUp,
  ChartPie,
  Building2,
  X,
  Pencil,
  Loader2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { api, errorMessage, money } from "@/lib/api";
import { getLocalLogo } from "./account-card";

export interface HoldingAsset {
  symbol: string;
  name: string;
  category: string;
  quantity: number;
  averagePrice: number | null;
  currentValue: number | null;
  unrealizedPnl: number | null;
}

export interface AccountAsset {
  id: string;
  name: string;
  type: string;
  category: "SAVINGS" | "DEPOSITS" | "STOCKS" | "MUTUAL_FUNDS" | "EPFO" | "DEBT";
  institution: string | null;
  balance: number;
  investedValue: number | null;
  unrealizedPnl: number | null;
  holdingCount: number;
  holdings: HoldingAsset[];
}

export interface AssetsHistoryData {
  netWorth: number;
  totalAssets: number;
  savingsTotal: number;
  depositsTotal: number;
  stocksTotal: number;
  mutualFundsTotal: number;
  epfoTotal: number;
  debtTotal: number;
  allocation: {
    savings: { amount: number; percentage: number };
    deposits: { amount: number; percentage: number };
    stocks: { amount: number; percentage: number };
    mutualFunds: { amount: number; percentage: number };
    epfo: { amount: number; percentage: number };
    debt: { amount: number; percentage: number };
  };
  accounts: AccountAsset[];
  history: {
    month: string;
    savings: number;
    deposits: number;
    stocks: number;
    mutualFunds: number;
    epfo: number;
    debt: number;
    totalAssets: number;
    netWorth: number;
  }[];
}

export type AssetCategoryFilter = "ALL" | "SAVINGS" | "DEPOSITS" | "STOCKS" | "MUTUAL_FUNDS" | "EPFO" | "DEBT";

export const ASSET_CATEGORY_CONFIG: Record<
  AssetCategoryFilter,
  { label: string; shortLabel: string; color: string; bg: string; icon: any }
> = {
  ALL: { label: "All Accounts", shortLabel: "All", color: "var(--ink)", bg: "var(--card)", icon: Layers },
  SAVINGS: { label: "Savings & Cash", shortLabel: "Savings", color: "#0ea5e9", bg: "rgba(14, 165, 233, 0.12)", icon: PiggyBank },
  DEPOSITS: { label: "Fixed & Term Deposits", shortLabel: "FD / RD", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", icon: Landmark },
  STOCKS: { label: "Stocks & Equities", shortLabel: "Stocks", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", icon: TrendingUp },
  MUTUAL_FUNDS: { label: "Mutual Funds & SIPs", shortLabel: "Mutual Funds", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)", icon: ChartPie },
  EPFO: { label: "EPFO Retirement", shortLabel: "EPFO", color: "#f97316", bg: "rgba(249, 115, 22, 0.12)", icon: Building2 },
  DEBT: { label: "Loans & Liabilities", shortLabel: "Loans & Debt", color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", icon: Landmark },
};

export function AssetsNetWorthTab() {
  const router = useRouter();
  const [data, setData] = useState<AssetsHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [hidePrivacy, setHidePrivacy] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedHoldingId, setExpandedHoldingId] = useState<string | null>(null);

  const [addAssetModalOpen, setAddAssetModalOpen] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState<"SAVINGS" | "FIXED_DEPOSIT" | "STOCKS" | "INVESTMENT" | "EPFO" | "CASH">("SAVINGS");
  const [newAssetInstitution, setNewAssetInstitution] = useState("");
  const [newAssetValuation, setNewAssetValuation] = useState("");
  const [addingAsset, setAddingAsset] = useState(false);

  const [editingAsset, setEditingAsset] = useState<{ id: string; name: string; type: string; institution: string | null; balance: number } | null>(null);
  const [editAssetName, setEditAssetName] = useState("");
  const [editAssetInstitution, setEditAssetInstitution] = useState("");
  const [editValuationInput, setEditValuationInput] = useState("");
  const [updatingValuation, setUpdatingValuation] = useState(false);

  const fetchAssetsData = useCallback(() => {
    setLoading(true);
    setError("");
    api<AssetsHistoryData>("/dashboard/assets-history")
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || "Failed to load assets portfolio");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchAssetsData();
  }, [fetchAssetsData]);

  const formatAmount = (val: number) => {
    if (hidePrivacy) return "••••••";
    return money(val);
  };

  const handleAddAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetName.trim()) return;
    const val = parseFloat(newAssetValuation);
    if (isNaN(val) || val < 0) {
      setError("Please enter a valid valuation amount.");
      return;
    }

    setAddingAsset(true);
    setError("");
    try {
      await api("/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: newAssetName.trim(),
          type: newAssetType,
          institution: newAssetInstitution.trim() || undefined,
          openingBalance: Math.round(val * 100),
        }),
      });
      setSuccessMsg(`Added asset "${newAssetName.trim()}"!`);
      setNewAssetName("");
      setNewAssetInstitution("");
      setNewAssetValuation("");
      setAddAssetModalOpen(false);
      fetchAssetsData();
    } catch (err: any) {
      setError(errorMessage(err, "Failed to add asset account."));
    } finally {
      setAddingAsset(false);
    }
  };

  const handleUpdateValuationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    const val = parseFloat(editValuationInput);
    if (isNaN(val) || val < 0) {
      setError("Please enter a valid valuation amount.");
      return;
    }

    setUpdatingValuation(true);
    setError("");
    try {
      await api(`/accounts/${editingAsset.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          openingBalance: Math.round(val * 100),
          name: editAssetName.trim() || undefined,
          institution: editAssetInstitution.trim() || undefined,
        }),
      });
      setSuccessMsg(`Updated valuation for "${editAssetName.trim() || editingAsset.name}"!`);
      setEditingAsset(null);
      fetchAssetsData();
    } catch (err: any) {
      setError(errorMessage(err, "Failed to update asset valuation."));
    } finally {
      setUpdatingValuation(false);
    }
  };

  if (loading) {
    return (
      <div className="loading" style={{ height: "40vh" }}>
        <span />
        <p>Loading Wealth Assets Portfolio...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel" style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>
        <AlertCircle size={28} style={{ margin: "0 auto 12px auto", display: "block" }} />
        <span>{error || "Could not load assets data"}</span>
      </div>
    );
  }

  const { netWorth, totalAssets, savingsTotal, depositsTotal, stocksTotal, mutualFundsTotal, epfoTotal, debtTotal, allocation, accounts, history } = data!;

  const filteredAccounts = accounts.filter((acc) => {
    const matchesCat = selectedCategory === "ALL" ? true : acc.category === selectedCategory;

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      acc.name.toLowerCase().includes(query) ||
      (acc.institution && acc.institution.toLowerCase().includes(query)) ||
      acc.type.toLowerCase().includes(query) ||
      acc.holdings.some(
        (h) => h.symbol.toLowerCase().includes(query) || h.name.toLowerCase().includes(query)
      );

    return matchesCat && matchesSearch;
  });

  const firstWorth = history.length > 0 ? history[0].netWorth : netWorth;
  const lastWorth = history.length > 0 ? history[history.length - 1].netWorth : netWorth;
  const netWorthDelta = lastWorth - firstWorth;
  const growthPct = firstWorth !== 0 ? Math.round(((lastWorth - firstWorth) / Math.abs(firstWorth)) * 1000) / 10 : 0;
  const isPositiveGrowth = netWorthDelta >= 0;

  const categoryCounts = {
    ALL: accounts.length,
    SAVINGS: accounts.filter((a) => a.category === "SAVINGS").length,
    DEPOSITS: accounts.filter((a) => a.category === "DEPOSITS").length,
    STOCKS: accounts.filter((a) => a.category === "STOCKS").length,
    MUTUAL_FUNDS: accounts.filter((a) => a.category === "MUTUAL_FUNDS").length,
    EPFO: accounts.filter((a) => a.category === "EPFO").length,
    DEBT: accounts.filter((a) => a.category === "DEBT").length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {successMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={16} /> {successMsg}
        </div>
      )}

      <div className="hero-card assets-hero" style={{ position: "relative" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.85, fontWeight: 700 }}>
              Total Net Worth
            </span>
            <span
              style={{
                background: isPositiveGrowth ? "rgba(255, 255, 255, 0.18)" : "rgba(239, 68, 68, 0.25)",
                padding: "3px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}>
              {isPositiveGrowth ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {growthPct > 0 ? `+${growthPct}%` : `${growthPct}%`} (12M Growth)
            </span>
            <span style={{ background: "rgba(16, 185, 129, 0.25)", border: "1px solid rgba(16, 185, 129, 0.4)", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, color: "#ffffff" }}>
              💎 {accounts.length} Active Accounts
            </span>
          </div>
          <strong style={{ margin: "6px 0", display: "block", fontSize: "2.2rem", fontWeight: 800 }}>{formatAmount(netWorth)}</strong>
          <small style={{ opacity: 0.9 }}>
            Total Assets: {formatAmount(totalAssets)} • Total Debt &amp; Loans: {formatAmount(debtTotal)}
          </small>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", zIndex: 10 }}>
          <button
            type="button"
            className="primary compact"
            onClick={() => setAddAssetModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "20px",
              background: "var(--green)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "12px",
              border: "none",
              cursor: "pointer",
            }}>
            <Plus size={15} />
            <span>Add Asset</span>
          </button>

          <button
            type="button"
            onClick={() => setHidePrivacy(!hidePrivacy)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "20px",
              background: hidePrivacy ? "rgba(255, 255, 255, 0.2)" : "rgba(16, 185, 129, 0.3)",
              border: `1px solid ${hidePrivacy ? "rgba(255, 255, 255, 0.35)" : "rgba(16, 185, 129, 0.6)"}`,
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "12px",
              backdropFilter: "blur(12px)",
              cursor: "pointer",
            }}>
            {hidePrivacy ? <Eye size={15} /> : <EyeOff size={15} />}
            <span>{hidePrivacy ? "Show Amounts" : "Hide Amounts"}</span>
          </button>
        </div>
      </div>

      <section className="panel" style={{ padding: "20px 24px" }}>
        <div className="panel-title" style={{ marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>Portfolio Diversification</span>
            <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Asset Allocation Breakdown</h2>
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
            {totalAssets > 0 ? "100% Allocated" : "0%"}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ height: "14px", width: "100%", background: "var(--line)", borderRadius: "8px", overflow: "hidden", display: "flex" }}>
            {allocation.savings.percentage > 0 && (
              <div style={{ width: `${allocation.savings.percentage}%`, background: "#0ea5e9" }} title={`Savings & Cash: ${allocation.savings.percentage}%`} />
            )}
            {allocation.deposits.percentage > 0 && (
              <div style={{ width: `${allocation.deposits.percentage}%`, background: "#f59e0b" }} title={`Fixed Deposits: ${allocation.deposits.percentage}%`} />
            )}
            {allocation.stocks.percentage > 0 && (
              <div style={{ width: `${allocation.stocks.percentage}%`, background: "#10b981" }} title={`Stocks: ${allocation.stocks.percentage}%`} />
            )}
            {allocation.mutualFunds.percentage > 0 && (
              <div style={{ width: `${allocation.mutualFunds.percentage}%`, background: "#8b5cf6" }} title={`Mutual Funds: ${allocation.mutualFunds.percentage}%`} />
            )}
            {allocation.epfo.percentage > 0 && (
              <div style={{ width: `${allocation.epfo.percentage}%`, background: "#f97316" }} title={`EPFO: ${allocation.epfo.percentage}%`} />
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === "SAVINGS" ? "ALL" : "SAVINGS")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: selectedCategory === "SAVINGS" ? "rgba(14, 165, 233, 0.15)" : "var(--card)",
                border: `1px solid ${selectedCategory === "SAVINGS" ? "#0ea5e9" : "var(--line)"}`,
                borderRadius: "10px",
                cursor: "pointer",
                textAlign: "left",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#0ea5e9", flexShrink: 0 }} />
                <div>
                  <small style={{ display: "block", fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Savings &amp; Cash</small>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{formatAmount(savingsTotal)}</strong>
                </div>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#0ea5e9" }}>{allocation.savings.percentage}%</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === "DEPOSITS" ? "ALL" : "DEPOSITS")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: selectedCategory === "DEPOSITS" ? "rgba(245, 158, 11, 0.15)" : "var(--card)",
                border: `1px solid ${selectedCategory === "DEPOSITS" ? "#f59e0b" : "var(--line)"}`,
                borderRadius: "10px",
                cursor: "pointer",
                textAlign: "left",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                <div>
                  <small style={{ display: "block", fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Fixed Deposits (FD/RD)</small>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{formatAmount(depositsTotal)}</strong>
                </div>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#f59e0b" }}>{allocation.deposits.percentage}%</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === "STOCKS" ? "ALL" : "STOCKS")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: selectedCategory === "STOCKS" ? "rgba(16, 185, 129, 0.15)" : "var(--card)",
                border: `1px solid ${selectedCategory === "STOCKS" ? "#10b981" : "var(--line)"}`,
                borderRadius: "10px",
                cursor: "pointer",
                textAlign: "left",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                <div>
                  <small style={{ display: "block", fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Stocks &amp; Demat</small>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{formatAmount(stocksTotal)}</strong>
                </div>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#10b981" }}>{allocation.stocks.percentage}%</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === "MUTUAL_FUNDS" ? "ALL" : "MUTUAL_FUNDS")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: selectedCategory === "MUTUAL_FUNDS" ? "rgba(139, 92, 246, 0.15)" : "var(--card)",
                border: `1px solid ${selectedCategory === "MUTUAL_FUNDS" ? "#8b5cf6" : "var(--line)"}`,
                borderRadius: "10px",
                cursor: "pointer",
                textAlign: "left",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#8b5cf6", flexShrink: 0 }} />
                <div>
                  <small style={{ display: "block", fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Mutual Funds &amp; SIPs</small>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{formatAmount(mutualFundsTotal)}</strong>
                </div>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#8b5cf6" }}>{allocation.mutualFunds.percentage}%</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === "EPFO" ? "ALL" : "EPFO")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: selectedCategory === "EPFO" ? "rgba(249, 115, 22, 0.15)" : "var(--card)",
                border: `1px solid ${selectedCategory === "EPFO" ? "#f97316" : "var(--line)"}`,
                borderRadius: "10px",
                cursor: "pointer",
                textAlign: "left",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f97316", flexShrink: 0 }} />
                <div>
                  <small style={{ display: "block", fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>EPFO Provident Fund</small>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{formatAmount(epfoTotal)}</strong>
                </div>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#f97316" }}>{allocation.epfo.percentage}%</span>
            </button>

            {debtTotal > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === "DEBT" ? "ALL" : "DEBT")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: selectedCategory === "DEBT" ? "rgba(239, 68, 68, 0.15)" : "var(--card)",
                  border: `1px solid ${selectedCategory === "DEBT" ? "#ef4444" : "var(--line)"}`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  textAlign: "left",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                  <div>
                    <small style={{ display: "block", fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Loans &amp; Debt</small>
                    <strong style={{ fontSize: "13px", color: "#ef4444" }}>{formatAmount(debtTotal)}</strong>
                  </div>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444" }}>
                  {categoryCounts.DEBT} {categoryCounts.DEBT === 1 ? "loan" : "loans"}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="panel" style={{ padding: "24px" }}>
        <div className="panel-title" style={{ flexWrap: "wrap", gap: "16px", alignItems: "center", marginBottom: "20px", display: "flex", justifyContent: "space-between" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>Holdings, Balances &amp; Debt</span>
            <h2 style={{ fontSize: "1.2rem", margin: 0 }}>
              {selectedCategory === "ALL" ? "All Accounts Portfolio" : ASSET_CATEGORY_CONFIG[selectedCategory].label} ({filteredAccounts.length})
            </h2>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", minWidth: "220px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                type="text"
                placeholder="Search assets, loans, stocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: "36px",
                  fontSize: "12px",
                  paddingLeft: "32px",
                  paddingRight: "10px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--background-alt)",
                  color: "var(--ink)",
                }}
              />
            </div>

            <div className="asset-filter-bar" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(["ALL", "SAVINGS", "DEPOSITS", "STOCKS", "MUTUAL_FUNDS", "EPFO", "DEBT"] as const).map((cat) => {
                const conf = ASSET_CATEGORY_CONFIG[cat];
                const Icon = conf.icon;
                const count = categoryCounts[cat];
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`secondary compact ${isActive ? "active" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      fontSize: "12px",
                      padding: "6px 12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: isActive ? 700 : 500,
                      borderColor: isActive ? conf.color : undefined,
                    }}>
                    <Icon size={13} color={isActive ? conf.color : "var(--muted)"} />
                    <span>{conf.shortLabel}</span>
                    <span style={{ fontSize: "11px", opacity: 0.75, background: "rgba(255, 255, 255, 0.08)", padding: "1px 5px", borderRadius: "8px" }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          {filteredAccounts.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--muted)", fontSize: "13px", background: "var(--card)", borderRadius: "12px", border: "1px dashed var(--line)" }}>
              <Layers size={32} style={{ margin: "0 auto 10px auto", opacity: 0.4 }} />
              <p style={{ margin: "0 0 12px 0", fontWeight: 600 }}>No accounts found matching this filter.</p>
              <button
                type="button"
                className="secondary compact"
                onClick={() => {
                  setSelectedCategory("ALL");
                  setSearchQuery("");
                }}>
                Reset Filters
              </button>
            </div>
          ) : (
            filteredAccounts.map((acc) => {
              const isDebt = acc.category === "DEBT" || acc.balance < 0;
              const pctOfAssets = totalAssets > 0 && acc.balance > 0 ? Math.round((acc.balance / totalAssets) * 1000) / 10 : 0;
              const logo = getLocalLogo(acc.institution, acc.name);
              const conf = ASSET_CATEGORY_CONFIG[acc.category];
              const CategoryIcon = conf.icon;
              const isExpanded = expandedHoldingId === acc.id;

              return (
                <div
                  key={acc.id}
                  className="account-asset-card"
                  style={{
                    background: "var(--card)",
                    border: `1px solid ${isDebt ? "rgba(239, 68, 68, 0.3)" : "var(--line)"}`,
                    borderRadius: "14px",
                    padding: "18px 20px",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: isDebt ? "rgba(239, 68, 68, 0.08)" : "var(--background-alt)",
                          border: `1px solid ${isDebt ? "rgba(239, 68, 68, 0.25)" : "var(--line)"}`,
                          display: "grid",
                          placeItems: "center",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}>
                        {logo ? (
                          <img src={logo} alt={acc.institution || acc.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: "4px" }} />
                        ) : (
                          <CategoryIcon size={20} color={conf.color} />
                        )}
                      </div>

                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              color: conf.color,
                              background: conf.bg,
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}>
                            {conf.shortLabel}
                          </span>
                          {acc.institution && (
                            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                              {acc.institution}
                            </span>
                          )}
                        </div>
                        <h3
                          style={{
                            margin: "4px 0 0 0",
                            fontSize: "1.05rem",
                            fontWeight: 700,
                            color: "var(--ink)",
                            cursor: "pointer",
                          }}
                          onClick={() => router.push(`/accounts?account=${acc.id}`)}>
                          {acc.name}
                        </h3>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px", marginLeft: "auto" }}>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ fontSize: "1.3rem", fontWeight: 800, color: isDebt ? "#ef4444" : "var(--ink)", display: "block" }}>
                          {formatAmount(acc.balance)}
                        </strong>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end", marginTop: "2px" }}>
                          {isDebt ? (
                            <small style={{ color: "#ef4444", fontSize: "11px", fontWeight: 600 }}>
                              Outstanding Loan Principal
                            </small>
                          ) : (
                            totalAssets > 0 && (
                              <small style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 600 }}>
                                {pctOfAssets}% of total assets
                              </small>
                            )
                          )}
                          {acc.unrealizedPnl !== null && acc.unrealizedPnl !== 0 && (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: "4px",
                                background: acc.unrealizedPnl > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                color: acc.unrealizedPnl > 0 ? "#10b981" : "#ef4444",
                              }}>
                              {acc.unrealizedPnl > 0 ? `+${money(acc.unrealizedPnl)} P&L` : `${money(acc.unrealizedPnl)} P&L`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="icon-button"
                          title="Edit Valuation / Balance"
                          onClick={() => {
                            setEditingAsset(acc);
                            setEditAssetName(acc.name);
                            setEditAssetInstitution(acc.institution || "");
                            setEditValuationInput(String(Math.abs(acc.balance) / 100));
                          }}
                          style={{
                            background: "var(--background-alt)",
                            border: "1px solid var(--line)",
                            borderRadius: "8px",
                            padding: "7px 10px",
                            cursor: "pointer",
                            fontSize: "11px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "var(--ink)",
                            fontWeight: 600,
                          }}>
                          <Pencil size={12} />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          className="icon-button"
                          title={isDebt ? "Open Loan Schedule & Ledger" : "Open Account Ledger & Documents"}
                          onClick={() => router.push(`/accounts?account=${acc.id}`)}
                          style={{
                            background: "var(--background-alt)",
                            border: "1px solid var(--line)",
                            borderRadius: "8px",
                            padding: "7px 10px",
                            cursor: "pointer",
                            fontSize: "11px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "var(--ink)",
                            fontWeight: 600,
                          }}>
                          <ArrowUpRight size={13} />
                          <span>{isDebt ? "Loan Details" : "Ledger"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {acc.holdings.length > 0 && (
                    <div style={{ marginTop: "14px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Holdings Positions ({acc.holdingCount} assets)
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedHoldingId(isExpanded ? null : acc.id)}
                          style={{
                            fontSize: "11px",
                            color: "var(--green)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}>
                          <span>{isExpanded ? "Collapse Holdings" : "View All Holdings"}</span>
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>

                      {!isExpanded && (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {acc.holdings.slice(0, 6).map((h, hIdx) => (
                            <span
                              key={hIdx}
                              style={{
                                background: "var(--background-alt)",
                                border: "1px solid var(--line)",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                fontSize: "12px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}>
                              <strong style={{ color: "var(--ink)" }}>{h.symbol}</strong>
                              <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                                {h.currentValue !== null ? formatAmount(h.currentValue) : `${h.quantity} units`}
                              </span>
                              {h.unrealizedPnl !== null && h.unrealizedPnl !== 0 && (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    color: h.unrealizedPnl > 0 ? "#10b981" : "#ef4444",
                                  }}>
                                  {h.unrealizedPnl > 0 ? `+${money(h.unrealizedPnl)}` : money(h.unrealizedPnl)}
                                </span>
                              )}
                            </span>
                          ))}
                          {acc.holdings.length > 6 && (
                            <span
                              onClick={() => setExpandedHoldingId(acc.id)}
                              style={{
                                background: "var(--background-alt)",
                                border: "1px dashed var(--line)",
                                padding: "4px 8px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                color: "var(--muted)",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}>
                              +{acc.holdings.length - 6} more
                            </span>
                          )}
                        </div>
                      )}

                      {isExpanded && (
                        <div style={{ background: "var(--background-alt)", borderRadius: "10px", border: "1px solid var(--line)", overflow: "hidden", marginTop: "8px" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid var(--line)", background: "rgba(255, 255, 255, 0.02)", textAlign: "left" }}>
                                <th style={{ padding: "8px 12px", color: "var(--muted)", fontWeight: 600 }}>Asset / Symbol</th>
                                <th style={{ padding: "8px 12px", color: "var(--muted)", fontWeight: 600 }}>Quantity</th>
                                <th style={{ padding: "8px 12px", color: "var(--muted)", fontWeight: 600 }}>Avg Buy Price</th>
                                <th style={{ padding: "8px 12px", color: "var(--muted)", fontWeight: 600, textAlign: "right" }}>Current Value</th>
                                <th style={{ padding: "8px 12px", color: "var(--muted)", fontWeight: 600, textAlign: "right" }}>Unrealized P&amp;L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {acc.holdings.map((h, hIdx) => (
                                <tr key={hIdx} style={{ borderBottom: hIdx === acc.holdings.length - 1 ? "none" : "1px solid var(--line)" }}>
                                  <td style={{ padding: "8px 12px" }}>
                                    <strong style={{ color: "var(--ink)", display: "block" }}>{h.symbol}</strong>
                                    <small style={{ color: "var(--muted)", fontSize: "10px" }}>{h.name} • {h.category}</small>
                                  </td>
                                  <td style={{ padding: "8px 12px", color: "var(--ink)", fontWeight: 600 }}>{h.quantity}</td>
                                  <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{h.averagePrice !== null ? money(h.averagePrice) : "—"}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--ink)" }}>
                                    {h.currentValue !== null ? formatAmount(h.currentValue) : "—"}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                                    {h.unrealizedPnl !== null ? (
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          color: h.unrealizedPnl > 0 ? "#10b981" : h.unrealizedPnl < 0 ? "#ef4444" : "var(--muted)",
                                        }}>
                                        {h.unrealizedPnl > 0 ? `+${money(h.unrealizedPnl)}` : money(h.unrealizedPnl)}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {addAssetModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)", zIndex: 10000, display: "grid", placeItems: "center", padding: "16px" }}>
          <section className="panel" style={{ width: "min(500px, 94vw)", padding: "28px", borderRadius: "16px", position: "relative", background: "var(--card)", border: "1px solid var(--line)" }}>
            <button type="button" className="icon-button" style={{ position: "absolute", top: "16px", right: "16px" }} onClick={() => setAddAssetModalOpen(false)}>
              <X size={16} />
            </button>

            <span className="eyebrow" style={{ color: "var(--green)" }}>Wealth Holdings</span>
            <h2 style={{ margin: "4px 0 20px", fontSize: "1.3rem" }}>Add Asset Account</h2>

            <form onSubmit={handleAddAssetSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Asset Classification *</label>
                <select
                  value={newAssetType}
                  onChange={(e: any) => setNewAssetType(e.target.value)}
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                  <option value="SAVINGS">💰 Bank Savings Account / Liquid Cash</option>
                  <option value="FIXED_DEPOSIT">🏦 Fixed Deposit (FD) / Recurring Deposit (RD)</option>
                  <option value="STOCKS">📈 Demat &amp; Stock Market Portfolio</option>
                  <option value="INVESTMENT">📊 Mutual Funds &amp; SIPs</option>
                  <option value="EPFO">🏛️ EPFO Employee Provident Fund</option>
                  <option value="CASH">🪙 Physical Gold / Real Estate / Tangible Asset</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Asset / Account Name *</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Salary Savings, SBI 3-Year FD, Zerodha Demat"
                  value={newAssetName}
                  onChange={(e) => setNewAssetName(e.target.value)}
                  required
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Institution / Broker (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, SBI, Zerodha, Groww, EPFO"
                  value={newAssetInstitution}
                  onChange={(e) => setNewAssetInstitution(e.target.value)}
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Current Valuation / Opening Balance (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 250000"
                  value={newAssetValuation}
                  onChange={(e) => setNewAssetValuation(e.target.value)}
                  required
                  style={{ width: "100%", height: "40px", fontSize: "14px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" className="ghost compact" onClick={() => setAddAssetModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={addingAsset} className="primary compact" style={{ minWidth: "120px" }}>
                  {addingAsset ? <Loader2 size={14} className="spin" /> : "Save Asset"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingAsset && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)", zIndex: 10000, display: "grid", placeItems: "center", padding: "16px" }}>
          <section className="panel" style={{ width: "min(480px, 94vw)", padding: "28px", borderRadius: "16px", position: "relative", background: "var(--card)", border: "1px solid var(--line)" }}>
            <button type="button" className="icon-button" style={{ position: "absolute", top: "16px", right: "16px" }} onClick={() => setEditingAsset(null)}>
              <X size={16} />
            </button>

            <span className="eyebrow" style={{ color: "var(--green)" }}>Valuation Calibration</span>
            <h2 style={{ margin: "4px 0 20px", fontSize: "1.3rem" }}>Edit Valuation / Balance</h2>

            <form onSubmit={handleUpdateValuationSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Asset Name</label>
                <input
                  type="text"
                  value={editAssetName}
                  onChange={(e) => setEditAssetName(e.target.value)}
                  required
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Institution / Broker</label>
                <input
                  type="text"
                  value={editAssetInstitution}
                  onChange={(e) => setEditAssetInstitution(e.target.value)}
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Current Asset Valuation / Balance (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editValuationInput}
                  onChange={(e) => setEditValuationInput(e.target.value)}
                  required
                  style={{ width: "100%", height: "40px", fontSize: "14px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" className="ghost compact" onClick={() => setEditingAsset(null)}>Cancel</button>
                <button type="submit" disabled={updatingValuation} className="primary compact" style={{ minWidth: "120px" }}>
                  {updatingValuation ? <Loader2 size={14} className="spin" /> : "Update Valuation"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
