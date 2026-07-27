import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../s3/s3.service';
import { decryptYaftBackup, encryptYaftBackup, YaftBackupPayload } from '../s3/s3-crypto';

function serializeBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return { __bigint: obj.toString() };
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInts);
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      res[key] = serializeBigInts(obj[key]);
    }
    return res;
  }
  return obj;
}

function deserializeBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'object' && obj.__bigint !== undefined) {
    return BigInt(obj.__bigint);
  }
  if (Array.isArray(obj)) return obj.map(deserializeBigInts);
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (['createdAt', 'updatedAt', 'transactionDate', 'postedDate', 'asOfDate', 'startDate', 'dueDate', 'committedAt', 'confirmedAt'].includes(key) && typeof obj[key] === 'string') {
        res[key] = new Date(obj[key]);
      } else {
        res[key] = deserializeBigInts(obj[key]);
      }
    }
    return res;
  }
  return obj;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  async exportBackup(userId: string, passphrase: string): Promise<Buffer> {
    if (!passphrase || passphrase.trim().length < 6) {
      throw new BadRequestException('Backup passphrase must be at least 6 characters long.');
    }

    const [
      accounts,
      categories,
      categoryRules,
      transactions,
      budgets,
      sips,
      loans,
      loanInstallments,
      importBatches,
      stagedTransactions,
      accountDocuments,
      accountVaultEntries,
    ] = await Promise.all([
      this.prisma.account.findMany({ where: { userId } }),
      this.prisma.category.findMany({ where: { userId } }),
      this.prisma.categoryRule.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({ where: { account: { userId } } }),
      this.prisma.categoryBudget.findMany({ where: { userId } }),
      this.prisma.activeSip.findMany({ where: { userId } }),
      this.prisma.loan.findMany({ where: { account: { userId } } }),
      this.prisma.loanInstallment.findMany({ where: { loan: { account: { userId } } } }),
      this.prisma.importBatch.findMany({ where: { userId } }),
      this.prisma.stagedTransaction.findMany({ where: { batch: { userId } } }),
      this.prisma.accountDocument.findMany({ where: { account: { userId } } }),
      this.prisma.accountVaultEntry.findMany({ where: { account: { userId } } }),
    ]);

    // Download & bundle attached document files from S3 / MinIO
    const files: YaftBackupPayload['files'] = [];
    for (const doc of accountDocuments) {
      try {
        const fileBuffer = await this.s3Service.downloadFile(doc.storageKey);
        files.push({
          s3Key: doc.storageKey,
          mimeType: doc.mimeType,
          originalName: doc.name,
          base64Data: fileBuffer.toString('base64'),
        });
      } catch (err: any) {
        this.logger.warn(`Could not download S3 file ${doc.storageKey} for backup: ${err.message}`);
      }
    }

    const payload: YaftBackupPayload = {
      metadata: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        userId,
        accountCount: accounts.length,
        transactionCount: transactions.length,
        fileCount: files.length,
      },
      database: serializeBigInts({
        accounts,
        categories,
        categoryRules,
        transactions,
        budgets,
        sips,
        loans,
        loanInstallments,
        importBatches,
        stagedTransactions,
        accountDocuments,
        accountVaultEntries,
      }),
      files,
    };

    return encryptYaftBackup(payload, passphrase.trim());
  }

  async restoreBackup(
    userId: string,
    passphrase: string,
    encryptedBuffer: Buffer,
  ): Promise<{
    accountsRestored: number;
    transactionsRestored: number;
    categoriesRestored: number;
    documentsRestored: number;
    filesRestored: number;
  }> {
    if (!passphrase || passphrase.trim().length === 0) {
      throw new BadRequestException('Passphrase is required to restore an encrypted backup.');
    }

    if (!encryptedBuffer || encryptedBuffer.length === 0) {
      throw new BadRequestException('No backup file buffer provided.');
    }

    let payload: YaftBackupPayload;
    try {
      payload = decryptYaftBackup(encryptedBuffer, passphrase.trim());
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Incorrect passphrase or corrupted archive file.');
    }

    const db = deserializeBigInts(payload.database);

    // Re-upload attachments to S3 / MinIO
    let filesRestored = 0;
    if (Array.isArray(payload.files)) {
      for (const file of payload.files) {
        try {
          const fileBuffer = Buffer.from(file.base64Data, 'base64');
          await this.s3Service.uploadFile(file.s3Key, fileBuffer, file.mimeType);
          filesRestored++;
        } catch (err: any) {
          this.logger.warn(`Failed to re-upload S3 file ${file.s3Key}: ${err.message}`);
        }
      }
    }

    // Execute atomic DB upserts / reconciliation for the user
    await this.prisma.$transaction(async (tx) => {
      // 1. Categories
      for (const cat of db.categories || []) {
        await tx.category.upsert({
          where: { id: cat.id },
          create: { ...cat, userId },
          update: { name: cat.name, color: cat.color, type: cat.type },
        });
      }

      // 2. Category Rules
      for (const rule of db.categoryRules || []) {
        await tx.categoryRule.upsert({
          where: { id: rule.id },
          create: { ...rule, userId },
          update: { pattern: rule.pattern, matchField: rule.matchField, matchType: rule.matchType, categoryId: rule.categoryId, priority: rule.priority },
        });
      }

      // 3. Accounts
      for (const acc of db.accounts || []) {
        await tx.account.upsert({
          where: { id: acc.id },
          create: { ...acc, userId },
          update: {
            name: acc.name,
            type: acc.type,
            institution: acc.institution,
            currency: acc.currency,
            openingBalance: acc.openingBalance,
            creditLimit: acc.creditLimit,
            statementDay: acc.statementDay,
            dueDay: acc.dueDay,
            archived: acc.archived,
          },
        });
      }

      // 4. Account Vault Entries
      for (const vault of db.accountVaultEntries || []) {
        await tx.accountVaultEntry.upsert({
          where: { accountId: vault.accountId },
          create: vault,
          update: { cardNetwork: vault.cardNetwork, last4: vault.last4, ifsc: vault.ifsc, upiId: vault.upiId, cardExpiryMm: vault.cardExpiryMm, cardExpiryYy: vault.cardExpiryYy },
        });
      }

      // 5. Import Batches & Staged Txns
      for (const batch of db.importBatches || []) {
        await tx.importBatch.upsert({
          where: { id: batch.id },
          create: { ...batch, userId },
          update: { status: batch.status, rowCount: batch.rowCount, statementBalance: batch.statementBalance },
        });
      }
      for (const staged of db.stagedTransactions || []) {
        await tx.stagedTransaction.upsert({
          where: { id: staged.id },
          create: staged,
          update: { include: staged.include, categoryId: staged.categoryId },
        });
      }

      // 6. Transactions
      for (const t of db.transactions || []) {
        await tx.transaction.upsert({
          where: { id: t.id },
          create: t,
          update: {
            transactionDate: t.transactionDate,
            postedDate: t.postedDate,
            descriptionRaw: t.descriptionRaw,
            merchant: t.merchant,
            amount: t.amount,
            reference: t.reference,
            categoryId: t.categoryId,
            transferGroupId: t.transferGroupId,
            userVerified: t.userVerified,
          },
        });
      }

      // 7. Category Budgets
      for (const b of db.budgets || []) {
        await tx.categoryBudget.upsert({
          where: { id: b.id },
          create: { ...b, userId },
          update: { monthlyLimit: b.monthlyLimit, month: b.month, year: b.year },
        });
      }

      // 8. SIPs
      for (const sip of db.sips || []) {
        await tx.activeSip.upsert({
          where: { id: sip.id },
          create: { ...sip, userId },
          update: { name: sip.name, amount: sip.amount, sipDay: sip.sipDay, billerKeyword: sip.billerKeyword },
        });
      }

      // 9. Loans & Installments
      for (const loan of db.loans || []) {
        await tx.loan.upsert({
          where: { id: loan.id },
          create: loan,
          update: { principal: loan.principal, interestRate: loan.interestRate, emiAmount: loan.emiAmount },
        });
      }
      for (const inst of db.loanInstallments || []) {
        await tx.loanInstallment.upsert({
          where: { id: inst.id },
          create: inst,
          update: { status: inst.status, confirmedAt: inst.confirmedAt },
        });
      }

      // 10. Account Documents
      for (const doc of db.accountDocuments || []) {
        await tx.accountDocument.upsert({
          where: { id: doc.id },
          create: doc,
          update: { name: doc.name, mimeType: doc.mimeType, byteSize: doc.byteSize },
        });
      }
    });

    return {
      accountsRestored: db.accounts?.length || 0,
      transactionsRestored: db.transactions?.length || 0,
      categoriesRestored: db.categories?.length || 0,
      documentsRestored: db.accountDocuments?.length || 0,
      filesRestored,
    };
  }
}
