"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Lock, Calendar, AlertCircle } from "lucide-react";
import { api, errorMessage, isUnauthorized, money } from "@/lib/api";
import { VaultModal } from "@/components/vault-modal";
import { getDomainForInstitution, getLocalLogo, cardNetworkClass } from "./account-card";

export type CardCategoryItem = {
  name: string;
  color: string;
  amount: number;
  percentage: number;
};

export type CardRecipientItem = {
  name: string;
  amount: number;
  count: number;
};

export type CardSummary = {
  id: string;
  name: string;
  institution: string | null;
  cardLast4: string | null;
  cardNetwork: string | null;
  creditLimit: number;
  currentBalance: number;
  outstanding: number;
  availableCredit: number;
  utilizationPercent: number;
  statementDate: number | null;
  dueDate: number | null;
  isShared?: boolean;
  isParent?: boolean;
  isChild?: boolean;
  parentAccountId?: string | null;
  parentAccountName?: string | null;
  linkedCardNames?: string[];
  poolCreditLimit?: number;
  poolOutstanding?: number;
  poolAvailableCredit?: number;
  poolUtilization?: number;
  totalInbound: number;
  totalOutbound: number;
  categories: CardCategoryItem[];
  topRecipients: CardRecipientItem[];
  otherOutbound: { amount: number; count: number };
};

export type MonthlyFlow = {
  month: string;
  spends: number;
  payments: number;
};

export type RecentTx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  categoryColor: string;
  accountName: string;
};

export type CreditCardsApiResponse = {
  summary: {
    totalLimit: number;
    totalOutstanding: number;
    totalAvailable: number;
    utilizationRate: number;
    activeCardCount: number;
    totalInbound: number;
    totalOutbound: number;
  };
  overallFlow: {
    categories: CardCategoryItem[];
    topRecipients: CardRecipientItem[];
    otherOutbound: { amount: number; count: number };
  };
  cards: CardSummary[];
  monthlySpendsAndPayments: MonthlyFlow[];
  recentTransactions: RecentTx[];
};

