'use client';
import { AlertTriangle, ArrowLeft, BadgeIndianRupee, BriefcaseBusiness, Building2, Check, CreditCard, FileSpreadsheet, KeyRound, Landmark,
  Mail, RefreshCw, ShieldCheck, Smartphone, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, downloadFile, errorMessage, isUnauthorized, money } from '@/lib/api';

type ImportKind = 'BANK_STATEMENT' | 'CREDIT_CARD_STATEMENT' | 'SALARY_PAYSLIP' | 'BROKER_HOLDINGS' | 'UPI_STATEMENT';
type Account = { id: string; name: string; type: string; institution: string | null; currency: string; hasStatementPassword: boolean };
type SourceOption = { source: string; label: string; description: string; extensions: string[]; maxBytes: number; accountRequired: boolean;
  commitMode: 'REVIEW_REQUIRED' | 'IMMEDIATE_ATOMIC_REPLACEMENT'; pdfPasswordSupported: boolean; rememberPasswordSupported: boolean; eligibleAccountIds: string[] };
type KindOption = { kind: ImportKind; label: string; description: string; sources: SourceOption[] };
type Catalog = { accounts: Account[]; options: KindOption[] };
type Category = { id: string; name: string; color: string };
type BankRow = { id: string; rowNumber: number; transactionDate: string; postedDate: string | null; descriptionRaw: string; merchant: string | null;
  amount: number; reference: string | null; categoryId: string | null; isDuplicate: boolean; include: boolean; confidence: number };
type BankReview = { id: string; filename: string; status: string; rowCount: number; createdAt: string; account: { id: string; name: string; institution?: string | null; last4?: string | null };
  categories: Category[]; staged: BankRow[]; statementBalance: number | null };
