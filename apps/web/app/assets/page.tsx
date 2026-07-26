"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  ShieldAlert,
  Building2,
  AlertCircle,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { api, money } from "@/lib/api";

interface Holding {
  symbol: string;
  name: string;
  category: string;
  quantity: number;
  currentValue: number | null;
}

interface AccountAsset {
  id: string;
  name: string;
  type: string;
  institution: string;
  balance: number;
  holdingCount: number;
  holdings: Holding[];
}

interface AssetsHistoryData {
  netWorth: number;
  liquidCashTotal: number;
  equitiesTotal: number;
  epfoTotal: number;
  debtTotal: number;
  totalAssets: number;
  allocation: {
    liquidCash: { amount: number; percentage: number };
    equities: { amount: number; percentage: number };
    epfo: { amount: number; percentage: number };
    debt: { amount: number; percentage: number };
  };
  accounts: AccountAsset[];
  history: {
    month: string;
    liquid: number;
    equities: number;
    epfo: number;
    debt: number;
    netWorth: number;
  }[];
}

export default function AssetsPage() {
  const [data, setData] = useState<AssetsHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hidePrivacy, setHidePrivacy] = useState(false);
  const [selectedAssetCategory, setSelectedAssetCategory] = useState<"ALL" | "CASH" | "EQUITIES" | "EPFO" | "DEBT">("ALL");

  useEffect(() => {
    setLoading(true);
    api<AssetsHistoryData>("/dashboard/assets-history")
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || "Failed to load assets history");
        setLoading(false);
      });
  }, []);

  const formatAmount = (val: number) => {
    if (hidePrivacy) return "••••••";
    return money(val);
  };

  if (loading) {
    return (
      <Shell>
        <div className="loading" style={{ height: "60vh" }}>
          <span />
          <p>Loading Assets & Net Worth Portfolio...</p>
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="panel" style={{ padding: "40px", textAlign: "center", color: "var(--red)" }}>
          <AlertCircle size={28} style={{ margin: "0 auto 12px auto", display: "block" }} />
          <span>{error || "Could not load assets data"}</span>
        </div>
      </Shell>
    );
  }

  const { netWorth, liquidCashTotal, equitiesTotal, epfoTotal, debtTotal, totalAssets, allocation, accounts, history } = data;

  // Filter accounts by category
  const filteredAccounts = accounts.filter((acc) => {
    if (selectedAssetCategory === "CASH") return ["SAVINGS", "BANK", "CASH", "FD", "FIXED_DEPOSIT"].includes(acc.type);
    if (selectedAssetCategory === "EQUITIES") return ["INVESTMENT", "STOCKS", "MUTUAL_FUND"].includes(acc.type);
    if (selectedAssetCategory === "EPFO") return acc.type === "EPFO";
    if (selectedAssetCategory === "DEBT") return ["LOAN", "CREDIT_CARD"].includes(acc.type);
    return true;
  });

  // Calculate 12-month net worth trend change
  const firstWorth = history.length > 0 ? history[0].netWorth : netWorth;
  const lastWorth = history.length > 0 ? history[history.length - 1].netWorth : netWorth;
  const netWorthDelta = lastWorth - firstWorth;
  const growthPct = firstWorth !== 0 ? Math.round(((lastWorth - firstWorth) / Math.abs(firstWorth)) * 1000) / 10 : 0;
  const isPositiveGrowth = netWorthDelta >= 0;

  const maxWorth = Math.max(...history.map((h) => h.netWorth), 1);
  const minWorth = Math.min(...history.map((h) => h.netWorth), 0);
  const worthDiff = maxWorth - minWorth || 1;

  // Category counts
  const countCash = accounts.filter((acc) => ["SAVINGS", "BANK", "CASH", "FD", "FIXED_DEPOSIT"].includes(acc.type)).length;
  const countEquities = accounts.filter((acc) => ["INVESTMENT", "STOCKS", "MUTUAL_FUND"].includes(acc.type)).length;
  const countEpfo = accounts.filter((acc) => acc.type === "EPFO").length;
  const countDebt = accounts.filter((acc) => ["LOAN", "CREDIT_CARD"].includes(acc.type)).length;

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* 1. Signature Hero Banner */}
        <div className="hero-card assets-hero">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.85, fontWeight: 700 }}>
                Total Net Worth & Assets
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
                }}
              >
                {isPositiveGrowth ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {growthPct > 0 ? `+${growthPct}%` : `${growthPct}%`} (12M)
              </span>
            </div>
            <strong style={{ margin: "4px 0" }}>{formatAmount(netWorth)}</strong>
            <small>
              <Sparkles size={14} />
              Total Assets: {formatAmount(totalAssets)} • Liabilities: {formatAmount(debtTotal)}
            </small>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div className="hero-orbit">
              <span>{hidePrivacy ? "•••" : `₹${(netWorth / 100000).toFixed(1)}L`}</span>
              <small>Net Worth</small>
            </div>
            <button
              type="button"
              className="secondary compact"
              onClick={() => setHidePrivacy(!hidePrivacy)}
              style={{
                background: "rgba(255, 255, 255, 0.16)",
                borderColor: "rgba(255, 255, 255, 0.25)",
                color: "white",
                backdropFilter: "blur(8px)",
              }}
            >
              {hidePrivacy ? <Eye size={15} /> : <EyeOff size={15} />}
              {hidePrivacy ? "Show" : "Hide"}
            </button>
          </div>
        </div>

        {/* 2. Key Asset Class KPI Cards */}
        <div className="assets-kpi-grid">
          {/* Liquid Cash & FDs */}
          <div className="assets-kpi-card">
            <div className="assets-kpi-header">
              <span className="assets-kpi-label" style={{ color: "#3b82f6" }}>Liquid Cash & FDs</span>
              <div className="assets-kpi-icon cash"><Wallet size={20} /></div>
            </div>
            <strong style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--ink)" }}>{formatAmount(liquidCashTotal)}</strong>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--muted)" }}>
              <span>Share of total assets</span>
              <strong style={{ color: "#3b82f6" }}>{allocation.liquidCash.percentage}%</strong>
            </div>
            <div className="assets-progress-track">
              <div className="assets-progress-fill" style={{ width: `${allocation.liquidCash.percentage}%`, background: "#3b82f6" }} />
            </div>
          </div>

          {/* Equities & Investments */}
          <div className="assets-kpi-card">
            <div className="assets-kpi-header">
              <span className="assets-kpi-label" style={{ color: "#8b5cf6" }}>Equities & Stocks</span>
              <div className="assets-kpi-icon equities"><PieChart size={20} /></div>
            </div>
            <strong style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--ink)" }}>{formatAmount(equitiesTotal)}</strong>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--muted)" }}>
              <span>Share of total assets</span>
              <strong style={{ color: "#8b5cf6" }}>{allocation.equities.percentage}%</strong>
            </div>
            <div className="assets-progress-track">
              <div className="assets-progress-fill" style={{ width: `${allocation.equities.percentage}%`, background: "#8b5cf6" }} />
            </div>
          </div>

          {/* EPFO Retirement */}
          <div className="assets-kpi-card">
            <div className="assets-kpi-header">
              <span className="assets-kpi-label" style={{ color: "#f59e0b" }}>EPFO Provident Fund</span>
              <div className="assets-kpi-icon epfo"><Building2 size={20} /></div>
            </div>
            <strong style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--ink)" }}>{formatAmount(epfoTotal)}</strong>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--muted)" }}>
              <span>Share of total assets</span>
              <strong style={{ color: "#f59e0b" }}>{allocation.epfo.percentage}%</strong>
            </div>
            <div className="assets-progress-track">
              <div className="assets-progress-fill" style={{ width: `${allocation.epfo.percentage}%`, background: "#f59e0b" }} />
            </div>
          </div>

          {/* Debt & Liabilities */}
          <div className="assets-kpi-card">
            <div className="assets-kpi-header">
              <span className="assets-kpi-label" style={{ color: "#ef4444" }}>Loans & Credit Debt</span>
              <div className="assets-kpi-icon debt"><ShieldAlert size={20} /></div>
            </div>
            <strong style={{ fontSize: "1.45rem", fontWeight: 700, color: "#ef4444" }}>{formatAmount(debtTotal)}</strong>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--muted)" }}>
              <span>Outstanding balance</span>
              <strong style={{ color: "#ef4444" }}>Liabilities</strong>
            </div>
            <div className="assets-progress-track">
              <div className="assets-progress-fill" style={{ width: `${Math.min(100, Math.round((debtTotal / (totalAssets || 1)) * 100))}%`, background: "#ef4444" }} />
            </div>
          </div>
        </div>

        {/* 3. Monthly Progression & Allocation Ratio Panel */}
        <section className="panel" style={{ padding: "24px" }}>
          <div className="panel-title" style={{ marginBottom: "20px" }}>
            <div>
              <span className="eyebrow" style={{ color: "var(--green)" }}>12-Month Historical Progression</span>
              <h2>Net Worth Growth & Asset Allocation</h2>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "12px" }}>
              <span style={{ color: "var(--muted)" }}>
                Range: <strong>{money(minWorth)}</strong> – <strong>{money(maxWorth)}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Visual Bar Columns */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: "200px", paddingTop: "24px", paddingBottom: "10px", borderBottom: "1px solid var(--line)" }}>
              {history.map((h, idx) => {
                const heightPct = Math.max(15, Math.min(100, Math.round(((h.netWorth - minWorth) / worthDiff) * 100)));
                const isLatest = idx === history.length - 1;
                return (
                  <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "10px", color: isLatest ? "var(--green)" : "var(--muted)", fontWeight: isLatest ? 700 : 500 }}>
                      {hidePrivacy ? "•••" : `₹${(h.netWorth / 100000).toFixed(1)}L`}
                    </span>
                    <div
                      title={`${h.month}: Net Worth ${money(h.netWorth)}`}
                      style={{
                        width: "100%",
                        maxWidth: "32px",
                        height: `${heightPct}%`,
                        background: isLatest
                          ? "linear-gradient(180deg, var(--green), var(--theme-soft-start))"
                          : "linear-gradient(180deg, rgba(59, 130, 246, 0.85), rgba(59, 130, 246, 0.25))",
                        borderRadius: "6px 6px 0 0",
                        transition: "all 0.25s ease",
                        boxShadow: isLatest ? "0 4px 12px var(--theme-shadow-color)" : "none",
                      }}
                    />
                    <span style={{ fontSize: "10px", color: isLatest ? "var(--green)" : "var(--muted)", fontWeight: isLatest ? 700 : 500 }}>
                      {h.month.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Asset Allocation Multi-Segment Progress Bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginBottom: "10px" }}>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>Current Asset Class Distribution</span>
                <span>Total Wealth Portfolio: <strong style={{ color: "var(--green)" }}>{formatAmount(totalAssets)}</strong></span>
              </div>
              <div style={{ height: "14px", width: "100%", borderRadius: "7px", overflow: "hidden", display: "flex", background: "var(--line)" }}>
                <div style={{ width: `${allocation.liquidCash.percentage}%`, background: "#3b82f6" }} title={`Liquid Cash: ${allocation.liquidCash.percentage}%`} />
                <div style={{ width: `${allocation.equities.percentage}%`, background: "#8b5cf6" }} title={`Equities: ${allocation.equities.percentage}%`} />
                <div style={{ width: `${allocation.epfo.percentage}%`, background: "#f59e0b" }} title={`EPFO: ${allocation.epfo.percentage}%`} />
              </div>

              <div style={{ display: "flex", gap: "20px", marginTop: "14px", flexWrap: "wrap", fontSize: "12px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#3b82f6" }} />
                  Liquid Cash & FDs: {formatAmount(liquidCashTotal)} ({allocation.liquidCash.percentage}%)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#8b5cf6" }} />
                  Equities & Stocks: {formatAmount(equitiesTotal)} ({allocation.equities.percentage}%)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
                  EPFO Provident Fund: {formatAmount(epfoTotal)} ({allocation.epfo.percentage}%)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#ef4444" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
                  Liabilities & Debt: {formatAmount(debtTotal)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Detailed Account Asset Portfolio Section */}
        <section className="panel" style={{ padding: "24px" }}>
          <div className="panel-title" style={{ flexWrap: "wrap", gap: "16px", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <span className="eyebrow" style={{ color: "var(--green)" }}>Holdings & Accounts Portfolio</span>
              <h2>Account Assets Breakdown</h2>
            </div>

            {/* Asset Category Filter Pills */}
            <div className="asset-filter-bar">
              <button
                type="button"
                className={`asset-filter-pill ${selectedAssetCategory === "ALL" ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory("ALL")}
              >
                <Layers size={14} />
                All
                <span className="asset-filter-count">{accounts.length}</span>
              </button>
              <button
                type="button"
                className={`asset-filter-pill ${selectedAssetCategory === "CASH" ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory("CASH")}
              >
                <Wallet size={14} />
                Cash & FDs
                <span className="asset-filter-count">{countCash}</span>
              </button>
              <button
                type="button"
                className={`asset-filter-pill ${selectedAssetCategory === "EQUITIES" ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory("EQUITIES")}
              >
                <PieChart size={14} />
                Equities
                <span className="asset-filter-count">{countEquities}</span>
              </button>
              <button
                type="button"
                className={`asset-filter-pill ${selectedAssetCategory === "EPFO" ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory("EPFO")}
              >
                <Building2 size={14} />
                EPFO
                <span className="asset-filter-count">{countEpfo}</span>
              </button>
              <button
                type="button"
                className={`asset-filter-pill ${selectedAssetCategory === "DEBT" ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory("DEBT")}
              >
                <ShieldAlert size={14} />
                Loans & Debt
                <span className="asset-filter-count">{countDebt}</span>
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            {filteredAccounts.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                No active accounts or holdings found under this category filter.
              </div>
            ) : (
              filteredAccounts.map((acc) => {
                const isNegative = acc.balance < 0;
                const pctOfAssets = totalAssets > 0 && !isNegative ? Math.round((acc.balance / totalAssets) * 1000) / 10 : 0;
                return (
                  <div key={acc.id} className="account-asset-card">
                    <div className="account-asset-header">
                      <div className="account-asset-title-group">
                        <div className="account-asset-icon">
                          {acc.institution ? acc.institution[0].toUpperCase() : <Landmark size={20} />}
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                            {acc.institution} • {acc.type}
                          </span>
                          <h3 style={{ margin: "2px 0 0 0", fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)" }}>{acc.name}</h3>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <strong style={{ fontSize: "1.3rem", fontWeight: 700, color: isNegative ? "#ef4444" : "var(--ink)" }}>
                          {formatAmount(acc.balance)}
                        </strong>
                        {!isNegative && totalAssets > 0 && (
                          <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "2px" }}>
                            {pctOfAssets}% of total assets
                          </small>
                        )}
                      </div>
                    </div>

                    {/* Progress ratio bar for positive account balance */}
                    {!isNegative && totalAssets > 0 && (
                      <div className="assets-progress-track">
                        <div className="assets-progress-fill" style={{ width: `${pctOfAssets}%`, background: "var(--green)" }} />
                      </div>
                    )}

                    {/* Portfolio Holdings Chips if present */}
                    {acc.holdings.length > 0 && (
                      <div style={{ background: "var(--paper)", borderRadius: "12px", padding: "12px 16px", border: "1px solid var(--line)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "8px" }}>
                          Holdings Positions ({acc.holdingCount} assets)
                        </span>
                        <div className="holdings-chip-grid">
                          {acc.holdings.slice(0, 8).map((h, hIdx) => (
                            <span key={hIdx} className="holding-chip">
                              <strong style={{ color: "var(--ink)" }}>{h.symbol}</strong>
                              <span style={{ color: "var(--muted)" }}>
                                {h.currentValue !== null ? money(h.currentValue) : `${h.quantity} units`}
                              </span>
                            </span>
                          ))}
                          {acc.holdings.length > 8 && (
                            <span style={{ fontSize: "11px", color: "var(--muted)", alignSelf: "center", paddingLeft: "4px" }}>
                              +{acc.holdings.length - 8} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}
