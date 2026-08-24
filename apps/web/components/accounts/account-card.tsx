"use client";

import { useState } from "react";
import {
  CreditCard,
  ChartPie,
  TrendingUp,
  Building2,
  BadgeIndianRupee,
  PiggyBank,
  Landmark,
} from "lucide-react";
import { money } from "@/lib/api";
import { getDomainForInstitution, getLocalLogo, findInstitution } from "@/lib/institutions";
export { getDomainForInstitution, getLocalLogo, findInstitution };

export type Account = {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  balance: number;
  creditLimit: number | null;
  dueDay: number | null;
  cardLast4: string | null;
  cardNetwork: string | null;
  monthlyCredited: number;
  monthlyDebited: number;
  parentAccountId?: string | null;
  parentAccountName?: string | null;
  isShared?: boolean;
  isChild?: boolean;
  childAccountCount?: number;
  loanOutstanding?: number;
  nextEmiDate?: string;
  nextEmiAmount?: number;
  paidInstallments?: number;
  totalInstallments?: number;
};

export type Holding = {
  id: string;
  asset: string;
  symbol: string;
  isin: string | null;
  sector: string | null;
  assetType: string;
  quantity: string;
  availableQuantity: string;
  discrepantQuantity: string;
  longTermQuantity: string | null;
  pledgedQuantity: string;
  averagePrice: number;
  previousClosingPrice: number | null;
  currentValue: number | null;
  unrealizedPnl: number | null;
  asOfDate: string;
};

export type PortfolioAccount = {
  accountId: string;
  name: string;
  institution: string | null;
  investedValue: number;
  currentValue: number;
  unrealizedPnl: number;
  holdings: Holding[];
};

export type AccountSection =
  | { label: string; types: string[] }
  | { label: string; subsections: { label: string; types: string[] }[] };

export const accountSections: AccountSection[] = [
  { label: "Savings & Bank Accounts", types: ["SAVINGS", "BANK", "WALLET", "CASH"] },
  {
    label: "Investments & Wealth",
    subsections: [
      { label: "Mutual Funds", types: ["INVESTMENT", "MUTUAL_FUNDS"] },
      { label: "Stocks", types: ["STOCKS", "DEMAT"] },
      { label: "Fixed & recurring deposits", types: ["FIXED_DEPOSIT"] },
      { label: "EPFO Retirement", types: ["EPFO"] },
    ],
  },
  {
    label: "Liabilities & Loans",
    subsections: [
      { label: "Loans", types: ["LOAN"] },
    ],
  },
];

export function getIcon(type: string) {
  if (type === "CREDIT_CARD") return <CreditCard size={16} />;
  if (type === "INVESTMENT") return <ChartPie size={16} />;
  if (type === "STOCKS") return <TrendingUp size={16} />;
  if (type === "EPFO") return <Building2 size={16} />;
  if (type === "LOAN") return <BadgeIndianRupee size={16} />;
  if (type === "SAVINGS") return <PiggyBank size={16} />;
  return <Landmark size={16} />;
}

export function cardNetworkClass(network: string | null) {
  const normalized = network?.toLowerCase().replace(/[^a-z]/g, "");
  return normalized && ["visa", "mastercard", "amex", "rupay"].includes(normalized)
    ? normalized
    : "default";
}

export function AccountAmount({
  value,
  visible,
}: {
  value: number;
  visible: boolean;
}) {
  return (
    <span
      className={visible ? undefined : "account-masked-amount"}
      aria-label={visible ? money(value) : "Amount hidden"}>
      {visible ? money(value) : "₹ ••••••"}
    </span>
  );
}

