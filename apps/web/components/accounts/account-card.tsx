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
  { label: "Savings accounts", types: ["SAVINGS", "BANK"] },
  {
    label: "Investments",
    subsections: [
      { label: "Fixed & recurring deposits", types: ["FIXED_DEPOSIT"] },
      { label: "Stock market", types: ["STOCKS"] },
      { label: "EPFO", types: ["EPFO"] },
      { label: "Other investments", types: ["INVESTMENT"] },
    ],
  },
  {
    label: "Debt Accounts",
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

export function getDomainForInstitution(name: string | null) {
  if (!name) return "bank.com";
  const n = name.toLowerCase();
  if (n.includes("zerodha")) return "zerodha.com";
  if (n.includes("groww")) return "groww.in";
  if (n.includes("upstox")) return "upstox.com";
  if (n.includes("hdfc")) return "hdfcbank.com";
  if (n.includes("icici")) return "icicibank.com";
  if (n.includes("sbi") || n.includes("state bank")) return "onlinesbi.sbi";
  if (n.includes("axis")) return "axisbank.com";
  if (n.includes("pnb") || n.includes("punjab")) return "pnbindia.in";
  if (n.includes("kotak")) return "kotak.com";
  if (n.includes("idfc")) return "idfcfirstbank.com";
  if (n.includes("indusind")) return "indusind.com";
  if (n.includes("amazon") || n.includes("aplus")) return "amazon.in";
  if (n.includes("cred")) return "cred.club";
  if (n.includes("epfo") || n.includes("pf")) return "epfindia.gov.in";
  return "bank.com";
}

export function getLocalLogo(institution: string | null, name: string): string | null {
  const check = ((institution || "") + " " + name).toLowerCase();
  if (check.includes("axis")) return "/logos/axis.png";
  if (check.includes("epfo") || check.includes("provident")) return "/logos/epfo.png";
  if (check.includes("groww")) return "/logos/groww.jpeg";
  if (check.includes("hdfc")) return "/logos/hdfc.png";
  if (check.includes("icici")) return "/logos/icici.png";
  if (check.includes("pnb") || check.includes("punjab national")) return "/logos/pnb.jpeg";
  if (check.includes("sbi") || check.includes("state bank")) return "/logos/sbi.png";
  if (check.includes("zerodha")) return "/logos/zerodha.png";
  return null;
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
        <span>{account.cardNetwork || "Credit card"}</span>
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