type SalaryItem = { id: string; type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION'; description: string; currentAmount: number; ytdAmount: number | null };
type SalaryReview = { id: string; filename: string; payPeriod: string; employer: string; employeeName?: string; employeeNumberLast4?: string;
  department?: string; designation?: string; bankName?: string; bankAccountLast4?: string; uanLast4?: string; currency: string;
  grossEarnings: number; grossDeductions: number; directPayment: number; netPay: number; status: string; createdAt: string; lineItems: SalaryItem[] };
type BankPending = { kind: 'BANK_STATEMENT' | 'CREDIT_CARD_STATEMENT'; source: string; mode: 'REVIEW_REQUIRED'; createdAt: string; review: BankReview;
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
  if (kind === 'UPI_STATEMENT') return Smartphone;
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
  GPAY: 'https://pay.google.com/',
  PHONEPE: 'https://www.phonepe.com/',
  PAYTM: 'https://paytm.com/',
};

type HistoryImportItem = {
  id: string;
  sourceType: 'BANK_STATEMENT' | 'CREDIT_CARD' | 'SALARY_PAYSLIP' | 'DOCUMENT';
  filename: string;
  status: string;
  rowCount: number;
  createdAt: string;
  committedAt: string | null;
  accountName: string;
  accountType: string;
  accountInstitution: string | null;
  totalSpent: number;
  totalReceived: number;
  categories: Array<{
    name: string;
    color: string;
    amount: number;
    count: number;
  }>;
};

export default function ImportPage() {
  return <Suspense fallback={<Shell><div className="loading"><span/><p>Preparing the unified importer…</p></div></Shell>}>
    <ImportWorkspace />
  </Suspense>;
}

function ImportWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedKind = searchParams.get('kind') as ImportKind | null;
  const requestedSource = searchParams.get('source');
  const requestedAccount = searchParams.get('accountId');

  // Sub-tab state
  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'HISTORY' | 'EMAIL_SYNC'>('UPLOAD');
  const [historyItems, setHistoryItems] = useState<HistoryImportItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<'ALL' | 'BANK' | 'CREDIT_CARD' | 'SALARY' | 'DOCUMENT'>('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'COMMITTED' | 'REVIEW'>('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // Email Ingestion State
  const [emailSubTab, setEmailSubTab] = useState<'SNIPPET' | 'SETTINGS' | 'LOGS'>('SNIPPET');
  const [emailSnippet, setEmailSnippet] = useState('');
  const [emailSnippetAccount, setEmailSnippetAccount] = useState('');
  const [snippetParsing, setSnippetParsing] = useState(false);
  const [snippetResult, setSnippetResult] = useState<any>(null);
  const [emailConfig, setEmailConfig] = useState<any>(null);
  const [emailForm, setEmailForm] = useState({ email: '', host: 'imap.gmail.com', port: 993, tls: true, password: '', autoSync: false });
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncingInbox, setSyncingInbox] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);

  const [catalog, setCatalog] = useState<Catalog>();
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState('');
  const [kind, setKind] = useState<ImportKind>('BANK_STATEMENT');
  const [source, setSource] = useState('SBI');
  const [accountId, setAccountId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [pdfPassword, setPdfPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncWarning, setSyncWarning] = useState('');
  const [salaryType, setSalaryType] = useState('SALARY');

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const items = await api<HistoryImportItem[]>('/imports/unified/history');
      setHistoryItems(items || []);
      setHistoryLoaded(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not load import history timeline.'));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadEmailConfig = useCallback(async () => {
    try {
      const cfg = await api<any>('/email-ingestion/config');
      setEmailConfig(cfg);
      if (cfg && cfg.configured) {
        setEmailForm({
          email: cfg.email || '',
          host: cfg.host || 'imap.gmail.com',
          port: cfg.port || 993,
          tls: cfg.tls !== undefined ? cfg.tls : true,
          password: '',
          autoSync: cfg.autoSync || false,
        });
      }
    } catch {}
  }, []);

  const loadEmailLogs = useCallback(async () => {
    try {
      setLoadingEmailLogs(true);
      const logs = await api<any[]>('/email-ingestion/logs');
      setEmailLogs(logs || []);
    } catch {} finally {
      setLoadingEmailLogs(false);
    }
  }, []);

  const handleParseSnippet = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailSnippet.trim()) return;
    setSnippetParsing(true); setError(''); setNotice(''); setSnippetResult(null);
    try {
      const res = await api<any>('/email-ingestion/parse-snippet', {
        method: 'POST',
        body: JSON.stringify({ snippet: emailSnippet, targetAccountId: emailSnippetAccount || undefined }),
      });
      setSnippetResult(res);
      setNotice(res.message);
      await refreshPending(res.batchId);
    } catch (err) {
      setError(errorMessage(err, 'Could not parse email snippet.'));
    } finally {
      setSnippetParsing(false);
    }
  };

  const handleSaveEmailConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailForm.email || !emailForm.password) {
      setError('Please enter your email address and password.');
      return;
    }
    setSavingConfig(true); setError(''); setNotice('');
    try {
      const res = await api<any>('/email-ingestion/config', {
        method: 'POST',
        body: JSON.stringify(emailForm),
      });
      setNotice(res.message);
      await loadEmailConfig();
    } catch (err) {
      setError(errorMessage(err, 'Could not save email configuration.'));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSyncInboxNow = async () => {
    setSyncingInbox(true); setError(''); setNotice('');
    try {
      const res = await api<any>('/email-ingestion/sync', { method: 'POST' });
      setNotice(res.message);
      await loadEmailLogs();
    } catch (err) {
      setError(errorMessage(err, 'Could not trigger email inbox sync.'));
    } finally {
      setSyncingInbox(false);
    }
  };

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
      let selectedKind = nextCatalog.options.find((item) => item.kind === requestedKind);
      let selectedSource = selectedKind?.sources.find((item) => item.source === requestedSource);

      if (requestedAccount && !selectedSource?.eligibleAccountIds.includes(requestedAccount)) {
        const preferredKinds = selectedKind
          ? [selectedKind, ...nextCatalog.options.filter((item) => item.kind !== selectedKind?.kind)]
          : nextCatalog.options;
        for (const kindOption of preferredKinds) {
          const sourceOption = kindOption.sources.find((item) =>
            item.eligibleAccountIds.includes(requestedAccount)
            && (!requestedSource || item.source === requestedSource),
          ) ?? kindOption.sources.find((item) => item.eligibleAccountIds.includes(requestedAccount));
          if (sourceOption) {
            selectedKind = kindOption;
            selectedSource = sourceOption;
            break;
          }
        }
      }

      if (!selectedKind) selectedKind = nextCatalog.options[0];
      if (!selectedSource) selectedSource = selectedKind?.sources.find((item) => item.source === requestedSource) ?? selectedKind?.sources[0];

      if (selectedKind) setKind(selectedKind.kind);
      if (selectedSource) {
        setSource(selectedSource.source);
        setAccountId(requestedAccount && selectedSource.eligibleAccountIds.includes(requestedAccount) ? requestedAccount
          : selectedSource.eligibleAccountIds.length === 1 ? selectedSource.eligibleAccountIds[0] : '');
      }
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not prepare the import workspace.'));
    } finally { setLoading(false); }
  }, [requestedAccount, requestedKind, requestedSource, router]);

  useEffect(() => { void load(); }, [load]);

  const kindOption = catalog?.options.find((item) => item.kind === kind);
  const sourceOption = kindOption?.sources.find((item) => item.source === source) ?? kindOption?.sources[0];
  const eligibleAccounts = catalog?.accounts.filter((account) => sourceOption?.eligibleAccountIds.includes(account.id)) ?? [];
  const selectedAccount = eligibleAccounts.find((account) => account.id === accountId);
  const isPdf = files.some((f) => f.name.toLowerCase().endsWith('.pdf'));
  const selectedPending = pending.find((item) => item.review.id === selectedReviewId);

  function clearFileAndCredentials() {
    setFiles([]); setFileKey((value) => value + 1); setPdfPassword(''); setRememberPassword(false);
    setSalaryType('SALARY');
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
    if (!files.length || !sourceOption || (sourceOption.accountRequired && !accountId)) return;
    setBusy(true); setError(''); setNotice(''); setSyncWarning('');
    const filesToUpload = [...files];
    const isBulk = filesToUpload.length > 1;
    const skippedFiles: string[] = [];
    const successfulFiles: string[] = [];
    let lastReviewResult: ReviewUploadResult | null = null;
    let fatalError: string | null = null;

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const fileItem = filesToUpload[i];
        if (isBulk) {
          setNotice(`Validating and uploading statement ${i + 1} of ${filesToUpload.length} (${fileItem.name})…`);
        }
        const payload = new FormData();
        payload.set('kind', kind); payload.set('source', sourceOption.source); payload.set('file', fileItem);
        if (accountId) payload.set('accountId', accountId);
        if (sourceOption.pdfPasswordSupported && fileItem.name.toLowerCase().endsWith('.pdf') && pdfPassword) {
          payload.set('pdfPassword', pdfPassword);
        }
        if (sourceOption.rememberPasswordSupported && fileItem.name.toLowerCase().endsWith('.pdf') && rememberPassword) {
          payload.set('rememberPassword', 'true');
        }
        if (kind === 'SALARY_PAYSLIP') {
          payload.set('salaryType', salaryType);
        }
        try {
          const result = await api<ReviewUploadResult | HoldingsUploadResult>('/imports/unified/upload', { method: 'POST', body: payload });
          if (result.mode === 'REVIEW_REQUIRED') {
            lastReviewResult = result as ReviewUploadResult;
            successfulFiles.push(fileItem.name);
          } else {
            successfulFiles.push(fileItem.name);
          }
        } catch (reason) {
          if (isUnauthorized(reason)) {
            router.replace('/login');
            return;
          }
          const msg = errorMessage(reason, '');
          if (msg.includes('already uploaded')) {
            skippedFiles.push(fileItem.name);
          } else {
            fatalError = errorMessage(reason, 'The import could not be completed.');
            break;
          }
        }
      }

      setFiles([]); setFileKey((value) => value + 1); setPdfPassword(''); setRememberPassword(false);

      if (fatalError && !successfulFiles.length && !skippedFiles.length) {
        setError(fatalError);
      } else if (successfulFiles.length > 0) {
        let msg = isBulk
          ? `All ${successfulFiles.length} new statement files reconciled successfully and are ready for approval below.`
          : 'The file reconciled successfully and is ready for your approval below.';
        if (skippedFiles.length > 0) {
          msg += ` Skipped ${skippedFiles.length} already uploaded file${skippedFiles.length === 1 ? '' : 's'} (${skippedFiles.join(', ')}).`;
        }
        if (fatalError) {
          setError(`Partial upload complete. Warning: ${fatalError}`);
        }
        setNotice(msg);
        try {
          if (lastReviewResult) await refreshPending(lastReviewResult.review.id);
          else await refreshPending();
        } catch (reason) {
          if (isUnauthorized(reason)) router.replace('/login');
          setSyncWarning('The reviews were created successfully, but the queue could not be refreshed. Try refreshing the page.');
        }
      } else if (skippedFiles.length > 0) {
        setNotice(`Skipped ${skippedFiles.length} statement file${skippedFiles.length === 1 ? '' : 's'} (${skippedFiles.join(', ')}) because ${skippedFiles.length === 1 ? 'it was' : 'they were'} already uploaded.`);
        if (fatalError) setError(fatalError);
        try { await refreshPending(); } catch {}
      } else if (fatalError) {
        setError(fatalError);
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
      setNotice(action === 'commit' ? (item.kind === 'BANK_STATEMENT' || item.kind === 'CREDIT_CARD_STATEMENT' ? 'Transactions added to the ledger.' : 'Salary month saved.') : 'Pending review discarded.');
      if (action === 'commit' && (item.kind === 'BANK_STATEMENT' || item.kind === 'CREDIT_CARD_STATEMENT')) {
        router.push(`/accounts?account=${item.review.account.id}`);
        return;
      }
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
  const fileLabel = kind === 'BANK_STATEMENT' ? 'bank statement' : kind === 'SALARY_PAYSLIP' ? 'payslip' : kind === 'UPI_STATEMENT' ? 'UPI app statement' : 'holdings report';

  return <Shell><header className="page-header"><div><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>Overview</Link>
    <span className="eyebrow">Unified import workspace</span><h1>Import financial records</h1><p>Choose what you are importing and who issued it. YAFT applies the matching validator and never guesses an unknown layout.</p></div></header>

    {/* Sub-Tab Navigation */}
    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
      <button
        type="button"
        className={`secondary ${activeTab === 'UPLOAD' ? 'active' : ''}`}
        onClick={() => setActiveTab('UPLOAD')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', fontWeight: 600 }}>
        <UploadCloud size={16} />
        <span>New Upload & Pending Queue</span>
        {pending.length > 0 && <span style={{ background: '#f59e0b', color: '#ffffff', fontSize: '11px', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>{pending.length}</span>}
      </button>

      <button
        type="button"
        className={`secondary ${activeTab === 'HISTORY' ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('HISTORY');
          if (!historyLoaded) loadHistory();
        }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', fontWeight: 600 }}>
        <RefreshCw size={16} color="var(--green)" />
        <span>Past Uploads & Timeline</span>
        {historyItems.length > 0 && <span style={{ background: 'var(--card-hover)', color: 'var(--ink)', fontSize: '11px', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>{historyItems.length}</span>}
      </button>

      <button
        type="button"
        className={`secondary ${activeTab === 'EMAIL_SYNC' ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('EMAIL_SYNC');
          loadEmailConfig();
          loadEmailLogs();
        }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', fontWeight: 600 }}>
        <Mail size={16} color="#3b82f6" />
        <span>Email Auto-Sync & Alert Ingestion</span>
        <span style={{ background: '#3b82f6', color: '#ffffff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>NEW</span>
      </button>
    </div>

    {activeTab === 'HISTORY' ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '14px 18px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Uploaded Files</span>
            <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>{historyItems.length}</strong>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '14px 18px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Rows Processed</span>
            <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: 'var(--green)', marginTop: '4px' }}>
              {historyItems.reduce((sum, item) => sum + item.rowCount, 0)}
            </strong>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '14px 18px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Committed Imports</span>
            <strong style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
              {historyItems.filter((item) => item.status === 'COMMITTED').length}
            </strong>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="panel" style={{ padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Account Category:</span>
            {[
              { id: 'ALL', label: 'All Categories' },
              { id: 'BANK', label: 'Bank Statements' },
              { id: 'CREDIT_CARD', label: 'Credit Cards' },
              { id: 'SALARY', label: 'Salary Payslips' },
              { id: 'DOCUMENT', label: 'Documents' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`secondary compact ${historyCategoryFilter === cat.id ? 'active' : ''}`}
                onClick={() => setHistoryCategoryFilter(cat.id as any)}
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px' }}>
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search filename or account..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{ height: '34px', fontSize: '12px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--background-alt)', color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* Timeline Content */}
        {loadingHistory ? (
          <div className="loading" style={{ padding: '40px' }}>
            <span />
            <p>Loading import timeline...</p>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
            <FileSpreadsheet size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5, display: 'block' }} />
            <strong style={{ display: 'block', color: 'var(--ink)' }}>No past uploads found</strong>
            <span style={{ fontSize: '12px' }}>Upload your first bank statement or payslip to see it in your timeline.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {Object.entries(
              historyItems
                .filter((item) => {
                  if (historyCategoryFilter === 'BANK' && item.sourceType !== 'BANK_STATEMENT') return false;
                  if (historyCategoryFilter === 'CREDIT_CARD' && item.sourceType !== 'CREDIT_CARD') return false;
                  if (historyCategoryFilter === 'SALARY' && item.sourceType !== 'SALARY_PAYSLIP') return false;
                  if (historyCategoryFilter === 'DOCUMENT' && item.sourceType !== 'DOCUMENT') return false;
                  if (historyStatusFilter !== 'ALL' && item.status !== historyStatusFilter) return false;
                  if (historySearch.trim()) {
                    const q = historySearch.toLowerCase();
                    if (!item.filename.toLowerCase().includes(q) && !item.accountName.toLowerCase().includes(q)) return false;
                  }
                  return true;
                })
                .reduce((groups: Record<string, HistoryImportItem[]>, item) => {
                  const monthKey = new Date(item.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                  if (!groups[monthKey]) groups[monthKey] = [];
                  groups[monthKey].push(item);
                  return groups;
                }, {})
            ).map(([monthYear, groupItems]) => (
              <section key={monthYear} className="panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }} />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--ink)' }}>{monthYear}</h3>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>({groupItems.length} upload{groupItems.length === 1 ? '' : 's'})</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {groupItems.map((item) => {
                    const Icon = item.sourceType === 'CREDIT_CARD' ? CreditCard : item.sourceType === 'SALARY_PAYSLIP' ? BadgeIndianRupee : Landmark;
                    return (
                      <div
                        key={item.id}
                        style={{
                          background: 'var(--background-alt)',
                          border: '1px solid var(--line)',
                          borderRadius: '12px',
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '8px', borderRadius: '8px' }}>
                              <Icon size={18} color="var(--green)" />
                            </div>
                            <div>
                              <strong style={{ fontSize: '14px', color: 'var(--ink)', display: 'block' }}>{item.filename}</strong>
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                {item.accountName} {item.accountInstitution ? `· ${item.accountInstitution}` : ''}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: item.status === 'COMMITTED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: item.status === 'COMMITTED' ? '#10b981' : '#f59e0b',
                            }}>
                              {item.status}
                            </span>
                            <small style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              {new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </div>
                        </div>

                        {/* Totals & Category Breakdown */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', background: 'var(--card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                          <div style={{ fontSize: '12px', display: 'flex', gap: '12px' }}>
                            <span><strong>{item.rowCount}</strong> <small style={{ color: 'var(--muted)' }}>rows</small></span>
                            {item.totalSpent > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}>Outflow: {money(item.totalSpent * 100)}</span>}
                            {item.totalReceived > 0 && <span style={{ color: '#10b981', fontWeight: 700 }}>Inflow: {money(item.totalReceived * 100)}</span>}
                          </div>

                          {item.categories.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>Categories:</span>
                              {item.categories.slice(0, 4).map((c) => (
                                <span
                                  key={c.name}
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: `${c.color}20`,
                                    color: c.color,
                                    fontWeight: 700,
                                  }}>
                                  {c.name} ({money(c.amount * 100)})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    ) : activeTab === 'EMAIL_SYNC' ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Email Header Banner */}
        <div className="panel" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ background: '#3b82f6', color: '#fff', padding: '10px', borderRadius: '10px' }}>
                <Mail size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)' }}>Email Transaction Alert Ingestion</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  Parse transaction emails (HDFC, ICICI, SBI, Axis, Amex) instantly or configure local IMAP auto-sync.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`secondary compact ${emailSubTab === 'SNIPPET' ? 'active' : ''}`}
                onClick={() => setEmailSubTab('SNIPPET')}>
                <Sparkles size={14} /> Quick Alert Text Parser
              </button>
              <button
                type="button"
                className={`secondary compact ${emailSubTab === 'SETTINGS' ? 'active' : ''}`}
                onClick={() => setEmailSubTab('SETTINGS')}>
                <KeyRound size={14} /> IMAP Credentials
              </button>
              <button
                type="button"
                className={`secondary compact ${emailSubTab === 'LOGS' ? 'active' : ''}`}
                onClick={() => { setEmailSubTab('LOGS'); loadEmailLogs(); }}>
                <RefreshCw size={14} /> Activity Logs
              </button>
            </div>
          </div>
        </div>

        {/* Notice & Error Messages */}
        {error && <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16}/><span>{error}</span></div>}
        {notice && <div className="notice-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}><Check size={16}/><span>{notice}</span></div>}

        {emailSubTab === 'SNIPPET' && (
          <div className="panel" style={{ padding: '24px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--ink)' }}>Paste Bank Transaction Alert Email</h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--muted)' }}>
              Copy the body text of any SMS or email alert sent by your bank (e.g. <em>"Rs. 2,450.00 debited from A/C **1234 to ZOMATO on 14-08-26"</em>). YAFT will parse the fields and stage it in your review queue.
            </p>
            <form onSubmit={handleParseSnippet} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Target Account (Optional)</label>
                <select
                  value={emailSnippetAccount}
                  onChange={(e) => setEmailSnippetAccount(e.target.value)}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid var(--line)', padding: '0 10px', background: 'var(--background-alt)', color: 'var(--ink)' }}>
                  <option value="">✨ Auto-detect or Create Default Email Account</option>
                  {catalog.accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.institution || acc.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Transaction Email Text</label>
                <textarea
                  rows={5}
                  value={emailSnippet}
                  onChange={(e) => setEmailSnippet(e.target.value)}
                  placeholder="Paste alert email text here... e.g. Rs. 2,450.00 has been debited from account **1234 to VPA zomato@upi on 14-08-26. Ref: 100000000103."
                  required
                  style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--line)', padding: '12px', fontFamily: 'monospace', fontSize: '13px', background: 'var(--background-alt)', color: 'var(--ink)' }}
                />
              </div>

              <button
                type="submit"
                className="primary"
                disabled={snippetParsing || !emailSnippet.trim()}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} />
                <span>{snippetParsing ? 'Parsing Alert…' : 'Parse & Stage Transaction'}</span>
              </button>
            </form>

            {snippetResult && (
              <div style={{ marginTop: '24px', background: 'var(--background-alt)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line)' }}>
                <strong style={{ fontSize: '13px', color: 'var(--green)', display: 'block', marginBottom: '10px' }}>✓ Extracted Transaction Alert Details</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '12px' }}>
                  <div><span style={{ color: 'var(--muted)' }}>Bank:</span> <strong>{snippetResult.parsedAlerts[0]?.bankName}</strong></div>
                  <div><span style={{ color: 'var(--muted)' }}>Amount:</span> <strong style={{ color: snippetResult.parsedAlerts[0]?.type === 'DEBIT' ? '#ef4444' : '#10b981' }}>{money(Math.abs(snippetResult.parsedAlerts[0]?.amountDisplay) * 100)}</strong></div>
                  <div><span style={{ color: 'var(--muted)' }}>Merchant:</span> <strong>{snippetResult.parsedAlerts[0]?.merchant}</strong></div>
                  <div><span style={{ color: 'var(--muted)' }}>Account Last 4:</span> <strong>{snippetResult.parsedAlerts[0]?.accountLast4 || 'N/A'}</strong></div>
                  <div><span style={{ color: 'var(--muted)' }}>Reference:</span> <strong>{snippetResult.parsedAlerts[0]?.referenceNumber || 'N/A'}</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {emailSubTab === 'SETTINGS' && (
          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--ink)' }}>IMAP Email Connector Settings</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Credentials are encrypted using local AES-256-GCM. Never stored in plaintext.
                </p>
              </div>
              {emailConfig?.configured && (
                <button
                  type="button"
                  className="secondary compact"
                  onClick={handleSyncInboxNow}
                  disabled={syncingInbox}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={14} className={syncingInbox ? 'spin' : ''} />
                  <span>{syncingInbox ? 'Syncing...' : 'Sync Inbox Now'}</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSaveEmailConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '500px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Email Address</label>
                <input
                  type="email"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                  placeholder="your-email@gmail.com"
                  required
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid var(--line)', padding: '0 10px', background: 'var(--background-alt)', color: 'var(--ink)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>IMAP Host</label>
                  <input
                    type="text"
                    value={emailForm.host}
                    onChange={(e) => setEmailForm({ ...emailForm, host: e.target.value })}
                    placeholder="imap.gmail.com"
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid var(--line)', padding: '0 10px', background: 'var(--background-alt)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Port</label>
                  <input
                    type="number"
                    value={emailForm.port}
                    onChange={(e) => setEmailForm({ ...emailForm, port: parseInt(e.target.value, 10) || 993 })}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid var(--line)', padding: '0 10px', background: 'var(--background-alt)', color: 'var(--ink)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>App Password / Token</label>
                <input
                  type="password"
                  value={emailForm.password}
                  onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                  placeholder="Generate a Gmail App Password in Google Account settings"
                  required
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid var(--line)', padding: '0 10px', background: 'var(--background-alt)', color: 'var(--ink)' }}
                />
              </div>

              <button
                type="submit"
                className="primary"
                disabled={savingConfig}
                style={{ alignSelf: 'flex-start', marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} />
                <span>{savingConfig ? 'Encrypting & Saving…' : 'Save Encrypted Connection'}</span>
              </button>
            </form>
          </div>
        )}

        {emailSubTab === 'LOGS' && (
          <div className="panel" style={{ padding: '24px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--ink)' }}>Email Ingestion Activity Logs</h4>
            {loadingEmailLogs ? (
              <div className="loading"><span/><p>Loading sync logs...</p></div>
            ) : emailLogs.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No email ingestion activity recorded yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--muted)' }}>
                      <th style={{ padding: '8px' }}>Timestamp</th>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Alerts Parsed</th>
                      <th style={{ padding: '8px' }}>Snippet Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px', color: 'var(--muted)' }}>{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ background: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '10px' }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px', fontWeight: 700 }}>{log.alertsParsed} alert(s)</td>
                        <td style={{ padding: '8px', color: 'var(--muted)', fontFamily: 'monospace', fontSize: '11px' }}>{log.sourceSnippet ? log.sourceSnippet.slice(0, 60) + '...' : 'Inbox Sync Run'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    ) : (
      <>
        <section className="unified-import-card panel"><form onSubmit={upload}><fieldset className="import-kind-picker"><legend>1. What are you importing?</legend>
      <div>{catalog.options.map((option) => { const Icon = kindIcon(option.kind); return <button type="button" key={option.kind}
        className={kind === option.kind ? 'selected' : ''} aria-pressed={kind === option.kind} onClick={() => chooseKind(option.kind)}><Icon/><span><strong>{option.label}</strong><small>{option.description}</small></span></button>; })}</div></fieldset>
      <div className="unified-fields"><label>2. Source<select value={sourceOption.source} onChange={(event) => chooseSource(event.target.value)}>
        {kindOption?.sources.map((option) => <option key={option.source} value={option.source}>{option.label}</option>)}</select>
        <small>{sourceOption.description} <a href={SOURCE_URLS[sourceOption.source] ?? '#'} target="_blank" rel="noreferrer">Download from portal</a></small></label>
        <label>3. Destination account<select value={accountId} onChange={(event) => { setAccountId(event.target.value); setPdfPassword(''); setRememberPassword(false); setError(''); setNotice(''); setSyncWarning(''); }}>
          <option value="">✨ Auto-detect account from statement (Recommended)</option>
          {eligibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.institution ? ` · ${account.institution}` : ''}</option>)}
        </select>
        <small>{accountId ? 'Selected destination account.' : 'YAFT will automatically match or create the destination account.'}</small></label></div>
      <label className={`dropzone unified-dropzone ${files.length ? 'has-file' : ''}`}><input key={fileKey} type="file" accept={accept} multiple={kind !== 'BROKER_HOLDINGS'} required onChange={(event) => { setFiles(Array.from(event.target.files || [])); setPdfPassword(''); setRememberPassword(false); setError(''); setNotice(''); setSyncWarning(''); }}/>
        {files.length ? (
          files.length === 1 ? (
            <><FileSpreadsheet size={38}/><strong>{files[0].name}</strong><span>{(files[0].size / 1024).toFixed(0)} KB · ready for {sourceOption.label} validation</span></>
          ) : (
            <><FileSpreadsheet size={38}/><strong>{files.length} {fileLabel}s selected</strong><span>{files.map((f) => f.name).join(', ')}</span></>
          )
        ) : (
          <><UploadCloud size={42}/><strong>Choose the {fileLabel}{kind !== 'BROKER_HOLDINGS' ? 's' : ''}</strong><span>{sourceOption.extensions.map((item) => item.slice(1).toUpperCase()).join(', ')} · up to {sourceOption.maxBytes / 1024 / 1024} MB</span></>
        )}</label>
      {kind === 'SALARY_PAYSLIP' && (
        <section className="password-panel" style={{ marginTop: '14px', marginBottom: '14px' }}>
          <div className="password-status"><BadgeIndianRupee/><span><strong>Salary Payout Type</strong>
            <small>Identify standard salary sheets vs bonuses or variable pay.</small></span></div>
          <label>Payout Type<select value={salaryType} onChange={(event) => setSalaryType(event.target.value)}>
            <option value="SALARY">Regular Salary</option>
            <option value="BONUS">Bonus Payout</option>
            <option value="VARIABLE_PAY">Variable Pay</option>
          </select></label>
        </section>
      )}
      {sourceOption.pdfPasswordSupported && isPdf && <section className="password-panel"><div className="password-status"><KeyRound/><span><strong>PDF document password</strong>
        <small>{selectedAccount?.hasStatementPassword ? 'A saved password can unlock this account’s SBI PDF.' : 'Protected PDFs require a password.'}</small></span>
        {selectedAccount?.hasStatementPassword && <button type="button" className="ghost compact" disabled={busy} onClick={() => void forgetPassword()}><Trash2/>Forget</button>}</div>
        <label>One-time document-opening password<input type="password" maxLength={128} autoComplete="off" value={pdfPassword}
          placeholder={source === 'AXIS_CC' ? 'e.g. FIRST4LETTERS + LAST4CARDDIGITS (JOHN4321)' : selectedAccount?.hasStatementPassword ? 'Leave blank to use saved password' : 'Enter PDF password'} onChange={(event) => { setPdfPassword(event.target.value); if (!event.target.value) setRememberPassword(false); }}/></label>
        {source === 'AXIS_CC' && (
          <p className="notice" style={{ marginTop: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <KeyRound size={15}/> <span><strong>Axis Credit Card Password:</strong> First 4 letters of your name in UPPERCASE + Last 4 digits of your card (e.g. <code>JOHN4321</code>).</span>
          </p>
        )}
        {sourceOption.rememberPasswordSupported && <label className="remember-choice"><input type="checkbox" checked={rememberPassword} disabled={!pdfPassword}
          onChange={(event) => setRememberPassword(event.target.checked)}/><span><Check/></span><div><strong>Remember securely for this SBI account</strong><small>Saved only after this SBI PDF unlocks and verifies successfully.</small></div></label>}</section>}
      {!eligibleAccounts.length && sourceOption.accountRequired && <p className="notice"><AlertTriangle/>No eligible {sourceOption.label} account exists. <Link href="/dashboard">Add the matching account</Link> first.</p>}
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="success-note" role="status"><ShieldCheck/>{notice}</p>}
      {syncWarning && <p className="notice refresh-warning" role="status"><AlertTriangle/>{syncWarning}</p>}
      <button className="primary wide" disabled={busy || !files.length || (sourceOption.accountRequired && !accountId)}>{busy ? <><RefreshCw className="spin"/>Validating…</> : kind === 'BROKER_HOLDINGS' ? 'Validate and replace snapshot' : files.length > 1 ? 'Validate and create reviews' : 'Validate and create review'}</button>
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
        <span>{item.kind === 'BANK_STATEMENT' ? 'Bank statement' : item.kind === 'CREDIT_CARD_STATEMENT' ? 'Credit card statement' : 'Salary payslip'}</span><strong>{item.kind === 'SALARY_PAYSLIP' ? (item as any).review.employer : `${(item as any).review.account.name}${(item as any).review.account.last4 ? ` (••••${(item as any).review.account.last4})` : ''}`}</strong><small>{new Date(item.createdAt).toLocaleString('en-IN')}</small></button>)}</nav>
        {selectedPending?.kind === 'BANK_STATEMENT' || selectedPending?.kind === 'CREDIT_CARD_STATEMENT' ? <BankReviewPanel item={selectedPending as BankPending} busy={busy} update={updateBank} finish={finishReview}/>
          : selectedPending?.kind === 'SALARY_PAYSLIP' ? <SalaryReviewPanel item={selectedPending} busy={busy} finish={finishReview} download={downloadReview}/> : null}</>
        : <div className="unified-empty panel"><ShieldCheck/><strong>No reviews waiting</strong><p>Validated bank statements and payslips will appear here before they are committed.</p></div>}
      </section>
      </>
    )}
  </Shell>;
}

function BankReviewPanel({ item, busy, update, finish }: { item: BankPending; busy: boolean;
  update: (item: BankPending, row: BankRow, changes: { include?: boolean; categoryId?: string }) => void;
  finish: (item: PendingImport, action: 'commit' | 'discard') => void }) {
  const included = item.review.staged.filter((row) => row.include && !row.isDuplicate);
  const duplicates = item.review.staged.filter((row) => row.isDuplicate).length;
  const accountDetails = `${item.review.account.name}${item.review.account.last4 ? ` (••••${item.review.account.last4})` : ''}`;
  return <><section className="review-summary"><div><FileSpreadsheet/><span><strong>{item.review.filename}</strong><small>{accountDetails} · {item.source}</small></span></div>
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
