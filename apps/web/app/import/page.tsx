'use client';
import { AlertTriangle, ArrowLeft, BadgeIndianRupee, BriefcaseBusiness, Building2, Check, CreditCard, FileSpreadsheet, KeyRound, Landmark,
  RefreshCw, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, downloadFile, errorMessage, isUnauthorized, money } from '@/lib/api';

type ImportKind = 'BANK_STATEMENT' | 'CREDIT_CARD_STATEMENT' | 'SALARY_PAYSLIP' | 'BROKER_HOLDINGS';
type Account = { id: string; name: string; type: string; institution: string | null; currency: string; hasStatementPassword: boolean };
type SourceOption = { source: string; label: string; description: string; extensions: string[]; maxBytes: number; accountRequired: boolean;
  commitMode: 'REVIEW_REQUIRED' | 'IMMEDIATE_ATOMIC_REPLACEMENT'; pdfPasswordSupported: boolean; rememberPasswordSupported: boolean; eligibleAccountIds: string[] };
type KindOption = { kind: ImportKind; label: string; description: string; sources: SourceOption[] };
type Catalog = { accounts: Account[]; options: KindOption[] };
type Category = { id: string; name: string; color: string };
type BankRow = { id: string; rowNumber: number; transactionDate: string; postedDate: string | null; descriptionRaw: string; merchant: string | null;
  amount: number; reference: string | null; categoryId: string | null; isDuplicate: boolean; include: boolean; confidence: number };
type BankReview = { id: string; filename: string; status: string; rowCount: number; createdAt: string; account: { id: string; name: string };
  categories: Category[]; staged: BankRow[]; statementBalance: number | null };
