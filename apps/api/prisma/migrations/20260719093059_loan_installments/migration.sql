-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PAST_UNCONFIRMED', 'PAID', 'FUTURE');

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "principal" BIGINT NOT NULL,
    "interestRate" DECIMAL(65,30) NOT NULL,
    "emiAmount" BIGINT NOT NULL,
    "emiDay" INTEGER,
    "termMonths" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalAmount" BIGINT NOT NULL,
    "interestAmount" BIGINT NOT NULL,
    "emiAmount" BIGINT NOT NULL,
    "balance" BIGINT NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'FUTURE',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_accountId_idx" ON "Loan"("accountId");

-- CreateIndex
CREATE INDEX "LoanInstallment_loanId_dueDate_idx" ON "LoanInstallment"("loanId", "dueDate");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;