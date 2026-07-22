<div align="center">
  <h1>💰 YAFT (Yet Another Finance Tracker)</h1>
  <p><em>A private, local-first and self-hosted workspace for personal financial records.</em></p>
</div>

---

YAFT turns Indian bank statements, credit-card statements, salary payslips, EPFO passbooks and broker holdings into a reviewed financial ledger. It is designed for one owner to run on infrastructure they control; it is not a hosted service and does not send financial records to a YAFT-operated cloud.

## ✨ What YAFT Does

- **👤 Single-owner workspace:** The first registration claims the instance and later registrations are rejected.
- **🏦 Accounts and ledger:** Track bank, cash, investment, loan, EPFO, fixed-deposit and credit-card accounts in one place.
- **📥 Unified imports:** Choose the record type and issuer from one import workspace, then review reconciled data before it enters the ledger.
- **📄 Verified statement parsing:** Fail-closed PDF parsing for Axis Bank, Punjab National Bank and State Bank of India statements, plus Axis Bank credit-card statements and EPFO passbooks.
- **🕵️ Duplicate protection:** Exact-file and transaction-level checks keep repeat imports out of the ledger.
- **🔄 Transfer matching:** Equal-and-opposite movements across owned accounts can be linked and excluded from spending totals.
- **💼 Salary history:** Import Goldman Sachs payslips, record manual salary or variable payments, retain supporting documents and explore monthly and cumulative pay timelines.
- **📈 Investments:** Import reconciled Zerodha Kite and Groww holdings snapshots with portfolio totals, sector tags and gain/loss indicators.
- **💳 Debt tracking:** Monitor credit limits, utilisation, loans, amortisation schedules and confirmed EMIs.
- **🔒 Credential vault:** Optionally retain document-opening passwords using account-bound AES-256-GCM encryption.
- **🗂 Account documents:** Attach multiple PDFs or images to Bank/Savings and Loan accounts and view them inline with zoom controls.
- **📱 Local web UI:** Responsive account, salary, import and dashboard views with dark-mode support.

The detailed implementation inventory and longer roadmap live in [`features.md`](features.md).

## 🗄️ Local Data and Document Storage

YAFT intentionally keeps application data on the self-hosted instance:

- **PostgreSQL** stores users, accounts, ledger transactions, import reviews, salary records and other structured data.
- **MinIO** provides local S3-compatible document storage. Imported salary payslips, manual salary proofs and documents attached to Bank/Savings or Loan accounts are retained there and served through authenticated YAFT endpoints.
- **Bank, credit-card and EPFO statement files, and broker spreadsheets, are currently parsed in request memory but their original files are not yet retained.** Approved transaction or holdings data is stored in PostgreSQL.
- Docker persists PostgreSQL and MinIO data in the `postgres_data` and `minio_data` volumes. Removing those volumes removes the corresponding local data.

Local storage means the operator controls where the records live. It does not replace access controls, disk encryption or backups. Back up both PostgreSQL and MinIO together so ledger records and retained documents remain consistent.

## 🏗️ Architecture

```text
Browser
  └─ Next.js web app (port 3000)
       └─ same-origin /api proxy → NestJS API (port 4000)
            ├─ authentication and owner-scoped services
            ├─ unified import and staged review pipeline
            ├─ fail-closed statement and holdings parsers
            ├─ AES-256-GCM document-credential vault
            ├─ Prisma → PostgreSQL (structured financial data)
            └─ S3 client → MinIO (retained documents)
```

Money is stored as integer minor units (paise) to avoid floating-point rounding errors. Import parsers reject unknown, ambiguous or unreconciled layouts instead of guessing.
Transaction-import files are processed in memory. Files intentionally saved as salary proofs or associated account documents remain in local MinIO and are available only through authenticated, owner-scoped endpoints.

## 🚀 Run Locally with Docker

**Requirements:** Docker with Compose support.

1. Create the local environment file:

   ```sh
   cp .env.example .env
   ```

2. Set a long, unique `POSTGRES_PASSWORD` and a `JWT_SECRET` containing at least 32 random characters.

3. Generate a separate key for encrypted document-opening passwords:

   ```sh
   openssl rand -base64 32
   ```

   Save the result as `YAFT_CREDENTIAL_ENCRYPTION_KEY` in `.env`. Do not reuse the JWT secret. If this key is lost, remembered PDF passwords cannot be recovered.

4. Start the local stack:

   ```sh
   docker compose up --build
   ```

5. Open `http://localhost:3000/register`. The first account becomes the sole owner of the instance.

The stack includes the web app, API, PostgreSQL and MinIO. Its default port exposure and MinIO development credentials are intended for a trusted local machine only. Do not expose ports `3000`, `4000`, `5432`, `9000` or `9001` directly to the public internet.

## 💻 Local Development

**Requirements:** Node.js 20+ and Docker.

```sh
cp .env.example .env
docker compose up -d postgres minio
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

- Web app: `http://localhost:3000`
- API: `http://localhost:4000/api`
- API documentation: `http://localhost:4000/api/docs`
- MinIO console: `http://localhost:9001`

## 🔒 Security and Operator Responsibilities

Current application protections include:

- Argon2id password hashing.
- HTTP-only, `SameSite=Strict`, signed session cookies.
- Single-owner registration lock.
- Strict request validation, rate limiting and security headers.
- SHA-256 file hashes and transaction fingerprints for duplicate detection.
- AES-256-GCM encryption for remembered PDF passwords, bound to the relevant record.
- Owner-scoped database queries and authenticated document download/view endpoints.
- Saved account documents accept only signature-verified PDF, PNG, or JPEG content and are served with private, no-store response headers.

For use beyond a trusted local machine, place YAFT behind HTTPS and a private network or VPN, replace all development credentials, restrict host firewall access, encrypt the host disk and establish encrypted, tested backups. TOTP/passkeys and session revocation are not yet implemented, so direct public-internet exposure is not recommended.

## 📥 Import Behaviour

1. **Select:** Choose the record type, issuer/employer and destination account where applicable.
2. **Validate:** YAFT checks the file type, known layout and printed totals; unknown or changed layouts fail closed.
3. **Parse:** The upload is parsed in request memory. Retention depends on the document type described above.
4. **Stage:** Bank, credit-card, EPFO and salary records requiring review are prepared without immediately changing the ledger.
5. **Review:** Confirm rows, categories, duplicates, balances or payroll totals.
6. **Commit:** Approved records are written atomically. Broker snapshots replace the selected account's previous snapshot only after full reconciliation.

## 🔮 Next Three Priorities

1. **Complete the local document library:** Retain original bank, credit-card and EPFO import files and extend the existing account-document library with richer metadata and recovery tooling.
2. **Make self-hosted recovery dependable:** Add encrypted automated backups for PostgreSQL and MinIO, restore verification, configurable MinIO credentials and clear migration/recovery guidance.
3. **Finish verified import coverage:** Implement the currently planned ICICI and SBI credit-card parsers, add the Acme Corp-style salary schema and ensure the unified importer advertises only sources with fully reconciled parser support.

After these foundations, the next product-value milestone is a transfer-aware spend analyser with editable categorisation rules and mutual-fund transfer reconciliation.

---

<div align="center">
  <i>Run the production compiler to validate application changes:</i><br/>
  <code>npm run build</code>
</div>
