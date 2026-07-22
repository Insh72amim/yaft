CREATE TABLE "AccountDocument" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountDocument_storageKey_key" ON "AccountDocument"("storageKey");
CREATE INDEX "AccountDocument_accountId_createdAt_idx" ON "AccountDocument"("accountId", "createdAt");

ALTER TABLE "AccountDocument"
  ADD CONSTRAINT "AccountDocument_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
