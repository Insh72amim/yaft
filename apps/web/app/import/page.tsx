'use client';
import { AlertTriangle, ArrowLeft, ArrowUpRight, BadgeIndianRupee, BriefcaseBusiness, Building2, Calendar, Check, CreditCard, Eye, FileSpreadsheet, KeyRound, Landmark,
  Mail, RefreshCw, ShieldCheck, Smartphone, Trash2, UploadCloud, X, TrendingUp, ExternalLink, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, downloadFile, errorMessage, isUnauthorized, money } from '@/lib/api';

type ImportKind = 'BANK_STATEMENT' | 'SALARY_PAYSLIP' | 'BROKER_HOLDINGS' | 'UPI_STATEMENT';
type Account = { id: string; name: string; type: string; institution: string | null; currency: string; hasStatementPassword: boolean };
type SourceOption = { source: string; label: string; description: string; extensions: string[]; maxBytes: number; accountRequired: boolean;
  commitMode: 'REVIEW_REQUIRED' | 'IMMEDIATE_ATOMIC_REPLACEMENT'; pdfPasswordSupported: boolean; rememberPasswordSupported: boolean; eligibleAccountIds: string[] };
type KindOption = { kind: ImportKind; label: string; description: string; sources: SourceOption[] };
type OrganizationInfo = { id: string; name: string; code?: string | null; isCurrent: boolean };
type Catalog = { accounts: Account[]; organizations?: OrganizationInfo[]; options: KindOption[] };
type Category = { id: string; name: string; color: string };
type BankRow = {
  id: string;
  rowNumber: number;
  transactionDate: string;
  postedDate: string | null;
  descriptionRaw: string;
  merchant: string | null;
  amount: number;
  reference: string | null;
  categoryId: string | null;
  isDuplicate: boolean;
  include: boolean;
  confidence: number;
  emailReference?: {
    messageId?: string | null;
    subject?: string | null;
    sender?: string | null;
    date?: string | null;
    snippet?: string | null;
  } | null;
};
type BankReview = { id: string; filename: string; status: string; rowCount: number; createdAt: string; account: { id: string; name: string; institution?: string | null; last4?: string | null };
  categories: Category[]; staged: BankRow[]; statementBalance: number | null };
