'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export function MarketingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Why self-hosted instead of a cloud app like Fold, CRED, or Mint?',
      a: 'Financial records contain your most sensitive personal information: salary, bank account balances, tax deductions, medical expenses, and daily whereabouts. Cloud finance apps monetize this data, train models on your habits, or shut down unexpectedly (like Mint). YAFT runs strictly on your own hardware, guaranteeing zero third-party cloud data harvesting.',
    },
    {
      q: 'Which Indian banks and institutions are currently supported?',
      a: 'YAFT includes native fail-closed PDF parsers for Axis Bank, State Bank of India (SBI), Punjab National Bank (PNB), and EPFO Passbooks. It also imports Zerodha Kite and Groww portfolio snapshot sheets, plus real-time credit card swipe alert sync for HDFC Bank, ICICI Bank, Axis Bank, and SBI Card via the Gmail API.',
    },
    {
      q: 'How does the Gmail Sync work securely without sharing my Google password?',
      a: 'YAFT connects directly to the official Google Workspace / Gmail API using client-controlled OAuth2 tokens. Your credentials remain in your local PostgreSQL database. The worker fetches only credit card transaction alert emails, parses the merchant and amount, and matches them to your pre-existing accounts without spawning extraneous accounts.',
    },
    {
      q: 'How does the Dynamic Payslip Engine handle different employer formats?',
      a: 'Instead of requiring custom code changes for every employer, YAFT provides a dynamic JSON parsing engine (`parsingConfig`). You can configure regex anchors for Gross Earnings, Deductions (TDS, PF, Professional Tax), and Net Pay, test them in a visual equation sandbox (`Gross - Deductions = Net Pay`), and decrypt password-protected PDFs on the fly in RAM using `qpdf`.',
    },
    {
      q: 'How does YAFT eliminate floating-point rounding errors?',
      a: 'Standard JavaScript numbers use IEEE 754 floating-point math, where 0.1 + 0.2 equals 0.30000000000000004. In accounting, this creates balance drifts. YAFT stores and calculates all balances and transactions as signed integer minor units (`BigInt` paise), ensuring 100% exact balance arithmetic down to the paisa.',
    },
    {
      q: 'Can I run YAFT on a Raspberry Pi, NAS, or private home server?',
      a: 'Yes! YAFT is fully containerized with Docker Compose. It runs smoothly on any Linux, macOS, or Windows machine, including Raspberry Pi 4/5, Synology NAS, Unraid, TrueNAS, or home server environments.',
    },
    {
      q: 'How do I backup and restore my ledger data?',
      a: 'YAFT features a 1-click backup and restore engine under Settings (`/me`). It packages all PostgreSQL database rows and MinIO S3 statement PDFs into an encrypted `.yaft-backup` archive file that you can restore to any new machine or container in seconds.',
    },
    {
      q: 'Is YAFT completely free and open source?',
      a: 'Yes. YAFT is 100% free and open-source under a permissive license. There are no paid tiers, hidden subscriptions, paywalls, or feature gates.',
    },
  ];

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="mkt-section mkt-faq-section">
      <div className="mkt-container">
        <div className="mkt-section-header">
          <span className="mkt-section-eyebrow">
            <HelpCircle size={14} />
            <span>Got Questions?</span>
          </span>
          <h2 className="mkt-section-title">
            Frequently Asked <br />
            <span className="mkt-hero-gradient-text">Questions</span>
          </h2>
          <p className="mkt-section-desc">
            Everything you need to know about YAFT architecture, security, and statement parsing.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="mkt-faq-accordion">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className={`mkt-faq-item ${isOpen ? 'open' : ''}`}>
                <button
                  className="mkt-faq-question"
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`mkt-faq-chevron ${isOpen ? 'rotate' : ''}`} size={18} />
                </button>
                {isOpen && (
                  <div className="mkt-faq-answer">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
