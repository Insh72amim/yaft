# Contributing to YAFT

Thank you for your interest in contributing to Yet Another Finance Tracker (YAFT)!

YAFT is a self-hosted, privacy-first personal finance platform designed to run locally on hardware you control.

---

## 🔒 Privacy & Financial Data Invariant (Strict)

YAFT processes sensitive financial records. Every contributor must observe these non-negotiable rules:

1. **Zero Real Data**: Never commit real bank statements, credit card bills, payslips, transaction amounts, account numbers, IFSCs, PANs, passwords, or personal names.
2. **Synthetic Fixtures**: All unit, integration, and parser test fixtures must use synthetic, anonymized data (e.g. `HDFC0000000`, `999999999999`, `TEST MERCHANT`).
3. **Fail-Closed Parsers**: Bank statement parsers must reject ambiguous or unvalidated statement formats rather than guessing amounts or transactions.

---

## 💻 Local Development Setup

### Prerequisites

- **Node.js**: `>= 20.11`
- **Docker & Docker Compose**: For PostgreSQL and MinIO S3
- **npm**: `>= 10`

### Step-by-Step

```sh
# 1. Clone the repository
git clone https://github.com/Insh72amim/yaft.git
cd yaft

# 2. Copy environment configuration
cp .env.example .env

# 3. Start local database & storage dependencies
docker compose up -d postgres minio

# 4. Install dependencies
npm install

# 5. Generate Prisma client & apply database migrations
npm run db:generate
npm run db:migrate

# 6. Start the development servers (NestJS API + Next.js Web)
npm run dev
```

- Web App: `http://localhost:3000`
- API Server: `http://localhost:4000/api`
- Swagger API Docs: `http://localhost:4000/api/docs`
- MinIO Storage Console: `http://localhost:9001`

---

## 🧪 Testing & Quality Standards

Before opening a pull request, ensure all tests, lint checks, and builds pass:

```sh
# Run unit and integration tests
npm test

# Run linter
npm run lint

# Run production build
npm run build
```

---

## 🔀 Pull Request Process

1. Fork the repository and create a branch from `main` (e.g., `feature/my-enhancement` or `fix/sbi-parser-date`).
2. Implement your changes along with synthetic unit tests for any new parsers or features.
3. Verify that `npm test`, `npm run lint`, and `npm run build` pass cleanly.
4. Verify `git status` to ensure no temporary PDFs, logs, or uncommitted files are included.
5. Open a Pull Request against the `main` branch filling out the PR checklist.
