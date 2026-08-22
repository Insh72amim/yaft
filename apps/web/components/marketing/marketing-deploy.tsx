'use client';

import React, { useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Server,
  Layers,
  Cpu,
  Database,
  HardDrive,
  FileCode2,
  ExternalLink,
  ShieldCheck,
  Boxes
} from 'lucide-react';

export function MarketingDeploy() {
  const [activeDeployTab, setActiveDeployTab] = useState<'docker' | 'local' | 'arch'>('docker');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const dockerSnippet = `# 1. Clone repository
git clone https://github.com/yaft-finance/yaft.git
cd yaft

# 2. Configure environment
cp .env.example .env

# 3. Launch full stack with Docker Compose
docker compose up --build -d

# 4. Open in browser to claim instance
# → http://localhost:3000/register`;

  const localSnippet = `# 1. Install dependencies
npm install

# 2. Start PostgreSQL & MinIO storage
docker compose up -d postgres minio

# 3. Run database migrations
npm run db:generate
npm run db:migrate

# 4. Start Next.js & NestJS dev servers
npm run dev

# → Web App: http://localhost:3000
# → Swagger API Docs: http://localhost:4000/api/docs`;

  return (
    <section id="deploy" className="mkt-section mkt-deploy-section">
      <div className="mkt-container">
        <div className="mkt-section-header">
          <span className="mkt-section-eyebrow">
            <Terminal size={14} />
            <span>Developer Quickstart</span>
          </span>
          <h2 className="mkt-section-title">
            Deploy in 60 Seconds. <br />
            <span className="mkt-hero-gradient-text">Own Your Entire Stack.</span>
          </h2>
          <p className="mkt-section-desc">
            YAFT ships with ready-to-run Docker Compose manifests, PostgreSQL migrations, and MinIO
            storage configurations. Zero complex cloud orchestration required.
          </p>
        </div>

        {/* Deploy Tabs Switcher */}
        <div className="mkt-deploy-tabs">
          <button
            className={`mkt-deploy-tab ${activeDeployTab === 'docker' ? 'active' : ''}`}
            onClick={() => setActiveDeployTab('docker')}
          >
            <Boxes size={16} />
            <span>Docker Compose (Recommended)</span>
          </button>
          <button
            className={`mkt-deploy-tab ${activeDeployTab === 'local' ? 'active' : ''}`}
            onClick={() => setActiveDeployTab('local')}
          >
            <Cpu size={16} />
            <span>Local Node.js Development</span>
          </button>
          <button
            className={`mkt-deploy-tab ${activeDeployTab === 'arch' ? 'active' : ''}`}
            onClick={() => setActiveDeployTab('arch')}
          >
            <Layers size={16} />
            <span>System Architecture</span>
          </button>
        </div>

        {/* Deploy Content Panels */}
        <div className="mkt-deploy-panel">
          {/* DOCKER TAB */}
          {activeDeployTab === 'docker' && (
            <div className="mkt-terminal-window">
              <div className="mkt-terminal-top">
                <div className="mkt-terminal-dots">
                  <span className="mkt-dot red" />
                  <span className="mkt-dot yellow" />
                  <span className="mkt-dot green" />
                  <span className="mkt-terminal-label">bash — docker-compose</span>
                </div>
                <button
                  className="mkt-terminal-copy-btn"
                  onClick={() => copySnippet(dockerSnippet, 'docker')}
                  aria-label="Copy docker instructions"
                >
                  {copiedSection === 'docker' ? (
                    <>
                      <Check size={14} className="mkt-term-check" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="mkt-terminal-code">
                <code>{dockerSnippet}</code>
              </pre>
            </div>
          )}

          {/* LOCAL DEV TAB */}
          {activeDeployTab === 'local' && (
            <div className="mkt-terminal-window">
              <div className="mkt-terminal-top">
                <div className="mkt-terminal-dots">
                  <span className="mkt-dot red" />
                  <span className="mkt-dot yellow" />
                  <span className="mkt-dot green" />
                  <span className="mkt-terminal-label">bash — local development</span>
                </div>
                <button
                  className="mkt-terminal-copy-btn"
                  onClick={() => copySnippet(localSnippet, 'local')}
                  aria-label="Copy local dev instructions"
                >
                  {copiedSection === 'local' ? (
                    <>
                      <Check size={14} className="mkt-term-check" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="mkt-terminal-code">
                <code>{localSnippet}</code>
              </pre>
            </div>
          )}

          {/* ARCHITECTURE TAB */}
          {activeDeployTab === 'arch' && (
            <div className="mkt-arch-diagram-wrap">
              <div className="mkt-arch-grid">
                <div className="mkt-arch-node client">
                  <span className="mkt-arch-tag">Frontend Client</span>
                  <strong>Next.js 15 App Router</strong>
                  <p>React 19, Server Components, DM Sans & Manrope typography, Dark/Light theme token system.</p>
                  <small>Port 3000</small>
                </div>

                <div className="mkt-arch-arrow">→</div>

                <div className="mkt-arch-node api">
                  <span className="mkt-arch-tag">Backend Service</span>
                  <strong>NestJS Modular API</strong>
                  <p>Argon2id auth, AES-256-GCM vault, fail-closed parsers, dynamic payslip engine & Gmail OAuth sync.</p>
                  <small>Port 4000 /api</small>
                </div>

                <div className="mkt-arch-arrow">→</div>

                <div className="mkt-arch-col">
                  <div className="mkt-arch-node db">
                    <span className="mkt-arch-tag">Relational Ledger</span>
                    <strong>PostgreSQL + Prisma</strong>
                    <p>BigInt minor-unit paise precision, multi-account double entry ledger.</p>
                    <small>Port 5432</small>
                  </div>
                  <div className="mkt-arch-node storage">
                    <span className="mkt-arch-tag">Object Storage</span>
                    <strong>Local MinIO S3</strong>
                    <p>Retained statement PDFs, payslip proofs, and encrypted backup archives.</p>
                    <small>Port 9000 / 9001</small>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
