"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Plus,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  Landmark,
} from "lucide-react";
import {
  Account,
  PortfolioAccount,
  AccountAmount,
  AccountCard,
  accountSections,
} from "./account-card";

interface AccountsPortfolioTabProps {
  accounts: Account[];
  portfolio: PortfolioAccount[];
  amountsVisible: boolean;
  setAmountsVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  collapsedSections: Record<string, boolean>;
  toggleSection: (label: string) => void;
  setAddingAccount: (adding: boolean) => void;
  error?: string;
}

export function AccountsPortfolioTab({
  accounts,
  amountsVisible,
  setAmountsVisible,
  collapsedSections,
  toggleSection,
  setAddingAccount,
  error,
}: AccountsPortfolioTabProps) {
  const router = useRouter();

  return (
    <>
      <header className="page-header accounts-page-header">
        <div>
          <span className="eyebrow">Portfolio &amp; Accounts</span>
          <h1>My accounts</h1>
          <p>View your balances, holdings, and ledgers in one place.</p>
        </div>
        <div className="page-actions accounts-page-actions">
          <button
            type="button"
            className={`account-amount-toggle${amountsVisible ? " visible" : ""}`}
            role="switch"
            aria-checked={amountsVisible}
            aria-label={
              amountsVisible ? "Hide account amounts" : "Show account amounts"
            }
            onClick={() => setAmountsVisible((visible) => !visible)}>
            <span className="account-amount-toggle-icon" aria-hidden="true">
              {amountsVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            </span>
            <span className="account-amount-toggle-label">
              {amountsVisible ? "Hide amounts" : "Show amounts"}
            </span>
            <span className="account-amount-toggle-track" aria-hidden="true">
              <span />
            </span>
          </button>
          <button className="secondary" onClick={() => setAddingAccount(true)}>
            <Plus size={17} />
            Add account
          </button>
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="accounts-overview">
        {accountSections.map((section) => {
          if ("subsections" in section) {
            const allTypes = section.subsections.flatMap((sub) => sub.types);
            const sectionAccounts = accounts.filter((account) =>
              allTypes.includes(account.type),
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
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "inline-flex", color: "var(--muted)", transition: "transform 0.2s ease" }}>
                      {isCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
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
                      }}>
                      {sectionAccounts.length}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}>
                    <AccountAmount
                      value={sectionAccounts.reduce(
                        (sum, account) => sum + account.balance,
                        0,
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
                    }}>
                    {section.subsections.map((sub) => {
                      const subAccounts = accounts.filter((account) =>
                        sub.types.includes(account.type),
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
                            }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "var(--muted)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                }}>
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
                                  title="View Credit Cards Analytics & Utilization Hub">
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
                              }}>
                              <AccountAmount
                                value={subAccounts.reduce(
                                  (sum, account) => sum + account.balance,
                                  0,
                                )}
                                visible={amountsVisible}
                              />
                            </span>
                          </header>
                          <div className={`account-cards-grid ${sub.types.includes('CREDIT_CARD') ? 'credit-cards-grid' : ''}`}>
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
            const sectionAccounts = accounts.filter((account) =>
              section.types.includes(account.type),
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
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "inline-flex", color: "var(--muted)", transition: "transform 0.2s ease" }}>
                      {isCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
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
                      }}>
                      {sectionAccounts.length}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}>
                    <AccountAmount
                      value={sectionAccounts.reduce(
                        (sum, account) => sum + account.balance,
                        0,
                      )}
                      visible={amountsVisible}
                    />
                  </span>
                </header>
                {!isCollapsed && (
                  <div className={`account-cards-grid ${section.types.includes('CREDIT_CARD') ? 'credit-cards-grid' : ''}`}>
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
        {accounts.length === 0 && (
          <div className="portfolio-empty">
            <Landmark size={48} strokeWidth={1} />
            <strong>No accounts found</strong>
            <p>Add an account to get started.</p>
          </div>
        )}
      </div>
    </>
  );
}
