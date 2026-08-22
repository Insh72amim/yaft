'use client';

import React from 'react';
import Link from 'next/link';
import { Landmark, Shield, Heart, Github, Terminal, ArrowUp } from 'lucide-react';

export function MarketingFooter() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="mkt-footer">
      <div className="mkt-container">
        {/* Pre-footer Call to Action */}
        <div className="mkt-prefooter-card">
          <div className="mkt-prefooter-content">
            <span className="mkt-pill-badge light">
              <Shield size={14} />
              <span>Sovereign Financial Freedom</span>
            </span>
            <h2>Take Full Control of Your Financial Privacy Today</h2>
            <p>
              Join engineers, founders, and privacy advocates who track their complete net worth
              without handing their financial lives over to third-party cloud servers.
            </p>
            <div className="mkt-prefooter-actions">
              <a href="#deploy" className="mkt-btn-primary mkt-btn-lg">
                <Terminal size={18} />
                <span>Deploy Self-Hosted Instance</span>
              </a>
              <Link href="/register" className="mkt-btn-secondary mkt-btn-lg">
                <span>Claim Your Instance</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Main Links Grid */}
        <div className="mkt-footer-main">
          <div className="mkt-footer-brand-col">
            <Link href="/" className="mkt-brand" title="YAFT">
              <span className="brand-mark mkt-brand-mark">
                <Landmark size={20} />
              </span>
              <div className="mkt-brand-text">
                <strong>YAFT</strong>
                <span className="mkt-brand-badge">Open Source</span>
              </div>
            </Link>
            <p className="mkt-footer-quote">
              “Money becomes calmer when the whole picture is visible.”
            </p>
            <span className="mkt-footer-sub">
              A private, local-first workspace for personal financial records.
            </span>
          </div>

          <div className="mkt-footer-links-col">
            <h4>Workspace</h4>
            <ul>
              <li><Link href="/dashboard">Dashboard & Cashflow</Link></li>
              <li><Link href="/accounts">Reconciled Accounts</Link></li>
              <li><Link href="/credit-cards">Credit Cards Hub</Link></li>
              <li><Link href="/salary">Payslip & Tax Engine</Link></li>
              <li><Link href="/import">Statement Import</Link></li>
              <li><Link href="/budgets">Envelopes & Rules</Link></li>
            </ul>
          </div>

          <div className="mkt-footer-links-col">
            <h4>Security & Ops</h4>
            <ul>
              <li><a href="#security">Privacy Manifesto</a></li>
              <li><a href="#ecosystem">Indian Bank Parsers</a></li>
              <li><a href="#deploy">Docker Compose Guide</a></li>
              <li><a href="#comparison">Feature Comparison</a></li>
              <li><Link href="/login">Instance Sign In</Link></li>
              <li><Link href="/register">Claim Admin Access</Link></li>
            </ul>
          </div>

          <div className="mkt-footer-links-col">
            <h4>Stack & Tech</h4>
            <ul>
              <li><span>Next.js 15 App Router</span></li>
              <li><span>NestJS Modular Backend</span></li>
              <li><span>Prisma ORM & PostgreSQL</span></li>
              <li><span>MinIO S3 Object Storage</span></li>
              <li><span>qpdf In-Memory Decryption</span></li>
              <li><span>Google Gmail OAuth2 API</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mkt-footer-bottom">
          <p>© {new Date().getFullYear()} YAFT (Yet Another Financial Tracker). 100% Free & Open Source.</p>
          <button onClick={scrollToTop} className="mkt-scroll-top-btn" title="Back to top">
            <span>Back to top</span>
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </footer>
  );
}
