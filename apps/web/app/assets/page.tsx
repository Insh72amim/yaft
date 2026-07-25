"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Wallet,
  PieChart,
  ShieldAlert,
  Building2,
  AlertCircle,
  Eye,
  EyeOff,
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
        <div className="panel" style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          <TrendingUp className="spin" size={28} style={{ margin: "0 auto 12px auto", display: "block", color: "var(--green)" }} />
          <span>Loading Assets & Net Worth History...</span>
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="panel" style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>
          <AlertCircle size={28} style={{ margin: "0 auto 12px auto", display: "block" }} />
          <span>{error || "Could not load assets data"}</span>
        </div>
      </Shell>
    );
  }

  const { netWorth, liquidCashTotal, equitiesTotal, epfoTotal, debtTotal, totalAssets, allocation, accounts, history } = data;

  const filteredAccounts = accounts.filter((acc) => {
    if (selectedAssetCategory === "CASH") return ["SAVINGS", "BANK", "CASH", "FD"].includes(acc.type);
    if (selectedAssetCategory === "EQUITIES") return ["INVESTMENT", "STOCKS", "MUTUAL_FUND"].includes(acc.type);
    if (selectedAssetCategory === "EPFO") return acc.type === "EPFO";
    if (selectedAssetCategory === "DEBT") return ["LOAN", "CREDIT_CARD"].includes(acc.type);
    return true;
  });

  const maxWorth = Math.max(...history.map((h) => h.netWorth), 1);
  const minWorth = Math.min(...history.map((h) => h.netWorth), 0);
  const worthDiff = maxWorth - minWorth || 1;

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* 1. Header Title & Privacy Masking Toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)", fontWeight: 700 }}>Wealth & Asset Portfolio</span>
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Assets & Net Worth</h1>
          </div>
          <button
            type="button"
            className="secondary compact"
            onClick={() => setHidePrivacy(!hidePrivacy)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            {hidePrivacy ? <Eye size={15} /> : <EyeOff size={15} />}
            {hidePrivacy ? "Show Amounts" : "Hide Amounts"}
          </button>
        </div>

        {/* 2. Top Summary KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {/* Total Net Worth Card */}
          <div style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.03))", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "18px 20px", borderRadius: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Current Net Worth</span>
              <TrendingUp size={18} color="var(--green)" />
            </div>
            <strong style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--ink)" }}>{formatAmount(netWorth)}</strong>
            <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>Assets minus total debt liabilities</small>
          </div>

          {/* Liquid Cash & FDs */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "18px 20px", borderRadius: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.5px" }}>Liquid Cash & FDs</span>
              <Wallet size={18} color="#3b82f6" />
            </div>
            <strong style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>{formatAmount(liquidCashTotal)}</strong>
            <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>{allocation.liquidCash.percentage}% of total assets</small>
          </div>

          {/* Stocks & Mutual Funds */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "18px 20px", borderRadius: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.5px" }}>Equities & Investments</span>
              <PieChart size={18} color="#8b5cf6" />
            </div>
            <strong style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>{formatAmount(equitiesTotal)}</strong>
            <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>{allocation.equities.percentage}% of total assets</small>
          </div>

          {/* EPFO Retirement */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "18px 20px", borderRadius: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#eab308", textTransform: "uppercase", letterSpacing: "0.5px" }}>EPFO Provident Fund</span>
              <Building2 size={18} color="#eab308" />
            </div>
            <strong style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>{formatAmount(epfoTotal)}</strong>
            <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>{allocation.epfo.percentage}% of total assets</small>
          </div>

          {/* Liabilities & Debt */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "18px 20px", borderRadius: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.5px" }}>Loans & Credit Debt</span>
              <ShieldAlert size={18} color="#ef4444" />
            </div>
            <strong style={{ fontSize: "1.4rem", fontWeight: 700, color: "#ef4444" }}>{formatAmount(debtTotal)}</strong>
            <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>Outstanding principal & balances</small>
          </div>
        </div>

        {/* 3. Monthly Historical Net Worth Trend Chart */}
        <section className="panel" style={{ padding: "20px" }}>
          <div className="panel-title" style={{ marginBottom: "16px" }}>
            <div>
              <span className="eyebrow" style={{ color: "var(--green)" }}>12-Month Progression</span>
              <h2>Historical Net Worth & Asset Growth Trend</h2>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Visual Bar Chart */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "180px", paddingTop: "20px", paddingBottom: "10px", borderBottom: "1px solid var(--line)" }}>
              {history.map((h, idx) => {
                const heightPct = Math.max(15, Math.min(100, Math.round(((h.netWorth - minWorth) / worthDiff) * 100)));
                const isLatest = idx === history.length - 1;
                return (
                  <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "10px", color: isLatest ? "var(--green)" : "var(--muted)", fontWeight: isLatest ? 700 : 500 }}>
                      {hidePrivacy ? "•••" : `₹${(h.netWorth / 100000).toFixed(1)}L`}
                    </span>
                    <div
                      title={`${h.month}: ${money(h.netWorth)}`}
                      style={{
                        width: "100%",
                        maxWidth: "28px",
                        height: `${heightPct}%`,
                        background: isLatest ? "linear-gradient(180deg, #10b981, rgba(16, 185, 129, 0.4))" : "linear-gradient(180deg, #3b82f6, rgba(59, 130, 246, 0.3))",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s ease",
                      }}
                    />
                    <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: isLatest ? 700 : 400 }}>{h.month.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>

            {/* Asset Allocation Breakdown Distribution Bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginBottom: "8px" }}>
                <span>Asset Class Allocation Ratio</span>
                <span>Total Assets: <strong>{formatAmount(totalAssets)}</strong></span>
              </div>
              <div style={{ height: "12px", width: "100%", borderRadius: "6px", overflow: "hidden", display: "flex", background: "var(--background-alt)" }}>
                <div style={{ width: `${allocation.liquidCash.percentage}%`, background: "#3b82f6" }} title={`Liquid Cash: ${allocation.liquidCash.percentage}%`} />
                <div style={{ width: `${allocation.equities.percentage}%`, background: "#8b5cf6" }} title={`Equities: ${allocation.equities.percentage}%`} />
                <div style={{ width: `${allocation.epfo.percentage}%`, background: "#eab308" }} title={`EPFO: ${allocation.epfo.percentage}%`} />
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "10px", flexWrap: "wrap", fontSize: "12px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6" }} />
                  Liquid Cash ({allocation.liquidCash.percentage}%)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8b5cf6" }} />
                  Equities ({allocation.equities.percentage}%)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#eab308" }} />
                  EPFO ({allocation.epfo.percentage}%)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
                  Debits & Loans ({formatAmount(debtTotal)})
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Detailed Account Asset Ratios & Holdings Breakdown */}
        <section className="panel" style={{ padding: "20px" }}>
          <div className="panel-title" style={{ flexWrap: "wrap", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <span className="eyebrow" style={{ color: "var(--green)" }}>Account Portfolio</span>
              <h2>Asset Holdings & Valuation Breakdown</h2>
            </div>
            <div style={{ display: "flex", gap: "6px", background: "var(--background-alt)", padding: "3px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <button
                type="button"
                className={`secondary compact ${selectedAssetCategory === "ALL" ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory("ALL")}
                style={{ height: "30px", fontSize: "12px", fontWeight: 600, border: "none", borderRadius: "6px" }}
              >
                All ({accounts.length})
              </button>
              <button
                type="button"
                className={`secondary compact ${selectedAssetCategory === "CASH" ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory("CASH")}
                style={{ height: "30px", fontSize: "12px", fontWeight: 600, border: "none", borderRadius: "6px", color: "#3b82f6" }}
              >
                Cash & FDs
              </button>
              <button
                type="button"
                className={`secondary compact ${selectedAssetCategory === "EQUITIES" ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory("EQUITIES")}
                style={{ height: "30px", fontSize: "12px", fontWeight: 600, border: "none", borderRadius: "6px", color: "#8b5cf6" }}
              >
                Equities
              </button>
              <button
                type="button"
                className={`secondary compact ${selectedAssetCategory === "EPFO" ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory("EPFO")}
                style={{ height: "30px", fontSize: "12px", fontWeight: 600, border: "none", borderRadius: "6px", color: "#eab308" }}
              >
                EPFO
              </button>
              <button
                type="button"
                className={`secondary compact ${selectedAssetCategory === "DEBT" ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory("DEBT")}
                style={{ height: "30px", fontSize: "12px", fontWeight: 600, border: "none", borderRadius: "6px", color: "#ef4444" }}
              >
                Loans & Debt
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {filteredAccounts.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                No accounts found under this asset category.
              </div>
            ) : (
              filteredAccounts.map((acc) => {
                const isNegative = acc.balance < 0;
                const pctOfAssets = totalAssets > 0 && !isNegative ? Math.round((acc.balance / totalAssets) * 1000) / 10 : 0;
                return (
                  <div
                    key={acc.id}
                    style={{
                      background: "var(--background-alt)",
                      border: "1px solid var(--line)",
                      borderRadius: "12px",
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                          {acc.institution} • {acc.type}
                        </span>
                        <h3 style={{ margin: "2px 0 0 0", fontSize: "1.05rem", fontWeight: 700 }}>{acc.name}</h3>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ fontSize: "1.2rem", fontWeight: 700, color: isNegative ? "#ef4444" : "var(--ink)" }}>
                          {formatAmount(acc.balance)}
                        </strong>
                        {!isNegative && totalAssets > 0 && (
                          <small style={{ display: "block", color: "var(--muted)", fontSize: "11px" }}>
                            {pctOfAssets}% of total assets
                          </small>
                        )}
                      </div>
                    </div>

                    {/* Portfolio Holdings Breakdown if present */}
                    {acc.holdings.length > 0 && (
                      <div style={{ background: "var(--background)", borderRadius: "8px", padding: "10px 14px", border: "1px solid var(--line)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                          Holdings Breakdown ({acc.holdingCount} positions)
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {acc.holdings.slice(0, 6).map((h, hIdx) => (
                            <span
                              key={hIdx}
                              style={{
                                fontSize: "11px",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "var(--background-alt)",
                                border: "1px solid var(--line)",
                                display: "inline-flex",
                                gap: "6px",
                              }}
                            >
                              <strong>{h.symbol}</strong>
                              <span style={{ color: "var(--muted)" }}>{h.currentValue !== null ? money(h.currentValue) : `${h.quantity} units`}</span>
                            </span>
                          ))}
                          {acc.holdings.length > 6 && (
                            <span style={{ fontSize: "11px", color: "var(--muted)", alignSelf: "center" }}>
                              +{acc.holdings.length - 6} more positions
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
