"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Plus,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
} from "lucide-react";
import {
  Account,
  PortfolioAccount,
  AccountAmount,
  AccountCard,
  accountSections,
} from "./account-card";

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
  accounts: any[];
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

export type CategoryFilterType =
  | "ALL"
  | "SAVINGS"
  | "DEPOSITS"
  | "STOCKS"
  | "MUTUAL_FUNDS"
  | "EPFO"
  | "CREDIT_CARD"
  | "DEBT";

interface AccountsPortfolioTabProps {
  accounts: Account[];
  portfolio: PortfolioAccount[];
  assetsHistory?: AssetsHistoryData | null;
  amountsVisible: boolean;
  setAmountsVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  collapsedSections: Record<string, boolean>;
  toggleSection: (label: string) => void;
  setAddingAccount: (adding: boolean) => void;
  onRefresh?: () => void;
  error?: string;
}

export function AccountsPortfolioTab({
  accounts,
  portfolio,
  assetsHistory,
  amountsVisible,
  setAmountsVisible,
  collapsedSections,
  toggleSection,
  setAddingAccount,
  error,
}: AccountsPortfolioTabProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterType>("ALL");

  // Calculate or fallback net worth and asset breakdown
  const savingsAccounts = accounts.filter((a) =>
    ["SAVINGS", "BANK", "WALLET", "CASH"].includes(a.type)
  );
  const depositAccounts = accounts.filter((a) =>
    ["FIXED_DEPOSIT", "RECURRING_DEPOSIT"].includes(a.type)
  );
  const stockAccounts = accounts.filter((a) =>
    ["STOCKS", "DEMAT"].includes(a.type)
  );
  const mutualFundAccounts = accounts.filter((a) =>
    ["INVESTMENT", "MUTUAL_FUNDS"].includes(a.type)
  );
  const epfoAccounts = accounts.filter((a) => a.type === "EPFO");
  const creditCardAccounts = accounts.filter((a) => a.type === "CREDIT_CARD");
  const loanAccounts = accounts.filter((a) => a.type === "LOAN");

  const calcSavingsTotal =
    assetsHistory?.savingsTotal ??
    savingsAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const calcDepositsTotal =
    assetsHistory?.depositsTotal ??
    depositAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const calcStocksTotal =
    assetsHistory?.stocksTotal ??
    stockAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const calcMutualFundsTotal =
    assetsHistory?.mutualFundsTotal ??
    mutualFundAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const calcEpfoTotal =
    assetsHistory?.epfoTotal ??
    epfoAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);

  const calcDebtTotal =
    assetsHistory?.debtTotal ??
    (loanAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0) +
      creditCardAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0));

  const calcTotalAssets =
    assetsHistory?.totalAssets ??
    (calcSavingsTotal +
      calcDepositsTotal +
      calcStocksTotal +
      calcMutualFundsTotal +
      calcEpfoTotal);

  const calcNetWorth =
    assetsHistory?.netWorth ?? (calcTotalAssets - calcDebtTotal);

  // Growth calculation from history
  const history = assetsHistory?.history || [];
  const firstWorth = history.length > 0 ? history[0].netWorth : calcNetWorth;
  const lastWorth =
    history.length > 0 ? history[history.length - 1].netWorth : calcNetWorth;
  const netWorthDelta = lastWorth - firstWorth;
  const growthPct =
    firstWorth !== 0
      ? Math.round(((lastWorth - firstWorth) / Math.abs(firstWorth)) * 1000) /
        10
      : 0;
  const isPositiveGrowth = netWorthDelta >= 0;

  // Percentage calculations
  const totalPositiveAssets = Math.max(1, calcTotalAssets);
  const savingsPct =
    assetsHistory?.allocation?.savings?.percentage ??
    Math.round((calcSavingsTotal / totalPositiveAssets) * 100);
  const depositsPct =
    assetsHistory?.allocation?.deposits?.percentage ??
    Math.round((calcDepositsTotal / totalPositiveAssets) * 100);
  const stocksPct =
    assetsHistory?.allocation?.stocks?.percentage ??
    Math.round((calcStocksTotal / totalPositiveAssets) * 100);
  const mutualFundsPct =
    assetsHistory?.allocation?.mutualFunds?.percentage ??
    Math.round((calcMutualFundsTotal / totalPositiveAssets) * 100);
  const epfoPct =
    assetsHistory?.allocation?.epfo?.percentage ??
    Math.round((calcEpfoTotal / totalPositiveAssets) * 100);

  // Filter accounts based on category filter chip
  const isAccountMatch = (account: Account) => {
    if (selectedCategory === "ALL") return true;
    if (
      selectedCategory === "SAVINGS" &&
      ["SAVINGS", "BANK", "WALLET", "CASH"].includes(account.type)
    )
      return true;
    if (
      selectedCategory === "DEPOSITS" &&
      ["FIXED_DEPOSIT", "RECURRING_DEPOSIT"].includes(account.type)
    )
      return true;
    if (
      selectedCategory === "STOCKS" &&
      ["STOCKS", "DEMAT"].includes(account.type)
    )
      return true;
    if (
      selectedCategory === "MUTUAL_FUNDS" &&
      ["INVESTMENT", "MUTUAL_FUNDS"].includes(account.type)
    )
      return true;
    if (selectedCategory === "EPFO" && account.type === "EPFO") return true;
    if (
      selectedCategory === "CREDIT_CARD" &&
      account.type === "CREDIT_CARD"
    )
      return true;
    if (selectedCategory === "DEBT" && account.type === "LOAN") return true;
    return false;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* ── Net Worth & Wealth Hero Card ──────────────────────── */}
      <div
        className="hero-card assets-hero"
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          padding: "24px 28px",
          borderRadius: "18px",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "4px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                opacity: 0.85,
                fontWeight: 700,
              }}
            >
              Total Net Worth
            </span>
            {history.length > 0 && (
              <span
                style={{
                  background: isPositiveGrowth
                    ? "rgba(255, 255, 255, 0.18)"
                    : "rgba(239, 68, 68, 0.25)",
                  padding: "3px 8px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {isPositiveGrowth ? (
                  <ArrowUpRight size={13} />
                ) : (
                  <ArrowDownRight size={13} />
                )}
                {growthPct > 0 ? `+${growthPct}%` : `${growthPct}%`} (12M)
              </span>
            )}
            <span
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                padding: "3px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {accounts.length} Accounts
            </span>
          </div>

          <strong
            style={{
              margin: "4px 0",
              display: "block",
              fontSize: "2.4rem",
              fontWeight: 800,
              letterSpacing: "-0.5px",
            }}
          >
            <AccountAmount value={calcNetWorth} visible={amountsVisible} />
          </strong>

          <div
            style={{
              fontSize: "12px",
              opacity: 0.9,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span>
              Total Assets:{" "}
              <strong>
                <AccountAmount
                  value={calcTotalAssets}
                  visible={amountsVisible}
                />
              </strong>
            </span>
            <span>•</span>
            <span>
              Total Liabilities:{" "}
              <strong>
                <AccountAmount value={calcDebtTotal} visible={amountsVisible} />
              </strong>
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="secondary compact"
            role="switch"
            aria-checked={amountsVisible}
            onClick={() => setAmountsVisible((visible) => !visible)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            {amountsVisible ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{amountsVisible ? "Hide amounts" : "Show amounts"}</span>
          </button>

          <button
            type="button"
            className="primary compact"
            onClick={() => setAddingAccount(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "10px",
              background: "var(--green)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "12px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            <Plus size={16} />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* ── Asset Allocation Breakdown & Filter Bar ──────────── */}
      <section
        className="panel"
        style={{
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <span
              className="eyebrow"
              style={{ color: "var(--green)", fontSize: "11px", fontWeight: 700 }}
            >
              Portfolio Diversification
            </span>
            <h2 style={{ fontSize: "1.1rem", margin: 0, fontWeight: 700 }}>
              Asset Allocation Breakdown
            </h2>
          </div>

          {selectedCategory !== "ALL" && (
            <button
              type="button"
              className="secondary compact"
              onClick={() => setSelectedCategory("ALL")}
              style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px" }}
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Multi-color allocation progress bar */}
        <div
          style={{
            height: "12px",
            width: "100%",
            background: "var(--line)",
            borderRadius: "6px",
            overflow: "hidden",
            display: "flex",
          }}
        >
          {savingsPct > 0 && (
            <div
              style={{ width: `${savingsPct}%`, background: "#0ea5e9" }}
              title={`Savings & Cash: ${savingsPct}%`}
            />
          )}
          {depositsPct > 0 && (
            <div
              style={{ width: `${depositsPct}%`, background: "#f59e0b" }}
              title={`Fixed Deposits: ${depositsPct}%`}
            />
          )}
          {stocksPct > 0 && (
            <div
              style={{ width: `${stocksPct}%`, background: "#10b981" }}
              title={`Stocks: ${stocksPct}%`}
            />
          )}
          {mutualFundsPct > 0 && (
            <div
              style={{ width: `${mutualFundsPct}%`, background: "#8b5cf6" }}
              title={`Mutual Funds: ${mutualFundsPct}%`}
            />
          )}
          {epfoPct > 0 && (
            <div
              style={{ width: `${epfoPct}%`, background: "#f97316" }}
              title={`EPFO: ${epfoPct}%`}
            />
          )}
        </div>

        {/* Interactive Category Filter Chips */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "10px",
          }}
        >
          {/* Savings */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "SAVINGS" ? "ALL" : "SAVINGS"
              )
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background:
                selectedCategory === "SAVINGS"
                  ? "rgba(14, 165, 233, 0.15)"
                  : "var(--card)",
              border: `1px solid ${
                selectedCategory === "SAVINGS" ? "#0ea5e9" : "var(--line)"
              }`,
              borderRadius: "10px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: "#0ea5e9",
                  flexShrink: 0,
                }}
              />
              <div>
                <small
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  Savings &amp; Cash ({savingsAccounts.length})
                </small>
                <strong style={{ fontSize: "12px", color: "var(--ink)" }}>
                  <AccountAmount
                    value={calcSavingsTotal}
                    visible={amountsVisible}
                  />
                </strong>
              </div>
            </div>
            <span
              style={{ fontSize: "11px", fontWeight: 700, color: "#0ea5e9" }}
            >
              {savingsPct}%
            </span>
          </button>

          {/* Deposits */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "DEPOSITS" ? "ALL" : "DEPOSITS"
              )
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background:
                selectedCategory === "DEPOSITS"
                  ? "rgba(245, 158, 11, 0.15)"
                  : "var(--card)",
              border: `1px solid ${
                selectedCategory === "DEPOSITS" ? "#f59e0b" : "var(--line)"
              }`,
              borderRadius: "10px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: "#f59e0b",
                  flexShrink: 0,
                }}
              />
              <div>
                <small
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  Fixed Deposits ({depositAccounts.length})
                </small>
                <strong style={{ fontSize: "12px", color: "var(--ink)" }}>
                  <AccountAmount
                    value={calcDepositsTotal}
                    visible={amountsVisible}
                  />
                </strong>
              </div>
            </div>
            <span
              style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b" }}
            >
              {depositsPct}%
            </span>
          </button>

          {/* Stocks */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "STOCKS" ? "ALL" : "STOCKS"
              )
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background:
                selectedCategory === "STOCKS"
                  ? "rgba(16, 185, 129, 0.15)"
                  : "var(--card)",
              border: `1px solid ${
                selectedCategory === "STOCKS" ? "#10b981" : "var(--line)"
              }`,
              borderRadius: "10px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: "#10b981",
                  flexShrink: 0,
                }}
              />
              <div>
                <small
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  Stocks &amp; Demat ({stockAccounts.length})
                </small>
                <strong style={{ fontSize: "12px", color: "var(--ink)" }}>
                  <AccountAmount
                    value={calcStocksTotal}
                    visible={amountsVisible}
                  />
                </strong>
              </div>
            </div>
            <span
              style={{ fontSize: "11px", fontWeight: 700, color: "#10b981" }}
            >
              {stocksPct}%
            </span>
          </button>

          {/* Mutual Funds */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "MUTUAL_FUNDS" ? "ALL" : "MUTUAL_FUNDS"
              )
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background:
                selectedCategory === "MUTUAL_FUNDS"
                  ? "rgba(139, 92, 246, 0.15)"
                  : "var(--card)",
              border: `1px solid ${
                selectedCategory === "MUTUAL_FUNDS" ? "#8b5cf6" : "var(--line)"
              }`,
              borderRadius: "10px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: "#8b5cf6",
                  flexShrink: 0,
                }}
              />
              <div>
                <small
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  Mutual Funds ({mutualFundAccounts.length})
                </small>
                <strong style={{ fontSize: "12px", color: "var(--ink)" }}>
                  <AccountAmount
                    value={calcMutualFundsTotal}
                    visible={amountsVisible}
                  />
                </strong>
              </div>
            </div>
            <span
              style={{ fontSize: "11px", fontWeight: 700, color: "#8b5cf6" }}
            >
              {mutualFundsPct}%
            </span>
          </button>

          {/* EPFO */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "EPFO" ? "ALL" : "EPFO"
              )
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background:
                selectedCategory === "EPFO"
                  ? "rgba(249, 115, 22, 0.15)"
                  : "var(--card)",
              border: `1px solid ${
                selectedCategory === "EPFO" ? "#f97316" : "var(--line)"
              }`,
              borderRadius: "10px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: "#f97316",
                  flexShrink: 0,
                }}
              />
              <div>
                <small
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  EPFO Retirement ({epfoAccounts.length})
                </small>
                <strong style={{ fontSize: "12px", color: "var(--ink)" }}>
                  <AccountAmount
                    value={calcEpfoTotal}
                    visible={amountsVisible}
                  />
                </strong>
              </div>
            </div>
            <span
              style={{ fontSize: "11px", fontWeight: 700, color: "#f97316" }}
            >
              {epfoPct}%
            </span>
          </button>

          {/* Credit Cards & Liabilities */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "CREDIT_CARD" ? "ALL" : "CREDIT_CARD"
              )
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background:
                selectedCategory === "CREDIT_CARD"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "var(--card)",
              border: `1px solid ${
                selectedCategory === "CREDIT_CARD" ? "#ef4444" : "var(--line)"
              }`,
              borderRadius: "10px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: "#ef4444",
                  flexShrink: 0,
                }}
              />
              <div>
                <small
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  Cards &amp; Loans ({creditCardAccounts.length + loanAccounts.length})
                </small>
                <strong style={{ fontSize: "12px", color: "var(--ink)" }}>
                  <AccountAmount
                    value={calcDebtTotal}
                    visible={amountsVisible}
                  />
                </strong>
              </div>
            </div>
            <span
              style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444" }}
            >
              Due
            </span>
          </button>
        </div>
      </section>

      {/* ── Categorized Accounts Overview ────────────────────── */}
      <div className="accounts-overview">
        {accountSections.map((section) => {
          if ("subsections" in section) {
            const allTypes = section.subsections.flatMap((sub) => sub.types);
            const sectionAccounts = accounts.filter(
              (account) =>
                allTypes.includes(account.type) && isAccountMatch(account)
            );
            if (!sectionAccounts.length) return null;
            const isCollapsed = Boolean(collapsedSections[section.label]);
            return (
              <div className="accounts-section" key={section.label}>
                <header
                  className="accounts-section-header"
                  onClick={() => toggleSection(section.label)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: isCollapsed ? "8px" : "20px",
                    borderBottom: "1px solid var(--line)",
                    paddingBottom: "8px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        color: "var(--muted)",
                        transition: "transform 0.2s ease",
                      }}
                    >
                      {isCollapsed ? (
                        <ChevronRight size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </span>
                    <h2 style={{ margin: 0 }}>{section.label}</h2>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--muted)",
                        background: "var(--card)",
                        border: "1px solid var(--line)",
                        padding: "2px 8px",
                        borderRadius: "12px",
                      }}
                    >
                      {sectionAccounts.length}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    <AccountAmount
                      value={sectionAccounts.reduce(
                        (sum, account) => sum + account.balance,
                        0
                      )}
                      visible={amountsVisible}
                    />
                  </span>
                </header>
                {!isCollapsed && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "32px",
                      paddingLeft: "8px",
                    }}
                  >
                    {section.subsections.map((sub) => {
                      const subAccounts = accounts.filter(
                        (account) =>
                          sub.types.includes(account.type) &&
                          isAccountMatch(account)
                      );
                      if (!subAccounts.length) return null;
                      return (
                        <div key={sub.label} className="accounts-subsection">
                          <header
                            className="accounts-subsection-header"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-end",
                              marginBottom: "12px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "var(--muted)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                }}
                              >
                                {sub.label}
                              </h3>
                              {sub.types.includes("CREDIT_CARD") && (
                                <Link
                                  href="/credit-cards"
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: "var(--accent)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    textTransform: "none",
                                    letterSpacing: "normal",
                                  }}
                                  title="View Credit Cards Analytics & Utilization Hub"
                                >
                                  <span>Analytics Hub</span>
                                  <ArrowUpRight size={12} />
                                </Link>
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 550,
                                color: "var(--muted)",
                              }}
                            >
                              <AccountAmount
                                value={subAccounts.reduce(
                                  (sum, account) => sum + account.balance,
                                  0
                                )}
                                visible={amountsVisible}
                              />
                            </span>
                          </header>
                          <div
                            className={`account-cards-grid ${
                              sub.types.includes("CREDIT_CARD")
                                ? "credit-cards-grid"
                                : ""
                            }`}
                          >
                            {subAccounts.map((account) => (
                              <AccountCard
                                key={account.id}
                                account={account}
                                amountsVisible={amountsVisible}
                                onClick={() =>
                                  router.push(`/accounts?account=${account.id}`)
                                }
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          } else {
            const sectionAccounts = accounts.filter(
              (account) =>
                section.types.includes(account.type) && isAccountMatch(account)
            );
            if (!sectionAccounts.length) return null;
            const isCollapsed = Boolean(collapsedSections[section.label]);
            return (
              <div className="accounts-section" key={section.label}>
                <header
                  className="accounts-section-header"
                  onClick={() => toggleSection(section.label)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: isCollapsed ? "8px" : "16px",
                    borderBottom: "1px solid var(--line)",
                    paddingBottom: "8px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        color: "var(--muted)",
                        transition: "transform 0.2s ease",
                      }}
                    >
                      {isCollapsed ? (
                        <ChevronRight size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </span>
                    <h2 style={{ margin: 0 }}>{section.label}</h2>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--muted)",
                        background: "var(--card)",
                        border: "1px solid var(--line)",
                        padding: "2px 8px",
                        borderRadius: "12px",
                      }}
                    >
                      {sectionAccounts.length}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    <AccountAmount
                      value={sectionAccounts.reduce(
                        (sum, account) => sum + account.balance,
                        0
                      )}
                      visible={amountsVisible}
                    />
                  </span>
                </header>
                {!isCollapsed && (
                  <div
                    className={`account-cards-grid ${
                      section.types.includes("CREDIT_CARD")
                        ? "credit-cards-grid"
                        : ""
                    }`}
                  >
                    {sectionAccounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        amountsVisible={amountsVisible}
                        onClick={() =>
                          router.push(`/accounts?account=${account.id}`)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }
        })}
        {accounts.filter(isAccountMatch).length === 0 && (
          <div className="portfolio-empty">
            <Landmark size={48} strokeWidth={1} />
            <strong>No accounts found</strong>
            <p>
              {selectedCategory !== "ALL"
                ? "No accounts match this category filter."
                : "Add an account to get started."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
