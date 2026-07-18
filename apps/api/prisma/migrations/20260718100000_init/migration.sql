CREATE TYPE "AccountType" AS ENUM ('BANK', 'CREDIT_CARD', 'CASH', 'INVESTMENT', 'LOAN');
CREATE TYPE "ImportStatus" AS ENUM ('REVIEW', 'COMMITTED', 'CANCELLED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Account" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "type" "AccountType" NOT NULL,
  "institution" TEXT, "currency" TEXT NOT NULL DEFAULT 'INR', "openingBalance" BIGINT NOT NULL DEFAULT 0,
  "creditLimit" BIGINT, "statementDay" INTEGER, "dueDay" INTEGER, "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Category" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "color" TEXT NOT NULL DEFAULT '#64748b',
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "accountId" TEXT NOT NULL, "filename" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL, "status" "ImportStatus" NOT NULL DEFAULT 'REVIEW', "rowCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "committedAt" TIMESTAMP(3),
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StagedTransaction" (
  "id" TEXT NOT NULL, "batchId" TEXT NOT NULL, "rowNumber" INTEGER NOT NULL, "transactionDate" TIMESTAMP(3) NOT NULL,
  "descriptionRaw" TEXT NOT NULL, "merchant" TEXT, "amount" BIGINT NOT NULL, "reference" TEXT, "categoryId" TEXT,
  "fingerprint" TEXT NOT NULL, "isDuplicate" BOOLEAN NOT NULL DEFAULT false, "include" BOOLEAN NOT NULL DEFAULT true,
  "confidence" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "StagedTransaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL, "accountId" TEXT NOT NULL, "importBatchId" TEXT, "categoryId" TEXT,
  "transactionDate" TIMESTAMP(3) NOT NULL, "descriptionRaw" TEXT NOT NULL, "merchant" TEXT, "amount" BIGINT NOT NULL,
  "reference" TEXT, "fingerprint" TEXT NOT NULL, "transferGroupId" TEXT, "userVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");
CREATE INDEX "ImportBatch_userId_status_idx" ON "ImportBatch"("userId", "status");
CREATE INDEX "StagedTransaction_fingerprint_idx" ON "StagedTransaction"("fingerprint");
CREATE UNIQUE INDEX "StagedTransaction_batchId_rowNumber_key" ON "StagedTransaction"("batchId", "rowNumber");
CREATE INDEX "Transaction_accountId_transactionDate_idx" ON "Transaction"("accountId", "transactionDate");
CREATE INDEX "Transaction_fingerprint_idx" ON "Transaction"("fingerprint");
CREATE INDEX "Transaction_transferGroupId_idx" ON "Transaction"("transferGroupId");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StagedTransaction" ADD CONSTRAINT "StagedTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StagedTransaction" ADD CONSTRAINT "StagedTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
