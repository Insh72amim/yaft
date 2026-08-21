-- AlterTable
ALTER TABLE "StagedTransaction" ADD COLUMN "emailMessageId" TEXT,
ADD COLUMN "emailSubject" TEXT,
ADD COLUMN "emailSender" TEXT,
ADD COLUMN "emailDate" TIMESTAMP(3),
ADD COLUMN "emailSnippet" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "emailMessageId" TEXT,
ADD COLUMN "emailSubject" TEXT,
ADD COLUMN "emailSender" TEXT,
ADD COLUMN "emailDate" TIMESTAMP(3),
ADD COLUMN "emailSnippet" TEXT;
