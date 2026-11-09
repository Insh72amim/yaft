# 💰 YAFT (Yet Another Finance Tracker)

A private, self-hosted workspace that consolidates Indian bank statements, credit card spends, corporate payslips, EPFO passbooks, active SIPs, and investment holdings into a verified, reviewed financial ledger.

Designed for single-owner deployment on hardware you control. Zero cloud tracking, no SaaS subscriptions, and zero financial data exposure.

---

## ⚡ Highlights

- **Accounts & Reconciled Ledger**: Bank accounts, Credit Cards, Loans, Investments, EPFO, Fixed Deposits, and Cash with integer-precision (paise) math, balance masking, and instant filtering.
- **Credit Cards Command Center**: Track aggregated utilization, billing cycles, payment due dates, and 6-month repayment trends.
- **Dynamic Payslip Parser Engine**: Upload company payslips with customizable JSON parsing rules, regex anchors, and inline password-free decryption.
- **Fail-Closed Statement Parsing**: Native, reconciled statement parsers for **Axis Bank**, **SBI**, **PNB**, and **EPFO** passbooks.
- **Gmail Alerts Sync**: Direct OAuth2 integration to ingest transaction alerts from HDFC, ICICI, Axis, and SBI Card.
- **Cash Flow & Analytics**: Interactive multi-bank Sankey flow diagram, automated categorization rules, refunds netting, and envelope budgets.
- **Encrypted Vault & Document Library**: Account-bound AES-256-GCM encryption for credentials, card CVVs, statement passwords, and attached documents.

> For an in-depth breakdown of all capabilities, see [docs/features.md](docs/features.md).

---

## 🏗️ Architecture

```text
Browser
  └─ Next.js 15 Web App (Port 3000)
       └─ /api proxy → NestJS API (Port 4000)
            ├─ Argon2id Auth & Single-Owner Registration Lock
            ├─ Unified Import & Staged Review Pipeline
            ├─ Fail-Closed Statement & Holdings Parsers
            ├─ AES-256-GCM Document-Credential Vault
            ├─ Dynamic Payslip Parser Engine
            ├─ Google Gmail API Ingestion Service
            ├─ Prisma ORM → PostgreSQL (Structured Financial Ledger)
            └─ S3 Client → MinIO (Retained Documents & Proofs)
```

---

## 🚀 Quick Start (Docker)

```sh
# 1. Clone and configure environment
cp .env.example .env

# 2. Launch the container stack
docker compose up --build -d

# 3. Open in browser
open http://localhost:3000/register
```

> **Note**: The first registered account permanently claims the instance. Subsequent public registrations are automatically locked.

---

## 💻 Local Development Setup

**Prerequisites**: Node.js 20+, Docker (for PostgreSQL & MinIO)

```sh
# 1. Setup environment and start dependencies
cp .env.example .env
docker compose up -d postgres minio

# 2. Install dependencies & run migrations
npm install
npm run db:generate
npm run db:migrate

# 3. Start development servers (Next.js + NestJS)
npm run dev
```

- **Web App**: `http://localhost:3000`
- **Backend API**: `http://localhost:4000/api`
- **Interactive Swagger Docs**: `http://localhost:4000/api/docs`
- **MinIO Console**: `http://localhost:9001`

---

## 🔒 Security & Privacy

- **Single-Owner Guard**: Instance locks automatically after registration.
- **AES-256-GCM Encryption**: Credentials and PDF passwords use unique IVs and account-bound encryption keys.
- **Fail-Closed Invariant**: Unknown, malformed, or unreconciled statement layouts reject cleanly rather than guessing financial amounts.
- **Zero Third-Party Leaks**: All databases, storage buckets, and jobs run locally on your host machine.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

<div align="center">
  <i>Run full test suite and build:</i><br/>
  <code>npm run test && npm run build</code>
</div>
