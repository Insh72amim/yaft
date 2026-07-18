'use client';
import { AlertTriangle, ArrowLeft, Check, FileSpreadsheet, KeyRound, RefreshCw, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, isUnauthorized, money } from '@/lib/api';

type Account = { id: string; name: string; type: string; institution?: string; hasStatementPassword: boolean };
type Batch = { id: string; filename: string; account: Account; status: string; categories: { id: string; name: string }[]; staged: Row[] };
type Row = { id: string; rowNumber: number; transactionDate: string; postedDate?: string; descriptionRaw: string; merchant?: string; amount: number; include: boolean; isDuplicate: boolean; confidence: number; categoryId?: string };

export default function ImportPage() {
  const router = useRouter(); const [accounts, setAccounts] = useState<Account[]>([]); const [batch, setBatch] = useState<Batch>(); const [file, setFile] = useState<File>(); const [accountId, setAccountId] = useState(''); const [pdfPassword, setPdfPassword] = useState(''); const [rememberPassword, setRememberPassword] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loadingAccounts, setLoadingAccounts] = useState(false);
  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const accountList = await api<Account[]>('/accounts');
      setAccounts(accountList);
      setAccountId((current) => accountList.some((account) => account.id === current) ? current : accountList.length === 1 ? accountList[0].id : '');
    } catch (reason) {
      if (isUnauthorized(reason)) router.replace('/login');
      else setError(errorMessage(reason, 'Could not refresh your accounts.'));
    } finally { setLoadingAccounts(false); }
  }, [router]);
  const loadPending = useCallback(async () => {
    try { const pending = await api<Batch | null>('/imports'); if (pending) setBatch(pending); }
    catch (reason) { if (isUnauthorized(reason)) router.replace('/login'); else setError(errorMessage(reason, 'Could not load pending imports.')); }
  }, [router]);
  useEffect(() => {
    void loadAccounts(); void loadPending();
    const refreshAccounts = () => { if (document.visibilityState === 'visible') void loadAccounts(); };
    window.addEventListener('focus', refreshAccounts); document.addEventListener('visibilitychange', refreshAccounts);
    return () => { window.removeEventListener('focus', refreshAccounts); document.removeEventListener('visibilitychange', refreshAccounts); };
  }, [loadAccounts, loadPending]);
  const selectedAccount = accounts.find((account) => account.id === accountId); const isPdf = Boolean(file?.name.toLowerCase().endsWith('.pdf'));
  async function upload(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!file || !accountId) return; setBusy(true); setError(''); const payload = new FormData(); payload.set('statement', file); if (isPdf && pdfPassword) payload.set('pdfPassword', pdfPassword); if (isPdf) payload.set('rememberPassword', String(rememberPassword));
    try { setBatch(await api<Batch>(`/imports/${accountId}`, { method: 'POST', body: payload })); setPdfPassword(''); } catch (value) { setError(value instanceof Error ? value.message : 'Upload failed.'); } finally { setBusy(false); } }
  async function forgetPassword() { if (!selectedAccount) return; setBusy(true); setError(''); try { await api(`/accounts/${selectedAccount.id}/statement-password`, { method: 'DELETE' }); setAccounts((items) => items.map((item) => item.id === selectedAccount.id ? { ...item, hasStatementPassword: false } : item)); } catch (value) { setError(value instanceof Error ? value.message : 'Could not forget the saved password.'); } finally { setBusy(false); } }
  async function update(row: Row, changes: { include?: boolean; categoryId?: string }) { if (!batch) return; setBatch(await api<Batch>(`/imports/${batch.id}/rows/${row.id}`, { method: 'PATCH', body: JSON.stringify(changes) })); }
  async function commit() { if (!batch) return; setBusy(true); await api(`/imports/${batch.id}/commit`, { method: 'POST' }); router.push('/dashboard'); }
  async function discard() { if (!batch) return; setBusy(true); await api(`/imports/${batch.id}`, { method: 'DELETE' }); setBatch(undefined); setFile(undefined); setBusy(false); }
  return <Shell><header className="page-header"><div><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>Overview</Link><span className="eyebrow">Statement importer</span><h1>{batch ? 'Review before it lands.' : 'Bring in your transactions.'}</h1><p>{batch ? 'Nothing enters your ledger until you approve this review.' : 'CSV, XLSX, or supported Axis, PNB, and SBI PDF · Maximum 5 MB · Your original file is not retained.'}</p></div></header>
      {!batch ? <section className="import-card"><form onSubmit={upload}><div className="account-picker"><label className="field-label">Destination account<select name="accountId" required value={accountId} onChange={(event) => { setAccountId(event.target.value); setPdfPassword(''); }}><option value="" disabled>Choose an account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.institution ? ` · ${account.institution}` : ''}</option>)}</select></label><button type="button" className="secondary compact" disabled={loadingAccounts} onClick={() => void loadAccounts()}><RefreshCw/>{loadingAccounts ? 'Refreshing…' : 'Refresh accounts'}</button></div><label className={`dropzone ${file ? 'has-file' : ''}`}><input type="file" accept=".csv,.xls,.xlsx,.pdf,application/pdf" required onChange={(event) => { setFile(event.target.files?.[0]); setError(''); }}/>{file ? <><FileSpreadsheet size={38}/><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB · ready to review</span></> : <><UploadCloud size={42}/><strong>Choose a bank statement</strong><span>CSV, XLSX, or supported Axis, PNB, and SBI PDF</span></>}</label>{isPdf && selectedAccount && <section className="password-panel"><div className="password-status"><KeyRound/><span><strong>PDF password</strong><small>{selectedAccount.hasStatementPassword ? 'A password is saved securely for this account.' : 'Only needed when this statement is password-protected.'}</small></span>{selectedAccount.hasStatementPassword && <button type="button" className="ghost compact" disabled={busy} onClick={forgetPassword}><Trash2/>Forget</button>}</div><label>Enter {selectedAccount.hasStatementPassword ? 'a new password to replace the saved one' : 'the document-opening password'}<input type="password" value={pdfPassword} maxLength={128} autoComplete="off" placeholder={selectedAccount.hasStatementPassword ? 'Leave blank to use the saved password' : 'Optional'} onChange={(event) => setPdfPassword(event.target.value)}/></label><label className="remember-choice"><input type="checkbox" checked={rememberPassword} onChange={(event) => setRememberPassword(event.target.checked)}/><span><Check/></span><div><strong>Remember securely for this account</strong><small>An entered password is saved only after this statement unlocks and verifies successfully.</small></div></label></section>}{!accounts.length && <p className="notice"><AlertTriangle size={17}/>You need to <Link href="/dashboard">add an account</Link> first.</p>}{error && <p className="error">{error}</p>}<button className="primary wide" disabled={busy || !file || !accountId}>{busy ? 'Reading statement…' : 'Upload and review'}</button></form><aside><ShieldCheck/><h3>Safe import flow</h3><p>We parse into a temporary staging area, verify the selected bank layout, reconcile balances and totals, flag repeated files and transactions, and let you correct categories. The uploaded file and plaintext password are never retained.</p><ol><li><span>1</span>Unlock, detect, and reconcile</li><li><span>2</span>Detect duplicates</li><li><span>3</span>You approve</li></ol></aside></section> : <Review batch={batch} update={update} commit={commit} discard={discard} busy={busy}/>}
  </Shell>;
}

