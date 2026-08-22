'use client';

import React from 'react';
import {
  ShieldAlert,
  Lock,
  HardDrive,
  Key,
  Server,
  UserCheck,
  CheckCircle2,
  FileKey2,
  Database,
  Archive
} from 'lucide-react';

export function MarketingSecurity() {
  const securityPillars = [
    {
      icon: <Server size={22} className="mkt-sec-icon" />,
      title: 'Zero Cloud Telemetry',
      desc: 'YAFT never communicates with external tracking servers, third-party LLM endpoints, or advertising networks. Your entire financial history lives strictly on your local machine or private home server.',
    },
    {
      icon: <UserCheck size={22} className="mkt-sec-icon" />,
      title: 'Single-Owner Instance Lock',
      desc: 'The moment you create your administrator account on initial setup, YAFT permanently locks public registration. No unauthorized guest accounts can ever be spawned on your private instance.',
    },
    {
      icon: <FileKey2 size={22} className="mkt-sec-icon" />,
      title: 'AES-256-GCM Credential Vault',
      desc: 'Bank statement passwords, card CVVs, and sensitive document keys are stored encrypted on disk using AES-256-GCM with unique Initialization Vectors (IVs) and authenticated tags.',
    },
    {
      icon: <Database size={22} className="mkt-sec-icon" />,
      title: 'Local MinIO S3 Storage',
      desc: 'Uploaded PDF bank statements, corporate salary slips, and account proof documents are stored in a self-hosted MinIO object storage container — isolated from the public internet.',
    },
    {
      icon: <Key size={22} className="mkt-sec-icon" />,
      title: 'Argon2id Password Security',
      desc: 'User authentication uses memory-hard Argon2id hashing with HTTP-only, SameSite session cookies to safeguard against offline brute-force and token hijacking attacks.',
    },
    {
      icon: <Archive size={22} className="mkt-sec-icon" />,
      title: '1-Click Encrypted Backups',
      desc: 'Export your entire instance — PostgreSQL ledger tables, categorization rules, dynamic parser configs, and MinIO document storage — into an encrypted .yaft-backup archive in seconds.',
    },
  ];

  return (
    <section id="security" className="mkt-section mkt-security-section">
      <div className="mkt-container">
        <div className="mkt-section-header">
          <span className="mkt-section-eyebrow">
            <Lock size={14} />
            <span>Sovereign Security Architecture</span>
          </span>
          <h2 className="mkt-section-title">
            Your Financial Records Belong <br />
            <span className="mkt-hero-gradient-text">Exclusively on Iron You Own</span>
          </h2>
          <p className="mkt-section-desc">
            SaaS financial aggregators harvest your spending habits, monetize merchant graphs,
            and store raw financial statements on multi-tenant cloud servers. YAFT eliminates the
            middleman entirely.
          </p>
        </div>

        {/* Security Grid */}
        <div className="mkt-security-grid">
          {securityPillars.map((pillar, i) => (
            <div key={i} className="mkt-security-card">
              <div className="mkt-sec-icon-wrap">{pillar.icon}</div>
              <h3>{pillar.title}</h3>
              <p>{pillar.desc}</p>
            </div>
          ))}
        </div>

        {/* Security Checklist Banner */}
        <div className="mkt-security-banner">
          <div className="mkt-sec-banner-text">
            <h3>Strict Financial Privacy Invariants</h3>
            <p>Built into the YAFT core codebase and verified by automated regression test suites:</p>
          </div>
          <div className="mkt-sec-checklist">
            <div className="mkt-sec-check-item">
              <CheckCircle2 size={16} className="mkt-text-green" />
              <span>Never logs, prints, or exposes statement passwords in plain text</span>
            </div>
            <div className="mkt-sec-check-item">
              <CheckCircle2 size={16} className="mkt-text-green" />
              <span>In-memory PDF decryption via <code>qpdf</code> without disk caching</span>
            </div>
            <div className="mkt-sec-check-item">
              <CheckCircle2 size={16} className="mkt-text-green" />
              <span>Zero external JavaScript CDN dependencies or third-party trackers</span>
            </div>
            <div className="mkt-sec-check-item">
              <CheckCircle2 size={16} className="mkt-text-green" />
              <span>All database queries strictly isolated by authenticated <code>userId</code></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
