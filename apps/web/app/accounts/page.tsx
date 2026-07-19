'use client';
import { BriefcaseBusiness, Plus, Upload, Landmark, CreditCard, BadgeIndianRupee, Building2, PiggyBank, ChartPie, TrendingUp, ChevronLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, Suspense } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';
import { AccountTransactions } from '@/components/account-transactions';
import { AddAccountModal } from '@/components/add-account-modal';
import { VaultModal } from '@/components/vault-modal';
import { LoanSchedule } from '@/components/loan-schedule';

type Holding = { id: string; asset: string; symbol: string; isin: string | null; sector: string | null; assetType: string;
  quantity: string; availableQuantity: string; discrepantQuantity: string; longTermQuantity: string | null; pledgedQuantity: string;
  averagePrice: number; previousClosingPrice: number | null; currentValue: number | null; unrealizedPnl: number | null; asOfDate: string };
type PortfolioAccount = { accountId: string; name: string; institution: string | null; investedValue: number; currentValue: number;
  unrealizedPnl: number; holdings: Holding[] };
type Account = { id: string; name: string; type: string; institution: string | null; balance: number; creditLimit: number | null; dueDay: number | null; monthlyCredited: number; monthlyDebited: number;
  loanOutstanding?: number; nextEmiDate?: string; nextEmiAmount?: number; paidInstallments?: number; totalInstallments?: number };

const quantity = (value: string) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value));
const price = (minor: number | null) => minor === null ? '—' : new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(minor / 100);

type AccountSection = 
  | { label: string; types: string[] }
  | { label: string; subsections: { label: string; types: string[] }[] };

const accountSections: AccountSection[] = [
  { label: 'Savings accounts', types: ['SAVINGS', 'BANK'] },
  {
    label: 'Investments',
    subsections: [
      { label: 'Fixed & recurring deposits', types: ['FIXED_DEPOSIT'] },
      { label: 'Stock market', types: ['STOCKS'] },
      { label: 'EPFO', types: ['EPFO'] },
      { label: 'Other investments', types: ['INVESTMENT'] },
    ]
  },
  { label: 'Debt Accounts', types: ['CREDIT_CARD', 'LOAN'] },
];

function getIcon(type: string) {
  if (type === 'CREDIT_CARD') return <CreditCard size={16} />;
  if (type === 'INVESTMENT') return <ChartPie size={16} />;
  if (type === 'STOCKS') return <TrendingUp size={16} />;
  if (type === 'EPFO') return <Building2 size={16} />;
  if (type === 'LOAN') return <BadgeIndianRupee size={16} />;
  if (type === 'SAVINGS') return <PiggyBank size={16} />;
  return <Landmark size={16} />;
}

function getDomainForInstitution(name: string | null) {
  if (!name) return 'bank.com';
  const n = name.toLowerCase();
  if (n.includes('zerodha')) return 'zerodha.com';
  if (n.includes('groww')) return 'groww.in';
  if (n.includes('upstox')) return 'upstox.com';
  if (n.includes('hdfc')) return 'hdfcbank.com';
  if (n.includes('icici')) return 'icicibank.com';
  if (n.includes('sbi') || n.includes('state bank')) return 'onlinesbi.sbi';
  if (n.includes('axis')) return 'axisbank.com';
  if (n.includes('pnb') || n.includes('punjab')) return 'pnbindia.in';
  if (n.includes('kotak')) return 'kotak.com';
  if (n.includes('idfc')) return 'idfcfirstbank.com';
  if (n.includes('indusind')) return 'indusind.com';
  if (n.includes('amazon') || n.includes('aplus')) return 'amazon.in';
  if (n.includes('cred')) return 'cred.club';
  if (n.includes('epfo') || n.includes('pf')) return 'epfindia.gov.in';
  return 'bank.com';
}

