/**
 * One-time cleanup: Find and remove cross-source duplicate transactions.
 *
 * A "cross-source duplicate" = two transactions on the SAME account,
 * on the SAME calendar day (±1 day), with the SAME amount,
 * where one has emailMessageId (from email alert) and the other has
 * importBatchId (from bank statement import).
 *
 * Strategy: Keep the bank-statement version (more detailed description),
 * delete the email-ingested duplicate, merging any tags from the deleted row.
 *
 * Usage:
 *   DRY_RUN=1 npx ts-node -r tsconfig-paths/register scripts/cleanup-duplicates.ts
 *   npx ts-node -r tsconfig-paths/register scripts/cleanup-duplicates.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';

interface TxRow {
  id: string;
  accountId: string;
  transactionDate: Date;
  amount: bigint;
  descriptionRaw: string;
  merchant: string | null;
  reference: string | null;
  fingerprint: string;
  emailMessageId: string | null;
  importBatchId: string | null;
  transferGroupId: string | null;
  categoryId: string | null;
  tags: Array<{ tagId: string }>;
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be made\n' : '🔧 LIVE RUN — duplicates will be deleted\n');

  const allTxs: TxRow[] = await prisma.transaction.findMany({
    select: {
      id: true,
      accountId: true,
      transactionDate: true,
      amount: true,
      descriptionRaw: true,
      merchant: true,
      reference: true,
      fingerprint: true,
      emailMessageId: true,
      importBatchId: true,
      transferGroupId: true,
      categoryId: true,
      tags: { select: { tagId: true } },
    },
    orderBy: [{ accountId: 'asc' }, { transactionDate: 'asc' }],
  });

  console.log(`Total transactions: ${allTxs.length}\n`);

  // Group by accountId
  const byAccount = new Map<string, TxRow[]>();
  for (const tx of allTxs) {
    const list = byAccount.get(tx.accountId) || [];
    list.push(tx);
    byAccount.set(tx.accountId, list);
  }

  const duplicatePairs: Array<{ keep: TxRow; remove: TxRow }> = [];

  for (const [_accountId, txs] of byAccount) {
    for (let i = 0; i < txs.length; i++) {
      for (let j = i + 1; j < txs.length; j++) {
        const a = txs[i];
        const b = txs[j];

        // Same amount (exact match including sign)
        if (a.amount !== b.amount) continue;

        // Within 1 calendar day
        const diffMs = Math.abs(a.transactionDate.getTime() - b.transactionDate.getTime());
        if (diffMs > 1.5 * 86_400_000) continue;

        // Different fingerprints
        if (a.fingerprint === b.fingerprint) continue;

        // Cross-source: one from email, one from import
        const aIsEmail = !!a.emailMessageId;
        const bIsEmail = !!b.emailMessageId;
        const aIsImport = !!a.importBatchId;
        const bIsImport = !!b.importBatchId;

        if ((aIsEmail && bIsImport) || (bIsEmail && aIsImport)) {
          // Keep the import version (more detailed), remove the email version
          const keep = aIsImport ? a : b;
          const remove = aIsImport ? b : a;
          duplicatePairs.push({ keep, remove });
        }
      }
    }
  }

  console.log(`Found ${duplicatePairs.length} cross-source duplicate pair(s)\n`);

  for (const { keep, remove } of duplicatePairs) {
    const keepAmt = Number(keep.amount) / 100;
    const removeAmt = Number(remove.amount) / 100;
    console.log(`  KEEP   📄 ${keep.transactionDate.toISOString().slice(0, 10)} | ₹${keepAmt.toFixed(2)} | ${keep.merchant || keep.descriptionRaw.slice(0, 60)}`);
    console.log(`  DELETE 📧 ${remove.transactionDate.toISOString().slice(0, 10)} | ₹${removeAmt.toFixed(2)} | ${remove.merchant || remove.descriptionRaw.slice(0, 60)}`);
    console.log('');

    if (!DRY_RUN) {
      // Merge tags from removed tx to kept tx
      const keepTagIds = new Set(keep.tags.map(t => t.tagId));
      const missingTags = remove.tags.filter(t => !keepTagIds.has(t.tagId));
      for (const tag of missingTags) {
        await prisma.transactionTag.create({
          data: { transactionId: keep.id, tagId: tag.tagId },
        }).catch(() => { /* already exists */ });
      }

      // Merge transferGroupId if kept tx doesn't have one
      if (!keep.transferGroupId && remove.transferGroupId) {
        await prisma.transaction.update({
          where: { id: keep.id },
          data: { transferGroupId: remove.transferGroupId },
        });
      }

      // Merge categoryId if kept tx doesn't have one
      if (!keep.categoryId && remove.categoryId) {
        await prisma.transaction.update({
          where: { id: keep.id },
          data: { categoryId: remove.categoryId },
        });
      }

      // Delete the duplicate
      await prisma.transaction.delete({ where: { id: remove.id } });
      console.log(`  ✅ Deleted ${remove.id}\n`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(DRY_RUN
    ? `Would delete ${duplicatePairs.length} duplicate(s). Re-run without DRY_RUN=1 to apply.`
    : `Deleted ${duplicatePairs.length} duplicate(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
