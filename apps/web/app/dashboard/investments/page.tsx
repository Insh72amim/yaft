'use client';
import { AlertTriangle, BriefcaseBusiness, FileSpreadsheet, Plus, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';

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

const quantity = (value: string) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value));
const price = (minor: number | null) => minor === null ? '—' : new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(minor / 100);
const supportsZerodhaImport = (account: PortfolioAccount) => !account.institution || /zerodha|kite/i.test(account.institution);

export default function InvestmentsPage() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<File>();
  const [fileKey, setFileKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try {
      const items = await api<PortfolioAccount[]>('/investments/portfolio');
      setPortfolio(items);
      setAccountId((current) => items.some((item) => item.accountId === current && supportsZerodhaImport(item))
        ? current : items.find(supportsZerodhaImport)?.accountId ?? '');
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load holdings.'));
    } finally { setLoading(false); }
  }, [router]);
  useEffect(() => { load(); }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !accountId) return;
    setBusy(true); setError(''); setNotice('');
    const payload = new FormData(); payload.set('holdings', file);
    try {
      const result = await api<{ imported: number }>(`/investments/${accountId}/zerodha-holdings`, { method: 'POST', body: payload });
      setNotice(`${result.imported} Zerodha holding${result.imported === 1 ? '' : 's'} imported after full reconciliation.`);
      setFile(undefined); setFileKey((value) => value + 1);
      await load();
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'The Zerodha holdings import failed.'));
    } finally { setBusy(false); }
  }

  if (loading) return <Shell><div className="loading"><span/><p>Loading your portfolio…</p></div></Shell>;
  const totals = portfolio.reduce((summary, account) => ({ invested: summary.invested + account.investedValue,
    current: summary.current + account.currentValue, pnl: summary.pnl + account.unrealizedPnl }), { invested: 0, current: 0, pnl: 0 });
  const importedHoldings = portfolio.reduce((sum, account) => sum + account.holdings.length, 0);

  return <Shell><header className="page-header"><div><span className="eyebrow">Investments</span><h1>Your holdings</h1><p>Import a verified Zerodha snapshot to see every position, quantity bucket, cost, value, and unrealized result.</p></div>{!portfolio.length && <Link className="secondary" href="/dashboard"><Plus/>Add stock account</Link>}</header>
    <section className="portfolio-summary">
      <article><small>Invested</small><strong>{money(totals.invested)}</strong><span>Across {importedHoldings} imported holding{importedHoldings === 1 ? '' : 's'}</span></article>
      <article><small>Portfolio value</small><strong>{money(totals.current)}</strong><span>{importedHoldings ? 'At previous close from the latest report' : 'Using your manually entered account values'}</span></article>
      <article className={totals.pnl < 0 ? 'loss' : 'gain'}><small>Unrealized P&amp;L</small><strong>{money(totals.pnl)}</strong><span>{totals.pnl < 0 ? <TrendingDown/> : <TrendingUp/>}{totals.invested ? `${(totals.pnl / totals.invested * 100).toFixed(2)}%` : 'No imported cost basis'}</span></article>
    </section>

    <section className="portfolio-import panel"><form onSubmit={upload}><div><span className="eyebrow">Snapshot import</span><h2>Refresh from Zerodha</h2><p>Use the XLSX holdings report downloaded from Zerodha Console. It replaces this account’s previous snapshot only after every row and printed total reconciles.</p></div>
      <label>Destination stock account<select value={accountId} required onChange={(event) => setAccountId(event.target.value)}><option value="" disabled>Choose an account</option>{portfolio.filter(supportsZerodhaImport).map((account) => <option value={account.accountId} key={account.accountId}>{account.name}{account.institution ? ` · ${account.institution}` : ''}</option>)}</select></label>
      <label className={`portfolio-dropzone ${file ? 'has-file' : ''}`}><input key={fileKey} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required onChange={(event) => { setFile(event.target.files?.[0]); setError(''); setNotice(''); }}/>{file ? <><FileSpreadsheet/><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB · ready to reconcile</span></> : <><UploadCloud/><strong>Choose Zerodha holdings XLSX</strong><span>Maximum 5 MB · the source file is never retained</span></>}</label>
      {!portfolio.some(supportsZerodhaImport) && <p className="notice"><AlertTriangle/>Create a Zerodha <Link href="/dashboard">stock account</Link> before importing holdings.</p>}
      {error && <p className="error">{error}</p>}{notice && <p className="success-note"><ShieldCheck/>{notice}</p>}
      <button className="primary wide" disabled={busy || !file || !accountId}>{busy ? <><RefreshCw className="spin"/>Reconciling…</> : <><BriefcaseBusiness/>Import verified snapshot</>}</button>
    </form><aside><ShieldCheck/><strong>Fail-closed import</strong><p>Unknown sheets, changed columns, malformed quantities, duplicate symbols, invalid ISINs, P&amp;L mismatches, and portfolio-total mismatches are rejected before the database changes.</p></aside></section>

    <section className="portfolio-accounts">{portfolio.map((account) => <article className="panel portfolio-account" key={account.accountId}><header><div><span className="eyebrow">{account.institution || 'Investment account'}</span><h2>{account.name}</h2></div><div><span><small>Holdings</small><strong>{account.holdings.length}</strong></span><span><small>Value</small><strong>{money(account.currentValue)}</strong></span><span className={account.unrealizedPnl < 0 ? 'loss' : 'gain'}><small>Unrealized</small><strong>{money(account.unrealizedPnl)}</strong></span></div></header>
      {account.holdings.length ? <div className="holdings-scroll"><table className="holdings-table"><thead><tr><th>Instrument</th><th>Quantity detail</th><th>Avg. cost</th><th>Previous close</th><th>Value</th><th>Unrealized P&amp;L</th></tr></thead><tbody>{account.holdings.map((holding) => { const pnl = holding.unrealizedPnl ?? 0; const invested = Number(holding.quantity) * holding.averagePrice; return <tr key={holding.id}><td><strong>{holding.symbol}</strong><span>{holding.sector || holding.assetType.replace('_', ' ')}</span><small>{holding.isin || 'ISIN unavailable'}</small></td><td><strong>{quantity(holding.quantity)}</strong><span>{quantity(holding.availableQuantity)} available{Number(holding.pledgedQuantity) ? ` · ${quantity(holding.pledgedQuantity)} pledged` : ''}</span>{Number(holding.discrepantQuantity) > 0 && <small className="warning">{quantity(holding.discrepantQuantity)} discrepant</small>}</td><td>{price(holding.averagePrice)}</td><td>{price(holding.previousClosingPrice)}</td><td><strong>{holding.currentValue === null ? '—' : money(holding.currentValue)}</strong></td><td className={pnl < 0 ? 'loss' : 'gain'}><strong>{money(pnl)}</strong><span>{invested ? `${(pnl / invested * 100).toFixed(2)}%` : '—'}</span></td></tr>; })}</tbody></table></div> : <div className="portfolio-empty"><BriefcaseBusiness/><strong>No holdings imported</strong><p>Select this account above and import its Zerodha holdings report.</p></div>}
      {account.holdings[0] && <footer>Snapshot imported {new Date(account.holdings[0].asOfDate).toLocaleString('en-IN')}</footer>}</article>)}</section>
  </Shell>;
}