function AccountCard({ account, onClick }: { account: Account, onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const domain = getDomainForInstitution(account.institution || account.name);
  const logoUrl = `https://logo.clearbit.com/${domain}?size=128`;
  const isLoan = account.type === 'LOAN';

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
            <span className={`account-icon ${account.type.toLowerCase()}`}>{getIcon(account.type)}</span>
          )}
        </div>
        <div className="account-card-title">
          <strong>{account.name}</strong>
          <small>{account.institution || 'Unknown institution'}</small>
        </div>
      </div>
      <div className="account-card-body">
        <div className="account-card-balance">
          <small>{isLoan ? 'Outstanding Principal' : 'Current Balance'}</small>
          <strong>{money(isLoan && account.loanOutstanding !== undefined ? account.loanOutstanding : account.balance)}</strong>
        </div>
        {isLoan && account.totalInstallments !== undefined ? (
          <div className="loan-card-progress">
            <div className="loan-progress-label">
              <small>{account.paidInstallments} of {account.totalInstallments} EMIs paid</small>
              {account.nextEmiDate && (
                <span className="next-emi-tag">Next: {new Date(account.nextEmiDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
              )}
            </div>
            <div className="loan-progress-bar">
              <div 
                className="loan-progress-fill" 
                style={{ width: `${(account.paidInstallments || 0) / (account.totalInstallments || 1) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="account-card-flows">
            <div className="flow-in">
              <small>Month In</small>
              <span>{money(account.monthlyCredited || 0)}</span>
            </div>
            <div className="flow-out">
              <small>Month Out</small>
              <span>{money(account.monthlyDebited || 0)}</span>
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

function PortfolioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [portfolio, setPortfolio] = useState<PortfolioAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);
  
  const [showVaultForInvestment, setShowVaultForInvestment] = useState<string | null>(null);

  const selectedAccountId = searchParams.get('account');

  const load = useCallback(async () => {
    try {
      const [portfolioRes, accountsRes] = await Promise.all([
        api<PortfolioAccount[]>('/investments/portfolio'),
        api<Account[]>('/accounts')
      ]);
      setPortfolio(portfolioRes);
      setAccounts(accountsRes);
    }
    catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load your accounts.'));
    } finally { setLoading(false); }
  }, [router]);
  
  useEffect(() => { void load(); }, [load]);
  
  if (loading) return <Shell><div className="loading"><span/><p>Loading your portfolio…</p></div></Shell>;

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const isInvestment = selectedAccount && ['STOCKS', 'INVESTMENT'].includes(selectedAccount.type);
  const portfolioData = isInvestment ? portfolio.find(p => p.accountId === selectedAccountId) : null;

  if (selectedAccountId && selectedAccount) {
    // Full Page Detail View
    return (
      <Shell>
        <header className="page-header">
          <div>
            <Link href="/accounts" className="back-link"><ChevronLeft size={16} /> Back to all accounts</Link>
            <span className="eyebrow">{selectedAccount.institution || 'Account Details'}</span>
            <h1>{selectedAccount.name}</h1>
          </div>
        </header>
        {isInvestment ? (
          <div className="panel portfolio-account">
            <header>
              <div><span className="eyebrow">Portfolio</span><h2>Holdings</h2></div>
              {portfolioData && (
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <span><small>Holdings</small><strong>{portfolioData.holdings.length}</strong></span>
                    <span><small>Value</small><strong>{money(portfolioData.currentValue)}</strong></span>
                    <span className={portfolioData.unrealizedPnl < 0 ? 'loss' : 'gain'}><small>Unrealized</small><strong>{money(portfolioData.unrealizedPnl)}</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="secondary compact" onClick={() => setShowVaultForInvestment(selectedAccountId)}>
                      <Lock size={14}/>Credentials
                    </button>
                    <Link className="secondary compact" href={`/import?kind=BROKER_HOLDINGS&accountId=${encodeURIComponent(selectedAccountId)}`}><Upload size={14}/>Import snapshot</Link>
                  </div>
                </div>
              )}
            </header>
            {portfolioData?.holdings.length ? (
              <div className="holdings-scroll">
                <table className="holdings-table">
                  <thead><tr><th>Instrument</th><th>Quantity detail</th><th>Avg. cost</th><th>Previous close</th><th>Value</th><th>Unrealized P&amp;L</th></tr></thead>
                  <tbody>
                    {portfolioData.holdings.map((holding) => { 
                      const pnl = holding.unrealizedPnl ?? 0; 
                      const invested = Number(holding.quantity) * holding.averagePrice; 
                      return <tr key={holding.id}>
                        <td><strong>{holding.symbol}</strong><span>{holding.sector || holding.assetType.replace('_', ' ')}</span><small>{holding.isin || 'ISIN unavailable'}</small></td>
                        <td><strong>{quantity(holding.quantity)}</strong><span>{quantity(holding.availableQuantity)} available{Number(holding.pledgedQuantity) ? ` · ${quantity(holding.pledgedQuantity)} pledged` : ''}</span>{Number(holding.discrepantQuantity) > 0 && <small className="warning">{quantity(holding.discrepantQuantity)} discrepant</small>}</td>
                        <td>{price(holding.averagePrice)}</td><td>{price(holding.previousClosingPrice)}</td><td><strong>{holding.currentValue === null ? '—' : money(holding.currentValue)}</strong></td>
                        <td className={pnl < 0 ? 'loss' : 'gain'}><strong>{money(pnl)}</strong><span>{invested ? `${(pnl / invested * 100).toFixed(2)}%` : '—'}</span></td>
                      </tr>; 
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="portfolio-empty"><BriefcaseBusiness size={48} strokeWidth={1} /><strong>No holdings imported</strong><p>Use Import records to validate a broker holdings snapshot for this account.</p>
                <Link className="secondary compact" href={`/import?kind=BROKER_HOLDINGS&accountId=${encodeURIComponent(selectedAccountId)}`}>Import snapshot</Link>
              </div>
            )}
            {portfolioData?.holdings[0] && <footer>Snapshot imported {new Date(portfolioData.holdings[0].asOfDate).toLocaleString('en-IN')}</footer>}
            {showVaultForInvestment && <VaultModal accountId={showVaultForInvestment} onClose={() => setShowVaultForInvestment(null)} />}
          </div>
        ) : selectedAccount.type === 'LOAN' ? (
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
      <header className="page-header">
        <div>
          <span className="eyebrow">Portfolio & Accounts</span>
          <h1>My accounts</h1>
          <p>View your balances, holdings, and ledgers in one place.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" onClick={() => setAddingAccount(true)}><Plus size={17} />Add account</button>
          <Link className="primary" href="/import"><Upload size={17} />Import statement</Link>
        </div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      
      <div className="accounts-overview">
        {accountSections.map((section) => {
          if ('subsections' in section) {
            const allTypes = section.subsections.flatMap(sub => sub.types);
            const sectionAccounts = accounts.filter((account) => allTypes.includes(account.type));
            if (!sectionAccounts.length) return null;
            return (
              <div className="accounts-section" key={section.label}>
                <header className="accounts-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
                  <h2 style={{ margin: 0 }}>{section.label}</h2>
                  <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>{money(sectionAccounts.reduce((sum, account) => sum + account.balance, 0))}</span>
                </header>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingLeft: '8px' }}>
                  {section.subsections.map((sub) => {
                    const subAccounts = accounts.filter((account) => sub.types.includes(account.type));
                    if (!subAccounts.length) return null;
                    return (
                      <div key={sub.label} className="accounts-subsection">
                        <header className="accounts-subsection-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{sub.label}</h3>
                          <span style={{ fontSize: '13px', fontWeight: 550, color: 'var(--muted)' }}>{money(subAccounts.reduce((sum, account) => sum + account.balance, 0))}</span>
                        </header>
                        <div className="account-cards-grid">
                          {subAccounts.map((account) => (
                            <AccountCard 
                              key={account.id} 
                              account={account} 
                              onClick={() => router.push(`/accounts?account=${account.id}`)} 
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          } else {
            const sectionAccounts = accounts.filter((account) => section.types.includes(account.type));
            if (!sectionAccounts.length) return null;
            return (
              <div className="accounts-section" key={section.label}>
                <header className="accounts-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0 }}>{section.label}</h2>
                  <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>{money(sectionAccounts.reduce((sum, account) => sum + account.balance, 0))}</span>
                </header>
                <div className="account-cards-grid">
                  {sectionAccounts.map((account) => (
                    <AccountCard 
                      key={account.id} 
                      account={account} 
                      onClick={() => router.push(`/accounts?account=${account.id}`)} 
                    />
                  ))}
                </div>
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
          onSuccess={() => { void load(); }} 
        />
      )}
    </Shell>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<Shell><div className="loading"><span/><p>Loading your accounts…</p></div></Shell>}>
      <PortfolioContent />
    </Suspense>
  );
}
