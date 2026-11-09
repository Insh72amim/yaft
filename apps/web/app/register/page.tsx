'use client';

import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Landmark,
  Lock,
  LockKeyhole,
  Mail,
  Server,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, enableDemoMode, isDemoMode } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Register() {
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
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          password: data.get('password'),
        }),
      });
      router.replace('/dashboard');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not create your workspace.');
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-theme-toggle-wrap">
        <ThemeToggle className="auth-theme-toggle" />
      </div>

      <aside className="auth-art register-art">
        <div className="auth-art-top">
          <div className="auth-art-pill">
            <LockKeyhole size={15} />
            <span>Owner Setup Mode</span>
          </div>
          <div className="auth-art-pill">
            <span>Zero Cloud Exposure</span>
          </div>
        </div>

        <div className="auth-art-center">
          <div className="auth-security-card">
            <div className="auth-security-card-header">
              <div className="auth-security-icon-badge">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3>Built for sensitive data</h3>
                <p>Enterprise-grade security on your own server</p>
              </div>
            </div>

            <div className="auth-security-items">
              <div className="auth-security-row">
                <Check size={16} />
                <span>Argon2id cryptographic password hashing</span>
              </div>
              <div className="auth-security-row">
                <Check size={16} />
                <span>Strict HTTP-only, SameSite session cookies</span>
              </div>
              <div className="auth-security-row">
                <Check size={16} />
                <span>Owner-scoped financial records & ledgers</span>
              </div>
              <div className="auth-security-row">
                <Check size={16} />
                <span>Isolated database network with zero telemetry</span>
              </div>
              <div className="auth-security-row">
                <Check size={16} />
                <span>Local in-memory PDF document parsing</span>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-art-features">
          <div className="auth-art-feature-item">
            <Server size={18} />
            <strong>Self-Hosted</strong>
            <span>Runs locally or in private VPC</span>
          </div>
          <div className="auth-art-feature-item">
            <Shield size={18} />
            <strong>Single Tenant</strong>
            <span>Zero multi-tenant risk</span>
          </div>
          <div className="auth-art-feature-item">
            <CheckCircle2 size={18} />
            <strong>Full Ownership</strong>
            <span>Your keys, database, and files</span>
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
              <ShieldCheck size={13} />
              Single-Owner Instance
            </span>
            <h1>Make it yours.</h1>
            <p>The first account permanently claims and locks this private finance instance.</p>
          </div>

          <form onSubmit={submit} className="auth-form">
            <div className="input-group">
              <label htmlFor="name">Your name</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <User size={17} />
                </span>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  placeholder="e.g. Alex Morgan"
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                  required
                  minLength={12}
                  placeholder="At least 12 characters"
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
                  <span>Creating workspace…</span>
                </>
              ) : (
                <>
                  <span>Create private workspace</span>
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
              <span>Try Interactive Guest Sandbox (Local Data)</span>
              <ArrowRight size={15} />
            </button>
          </form>

          <p className="auth-switch">
            Already configured? <Link href="/login">Sign in &rarr;</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