export function CreditCardAccountCard({
  account,
  onClick,
  amountsVisible,
}: {
  account: Account;
  onClick: () => void;
  amountsVisible: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const localLogo = getLocalLogo(account.institution, account.name);
  const domain = getDomainForInstitution(account.institution || account.name);
  const logoUrl = localLogo || `https://logo.clearbit.com/${domain}?size=128`;
  const outstanding = Math.max(0, -account.balance);
  const maskedNumber = account.cardLast4
    ? `••••  ••••  ••••  ${account.cardLast4}`
    : "••••  ••••  ••••  ••••";

  return (
    <button
      className={`account-card credit-account-card credit-network-${cardNetworkClass(account.cardNetwork)}`}
      onClick={onClick}>
      <div className="credit-account-card-header">
        <div className="credit-account-card-logo">
          {!imgError ? (
            <img
              src={logoUrl}
              alt={account.institution || account.name}
              onError={() => setImgError(true)}
            />
          ) : (
            <CreditCard size={20} />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
          <span>{account.cardNetwork || "Credit card"}</span>
          {account.isShared && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "rgba(255, 255, 255, 0.95)",
                background: "rgba(0, 0, 0, 0.35)",
                padding: "2px 6px",
                borderRadius: "4px",
                backdropFilter: "blur(4px)",
              }}>
              {account.isChild ? `🔗 Shared with ${account.parentAccountName || "Primary"}` : "🔗 Shared Pool"}
            </span>
          )}
        </div>
      </div>
      <strong className="credit-account-card-number" aria-label={account.cardLast4 ? `Card ending ${account.cardLast4}` : "Card number not stored"}>
        {maskedNumber}
      </strong>
      <div className="credit-account-card-identity">
        <span>
          <small>Card</small>
          <strong>{account.name}</strong>
        </span>
        <span>
          <small>Institution</small>
          <strong>{account.institution || "Unknown"}</strong>
        </span>
      </div>
      <div className="credit-account-card-metrics">
        <span>
          <small>Credit used</small>
          <strong>
            <AccountAmount value={outstanding} visible={amountsVisible} />
          </strong>
        </span>
        {account.creditLimit && (
          <span style={{ textAlign: "right" }}>
            <small>{account.isShared ? "Pool Limit" : "Limit"}</small>
            <strong>
              <AccountAmount value={account.creditLimit} visible={amountsVisible} />
            </strong>
          </span>
        )}
      </div>
    </button>
  );
}

export function AccountCard({
  account,
  onClick,
  amountsVisible,
}: {
  account: Account;
  onClick: () => void;
  amountsVisible: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  if (account.type === "CREDIT_CARD") {
    return (
      <CreditCardAccountCard
        account={account}
        onClick={onClick}
        amountsVisible={amountsVisible}
      />
    );
  }

  const localLogo = getLocalLogo(account.institution, account.name);
  const domain = getDomainForInstitution(account.institution || account.name);
  const logoUrl = localLogo || `https://logo.clearbit.com/${domain}?size=128`;
  const isLoan = account.type === "LOAN";

  return (
    <button className="account-card" onClick={onClick}>
      <div className="account-card-header">
        <div className="account-card-logo">
          {!imgError ? (
            <img
              src={logoUrl}
              alt={account.institution || account.name}
              onError={() => setImgError(true)}
            />
          ) : (
            <span className={`account-icon ${account.type.toLowerCase()}`}>
              {getIcon(account.type)}
            </span>
          )}
        </div>
        <div className="account-card-title">
          <strong>{account.institution || "Unknown institution"}</strong>
          <small style={{ fontWeight: 500, color: "var(--muted)" }}>
            {account.name}
          </small>
        </div>
      </div>
      <div className="account-card-body">
        <div className="account-card-balance">
          <small>{isLoan ? "Outstanding Principal" : "Current Balance"}</small>
          <strong>
            <AccountAmount
              value={
                isLoan && account.loanOutstanding !== undefined
                  ? account.loanOutstanding
                  : account.balance
              }
              visible={amountsVisible}
            />
          </strong>
        </div>
        {isLoan && account.totalInstallments !== undefined ? (
          <div className="loan-card-progress">
            <div className="loan-progress-label">
              <small>
                {account.paidInstallments} of {account.totalInstallments} EMIs
                paid
              </small>
              {account.nextEmiDate && (
                <span className="next-emi-tag">
                  Next:{" "}
                  {new Date(account.nextEmiDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              )}
            </div>
            <div className="loan-progress-bar">
              <div
                className="loan-progress-fill"
                style={{
                  width: `${((account.paidInstallments || 0) / (account.totalInstallments || 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <div></div>
        )}
      </div>
    </button>
  );
}
