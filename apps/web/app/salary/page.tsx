'use client';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, BadgeIndianRupee, Building2, Check, FileText, ShieldCheck, UploadCloud, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';

type SalaryItem = { id: string; type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION'; description: string; currentAmount: number; ytdAmount: number | null };
type PayslipSchemaOption = { id: string; employer: string };
type SalaryStatement = { id: string; payPeriod: string; employer: string; employeeName?: string; employeeNumberLast4?: string; department?: string; designation?: string;
  bankName?: string; bankAccountLast4?: string; uanLast4?: string; currency: string; grossEarnings: number; grossDeductions: number; directPayment: number; netPay: number;
  filename: string; status: 'REVIEW' | 'COMMITTED'; lineItems: SalaryItem[] };
type SalaryTimelinePoint = { month: string; grossEarnings: number; netPay: number; tax: number; cumulativeGross: number; cumulativeTax: number };
type SalaryOverview = { payslipSchemas: PayslipSchemaOption[]; summary: { statementCount: number; totalGross: number; totalDeductions: number; totalNet: number; employeePf: number; employerPf: number; taxes: number; latestNetPay: number };
  timeline: SalaryTimelinePoint[]; pending: SalaryStatement | null; statements: SalaryStatement[] };

export default function SalaryPage() {
  const router = useRouter(); const [data, setData] = useState<SalaryOverview>(); const [review, setReview] = useState<SalaryStatement>(); const [file, setFile] = useState<File>();
  const [payslipSchema, setPayslipSchema] = useState(''); const [activeTab, setActiveTab] = useState<'statements' | 'timeline'>('statements');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const load = useCallback(() => api<SalaryOverview>('/salary-statements').then((value) => { setData(value); setReview(value.pending ?? undefined);
    setPayslipSchema((current) => current || (value.payslipSchemas.length === 1 ? value.payslipSchemas[0].id : '')); }).catch((reason: unknown) => { if (isUnauthorized(reason)) router.replace('/login'); else setError(errorMessage(reason, 'Could not load your salary history.')); }), [router]);
  useEffect(() => { load(); }, [load]);
  async function upload(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!file || !payslipSchema) return; setBusy(true); setError(''); const payload = new FormData(); payload.set('payslip', file); payload.set('payslipSchema', payslipSchema);
    try { setReview(await api<SalaryStatement>('/salary-statements/upload', { method: 'POST', body: payload })); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read this payslip.'); } finally { setBusy(false); } }
  async function commit() { if (!review) return; setBusy(true); const overview = await api<SalaryOverview>(`/salary-statements/${review.id}/commit`, { method: 'POST' }); setReview(undefined); setData(overview); setFile(undefined); setPayslipSchema(''); setBusy(false); }
  async function discard() { if (!review) return; setBusy(true); await api(`/salary-statements/${review.id}`, { method: 'DELETE' }); setReview(undefined); setFile(undefined); setPayslipSchema(''); setBusy(false); load(); }
  if (!data) return <Shell><div className="loading"><span/><p>{error || 'Preparing your salary history…'}</p></div></Shell>;
  return <Shell><header className="page-header"><div><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>Overview</Link><span className="eyebrow">Income records</span><h1>Salary statements</h1><p>Build a verified, cumulative view of earnings, deductions, tax, and provident fund.</p></div></header>
    {!review && <div className="salary-tabs" role="tablist" aria-label="Salary views"><button role="tab" aria-selected={activeTab === 'statements'} className={activeTab === 'statements' ? 'active' : ''} onClick={() => setActiveTab('statements')}><FileText/>Statements</button><button role="tab" aria-selected={activeTab === 'timeline'} className={activeTab === 'timeline' ? 'active' : ''} onClick={() => setActiveTab('timeline')}><ArrowUpRight/>Earnings &amp; tax timeline</button></div>}
    {review ? <SalaryReview statement={review} busy={busy} commit={commit} discard={discard}/> : activeTab === 'statements' ? <>
      <section className="salary-summary">
        <article><span className="summary-icon income"><WalletCards/></span><small>Latest net pay</small><strong>{money(data.summary.latestNetPay)}</strong><em>{data.summary.statementCount} verified statement{data.summary.statementCount === 1 ? '' : 's'}</em></article>
        <article><span className="summary-icon saved"><ArrowUpRight/></span><small>Cumulative gross</small><strong>{money(data.summary.totalGross)}</strong><em>Across uploaded months</em></article>
        <article><span className="summary-icon expense"><ArrowDownRight/></span><small>Tax deducted</small><strong>{money(data.summary.taxes)}</strong><em>Income + professional tax</em></article>
        <article><span className="summary-icon epfo"><Building2/></span><small>Total PF additions</small><strong>{money(data.summary.employeePf + data.summary.employerPf)}</strong><em>Employee + employer share</em></article>
      </section>
      <section className="salary-layout"><form className="salary-upload panel" onSubmit={upload}><div><span className="eyebrow">Add a month</span><h2>Upload salary PDF</h2><p>The PDF is parsed in memory and never saved. Only payroll facts and masked identifier endings are stored.</p></div><label className="salary-employer">Employer<select required value={payslipSchema} onChange={(event) => { setPayslipSchema(event.target.value); setError(''); }}><option value="" disabled>Choose the payslip employer</option>{data.payslipSchemas.map((schema) => <option key={schema.id} value={schema.id}>{schema.employer}</option>)}</select><small>The employer determines which payslip layout is used.</small></label><label className={`salary-dropzone ${file ? 'has-file' : ''}`}><input type="file" accept="application/pdf,.pdf" onChange={(event) => { setFile(event.target.files?.[0]); setError(''); }}/>{file ? <><FileText/><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB · ready to parse</span></> : <><UploadCloud/><strong>Choose a payslip PDF</strong><span>Machine-generated PDF · up to 8 MB</span></>}</label>{error && <p className="error">{error}</p>}<button className="primary wide" disabled={!file || !payslipSchema || busy}>{busy ? 'Reading payroll tables…' : 'Parse and review'}</button><div className="salary-privacy"><ShieldCheck/><span><strong>Sensitive identifiers are masked</strong><small>Full PAN, UAN, bank account, PF number, and the original PDF are not stored.</small></span></div></form>
        <section className="panel salary-history"><div className="panel-title"><div><span className="eyebrow">Cumulative record</span><h2>Salary history</h2></div></div>{data.statements.length ? <div className="salary-history-list">{data.statements.map((statement) => <article key={statement.id}><time>{new Date(statement.payPeriod).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</time><div><strong>{statement.employer}</strong><small>Gross {money(statement.grossEarnings)} · deductions {money(statement.grossDeductions)}</small></div><b>{money(statement.netPay)}</b></article>)}</div> : <div className="salary-empty"><BadgeIndianRupee/><strong>No verified salary months yet</strong><p>Upload the first payslip to start your cumulative record.</p></div>}</section>
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

function SalaryReview({ statement, busy, commit, discard }: { statement: SalaryStatement; busy: boolean; commit: () => void; discard: () => void }) {
  const groups = [
    { type: 'EARNING', title: 'Earnings and allowances' }, { type: 'DEDUCTION', title: 'Deductions' }, { type: 'EMPLOYER_CONTRIBUTION', title: 'Employer contributions' },
  ] as const;
  return <><section className="salary-review-hero"><div><span className="eyebrow">Review before saving</span><h2>{new Date(statement.payPeriod).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><p>{statement.employer}</p></div><div><span><small>Gross earnings</small><strong>{money(statement.grossEarnings)}</strong></span><span><small>Deductions</small><strong>{money(statement.grossDeductions)}</strong></span><span className="net"><small>Net pay</small><strong>{money(statement.netPay)}</strong></span></div></section>
    <section className="salary-masked panel"><div><ShieldCheck/><span><strong>Identity check</strong><small>{statement.employeeName ?? 'Employee'}{statement.employeeNumberLast4 ? ` · employee ••••${statement.employeeNumberLast4}` : ''}{statement.uanLast4 ? ` · UAN ••••${statement.uanLast4}` : ''}{statement.bankAccountLast4 ? ` · bank ••••${statement.bankAccountLast4}` : ''}</small></span></div><p>Confirm the month and totals match the PDF. The original file and full identifiers will not be stored.</p></section>
    <section className="salary-review-tables">{groups.map((group) => <article className="panel" key={group.type}><div className="panel-title"><h2>{group.title}</h2></div><div className="salary-lines"><header><span>Description</span><span>Current</span><span>Year to date</span></header>{statement.lineItems.filter((item) => item.type === group.type).map((item) => <div key={item.id}><span>{item.description}</span><strong>{money(item.currentAmount)}</strong><small>{item.ytdAmount === null ? '—' : money(item.ytdAmount)}</small></div>)}</div></article>)}</section>
    <div className="commit-bar salary-commit"><div><Check/><span><strong>{statement.lineItems.length} payroll rows reconciled</strong><small>Gross earnings and deductions match their line items.</small></span></div><div><button className="ghost" disabled={busy} onClick={discard}>Discard</button><button className="primary" disabled={busy} onClick={commit}>{busy ? 'Saving…' : 'Approve salary month'}</button></div></div></>;
}
