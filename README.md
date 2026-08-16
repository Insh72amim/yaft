<div align="center">
  <h1>💰 YAFT (Yet Another Finance Tracker)</h1>
  <p><em>A private, local-first, self-hosted workspace for personal financial records.</em></p>
</div>

---

YAFT turns Indian bank statements, credit card transactions, salary payslips, EPFO passbooks, active SIPs, and broker holdings into a verified, reviewed financial ledger. It is designed for single-owner deployment on infrastructure you control; it is not a hosted SaaS and never sends financial records to third-party cloud servers.

---

## ✨ Core Feature Highlights

### 🏦 1. Accounts & Reconciled Ledger (`/accounts`, `/transactions`)
- **Consolidated Master View**: Grouped by account type—Savings/Bank, Credit Cards, Loans, Investments, EPFO, Fixed Deposits, Cash, and UPI Lite.
- **Auto-Recalculating Ledger**: Real-time balances, debit/credit color coding, opening balance calculation, and signed integer minor unit (paise) math to eliminate floating-point rounding errors.
- **Privacy Masking**: Global toggle to hide or reveal account balances, net pay, and debt numbers across the UI.
- **Data Protection Safeguards**: Double-confirmation deletion (typing exact account name) and a dedicated **Clear Ledger** option (wipes transaction history while preserving account credentials, settings, and documents).
- **Advanced Filtering**: Filter transactions by date range, account, search query, or Category Group (Expense, Income, Investment, Transfer).

### 💳 2. Dedicated Credit Cards Hub (`/credit-cards`)
- **Utilization Command Center**: Aggregated credit utilization rate gauge, health indicators (Healthy / Moderate / High), total outstanding balance, and available credit tracking.
- **Digital Visual Card Stack**: Interactive card gallery showing bank logos, card networks (Visa, Mastercard, Amex, RuPay), last 4 digits, and live limit progress bars.
- **Cash Flow Trends**: 6-month visual comparison tracking monthly credit card expenses against bill payments made.
- **Quick Action Shortcuts**: 1-click triggers for **⚡ Gmail Sync**, **🔐 Vault Credentials**, and **📋 Card Activity**.

### 💼 3. Salary Management & Dynamic Payslip Engine (`/salary`)
- **Dynamic Payslip Parser Engine**: Configure company payslips with stored JSON parsing rules (`parsingConfig`), regex anchors, and field extractors without writing code.
- **Employer Organization Onboarding**: Create and manage employer profiles with custom colors, symbols, tax IDs, and document anchors.
- **Visual Sandbox & Math Verification**: Upload sample payslips to test dynamic extraction rules with real-time equation validation (`Gross - Deductions = Net Pay`).
- **Password-Free Inline Payslip Viewer**: Decrypts password-protected payslips on the fly via backend `qpdf` integration and renders them in a zoomable inline viewer without prompting for passwords.
- **Manual Salary Entries**: Record manual pay records or variable payments with optional proof file attachments stored safely in local MinIO.
- **Interactive Pay Timelines**: Monthly breakdown charts (Gross, Net, Tax) and cumulative net pay growth feeds.

### 📥 4. Unified Imports & Statement Parsing (`/import`)
- **Unified Import Hub**: Single workspace for uploading bank statements, credit card records, EPFO passbooks, and broker sheets.
- **Fail-Closed Bank Statement Parsers**: Reconciled PDF parsers for **Axis Bank**, **State Bank of India (SBI)**, and **Punjab National Bank (PNB)** with automated password candidate fallback and trailing `Cr.`/`Dr.` balance handling.
- **EPFO Passbook Parser**: Monthly ledger staging for employee and employer PF deposits, withdrawals, and interest credits.
- **Broker Holdings Snapshots**: Import Zerodha Kite and Groww portfolio sheets with sector categorization and unrealized P&L badges.
- **Staged Review Workflow**: Inspect and modify categorized rows, verify opening/closing balances, and deduplicate before committing to the live ledger.

### 📧 5. Gmail Transaction Sync (`/email-ingestion`)
- **Direct Gmail API Integration**: Connect Google Workspace or personal Gmail via OAuth2 to auto-fetch transaction alert emails.
- **Credit Card Transaction Alerts**: Specialized parsers for HDFC Bank, ICICI Bank, Axis Bank, and SBI Card credit card transaction notifications.
- **Zero Account Spawning**: Strictly requires pre-existing user accounts and skips unrelated alerts safely.

