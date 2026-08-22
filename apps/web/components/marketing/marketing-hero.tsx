'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Terminal,
  Check,
  Copy,
  Eye,
  EyeOff,
  ShieldCheck,
  Landmark,
  CreditCard,
  FileSpreadsheet,
  Workflow,
  Sparkles,
  Lock,
  Building2,
  TrendingUp,
  ReceiptText,
  BadgePercent,
  CheckCircle2,
  CircleDollarSign,
  PieChart
} from 'lucide-react';

export function MarketingHero() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'ledger' | 'cards' | 'payslip' | 'sankey'>('ledger');
  const [masked, setMasked] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText('git clone https://github.com/yaft-finance/yaft.git && cd yaft && cp .env.example .env && docker compose up -d');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmt = (val: string) => (masked ? '₹ ••••••' : val);

  return (
    <section className="mkt-hero-section">
      {/* Ambient background glow */}
      <div className="mkt-hero-glow" />

      <div className="mkt-container">
        {/* Hero Top Copy */}
        <div className="mkt-hero-badge-wrap">
          <span className="mkt-pill-badge">
            <ShieldCheck size={14} />
            <span>Private • 100% Self-Hosted • Zero Cloud Leaks</span>
          </span>
        </div>

        <h1 className="mkt-hero-title">
          Your Financial Life.<br />
          <span className="mkt-hero-gradient-text">100% On Your Own Terms.</span>
        </h1>

        <p className="mkt-hero-subtitle">
          Consolidate Indian bank statements, credit card swipe alerts, corporate payslips,
          EPFO passbooks, and broker holdings into an immutable, double-entry financial ledger —
          running strictly on iron you control.
        </p>

        {/* Hero CTAs */}
        <div className="mkt-hero-ctas">
          <a href="#deploy" className="mkt-btn-primary mkt-btn-lg">
            <Terminal size={18} />
            <span>Deploy in 60 Seconds</span>
            <ArrowRight size={16} />
          </a>
          <a href="#demo" className="mkt-btn-secondary mkt-btn-lg">
            <span>Explore Live Preview</span>
          </a>
        </div>

        {/* 1-Liner Quick Command Box */}
        <div className="mkt-terminal-bar">
          <div className="mkt-terminal-pill">
            <span className="mkt-terminal-dot red" />
            <span className="mkt-terminal-dot yellow" />
            <span className="mkt-terminal-dot green" />
          </div>
          <code>
            <span className="mkt-term-prompt">$</span> docker compose up -d
          </code>
          <button
            onClick={copyCommand}
            className="mkt-terminal-copy-btn"
            title="Copy command"
            aria-label="Copy docker run command"
          >
            {copied ? (
              <>
                <Check size={14} className="mkt-term-check" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Trust Badges Bar */}
        <div className="mkt-trust-grid">
          <div className="mkt-trust-item">
            <span className="mkt-trust-icon">🏛️</span>
            <div>
              <strong>Native Indian Parsers</strong>
              <span>Axis, SBI, PNB, EPFO & Zerodha</span>
            </div>
          </div>
          <div className="mkt-trust-item">
            <span className="mkt-trust-icon">🔒</span>
            <div>
              <strong>Single-Owner Security</strong>
              <span>Argon2id + AES-256-GCM Vault</span>
            </div>
          </div>
          <div className="mkt-trust-item">
            <span className="mkt-trust-icon">⚖️</span>
            <div>
              <strong>Fail-Closed Ledger</strong>
              <span>Minor-unit (paise) integer math</span>
            </div>
          </div>
          <div className="mkt-trust-item">
            <span className="mkt-trust-icon">⚡</span>
            <div>
              <strong>Direct Gmail Sync</strong>
              <span>Real-time credit card swipe alerts</span>
            </div>
          </div>
        </div>

        {/* Interactive Simulated Product UI / Command Center */}
        <div id="demo" className="mkt-hero-mockup-wrapper">
          <div className="mkt-mockup-window">
            {/* Window Topbar */}
            <div className="mkt-mockup-header">
              <div className="mkt-mockup-controls">
                <span className="mkt-dot red" />
                <span className="mkt-dot yellow" />
                <span className="mkt-dot green" />
                <span className="mkt-mockup-title">YAFT Sovereign Command Center — localhost:3000</span>
              </div>

              {/* Masking and Tabs Bar */}
              <div className="mkt-mockup-actions">
                <button
                  className={`mkt-mask-btn ${masked ? 'active' : ''}`}
                  onClick={() => setMasked(!masked)}
                  title="Toggle Global Privacy Amount Masking"
                >
                  {masked ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{masked ? 'Masked' : 'Mask Numbers'}</span>
                </button>
              </div>
            </div>

            {/* Mockup Tab Selector */}
            <div className="mkt-mockup-tabs">
              <button
                className={`mkt-mockup-tab ${activeTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setActiveTab('ledger')}
              >
                <Landmark size={15} />
                <span>Reconciled Master Ledger</span>
              </button>
              <button
                className={`mkt-mockup-tab ${activeTab === 'cards' ? 'active' : ''}`}
                onClick={() => setActiveTab('cards')}
              >
                <CreditCard size={15} />
                <span>Credit Cards Hub & Utilization</span>
              </button>
              <button
                className={`mkt-mockup-tab ${activeTab === 'payslip' ? 'active' : ''}`}
                onClick={() => setActiveTab('payslip')}
              >
                <ReceiptText size={15} />
                <span>Dynamic Payslip Engine</span>
              </button>
              <button
                className={`mkt-mockup-tab ${activeTab === 'sankey' ? 'active' : ''}`}
                onClick={() => setActiveTab('sankey')}
              >
                <Workflow size={15} />
                <span>Multi-Bank Cash Flow</span>
              </button>
            </div>

            {/* Mockup Body Content */}
            <div className="mkt-mockup-body">
              {/* TAB 1: LEDGER */}
              {activeTab === 'ledger' && (
                <div className="mkt-demo-screen">
                  {/* Hero Metric Banner */}
                  <div className="mkt-demo-hero-stat">
                    <div>
                      <span className="mkt-demo-label">Total Liquid Net Worth</span>
                      <strong className="mkt-demo-value">{fmt('₹ 18,42,850.00')}</strong>
                      <small className="mkt-demo-subtext">
                        <CheckCircle2 size={13} className="mkt-text-green" /> Reconciled across 4 bank & investment accounts
                      </small>
                    </div>
                    <div className="mkt-demo-stat-pill">
                      <span>Monthly Inflow</span>
                      <strong className="mkt-text-green">{fmt('+ ₹ 2,45,000.00')}</strong>
                    </div>
                    <div className="mkt-demo-stat-pill">
                      <span>Monthly Spend</span>
                      <strong className="mkt-text-orange">{fmt('- ₹ 68,430.00')}</strong>
                    </div>
                  </div>

                  {/* Account Summary Strip */}
                  <div className="mkt-demo-accounts-strip">
                    <div className="mkt-demo-account-card">
                      <div className="mkt-demo-acc-head">
                        <span className="mkt-acc-badge axis">Axis Bank</span>
                        <small>•• 8492</small>
                      </div>
                      <strong>{fmt('₹ 5,84,320.00')}</strong>
                      <span className="mkt-acc-status">✓ Verified from PDF</span>
                    </div>

                    <div className="mkt-demo-account-card">
                      <div className="mkt-demo-acc-head">
                        <span className="mkt-acc-badge sbi">SBI Savings</span>
                        <small>•• 1042</small>
                      </div>
                      <strong>{fmt('₹ 3,12,400.00')}</strong>
                      <span className="mkt-acc-status">✓ Running balance check</span>
                    </div>

                    <div className="mkt-demo-account-card">
                      <div className="mkt-demo-acc-head">
                        <span className="mkt-acc-badge epfo">EPFO Passbook</span>
                        <small>UAN Verified</small>
                      </div>
                      <strong>{fmt('₹ 6,45,130.00')}</strong>
                      <span className="mkt-acc-status">✓ +8.25% Interest Added</span>
                    </div>

                    <div className="mkt-demo-account-card">
                      <div className="mkt-demo-acc-head">
                        <span className="mkt-acc-badge zerodha">Zerodha Kite</span>
                        <small>Holdings</small>
                      </div>
                      <strong>{fmt('₹ 3,01,000.00')}</strong>
                      <span className="mkt-acc-status mkt-text-green">+18.4% Unrealized P&L</span>
                    </div>
                  </div>

                  {/* Transaction Feed */}
                  <div className="mkt-demo-transactions">
                    <div className="mkt-demo-table-header">
                      <span>Date & Time</span>
                      <span>Description / Merchant</span>
                      <span>Account</span>
                      <span>Category</span>
                      <span style={{ textAlign: 'right' }}>Amount</span>
                    </div>

                    <div className="mkt-demo-table-row">
                      <div className="mkt-row-date">
                        <strong>22 Aug 2026</strong>
                        <small>14:32 IST</small>
                      </div>
                      <div className="mkt-row-desc">
                        <strong>INFOSYS TECHNOLOGIES / SALARY</strong>
                        <small>Ref: SAL-20260822-0941 • Parsed Payslip</small>
                      </div>
                      <div>
                        <span className="mkt-acc-pill axis">Axis ••8492</span>
                      </div>
                      <div>
                        <span className="mkt-cat-pill income">Income / Salary</span>
                      </div>
                      <div className="mkt-row-amount positive">
                        <strong>{fmt('+ ₹ 2,45,000.00')}</strong>
                      </div>
                    </div>

                    <div className="mkt-demo-table-row">
                      <div className="mkt-row-date">
                        <strong>21 Aug 2026</strong>
                        <small>19:40 IST</small>
                      </div>
                      <div className="mkt-row-desc">
                        <strong>SWIGGY BANGALORE IN</strong>
                        <small>Gmail Sync • Instant Alert • Card Swipe</small>
                      </div>
                      <div>
                        <span className="mkt-acc-pill hdfc">HDFC Diners</span>
                      </div>
                      <div>
                        <span className="mkt-cat-pill expense">Food & Dining</span>
                      </div>
                      <div className="mkt-row-amount negative">
                        <strong>{fmt('- ₹ 840.00')}</strong>
                      </div>
                    </div>

                    <div className="mkt-demo-table-row">
                      <div className="mkt-row-date">
                        <strong>19 Aug 2026</strong>
                        <small>11:15 IST</small>
                      </div>
                      <div className="mkt-row-desc">
                        <strong>AMAZON PAY INDIA / REFUND</strong>
                        <small>Reversal Netting • Rule Applied</small>
                      </div>
                      <div>
                        <span className="mkt-acc-pill sbi">SBI ••1042</span>
                      </div>
                      <div>
                        <span className="mkt-cat-pill refund">Shopping (Net Refund)</span>
                      </div>
                      <div className="mkt-row-amount positive">
                        <strong>{fmt('+ ₹ 2,199.00')}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CREDIT CARDS HUB */}
              {activeTab === 'cards' && (
                <div className="mkt-demo-screen">
                  {/* Credit Utilization Gauge Card */}
                  <div className="mkt-demo-cards-top">
                    <div className="mkt-utilization-card">
                      <div className="mkt-util-header">
                        <span className="mkt-demo-label">Aggregate Credit Utilization</span>
                        <span className="mkt-health-badge healthy">✓ Healthy (&lt; 30%)</span>
                      </div>
                      <div className="mkt-util-stat">
                        <strong>14.2%</strong>
                        <div className="mkt-util-progress-wrap">
                          <div className="mkt-util-progress-bar" style={{ width: '14.2%' }} />
                        </div>
                      </div>
                      <div className="mkt-util-details">
                        <span>Total Outstanding: <strong>{fmt('₹ 71,200.00')}</strong></span>
                        <span>Total Available Limit: <strong>{fmt('₹ 5,00,000.00')}</strong></span>
                      </div>
                    </div>

                    <div className="mkt-cards-cashflow-card">
                      <span className="mkt-demo-label">6-Month Credit Cashflow</span>
                      <strong>Zero Interest Paid</strong>
                      <p>All statements auto-reconciled against bank repayment legs with 100% on-time settlement.</p>
                      <div className="mkt-cards-mini-bars">
                        <div className="mkt-mini-bar-col">
                          <div className="mkt-bar spend" style={{ height: '55%' }} />
                          <div className="mkt-bar pay" style={{ height: '55%' }} />
                          <small>May</small>
                        </div>
                        <div className="mkt-mini-bar-col">
                          <div className="mkt-bar spend" style={{ height: '70%' }} />
                          <div className="mkt-bar pay" style={{ height: '70%' }} />
                          <small>Jun</small>
                        </div>
                        <div className="mkt-mini-bar-col">
                          <div className="mkt-bar spend" style={{ height: '45%' }} />
                          <div className="mkt-bar pay" style={{ height: '45%' }} />
                          <small>Jul</small>
                        </div>
                        <div className="mkt-mini-bar-col">
                          <div className="mkt-bar spend" style={{ height: '35%' }} />
                          <div className="mkt-bar pay" style={{ height: '35%' }} />
                          <small>Aug</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Digital Credit Card Stack */}
                  <div className="mkt-card-gallery">
                    <div className="mkt-digital-card hdfc-card">
                      <div className="mkt-dcard-top">
                        <span className="mkt-bank-name">HDFC BANK</span>
                        <span className="mkt-network">Diners Club Black</span>
                      </div>
                      <div className="mkt-dcard-number">•••• •••• •••• 4091</div>
                      <div className="mkt-dcard-bottom">
                        <div>
                          <small>Used / Limit</small>
                          <strong>{fmt('₹ 42,800')} / {fmt('₹ 3,00,000')}</strong>
                        </div>
                        <div className="mkt-dcard-util">14% Util</div>
                      </div>
                    </div>

                    <div className="mkt-digital-card icici-card">
                      <div className="mkt-dcard-top">
                        <span className="mkt-bank-name">ICICI BANK</span>
                        <span className="mkt-network">Amazon Pay Visa</span>
                      </div>
                      <div className="mkt-dcard-number">•••• •••• •••• 7123</div>
                      <div className="mkt-dcard-bottom">
                        <div>
                          <small>Used / Limit</small>
                          <strong>{fmt('₹ 18,400')} / {fmt('₹ 1,50,000')}</strong>
                        </div>
                        <div className="mkt-dcard-util">12% Util</div>
                      </div>
                    </div>

                    <div className="mkt-digital-card axis-card">
                      <div className="mkt-dcard-top">
                        <span className="mkt-bank-name">AXIS BANK</span>
                        <span className="mkt-network">Atlas Mastercard</span>
                      </div>
                      <div className="mkt-dcard-number">•••• •••• •••• 9920</div>
                      <div className="mkt-dcard-bottom">
                        <div>
                          <small>Used / Limit</small>
                          <strong>{fmt('₹ 10,000')} / {fmt('₹ 50,000')}</strong>
                        </div>
                        <div className="mkt-dcard-util">20% Util</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PAYSLIP ENGINE */}
              {activeTab === 'payslip' && (
                <div className="mkt-demo-screen">
                  <div className="mkt-demo-payslip-sandbox">
                    <div className="mkt-payslip-rule-box">
                      <div className="mkt-sandbox-header">
                        <Sparkles size={16} className="mkt-text-green" />
                        <strong>Dynamic JSON Payslip Parser Sandbox</strong>
                        <span className="mkt-badge-math">Math Verified</span>
                      </div>
                      <p>
                        Zero hardcoding. Configure regex anchors for any Indian employer.
                        Backend executes password-free in-memory decryption via <code>qpdf</code>.
                      </p>

                      <div className="mkt-payslip-equation">
                        <div className="mkt-eq-col">
                          <small>Gross Earnings</small>
                          <strong className="mkt-text-green">{fmt('₹ 3,20,000.00')}</strong>
                        </div>
                        <span className="mkt-eq-operator">-</span>
                        <div className="mkt-eq-col">
                          <small>Total Deductions (TDS + PF)</small>
                          <strong className="mkt-text-red">{fmt('₹ 75,000.00')}</strong>
                        </div>
                        <span className="mkt-eq-operator">=</span>
                        <div className="mkt-eq-col highlight">
                          <small>Reconciled Net Pay</small>
                          <strong>{fmt('₹ 2,45,000.00')}</strong>
                        </div>
                      </div>

                      <div className="mkt-payslip-breakdown-grid">
                        <div className="mkt-breakdown-item">
                          <span>Basic Salary:</span>
                          <strong>{fmt('₹ 1,50,000.00')}</strong>
                        </div>
                        <div className="mkt-breakdown-item">
                          <span>House Rent Allowance (HRA):</span>
                          <strong>{fmt('₹ 75,000.00')}</strong>
                        </div>
                        <div className="mkt-breakdown-item">
                          <span>Special Allowance:</span>
                          <strong>{fmt('₹ 95,000.00')}</strong>
                        </div>
                        <div className="mkt-breakdown-item">
                          <span>Provident Fund (Employee 80C):</span>
                          <strong className="mkt-text-red">{fmt('- ₹ 18,000.00')}</strong>
                        </div>
                        <div className="mkt-breakdown-item">
                          <span>Income Tax (TDS Section 192):</span>
                          <strong className="mkt-text-red">{fmt('- ₹ 55,000.00')}</strong>
                        </div>
                        <div className="mkt-breakdown-item">
                          <span>Professional Tax:</span>
                          <strong className="mkt-text-red">{fmt('- ₹ 2,000.00')}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SANKEY FLOW */}
              {activeTab === 'sankey' && (
                <div className="mkt-demo-screen">
                  <div className="mkt-demo-sankey-wrap">
                    <div className="mkt-sankey-header">
                      <div>
                        <strong>Multi-Bank Cash Flow Visualization</strong>
                        <p>Income flows into savings, automatically splitting into investments and budgeted envelopes.</p>
                      </div>
                      <span className="mkt-badge-netting">✓ Refund Netting Active</span>
                    </div>

                    <div className="mkt-sankey-flow-diagram">
                      {/* Left: Sources */}
                      <div className="mkt-sankey-column">
                        <span className="mkt-sankey-col-title">Inflow Sources</span>
                        <div className="mkt-sankey-node source income">
                          <strong>Monthly Salary</strong>
                          <small>{fmt('₹ 2,45,000')}</small>
                        </div>
                        <div className="mkt-sankey-node source dividend">
                          <strong>Stock Dividends</strong>
                          <small>{fmt('₹ 12,000')}</small>
                        </div>
                      </div>

                      {/* Middle: Accounts */}
                      <div className="mkt-sankey-column">
                        <span className="mkt-sankey-col-title">Main Accounts</span>
                        <div className="mkt-sankey-node account">
                          <strong>Axis Salary Account</strong>
                          <small>{fmt('₹ 2,45,000')}</small>
                        </div>
                        <div className="mkt-sankey-node account">
                          <strong>SBI Secondary</strong>
                          <small>{fmt('₹ 12,000')}</small>
                        </div>
                      </div>

                      {/* Right: Destinations */}
                      <div className="mkt-sankey-column">
                        <span className="mkt-sankey-col-title">Envelopes & Wealth</span>
                        <div className="mkt-sankey-node dest invest">
                          <strong>SIPs & Equities</strong>
                          <small>{fmt('₹ 1,00,000 (41%)')}</small>
                        </div>
                        <div className="mkt-sankey-node dest pf">
                          <strong>EPFO & VPF</strong>
                          <small>{fmt('₹ 36,000 (15%)')}</small>
                        </div>
                        <div className="mkt-sankey-node dest living">
                          <strong>Living Expenses</strong>
                          <small>{fmt('₹ 48,000 (20%)')}</small>
                        </div>
                        <div className="mkt-sankey-node dest discretionary">
                          <strong>Lifestyle & Dining</strong>
                          <small>{fmt('₹ 20,430 (8%)')}</small>
                        </div>
                        <div className="mkt-sankey-node dest emergency">
                          <strong>Emergency Reserve</strong>
                          <small>{fmt('₹ 52,570 (21%)')}</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mockup Footer bar */}
            <div className="mkt-mockup-footer">
              <div className="mkt-mockup-foot-left">
                <span className="mkt-pulse-indicator" />
                <span>Single-Owner Instance Guard Active (Registration Locked)</span>
              </div>
              <div className="mkt-mockup-foot-right">
                <span>AES-256-GCM Vault</span>
                <span>•</span>
                <span>PostgreSQL 16</span>
                <span>•</span>
                <span>MinIO S3</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
