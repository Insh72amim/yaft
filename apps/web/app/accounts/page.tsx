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
  Zap,
  RefreshCw,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { api, errorMessage, isUnauthorized, money } from "@/lib/api";
import { AccountTransactions, ActiveSipsPanel } from "@/components/account-transactions";
import { AddAccountModal } from "@/components/add-account-modal";
import { VaultModal } from "@/components/vault-modal";
import { ZerodhaSyncModal } from "@/components/accounts/zerodha-sync-modal";
import { GrowwSyncModal } from "@/components/accounts/groww-sync-modal";
import { AccountDocuments } from "@/components/account-documents";
import { LoanSchedule } from "@/components/loan-schedule";
import { TransactionsSection } from "@/components/transactions-section";

import { AccountsNav, AccountsTabType } from "@/components/accounts/accounts-nav";
import { Account, PortfolioAccount } from "@/components/accounts/account-card";
import { AccountsPortfolioTab, AssetsHistoryData } from "@/components/accounts/accounts-portfolio-tab";
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
      : "ACCOUNTS";

  const [activeTab, setActiveTab] = useState<AccountsTabType>(initialTab);

  const [portfolio, setPortfolio] = useState<PortfolioAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assetsHistory, setAssetsHistory] = useState<AssetsHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [amountsVisible, setAmountsVisible] = useState(false);

  const [showVaultForInvestment, setShowVaultForInvestment] = useState<string | null>(null);
  const [showZerodhaSync, setShowZerodhaSync] = useState<string | null>(null);
  const [showGrowwSync, setShowGrowwSync] = useState<string | null>(null);
  const [refreshingQuotes, setRefreshingQuotes] = useState(false);
  const [quoteNotice, setQuoteNotice] = useState<string | null>(null);
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

  const handleRefreshQuotes = async (accId: string) => {
    try {
      setRefreshingQuotes(true);
      setQuoteNotice(null);
      const res = await api<any>(`/investments/${accId}/refresh-quotes`, { method: "POST" });
      setQuoteNotice(res.message || "Updated market prices!");
      await load();
      setTimeout(() => setQuoteNotice(null), 4000);
    } catch (err: any) {
      alert(errorMessage(err, "Failed to refresh market prices."));
    } finally {
      setRefreshingQuotes(false);
    }
  };

  const handleRefreshNavs = async (accId: string) => {
    try {
      setRefreshingQuotes(true);
      setQuoteNotice(null);
      const res = await api<any>(`/investments/${accId}/refresh-navs`, { method: "POST" });
      setQuoteNotice(res.message || "Updated AMFI NAVs!");
      await load();
      setTimeout(() => setQuoteNotice(null), 5000);
    } catch (err: any) {
      alert(errorMessage(err, "Failed to refresh AMFI NAVs."));
    } finally {
      setRefreshingQuotes(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const [portfolioRes, accountsRes, assetsHistoryRes] = await Promise.all([
        api<PortfolioAccount[]>("/investments/portfolio"),
        api<Account[]>("/accounts"),
        api<AssetsHistoryData>("/dashboard/assets-history").catch(() => null),
      ]);
      setPortfolio(portfolioRes);
      setAccounts(accountsRes);
      if (assetsHistoryRes) {
        setAssetsHistory(assetsHistoryRes);
      }
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
    selectedAccount && ["STOCKS", "MUTUAL_FUND", "INVESTMENT"].includes(selectedAccount.type);
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
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {quoteNotice && (
                  <span style={{ fontSize: "11px", color: "var(--green)", fontWeight: 600 }}>
                    ✓ {quoteNotice}
                  </span>
                )}
                {/* Groww Sync - ONLY for Groww Accounts */}
                {selectedAccount &&
                  (selectedAccount.institution?.toLowerCase().includes("groww") ||
                    selectedAccount.name?.toLowerCase().includes("groww")) && (
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() => setShowGrowwSync(selectedAccountId)}
                      style={{
                        background: "rgba(0, 208, 156, 0.08)",
                        color: "#00d09c",
                        borderColor: "rgba(0, 208, 156, 0.3)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontWeight: 600,
                      }}
                      title="Automated 1-Click Sync from Groww"
                    >
                      <Zap size={14} /> Sync Groww
                    </button>
                  )}

                {/* Zerodha Sync - ONLY for Zerodha Stock / Demat Accounts */}
                {selectedAccount &&
                  (selectedAccount.type === "STOCKS" || selectedAccount.type === "DEMAT") &&
                  (selectedAccount.institution?.toLowerCase().includes("zerodha") ||
                    selectedAccount.name?.toLowerCase().includes("zerodha") ||
                    selectedAccount.institution?.toLowerCase().includes("kite")) && (
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() => setShowZerodhaSync(selectedAccountId)}
                      style={{
                        background: "rgba(249, 115, 22, 0.08)",
                        color: "#f97316",
                        borderColor: "rgba(249, 115, 22, 0.3)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontWeight: 600,
                      }}
                      title="Automated 1-Click Sync from Zerodha Kite"
                    >
                      <Zap size={14} /> Sync Zerodha
                    </button>
                  )}

                {/* Live Stock Quotes - ONLY for Stock / Equity Accounts */}
                {selectedAccount &&
                  (selectedAccount.type === "STOCKS" || selectedAccount.type === "DEMAT") &&
                  portfolioData &&
                  portfolioData.holdings.length > 0 && (
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() => handleRefreshQuotes(selectedAccountId)}
                      disabled={refreshingQuotes}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                      title="Refresh live stock market prices (LTP) from NSE"
                    >
                      <RefreshCw size={13} className={refreshingQuotes ? "spin" : ""} />
                      {refreshingQuotes ? "Updating quotes…" : "Live Quotes"}
                    </button>
                  )}

                {/* AMFI Daily NAVs - ONLY for Mutual Fund Accounts */}
                {selectedAccount &&
                  (selectedAccount.type === "MUTUAL_FUND" || (selectedAccount.type as any) === "INVESTMENT") &&
                  portfolioData &&
                  portfolioData.holdings.length > 0 && (
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() => handleRefreshNavs(selectedAccountId)}
                      disabled={refreshingQuotes}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "rgba(16, 185, 129, 0.08)",
                        color: "var(--green)",
                        borderColor: "rgba(16, 185, 129, 0.3)",
                        fontWeight: 600,
                      }}
                      title="Update live mutual fund valuations with official AMFI Daily NAVs"
                    >
                      <RefreshCw size={13} className={refreshingQuotes ? "spin" : ""} />
                      {refreshingQuotes ? "Updating NAVs…" : "Live AMFI NAVs"}
                    </button>
                  )}

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
            {showZerodhaSync && (
              <ZerodhaSyncModal
                accountId={showZerodhaSync}
                accountName={selectedAccount.name}
                onClose={() => setShowZerodhaSync(null)}
                onSuccess={() => load()}
              />
            )}
            {showGrowwSync && (
              <GrowwSyncModal
                accountId={showGrowwSync}
                accountName={selectedAccount.name}
                onClose={() => setShowGrowwSync(null)}
                onSuccess={() => load()}
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
      ) : (
        <AccountsPortfolioTab
          accounts={accounts}
          portfolio={portfolio}
          assetsHistory={assetsHistory}
          amountsVisible={amountsVisible}
          setAmountsVisible={setAmountsVisible}
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          setAddingAccount={setAddingAccount}
          onRefresh={() => {
            void load();
          }}
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