### 📊 6. Spend Analyser, Budgets & Rule Engine (`/dashboard`, `/budgets`, `/categories`)
- **Multi-Bank Sankey Flow**: Interactive visual flow diagram tracking income streams, account transfers, and category expenses.
- **Refund & Reversal Netting**: Automatically offsets merchant refunds and cashbacks against category expenses without breaking individual ledger rows.
- **Automated Categorization Rules**: Rule builder supporting `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, and `REGEX` matches with instant retroactive application across the ledger.
- **Bulk Categorization**: Bulk select transactions by merchant or keyword to apply categories in one click.
- **Category Budgets**: Set monthly envelope limits per category with visual spend progress bars and threshold warning alerts.

### 🏷️ 7. Custom Tags & Analytics (`/tags`)
- **Multi-Tagging**: Attach custom tags (e.g. `#Vacation`, `#Tax80C`, `#Medical`) to transactions across accounts.
- **Range Tagging**: Apply tags and categories across custom date and amount ranges.
- **Tag Analytics**: Dedicated spend analytics and transaction breakdowns per tag.

### 📈 8. Investments & SIP Tracker (`/sip`)
- **Active SIP Schedule Tracker**: Track systematic investment plans by execution day, frequency, linked bank account, and monthly commitment.
- **Holdings Portfolio**: Reconciled stock and mutual fund holdings with sector tags and profit/loss indicators.

### 📉 9. Loans & EMI Amortization
- **Amortization Engine**: Computes complete EMI schedules with principal/interest breakdowns and running balances.
- **Interactive EMI Confirmation**: Check off due EMIs to record payments directly into the ledger atomically.

### 🔐 10. Credential Vault & Document Library (`/vault`, `/account-documents`)
- **AES-256-GCM Encrypted Vault**: Account-bound encryption for credit card numbers, CVVs, expiry dates, IFSC codes, UPI IDs, and PDF statement passwords.
- **Associated Account Documents**: Attach multiple PDFs or images to Bank/Savings and Loan accounts with secure inline preview and zoom controls.

### 💾 11. One-Click Encrypted Backup & Restore
- **Full Database & Storage Backups**: Export and restore complete `.yaft-backup` encrypted archives containing both PostgreSQL records and MinIO files.

---

## 🏗️ Architecture

```text
Browser
  └─ Next.js 15 Web App (Port 3000)
       └─ /api proxy → NestJS API (Port 4000)
            ├─ Argon2id Authentication & Single-Owner Guard
            ├─ Unified Import & Staged Review Pipeline
            ├─ Fail-Closed Statement & Holdings Parsers
            ├─ AES-256-GCM Document-Credential Vault
            ├─ Dynamic Payslip Parser Engine
            ├─ Google Gmail API Ingestion Service
            ├─ Prisma ORM → PostgreSQL (Structured Financial Ledger)
            └─ S3 Client → MinIO (Retained Documents & Proofs)
```

- **Minor Unit Precision**: All currency amounts are stored as `BigInt` minor units (paise) to guarantee arithmetic accuracy.
- **Tenant & Privacy Isolation**: All database queries strictly scope to the authenticated `userId`.
- **Fail-Closed Parsing**: Unknown, ambiguous, or unreconciled statement layouts fail immediately rather than guessing financial numbers.

---

## 🚀 Quick Start with Docker

### Requirements
- [Docker](https://docs.docker.com/get-docker/) with Compose support.

### Setup
1. Clone the repository and copy the environment template:
   ```sh
   cp .env.example .env
   ```

2. Edit `.env` to set strong passwords and keys:
   - `POSTGRES_PASSWORD`: Strong database password.
   - `JWT_SECRET`: Random 32+ character string.
   - `YAFT_CREDENTIAL_ENCRYPTION_KEY`: Generate using `openssl rand -base64 32`.

3. Launch the container stack:
   ```sh
   docker compose up --build -d
   ```

4. Open `http://localhost:3000/register` in your browser. The first registered user claims the instance; subsequent registrations are automatically locked.

---

## 💻 Local Development Setup

### Requirements
- Node.js 20+
- Docker (for PostgreSQL & MinIO)

```sh
# 1. Setup environment
cp .env.example .env

# 2. Start PostgreSQL and MinIO
docker compose up -d postgres minio

# 3. Install dependencies
npm install

# 4. Run database migrations
npm run db:generate
npm run db:migrate

# 5. Start development servers (Next.js + NestJS)
npm run dev
```

- **Web Application**: `http://localhost:3000`
- **Backend API**: `http://localhost:4000/api`
- **Interactive OpenAPI Docs (Swagger)**: `http://localhost:4000/api/docs`
- **MinIO Storage Console**: `http://localhost:9001`

---

## 🔒 Security & Privacy Practices

- **Zero Cloud Exposure**: Self-hosted, private ledger running exclusively on your own machine or private home server.
- **Single-Owner Instance Lock**: Closes public registration immediately after the first owner signs up.
- **Account-Bound Encryption**: PDF passwords and card vault credentials use AES-256-GCM with unique initialization vectors (IVs).
- **Secure File Storage**: Uploaded payslip proofs and account documents are served with private, no-store headers and signature-verified MIME types.
- **Strict multi-worktree development**: Clean git workflows and branch isolation maintained per [`AGENTS.md`](AGENTS.md).

---

<div align="center">
  <i>Run the full test suite and production build:</i><br/>
  <code>npm run test && npm run build</code>
</div>
