'use client';
import { BriefcaseBusiness, Plus, TrendingDown, TrendingUp, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';

type Holding = { id: string; asset: string; symbol: string; isin: string | null; sector: string | null; assetType: string;
  quantity: string; availableQuantity: string; discrepantQuantity: string; longTermQuantity: string | null; pledgedQuantity: string;
  averagePrice: number; previousClosingPrice: number | null; currentValue: number | null; unrealizedPnl: number | null; asOfDate: string };
type PortfolioAccount = { accountId: string; name: string; institution: string | null; investedValue: number; currentValue: number;
  unrealizedPnl: number; holdings: Holding[] };

const quantity = (value: string) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value));
const price = (minor: number | null) => minor === null ? '—' : new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(minor / 100);

export default function InvestmentsPage() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setPortfolio(await api<PortfolioAccount[]>('/investments/portfolio')); }
    catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load holdings.'));
    } finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <Shell><div className="loading"><span/><p>Loading your portfolio…</p></div></Shell>;

  const totals = portfolio.reduce((summary, account) => ({ invested: summary.invested + account.investedValue,
    current: summary.current + account.currentValue, pnl: summary.pnl + account.unrealizedPnl }), { invested: 0, current: 0, pnl: 0 });
  const importedHoldings = portfolio.reduce((sum, account) => sum + account.holdings.length, 0);

  return <Shell><header className="page-header"><div><span className="eyebrow">Investments</span><h1>Your holdings</h1><p>Verified position, quantity, cost, value, and unrealized-result history from your latest broker snapshot.</p></div>
    <div className="page-actions">{!portfolio.length && <Link className="secondary" href="/dashboard"><Plus/>Add stock account</Link>}
      <Link className="primary" href="/import?kind=BROKER_HOLDINGS&source=ZERODHA_KITE"><Upload/>Import holdings</Link></div></header>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="portfolio-summary">
      <article><small>Invested</small><strong>{money(totals.invested)}</strong><span>Across {importedHoldings} imported holding{importedHoldings === 1 ? '' : 's'}</span></article>
      <article><small>Portfolio value</small><strong>{money(totals.current)}</strong><span>{importedHoldings ? 'At previous close from the latest report' : 'Using your manually entered account values'}</span></article>
      <article className={totals.pnl < 0 ? 'loss' : 'gain'}><small>Unrealized P&amp;L</small><strong>{money(totals.pnl)}</strong><span>{totals.pnl < 0 ? <TrendingDown/> : <TrendingUp/>}{totals.invested ? `${(totals.pnl / totals.invested * 100).toFixed(2)}%` : 'No imported cost basis'}</span></article>
    </section>
    <section className="portfolio-accounts">{portfolio.map((account) => <article className="panel portfolio-account" key={account.accountId}><header><div><span className="eyebrow">{account.institution || 'Investment account'}</span><h2>{account.name}</h2></div>
      <div><span><small>Holdings</small><strong>{account.holdings.length}</strong></span><span><small>Value</small><strong>{money(account.currentValue)}</strong></span>
        <span className={account.unrealizedPnl < 0 ? 'loss' : 'gain'}><small>Unrealized</small><strong>{money(account.unrealizedPnl)}</strong></span></div></header>
      {account.holdings.length ? <div className="holdings-scroll"><table className="holdings-table"><thead><tr><th>Instrument</th><th>Quantity detail</th><th>Avg. cost</th><th>Previous close</th><th>Value</th><th>Unrealized P&amp;L</th></tr></thead><tbody>
        {account.holdings.map((holding) => { const pnl = holding.unrealizedPnl ?? 0; const invested = Number(holding.quantity) * holding.averagePrice; return <tr key={holding.id}><td><strong>{holding.symbol}</strong><span>{holding.sector || holding.assetType.replace('_', ' ')}</span><small>{holding.isin || 'ISIN unavailable'}</small></td>
          <td><strong>{quantity(holding.quantity)}</strong><span>{quantity(holding.availableQuantity)} available{Number(holding.pledgedQuantity) ? ` · ${quantity(holding.pledgedQuantity)} pledged` : ''}</span>{Number(holding.discrepantQuantity) > 0 && <small className="warning">{quantity(holding.discrepantQuantity)} discrepant</small>}</td>
          <td>{price(holding.averagePrice)}</td><td>{price(holding.previousClosingPrice)}</td><td><strong>{holding.currentValue === null ? '—' : money(holding.currentValue)}</strong></td>
          <td className={pnl < 0 ? 'loss' : 'gain'}><strong>{money(pnl)}</strong><span>{invested ? `${(pnl / invested * 100).toFixed(2)}%` : '—'}</span></td></tr>; })}</tbody></table></div>
        : <div className="portfolio-empty"><BriefcaseBusiness/><strong>No holdings imported</strong><p>Use Import records to validate a Zerodha holdings snapshot for this account.</p>
          <Link className="secondary compact" href={`/import?kind=BROKER_HOLDINGS&source=ZERODHA_KITE&accountId=${encodeURIComponent(account.accountId)}`}>Import snapshot</Link></div>}
      {account.holdings[0] && <footer>Snapshot imported {new Date(account.holdings[0].asOfDate).toLocaleString('en-IN')}</footer>}</article>)}</section>
    {!portfolio.length && <section className="unified-empty panel"><BriefcaseBusiness/><strong>No investment account yet</strong><p>Add a Zerodha stock account, then import its holdings through the unified workspace.</p></section>}
  </Shell>;
}