type SalaryItem = { id: string; type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION'; description: string; currentAmount: number; ytdAmount: number | null };
type SalaryReview = { id: string; filename: string; payPeriod: string; employer: string; employeeName?: string; employeeNumberLast4?: string;
  department?: string; designation?: string; bankName?: string; bankAccountLast4?: string; uanLast4?: string; currency: string;
  grossEarnings: number; grossDeductions: number; directPayment: number; netPay: number; status: string; createdAt: string; lineItems: SalaryItem[] };
type BankPending = { kind: 'BANK_STATEMENT'; source: string; mode: 'REVIEW_REQUIRED'; createdAt: string; review: BankReview;
  actions: { commit: string; discard: string; updateRow: string } };
type SalaryPending = { kind: 'SALARY_PAYSLIP'; source: 'GOLDMAN_SACHS'; mode: 'REVIEW_REQUIRED'; createdAt: string; review: SalaryReview;
  actions: { commit: string; discard: string } };
type PendingImport = BankPending | SalaryPending;
type ReviewUploadResult = Omit<BankPending, 'createdAt'> | Omit<SalaryPending, 'createdAt'>;
type HoldingsUploadResult = { kind: 'BROKER_HOLDINGS'; source: 'ZERODHA_KITE' | 'GROWW'; mode: 'IMMEDIATE_ATOMIC_REPLACEMENT';
  message: string; result: { imported: number } };

function kindIcon(kind: string) {
  if (kind === 'BANK_STATEMENT') return Landmark;
  if (kind === 'CREDIT_CARD_STATEMENT') return CreditCard;
  if (kind === 'SALARY_PAYSLIP') return BadgeIndianRupee;
  if (kind === 'BROKER_HOLDINGS') return BriefcaseBusiness;
  return Landmark;
}

const SOURCE_URLS: Record<string, string> = {
  SBI: 'https://yonoretail.sbi.bank.in/registration/welcome',
  PNB: 'https://iretail.pnb.bank.in/',
  AXIS: 'https://omni.axis.bank.in/axisretailbanking/',
  GOLDMAN_SACHS: 'https://www.goldmansachs.com/',
  ZERODHA_KITE: 'https://console.zerodha.com/portfolio/holdings',
  GROWW: 'https://groww.in/user/profile/report',
  HDFC_CC: 'https://netbanking.hdfcbank.com/',
  ICICI_CC: 'https://infinity.icicibank.com/',
  SBI_CC: 'https://www.sbicard.com/',
  AXIS_CC: 'https://omni.axis.bank.in/axisretailbanking/',
  EPFO: 'https://passbook.epfindia.gov.in/MemberPassBook/Login',
};

export default function ImportPage() {
  const router = useRouter();
  const initialized = useRef(false);
  const [catalog, setCatalog] = useState<Catalog>();
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState('');
  const [kind, setKind] = useState<ImportKind>('BANK_STATEMENT');
  const [source, setSource] = useState('SBI');
  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<File>();
  const [fileKey, setFileKey] = useState(0);
  const [pdfPassword, setPdfPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncWarning, setSyncWarning] = useState('');

  const refreshPending = useCallback(async (preferredId?: string) => {
    const reviews = await api<PendingImport[]>('/imports/unified/pending');
    setPending(reviews);
    setSelectedReviewId((current) => preferredId && reviews.some((item) => item.review.id === preferredId) ? preferredId
      : reviews.some((item) => item.review.id === current) ? current : reviews[0]?.review.id ?? '');
  }, []);

  const load = useCallback(async () => {
    try {
      const [nextCatalog, reviews] = await Promise.all([
        api<Catalog>('/imports/unified/options'), api<PendingImport[]>('/imports/unified/pending'),
      ]);
      setCatalog(nextCatalog); setPending(reviews);
      setSelectedReviewId((current) => reviews.some((item) => item.review.id === current) ? current : reviews[0]?.review.id ?? '');
      if (!initialized.current) {
        const params = new URLSearchParams(window.location.search);
        const requestedKind = params.get('kind') as ImportKind | null;
        const selectedKind = nextCatalog.options.find((item) => item.kind === requestedKind) ?? nextCatalog.options[0];
        const selectedSource = selectedKind?.sources.find((item) => item.source === params.get('source')) ?? selectedKind?.sources[0];
        const requestedAccount = params.get('accountId');
        if (selectedKind) setKind(selectedKind.kind);
        if (selectedSource) {
          setSource(selectedSource.source);
          setAccountId(requestedAccount && selectedSource.eligibleAccountIds.includes(requestedAccount) ? requestedAccount
            : selectedSource.eligibleAccountIds.length === 1 ? selectedSource.eligibleAccountIds[0] : '');
        }
        initialized.current = true;
      }
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not prepare the import workspace.'));
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const kindOption = catalog?.options.find((item) => item.kind === kind);
  const sourceOption = kindOption?.sources.find((item) => item.source === source) ?? kindOption?.sources[0];
  const eligibleAccounts = catalog?.accounts.filter((account) => sourceOption?.eligibleAccountIds.includes(account.id)) ?? [];
  const selectedAccount = eligibleAccounts.find((account) => account.id === accountId);
  const isPdf = Boolean(file?.name.toLowerCase().endsWith('.pdf'));
  const selectedPending = pending.find((item) => item.review.id === selectedReviewId);

  function clearFileAndCredentials() {
    setFile(undefined); setFileKey((value) => value + 1); setPdfPassword(''); setRememberPassword(false);
    setError(''); setNotice(''); setSyncWarning('');
  }

  function chooseKind(nextKind: ImportKind) {
    const option = catalog?.options.find((item) => item.kind === nextKind);
    const nextSource = option?.sources[0];
    setKind(nextKind); setSource(nextSource?.source ?? '');
    setAccountId(nextSource?.eligibleAccountIds.length === 1 ? nextSource.eligibleAccountIds[0] : '');
    clearFileAndCredentials();
  }

  function chooseSource(nextSourceId: string) {
    const nextSource = kindOption?.sources.find((item) => item.source === nextSourceId);
    setSource(nextSourceId); setAccountId(nextSource?.eligibleAccountIds.length === 1 ? nextSource.eligibleAccountIds[0] : '');
    clearFileAndCredentials();
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !sourceOption || (sourceOption.accountRequired && !accountId)) return;
    setBusy(true); setError(''); setNotice(''); setSyncWarning('');
    const payload = new FormData();
    payload.set('kind', kind); payload.set('source', sourceOption.source); payload.set('file', file);
    if (sourceOption.accountRequired) payload.set('accountId', accountId);
    if (kind === 'BANK_STATEMENT' && isPdf && pdfPassword) payload.set('pdfPassword', pdfPassword);
    if (kind === 'BANK_STATEMENT' && isPdf && sourceOption.rememberPasswordSupported && rememberPassword) payload.set('rememberPassword', 'true');
    try {
      const result = await api<ReviewUploadResult | HoldingsUploadResult>('/imports/unified/upload', { method: 'POST', body: payload });
      setFile(undefined); setFileKey((value) => value + 1); setPdfPassword(''); setRememberPassword(false);
      if (result.mode === 'IMMEDIATE_ATOMIC_REPLACEMENT') {
        setNotice(result.message || 'Holdings were imported.');
      } else {
        const reviewResult = result as ReviewUploadResult;
        const localReview = { ...reviewResult, createdAt: reviewResult.review.createdAt } as PendingImport;
        setPending((items) => [localReview, ...items.filter((item) => item.review.id !== reviewResult.review.id)]);
        setSelectedReviewId(reviewResult.review.id);
        setNotice('The file reconciled successfully and is ready for your approval below.');
        try { await refreshPending(reviewResult.review.id); }
        catch (reason) {
          if (isUnauthorized(reason)) router.replace('/login');
          setSyncWarning('The review was created successfully, but the queue could not be refreshed. The new review shown below is ready to use.');
        }
      }
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'The import could not be completed.'));
    } finally { setBusy(false); }
  }

  async function forgetPassword() {
    if (!selectedAccount) return;
    setBusy(true); setError('');
    try {
      await api(`/accounts/${selectedAccount.id}/statement-password`, { method: 'DELETE' });
      setCatalog((current) => current ? { ...current, accounts: current.accounts.map((account) => account.id === selectedAccount.id
        ? { ...account, hasStatementPassword: false } : account) } : current);
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login'); else setError(errorMessage(reason, 'Could not forget the saved password.'));
    } finally { setBusy(false); }
  }

  async function updateBank(item: BankPending, row: BankRow, changes: { include?: boolean; categoryId?: string }) {
    setBusy(true); setError('');
    try {
      const path = item.actions.updateRow.replace('{rowId}', row.id);
      const result = await api<{ review: BankReview }>(path, { method: 'PATCH', body: JSON.stringify(changes) });
      setPending((items) => items.map((candidate) => candidate.review.id === item.review.id ? { ...item, review: result.review } : candidate));
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login'); else setError(errorMessage(reason, 'Could not update this review row.'));
    } finally { setBusy(false); }
  }

  async function finishReview(item: PendingImport, action: 'commit' | 'discard') {
    setBusy(true); setError(''); setNotice(''); setSyncWarning('');
    try {
      await api(item.actions[action], { method: action === 'commit' ? 'POST' : 'DELETE' });
      const remaining = pending.filter((candidate) => candidate.review.id !== item.review.id);
      setPending(remaining);
      setSelectedReviewId((current) => current === item.review.id ? remaining[0]?.review.id ?? '' : current);
      setNotice(action === 'commit' ? (item.kind === 'BANK_STATEMENT' ? 'Transactions added to the ledger.' : 'Salary month saved.') : 'Pending review discarded.');
      try { await refreshPending(); }
      catch (reason) {
        if (isUnauthorized(reason)) router.replace('/login');
        setSyncWarning('The review action succeeded, but the remaining queue could not be refreshed. The completed review has been removed locally.');
      }
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login'); else setError(errorMessage(reason, `Could not ${action} this review.`));
    } finally { setBusy(false); }
  }

  async function downloadReview(id: string, filename: string) {
    try { await downloadFile(`/salary-statements/${id}/download`, filename); }
    catch (reason) { setError(errorMessage(reason, 'Could not download the payslip.')); }
  }

  if (loading || !catalog || !sourceOption) return <Shell><div className="loading"><span/><p>{error || 'Preparing the unified importer…'}</p></div></Shell>;
  const accept = sourceOption.extensions.join(',');
  const fileLabel = kind === 'BANK_STATEMENT' ? 'bank statement' : kind === 'SALARY_PAYSLIP' ? 'payslip' : 'holdings report';

  return <Shell><header className="page-header"><div><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>Overview</Link>
    <span className="eyebrow">Unified import workspace</span><h1>Import financial records</h1><p>Choose what you are importing and who issued it. YAFT applies the matching validator and never guesses an unknown layout.</p></div></header>

    <section className="unified-import-card panel"><form onSubmit={upload}><fieldset className="import-kind-picker"><legend>1. What are you importing?</legend>
      <div>{catalog.options.map((option) => { const Icon = kindIcon(option.kind); return <button type="button" key={option.kind}
        className={kind === option.kind ? 'selected' : ''} aria-pressed={kind === option.kind} onClick={() => chooseKind(option.kind)}><Icon/><span><strong>{option.label}</strong><small>{option.description}</small></span></button>; })}</div></fieldset>
      <div className="unified-fields"><label>2. Source<select value={sourceOption.source} onChange={(event) => chooseSource(event.target.value)}>
        {kindOption?.sources.map((option) => <option key={option.source} value={option.source}>{option.label}</option>)}</select>
        <small>{sourceOption.description} <a href={SOURCE_URLS[sourceOption.source] ?? '#'} target="_blank" rel="noreferrer">Download from portal</a></small></label>
        {sourceOption.accountRequired && <label>3. Destination account<select required value={accountId} onChange={(event) => { setAccountId(event.target.value); setPdfPassword(''); setRememberPassword(false); setError(''); setNotice(''); setSyncWarning(''); }}>
          <option value="" disabled>Choose an eligible account</option>{eligibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.institution ? ` · ${account.institution}` : ''}</option>)}</select>
          <small>Only accounts matching this type and source are offered.</small></label>}</div>
      <label className={`dropzone unified-dropzone ${file ? 'has-file' : ''}`}><input key={fileKey} type="file" accept={accept} required onChange={(event) => { setFile(event.target.files?.[0]); setPdfPassword(''); setRememberPassword(false); setError(''); setNotice(''); setSyncWarning(''); }}/>
        {file ? <><FileSpreadsheet size={38}/><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB · ready for {sourceOption.label} validation</span></>
          : <><UploadCloud size={42}/><strong>Choose the {fileLabel}</strong><span>{sourceOption.extensions.map((item) => item.slice(1).toUpperCase()).join(', ')} · up to {sourceOption.maxBytes / 1024 / 1024} MB</span></>}</label>
      {sourceOption.pdfPasswordSupported && isPdf && <section className="password-panel"><div className="password-status"><KeyRound/><span><strong>PDF document password</strong>
        <small>{selectedAccount?.hasStatementPassword ? 'A saved password can unlock this account’s SBI PDF.' : 'Optional; use only when this PDF is protected.'}</small></span>
        {selectedAccount?.hasStatementPassword && <button type="button" className="ghost compact" disabled={busy} onClick={() => void forgetPassword()}><Trash2/>Forget</button>}</div>
        <label>One-time document-opening password<input type="password" maxLength={128} autoComplete="off" value={pdfPassword}
          placeholder={selectedAccount?.hasStatementPassword ? 'Leave blank to use the saved password' : 'Optional'} onChange={(event) => { setPdfPassword(event.target.value); if (!event.target.value) setRememberPassword(false); }}/></label>
        {sourceOption.rememberPasswordSupported && <label className="remember-choice"><input type="checkbox" checked={rememberPassword} disabled={!pdfPassword}
          onChange={(event) => setRememberPassword(event.target.checked)}/><span><Check/></span><div><strong>Remember securely for this SBI account</strong><small>Saved only after this SBI PDF unlocks and verifies successfully.</small></div></label>}</section>}
      {!eligibleAccounts.length && sourceOption.accountRequired && <p className="notice"><AlertTriangle/>No eligible {sourceOption.label} account exists. <Link href="/dashboard">Add the matching account</Link> first.</p>}
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="success-note" role="status"><ShieldCheck/>{notice}</p>}
      {syncWarning && <p className="notice refresh-warning" role="status"><AlertTriangle/>{syncWarning}</p>}
      <button className="primary wide" disabled={busy || !file || (sourceOption.accountRequired && !accountId)}>{busy ? <><RefreshCw className="spin"/>Validating…</> : kind === 'BROKER_HOLDINGS' ? 'Validate and replace snapshot' : 'Validate and create review'}</button>
      </form>
      <aside>
        <ShieldCheck/><h2>Source-specific safety</h2><p>{kind === 'BROKER_HOLDINGS'
          ? 'Zerodha holdings replace the selected account’s prior snapshot immediately, but only inside one atomic operation after every supported sheet and printed total reconciles.'
          : 'This file creates a pending review. Nothing enters your ledger or salary history until you approve the reconciled rows below.'}</p>
        <ul><li>Original files are not retained</li><li>Unknown or changed layouts fail closed</li><li>Passwords never apply to holdings</li></ul>
        
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '14px', marginBottom: '12px' }}>Quick Access Portals</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <a href="https://netbanking.hdfcbank.com/" target="_blank" rel="noopener noreferrer" className="secondary compact" style={{ display: 'flex', justifyContent: 'center' }}>HDFC Bank</a>
            <a href="https://infinity.icicibank.com/" target="_blank" rel="noopener noreferrer" className="secondary compact" style={{ display: 'flex', justifyContent: 'center' }}>ICICI Bank</a>
            <a href="https://yonoretail.sbi.bank.in/registration/welcome" target="_blank" rel="noopener noreferrer" className="secondary compact" style={{ display: 'flex', justifyContent: 'center' }}>SBI Online</a>
            <a href="https://omni.axis.bank.in/axisretailbanking/" target="_blank" rel="noopener noreferrer" className="secondary compact" style={{ display: 'flex', justifyContent: 'center' }}>Axis Bank</a>
            <a href="https://groww.in/user/profile/report" target="_blank" rel="noopener noreferrer" className="secondary compact" style={{ display: 'flex', justifyContent: 'center' }}>Groww</a>
            <a href="https://console.zerodha.com/portfolio/holdings" target="_blank" rel="noopener noreferrer" className="secondary compact" style={{ display: 'flex', justifyContent: 'center' }}>Zerodha</a>
            <a href="https://passbook.epfindia.gov.in/MemberPassBook/Login" target="_blank" rel="noopener noreferrer" className="secondary compact" style={{ display: 'flex', justifyContent: 'center' }}>EPFO Passbook</a>
          </div>
        </div>
      </aside>
    </section>

    <section className="pending-workspace"><div className="panel-title"><div><span className="eyebrow">Review queue</span><h2>{pending.length} pending import{pending.length === 1 ? '' : 's'}</h2></div></div>
      {pending.length ? <><nav className="pending-tabs" aria-label="Pending imports">{pending.map((item) => <button type="button" key={item.review.id}
        className={item.review.id === selectedReviewId ? 'selected' : ''} aria-pressed={item.review.id === selectedReviewId} onClick={() => setSelectedReviewId(item.review.id)}>
        <span>{item.kind === 'BANK_STATEMENT' ? 'Bank statement' : 'Salary payslip'}</span><strong>{item.kind === 'BANK_STATEMENT' ? item.review.account.name : item.review.employer}</strong><small>{new Date(item.createdAt).toLocaleString('en-IN')}</small></button>)}</nav>
        {selectedPending?.kind === 'BANK_STATEMENT' ? <BankReviewPanel item={selectedPending} busy={busy} update={updateBank} finish={finishReview}/>
          : selectedPending?.kind === 'SALARY_PAYSLIP' ? <SalaryReviewPanel item={selectedPending} busy={busy} finish={finishReview} download={downloadReview}/> : null}</>
        : <div className="unified-empty panel"><ShieldCheck/><strong>No reviews waiting</strong><p>Validated bank statements and payslips will appear here before they are committed.</p></div>}
    </section>
  </Shell>;
}

