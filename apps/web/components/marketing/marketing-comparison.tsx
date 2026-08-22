'use client';

import React from 'react';
import { Check, X, Minus, HelpCircle, Scale, Shield } from 'lucide-react';

export function MarketingComparison() {
  const comparisonRows = [
    {
      feature: 'Self-Hosted / 100% Data Sovereignty',
      yaft: true,
      saasIndia: false,
      saasUS: false,
      sheets: true,
      tooltip: 'Your data lives on your own hardware, not on multi-tenant SaaS servers.',
    },
    {
      feature: 'Native Indian Bank Statement Parsers (Axis, SBI, PNB)',
      yaft: true,
      saasIndia: 'Partial',
      saasUS: false,
      sheets: false,
      tooltip: 'Parses password-protected bank PDFs with trailing Cr./Dr. balances and reconciliation.',
    },
    {
      feature: 'Dynamic JSON Payslip & Tax Engine (TDS, PF, 80C)',
      yaft: true,
      saasIndia: false,
      saasUS: false,
      sheets: false,
      tooltip: 'Regex-based parser sandbox with math verification: Gross - Deductions = Net Pay.',
    },
    {
      feature: 'In-Memory Password-Free PDF Viewer',
      yaft: true,
      saasIndia: false,
      saasUS: false,
      sheets: false,
      tooltip: 'Decrypts password-protected PDFs via backend qpdf on the fly in RAM without saving plaintext to disk.',
    },
    {
      feature: 'Direct Gmail Swipe Alerts Sync (No Account Spawning)',
      yaft: true,
      saasIndia: 'Cloud Scraper',
      saasUS: false,
      sheets: false,
      tooltip: 'Fetches credit card notifications directly via official Gmail OAuth2 API.',
    },
    {
      feature: 'Signed Integer Minor-Unit Math (Paise Precision)',
      yaft: true,
      saasIndia: false,
      saasUS: true,
      sheets: false,
      tooltip: 'Zero floating-point rounding errors (0.1 + 0.2 ≠ 0.3) in ledger calculations.',
    },
    {
      feature: 'Credit Utilization Radar & Visual Card Stack',
      yaft: true,
      saasIndia: true,
      saasUS: 'Partial',
      sheets: false,
      tooltip: 'Visual card gallery with bank logos, credit limits, and 6-month cashflow trends.',
    },
    {
      feature: 'Fail-Closed Statement & Holdings Validation',
      yaft: true,
      saasIndia: false,
      saasUS: false,
      sheets: false,
      tooltip: 'Rejects malformed or unreconciled statements rather than guessing transactions.',
    },
    {
      feature: 'Zero Subscription Fees / Free Forever',
      yaft: true,
      saasIndia: 'Freemium / Ads',
      saasUS: false,
      sheets: true,
      tooltip: 'Open source and free without recurring $100+/year subscription fees or advertisements.',
    },
  ];

  const renderBadge = (val: boolean | string) => {
    if (val === true) {
      return (
        <span className="mkt-cmp-badge yes">
          <Check size={14} /> Yes
        </span>
      );
    }
    if (val === false) {
      return (
        <span className="mkt-cmp-badge no">
          <X size={14} /> No
        </span>
      );
    }
    return <span className="mkt-cmp-badge partial">{val}</span>;
  };

  return (
    <section id="comparison" className="mkt-section mkt-comparison-section">
      <div className="mkt-container">
        <div className="mkt-section-header">
          <span className="mkt-section-eyebrow">
            <Scale size={14} />
            <span>Honest Breakdown</span>
          </span>
          <h2 className="mkt-section-title">
            How YAFT Compares to <br />
            <span className="mkt-hero-gradient-text">Other Finance Tools</span>
          </h2>
          <p className="mkt-section-desc">
            See why sovereign individuals and engineers are moving away from closed-source cloud apps
            and error-prone manual spreadsheets.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="mkt-cmp-table-wrap">
          <table className="mkt-cmp-table">
            <thead>
              <tr>
                <th className="mkt-cmp-feature-head">Capability / Feature</th>
                <th className="mkt-cmp-yaft-head">
                  <div className="mkt-yaft-highlight-badge">
                    <strong>YAFT</strong>
                    <span>(Self-Hosted)</span>
                  </div>
                </th>
                <th>
                  <span>Fintech SaaS</span>
                  <small>Fold / CRED</small>
                </th>
                <th>
                  <span>US Apps</span>
                  <small>YNAB / Monarch</small>
                </th>
                <th>
                  <span>Spreadsheets</span>
                  <small>Excel / Sheets</small>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'even' : 'odd'}>
                  <td className="mkt-cmp-feat-cell">
                    <strong>{row.feature}</strong>
                    <small>{row.tooltip}</small>
                  </td>
                  <td className="mkt-cmp-yaft-cell">{renderBadge(row.yaft)}</td>
                  <td>{renderBadge(row.saasIndia)}</td>
                  <td>{renderBadge(row.saasUS)}</td>
                  <td>{renderBadge(row.sheets)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
