CREATE TYPE "SalaryStatus" AS ENUM ('REVIEW', 'COMMITTED');
CREATE TYPE "SalaryItemType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION');

CREATE TABLE "SalaryStatement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "payPeriod" TIMESTAMP(3) NOT NULL,
  "employer" TEXT NOT NULL,
  "employeeName" TEXT,
  "employeeNumberLast4" TEXT,
  "department" TEXT,
  "designation" TEXT,
  "bankName" TEXT,
  "bankAccountLast4" TEXT,
  "uanLast4" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "grossEarnings" BIGINT NOT NULL,
  "grossDeductions" BIGINT NOT NULL,
  "directPayment" BIGINT NOT NULL DEFAULT 0,
  "netPay" BIGINT NOT NULL,
  "filename" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "status" "SalaryStatus" NOT NULL DEFAULT 'REVIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt" TIMESTAMP(3),
  CONSTRAINT "SalaryStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalaryLineItem" (
  "id" TEXT NOT NULL,
  "statementId" TEXT NOT NULL,
  "type" "SalaryItemType" NOT NULL,
  "description" TEXT NOT NULL,
  "currentAmount" BIGINT NOT NULL,
  "ytdAmount" BIGINT,
  CONSTRAINT "SalaryLineItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalaryStatement_userId_fileHash_key" ON "SalaryStatement"("userId", "fileHash");
CREATE UNIQUE INDEX "SalaryStatement_userId_employer_payPeriod_key" ON "SalaryStatement"("userId", "employer", "payPeriod");
CREATE INDEX "SalaryStatement_userId_status_payPeriod_idx" ON "SalaryStatement"("userId", "status", "payPeriod");
CREATE INDEX "SalaryLineItem_statementId_type_idx" ON "SalaryLineItem"("statementId", "type");

ALTER TABLE "SalaryStatement" ADD CONSTRAINT "SalaryStatement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryLineItem" ADD CONSTRAINT "SalaryLineItem_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "SalaryStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
