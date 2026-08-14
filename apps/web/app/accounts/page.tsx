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
  Pencil,
  Search,
  X,
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
  const [successMsg, setSuccessMsg] = useState("");
  const [hidePrivacy, setHidePrivacy] = useState(true);
  const [selectedAssetCategory, setSelectedAssetCategory] = useState<"ALL" | "CASH" | "EQUITIES" | "EPFO" | "DEBT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Add Custom Asset Modal
  const [addAssetModalOpen, setAddAssetModalOpen] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState<"SAVINGS" | "FIXED_DEPOSIT" | "STOCKS" | "INVESTMENT" | "EPFO" | "CASH">("SAVINGS");
  const [newAssetInstitution, setNewAssetInstitution] = useState("");
  const [newAssetValuation, setNewAssetValuation] = useState("");
  const [addingAsset, setAddingAsset] = useState(false);

  // Edit Valuation Modal
  const [editingAsset, setEditingAsset] = useState<{ id: string; name: string; type: string; institution: string | null; balance: number } | null>(null);
  const [editAssetName, setEditAssetName] = useState("");
  const [editAssetInstitution, setEditAssetInstitution] = useState("");
  const [editValuationInput, setEditValuationInput] = useState("");
  const [updatingValuation, setUpdatingValuation] = useState(false);

  const fetchAssetsData = useCallback(() => {
    setLoading(true);
    setError("");
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

  useEffect(() => {
    fetchAssetsData();
  }, [fetchAssetsData]);

  const formatAmount = (val: number) => {
    if (hidePrivacy) return "••••••";
    return money(val);
  };

  const handleAddAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetName.trim()) return;
    const val = parseFloat(newAssetValuation);
    if (isNaN(val) || val < 0) {
      setError("Please enter a valid valuation amount.");
      return;
    }

    setAddingAsset(true);
    setError("");
    try {
      await api("/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: newAssetName.trim(),
          type: newAssetType,
          institution: newAssetInstitution.trim() || undefined,
          openingBalance: Math.round(val * 100),
        }),
      });
      setSuccessMsg(`Added asset "${newAssetName.trim()}"!`);
      setNewAssetName("");
      setNewAssetInstitution("");
      setNewAssetValuation("");
      setAddAssetModalOpen(false);
      fetchAssetsData();
    } catch (err: any) {
      setError(errorMessage(err, "Failed to add custom asset."));
    } finally {
      setAddingAsset(false);
    }
  };

  const handleUpdateValuationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    const val = parseFloat(editValuationInput);
    if (isNaN(val)) {
      setError("Please enter a valid valuation amount.");
      return;
    }

    setUpdatingValuation(true);
    setError("");
    try {
      await api(`/accounts/${editingAsset.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          openingBalance: Math.round(val * 100),
          name: editAssetName.trim() || undefined,
          institution: editAssetInstitution.trim() || undefined,
        }),
      });
      setSuccessMsg(`Updated valuation for "${editAssetName.trim() || editingAsset.name}"!`);
      setEditingAsset(null);
      fetchAssetsData();
    } catch (err: any) {
      setError(errorMessage(err, "Failed to update asset valuation."));
    } finally {
      setUpdatingValuation(false);
    }
  };

  if (loading) {
    return (
      <div className="loading" style={{ height: "40vh" }}>
        <span />
        <p>Loading Assets & Net Worth Portfolio...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel" style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>
        <AlertCircle size={28} style={{ margin: "0 auto 12px auto", display: "block" }} />
        <span>{error || "Could not load assets data"}</span>
      </div>
    );
  }

  const { netWorth, liquidCashTotal, equitiesTotal, epfoTotal, debtTotal, totalAssets, allocation, accounts, history } = data!;

  const filteredAccounts = accounts.filter((acc) => {
    const matchesCategory =
      selectedAssetCategory === "ALL"
        ? true
        : selectedAssetCategory === "CASH"
        ? ["SAVINGS", "BANK", "CASH", "FD", "FIXED_DEPOSIT"].includes(acc.type)
        : selectedAssetCategory === "EQUITIES"
        ? ["INVESTMENT", "STOCKS", "MUTUAL_FUND"].includes(acc.type)
        : selectedAssetCategory === "EPFO"
        ? acc.type === "EPFO"
        : selectedAssetCategory === "DEBT"
        ? ["LOAN", "CREDIT_CARD"].includes(acc.type)
        : true;

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      acc.name.toLowerCase().includes(query) ||
      (acc.institution && acc.institution.toLowerCase().includes(query)) ||
      acc.type.toLowerCase().includes(query) ||
      acc.holdings.some((h) => h.symbol.toLowerCase().includes(query) || h.name.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  const firstWorth = history.length > 0 ? history[0].netWorth : netWorth;
  const lastWorth = history.length > 0 ? history[history.length - 1].netWorth : netWorth;
  const netWorthDelta = lastWorth - firstWorth;
  const growthPct = firstWorth !== 0 ? Math.round(((lastWorth - firstWorth) / Math.abs(firstWorth)) * 1000) / 10 : 0;
  const isPositiveGrowth = netWorthDelta >= 0;
  const liquidPct = totalAssets > 0 ? Math.round((liquidCashTotal / totalAssets) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Notifications */}
      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {successMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={16} /> {successMsg}
        </div>
      )}

      {/* 1. Hero Card & Actions Bar */}
      <div className="hero-card assets-hero" style={{ position: "relative" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
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
            <span style={{ background: "rgba(59, 130, 246, 0.25)", border: "1px solid rgba(59, 130, 246, 0.4)", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, color: "#ffffff" }}>
              💧 {liquidPct}% Liquid Ratio
            </span>
          </div>
          <strong style={{ margin: "4px 0", display: "block", fontSize: "2rem" }}>{formatAmount(netWorth)}</strong>
          <small>
            <Sparkles size={14} />
            Total Assets: {formatAmount(totalAssets)} • Liabilities: {formatAmount(debtTotal)}
          </small>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", zIndex: 10 }}>
          <button
            type="button"
            className="primary compact"
            onClick={() => setAddAssetModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "20px",
              background: "var(--green)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "12px",
              border: "none",
              cursor: "pointer",
            }}>
            <Plus size={15} />
            <span>Add Asset / Holding</span>
          </button>

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

      {/* 3. Account Holdings Breakdown & Search */}
      <section className="panel" style={{ padding: "24px" }}>
        <div className="panel-title" style={{ flexWrap: "wrap", gap: "16px", alignItems: "center", marginBottom: "20px", display: "flex", justifyContent: "space-between" }}>
          <div>
            <span className="eyebrow" style={{ color: "var(--green)" }}>Holdings & Accounts Portfolio</span>
            <h2>Account Assets Breakdown ({filteredAccounts.length})</h2>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Search Box */}
            <div style={{ position: "relative", minWidth: "200px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                type="text"
                placeholder="Search assets, symbols..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: "34px",
                  fontSize: "12px",
                  paddingLeft: "30px",
                  paddingRight: "10px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--background-alt)",
                  color: "var(--ink)",
                }}
              />
            </div>

            {/* Category Filter Bar */}
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
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          {filteredAccounts.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
              No active accounts or asset holdings found under this search/category filter.
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
                          {acc.institution || "Personal"} • {acc.type}
                        </span>
                        <h3 style={{ margin: "2px 0 0 0", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>{acc.name}</h3>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
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

                      <button
                        type="button"
                        className="icon-button"
                        title="Edit Asset Valuation / Balance"
                        onClick={() => {
                          setEditingAsset(acc);
                          setEditAssetName(acc.name);
                          setEditAssetInstitution(acc.institution || "");
                          setEditValuationInput(String(acc.balance / 100));
                        }}
                        style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--ink)" }}>
                        <Pencil size={12} />
                        <span>Edit</span>
                      </button>
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

      {/* 4. ADD CUSTOM ASSET MODAL */}
      {addAssetModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)", zIndex: 10000, display: "grid", placeItems: "center", padding: "16px" }}>
          <section className="panel" style={{ width: "min(500px, 94vw)", padding: "28px", borderRadius: "16px", position: "relative", background: "var(--card)", border: "1px solid var(--line)" }}>
            <button type="button" className="icon-button" style={{ position: "absolute", top: "16px", right: "16px" }} onClick={() => setAddAssetModalOpen(false)}>
              <X size={16} />
            </button>

            <span className="eyebrow" style={{ color: "var(--green)" }}>Asset Holdings</span>
            <h2 style={{ margin: "4px 0 20px", fontSize: "1.3rem" }}>Add Custom Asset / Holding</h2>

            <form onSubmit={handleAddAssetSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Asset Sub-Type *</label>
                <select
                  value={newAssetType}
                  onChange={(e: any) => setNewAssetType(e.target.value)}
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 600 }}>
                  <option value="SAVINGS">💰 Savings / Bank Cash</option>
                  <option value="FIXED_DEPOSIT">🏦 Fixed Deposit (FD / RD)</option>
                  <option value="STOCKS">📈 Stock Market Portfolio</option>
                  <option value="INVESTMENT">📊 Mutual Funds & Investments</option>
                  <option value="EPFO">🏛️ EPFO Provident Fund</option>
                  <option value="CASH">🪙 Gold, Real Estate & Tangible Asset</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Asset / Account Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Physical Gold 24K, BHK Flat Valuation, HDFC Tax Saver FD"
                  value={newAssetName}
                  onChange={(e) => setNewAssetName(e.target.value)}
                  required
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Institution / Storage (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SBI Bank, Zerodha, Home Vault, Self"
                  value={newAssetInstitution}
                  onChange={(e) => setNewAssetInstitution(e.target.value)}
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Current Valuation / Opening Balance (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 250000"
                  value={newAssetValuation}
                  onChange={(e) => setNewAssetValuation(e.target.value)}
                  required
                  style={{ width: "100%", height: "40px", fontSize: "14px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" className="ghost compact" onClick={() => setAddAssetModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={addingAsset} className="primary compact" style={{ minWidth: "120px" }}>
                  {addingAsset ? <Loader2 size={14} className="spin" /> : "Save Asset"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* 5. EDIT ASSET VALUATION MODAL */}
      {editingAsset && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)", zIndex: 10000, display: "grid", placeItems: "center", padding: "16px" }}>
          <section className="panel" style={{ width: "min(480px, 94vw)", padding: "28px", borderRadius: "16px", position: "relative", background: "var(--card)", border: "1px solid var(--line)" }}>
            <button type="button" className="icon-button" style={{ position: "absolute", top: "16px", right: "16px" }} onClick={() => setEditingAsset(null)}>
              <X size={16} />
            </button>

            <span className="eyebrow" style={{ color: "var(--green)" }}>Valuation Calibration</span>
            <h2 style={{ margin: "4px 0 20px", fontSize: "1.3rem" }}>Edit Valuation / Balance</h2>

            <form onSubmit={handleUpdateValuationSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Asset Name</label>
                <input
                  type="text"
                  value={editAssetName}
                  onChange={(e) => setEditAssetName(e.target.value)}
                  required
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Institution / Storage</label>
                <input
                  type="text"
                  value={editAssetInstitution}
                  onChange={(e) => setEditAssetInstitution(e.target.value)}
                  style={{ width: "100%", height: "40px", fontSize: "13px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>Current Asset Valuation / Balance (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editValuationInput}
                  onChange={(e) => setEditValuationInput(e.target.value)}
                  required
                  style={{ width: "100%", height: "40px", fontSize: "14px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--background-alt)", color: "var(--ink)", fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" className="ghost compact" onClick={() => setEditingAsset(null)}>Cancel</button>
                <button type="submit" disabled={updatingValuation} className="primary compact" style={{ minWidth: "120px" }}>
                  {updatingValuation ? <Loader2 size={14} className="spin" /> : "Update Valuation"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
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

function BeautifulCreditCardTile({
  card,
  onVaultClick,
}: {
  card: CardSummary;
  onVaultClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const localLogo = getLocalLogo(card.institution, card.name);
  const domain = getDomainForInstitution(card.institution || card.name);
  const logoUrl = localLogo || `https://logo.clearbit.com/${domain}?size=128`;
  const isOverLimit = card.utilizationPercent >= 100;
  const isHighRisk = card.utilizationPercent > 30;
  const networkClass = cardNetworkClass(card.cardNetwork);
  const maskedNumber = card.cardLast4
    ? `••••  ••••  ••••  ${card.cardLast4}`
    : "••••  ••••  ••••  ••••";

  return (
    <div
      className={`account-card credit-account-card credit-network-${networkClass}`}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        minHeight: "240px",
        padding: "20px",
        borderRadius: "16px",
      }}>
      <div>
        <div className="credit-account-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="credit-account-card-logo" style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.15)" }}>
            {!imgError ? (
              <img
                src={logoUrl}
                alt={card.institution || card.name}
                onError={() => setImgError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <CreditCard size={20} color="#ffffff" />
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.9)" }}>
              {card.cardNetwork || "CARD"}
            </span>
            <button
              type="button"
              onClick={onVaultClick}
              title="View PDF password in Vault"
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "4px 8px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontWeight: 600,
                backdropFilter: "blur(4px)",
              }}>
              <Lock size={12} /> Password
            </button>
          </div>
        </div>

        <strong
          className="credit-account-card-number"
          style={{
            display: "block",
            margin: "12px 0 10px 0",
            fontSize: "1.25rem",
            letterSpacing: "2px",
            fontFamily: "monospace",
            color: "#ffffff",
            textShadow: "0 2px 4px rgba(0,0,0,0.35)",
          }}>
          {maskedNumber}
        </strong>

        {/* Realistic Metallic Golden EMV Chip & Contactless Wave Symbol */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 14px 0" }}>
          <div
            style={{
              width: "34px",
              height: "25px",
              borderRadius: "5px",
              background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #d97706 100%)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow: "inset 0 1px 2px rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.3)",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
            <div style={{ width: "70%", height: "1px", background: "rgba(0,0,0,0.3)" }} />
            <div style={{ height: "70%", width: "1px", background: "rgba(0,0,0,0.3)", position: "absolute" }} />
          </div>

          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" strokeLinecap="round" style={{ transform: "rotate(90deg)" }}>
            <path d="M12 2a10 10 0 0 1 10 10" />
            <path d="M12 6a6 6 0 0 1 6 6" />
            <path d="M12 10a2 2 0 0 1 2 2" />
          </svg>
        </div>

        <div className="credit-account-card-identity" style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
          <div>
            <small style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.7)", display: "block", fontWeight: 700 }}>Card Name</small>
            <strong style={{ fontSize: "13px", color: "#ffffff", fontWeight: 700 }}>{card.name}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <small style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.7)", display: "block", fontWeight: 700 }}>Bank</small>
            <strong style={{ fontSize: "13px", color: "#ffffff", fontWeight: 700 }}>{card.institution || "Bank"}</strong>
          </div>
        </div>
      </div>

      {/* Credit Status & Metrics Footer */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.35)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          padding: "12px 14px",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", marginBottom: "6px" }}>
          <span style={{ color: "rgba(255,255,255,0.9)" }}>Due: <strong style={{ color: card.outstanding > 0 ? "#f87171" : "#ffffff" }}>{money(card.outstanding)}</strong></span>
          <span style={{ color: "rgba(255,255,255,0.9)" }}>Avail: <strong style={{ color: "#4ade80" }}>{money(card.availableCredit)}</strong></span>
          <span style={{ fontWeight: 800, color: isHighRisk ? "#f87171" : "#4ade80" }}>{card.utilizationPercent}% Used</span>
        </div>

        <div style={{ height: "5px", width: "100%", background: "rgba(255,255,255,0.2)", borderRadius: "3px", overflow: "hidden", marginBottom: "10px" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, card.utilizationPercent)}%`,
              background: isOverLimit ? "#ef4444" : isHighRisk ? "#f59e0b" : "#10b981",
              borderRadius: "3px",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {(card.statementDate || card.dueDate) ? (
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>
              {card.statementDate && `Stmt: ${card.statementDate}th`} {card.dueDate && `• Due: ${card.dueDate}th`}
            </span>
          ) : (
            <span />
          )}

          <Link
            href={`/accounts?account=${card.id}`}
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#ffffff",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "rgba(255,255,255,0.2)",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.25)",
            }}>
            View Ledger →
          </Link>
        </div>
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
  const [cardFilter, setCardFilter] = useState<string>("ALL");

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

  const filteredCards = cards.filter((c) => {
    if (cardFilter === "HIGH_UTIL") return c.utilizationPercent > 30;
    if (cardFilter === "DUES_PENDING") return c.outstanding > 0;
    if (cardFilter !== "ALL") {
      const inst = (c.institution || c.name).toLowerCase();
      return inst.includes(cardFilter.toLowerCase());
    }
    return true;
  });

  const cardsWithDues = cards.filter((c) => c.outstanding > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Overview Header & KPIs */}
      <header className="page-header" style={{ marginBottom: "8px" }}>
        <div>
          <span className="eyebrow" style={{ color: "#ef4444" }}>Credit Cards Analytics Hub</span>
          <h1>Credit Cards &amp; Spend Intelligence</h1>
          <p>Real-time credit limits, utilization risk, billing cycles, and merchant outflow.</p>
        </div>
      </header>

      {/* Top Summary Metrics */}
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

      {/* Spending Breakdown & Top Merchants */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        {/* Category Breakdown Panel */}
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: "16px" }}>
            <div>
              <span className="eyebrow">Distribution</span>
              <h2>Overall Spends by Category</h2>
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
            <CreditCardDoughnutChart categories={overallFlow.categories} total={summary.totalOutbound} />
            <div style={{ flex: 1, minWidth: "160px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {overallFlow.categories.length === 0 ? (
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>No outbound category spends logged.</span>
              ) : (
                overallFlow.categories.slice(0, 5).map((cat, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cat.color || "#3b82f6" }} />
                      {cat.name}
                    </span>
                    <strong style={{ color: "var(--ink)" }}>{money(cat.amount)} ({cat.percentage}%)</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Top Merchants Panel */}
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: "16px" }}>
            <div>
              <span className="eyebrow">Recipients</span>
              <h2>Top Merchant Outflows</h2>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {overallFlow.topRecipients.length === 0 ? (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>No merchant data available.</span>
            ) : (
              overallFlow.topRecipients.map((rec, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--background-alt)", borderRadius: "8px", fontSize: "12px" }}>
                  <div>
                    <strong style={{ display: "block", color: "var(--ink)" }}>{rec.name}</strong>
                    <span style={{ color: "var(--muted)", fontSize: "11px" }}>{rec.count} transactions</span>
                  </div>
                  <strong style={{ color: "#ef4444" }}>-{money(rec.amount)}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Credit Cards Directory Panel */}
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <span className="eyebrow" style={{ color: "#ef4444" }}>Cards List</span>
            <h2>Active Credit Cards ({filteredCards.length})</h2>
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`secondary compact ${cardFilter === "ALL" ? "active" : ""}`}
              onClick={() => setCardFilter("ALL")}
              style={{ fontSize: "12px", padding: "4px 12px" }}>
              All ({cards.length})
            </button>
            <button
              type="button"
              className={`secondary compact ${cardFilter === "DUES_PENDING" ? "active" : ""}`}
              onClick={() => setCardFilter("DUES_PENDING")}
              style={{ fontSize: "12px", padding: "4px 12px" }}>
              Dues Pending ({cardsWithDues.length})
            </button>
            <button
              type="button"
              className={`secondary compact ${cardFilter === "HIGH_UTIL" ? "active" : ""}`}
              onClick={() => setCardFilter("HIGH_UTIL")}
              style={{ fontSize: "12px", padding: "4px 12px" }}>
              High Utilization (&gt;30%)
            </button>
          </div>
        </div>

        {filteredCards.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "13px", padding: "20px 0" }}>No credit card accounts match the selected filter.</p>
        ) : (
          <div className="credit-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {filteredCards.map((card) => (
              <BeautifulCreditCardTile
                key={card.id}
                card={card}
                onVaultClick={() => setVaultAccount(card)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Monthly Flow Chart Panel */}
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: "16px" }}>
          <div>
            <span className="eyebrow">Cash Flow Analysis</span>
            <h2>Monthly Credit Card Flow (Spends vs Payments)</h2>
          </div>
        </div>

        {data.monthlySpendsAndPayments.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "13px" }}>No recent credit card transactions logged.</p>
        ) : (
          <div style={{ marginTop: "16px" }}>
            {data.monthlySpendsAndPayments.map((item) => (
              <div key={item.month} style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600 }}>{item.month}</span>
                  <span>
                    <span style={{ color: "#ef4444", marginRight: "12px" }}>Spends: -{money(item.spends)}</span>
                    <span style={{ color: "var(--green)" }}>Payments: +{money(item.payments)}</span>
                  </span>
                </div>
                <div style={{ display: "flex", height: "8px", gap: "4px", borderRadius: "4px", overflow: "hidden", background: "var(--background-alt)" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (item.spends / (item.spends + item.payments || 1)) * 100)}%`, background: "#ef4444", borderRadius: "4px" }} />
                  <div style={{ height: "100%", width: `${Math.min(100, (item.payments / (item.spends + item.payments || 1)) * 100)}%`, background: "var(--green)", borderRadius: "4px" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Table */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <span className="eyebrow">Recent Feed</span>
            <h2>Recent Credit Card Activity</h2>
          </div>
          <Link href="/transactions?mode=CREDIT_CARD" style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>
            View All Credit Card Transactions →
          </Link>
        </div>

        {data.recentTransactions.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "13px" }}>No transactions logged for credit cards.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                  <th style={{ padding: "10px", color: "var(--muted)" }}>Date</th>
                  <th style={{ padding: "10px", color: "var(--muted)" }}>Card</th>
                  <th style={{ padding: "10px", color: "var(--muted)" }}>Description</th>
                  <th style={{ padding: "10px", color: "var(--muted)" }}>Category</th>
                  <th style={{ padding: "10px", color: "var(--muted)", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                      {new Date(tx.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td style={{ padding: "10px", fontWeight: 600 }}>{tx.accountName}</td>
                    <td style={{ padding: "10px" }}>{tx.description}</td>
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: "var(--background-alt)",
                          color: tx.categoryColor,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: tx.categoryColor }} />
                        {tx.category}
                      </span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: tx.amount < 0 ? "#ef4444" : "var(--green)" }}>
                      {tx.amount < 0 ? `-${money(Math.abs(tx.amount))}` : `+${money(tx.amount)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vault Password Modal */}
      {vaultAccount && (
        <VaultModal
          accountId={vaultAccount.id}
          onClose={() => {
            setVaultAccount(null);
            loadData();
          }}
        />
      )}
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
