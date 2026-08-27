"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';
async function main() {
    console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be made\n' : '🔧 LIVE RUN — duplicates will be deleted\n');
    const allTxs = await prisma.transaction.findMany({
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
    const byAccount = new Map();
    for (const tx of allTxs) {
        const list = byAccount.get(tx.accountId) || [];
        list.push(tx);
        byAccount.set(tx.accountId, list);
    }
    const duplicatePairs = [];
    for (const [_accountId, txs] of byAccount) {
        for (let i = 0; i < txs.length; i++) {
            for (let j = i + 1; j < txs.length; j++) {
                const a = txs[i];
                const b = txs[j];
                if (a.amount !== b.amount)
                    continue;
                const diffMs = Math.abs(a.transactionDate.getTime() - b.transactionDate.getTime());
                if (diffMs > 1.5 * 86_400_000)
                    continue;
                if (a.fingerprint === b.fingerprint)
                    continue;
                const aIsEmail = !!a.emailMessageId;
                const bIsEmail = !!b.emailMessageId;
                const aIsImport = !!a.importBatchId;
                const bIsImport = !!b.importBatchId;
                if ((aIsEmail && bIsImport) || (bIsEmail && aIsImport)) {
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
            const keepTagIds = new Set(keep.tags.map(t => t.tagId));
            const missingTags = remove.tags.filter(t => !keepTagIds.has(t.tagId));
            for (const tag of missingTags) {
                await prisma.transactionTag.create({
                    data: { transactionId: keep.id, tagId: tag.tagId },
                }).catch(() => { });
            }
            if (!keep.transferGroupId && remove.transferGroupId) {
                await prisma.transaction.update({
                    where: { id: keep.id },
                    data: { transferGroupId: remove.transferGroupId },
                });
            }
            if (!keep.categoryId && remove.categoryId) {
                await prisma.transaction.update({
                    where: { id: keep.id },
                    data: { categoryId: remove.categoryId },
                });
            }
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
//# sourceMappingURL=cleanup-duplicates.js.map