type SalaryItem = { id: string; type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION'; description: string; currentAmount: number; ytdAmount: number | null };
type SalaryReview = { id: string; filename: string; payPeriod: string; employer: string; employeeName?: string; employeeNumberLast4?: string;
  department?: string; designation?: string; bankName?: string; bankAccountLast4?: string; uanLast4?: string; currency: string;
  grossEarnings: number; grossDeductions: number; directPayment: number; netPay: number; status: string; createdAt: string; lineItems: SalaryItem[] };
type BankPending = { kind: 'BANK_STATEMENT'; source: string; mode: 'REVIEW_REQUIRED'; createdAt: string; review: BankReview;
  actions: { commit: string; discard: string; updateRow: string } };
type SalaryPending = { kind: 'SALARY_PAYSLIP'; source: 'STANDARD_PAYSLIP'; mode: 'REVIEW_REQUIRED'; createdAt: string; review: SalaryReview;
  actions: { commit: string; discard: string } };
type PendingImport = BankPending | SalaryPending;
type ReviewUploadResult = Omit<BankPending, 'createdAt'> | Omit<SalaryPending, 'createdAt'>;
type HoldingsUploadResult = { kind: 'BROKER_HOLDINGS'; source: 'ZERODHA_KITE' | 'GROWW'; mode: 'IMMEDIATE_ATOMIC_REPLACEMENT';
  message: string; result: { imported: number } };

function kindIcon(kind: string) {
  if (kind === 'BANK_STATEMENT') return Landmark;
  if (kind === 'SALARY_PAYSLIP') return BadgeIndianRupee;
  if (kind === 'BROKER_HOLDINGS') return BriefcaseBusiness;
  if (kind === 'UPI_STATEMENT') return Smartphone;
  return Landmark;
}

function getPendingKindLabel(item: PendingImport, accounts?: Account[]) {
  if (item.kind === 'SALARY_PAYSLIP') return 'Salary payslip';
  const account = accounts?.find((a) => a.id === item.review.account?.id);
  const accountType = account?.type || (item.review.account as any)?.type;
  const filename = (item.review as any)?.filename || '';
  const isCreditCard =
    accountType === 'CREDIT_CARD' ||
    item.source?.includes('CC') ||
    filename.toUpperCase().includes('CREDIT_CARD');

  if (isCreditCard) {
    return filename.startsWith('gmail-sync') ? 'Credit Card Alert' : 'Credit Card Statement';
  }
  return 'Bank Statement';
}

const SOURCE_URLS: Record<string, string> = {
  SBI: 'https://yonoretail.sbi.bank.in/registration/welcome',
  PNB: 'https://iretail.pnb.bank.in/',
  AXIS: 'https://omni.axis.bank.in/axisretailbanking/',
  STANDARD_PAYSLIP: 'https://workday.com/',
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

const PORTAL_CATEGORIES = [
  {
    title: 'NetBanking Portals',
    icon: Landmark,
    color: '#3b82f6',
    portals: [
      { name: 'HDFC Bank', url: 'https://netbanking.hdfcbank.com/', sub: 'NetBanking' },
      { name: 'ICICI Bank', url: 'https://infinity.icicibank.com/', sub: 'Infinity Retail' },
      { name: 'SBI Online', url: 'https://yonoretail.sbi.bank.in/registration/welcome', sub: 'YONO NetBanking' },
      { name: 'Axis Bank', url: 'https://omni.axis.bank.in/axisretailbanking/', sub: 'Omni Retail' },
      { name: 'Kotak Bank', url: 'https://netbanking.kotak.com/knb2/', sub: 'NetBanking' },
      { name: 'PNB Online', url: 'https://iretail.pnb.bank.in/', sub: 'Retail NetBanking' },
    ],
  },
  {
    title: 'Brokers & Investments',
    icon: TrendingUp,
    color: '#10b981',
    portals: [
      { name: 'Groww', url: 'https://groww.in/user/profile/report', sub: 'Reports & P&L' },
      { name: 'Zerodha', url: 'https://console.zerodha.com/portfolio/holdings', sub: 'Console Holdings' },
      { name: 'INDmoney', url: 'https://www.indmoney.com/login', sub: 'Portfolio' },
    ],
  },
  {
    title: 'Retirement & Taxes',
    icon: ShieldCheck,
    color: '#f59e0b',
    portals: [
      { name: 'EPFO Passbook', url: 'https://passbook.epfindia.gov.in/MemberPassBook/Login', sub: 'UAN Member' },
      { name: 'Income Tax', url: 'https://eportal.incometax.gov.in/iec/foservices/#/login', sub: 'AIS / TIS Portal' },
    ],
  },
];

import { ImportSourceType } from "@/lib/constants";

type HistoryImportItem = {
  id: string;
  sourceType: ImportSourceType;
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

  // Email Transaction Alert Ingestion States
  const [emailSubTab, setEmailSubTab] = useState<'GMAIL_OAUTH' | 'LOGS'>('GMAIL_OAUTH');
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);

  // Google OAuth States
  const [googleConfig, setGoogleConfig] = useState<any>(null);
  const [loadingGoogleConfig, setLoadingGoogleConfig] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [syncDays, setSyncDays] = useState(90);
  const [syncAccountScope, setSyncAccountScope] = useState<'ALL' | 'ALL_BANKS' | 'ALL_CARDS' | 'ALL_INVESTMENTS' | 'CUSTOM'>('ALL');
  const [selectedSyncAccountIds, setSelectedSyncAccountIds] = useState<string[]>([]);
  const [lastSyncMeta, setLastSyncMeta] = useState<any>(null);

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

  const loadGoogleConfig = useCallback(async () => {
    try {
      setLoadingGoogleConfig(true);
      const cfg = await api<any>('/email-ingestion/google/config');
      setGoogleConfig(cfg);
    } catch {} finally {
      setLoadingGoogleConfig(false);
    }
  }, []);

  const handleConnectGoogle = async () => {
    try {
      setConnectingGoogle(true);
      setError('');
      const redirectUri = window.location.origin + window.location.pathname;
      const res = await api<any>(`/email-ingestion/google/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`);
      if (res.authUrl) {
        window.location.href = res.authUrl;
      } else {
        setError(res.message || 'Google OAuth is not configured on the backend server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to get Google OAuth URL.'));
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleSyncGmailNow = async (customDays?: number, emailId?: string) => {
    const daysToSync = typeof customDays === 'number' ? customDays : syncDays;
    setSyncingGmail(true); setError(''); setNotice('');
    try {
      const res = await api<any>('/email-ingestion/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          days: daysToSync,
          emailId,
          accountScope: syncAccountScope,
          targetAccountIds: syncAccountScope === 'CUSTOM' ? selectedSyncAccountIds : undefined,
        }),
      });
      setNotice(res.message);
      if (res.dateRange) {
        setLastSyncMeta(res.dateRange);
      }
      await loadGoogleConfig();
      const firstBatchId = res.batchIds?.[0] || res.batchId;
      await refreshPending(firstBatchId);
      if (firstBatchId || (res.batchIds && res.batchIds.length > 0)) {
        setActiveTab('UPLOAD');
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not sync Gmail transaction alerts.'));
    } finally {
      setSyncingGmail(false);
    }
  };

  const handleDisconnectGoogle = async (emailId?: string, emailName?: string) => {
    const confirmMsg = emailName
      ? `Are you sure you want to disconnect ${emailName}?`
      : 'Are you sure you want to disconnect Google Account(s)?';
    if (!confirm(confirmMsg)) return;
    setError(''); setNotice('');
    try {
      const url = emailId ? `/email-ingestion/google/disconnect?emailId=${encodeURIComponent(emailId)}` : '/email-ingestion/google/disconnect';
      const res = await api<any>(url, { method: 'DELETE' });
      setNotice(res.message);
      await loadGoogleConfig();
    } catch (err) {
      setError(errorMessage(err, 'Failed to disconnect Google Account.'));
    }
  };

  const loadEmailLogs = useCallback(async () => {
    try {
      setLoadingEmailLogs(true);
      const logs = await api<any[]>('/email-ingestion/logs');
      setEmailLogs(logs || []);
    } catch {} finally {
      setLoadingEmailLogs(false);
    }
  }, []);

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
      // For salary payslip, always prefer the current employer's ORG_ source.
      if (selectedKind?.kind === 'SALARY_PAYSLIP') {
        const currentSrc = selectedKind.sources.find((s) => (s as any).isCurrent);
        if (currentSrc) setSource(currentSrc.source);
      }
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not prepare the import workspace.'));
    } finally { setLoading(false); }
  }, [requestedAccount, requestedKind, requestedSource, router]);

  useEffect(() => {
    void load();
    loadGoogleConfig();

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      const redirectUri = window.location.origin + window.location.pathname;
      window.history.replaceState({}, '', window.location.pathname);
      setNotice('Connecting Google Account…');
      api<any>('/email-ingestion/google/callback', {
        method: 'POST',
        body: JSON.stringify({ code, redirectUri }),
      })
        .then((res) => {
          setNotice(res.message);
          loadGoogleConfig();
          refreshPending();
        })
        .catch((err) => {
          setError(errorMessage(err, 'Google Account linking failed.'));
        });
    }
  }, [load, loadGoogleConfig, refreshPending]);

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
    // For salary payslips, prefer the current employer; otherwise pick the first source.
    const currentSrc = nextKind === 'SALARY_PAYSLIP'
      ? option?.sources.find((s) => (s as any).isCurrent)
      : undefined;
    const nextSource = currentSrc ?? option?.sources[0];
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

  async function updateBank(item: BankPending, row: BankRow, changes: { include?: boolean; categoryId?: string; descriptionRaw?: string; merchant?: string }) {
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
        className={`secondary ${activeTab === 'EMAIL_SYNC' ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('EMAIL_SYNC');
          loadEmailLogs();
        }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', fontWeight: 600 }}>
        <Mail size={16} color="#3b82f6" />
        <span>Email Auto-Sync & Alert Ingestion</span>
        <span style={{ background: '#3b82f6', color: '#ffffff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>NEW</span>
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
        {pending.length > 0 && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '12px 18px',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#10b981" />
              <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>
                {pending.length} pending import batch{pending.length > 1 ? 'es' : ''} waiting in your Review Queue.
              </strong>
            </div>
            <button
              type="button"
              className="primary compact"
              onClick={() => setActiveTab('UPLOAD')}
              style={{ fontSize: '12px', padding: '6px 14px' }}>
              Go to Review Queue &rarr;
            </button>
          </div>
        )}

        {/* Email Header Banner */}
        {/* Notice & Error Messages */}
        {error && <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16}/><span>{error}</span></div>}
        {notice && <div className="notice-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}><Check size={16}/><span>{notice}</span></div>}

        {emailSubTab === 'LOGS' ? (
          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--ink)' }}>
                  Email Ingestion Activity Logs
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                  Recent transaction alert parsing events and sync history.
                </p>
              </div>
              <button
                type="button"
                className="secondary compact"
                onClick={() => setEmailSubTab('GMAIL_OAUTH')}
                style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} /> Back to Gmail Sync
              </button>
            </div>

            {loadingEmailLogs ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                <span>Loading activity logs…</span>
              </div>
            ) : emailLogs.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>
                <span>No ingestion activity logged yet.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {emailLogs.map((log: any, idx: number) => (
                  <div
                    key={log.id || idx}
                    style={{
                      padding: '12px 16px',
                      background: 'var(--background-alt)',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12.5px',
                    }}>
                    <div>
                      <strong style={{ color: 'var(--ink)', marginRight: '8px' }}>{log.event || log.subject || 'Email Scan'}</strong>
                      <span style={{ color: 'var(--muted)' }}>{log.details || log.message}</span>
                    </div>
                    <small style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header & Main Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ background: '#3b82f6', color: '#fff', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--ink)' }}>
                      Gmail Auto-Sync Engine
                    </h3>
                    {googleConfig?.connected && (
                      <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        ● Connected ({(googleConfig.configs && googleConfig.configs.length) || 1})
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                    Scan and ingest transaction alerts from HDFC, ICICI, SBI, Axis, Kotak, Amex, and Mutual Funds.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => { setEmailSubTab('LOGS'); loadEmailLogs(); }}
                  style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={13} /> Activity Logs
                </button>

                {googleConfig?.connected ? (
                  <>
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={handleConnectGoogle}
                      disabled={connectingGoogle}
                      style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={13} /> + Add Gmail
                    </button>

                    <button
                      type="button"
                      className="primary"
                      onClick={() => handleSyncGmailNow()}
                      disabled={syncingGmail || (syncAccountScope === 'CUSTOM' && selectedSyncAccountIds.length === 0)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}>
                      <RefreshCw size={14} className={syncingGmail ? 'spin' : ''} />
                      <span>
                        {syncingGmail
                          ? `Syncing past ${syncDays} days…`
                          : syncAccountScope === 'ALL_BANKS'
                          ? `Sync Bank Accounts (${syncDays}D)`
                          : syncAccountScope === 'ALL_CARDS'
                          ? `Sync Credit Cards (${syncDays}D)`
                          : syncAccountScope === 'ALL_INVESTMENTS'
                          ? `Sync SIP & Mutual Funds (${syncDays}D)`
                          : syncAccountScope === 'CUSTOM'
                          ? `Sync (${selectedSyncAccountIds.length}) Selected`
                          : `Sync All Inboxes (${syncDays}D)`}
                      </span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="primary"
                    onClick={handleConnectGoogle}
                    disabled={connectingGoogle}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '13px',
                      background: '#4285F4',
                      borderColor: '#4285F4',
                      color: '#ffffff',
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>{connectingGoogle ? 'Connecting…' : 'Connect Google Account'}</span>
                  </button>
                )}
              </div>
            </div>

            {googleConfig?.connected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Connected Inboxes Strip */}
                <div style={{ background: 'var(--background-alt)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Connected Inboxes:
                    </span>
                    {(googleConfig.configs && googleConfig.configs.length > 0 ? googleConfig.configs : [{ id: 'single', email: googleConfig.email, lastSyncAt: googleConfig.lastSyncAt, syncStatus: googleConfig.syncStatus }]).map((cfg: any) => (
                      <div
                        key={cfg.id || cfg.email}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: 'var(--card)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--line)',
                          fontSize: '12px',
                        }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        <strong style={{ color: 'var(--ink)' }}>{cfg.email}</strong>
                        {cfg.lastSyncAt && (
                          <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                            ({new Date(cfg.lastSyncAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDisconnectGoogle(cfg.id !== 'single' ? cfg.id : undefined, cfg.email)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '0 2px',
                            fontSize: '11px',
                            fontWeight: 600,
                            marginLeft: '4px',
                          }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {lastSyncMeta && (
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} color="var(--green)" />
                      <span>Latest Range: <strong>{lastSyncMeta.label || `Past ${lastSyncMeta.daysSynced} days`}</strong></span>
                    </div>
                  )}
                </div>

                {/* Scope & Time Window Toolbar */}
                {(() => {
                  const bankAccounts = (catalog?.accounts || []).filter((a) =>
                    ['BANK', 'SAVINGS'].includes(a.type) &&
                    a.type !== 'UPI_LITE' &&
                    !a.name.toLowerCase().includes('upi lite') &&
                    !a.name.toLowerCase().includes('-fd-') &&
                    !a.name.toLowerCase().includes('loan') &&
                    !a.name.toLowerCase().includes('epfo')
                  );
                  const creditCards = (catalog?.accounts || []).filter((a) => a.type === 'CREDIT_CARD');
                  const investments = (catalog?.accounts || []).filter((a) =>
                    !a.name.toLowerCase().includes('epfo') &&
                    a.type !== 'EPFO' &&
                    (['MUTUAL_FUND', 'STOCKS'].includes(a.type) ||
                      a.name.toLowerCase().includes('sip') ||
                      a.name.toLowerCase().includes('mutual') ||
                      a.name.toLowerCase().includes('coin') ||
                      a.name.toLowerCase().includes('groww') ||
                      a.name.toLowerCase().includes('zerodha'))
                  );

                  const allSupportedAccounts = [...bankAccounts, ...creditCards, ...investments];
                  const allSupportedAccountIds = allSupportedAccounts.map((a) => a.id);

                  const categoriesList = [
                    {
                      key: 'BANKS',
                      title: 'Bank & Savings Accounts',
                      icon: Landmark,
                      color: 'var(--green)',
                      accounts: bankAccounts,
                    },
                    {
                      key: 'CARDS',
                      title: 'Credit Cards',
                      icon: CreditCard,
                      color: '#3b82f6',
                      accounts: creditCards,
                    },
                    {
                      key: 'INVESTMENTS',
                      title: 'SIP & Mutual Funds / Demat',
                      icon: BriefcaseBusiness,
                      color: '#10b981',
                      accounts: investments,
                    },
                  ].filter((cat) => cat.accounts.length > 0);

                  const selectedSupportedCount = selectedSyncAccountIds.filter((id) =>
                    allSupportedAccountIds.includes(id)
                  ).length;

                  return (
                    <div style={{ background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--line)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        {/* Scope Pills */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', marginRight: '4px' }}>
                            Scope:
                          </span>
                          {[
                            { id: 'ALL', label: `All (${allSupportedAccounts.length})`, icon: Landmark },
                            { id: 'ALL_BANKS', label: `Banks (${bankAccounts.length})`, icon: Landmark },
                            { id: 'ALL_CARDS', label: `Cards (${creditCards.length})`, icon: CreditCard },
                            { id: 'ALL_INVESTMENTS', label: `SIP / MF (${investments.length})`, icon: BriefcaseBusiness },
                            { id: 'CUSTOM', label: `Custom ${selectedSupportedCount > 0 ? `(${selectedSupportedCount})` : ''}`, icon: Check },
                          ].map((scope) => {
                            const Icon = scope.icon;
                            const isActive = syncAccountScope === scope.id;
                            return (
                              <button
                                key={scope.id}
                                type="button"
                                onClick={() => {
                                  setSyncAccountScope(scope.id as any);
                                  if (scope.id === 'CUSTOM' && selectedSyncAccountIds.length === 0) {
                                    setSelectedSyncAccountIds(allSupportedAccountIds);
                                  }
                                }}
                                style={{
                                  fontSize: '11.5px',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontWeight: isActive ? 700 : 500,
                                  background: isActive ? 'var(--accent, #3b82f6)' : 'var(--background-alt)',
                                  color: isActive ? '#ffffff' : 'var(--ink)',
                                  border: `1px solid ${isActive ? 'var(--accent, #3b82f6)' : 'var(--line)'}`,
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                }}>
                                <Icon size={12} color={isActive ? '#ffffff' : 'var(--muted)'} />
                                <span>{scope.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Scan Time Window Segmented Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--background-alt)', padding: '3px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', padding: '0 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={12} />
                          </span>
                          {[
                            { days: 7, label: '7D' },
                            { days: 30, label: '30D' },
                            { days: 90, label: '90D (3M)' },
                            { days: 180, label: '180D (6M)' },
                          ].map((preset) => (
                            <button
                              key={preset.days}
                              type="button"
                              onClick={() => setSyncDays(preset.days)}
                              style={{
                                fontSize: '11px',
                                padding: '3px 8px',
                                borderRadius: '5px',
                                border: syncDays === preset.days ? '1px solid var(--line)' : '1px solid transparent',
                                fontWeight: syncDays === preset.days ? 700 : 500,
                                background: syncDays === preset.days ? 'var(--card)' : 'transparent',
                                color: syncDays === preset.days ? 'var(--accent, #3b82f6)' : 'var(--muted)',
                                boxShadow: syncDays === preset.days ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer',
                              }}>
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Specific Accounts Filter (Compact Tag Grid) */}
                      {syncAccountScope === 'CUSTOM' && (
                        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                              Select the specific accounts you want to scan and sync:
                            </span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedSyncAccountIds(allSupportedAccountIds)}
                                style={{ fontSize: '11px', color: 'var(--green)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                Select All ({allSupportedAccounts.length})
                              </button>
                              <span style={{ color: 'var(--line)' }}>|</span>
                              <button
                                type="button"
                                onClick={() => setSelectedSyncAccountIds([])}
                                style={{ fontSize: '11px', color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                Deselect All
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {categoriesList.map((catGroup) => {
                              const groupAccountIds = catGroup.accounts.map((a) => a.id);
                              const selectedInGroupCount = groupAccountIds.filter((id) =>
                                selectedSyncAccountIds.includes(id)
                              ).length;
                              const allSelectedInGroup = selectedInGroupCount === groupAccountIds.length;

                              const toggleGroupAll = () => {
                                if (allSelectedInGroup) {
                                  setSelectedSyncAccountIds((prev) =>
                                    prev.filter((id) => !groupAccountIds.includes(id))
                                  );
                                } else {
                                  setSelectedSyncAccountIds((prev) =>
                                    Array.from(new Set([...prev, ...groupAccountIds]))
                                  );
                                }
                              };

                              return (
                                <div key={catGroup.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--ink)' }}>
                                        {catGroup.title}
                                      </span>
                                      <span style={{ fontSize: '10px', color: 'var(--muted)', background: 'var(--background-alt)', padding: '1px 5px', borderRadius: '6px', fontWeight: 600 }}>
                                        {selectedInGroupCount}/{catGroup.accounts.length}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={toggleGroupAll}
                                      style={{
                                        fontSize: '10.5px',
                                        color: allSelectedInGroup ? 'var(--muted)' : 'var(--green)',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                      }}>
                                      {allSelectedInGroup ? 'Deselect All' : 'Select All'}
                                    </button>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
                                    {catGroup.accounts.map((acc) => {
                                      const isChecked = selectedSyncAccountIds.includes(acc.id);
                                      return (
                                        <button
                                          key={acc.id}
                                          type="button"
                                          onClick={() => {
                                            if (isChecked) {
                                              setSelectedSyncAccountIds((prev) => prev.filter((id) => id !== acc.id));
                                            } else {
                                              setSelectedSyncAccountIds((prev) => [...prev, acc.id]);
                                            }
                                          }}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '6px 10px',
                                            borderRadius: '6px',
                                            background: isChecked ? 'rgba(29, 117, 79, 0.08)' : 'var(--background-alt)',
                                            border: `1px solid ${isChecked ? 'var(--green)' : 'var(--line)'}`,
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.1s ease',
                                          }}>
                                          <span
                                            style={{
                                              width: '14px',
                                              height: '14px',
                                              borderRadius: '3px',
                                              border: `1.5px solid ${isChecked ? 'var(--green)' : 'var(--muted)'}`,
                                              background: isChecked ? 'var(--green)' : 'transparent',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: '#fff',
                                              fontSize: '10px',
                                              fontWeight: 900,
                                              flexShrink: 0,
                                            }}>
                                            {isChecked ? '✓' : ''}
                                          </span>
                                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                              {acc.name}
                                            </span>
                                            <span style={{ fontSize: '9.5px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                              {acc.institution || acc.type}
                                            </span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ background: 'var(--background-alt)', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '13px', lineHeight: 1.6, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: '6px' }}>🔒 Privacy &amp; Security Guarantees:</strong>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li><strong>Multiple Google Accounts Supported</strong>: Connect separate Gmail accounts for different bank accounts &amp; credit cards.</li>
                  <li><strong>Supported Ingestion</strong>: Bank savings alerts, credit card transaction emails, and SIP/Mutual Fund allotment notices.</li>
                  <li><strong>Read-Only Access</strong>: YAFT only requests read-only permission to detect transaction alert subjects &amp; amounts.</li>
                  <li><strong>Local Token Encryption</strong>: OAuth refresh tokens are encrypted at rest using local AES-256-GCM.</li>
                </ul>
              </div>
            )}
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
        {kindOption?.sources.map((option) => <option key={option.source} value={option.source}>
          {option.label}{(option as any).isCurrent ? ' ✓ Current' : ''}
        </option>)}</select>
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
      <aside
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          padding: '22px',
          background: 'var(--background-alt)',
          borderRadius: '16px',
          border: '1px solid var(--line)',
        }}
      >
        {/* Source-specific safety card */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
              Source-specific safety
            </h2>
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
            {kind === 'BROKER_HOLDINGS'
              ? 'Zerodha holdings replace the selected account’s prior snapshot immediately, but only inside one atomic operation after every supported sheet and printed total reconciles.'
              : 'This file creates a pending review. Nothing enters your ledger or salary history until you approve the reconciled rows below.'}
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {[
              'Original files are not retained',
              'Unknown or changed layouts fail closed',
              'Passwords never apply to holdings',
            ].map((text, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--ink)',
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={10} strokeWidth={3} />
                </div>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ height: '1px', background: 'var(--line)' }} />

        {/* Categorized Quick Access Portals */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Quick Access Portals
            </span>
            <small style={{ fontSize: '11px', color: 'var(--muted)' }}>Official Portals</small>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {PORTAL_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.title}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: category.color,
                    }}
                  >
                    <Icon size={13} />
                    <span>{category.title}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {category.portals.map((portal) => (
                      <a
                        key={portal.name}
                        href={portal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1px',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          background: 'var(--card)',
                          border: '1px solid var(--line)',
                          textDecoration: 'none',
                          color: 'var(--ink)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = category.color;
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = `0 2px 8px ${category.color}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--line)';
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>{portal.name}</span>
                          <ExternalLink size={10} style={{ color: 'var(--muted)', opacity: 0.7 }} />
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{portal.sub}</span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </section>

    <section className="pending-workspace"><div className="panel-title"><div><span className="eyebrow">Review queue</span><h2>{pending.length} pending import{pending.length === 1 ? '' : 's'}</h2></div></div>
      {pending.length ? <><nav className="pending-tabs" aria-label="Pending imports">{pending.map((item) => <button type="button" key={item.review.id}
        className={item.review.id === selectedReviewId ? 'selected' : ''} aria-pressed={item.review.id === selectedReviewId} onClick={() => setSelectedReviewId(item.review.id)}>
        <span>{getPendingKindLabel(item, catalog?.accounts)}</span><strong>{item.kind === 'SALARY_PAYSLIP' ? (item as any).review.employer : `${(item as any).review.account.name}${(item as any).review.account.last4 ? ` (••••${(item as any).review.account.last4})` : ''}`}</strong><small>{new Date(item.createdAt).toLocaleString('en-IN')}</small></button>)}</nav>
        {selectedPending?.kind === 'BANK_STATEMENT' ? <BankReviewPanel item={selectedPending as BankPending} accounts={catalog?.accounts} busy={busy} update={updateBank} finish={finishReview}/>
          : selectedPending?.kind === 'SALARY_PAYSLIP' ? <SalaryReviewPanel item={selectedPending} busy={busy} finish={finishReview} download={downloadReview}/> : null}</>
        : <div className="unified-empty panel"><ShieldCheck/><strong>No reviews waiting</strong><p>Validated bank statements and payslips will appear here before they are committed.</p></div>}
      </section>
      </>
    )}
  </Shell>;
}

