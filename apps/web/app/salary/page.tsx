'use client';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, BadgeIndianRupee, Building2, FileText, ShieldCheck, Upload, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';

type SalaryStatement = { id: string; payPeriod: string; employer: string; grossEarnings: number; grossDeductions: number; netPay: number };
type SalaryTimelinePoint = { month: string; grossEarnings: number; netPay: number; tax: number; cumulativeGross: number; cumulativeTax: number };
type SalaryOverview = { summary: { statementCount: number; totalGross: number; totalDeductions: number; totalNet: number;
  employeePf: number; employerPf: number; taxes: number; latestNetPay: number }; timeline: SalaryTimelinePoint[]; statements: SalaryStatement[] };

export default function SalaryPage() {
  const router = useRouter();
  const [data, setData] = useState<SalaryOverview>();
  const [activeTab, setActiveTab] = useState<'statements' | 'timeline'>('statements');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData(await api<SalaryOverview>('/salary-statements')); }
    catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not load your salary history.'));
    }
  }, [router]);
  useEffect(() => { void load(); }, [load]);
  if (!data) return <Shell><div className="loading"><span/><p>{error || 'Preparing your salary history…'}</p></div></Shell>;

  return <Shell><header className="page-header"><div><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>Overview</Link>
    <span className="eyebrow">Income records</span><h1>Salary statements</h1><p>Your verified, cumulative view of earnings, deductions, tax, and provident fund.</p></div>
    <Link className="primary" href="/import?kind=SALARY_PAYSLIP&source=GOLDMAN_SACHS"><Upload/>Import payslip</Link></header>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="salary-tabs" role="tablist" aria-label="Salary views"><button role="tab" aria-selected={activeTab === 'statements'} className={activeTab === 'statements' ? 'active' : ''} onClick={() => setActiveTab('statements')}><FileText/>Statements</button><button role="tab" aria-selected={activeTab === 'timeline'} className={activeTab === 'timeline' ? 'active' : ''} onClick={() => setActiveTab('timeline')}><ArrowUpRight/>Earnings &amp; tax timeline</button></div>
    {activeTab === 'statements' ? <>
      <section className="salary-summary">
        <article><span className="summary-icon income"><WalletCards/></span><small>Latest net pay</small><strong>{money(data.summary.latestNetPay)}</strong><em>{data.summary.statementCount} verified statement{data.summary.statementCount === 1 ? '' : 's'}</em></article>
        <article><span className="summary-icon saved"><ArrowUpRight/></span><small>Cumulative gross</small><strong>{money(data.summary.totalGross)}</strong><em>Across imported months</em></article>
        <article><span className="summary-icon expense"><ArrowDownRight/></span><small>Tax deducted</small><strong>{money(data.summary.taxes)}</strong><em>Income + professional tax</em></article>
        <article><span className="summary-icon epfo"><Building2/></span><small>Total PF additions</small><strong>{money(data.summary.employeePf + data.summary.employerPf)}</strong><em>Employee + employer share</em></article>
      </section>
      <section className="panel salary-history salary-history-wide"><div className="panel-title"><div><span className="eyebrow">Verified payroll record</span><h2>Salary history</h2></div>
        <Link className="secondary compact" href="/import?kind=SALARY_PAYSLIP&source=GOLDMAN_SACHS"><Upload/>Unified importer</Link></div>
        {data.statements.length ? <div className="salary-history-list">{data.statements.map((statement) => <article key={statement.id}><time>{new Date(statement.payPeriod).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</time>
          <div><strong>{statement.employer}</strong><small>Gross {money(statement.grossEarnings)} · deductions {money(statement.grossDeductions)}</small></div><b>{money(statement.netPay)}</b></article>)}</div>
          : <div className="salary-empty"><BadgeIndianRupee/><strong>No verified salary months yet</strong><p>Use Import records to validate and review your first payslip.</p>
            <Link className="primary" href="/import?kind=SALARY_PAYSLIP&source=GOLDMAN_SACHS">Import first payslip</Link></div>}
      </section>
    </> : <SalaryTimeline points={data.timeline}/>}
  </Shell>;
}

