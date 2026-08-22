'use client';

import React from 'react';
import {
  Landmark,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  Workflow,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Sliders,
  FolderLock,
  Scale
} from 'lucide-react';

export function MarketingFeatures() {
  const featureList = [
    {
      icon: <Scale className="mkt-feat-icon text-green" size={24} />,
      title: 'Signed Integer Minor-Unit Math',
      subtitle: 'Zero Floating-Point Drift',
      description:
        'Financial software must not suffer from IEEE 754 float imprecision (0.1 + 0.2 ≠ 0.3). Every single currency calculation in YAFT is computed in exact integer minor units (paise) down to the last decimal.',
      highlight: 'BigInt paise precision across all DB models',
    },
    {
      icon: <ShieldCheck className="mkt-feat-icon text-teal" size={24} />,
      title: 'Fail-Closed Statement Parsers',
      subtitle: 'Never Hallucinates Missing Numbers',
      description:
        'If a bank statement or corporate payslip is unreadable, ambiguous, or fails balance equations (Opening + Inflows - Outflows = Closing), YAFT fails closed immediately rather than corrupting your ledger.',
      highlight: 'Strict running-balance verification guarantee',
    },
    {
      icon: <CreditCard className="mkt-feat-icon text-orange" size={24} />,
      title: 'Credit Cards Command Center',
      subtitle: 'Health Gauges & Visual Card Stack',
      description:
        'Monitor aggregated credit utilization rates with color-coded health indicators (Healthy / Moderate / High). Track 6-month spend vs bill payments and preview digital cards with bank branding.',
      highlight: 'Instant 1-click sync via Gmail & statement review',
    },
    {
      icon: <FolderLock className="mkt-feat-icon text-purple" size={24} />,
      title: 'AES-256-GCM Credential Vault',
      subtitle: 'Account-Bound Encrypted Storage',
      description:
        'Store document-unlock passwords, card CVVs, expiry dates, and IFSC codes safely on disk with AES-256-GCM encryption. In-memory decryption ensures passwords are never leaked in logs or APIs.',
      highlight: 'Transient RAM decryption via backend qpdf',
    },
    {
      icon: <Workflow className="mkt-feat-icon text-blue" size={24} />,
      title: 'Multi-Bank Sankey Flows & Budgets',
      subtitle: 'Visual Money Streams & Envelopes',
      description:
        'Trace money from income sources across bank transfers to category spending envelopes. Automatically nets merchant refunds and cashbacks without breaking individual double-entry ledger rows.',
      highlight: 'Retroactive regex rule builder with 1-click bulk tagging',
    },
    {
      icon: <TrendingDown className="mkt-feat-icon text-amber" size={24} />,
      title: 'Loan EMI Amortization Engine',
      subtitle: 'Principal vs Interest Schedules',
      description:
        'Generate complete loan amortization tables tracking remaining principal, interest splits, and payoff timelines. Confirm scheduled EMIs to record transactions directly into the ledger.',
      highlight: 'Atomic ledger debit upon EMI confirmation',
    },
  ];

  return (
    <section id="features" className="mkt-section mkt-features-section">
      <div className="mkt-container">
        <div className="mkt-section-header">
          <span className="mkt-section-eyebrow">
            <Sparkles size={14} />
            <span>Core Capabilities</span>
          </span>
          <h2 className="mkt-section-title">
            Built with Institutional Rigor. <br />
            <span className="mkt-hero-gradient-text">Designed for Absolute Clarity.</span>
          </h2>
          <p className="mkt-section-desc">
            YAFT combines the precision of high-frequency accounting systems with the tranquil,
            focused user experience of modern personal software.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="mkt-features-grid">
          {featureList.map((feat, index) => (
            <div key={index} className="mkt-feature-card">
              <div className="mkt-feature-icon-wrap">{feat.icon}</div>
              <span className="mkt-feature-subtitle">{feat.subtitle}</span>
              <h3 className="mkt-feature-title">{feat.title}</h3>
              <p className="mkt-feature-desc">{feat.description}</p>
              <div className="mkt-feature-highlight">
                <CheckCircle2 size={13} className="mkt-text-green" />
                <span>{feat.highlight}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
