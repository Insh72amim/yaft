"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BriefcaseBusiness,
  Upload,
  Landmark,
  TrendingUp,
  ChevronLeft,
  Lock,
  Files,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { api, errorMessage, isUnauthorized, money } from "@/lib/api";
import { AccountTransactions, ActiveSipsPanel } from "@/components/account-transactions";
import { AddAccountModal } from "@/components/add-account-modal";
import { VaultModal } from "@/components/vault-modal";
import { AccountDocuments } from "@/components/account-documents";
import { LoanSchedule } from "@/components/loan-schedule";
import { TransactionsSection } from "@/components/transactions-section";

import { AccountsNav, AccountsTabType } from "@/components/accounts/accounts-nav";
import { Account, PortfolioAccount } from "@/components/accounts/account-card";
import { AccountsPortfolioTab } from "@/components/accounts/accounts-portfolio-tab";
import { AssetsNetWorthTab } from "@/components/accounts/assets-net-worth-tab";
import { CreditCardsTab } from "@/components/accounts/credit-cards-tab";

const quantity = (value: string) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 6 }).format(
    Number(value),
  );

const price = (minor: number | null) =>
  minor === null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(minor / 100);

function PortfolioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab")?.toUpperCase();
  const initialTab: AccountsTabType =
    tabParam === "TRANSACTIONS"
      ? "TRANSACTIONS"
      : tabParam === "CREDIT_CARDS"
      ? "CREDIT_CARDS"
      : tabParam === "ASSETS"
      ? "ASSETS"
      : "ACCOUNTS";

  const [activeTab, setActiveTab] = useState<AccountsTabType>(initialTab);

  const [portfolio, setPortfolio] = useState<PortfolioAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [amountsVisible, setAmountsVisible] = useState(false);

  const [showVaultForInvestment, setShowVaultForInvestment] = useState<string | null>(null);
  const [investmentTab, setInvestmentTab] = useState<"HOLDINGS" | "DOCUMENTS" | "SIPS">("HOLDINGS");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    Investments: true,
    "Debt Accounts": true,
  });

  const toggleSection = (label: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const selectedAccountId = searchParams.get("account");

  const load = useCallback(async () => {
    try {
      const [portfolioRes, accountsRes] = await Promise.all([
        api<PortfolioAccount[]>("/investments/portfolio"),
        api<Account[]>("/accounts"),
      ]);
      setPortfolio(portfolioRes);
      setAccounts(accountsRes);
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace("/login");
      else setError(errorMessage(reason, "Could not load your accounts."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading)
    return (
      <Shell>
        <div className="loading">
          <span />
          <p>Loading your portfolio…</p>
        </div>
      </Shell>
    );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const isInvestment =
    selectedAccount && ["STOCKS", "INVESTMENT"].includes(selectedAccount.type);
  const portfolioData = isInvestment
    ? portfolio.find((p) => p.accountId === selectedAccountId)
    : null;

  if (selectedAccountId && selectedAccount) {
    // Full Page Detail View for single selected account
    return (
      <Shell>
        <header className="page-header">
          <div>
            <Link href="/accounts" className="back-link">
              <ChevronLeft size={16} /> Back to all accounts
            </Link>
            <span
              className="eyebrow"
              style={{
                textTransform: "none",
                letterSpacing: "normal",
                fontSize: "13px",
                color: "var(--muted)",
                display: "block",
                marginBottom: "2px",
              }}>
              {selectedAccount.name}
            </span>
            <h1 style={{ marginTop: "4px" }}>
              {selectedAccount.institution || "Account Details"}
            </h1>
          </div>
        </header>
        {isInvestment ? (
          <>
            <section className="summary-grid account-ledger-summary">
              <article>
                <span className="summary-icon saved"><BriefcaseBusiness /></span>
                <div>
                  <small>Total holdings</small>
                  <strong>{portfolioData ? `${portfolioData.holdings.length} instruments` : '0'}</strong>
                </div>
              </article>
              <article>
                <span className="summary-icon income"><Landmark /></span>
                <div>
                  <small>Current portfolio value</small>
                  <strong>{portfolioData ? money(portfolioData.currentValue) : '₹0'}</strong>
                </div>
              </article>
              <article>
                <span className={`summary-icon ${portfolioData && portfolioData.unrealizedPnl < 0 ? 'expense' : 'saved'}`}>
                  <TrendingUp />
                </span>
                <div>
                  <small>Unrealized P&amp;L</small>
                  <strong className={portfolioData && portfolioData.unrealizedPnl < 0 ? 'loss' : 'gain'}>
                    {portfolioData ? money(portfolioData.unrealizedPnl) : '₹0'}
                  </strong>
                </div>
              </article>
            </section>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '6px', background: 'var(--card)', padding: '4px', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <button
                  type="button"
                  className={`secondary compact ${investmentTab === 'HOLDINGS' ? 'active' : ''}`}
                  onClick={() => setInvestmentTab('HOLDINGS')}
                >
                  <BriefcaseBusiness size={14} /> Holdings
                </button>
                <button
                  type="button"
                  className={`secondary compact ${investmentTab === 'DOCUMENTS' ? 'active' : ''}`}
                  onClick={() => setInvestmentTab('DOCUMENTS')}
                >
                  <Files size={14} /> Documents
                </button>
                <button
                  type="button"
                  className={`secondary compact ${investmentTab === 'SIPS' ? 'active' : ''}`}
                  onClick={() => setInvestmentTab('SIPS')}
                >
                  <TrendingUp size={14} color="#8b5cf6" /> Active SIPs
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => setShowVaultForInvestment(selectedAccountId)}
                >
                  <Lock size={14} /> Credentials
                </button>
                <Link
                  className="secondary compact"
                  href={`/import?kind=BROKER_HOLDINGS&accountId=${encodeURIComponent(selectedAccountId)}`}
                >
                  <Upload size={14} /> Import snapshot
                </Link>
              </div>
            </div>

            {investmentTab === 'DOCUMENTS' ? (
              <AccountDocuments accountId={selectedAccountId} />
            ) : investmentTab === 'SIPS' ? (
              <ActiveSipsPanel accountId={selectedAccountId} />
            ) : (
              <div className="panel portfolio-account">
                <header>
                  <div>
                    <span className="eyebrow">Portfolio</span>
                    <h2>Holdings List</h2>
                  </div>
                </header>
                {portfolioData?.holdings.length ? (
                  <div className="holdings-scroll">
                    <table className="holdings-table">
                      <thead>
                        <tr>
                          <th>Instrument</th>
                          <th>Quantity detail</th>
                          <th>Avg. cost</th>
                          <th>Previous close</th>
                          <th>Value</th>
                          <th>Unrealized P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioData.holdings.map((holding) => {
                          const pnl = holding.unrealizedPnl ?? 0;
                          const invested =
                            Number(holding.quantity) * holding.averagePrice;
                          return (
                            <tr key={holding.id}>
                              <td>
                                <strong>{holding.symbol}</strong>
                                <span className="holding-sector-tag">
                                  {holding.sector ||
                                    holding.assetType.replace("_", " ")}
                                </span>
                                <small>{holding.isin || "ISIN unavailable"}</small>
                              </td>
                              <td>
                                <strong>{quantity(holding.quantity)}</strong>
                                <span>
                                  {quantity(holding.availableQuantity)} available
                                  {Number(holding.pledgedQuantity)
                                    ? ` · ${quantity(holding.pledgedQuantity)} pledged`
                                    : ""}
                                </span>
                                {Number(holding.discrepantQuantity) > 0 && (
                                  <small className="warning">
                                    {quantity(holding.discrepantQuantity)}{" "}
                                    discrepant
                                  </small>
                                )}
                              </td>
                              <td>{price(holding.averagePrice)}</td>
                              <td>{price(holding.previousClosingPrice)}</td>
                              <td>
                                <strong>
                                  {holding.currentValue === null
                                    ? "—"
                                    : money(holding.currentValue)}
                                </strong>
                              </td>
                              <td className={pnl < 0 ? "loss" : "gain"}>
                                <div className="pnl-badge">
                                  <strong>{money(pnl)}</strong>
                                  <span>
                                    {invested
                                      ? `${pnl >= 0 ? "+" : ""}${((pnl / invested) * 100).toFixed(2)}%`
                                      : "—"}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="portfolio-empty">
                    <BriefcaseBusiness size={48} strokeWidth={1} />
                    <strong>No holdings imported</strong>
                    <p>
                      Use Import records to validate a broker holdings snapshot for
                      this account.
                    </p>
                    <Link
                      className="secondary compact"
                      href={`/import?kind=BROKER_HOLDINGS&accountId=${encodeURIComponent(selectedAccountId)}`}>
                      Import snapshot
                    </Link>
                  </div>
                )}
                {portfolioData?.holdings[0] && (
                  <footer>
                    Snapshot imported{" "}
                    {new Date(portfolioData.holdings[0].asOfDate).toLocaleString(
                      "en-IN",
                    )}
                  </footer>
                )}
              </div>
            )}
            {showVaultForInvestment && (
              <VaultModal
                accountId={showVaultForInvestment}
                onClose={() => setShowVaultForInvestment(null)}
              />
            )}
          </>
        ) : selectedAccount.type === "LOAN" ? (
          <LoanSchedule accountId={selectedAccountId} embedded={true} />
        ) : (
          <AccountTransactions accountId={selectedAccountId} embedded={true} />
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
        <AccountsNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === "TRANSACTIONS" ? (
        <TransactionsSection embedded={true} />
      ) : activeTab === "CREDIT_CARDS" ? (
        <CreditCardsTab />
      ) : activeTab === "ASSETS" ? (
        <AssetsNetWorthTab />
      ) : (
        <AccountsPortfolioTab
          accounts={accounts}
          portfolio={portfolio}
          amountsVisible={amountsVisible}
          setAmountsVisible={setAmountsVisible}
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          setAddingAccount={setAddingAccount}
          error={error}
        />
      )}

      {addingAccount && (
        <AddAccountModal
          onClose={() => setAddingAccount(false)}
          onSuccess={() => {
            void load();
          }}
        />
      )}
    </Shell>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="loading">
            <span />
            <p>Loading your accounts…</p>
          </div>
        </Shell>
      }>
      <PortfolioContent />
    </Suspense>
  );
}