function SalaryTimeline({ points }: { points: SalaryTimelinePoint[] }) {
  if (!points.length) return <section className="panel salary-timeline-empty"><ArrowUpRight/><strong>No timeline yet</strong><p>Approve your first salary statement to plot monthly and cumulative earnings and tax.</p></section>;
  const latest = points[points.length - 1];
  return <>
    <section className="salary-timeline-hero"><div><span className="eyebrow">Verified salary journey</span><h2>{points.length} month{points.length === 1 ? '' : 's'} on your timeline</h2><p>Gross earnings and tax are grouped by payslip month. Multiple employers in one month are combined.</p></div><div><span><small>Total gross earned</small><strong>{money(latest.cumulativeGross)}</strong></span><span><small>Total tax deducted</small><strong>{money(latest.cumulativeTax)}</strong></span></div></section>
    <section className="salary-timeline-grid">
      <TimelineChart title="Monthly gross earnings" description="Gross pay recorded in each verified month" points={points.map((point) => ({ month: point.month, value: point.grossEarnings }))} color="#267a55"/>
      <TimelineChart title="Cumulative gross earnings" description="Running total of all verified gross pay" points={points.map((point) => ({ month: point.month, value: point.cumulativeGross }))} color="#174f3b"/>
      <TimelineChart title="Monthly tax" description="Income and professional tax deducted each month" points={points.map((point) => ({ month: point.month, value: point.tax }))} color="#c2683f"/>
      <TimelineChart title="Cumulative tax" description="Running total of all tax deducted" points={points.map((point) => ({ month: point.month, value: point.cumulativeTax }))} color="#934936"/>
    </section>
    <p className="salary-timeline-note"><ShieldCheck/>Only approved payslips are included. Tax is calculated from deduction rows identified as tax on each payslip.</p>
  </>;
}

function TimelineChart({ title, description, points, color }: { title: string; description: string; points: { month: string; value: number }[]; color: string }) {
  const width = 720; const height = 220; const left = 22; const right = 18; const top = 20; const bottom = 38;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const maximum = Math.max(...points.map((point) => point.value), 1);
  const coordinates = points.map((point, index) => ({ ...point,
    x: points.length === 1 ? left + plotWidth / 2 : left + index / (points.length - 1) * plotWidth,
    y: top + (1 - point.value / maximum) * plotHeight }));
  const path = coordinates.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const latest = points[points.length - 1];
  return <article className="panel salary-chart"><header><div><span className="eyebrow">Timeline</span><h3>{title}</h3><p>{description}</p></div><strong>{money(latest.value)}</strong></header><div className="salary-chart-canvas"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} from ${monthLabel(points[0].month)} to ${monthLabel(latest.month)}`} preserveAspectRatio="none">
    <defs><linearGradient id={`fill-${title.replace(/\W/g, '')}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".2"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    {[0, .25, .5, .75, 1].map((step) => { const y = top + step * plotHeight; return <line key={step} x1={left} x2={width - right} y1={y} y2={y} className="salary-chart-gridline"/>; })}
    {coordinates.length > 1 && <path d={`${path} L ${coordinates[coordinates.length - 1].x.toFixed(1)} ${(top + plotHeight).toFixed(1)} L ${coordinates[0].x.toFixed(1)} ${(top + plotHeight).toFixed(1)} Z`} fill={`url(#fill-${title.replace(/\W/g, '')})`}/>}<path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    {coordinates.map((point, index) => <g key={point.month}><circle cx={point.x} cy={point.y} r="5" fill="white" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke"><title>{monthLabel(point.month)}: {money(point.value)}</title></circle>{(index % labelEvery === 0 || index === coordinates.length - 1) && <text x={point.x} y={height - 10} textAnchor="middle">{shortMonthLabel(point.month)}</text>}</g>)}
  </svg></div><div className="salary-chart-values">{points.map((point) => <span key={point.month}><small>{monthLabel(point.month)}</small><strong>{money(point.value)}</strong></span>)}</div></article>;
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function shortMonthLabel(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}
