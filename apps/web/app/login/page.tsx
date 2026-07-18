'use client';
import { Landmark, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

export default function Login() {
  const router = useRouter(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const data = new FormData(event.currentTarget);
    try { await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) }); router.replace('/dashboard'); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not sign in.'); setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-panel"><div className="brand large" title="Yet Another Financial Tool"><span className="brand-mark"><Landmark size={21}/></span>YAFT</div>
    <div className="auth-copy"><span className="eyebrow"><LockKeyhole size={14}/> Private workspace</span><h1>Welcome back, User.</h1><p>Your complete financial picture, without giving up control of your data.</p></div>
    <form onSubmit={submit} className="auth-form"><label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label><label>Password<input name="password" type="password" autoComplete="current-password" required placeholder="Your password" /></label>{error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button></form>
    <p className="auth-switch">First time here? <Link href="/register">Claim this private instance</Link></p></section><aside className="auth-art"><div className="quote">“Money becomes calmer when the whole picture is visible.”</div></aside></main>;
}