function BankReviewPanel({ item, accounts, busy, update, finish }: { item: BankPending; accounts?: Account[]; busy: boolean;
  update: (item: BankPending, row: BankRow, changes: { include?: boolean; categoryId?: string; descriptionRaw?: string; merchant?: string }) => void;
  finish: (item: PendingImport, action: 'commit' | 'discard') => void }) {
  const [selectedEmailRef, setSelectedEmailRef] = useState<{
    row: BankRow;
    ref: NonNullable<BankRow['emailReference']>;
  } | null>(null);
  const included = item.review.staged.filter((row) => row.include && !row.isDuplicate);
  const duplicates = item.review.staged.filter((row) => row.isDuplicate).length;
  const accountDetails = `${item.review.account.name}${item.review.account.last4 ? ` (••••${item.review.account.last4})` : ''}`;
  const statementTypeLabel = getPendingKindLabel(item, accounts);
  return <><section className="review-summary"><div><FileSpreadsheet/><span><strong>{item.review.filename}</strong><small>{accountDetails} · {statementTypeLabel}</small></span></div>
    <div><span><strong>{item.review.staged.length}</strong><small>rows found</small></span><span><strong>{duplicates}</strong><small>duplicates</small></span>
      <span><strong>{money(included.reduce((sum, row) => sum + row.amount, 0))}</strong><small>net movement</small></span>
      {item.review.statementBalance != null && <span><strong>{money(item.review.statementBalance)}</strong><small>predicted closing balance</small></span>}
    </div></section>
    <section className="review-table panel"><div className="review-head"><span>Include</span><span>Date &amp; description</span><span>Category</span><span>Amount</span><span style={{ textAlign: 'center' }}>Proof</span></div>
      {item.review.staged.map((row) => (
        <BankReviewRowItem
          key={row.id}
          item={item}
          row={row}
          busy={busy}
          update={update}
          onViewMail={(ref) => setSelectedEmailRef({ row, ref })}
        />
      ))}</section>
    <div className="commit-bar"><div><ShieldCheck/><span><strong>{included.length} transactions ready</strong><small>Duplicates and unchecked rows will be skipped.</small></span></div>
      <div className="review-actions"><button type="button" className="ghost" disabled={busy} onClick={() => void finish(item, 'discard')}>Discard</button>
        <button type="button" className="primary" disabled={busy || !included.length} onClick={() => void finish(item, 'commit')}>{busy ? 'Working…' : 'Approve & import'}</button></div></div>

    {selectedEmailRef && (
      <div
        className="modal-backdrop"
        onClick={() => setSelectedEmailRef(null)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
        }}
      >
        <div
          className="modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Mail style={{ width: '18px', height: '18px' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  Source Email Reference
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                  Gmail Alert Ingestion Details
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEmailRef(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'var(--bg-subtle, rgba(255,255,255,0.03))', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Account</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{accountDetails}</span>
              </div>
              <div style={{ background: 'var(--bg-subtle, rgba(255,255,255,0.03))', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Amount</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: selectedEmailRef.row.amount < 0 ? '#ef4444' : '#10b981' }}>{money(selectedEmailRef.row.amount)}</span>
              </div>
            </div>

            {selectedEmailRef.ref.sender && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>Sender</span>
                <div style={{ fontSize: '13px', fontWeight: 500, background: 'var(--bg-subtle, rgba(255,255,255,0.03))', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                  {selectedEmailRef.ref.sender}
                </div>
              </div>
            )}

            {selectedEmailRef.ref.subject && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>Subject</span>
                <div style={{ fontSize: '13px', fontWeight: 600, background: 'var(--bg-subtle, rgba(255,255,255,0.03))', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                  {selectedEmailRef.ref.subject}
                </div>
              </div>
            )}

            {selectedEmailRef.ref.date && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>Received At</span>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {new Date(selectedEmailRef.ref.date).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' })}
                </div>
              </div>
            )}

            {selectedEmailRef.ref.snippet && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Parsed Email Content</span>
                <div
                  style={{
                    fontSize: '12px',
                    lineHeight: '1.6',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg-card-muted, rgba(0,0,0,0.25))',
                    border: '1px solid var(--line)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {selectedEmailRef.ref.snippet}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-subtle, rgba(255,255,255,0.02))',
            }}
          >
            {selectedEmailRef.ref.messageId ? (
              <a
                href={`https://mail.google.com/mail/u/0/#inbox/${selectedEmailRef.ref.messageId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#3b82f6',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                <span>Open in Gmail</span>
                <ArrowUpRight style={{ width: '14px', height: '14px' }} />
              </a>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={() => setSelectedEmailRef(null)}
              className="button secondary compact"
              style={{ padding: '6px 16px', fontSize: '13px' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </>;
}

function BankReviewRowItem({
  item,
  row,
  busy,
  update,
  onViewMail,
}: {
  item: BankPending;
  row: BankRow;
  busy: boolean;
  update: (item: BankPending, row: BankRow, changes: { include?: boolean; categoryId?: string; descriptionRaw?: string; merchant?: string }) => void;
  onViewMail?: (ref: NonNullable<BankRow['emailReference']>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [descValue, setDescValue] = useState(row.merchant || row.descriptionRaw);

  useEffect(() => {
    setDescValue(row.merchant || row.descriptionRaw);
  }, [row.merchant, row.descriptionRaw]);

  const handleSave = () => {
    setIsEditing(false);
    const trimmed = descValue.trim();
    if (trimmed && trimmed !== (row.merchant || row.descriptionRaw)) {
      update(item, row, {
        descriptionRaw: trimmed,
        merchant: trimmed,
      });
    }
  };

  const handleCancel = () => {
    setDescValue(row.merchant || row.descriptionRaw);
    setIsEditing(false);
  };

  const hasMailProof = Boolean(row.emailReference && (row.emailReference.snippet || row.emailReference.subject || row.emailReference.messageId));

  return (
    <div className={`review-row ${!row.include ? 'excluded' : ''}`}>
      <label className="check">
        <input
          type="checkbox"
          checked={row.include}
          disabled={busy || row.isDuplicate}
          aria-label={`Include ${row.merchant || row.descriptionRaw}`}
          onChange={(event) => void update(item, row, { include: event.target.checked })}
        />
        <span><Check /></span>
      </label>

      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '420px', padding: '4px 0' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
                placeholder="Edit transaction description"
                autoFocus
                style={{
                  fontSize: '12.5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1.5px solid var(--accent)',
                  background: 'var(--card)',
                  color: 'var(--ink)',
                  fontWeight: 600,
                  width: '100%',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleSave}
                title="Save description (Enter)"
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={handleCancel}
                title="Cancel (Esc)"
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: 'var(--background-alt)',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
            <small style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
              Original: {row.descriptionRaw} · Press Enter to save
            </small>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <strong
                onDoubleClick={() => setIsEditing(true)}
                title="Double click or click pencil to edit description"
                style={{ cursor: 'pointer' }}
              >
                {row.merchant || row.descriptionRaw}
              </strong>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Edit description"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.color = 'var(--accent)';
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.color = 'var(--muted)';
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <Pencil size={11} />
              </button>
              {hasMailProof && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                  }}
                >
                  <Mail style={{ width: '10px', height: '10px' }} />
                  <span>Gmail Ingested</span>
                </span>
              )}
            </div>
            <small>
              Value {new Date(row.transactionDate).toLocaleDateString('en-IN')}
              {row.postedDate ? ` · Posted ${new Date(row.postedDate).toLocaleDateString('en-IN')}` : ''}
              {row.merchant && row.merchant !== row.descriptionRaw ? ` · Original: ${row.descriptionRaw}` : ''}
            </small>
            {row.isDuplicate && (
              <em>
                <AlertTriangle size={12} />
                Likely duplicate
              </em>
            )}
          </div>
        )}
      </div>

      <select
        aria-label={`Category for ${row.merchant || row.descriptionRaw}`}
        value={row.categoryId ?? ''}
        disabled={busy}
        onChange={(event) => void update(item, row, { categoryId: event.target.value })}
      >
        <option value="">Uncategorised</option>
        {item.review.categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <b className={row.amount > 0 ? 'positive' : ''}>{money(row.amount)}</b>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {hasMailProof && onViewMail ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewMail(row.emailReference!);
            }}
            title="View original email proof"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '5px 10px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              width: '100%',
              maxWidth: '95px',
            }}
          >
            <Eye size={13} />
            <span>View Mail</span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="No email proof attached to this record"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 500,
              padding: '5px 10px',
              borderRadius: '8px',
              background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
              color: 'var(--muted)',
              border: '1px solid var(--line)',
              cursor: 'not-allowed',
              opacity: 0.45,
              whiteSpace: 'nowrap',
              width: '100%',
              maxWidth: '95px',
            }}
          >
            <Eye size={13} />
            <span>View Mail</span>
          </button>
        )}
      </div>
    </div>
  );
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
