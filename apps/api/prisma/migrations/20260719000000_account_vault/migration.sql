-- CreateTable
CREATE TABLE "AccountVaultEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountNumberCipher" BYTEA,
    "accountNumberIv" BYTEA,
    "accountNumberTag" BYTEA,
    "cardNumberCipher" BYTEA,
    "cardNumberIv" BYTEA,
    "cardNumberTag" BYTEA,
    "cvvCipher" BYTEA,
    "cvvIv" BYTEA,
    "cvvTag" BYTEA,
    "last4" TEXT,
    "ifsc" TEXT,
    "upiId" TEXT,
    "cardExpiryMm" INTEGER,
    "cardExpiryYy" INTEGER,
    "cardNetwork" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountVaultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountVaultEntry_accountId_key" ON "AccountVaultEntry"("accountId");

-- AddForeignKey
ALTER TABLE "AccountVaultEntry" ADD CONSTRAINT "AccountVaultEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
