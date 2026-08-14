"use client";
import {
  BriefcaseBusiness,
  Plus,
  Upload,
  Landmark,
  CreditCard,
  BadgeIndianRupee,
  Building2,
  PiggyBank,
  ChartPie,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
  Files,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  PieChart,
  Wallet,
  Layers,
  Sparkles,
  AlertCircle,
  Loader2,
  Gauge,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { Shell } from "@/components/shell";
import { api, errorMessage, isUnauthorized, money } from "@/lib/api";
import { AccountTransactions, ActiveSipsPanel } from "@/components/account-transactions";
import { AddAccountModal } from "@/components/add-account-modal";
import { VaultModal } from "@/components/vault-modal";
import { AccountDocuments } from "@/components/account-documents";
import { LoanSchedule } from "@/components/loan-schedule";

type Holding = {
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
type PortfolioAccount = {
  accountId: string;
  name: string;
  institution: string | null;
  investedValue: number;
  currentValue: number;
  unrealizedPnl: number;
  holdings: Holding[];
};
type Account = {
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

type AccountSection =
  | { label: string; types: string[] }
  | { label: string; subsections: { label: string; types: string[] }[] };

const accountSections: AccountSection[] = [
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
      { label: "Credit cards", types: ["CREDIT_CARD"] },
    ],
  },
];

function getIcon(type: string) {
  if (type === "CREDIT_CARD") return <CreditCard size={16} />;
  if (type === "INVESTMENT") return <ChartPie size={16} />;
  if (type === "STOCKS") return <TrendingUp size={16} />;
  if (type === "EPFO") return <Building2 size={16} />;
  if (type === "LOAN") return <BadgeIndianRupee size={16} />;
  if (type === "SAVINGS") return <PiggyBank size={16} />;
  return <Landmark size={16} />;
}

function getDomainForInstitution(name: string | null) {
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

function getLocalLogo(institution: string | null, name: string): string | null {
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

function cardNetworkClass(network: string | null) {
  const normalized = network?.toLowerCase().replace(/[^a-z]/g, "");
  return normalized && ["visa", "mastercard", "amex", "rupay"].includes(normalized)
    ? normalized
    : "default";
}

function AccountAmount({
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

function CreditCardAccountCard({
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

function AccountCard({
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

function PortfolioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (tabParam === "credit_cards" || tabParam === "CREDIT_CARDS")
    ? "CREDIT_CARDS"
    : (tabParam === "assets" || tabParam === "ASSETS")
    ? "ASSETS"
    : "ACCOUNTS";

  const [activeTab, setActiveTab] = useState<"ACCOUNTS" | "CREDIT_CARDS" | "ASSETS">(initialTab);

  const [portfolio, setPortfolio] = useState<PortfolioAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [amountsVisible, setAmountsVisible] = useState(false);

  const [showVaultForInvestment, setShowVaultForInvestment] = useState<
    string | null
  >(null);
  const [investmentTab, setInvestmentTab] = useState<
    "HOLDINGS" | "DOCUMENTS" | "SIPS"
  >("HOLDINGS");
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({
    Investments: true,
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
    // Full Page Detail View
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
                  <small>Unrealized P&L</small>
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

  // Accounts Overview View
  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "6px", background: "var(--background-alt)", padding: "4px", borderRadius: "10px", border: "1px solid var(--line)" }}>
          <button
            type="button"
            className={`secondary compact ${activeTab === "ACCOUNTS" ? "active" : ""}`}
            onClick={() => setActiveTab("ACCOUNTS")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, padding: "6px 14px" }}
          >
            <BriefcaseBusiness size={15} color={activeTab === "ACCOUNTS" ? "var(--green)" : "var(--muted)"} />
            Accounts & Portfolios
          </button>
          <button
            type="button"
            className={`secondary compact ${activeTab === "CREDIT_CARDS" ? "active" : ""}`}
            onClick={() => setActiveTab("CREDIT_CARDS")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, padding: "6px 14px" }}
          >
            <CreditCard size={15} color={activeTab === "CREDIT_CARDS" ? "#ef4444" : "var(--muted)"} />
            Credit Cards Analytics
          </button>
          <button
            type="button"
            className={`secondary compact ${activeTab === "ASSETS" ? "active" : ""}`}
            onClick={() => setActiveTab("ASSETS")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, padding: "6px 14px" }}
          >
            <TrendingUp size={15} color={activeTab === "ASSETS" ? "#3b82f6" : "var(--muted)"} />
            Assets & Net Worth
          </button>
        </div>
      </div>

      {activeTab === "CREDIT_CARDS" ? (
        <CreditCardsSection />
      ) : activeTab === "ASSETS" ? (
        <AssetsSection />
      ) : (
        <>
          <header className="page-header accounts-page-header">
        <div>
          <span className="eyebrow">Portfolio & Accounts</span>
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

      {addingAccount && (
        <AddAccountModal
          onClose={() => setAddingAccount(false)}
          onSuccess={() => {
            void load();
          }}
        />
      )}
        </>
      )}
    </Shell>
  );
}

interface HoldingAsset {
  symbol: string;
  name: string;
  category: string;
  quantity: number;
  currentValue: number | null;
}

interface AccountAsset {
  id: string;
  name: string;
  type: string;
  institution: string;
  balance: number;
  holdingCount: number;
  holdings: HoldingAsset[];
}

interface AssetsHistoryData {
  netWorth: number;
  liquidCashTotal: number;
  equitiesTotal: number;
  epfoTotal: number;
  debtTotal: number;
  totalAssets: number;
  allocation: {
    liquidCash: { amount: number; percentage: number };
    equities: { amount: number; percentage: number };
    epfo: { amount: number; percentage: number };
    debt: { amount: number; percentage: number };
  };
  accounts: AccountAsset[];
  history: {
    month: string;
    liquid: number;
    equities: number;
    epfo: number;
    debt: number;
    netWorth: number;
  }[];
}

function AssetsSection() {
  const [data, setData] = useState<AssetsHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hidePrivacy, setHidePrivacy] = useState(true);
  const [selectedAssetCategory, setSelectedAssetCategory] = useState<"ALL" | "CASH" | "EQUITIES" | "EPFO" | "DEBT">("ALL");

  useEffect(() => {
    setLoading(true);
    api<AssetsHistoryData>("/dashboard/assets-history")
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || "Failed to load assets history");
        setLoading(false);
      });
  }, []);

  const formatAmount = (val: number) => {
    if (hidePrivacy) return "••••••";
    return money(val);
  };

  if (loading) {
    return (
      <div className="loading" style={{ height: "40vh" }}>
        <span />
        <p>Loading Assets & Net Worth Portfolio...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="panel" style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>
        <AlertCircle size={28} style={{ margin: "0 auto 12px auto", display: "block" }} />
        <span>{error || "Could not load assets data"}</span>
      </div>
    );
  }

  const { netWorth, liquidCashTotal, equitiesTotal, epfoTotal, debtTotal, totalAssets, allocation, accounts, history } = data;

  const filteredAccounts = accounts.filter((acc) => {
    if (selectedAssetCategory === "CASH") return ["SAVINGS", "BANK", "CASH", "FD", "FIXED_DEPOSIT"].includes(acc.type);
    if (selectedAssetCategory === "EQUITIES") return ["INVESTMENT", "STOCKS", "MUTUAL_FUND"].includes(acc.type);
    if (selectedAssetCategory === "EPFO") return acc.type === "EPFO";
    if (selectedAssetCategory === "DEBT") return ["LOAN", "CREDIT_CARD"].includes(acc.type);
    return true;
  });

  const firstWorth = history.length > 0 ? history[0].netWorth : netWorth;
  const lastWorth = history.length > 0 ? history[history.length - 1].netWorth : netWorth;
  const netWorthDelta = lastWorth - firstWorth;
  const growthPct = firstWorth !== 0 ? Math.round(((lastWorth - firstWorth) / Math.abs(firstWorth)) * 1000) / 10 : 0;
  const isPositiveGrowth = netWorthDelta >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Hero Card */}
      <div className="hero-card assets-hero">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.85, fontWeight: 700 }}>
              Total Net Worth & Assets
            </span>
            <span
              style={{
                background: isPositiveGrowth ? "rgba(255, 255, 255, 0.18)" : "rgba(239, 68, 68, 0.25)",
                padding: "3px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}>
              {isPositiveGrowth ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {growthPct > 0 ? `+${growthPct}%` : `${growthPct}%`} (12M)
            </span>
          </div>
          <strong style={{ margin: "4px 0" }}>{formatAmount(netWorth)}</strong>
          <small>
            <Sparkles size={14} />
            Total Assets: {formatAmount(totalAssets)} • Liabilities: {formatAmount(debtTotal)}
          </small>
        </div>

        <div style={{ display: "flex", alignItems: "center", position: "relative", zIndex: 10 }}>
          <button
            type="button"
            onClick={() => setHidePrivacy(!hidePrivacy)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "20px",
              background: hidePrivacy ? "rgba(255, 255, 255, 0.2)" : "rgba(16, 185, 129, 0.3)",
              border: `1px solid ${hidePrivacy ? "rgba(255, 255, 255, 0.35)" : "rgba(16, 185, 129, 0.6)"}`,
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "12px",
              backdropFilter: "blur(12px)",
              cursor: "pointer",
            }}>
            {hidePrivacy ? <Eye size={15} /> : <EyeOff size={15} />}
            <span>{hidePrivacy ? "Show Amounts" : "Hide Amounts"}</span>
          </button>
        </div>
      </div>

      {/* 2. Asset Allocation Breakdown */}
      <section className="panel" style={{ padding: "24px" }}>
        <div className="panel-title" style={{ marginBottom: "16px" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>Portfolio Distribution</span>
            <h2>Asset Allocation & Diversification</h2>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ height: "14px", width: "100%", background: "var(--line)", borderRadius: "8px", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${allocation.liquidCash.percentage}%`, background: "#3b82f6" }} title={`Liquid Cash: ${allocation.liquidCash.percentage}%`} />
            <div style={{ width: `${allocation.equities.percentage}%`, background: "#8b5cf6" }} title={`Equities: ${allocation.equities.percentage}%`} />
            <div style={{ width: `${allocation.epfo.percentage}%`, background: "#f59e0b" }} title={`EPFO: ${allocation.epfo.percentage}%`} />
          </div>

          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "12px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#3b82f6" }} />
              Liquid Cash & FDs: {formatAmount(liquidCashTotal)} ({allocation.liquidCash.percentage}%)
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#8b5cf6" }} />
              Equities & Stocks: {formatAmount(equitiesTotal)} ({allocation.equities.percentage}%)
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
              EPFO Provident Fund: {formatAmount(epfoTotal)} ({allocation.epfo.percentage}%)
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#ef4444" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
              Liabilities & Debt: {formatAmount(debtTotal)}
            </span>
          </div>
        </div>
      </section>

      {/* 3. Account Holdings Breakdown */}
      <section className="panel" style={{ padding: "24px" }}>
        <div className="panel-title" style={{ flexWrap: "wrap", gap: "16px", alignItems: "center", marginBottom: "20px", display: "flex", justifyContent: "space-between" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>Holdings & Accounts Portfolio</span>
            <h2>Account Assets Breakdown</h2>
          </div>

          <div className="asset-filter-bar" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {(["ALL", "CASH", "EQUITIES", "EPFO", "DEBT"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`secondary compact ${selectedAssetCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedAssetCategory(cat)}
                style={{ fontSize: "12px", padding: "4px 12px" }}>
                {cat === "ALL" ? "All" : cat === "CASH" ? "Cash & FDs" : cat === "EQUITIES" ? "Equities" : cat === "EPFO" ? "EPFO" : "Loans & Debt"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          {filteredAccounts.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
              No active accounts or holdings found under this category filter.
            </div>
          ) : (
            filteredAccounts.map((acc) => {
              const isNegative = acc.balance < 0;
              const pctOfAssets = totalAssets > 0 && !isNegative ? Math.round((acc.balance / totalAssets) * 1000) / 10 : 0;
              return (
                <div key={acc.id} className="account-asset-card" style={{ background: "var(--background-alt)", border: "1px solid var(--line)", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Landmark size={18} />
                      <div>
                        <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                          {acc.institution} • {acc.type}
                        </span>
                        <h3 style={{ margin: "2px 0 0 0", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>{acc.name}</h3>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <strong style={{ fontSize: "1.2rem", fontWeight: 700, color: isNegative ? "#ef4444" : "var(--ink)" }}>
                        {formatAmount(acc.balance)}
                      </strong>
                      {!isNegative && totalAssets > 0 && (
                        <small style={{ display: "block", color: "var(--muted)", fontSize: "11px" }}>
                          {pctOfAssets}% of total assets
                        </small>
                      )}
                    </div>
                  </div>

                  {acc.holdings.length > 0 && (
                    <div style={{ background: "var(--card)", borderRadius: "10px", padding: "12px", border: "1px solid var(--line)", marginTop: "10px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "8px" }}>
                        Holdings Positions ({acc.holdingCount} assets)
                      </span>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {acc.holdings.slice(0, 8).map((h, hIdx) => (
                          <span key={hIdx} style={{ background: "var(--background-alt)", border: "1px solid var(--line)", padding: "4px 8px", borderRadius: "6px", fontSize: "11px" }}>
                            <strong style={{ color: "var(--ink)", marginRight: "4px" }}>{h.symbol}</strong>
                            <span style={{ color: "var(--muted)" }}>
                              {h.currentValue !== null ? formatAmount(h.currentValue) : `${h.quantity} units`}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

type CardCategoryItem = {
  name: string;
  color: string;
  amount: number;
  percentage: number;
};

type CardRecipientItem = {
  name: string;
  amount: number;
  count: number;
};

type CardSummary = {
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
  totalInbound: number;
  totalOutbound: number;
  categories: CardCategoryItem[];
  topRecipients: CardRecipientItem[];
  otherOutbound: { amount: number; count: number };
};

type MonthlyFlow = {
  month: string;
  spends: number;
  payments: number;
};

type RecentTx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  categoryColor: string;
  accountName: string;
};

type CreditCardsApiResponse = {
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

function CreditCardDoughnutChart({
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

function CreditCardsSection() {
  const router = useRouter();
  const [data, setData] = useState<CreditCardsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vaultAccount, setVaultAccount] = useState<CardSummary | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api<CreditCardsApiResponse>("/accounts/credit-cards/summary");
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
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Overview Cards */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div className="kpi-card" style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "14px", border: "1px solid var(--line)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Total Credit Limit</span>
          <strong style={{ display: "block", fontSize: "1.4rem", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>{money(summary.totalLimit)}</strong>
          <small style={{ color: "var(--muted)", fontSize: "11px" }}>Across {summary.activeCardCount} active cards</small>
        </div>

        <div className="kpi-card" style={{ background: "var(--card)", padding: "16px 20px", borderRadius: "14px", border: "1px solid var(--line)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", textTransform: "uppercase" }}>Total Outstanding</span>
          <strong style={{ display: "block", fontSize: "1.4rem", fontWeight: 800, color: "#ef4444", marginTop: "4px" }}>{money(summary.totalOutstanding)}</strong>
          <small style={{ color: "var(--muted)", fontSize: "11px" }}>Current bill dues</small>
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

      {/* Credit Cards Directory */}
      <section className="panel" style={{ padding: "24px" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>Active Credit Cards ({cards.length})</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {cards.map((card) => (
            <div key={card.id} style={{ background: "var(--background-alt)", borderRadius: "12px", padding: "16px", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>{card.institution || "Bank"}</span>
                  <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>{card.name}</h4>
                </div>
                <CreditCard size={20} color="#ef4444" />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", margin: "10px 0" }}>
                <span style={{ color: "var(--muted)" }}>Outstanding Due:</span>
                <strong style={{ color: "#ef4444" }}>{money(card.outstanding)}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "8px" }}>
                <span style={{ color: "var(--muted)" }}>Limit: {money(card.creditLimit)}</span>
                <span style={{ fontWeight: 700 }}>{card.utilizationPercent}% used</span>
              </div>

              <div style={{ width: "100%", height: "4px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, card.utilizationPercent)}%`, height: "100%", background: card.utilizationPercent > 30 ? "#ef4444" : "var(--green)" }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
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
