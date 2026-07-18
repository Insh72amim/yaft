'use client';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, BadgeIndianRupee, Building2, Check, FileText, ShieldCheck, UploadCloud, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';

type SalaryItem = { id: string; type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION'; description: string; currentAmount: number; ytdAmount: number | null };
type SalaryStatement = { id: string; payPeriod: string; employer: string; employeeName?: string; employeeNumberLast4?: string; department?: string; designation?: string;
  bankName?: string; bankAccountLast4?: string; uanLast4?: string; currency: string; grossEarnings: number; grossDeductions: number; directPayment: number; netPay: number;
  filename: string; status: 'REVIEW' | 'COMMITTED'; lineItems: SalaryItem[] };
type SalaryOverview = { summary: { statementCount: number; totalGross: number; totalDeductions: number; totalNet: number; employeePf: number; employerPf: number; taxes: number; latestNetPay: number };
  pending: SalaryStatement | null; statements: SalaryStatement[] };

export default function SalaryPage() {
  const router = useRouter(); const [data, setData] = useState<SalaryOverview>(); const [review, setReview] = useState<SalaryStatement>(); const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const load = useCallback(() => api<SalaryOverview>('/salary-statements').then((value) => { setData(value); setReview(value.pending ?? undefined); }).catch((reason: unknown) => { if (isUnauthorized(reason)) router.replace('/login'); else setError(errorMessage(reason, 'Could not load your salary history.')); }), [router]);
  useEffect(() => { load(); }, [load]);
  async function upload(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!file) return; setBusy(true); setError(''); const payload = new FormData(); payload.set('payslip', file);
    try { setReview(await api<SalaryStatement>('/salary-statements/upload', { method: 'POST', body: payload })); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read this payslip.'); } finally { setBusy(false); } }
  async function commit() { if (!review) return; setBusy(true); const overview = await api<SalaryOverview>(`/salary-statements/${review.id}/commit`, { method: 'POST' }); setReview(undefined); setData(overview); setFile(undefined); setBusy(false); }
  async function discard() { if (!review) return; setBusy(true); await api(`/salary-statements/${review.id}`, { method: 'DELETE' }); setReview(undefined); setFile(undefined); setBusy(false); load(); }
  if (!data) return <Shell><div className="loading"><span/><p>{error || 'Preparing your salary history…'}</p></div></Shell>;
  return <Shell><header className="page-header"><div><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>Overview</Link><span className="eyebrow">Income records</span><h1>Salary statements</h1><p>Build a verified, cumulative view of earnings, deductions, tax, and provident fund.</p></div></header>
    {review ? <SalaryReview statement={review} busy={busy} commit={commit} discard={discard}/> : <>
      <section className="salary-summary">
        <article><span className="summary-icon income"><WalletCards/></span><small>Latest net pay</small><strong>{money(data.summary.latestNetPay)}</strong><em>{data.summary.statementCount} verified statement{data.summary.statementCount === 1 ? '' : 's'}</em></article>
        <article><span className="summary-icon saved"><ArrowUpRight/></span><small>Cumulative gross</small><strong>{money(data.summary.totalGross)}</strong><em>Across uploaded months</em></article>
        <article><span className="summary-icon expense"><ArrowDownRight/></span><small>Tax deducted</small><strong>{money(data.summary.taxes)}</strong><em>Income + professional tax</em></article>
        <article><span className="summary-icon epfo"><Building2/></span><small>Total PF additions</small><strong>{money(data.summary.employeePf + data.summary.employerPf)}</strong><em>Employee + employer share</em></article>
      </section>
      <section className="salary-layout"><form className="salary-upload panel" onSubmit={upload}><div><span className="eyebrow">Add a month</span><h2>Upload salary PDF</h2><p>The PDF is parsed in memory and never saved. Only payroll facts and masked identifier endings are stored.</p></div><label className={`salary-dropzone ${file ? 'has-file' : ''}`}><input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0])}/>{file ? <><FileText/><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB · ready to parse</span></> : <><UploadCloud/><strong>Choose a payslip PDF</strong><span>Machine-generated PDF · up to 8 MB</span></>}</label>{error && <p className="error">{error}</p>}<button className="primary wide" disabled={!file || busy}>{busy ? 'Reading payroll tables…' : 'Parse and review'}</button><div className="salary-privacy"><ShieldCheck/><span><strong>Sensitive identifiers are masked</strong><small>Full PAN, UAN, bank account, PF number, and the original PDF are not stored.</small></span></div></form>
        <section className="panel salary-history"><div className="panel-title"><div><span className="eyebrow">Cumulative record</span><h2>Salary history</h2></div></div>{data.statements.length ? <div className="salary-history-list">{data.statements.map((statement) => <article key={statement.id}><time>{new Date(statement.payPeriod).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</time><div><strong>{statement.employer}</strong><small>Gross {money(statement.grossEarnings)} · deductions {money(statement.grossDeductions)}</small></div><b>{money(statement.netPay)}</b></article>)}</div> : <div className="salary-empty"><BadgeIndianRupee/><strong>No verified salary months yet</strong><p>Upload the first payslip to start your cumulative record.</p></div>}</section>
      </section>
    </>}
  </Shell>;
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
