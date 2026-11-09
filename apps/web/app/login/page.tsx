'use client';

import {
  AlertCircle,
  ArrowRight,
  Database,
  Eye,
  EyeOff,
  Landmark,
  Lock,
  LockKeyhole,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, enableDemoMode, isDemoMode } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isDemoMode()) {
      router.replace('/dashboard');
    }
  }, [router]);

  function launchGuestSandbox() {
    enableDemoMode(false);
    router.replace('/dashboard');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: data.get('email'),
          password: data.get('password'),
        }),
      });
      router.replace('/dashboard');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-theme-toggle-wrap">
        <ThemeToggle className="auth-theme-toggle" />
      </div>

      <aside className="auth-art">
        <div className="auth-art-top">
          <div className="auth-art-pill">
            <ShieldCheck size={15} />
            <span>Self-Hosted &bull; Local-First</span>
          </div>
          <div className="auth-art-pill">
            <span>v1.0</span>
          </div>
        </div>

        <div className="auth-art-center">
          <div className="auth-quote-card">
            <blockquote>
              “Money becomes calmer when the whole picture is visible.”
            </blockquote>
            <div className="quote-author">
              <div className="author-avatar">
                <Landmark size={18} />
              </div>
              <div className="author-info">
                <span className="author-name">YAFT Core Philosophy</span>
                <span className="author-desc">Private & Calm Wealth Tracking</span>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-art-features">
          <div className="auth-art-feature-item">
            <Shield size={18} />
            <strong>Zero Telemetry</strong>
            <span>No ads, trackers, or cloud sync</span>
          </div>
          <div className="auth-art-feature-item">
            <Database size={18} />
            <strong>Owner Scoped</strong>
            <span>All records kept strictly private</span>
          </div>
          <div className="auth-art-feature-item">
            <Sparkles size={18} />
            <strong>Multi-Asset</strong>
            <span>Bank, Loans, EPFO & Investments</span>
          </div>
        </div>
      </aside>

      <section className="auth-panel">
        <div className="auth-card-inner">
          <Link href="/" className="brand" title="Yet Another Financial Tracker">
            <span className="brand-mark">
              <Landmark size={22} />
            </span>
            <span>YAFT</span>
          </Link>

          <div className="auth-copy">
            <span className="auth-badge">
              <LockKeyhole size={13} />
              Private Workspace
            </span>
            <h1>Welcome back.</h1>
            <p>Your complete financial picture, without giving up control of your data.</p>
          </div>

          <form onSubmit={submit} className="auth-form">
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <Mail size={17} />
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <Lock size={17} />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={busy}>
              {busy ? (
                <>
                  <span className="auth-btn-spinner" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign in securely</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={launchGuestSandbox}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                marginTop: '10px',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(22, 163, 74, 0.35)',
                background: 'rgba(22, 163, 74, 0.08)',
                color: 'var(--green)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={16} />
              <span>Try Interactive Guest Sandbox (Local Data)</span>
            </button>
          </form>

          <p className="auth-switch">
            First time here? <Link href="/register">Claim this private instance &rarr;</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
