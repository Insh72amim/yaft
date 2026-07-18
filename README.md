# YAFT

**Yet Another Financial Tool** — a private, self-hosted personal-finance web app for turning Indian bank and credit-card statements into a reviewed ledger and a clear monthly picture.

The first working slice supports:

- Single-owner registration and login
- Bank, cash, investment, loan, and credit-card accounts
- CSV, XLSX, and verified Axis, Punjab National Bank, and SBI PDF statement parsing in memory
- Password-protected SBI PDFs with optional account-bound encrypted password storage
- A staging review before anything reaches the ledger
- Merchant cleanup and deterministic category suggestions
- Exact-file and transaction-level duplicate detection
- Cross-account transfer matching within a three-day window
- Monthly income, spending, savings, category, balance, net-worth, and recent-activity views
- Credit limits, due days, and utilisation indicators
- PDF salary-statement parsing with staged review and cumulative payroll history
- Responsive desktop and mobile layouts

## Architecture

```text
Browser
  └─ Next.js web app (:3000)
       └─ same-origin /api proxy → NestJS API (:4000)
            ├─ authentication + owner-scoped services
            ├─ in-memory CSV/XLSX parser
            ├─ fail-closed bank PDF parser registry
            ├─ staged import/review pipeline
            ├─ AES-256-GCM statement credential vault
            └─ Prisma → PostgreSQL
```

Money is stored as integer minor units (paise), never floating point. Uploaded files are held in memory for parsing and are not saved. Redis/BullMQ is intentionally deferred until slow background jobs—PDF extraction, email ingestion, or market-price sync—exist; a queue adds no value to this synchronous 5 MB MVP import.

Salary PDFs are also parsed in memory and are not retained. The payroll ledger stores monthly earnings, deductions, employer contributions, current and year-to-date figures, and only the final four digits of selected identifiers. Full PAN, UAN, bank account, PF numbers, and raw PDF text are not persisted.

## Quick start with Docker

1. Copy `.env.example` to `.env`.
2. Replace `POSTGRES_PASSWORD` and `JWT_SECRET`. Generate each with a password manager; the JWT secret should contain at least 32 random characters.
3. Generate the dedicated statement-password encryption key and put the output in `YAFT_CREDENTIAL_ENCRYPTION_KEY`:

   ```sh
   openssl rand -base64 32
   ```

   Do not reuse the JWT secret. Losing this key makes remembered PDF passwords unrecoverable, so include the `.env` value in your encrypted backup policy.
4. Start everything:

   ```sh
   docker compose up --build
   ```

5. Open `http://localhost:3000/register`. The first registration claims the instance; later registrations are rejected.
6. Add an account and open **Import statement**. Real financial samples belong outside the repository in `/Users/yaft/Code/YAFT-private-inputs`.

The API applies the included initial migration automatically when its container starts.

## Local development

Requirements: Node.js 20+ and Docker.

```sh
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:4000/api`.

## Statement format

The importer detects common headers. A statement should have:

- `Date`, `Transaction Date`, `Txn Date`, `Value Date`, or `Posted Date`
- `Description`, `Narration`, `Transaction Details`, `Particulars`, or `Remarks`
- Either a signed `Amount` column, or separate `Debit` and `Credit` columns
- An optional reference/transaction-ID column

Dates in `DD/MM/YYYY`, `DD-MM-YYYY`, ISO format, and native Excel date cells are supported. Debit values become negative ledger amounts; credit values become positive amounts.

PDF routing first uses the destination account's normalised institution, then verifies the document layout. If the institution is absent or unrecognised, import proceeds only when exactly one parser recognises the document. Unknown, ambiguous, scanned, changed, cross-bank, or unreconciled layouts are rejected without creating an import batch.

- Axis: the supported seven-column transaction-history layout is parsed across its ledger pages; running balances and printed debit, credit, and closing totals must reconcile.
- Punjab National Bank: bordered transaction tables preserve withdrawal/deposit direction and reconcile running balances across page breaks.
- SBI: the supported password-protected account-statement layout preserves value and post dates, wrapped descriptions, and repeated legitimate ACH entries; every running balance and the final statement summary must reconcile.

## Security posture

Implemented now:

- Argon2id password hashes
- HTTP-only, `SameSite=Strict`, seven-day signed session cookies
- Single-owner registration lock
- Strict DTO allow-listing and request validation
- Login/registration throttling and a global request limit
- Helmet security headers, exact-origin CORS, and 5 MB upload limits
- Ownership checks on every account, import, category, transaction, and dashboard query
- SHA-256 file hashes and transaction fingerprints
- AES-256-GCM encryption for optional account-specific PDF passwords, with the account ID bound as authenticated data
- A dedicated required encryption key, separate from the JWT secret
- PostgreSQL is not published to the host or internet by Compose

Saved credentials are document-opening passwords only. Never enter an SBI internet-banking password, PIN, OTP, CVV, or card secret. Before remote deployment, add TOTP or passkeys, encrypted automated backups with a tested restore, an HTTPS reverse proxy, and session/device revocation. Prefer Tailscale access. Do not expose this MVP directly to the public internet.

The current production dependency audit reports four moderate advisories inherited through Next.js/PostCSS and ExcelJS/UUID. Neither vulnerable operation is exposed by this app (it does not stringify user-supplied CSS or call name-based UUID APIs with buffers), and no high or critical advisory is present. Recheck and upgrade as soon as patched direct releases are available.

## Import behaviour

1. The API rejects an already-seen file hash before decrypting or parsing anything.
2. The API reads the file once in memory, verifies the selected bank layout, and reconciles bank totals.
3. Rows are written only to `StagedTransaction` records.
4. The review screen shows value/post dates, suggestions, confidence, and duplicates.
5. You can uncheck rows or change a category.
6. Approval writes included, non-duplicate rows inside one database transaction.
7. Equal-and-opposite movements in another owned account within three days are linked as transfers and excluded from income/spending totals.

The original statement is not retained. A repeated byte-identical file is rejected, and repeated transaction fingerprints are excluded by default.

## Next milestones

1. Category rules UI and learning from corrections
2. TOTP/passkeys, refresh-session rotation, and session management
3. Import column-mapping UI for unusual bank exports
4. Recurring bills, statement cycles, payments, and card outstanding reconciliation
5. Encrypted backups and restore verification
6. Holdings, price snapshots, asset allocation, and XIRR
7. BullMQ workers for email ingestion and other long-running import jobs

## Validation

Run the production compiler for both applications:

```sh
npm run build
```
