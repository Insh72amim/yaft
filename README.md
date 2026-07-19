<div align="center">
  <h1>💰 YAFT (Yet Another Financial Tool)</h1>
  <p><em>A private, self-hosted personal-finance web app for turning Indian bank and credit-card statements into a reviewed ledger and a clear monthly picture.</em></p>
</div>

---

## ✨ Key Features

- **👤 Single-Owner & Private:** Registration and login are locked to a single owner. Your data never leaves your hosted instance.
- **🏦 Comprehensive Accounts:** Seamlessly track Bank, Cash, Investment, Loan, and Credit-Card accounts.
- **📄 Smart Statement Parsing:** Intelligent, in-memory parsing for CSV, XLSX, and verified PDF statements (Axis, PNB, SBI).
- **🔒 Secure Vault:** Support for password-protected SBI PDFs with optional account-bound, encrypted password storage.
- **🕵️ Intelligent Deduplication:** Exact-file and transaction-level duplicate detection ensures your ledger stays clean.
- **🔄 Auto-Transfer Matching:** Intelligent cross-account transfer matching within a 3-day window.
- **📈 Portfolio Tracking:** Fail-closed Zerodha holdings XLSX import with strict row and portfolio-total reconciliation.
- **📊 Detailed Insights:** Track monthly income, spending, savings, category, balance, net-worth, and recent activities.
- **💳 Credit Management:** Easily monitor credit limits, due days, and credit utilisation indicators.
- **💼 Salary Tracking:** PDF salary-statement parsing with a staged review process and cumulative payroll history.
- **📱 Responsive UI:** A seamless experience across desktop and mobile, with modern card layouts and dark mode support.

## 🏗 Architecture

The app is split into a robust backend and a snappy frontend:

```text
Browser
  └─ Next.js web app (Port 3000)
       └─ same-origin /api proxy → NestJS API (Port 4000)
            ├─ authentication + owner-scoped services
            ├─ in-memory CSV/XLSX parser
            ├─ fail-closed bank PDF parser registry
            ├─ staged import/review pipeline
            ├─ AES-256-GCM statement credential vault
            └─ Prisma → PostgreSQL
```

> **Note on Data Handling:** Money is strictly stored as integer minor units (paise) to prevent floating-point errors. Uploaded files (Bank PDFs, Salary Slips, Zerodha Holdings) are processed purely in-memory and are **never** retained on disk.

## 🚀 Quick Start (Docker)

1. Copy `.env.example` to `.env`.
2. Generate secure passwords for `POSTGRES_PASSWORD` and `JWT_SECRET`. Your JWT secret should contain at least 32 random characters.
3. Generate a dedicated statement-password encryption key and save it to `YAFT_CREDENTIAL_ENCRYPTION_KEY`:
   ```sh
   openssl rand -base64 32
   ```
   > ⚠️ **IMPORTANT:** Do not reuse the JWT secret. Losing this key makes remembered PDF passwords unrecoverable. Ensure this is backed up!

4. Start the application:
   ```sh
   docker compose up --build
   ```
5. Navigate to `http://localhost:3000/register`. *The first registration claims the instance; subsequent registrations are rejected.*

## 💻 Local Development

**Requirements:** Node.js 20+ and Docker.

```sh
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

- Web App: `http://localhost:3000`
- API Server: `http://localhost:4000/api`

## 🔒 Security Posture

Security is a primary focus. Current protections include:

- **Argon2id** password hashing.
- HTTP-only, `SameSite=Strict`, 7-day signed session cookies.
- Single-owner registration lock.
- Strict DTO allow-listing, request validation, and rate limiting.
- Helmet security headers, exact-origin CORS, and 5 MB upload limits.
- SHA-256 file hashes and transaction fingerprints to prevent replays.
- **AES-256-GCM encryption** for optional account-specific PDF passwords, bound to the account ID.
- PostgreSQL database is isolated and not exposed to the internet.

> **Before Public Deployment:** Ensure you add TOTP/passkeys, encrypted automated backups, an HTTPS reverse proxy, and session revocation. Prefer a VPN like Tailscale over exposing this MVP to the public internet.

## 📥 Import Behaviour

1. **Hash Check:** The API rejects already-seen file hashes instantly.
2. **In-Memory Parse:** The file is read once, the layout is verified, and totals are reconciled.
3. **Staging:** Rows are safely written to `StagedTransaction` records.
4. **Review UI:** The interface displays value dates, category suggestions, and duplicate warnings.
5. **Approval:** Upon approval, non-duplicate rows are written inside a single DB transaction.
6. **Matching:** Equal-and-opposite movements in other owned accounts (within 3 days) are linked as transfers.

## 🔮 Next Milestones

- [ ] Category rules UI & learning from corrections
- [ ] TOTP/passkeys & advanced session management
- [ ] Import column-mapping UI for unusual bank exports
- [ ] Recurring bills, statement cycles, and card outstanding reconciliation
- [ ] Automated encrypted backups and restore verification
- [ ] Additional broker parsers, asset allocation trends, and XIRR
- [ ] BullMQ workers for email ingestion and background jobs

---
<div align="center">
  <i>Run the production compiler to validate your build:</i><br/>
  <code>npm run build</code>
</div>
