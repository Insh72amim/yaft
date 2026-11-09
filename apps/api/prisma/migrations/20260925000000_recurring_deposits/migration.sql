-- CreateTable
CREATE TABLE "RecurringDeposit" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "monthlyAmount" BIGINT NOT NULL,
    "interestRate" DECIMAL(65,30) NOT NULL,
    "depositDay" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "maturityAmount" BIGINT,
    "autoIncrease" BOOLEAN NOT NULL DEFAULT true,
    "sourceAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringDepositInstallment" (
    "id" TEXT NOT NULL,
    "recurringDepositId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "accumulatedBalance" BIGINT NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'FUTURE',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringDepositInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringDeposit_accountId_idx" ON "RecurringDeposit"("accountId");

-- CreateIndex
CREATE INDEX "RecurringDepositInstallment_recurringDepositId_dueDate_idx" ON "RecurringDepositInstallment"("recurringDepositId", "dueDate");

-- AddForeignKey
ALTER TABLE "RecurringDeposit" ADD CONSTRAINT "RecurringDeposit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringDepositInstallment" ADD CONSTRAINT "RecurringDepositInstallment_recurringDepositId_fkey" FOREIGN KEY ("recurringDepositId") REFERENCES "RecurringDeposit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
