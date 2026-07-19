# YAFT Feature Registry

This file maintains the running inventory of completed, verified features inside Yet Another Finance Tracker (YAFT).

---

## 1. Core Accounts & Ledger System
* **Consolidated Accounts Overview**: Single master-detail view grouping accounts by category (Savings, Investments, Debt Accounts).
* **Multiple Account Types**: Support for Bank/Savings accounts, Credit Cards, Loans, Stocks, EPFO, Fixed Deposits, and Cash.
* **Auto-Recalculating Ledger**: Automatically computes real-time current balances, outstanding loan principals, monthly incoming/outgoing flows, and credit limits.
* **Double-Confirmation Deletion**: Protects data by requiring the user to type the exact account name to delete.
* **Clear Ledger Option**: Clicking the trash icon provides a choice to either delete the account or **clear all transactions** (wipes transaction/import history, resets opening balance to zero, but preserves credentials and settings).
* **Enhanced Transactions List**: Clean visual layout displaying dates, exact transaction times, category pill tags, hover animations, and color-coded transaction amounts (+/-).

---

## 2. Bank & Credit Card Statement Parsers
* **Reconciled Bank Statement Parsers**: Reconciled PDF statement parsing and review workflows for Axis Bank, State Bank of India (SBI), and Punjab National Bank (PNB).
* **Credit Card Statement Parsers**: Support for Axis Bank credit card statement PDF parsing.
* **Predicted Closing Balance**: Displays predicted closing balances in the import review UI before committing.
* **Auto-Opening Balance**: Automatically calculates the account's starting opening balance on the fly from imported bank statements.

---

## 3. Salary Payslip Workflows & Timelines
* **Employer-Aware Payslip Parsing**: Reconciled parsing of payslip details (e.g. Goldman Sachs salary slips).
* **PDF Password Decryption**: Support for unlocking password-protected payslips during parsing.
* **Sequential Bulk Upload**: Allows selecting and uploading multiple payslip PDFs simultaneously in a loop with visual progress updates.
* **Automatic Overwriting**: Automatically discards and replaces old duplicate records (by file hash or employer/month combination) upon re-uploading.
* **Interactive Pay Timeline**: Consolidated charts showing Monthly Pay Breakdown (Gross, Net, Tax) and Cumulative Growth with interactive legends.
* **Chronological Pay Feed**: Vertical timeline feed displaying month-by-month breakdowns of Gross Earnings, Net Pay, and Taxes Paid side-by-side.

---

## 4. Local S3 (MinIO) File Storage
* **Local S3 Integration**: Automatically uploads original statement and salary PDFs to a local MinIO S3 server instance for safe retention.
* **PDF File Downloader**: Secure file download endpoints to retrieve statements or salary slips from local S3 storage.

---

## 5. Loan EMI Schedule & Amortization
* **Amortization engine**: Creates complete EMI schedules tracking monthly EMI amounts, principal/interest splits, and running outstanding balances.
* **Interactive EMI Confirmation**: Allows manual checkmark confirmation of past EMIs.

---

## 6. EPFO & Investment Portfolios
* **EPFO Onboarding**: Monthly transaction row extraction and review staging for EPFO member passbooks.
* **Broker Holdings Parser**: Reconciled holdings snapshot imports (Zerodha Kite & Groww sheets) with immediate atomic replacement.
* **Sector tags & P&L Badges**: Colored indicators for unrealized gains/losses and sector categories.

---

## 7. Credential Vault & Security
* **On-Disk Credential Vault**: Stores bank statement PDF unlock passwords securely.
* **Credit Card OCR Scanner**: Allows scanning credit cards using client-side OCR image text extraction.

---

## 8. Developer Experience (DX) & Styling
* **Persistent Dark Theme**: Consistent dark palette overrides for all layouts, aside panels, tables, and dialogs.
* **Swagger/OpenAPI Documentation**: Automatically generated OpenAPI endpoint docs at `/api/docs`.
* **Isolated Agent Worktrees**: Standard working rules and boundary controls defined in `AGENTS.md`.

---

## 9. Upcoming Roadmap & TODOs

### 9.1 Overview Page
- [ ] **Internal Transfer Matching Engine**:
  - [ ] Compare internal transfers across bank statements to detect matching legs.
  - [ ] Support tracking and reconciliation of transfers to Mutual Funds.
- [ ] **Spend Analyser**:
  - [ ] Implement custom rules for spend analyser auto-categorization.
  - [ ] Extract and analyse external/outbound transfers specifically.

### 9.2 Import Page
- [ ] **Credit Card Parsers**:
  - [x] Axis Bank credit card parser.
  - [ ] ICICI Bank credit card parser.
  - [ ] SBI Bank credit card parser.

### 9.3 Accounts Page
- [x] **Credit Card Details Manager**:
  - [x] When a credit card account is selected, show option to update its details (e.g. billing date, limits, bank name).
- [x] **Credit Card Image Scanner**:
  - [x] Secure OCR card scanner integration inside Vault (client-side OCR scanning implemented).
- [x] **Manual EPFO Ledger entries**:
  - [x] Add manual transaction input form specifically for EPFO accounts (to log deposits/withdrawals and annual interest credits).

### 9.4 Salary Page
- [x] **Bonus and Miscellaneous Payments**:
  - [x] Option to add and update bonuses, variable payouts, or other non-standard payments on the timeline.
- [ ] **Acme Corp Layout Parser**:
  - [ ] Design and implement parser compatibility for Acme Corp-style payroll formats.
