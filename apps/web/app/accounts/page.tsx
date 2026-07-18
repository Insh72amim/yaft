'use client';
import { BriefcaseBusiness, Plus, Upload, Landmark, CreditCard, BadgeIndianRupee, Building2, PiggyBank, ChartPie, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, Suspense } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';
import { AccountTransactions } from '@/components/account-transactions';

type Holding = { id: string; asset: string; symbol: string; isin: string | null; sector: string | null; assetType: string;
  quantity: string; availableQuantity: string; discrepantQuantity: string; longTermQuantity: string | null; pledgedQuantity: string;
  averagePrice: number; previousClosingPrice: number | null; currentValue: number | null; unrealizedPnl: number | null; asOfDate: string };
type PortfolioAccount = { accountId: string; name: string; institution: string | null; investedValue: number; currentValue: number;
  unrealizedPnl: number; holdings: Holding[] };
type Account = { id: string; name: string; type: string; institution: string | null; balance: number; creditLimit: number | null; dueDay: number | null };

const quantity = (value: string) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value));
const price = (minor: number | null) => minor === null ? '—' : new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(minor / 100);

const accountSections = [
  { label: 'Bank accounts', types: ['SAVINGS', 'FIXED_DEPOSIT', 'BANK'] },
  { label: 'Credit cards', types: ['CREDIT_CARD'] },
  { label: 'Loan accounts', types: ['LOAN'] },
  { label: 'Investments', types: ['STOCKS', 'INVESTMENT'] },
  { label: 'EPFO accounts', types: ['EPFO'] },
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

function PortfolioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [portfolio, setPortfolio] = useState<PortfolioAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const selectedAccountId = searchParams.get('account');

  const load = useCallback(async () => {
    try {
      const [portfolioRes, accountsRes] = await Promise.all([
        api<PortfolioAccount[]>('/investments/portfolio'),
        api<Account[]>('/accounts')
      ]);
      setPortfolio(portfolioRes);
      setAccounts(accountsRes);
      
      if (!searchParams.get('account') && accountsRes.length > 0) {
        router.replace(`/accounts?account=${accountsRes[0].id}`);
      }
    }
    catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load your accounts.'));
    } finally { setLoading(false); }
  }, [router, searchParams]);
  
  useEffect(() => { void load(); }, [load]);
  
  if (loading) return <Shell><div className="loading"><span/><p>Loading your portfolio…</p></div></Shell>;

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const isInvestment = selectedAccount && ['STOCKS', 'INVESTMENT'].includes(selectedAccount.type);
  const portfolioData = isInvestment ? portfolio.find(p => p.accountId === selectedAccountId) : null;

  return <Shell>
    <header className="page-header">
      <div><span className="eyebrow">Portfolio & Accounts</span><h1>Your finances</h1><p>View your balances, holdings, and ledgers in one place.</p></div>
      <div className="page-actions">
        <Link className="secondary" href="/dashboard"><Plus/>Add account</Link>
        <Link className="primary" href="/import"><Upload/>Import statement</Link>
      </div>
    </header>
    {error && <p className="error" role="alert">{error}</p>}
    
    <div className="portfolio-layout">
      <aside className="portfolio-sidebar panel">
        {accountSections.map((section) => {
          const sectionAccounts = accounts.filter((account) => section.types.includes(account.type));
          if (!sectionAccounts.length) return null;
          return <div className="portfolio-sidebar-group" key={section.label}>
            <header><strong>{section.label}</strong></header>
            <div className="portfolio-sidebar-list">
              {sectionAccounts.map((account) => (
                <button 
                  key={account.id} 
                  className={`portfolio-sidebar-item ${selectedAccountId === account.id ? 'active' : ''}`}
                  onClick={() => router.push(`/accounts?account=${account.id}`)}
                >
                  <span className={`account-icon ${account.type.toLowerCase()}`}>{getIcon(account.type)}</span>
                  <div className="portfolio-sidebar-item-info">
                    <strong>{account.name}</strong>
                    <small>{money(account.balance)}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>;
        })}
      </aside>
      
      <main className="portfolio-content">
        {!selectedAccountId ? (
          <div className="portfolio-empty">
            <Landmark size={48} strokeWidth={1} />
            <strong>Select an account</strong>
            <p>Choose an account from the sidebar to view its details.</p>
          </div>
        ) : isInvestment ? (
          <div className="panel portfolio-account">
            <header>
              <div><span className="eyebrow">{selectedAccount.institution || 'Investment account'}</span><h2>{selectedAccount?.name}</h2></div>
              {portfolioData && (
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <span><small>Holdings</small><strong>{portfolioData.holdings.length}</strong></span>
                    <span><small>Value</small><strong>{money(portfolioData.currentValue)}</strong></span>
                    <span className={portfolioData.unrealizedPnl < 0 ? 'loss' : 'gain'}><small>Unrealized</small><strong>{money(portfolioData.unrealizedPnl)}</strong></span>
                  </div>
                  <Link className="secondary compact" href={`/import?kind=BROKER_HOLDINGS&accountId=${encodeURIComponent(selectedAccountId)}`}><Upload size={14}/>Import snapshot</Link>
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
          </div>
        ) : (
          <AccountTransactions accountId={selectedAccountId} embedded={true} />
        )}
      </main>
    </div>
  </Shell>;
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<Shell><div className="loading"><span/><p>Loading your portfolio…</p></div></Shell>}>
      <PortfolioContent />
    </Suspense>
  );
}
