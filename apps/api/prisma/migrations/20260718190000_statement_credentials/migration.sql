ALTER TABLE "StagedTransaction" ADD COLUMN "postedDate" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "postedDate" TIMESTAMP(3);

CREATE TABLE "StatementCredential" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StatementCredential_accountId_key" ON "StatementCredential"("accountId");

ALTER TABLE "StatementCredential" ADD CONSTRAINT "StatementCredential_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
