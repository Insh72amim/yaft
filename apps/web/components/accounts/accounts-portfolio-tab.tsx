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
  PiggyBank,
  TrendingUp,
  ChartPie,
  Building2,
  BadgeIndianRupee,
  Layers,
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

  // Filter out credit cards completely from this view (Credit Cards are handled in the Credit Cards Analytics tab)
  const wealthAccounts = accounts.filter((a) => a.type !== "CREDIT_CARD");

  const savingsAccounts = wealthAccounts.filter((a) =>
    ["SAVINGS", "BANK", "WALLET", "CASH"].includes(a.type)
  );
  const depositAccounts = wealthAccounts.filter((a) =>
    ["FIXED_DEPOSIT", "RECURRING_DEPOSIT"].includes(a.type)
  );
  const stockAccounts = wealthAccounts.filter((a) =>
    ["STOCKS", "DEMAT"].includes(a.type)
  );
  const mutualFundAccounts = wealthAccounts.filter((a) =>
    ["INVESTMENT", "MUTUAL_FUNDS"].includes(a.type)
  );
  const epfoAccounts = wealthAccounts.filter((a) => a.type === "EPFO");
  const loanAccounts = wealthAccounts.filter((a) => a.type === "LOAN");

  const calcSavingsTotal = savingsAccounts.reduce(
    (sum, a) => sum + Math.max(0, a.balance),
    0
  );
  const calcDepositsTotal = depositAccounts.reduce(
    (sum, a) => sum + Math.max(0, a.balance),
    0
  );
  const calcStocksTotal = stockAccounts.reduce(
    (sum, a) => sum + Math.max(0, a.balance),
    0
  );
  const calcMutualFundsTotal = mutualFundAccounts.reduce(
    (sum, a) => sum + Math.max(0, a.balance),
    0
  );
  const calcEpfoTotal = epfoAccounts.reduce(
    (sum, a) => sum + Math.max(0, a.balance),
    0
  );
  const calcLoanTotal = loanAccounts.reduce(
    (sum, a) => sum + Math.abs(a.balance),
    0
  );

  const calcTotalAssets =
    calcSavingsTotal +
    calcDepositsTotal +
    calcStocksTotal +
    calcMutualFundsTotal +
    calcEpfoTotal;

  const calcNetWorth = calcTotalAssets - calcLoanTotal;

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

  // Percentage calculations across real assets
  const totalPositiveAssets = Math.max(1, calcTotalAssets);
  const savingsPct = Math.round((calcSavingsTotal / totalPositiveAssets) * 100);
  const depositsPct = Math.round((calcDepositsTotal / totalPositiveAssets) * 100);
  const stocksPct = Math.round((calcStocksTotal / totalPositiveAssets) * 100);
  const mutualFundsPct = Math.round(
    (calcMutualFundsTotal / totalPositiveAssets) * 100
  );
  const epfoPct = Math.round((calcEpfoTotal / totalPositiveAssets) * 100);

  // Filter accounts based on category filter chip
  const isAccountMatch = (account: Account) => {
    if (account.type === "CREDIT_CARD") return false;
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
    if (selectedCategory === "DEBT" && account.type === "LOAN") return true;
    return false;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ── Top Side-by-Side Wealth & Diversification Dashboard ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "16px",
          alignItems: "stretch",
        }}
      >
        {/* ── Card 1: Net Worth Overview ─────────────────────── */}
        <div
          className="panel"
          style={{
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "16px",
            background: "linear-gradient(135deg, var(--card), var(--background-alt))",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  className="eyebrow"
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    letterSpacing: "0.8px",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  Total Net Worth
                </span>
                {history.length > 0 && (
                  <span
                    style={{
                      background: isPositiveGrowth
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                      color: isPositiveGrowth ? "var(--green)" : "var(--red)",
                      padding: "2px 7px",
                      borderRadius: "10px",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    {isPositiveGrowth ? (
                      <ArrowUpRight size={12} />
                    ) : (
                      <ArrowDownRight size={12} />
                    )}
                    {growthPct > 0 ? `+${growthPct}%` : `${growthPct}%`} (12M)
                  </span>
                )}
              </div>

              <button
                type="button"
                className="secondary compact"
                onClick={() => setAmountsVisible((visible) => !visible)}
                style={{
                  height: "28px",
                  padding: "0 10px",
                  fontSize: "11px",
                  borderRadius: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  color: "var(--muted)",
                }}
                title={amountsVisible ? "Hide amounts" : "Show amounts"}
              >
                {amountsVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{amountsVisible ? "Hide" : "Show"}</span>
              </button>
            </div>

            <div
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                letterSpacing: "-0.5px",
                color: "var(--ink)",
                margin: "4px 0 10px",
              }}
            >
              <AccountAmount value={calcNetWorth} visible={amountsVisible} />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "12px",
                color: "var(--muted)",
                flexWrap: "wrap",
              }}
            >
              <div>
                <span>Total Assets: </span>
                <strong style={{ color: "var(--ink)" }}>
                  <AccountAmount
                    value={calcTotalAssets}
                    visible={amountsVisible}
                  />
                </strong>
              </div>
              {calcLoanTotal > 0 && (
                <>
                  <span>•</span>
                  <div>
                    <span>Liabilities: </span>
                    <strong style={{ color: "var(--red)" }}>
                      <AccountAmount
                        value={calcLoanTotal}
                        visible={amountsVisible}
                      />
                    </strong>
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "12px",
              borderTop: "1px solid var(--line)",
            }}
          >
            <span style={{ fontSize: "11.5px", color: "var(--muted)", fontWeight: 500 }}>
              {wealthAccounts.length} Active Accounts
            </span>

            <button
              type="button"
              className="primary compact"
              onClick={() => setAddingAccount(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Plus size={14} />
              <span>Add Account</span>
            </button>
          </div>
        </div>

        {/* ── Card 2: Portfolio Diversification & Allocation ─── */}
        <div
          className="panel"
          style={{
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "14px",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <span
                className="eyebrow"
                style={{
                  fontSize: "10.5px",
                  fontWeight: 700,
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  color: "var(--green)",
                }}
              >
                Portfolio Diversification
              </span>

              {selectedCategory !== "ALL" && (
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => setSelectedCategory("ALL")}
                  style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    height: "24px",
                  }}
                >
                  Show All
                </button>
              )}
            </div>

            {/* Distribution Progress Bar */}
            <div
              style={{
                height: "10px",
                width: "100%",
                background: "var(--line)",
                borderRadius: "5px",
                overflow: "hidden",
                display: "flex",
                marginBottom: "14px",
              }}
            >
              {savingsPct > 0 && (
                <div
                  style={{ width: `${savingsPct}%`, background: "#0ea5e9" }}
                  title={`Savings: ${savingsPct}%`}
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

            {/* Compact Asset Class Filter Chips */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "8px",
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
                  padding: "7px 10px",
                  background:
                    selectedCategory === "SAVINGS"
                      ? "rgba(14, 165, 233, 0.15)"
                      : "var(--background)",
                  border: `1px solid ${
                    selectedCategory === "SAVINGS" ? "#0ea5e9" : "var(--line)"
                  }`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#0ea5e9",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "10.5px",
                        color: "var(--muted)",
                        fontWeight: 600,
                      }}
                    >
                      Savings ({savingsAccounts.length})
                    </span>
                    <strong style={{ fontSize: "11.5px", color: "var(--ink)" }}>
                      <AccountAmount
                        value={calcSavingsTotal}
                        visible={amountsVisible}
                      />
                    </strong>
                  </div>
                </div>
                <span
                  style={{ fontSize: "10.5px", fontWeight: 700, color: "#0ea5e9" }}
                >
                  {savingsPct}%
                </span>
              </button>

              {/* Fixed Deposits */}
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
                  padding: "7px 10px",
                  background:
                    selectedCategory === "DEPOSITS"
                      ? "rgba(245, 158, 11, 0.15)"
                      : "var(--background)",
                  border: `1px solid ${
                    selectedCategory === "DEPOSITS" ? "#f59e0b" : "var(--line)"
                  }`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#f59e0b",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "10.5px",
                        color: "var(--muted)",
                        fontWeight: 600,
                      }}
                    >
                      FD / RD ({depositAccounts.length})
                    </span>
                    <strong style={{ fontSize: "11.5px", color: "var(--ink)" }}>
                      <AccountAmount
                        value={calcDepositsTotal}
                        visible={amountsVisible}
                      />
                    </strong>
                  </div>
                </div>
                <span
                  style={{ fontSize: "10.5px", fontWeight: 700, color: "#f59e0b" }}
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
                  padding: "7px 10px",
                  background:
                    selectedCategory === "STOCKS"
                      ? "rgba(16, 185, 129, 0.15)"
                      : "var(--background)",
                  border: `1px solid ${
                    selectedCategory === "STOCKS" ? "#10b981" : "var(--line)"
                  }`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#10b981",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "10.5px",
                        color: "var(--muted)",
                        fontWeight: 600,
                      }}
                    >
                      Stocks ({stockAccounts.length})
                    </span>
                    <strong style={{ fontSize: "11.5px", color: "var(--ink)" }}>
                      <AccountAmount
                        value={calcStocksTotal}
                        visible={amountsVisible}
                      />
                    </strong>
                  </div>
                </div>
                <span
                  style={{ fontSize: "10.5px", fontWeight: 700, color: "#10b981" }}
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
                  padding: "7px 10px",
                  background:
                    selectedCategory === "MUTUAL_FUNDS"
                      ? "rgba(139, 92, 246, 0.15)"
                      : "var(--background)",
                  border: `1px solid ${
                    selectedCategory === "MUTUAL_FUNDS" ? "#8b5cf6" : "var(--line)"
                  }`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#8b5cf6",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "10.5px",
                        color: "var(--muted)",
                        fontWeight: 600,
                      }}
                    >
                      Mutual Funds ({mutualFundAccounts.length})
                    </span>
                    <strong style={{ fontSize: "11.5px", color: "var(--ink)" }}>
                      <AccountAmount
                        value={calcMutualFundsTotal}
                        visible={amountsVisible}
                      />
                    </strong>
                  </div>
                </div>
                <span
                  style={{ fontSize: "10.5px", fontWeight: 700, color: "#8b5cf6" }}
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
                  padding: "7px 10px",
                  background:
                    selectedCategory === "EPFO"
                      ? "rgba(249, 115, 22, 0.15)"
                      : "var(--background)",
                  border: `1px solid ${
                    selectedCategory === "EPFO" ? "#f97316" : "var(--line)"
                  }`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#f97316",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "10.5px",
                        color: "var(--muted)",
                        fontWeight: 600,
                      }}
                    >
                      EPFO ({epfoAccounts.length})
                    </span>
                    <strong style={{ fontSize: "11.5px", color: "var(--ink)" }}>
                      <AccountAmount
                        value={calcEpfoTotal}
                        visible={amountsVisible}
                      />
                    </strong>
                  </div>
                </div>
                <span
                  style={{ fontSize: "10.5px", fontWeight: 700, color: "#f97316" }}
                >
                  {epfoPct}%
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* ── Categorized Accounts Overview ────────────────────── */}
      <div className="accounts-overview">
        {accountSections.map((section) => {
          if ("subsections" in section) {
            const allTypes = section.subsections.flatMap((sub) => sub.types);
            const sectionAccounts = wealthAccounts.filter(
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
                    marginBottom: isCollapsed ? "8px" : "18px",
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
                        <ChevronRight size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </span>
                    <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{section.label}</h2>
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
                      fontSize: "16px",
                      fontWeight: 700,
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
                      gap: "28px",
                      paddingLeft: "4px",
                    }}
                  >
                    {section.subsections.map((sub) => {
                      const subAccounts = wealthAccounts.filter(
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
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  color: "var(--muted)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                }}
                              >
                                {sub.label}
                              </h3>
                            </div>
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
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
                          <div className="account-cards-grid">
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
            const sectionAccounts = wealthAccounts.filter(
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
                        <ChevronRight size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </span>
                    <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{section.label}</h2>
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
                      fontSize: "16px",
                      fontWeight: 700,
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
                  <div className="account-cards-grid">
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
        {wealthAccounts.filter(isAccountMatch).length === 0 && (
          <div className="portfolio-empty">
            <Landmark size={44} strokeWidth={1} />
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