export function CreditCardDoughnutChart({
  categories,
  total,
}: {
  categories: CardCategoryItem[];
  total: number;
}) {
  const r = 38;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;

  let currentOffset = 0;
  const filtered = categories.filter((c) => c.amount > 0);

  if (total <= 0 || filtered.length === 0) {
    return (
      <div style={{ position: "relative", width: "130px", height: "130px", flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" width="130" height="130">
          <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="var(--line)" strokeWidth="12" />
        </svg>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}>
          <strong style={{ fontSize: "14px", color: "var(--muted)" }}>₹0</strong>
          <span style={{ fontSize: "9px", color: "var(--muted)", fontWeight: 600 }}>total spend</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "130px", height: "130px", flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
        {filtered.map((cat, idx) => {
          const sliceLength = (cat.amount / total) * circumference;
          const strokeDasharray = `${sliceLength} ${circumference - sliceLength}`;
          const strokeDashoffset = -currentOffset;
          currentOffset += sliceLength;

          return (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r={r}
              fill="transparent"
              stroke={cat.color || "#3b82f6"}
              strokeWidth="12"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <strong style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 800 }}>
          {money(total)}
        </strong>
        <span style={{ fontSize: "9px", color: "var(--muted)", fontWeight: 600 }}>
          total spend
        </span>
      </div>
    </div>
  );
}

import { FINANCIAL_CONSTANTS } from "@/lib/constants";

export function BeautifulCreditCardTile({
  card,
  onVaultClick,
}: {
  card: CardSummary;
  onVaultClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const localLogo = getLocalLogo(card.institution, card.name);
  const domain = getDomainForInstitution(card.institution || card.name);
  const logoUrl = localLogo || `https://logo.clearbit.com/${domain}?size=128`;
  const isOverLimit = card.utilizationPercent >= 100;
  const isHighRisk = card.utilizationPercent > FINANCIAL_CONSTANTS.CREDIT_UTILIZATION_WARNING_THRESHOLD;
  const networkClass = cardNetworkClass(card.cardNetwork);
  const maskedNumber = card.cardLast4
    ? `••••  ••••  ••••  ${card.cardLast4}`
    : "••••  ••••  ••••  ••••";

  return (
    <div
      className={`account-card credit-account-card credit-network-${networkClass}`}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        minHeight: "240px",
        padding: "20px",
        borderRadius: "16px",
      }}>
      <div>
        <div className="credit-account-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="credit-account-card-logo" style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.15)" }}>
            {!imgError ? (
              <img
                src={logoUrl}
                alt={card.institution || card.name}
                onError={() => setImgError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <CreditCard size={20} color="#ffffff" />
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.9)" }}>
              {card.cardNetwork || "CARD"}
            </span>
            <button
              type="button"
              onClick={onVaultClick}
              title="View PDF password in Vault"
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "4px 8px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontWeight: 600,
                backdropFilter: "blur(4px)",
              }}>
              <Lock size={12} /> Password
            </button>
          </div>
        </div>

        {card.isShared && (
          <div style={{ marginTop: "8px", marginBottom: "4px" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "rgba(255, 255, 255, 0.95)",
                background: "rgba(0, 0, 0, 0.4)",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                backdropFilter: "blur(6px)",
              }}>
              {card.isChild ? `🔗 Shared Limit with ${card.parentAccountName || "Primary Card"}` : `🔗 Shared Pool (${(card.linkedCardNames?.length || 1) + 1} Cards)`}
            </span>
          </div>
        )}

        <strong
          className="credit-account-card-number"
          style={{
            display: "block",
            margin: "8px 0 10px 0",
            fontSize: "1.25rem",
            letterSpacing: "2px",
            fontFamily: "monospace",
            color: "#ffffff",
            textShadow: "0 2px 4px rgba(0,0,0,0.35)",
          }}>
          {maskedNumber}
        </strong>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 14px 0" }}>
          <div
            style={{
              width: "34px",
              height: "25px",
              borderRadius: "5px",
              background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #d97706 100%)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow: "inset 0 1px 2px rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.3)",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
            <div style={{ width: "70%", height: "1px", background: "rgba(0,0,0,0.3)" }} />
            <div style={{ height: "70%", width: "1px", background: "rgba(0,0,0,0.3)", position: "absolute" }} />
          </div>

          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" strokeLinecap="round" style={{ transform: "rotate(90deg)" }}>
            <path d="M12 2a10 10 0 0 1 10 10" />
            <path d="M12 6a6 6 0 0 1 6 6" />
            <path d="M12 10a2 2 0 0 1 2 2" />
          </svg>
        </div>

        <div className="credit-account-card-identity" style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
          <div>
            <small style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.7)", display: "block", fontWeight: 700 }}>Card Name</small>
            <strong style={{ fontSize: "13px", color: "#ffffff", fontWeight: 700 }}>{card.name}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <small style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.7)", display: "block", fontWeight: 700 }}>Bank</small>
            <strong style={{ fontSize: "13px", color: "#ffffff", fontWeight: 700 }}>{card.institution || "Bank"}</strong>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "rgba(0, 0, 0, 0.35)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          padding: "12px 14px",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", marginBottom: "6px" }}>
          <span style={{ color: "rgba(255,255,255,0.9)" }}>Due: <strong style={{ color: card.outstanding > 0 ? "#f87171" : "#ffffff" }}>{money(card.outstanding)}</strong></span>
          <span style={{ color: "rgba(255,255,255,0.9)" }}>{card.isShared ? "Pool Avail:" : "Avail:"} <strong style={{ color: "#4ade80" }}>{money(card.availableCredit)}</strong></span>
          <span style={{ fontWeight: 800, color: isHighRisk ? "#f87171" : "#4ade80" }}>{card.utilizationPercent}% Used</span>
        </div>

        <div style={{ height: "5px", width: "100%", background: "rgba(255,255,255,0.2)", borderRadius: "3px", overflow: "hidden", marginBottom: "10px" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, card.utilizationPercent)}%`,
              background: isOverLimit ? "#ef4444" : isHighRisk ? "#f59e0b" : "#10b981",
              borderRadius: "3px",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {(card.statementDate || card.dueDate) ? (
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>
              {card.statementDate && `Stmt: ${card.statementDate}th`} {card.dueDate && `• Due: ${card.dueDate}th`}
            </span>
          ) : (
            <span />
          )}

          <Link
            href={`/accounts?account=${card.id}`}
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#ffffff",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "rgba(255,255,255,0.2)",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.25)",
            }}>
            View Ledger →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CreditCardsTab() {
  const router = useRouter();
  const [data, setData] = useState<CreditCardsApiResponse & { summary: { timeRange?: string; timeRangeLabel?: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vaultAccount, setVaultAccount] = useState<CardSummary | null>(null);
  const [cardFilter, setCardFilter] = useState<string>("ALL");
  const [timeRange, setTimeRange] = useState<string>("THIS_MONTH");
  const [selectedCardId, setSelectedCardId] = useState<string>("ALL");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (timeRange) params.set("timeRange", timeRange);
      if (selectedCardId && selectedCardId !== "ALL") params.set("accountId", selectedCardId);

      const url = `/accounts/credit-cards/summary${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await api<any>(url);
      setData(res);
    } catch (err: any) {
      if (isUnauthorized(err)) {
        router.replace("/login");
      } else {
        setError(errorMessage(err, "Failed to load credit card data."));
      }
    } finally {
      setLoading(false);
    }
  }, [router, timeRange, selectedCardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !data) {
    return (
      <div className="loading" style={{ height: "40vh" }}>
        <span />
        <p>Loading Credit Cards Analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="panel" style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>
        <AlertCircle size={28} style={{ margin: "0 auto 12px auto", display: "block" }} />
        <span>{error || "Could not load credit cards data"}</span>
      </div>
    );
  }

  const { summary, overallFlow, cards } = data;

  const filteredCards = cards.filter((c) => {
    if (cardFilter === "HIGH_UTIL") return c.utilizationPercent > 30;
    if (cardFilter === "DUES_PENDING") return c.outstanding > 0;
    if (cardFilter !== "ALL") {
      const inst = (c.institution || c.name).toLowerCase();
      return inst.includes(cardFilter.toLowerCase());
    }
    return true;
  });

  const cardsWithDues = cards.filter((c) => c.outstanding > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header className="page-header" style={{ marginBottom: "0px" }}>
        <div>
          <span className="eyebrow" style={{ color: "#ef4444" }}>Credit Cards Analytics Hub</span>
          <h1>Credit Cards &amp; Spend Intelligence</h1>
          <p>Real-time credit limits, utilization risk, billing cycles, and merchant outflow.</p>
        </div>
      </header>

      {/* Credit Summary KPI Cards */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div className="kpi-card" style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "14px", border: "1px solid var(--line)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Total Credit Limit</span>
          <strong style={{ display: "block", fontSize: "1.4rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{money(summary.totalLimit)}</strong>
          <small style={{ color: "var(--muted)", fontSize: "11px" }}>Across {summary.activeCardCount} active cards</small>
        </div>

        <div className="kpi-card" style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "14px", border: "1px solid var(--line)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", textTransform: "uppercase" }}>Total Outstanding</span>
          <strong style={{ display: "block", fontSize: "1.4rem", fontWeight: 800, color: "#ef4444", marginTop: "4px" }}>{money(summary.totalOutstanding)}</strong>
          <small style={{ color: "var(--muted)", fontSize: "11px" }}>Current unpaid bill dues</small>
        </div>

        <div className="kpi-card" style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "14px", border: "1px solid var(--line)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--green)", textTransform: "uppercase" }}>Available Credit</span>
          <strong style={{ display: "block", fontSize: "1.4rem", fontWeight: 800, color: "var(--green)", marginTop: "4px" }}>{money(summary.totalAvailable)}</strong>
          <small style={{ color: "var(--muted)", fontSize: "11px" }}>Remaining spending power</small>
        </div>

        <div className="kpi-card" style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "14px", border: "1px solid var(--line)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: summary.utilizationRate > 30 ? "#ef4444" : "var(--muted)", textTransform: "uppercase" }}>Credit Utilization</span>
          <strong style={{ display: "block", fontSize: "1.4rem", fontWeight: 800, color: summary.utilizationRate > 30 ? "#ef4444" : "var(--ink)", marginTop: "4px" }}>{summary.utilizationRate}%</strong>
          <div style={{ height: "6px", width: "100%", background: "var(--background-alt)", borderRadius: "3px", overflow: "hidden", marginTop: "6px" }}>
            <div style={{ height: "100%", width: `${Math.min(100, summary.utilizationRate)}%`, background: summary.utilizationRate > 30 ? "#ef4444" : "var(--green)" }} />
          </div>
        </div>
      </div>

      {/* Spend Intelligence Section with Time Range & Card Selectors */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "var(--card)", padding: "12px 18px", borderRadius: "12px", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>Analytics Period:</span>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {[
              { id: "THIS_MONTH", label: "This Month" },
              { id: "LAST_MONTH", label: "Last Month" },
              { id: "3M", label: "Past 3M" },
              { id: "6M", label: "Past 6M" },
              { id: "ALL_TIME", label: "All Time" },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`secondary compact ${timeRange === preset.id ? "active" : ""}`}
                onClick={() => setTimeRange(preset.id)}
                style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px" }}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>Card:</span>
          <select
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
            style={{
              padding: "4px 10px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              background: "var(--background-alt)",
              color: "var(--ink)",
              fontSize: "12px",
              fontWeight: 600,
            }}>
            <option value="ALL">All Credit Cards ({cards.length})</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.cardLast4 ? `(••${c.cardLast4})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: "16px" }}>
            <div>
              <span className="eyebrow">Distribution</span>
              <h2>Spends by Category</h2>
              <small style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                <Calendar size={12} color="var(--green)" /> {summary.timeRangeLabel || "All-Time Spends"}
              </small>
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
            <CreditCardDoughnutChart categories={overallFlow.categories} total={summary.totalOutbound} />
            <div style={{ flex: 1, minWidth: "160px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {overallFlow.categories.length === 0 ? (
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>No outbound category spends logged for this period.</span>
              ) : (
                overallFlow.categories.slice(0, 5).map((cat, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cat.color || "#3b82f6" }} />
                      {cat.name}
                    </span>
                    <strong style={{ color: "var(--ink)" }}>{money(cat.amount)} ({cat.percentage}%)</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title" style={{ marginBottom: "16px" }}>
            <div>
              <span className="eyebrow">Recipients</span>
              <h2>Top Merchant Outflows</h2>
              <small style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                <Calendar size={12} color="var(--green)" /> {summary.timeRangeLabel || "All-Time Top Outflows"}
              </small>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {overallFlow.topRecipients.length === 0 ? (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>No merchant spend data available for this period.</span>
            ) : (
              overallFlow.topRecipients.map((rec, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--background-alt)", borderRadius: "8px", fontSize: "12px" }}>
                  <div>
                    <strong style={{ display: "block", color: "var(--ink)" }}>{rec.name}</strong>
                    <span style={{ color: "var(--muted)", fontSize: "11px" }}>{rec.count} transactions</span>
                  </div>
                  <strong style={{ color: "#ef4444" }}>-{money(rec.amount)}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Active Credit Cards Grid */}
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <span className="eyebrow" style={{ color: "#ef4444" }}>Cards List</span>
            <h2>Active Credit Cards ({filteredCards.length})</h2>
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`secondary compact ${cardFilter === "ALL" ? "active" : ""}`}
              onClick={() => setCardFilter("ALL")}
              style={{ fontSize: "12px", padding: "4px 12px" }}>
              All ({cards.length})
            </button>
            <button
              type="button"
              className={`secondary compact ${cardFilter === "DUES_PENDING" ? "active" : ""}`}
              onClick={() => setCardFilter("DUES_PENDING")}
              style={{ fontSize: "12px", padding: "4px 12px" }}>
              Dues Pending ({cardsWithDues.length})
            </button>
            <button
              type="button"
              className={`secondary compact ${cardFilter === "HIGH_UTIL" ? "active" : ""}`}
              onClick={() => setCardFilter("HIGH_UTIL")}
              style={{ fontSize: "12px", padding: "4px 12px" }}>
              High Utilization (&gt;30%)
            </button>
          </div>
        </div>

        {filteredCards.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "13px", padding: "20px 0" }}>No credit card accounts match the selected filter.</p>
        ) : (
          <div className="credit-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {filteredCards.map((card) => (
              <BeautifulCreditCardTile
                key={card.id}
                card={card}
                onVaultClick={() => setVaultAccount(card)}
              />
            ))}
          </div>
        )}
      </div>



      {vaultAccount && (
        <VaultModal
          accountId={vaultAccount.id}
          onClose={() => {
            setVaultAccount(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
