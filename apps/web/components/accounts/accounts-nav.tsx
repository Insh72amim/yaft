"use client";

import { Landmark, ChartPie, CreditCard, Receipt } from "lucide-react";

export type AccountsTabType = "ACCOUNTS" | "ASSETS" | "TRANSACTIONS" | "CREDIT_CARDS";

interface AccountsNavProps {
  activeTab: AccountsTabType;
  onTabChange: (tab: AccountsTabType) => void;
}

export function AccountsNav({ activeTab, onTabChange }: AccountsNavProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "14px",
        padding: "5px",
        gap: "6px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
      }}
    >
      <button
        type="button"
        className={`secondary compact ${activeTab === "ACCOUNTS" ? "active" : ""}`}
        onClick={() => onTabChange("ACCOUNTS")}
        style={{
          borderRadius: "9px",
          padding: "8px 14px",
          fontSize: "13px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <Landmark size={15} /> <span>Accounts &amp; Portfolios</span>
      </button>

      <button
        type="button"
        className={`secondary compact ${activeTab === "ASSETS" ? "active" : ""}`}
        onClick={() => onTabChange("ASSETS")}
        style={{
          borderRadius: "9px",
          padding: "8px 14px",
          fontSize: "13px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <ChartPie size={15} /> <span>Assets &amp; Net Worth</span>
      </button>

      <button
        type="button"
        className={`secondary compact ${activeTab === "TRANSACTIONS" ? "active" : ""}`}
        onClick={() => onTabChange("TRANSACTIONS")}
        style={{
          borderRadius: "9px",
          padding: "8px 14px",
          fontSize: "13px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <Receipt size={15} /> <span>Transactions Ledger</span>
      </button>

      <button
        type="button"
        className={`secondary compact ${activeTab === "CREDIT_CARDS" ? "active" : ""}`}
        onClick={() => onTabChange("CREDIT_CARDS")}
        style={{
          borderRadius: "9px",
          padding: "8px 14px",
          fontSize: "13px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <CreditCard size={15} /> <span>Credit Cards Analytics</span>
      </button>
    </div>
  );
}
