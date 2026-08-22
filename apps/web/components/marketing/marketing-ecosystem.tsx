'use client';

import React from 'react';
import {
  FileText,
  MailCheck,
  Building,
  Briefcase,
  TrendingUp,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileCheck2,
  Layers,
  Sparkles
} from 'lucide-react';

export function MarketingEcosystem() {
  const ecosystemFeatures = [
    {
      title: 'Axis Bank Statement PDF Engine',
      bank: 'Axis Bank',
      badgeClass: 'axis',
      icon: '🏛️',
      description: 'Handles multi-account statements, trailing Cr./Dr. balance notations, automated password candidate fallback, and strict running balance validation.',
      capabilities: [
        'Reconciled opening & closing balances',
        'Signed integer minor-unit arithmetic',
        'Password candidate fallback from Vault',
      ],
    },
    {
      title: 'State Bank of India (SBI) Parser',
      bank: 'State Bank of India',
      badgeClass: 'sbi',
      icon: '🏦',
      description: 'Parses complex multi-column SBI savings and current account statements with strict date formatting and duplicate row rejection.',
      capabilities: [
        'Multi-page table flow detection',
        'Txn Ref & UPI merchant resolution',
        'Zero hallucinated transactions',
      ],
    },
    {
      title: 'Punjab National Bank (PNB) Reconciler',
      bank: 'Punjab National Bank',
      badgeClass: 'pnb',
      icon: '🏢',
      description: 'Reconciles PNB statement formats with custom balance ledger verification and automated date normalization.',
      capabilities: [
        'Fail-closed balance checks',
        'Staged review before ledger commit',
        'Category rule auto-assignment',
      ],
    },
    {
      title: 'EPFO Passbook & Retirement Ledger',
      bank: 'EPFO India',
      badgeClass: 'epfo',
      icon: '🏛️',
      description: 'Complete breakdown of monthly Employee Share, Employer Share, Pension Fund contribution, and annual statutory interest accruals.',
      capabilities: [
        'Separate Member ID ledger tracking',
        'Annual compound interest logging',
        'Historical retirement net worth feed',
      ],
    },
    {
      title: 'Zerodha Kite & Groww Holdings',
      bank: 'Broker Snapshots',
      badgeClass: 'zerodha',
      icon: '📈',
      description: 'One-click import of CSV/XLSX portfolio holdings sheets with sector categorization, purchase price reconciliation, and live unrealized P&L badges.',
      capabilities: [
        'Sector tag allocation (IT, Banking, Pharma)',
        'Atomic snapshot replacement',
        'Equity & Mutual Fund asset weighting',
      ],
    },
    {
      title: 'Direct Gmail Transaction Sync',
      bank: 'Credit Card Alerts',
      badgeClass: 'hdfc',
      icon: '⚡',
      description: 'Direct Gmail API OAuth2 integration for real-time credit card swipe notifications across HDFC, ICICI, Axis, and SBI Card without account spawning.',
      capabilities: [
        'Parses swipe amounts, merchants & dates',
        'Zero cloud scrapers or third-party bots',
        'Inspect raw reference email anytime',
      ],
    },
  ];

  return (
    <section id="ecosystem" className="mkt-section mkt-ecosystem-section">
      <div className="mkt-container">
        <div className="mkt-section-header">
          <span className="mkt-section-eyebrow">
            <Building size={14} />
            <span>Engineered for India</span>
          </span>
          <h2 className="mkt-section-title">
            First-Class Support for the <br />
            <span className="mkt-hero-gradient-text">Indian Financial Ecosystem</span>
          </h2>
          <p className="mkt-section-desc">
            Foreign finance apps fail when confronted with Indian password-protected bank PDFs,
            TDS salary deductions, EPFO passbooks, and UPI swipe alerts. YAFT is purpose-built to parse,
            verify, and reconcile them with zero friction.
          </p>
        </div>

        {/* Ecosystem Cards Grid */}
        <div className="mkt-ecosystem-grid">
          {ecosystemFeatures.map((item, idx) => (
            <div key={idx} className="mkt-eco-card">
              <div className="mkt-eco-header">
                <span className="mkt-eco-icon">{item.icon}</span>
                <span className={`mkt-acc-badge ${item.badgeClass}`}>{item.bank}</span>
              </div>
              <h3 className="mkt-eco-title">{item.title}</h3>
              <p className="mkt-eco-desc">{item.description}</p>
              <ul className="mkt-eco-list">
                {item.capabilities.map((cap, capIdx) => (
                  <li key={capIdx}>
                    <CheckCircle2 size={14} className="mkt-text-green" />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Dynamic Payslip Highlight Banner */}
        <div className="mkt-payslip-highlight-banner">
          <div className="mkt-payslip-hl-left">
            <span className="mkt-pill-badge">
              <Sparkles size={14} />
              <span>Dynamic Payslip Engine</span>
            </span>
            <h3>JSON-Driven Dynamic Payslip Parser & Sandbox</h3>
            <p>
              Never write custom parser code for each new employer. YAFT lets you configure
              regex field anchors, test with sample payslips in an interactive math sandbox
              (<code>Gross - Deductions = Net Pay</code>), and view password-protected PDFs
              instantly without typing passwords via backend <code>qpdf</code> integration.
            </p>
            <div className="mkt-payslip-tags">
              <span>Section 80C PF Extraction</span>
              <span>TDS Section 192 Tax Tracking</span>
              <span>HRA & Special Allowance Markers</span>
              <span>In-Memory RAM Decryption</span>
            </div>
          </div>
          <div className="mkt-payslip-hl-right">
            <div className="mkt-hl-code-window">
              <div className="mkt-hl-code-header">
                <span className="mkt-dot red" />
                <span className="mkt-dot yellow" />
                <span className="mkt-dot green" />
                <span>payslip-config.json</span>
              </div>
              <pre>
                <code>{`{
  "employer": "Tech Corp India",
  "anchors": {
    "grossEarnings": "GROSS EARNINGS\\\\s+INR\\\\s+([\\\\d,.]+)",
    "netPay": "NET PAY\\\\s+INR\\\\s+([\\\\d,.]+)",
    "pfDeduction": "PROVIDENT FUND\\\\s+([\\\\d,.]+)",
    "tdsTax": "INCOME TAX (TDS)\\\\s+([\\\\d,.]+)"
  },
  "mathRule": "GROSS - DEDUCTIONS == NET_PAY"
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
