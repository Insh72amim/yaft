CREATE UNIQUE INDEX "ImportBatch_accountId_fileHash_key" ON "ImportBatch"("accountId", "fileHash");
CREATE UNIQUE INDEX "Transaction_accountId_fingerprint_key" ON "Transaction"("accountId", "fingerprint");