function BankReviewPanel({ item, busy, update, finish }: { item: BankPending; busy: boolean;
  update: (item: BankPending, row: BankRow, changes: { include?: boolean; categoryId?: string }) => void;
  finish: (item: PendingImport, action: 'commit' | 'discard') => void }) {
  const included = item.review.staged.filter((row) => row.include && !row.isDuplicate);
  const duplicates = item.review.staged.filter((row) => row.isDuplicate).length;
  return <><section className="review-summary"><div><FileSpreadsheet/><span><strong>{item.review.filename}</strong><small>{item.review.account.name} · {item.source}</small></span></div>
    <div><span><strong>{item.review.staged.length}</strong><small>rows found</small></span><span><strong>{duplicates}</strong><small>duplicates</small></span>
      <span><strong>{money(included.reduce((sum, row) => sum + row.amount, 0))}</strong><small>net movement</small></span>
      {item.review.statementBalance != null && <span><strong>{money(item.review.statementBalance)}</strong><small>predicted closing balance</small></span>}
    </div></section>
    <section className="review-table panel"><div className="review-head"><span>Include</span><span>Date &amp; description</span><span>Category</span><span>Amount</span></div>
      {item.review.staged.map((row) => <div className={`review-row ${!row.include ? 'excluded' : ''}`} key={row.id}><label className="check"><input type="checkbox" checked={row.include}
        disabled={busy || row.isDuplicate} aria-label={`Include ${row.merchant || row.descriptionRaw}`} onChange={(event) => void update(item, row, { include: event.target.checked })}/><span><Check/></span></label>
        <div><strong>{row.merchant || row.descriptionRaw}</strong><small>Value {new Date(row.transactionDate).toLocaleDateString('en-IN')}{row.postedDate ? ` · Posted ${new Date(row.postedDate).toLocaleDateString('en-IN')}` : ''} · {row.descriptionRaw}</small>
          {row.isDuplicate && <em><AlertTriangle size={12}/>Likely duplicate</em>}</div><select aria-label={`Category for ${row.merchant || row.descriptionRaw}`} value={row.categoryId ?? ''}
          disabled={busy} onChange={(event) => void update(item, row, { categoryId: event.target.value })}><option value="">Uncategorised</option>{item.review.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <b className={row.amount > 0 ? 'positive' : ''}>{money(row.amount)}</b></div>)}</section>
    <div className="commit-bar"><div><ShieldCheck/><span><strong>{included.length} transactions ready</strong><small>Duplicates and unchecked rows will be skipped.</small></span></div>
      <div className="review-actions"><button type="button" className="ghost" disabled={busy} onClick={() => void finish(item, 'discard')}>Discard</button>
        <button type="button" className="primary" disabled={busy || !included.length} onClick={() => void finish(item, 'commit')}>{busy ? 'Working…' : 'Approve & import'}</button></div></div></>;
}

function SalaryReviewPanel({ item, busy, finish, download }: { item: SalaryPending; busy: boolean; finish: (item: PendingImport, action: 'commit' | 'discard') => void; download: (id: string, filename: string) => void }) {
  const statement = item.review;
  const groups = [{ type: 'EARNING', title: 'Earnings and allowances' }, { type: 'DEDUCTION', title: 'Deductions' },
    { type: 'EMPLOYER_CONTRIBUTION', title: 'Employer contributions' }] as const;
  return <><section className="salary-review-hero"><div><span className="eyebrow">Review before saving</span><h2>{new Date(statement.payPeriod).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><p>{statement.employer}</p></div>
    <div><span><small>Gross earnings</small><strong>{money(statement.grossEarnings)}</strong></span><span><small>Deductions</small><strong>{money(statement.grossDeductions)}</strong></span><span className="net"><small>Net pay</small><strong>{money(statement.netPay)}</strong></span></div></section>
    <section className="salary-masked panel"><div><ShieldCheck/><span><strong>Masked identity check</strong><small>{statement.employeeName ?? 'Employee'}{statement.employeeNumberLast4 ? ` · employee ••••${statement.employeeNumberLast4}` : ''}{statement.uanLast4 ? ` · UAN ••••${statement.uanLast4}` : ''}{statement.bankAccountLast4 ? ` · bank ••••${statement.bankAccountLast4}` : ''}</small></span></div>
      <p>Confirm the month and reconciled totals. The original PDF and full identifiers are not stored.</p></section>
    <section className="salary-review-tables">{groups.map((group) => <article className="panel" key={group.type}><div className="panel-title"><h2>{group.title}</h2></div><div className="salary-lines"><header><span>Description</span><span>Current</span><span>Year to date</span></header>
      {statement.lineItems.filter((line) => line.type === group.type).map((line) => <div key={line.id}><span>{line.description}</span><strong>{money(line.currentAmount)}</strong><small>{line.ytdAmount === null ? '—' : money(line.ytdAmount)}</small></div>)}</div></article>)}</section>
    <div className="commit-bar salary-commit"><div><Check/><span><strong>{statement.lineItems.length} payroll rows reconciled</strong><small>Gross earnings and deductions match their line items.</small></span></div>
      <div><button type="button" className="secondary compact" disabled={busy} onClick={() => void download(statement.id, `payslip-${new Date(statement.payPeriod).toISOString().slice(0, 10)}.pdf`)}>Download payslip</button><button type="button" className="ghost" disabled={busy} onClick={() => void finish(item, 'discard')}>Discard</button><button type="button" className="primary" disabled={busy}
        onClick={() => void finish(item, 'commit')}>{busy ? 'Working…' : 'Approve salary month'}</button></div></div></>;
}