function Review({ batch, update, commit, discard, busy }: { batch: Batch; update: (row: Row, change: { include?: boolean; categoryId?: string }) => void; commit: () => void; discard: () => void; busy: boolean }) {
  const included = batch.staged.filter((row) => row.include && !row.isDuplicate); const duplicates = batch.staged.filter((row) => row.isDuplicate).length;
  return <><section className="review-summary"><div><FileSpreadsheet/><span><strong>{batch.filename}</strong><small>{batch.account.name}</small></span></div><div><span><strong>{batch.staged.length}</strong><small>rows found</small></span><span><strong>{duplicates}</strong><small>duplicates</small></span><span><strong>{money(included.reduce((sum, row) => sum + row.amount, 0))}</strong><small>net movement</small></span></div></section>
    <section className="review-table panel"><div className="review-head"><span>Include</span><span>Date & description</span><span>Category</span><span>Amount</span></div>{batch.staged.map((row) => <div className={`review-row ${!row.include ? 'excluded' : ''}`} key={row.id}><label className="check"><input type="checkbox" checked={row.include} disabled={row.isDuplicate} onChange={(event) => update(row, { include: event.target.checked })}/><span><Check/></span></label><div><strong>{row.merchant || row.descriptionRaw}</strong><small>Value {new Date(row.transactionDate).toLocaleDateString('en-IN')}{row.postedDate ? ` · Posted ${new Date(row.postedDate).toLocaleDateString('en-IN')}` : ''} · {row.descriptionRaw}</small>{row.isDuplicate && <em><AlertTriangle size={12}/>Likely duplicate</em>}</div><select value={row.categoryId ?? ''} onChange={(event) => update(row, { categoryId: event.target.value })}>{batch.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><b className={row.amount > 0 ? 'positive' : ''}>{money(row.amount)}</b></div>)}</section>
    <div className="commit-bar"><div><ShieldCheck/><span><strong>{included.length} transactions ready</strong><small>Duplicates and unchecked rows will be skipped.</small></span></div><div className="review-actions"><button className="ghost" disabled={busy} onClick={discard}>Discard</button><button className="primary" disabled={busy || !included.length} onClick={commit}>{busy ? 'Importing…' : 'Approve & import'}</button></div></div></>;
}
