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
        borderRadius: "12px",
        padding: "4px",
        gap: "4px",
      }}
    >
      <button
        type="button"
        className={`secondary compact ${activeTab === "ACCOUNTS" ? "active" : ""}`}
        onClick={() => onTabChange("ACCOUNTS")}
        style={{
          borderRadius: "8px",
          fontWeight: activeTab === "ACCOUNTS" ? 600 : 500,
        }}
      >
        <Landmark size={14} /> Accounts & Portfolios
      </button>

      <button
        type="button"
        className={`secondary compact ${activeTab === "ASSETS" ? "active" : ""}`}
        onClick={() => onTabChange("ASSETS")}
        style={{
          borderRadius: "8px",
          fontWeight: activeTab === "ASSETS" ? 600 : 500,
        }}
      >
        <ChartPie size={14} /> Assets & Net Worth
      </button>

      <button
        type="button"
        className={`secondary compact ${activeTab === "TRANSACTIONS" ? "active" : ""}`}
        onClick={() => onTabChange("TRANSACTIONS")}
        style={{
          borderRadius: "8px",
          fontWeight: activeTab === "TRANSACTIONS" ? 600 : 500,
        }}
      >
        <Receipt size={14} /> Transactions Ledger
      </button>

      <button
        type="button"
        className={`secondary compact ${activeTab === "CREDIT_CARDS" ? "active" : ""}`}
        onClick={() => onTabChange("CREDIT_CARDS")}
        style={{
          borderRadius: "8px",
          fontWeight: activeTab === "CREDIT_CARDS" ? 600 : 500,
        }}
      >
        <CreditCard size={14} /> Credit Cards Analytics
      </button>
    </div>
  );
}
