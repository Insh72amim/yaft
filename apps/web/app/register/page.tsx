'use client';
import { Landmark, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

export default function Register() {
  const router = useRouter(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const data = new FormData(event.currentTarget);
    try { await api('/auth/register', { method: 'POST', body: JSON.stringify({ name: data.get('name'), email: data.get('email'), password: data.get('password') }) }); router.replace('/dashboard'); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not create your workspace.'); setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-panel"><div className="brand large" title="Yet Another Financial Tool"><span className="brand-mark"><Landmark size={21}/></span>YAFT</div><div className="auth-copy"><span className="eyebrow"><ShieldCheck size={14}/> One owner only</span><h1>Make it yours.</h1><p>The first account permanently claims this private finance instance.</p></div><form onSubmit={submit} className="auth-form"><label>Your name<input name="name" required minLength={2} defaultValue="User" /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="new-password" required minLength={12} placeholder="At least 12 characters" /></label>{error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create private workspace'}</button></form><p className="auth-switch">Already set up? <Link href="/login">Sign in</Link></p></section><aside className="auth-art register-art"><div className="security-list"><ShieldCheck/><strong>Built for sensitive data</strong><span>Argon2 password hashing</span><span>HTTP-only session cookies</span><span>Owner-scoped financial records</span><span>Private database network</span></div></aside></main>;
}
