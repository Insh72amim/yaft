import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../s3/s3.service';
import { decryptYaftBackup, encryptYaftBackup, YaftBackupPayload } from '../s3/s3-crypto';

function serializeBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return { __bigint: obj.toString() };
  if (Buffer.isBuffer(obj)) return { __buffer: obj.toString('base64') };
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
  if (typeof obj === 'object' && obj.__buffer !== undefined) {
    return Buffer.from(obj.__buffer, 'base64');
  }
  if (Array.isArray(obj)) return obj.map(deserializeBigInts);
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (
        [
          'createdAt',
          'updatedAt',
          'transactionDate',
          'postedDate',
          'asOfDate',
          'startDate',
          'dueDate',
          'committedAt',
          'confirmedAt',
          'payPeriod',
          'endDate',
          'assignedAt',
          'lastSyncAt',
        ].includes(key) &&
        typeof obj[key] === 'string'
      ) {
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
      organizations,
      accounts,
      statementCredentials,
      accountVaultEntries,
      categories,
      categoryRules,
      transactions,
      budgets,
      sips,
      loans,
      loanInstallments,
      assets,
      portfolioHoldings,
      importBatches,
      stagedTransactions,
      accountDocuments,
      salaryStatements,
      salaryLineItems,
      tags,
      transactionTags,
      googleEmailConfigs,
      emailSyncLogs,
    ] = await Promise.all([
      this.prisma.organization.findMany({ where: { userId } }),
      this.prisma.account.findMany({ where: { userId } }),
      this.prisma.statementCredential.findMany({ where: { account: { userId } } }),
      this.prisma.accountVaultEntry.findMany({ where: { account: { userId } } }),
      this.prisma.category.findMany({ where: { userId } }),
      this.prisma.categoryRule.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({ where: { account: { userId } } }),
      this.prisma.categoryBudget.findMany({ where: { userId } }),
      this.prisma.activeSip.findMany({ where: { userId } }),
      this.prisma.loan.findMany({ where: { account: { userId } } }),
      this.prisma.loanInstallment.findMany({ where: { loan: { account: { userId } } } }),
      this.prisma.asset.findMany({ where: { holdings: { some: { account: { userId } } } } }),
      this.prisma.portfolioHolding.findMany({ where: { account: { userId } } }),
      this.prisma.importBatch.findMany({ where: { userId } }),
      this.prisma.stagedTransaction.findMany({ where: { batch: { userId } } }),
      this.prisma.accountDocument.findMany({ where: { account: { userId } } }),
      this.prisma.salaryStatement.findMany({ where: { userId } }),
      this.prisma.salaryLineItem.findMany({ where: { statement: { userId } } }),
      this.prisma.tag.findMany({ where: { userId } }),
      this.prisma.transactionTag.findMany({ where: { transaction: { account: { userId } } } }),
      this.prisma.googleEmailConfig.findMany({ where: { userId } }),
      this.prisma.emailSyncLog.findMany({ where: { userId } }),
    ]);

    // Download & bundle attached document files from S3 / MinIO (Account Documents and Salary Payslips)
    const files: YaftBackupPayload['files'] = [];

    // 1. Account Documents
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

    // 2. Salary Payslips
    for (const stmt of salaryStatements) {
      const key = `salaries/${userId}/${stmt.id}.pdf`;
      try {
        const fileBuffer = await this.s3Service.downloadFile(key);
        files.push({
          s3Key: key,
          mimeType: 'application/pdf',
          originalName: stmt.filename || `${stmt.employer}_${stmt.id}.pdf`,
          base64Data: fileBuffer.toString('base64'),
        });
      } catch (err: any) {
        this.logger.warn(`Could not download S3 salary PDF ${key} for backup: ${err.message}`);
      }
    }

    const payload: YaftBackupPayload = {
      metadata: {
        version: '1.2',
        exportedAt: new Date().toISOString(),
        userId,
        accountCount: accounts.length,
        transactionCount: transactions.length,
        fileCount: files.length,
        salaryCount: salaryStatements.length,
        organizationCount: organizations.length,
        holdingCount: portfolioHoldings.length,
      },
      database: serializeBigInts({
        organizations,
        accounts,
        statementCredentials,
        accountVaultEntries,
        categories,
        categoryRules,
        transactions,
        budgets,
        sips,
        loans,
        loanInstallments,
        assets,
        portfolioHoldings,
        importBatches,
        stagedTransactions,
        accountDocuments,
        salaryStatements,
        salaryLineItems,
        tags,
        transactionTags,
        googleEmailConfigs,
        emailSyncLogs,
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
    salariesRestored: number;
    organizationsRestored: number;
    holdingsRestored: number;
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
    const originalUserId = payload.metadata?.userId;

    // Re-upload attachments to S3 / MinIO
    let filesRestored = 0;
    if (Array.isArray(payload.files)) {
      for (const file of payload.files) {
        try {
          const fileBuffer = Buffer.from(file.base64Data, 'base64');
          await this.s3Service.uploadFile(file.s3Key, fileBuffer, file.mimeType);

          // If restoring to a new user account, ensure the salary file is also placed under the new userId path
          if (originalUserId && originalUserId !== userId && file.s3Key.startsWith(`salaries/${originalUserId}/`)) {
            const remappedKey = file.s3Key.replace(`salaries/${originalUserId}/`, `salaries/${userId}/`);
            await this.s3Service.uploadFile(remappedKey, fileBuffer, file.mimeType);
          }

          filesRestored++;
        } catch (err: any) {
          this.logger.warn(`Failed to re-upload S3 file ${file.s3Key}: ${err.message}`);
        }
      }
    }

    // Execute atomic DB upserts / reconciliation for the user
    await this.prisma.$transaction(async (tx) => {
      // 1. Organizations
      for (const org of db.organizations || []) {
        await tx.organization.upsert({
          where: { userId_name: { userId, name: org.name } },
          create: { ...org, userId },
          update: {
            code: org.code,
            taxId: org.taxId,
            currency: org.currency,
            color: org.color,
            parsingConfig: org.parsingConfig,
            sampleFilename: org.sampleFilename,
            isCurrent: org.isCurrent,
          },
        });
      }

      // 2. Categories
      for (const cat of db.categories || []) {
        await tx.category.upsert({
          where: { id: cat.id },
          create: { ...cat, userId },
          update: { name: cat.name, color: cat.color, type: cat.type },
        });
      }

      // 3. Category Rules
      for (const rule of db.categoryRules || []) {
        await tx.categoryRule.upsert({
          where: { id: rule.id },
          create: { ...rule, userId },
          update: {
            pattern: rule.pattern,
            matchField: rule.matchField,
            matchType: rule.matchType,
            categoryId: rule.categoryId,
            priority: rule.priority,
          },
        });
      }

      // 4. Accounts
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
            parentAccountId: acc.parentAccountId,
          },
        });
      }

      // 5. Account Vault Entries
      for (const vault of db.accountVaultEntries || []) {
        await tx.accountVaultEntry.upsert({
          where: { accountId: vault.accountId },
          create: vault,
          update: {
            accountNumberCipher: vault.accountNumberCipher,
            accountNumberIv: vault.accountNumberIv,
            accountNumberTag: vault.accountNumberTag,
            cardNumberCipher: vault.cardNumberCipher,
            cardNumberIv: vault.cardNumberIv,
            cardNumberTag: vault.cardNumberTag,
            cvvCipher: vault.cvvCipher,
            cvvIv: vault.cvvIv,
            cvvTag: vault.cvvTag,
            cardNetwork: vault.cardNetwork,
            last4: vault.last4,
            ifsc: vault.ifsc,
            upiId: vault.upiId,
            cardExpiryMm: vault.cardExpiryMm,
            cardExpiryYy: vault.cardExpiryYy,
            keyVersion: vault.keyVersion,
          },
        });
      }

      // 6. Statement Credentials
      for (const cred of db.statementCredentials || []) {
        await tx.statementCredential.upsert({
          where: { accountId: cred.accountId },
          create: cred,
          update: {
            ciphertext: cred.ciphertext,
            iv: cred.iv,
            authTag: cred.authTag,
            keyVersion: cred.keyVersion,
          },
        });
      }

      // 7. Assets & Portfolio Holdings
      for (const asset of db.assets || []) {
        await tx.asset.upsert({
          where: { symbol: asset.symbol },
          create: {
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            type: asset.type,
            isin: asset.isin,
            sector: asset.sector,
          },
          update: {
            name: asset.name,
            type: asset.type,
            isin: asset.isin,
            sector: asset.sector,
          },
        });
      }
      for (const holding of db.portfolioHoldings || []) {
        await tx.portfolioHolding.upsert({
          where: { accountId_assetId: { accountId: holding.accountId, assetId: holding.assetId } },
          create: holding,
          update: {
            quantity: holding.quantity,
            availableQuantity: holding.availableQuantity,
            discrepantQuantity: holding.discrepantQuantity,
            longTermQuantity: holding.longTermQuantity,
            pledgedQuantity: holding.pledgedQuantity,
            averagePrice: holding.averagePrice,
            previousClosingPrice: holding.previousClosingPrice,
            currentValue: holding.currentValue,
            unrealizedPnl: holding.unrealizedPnl,
            asOfDate: holding.asOfDate,
          },
        });
      }

      // 8. Salary Statements & Line Items
      for (const stmt of db.salaryStatements || []) {
        await tx.salaryStatement.upsert({
          where: { id: stmt.id },
          create: {
            id: stmt.id,
            userId,
            payPeriod: stmt.payPeriod,
            employer: stmt.employer,
            employeeName: stmt.employeeName,
            employeeNumberLast4: stmt.employeeNumberLast4,
            department: stmt.department,
            designation: stmt.designation,
            bankName: stmt.bankName,
            bankAccountLast4: stmt.bankAccountLast4,
            uanLast4: stmt.uanLast4,
            currency: stmt.currency,
            grossEarnings: stmt.grossEarnings,
            grossDeductions: stmt.grossDeductions,
            directPayment: stmt.directPayment,
            netPay: stmt.netPay,
            filename: stmt.filename,
            fileHash: stmt.fileHash,
            status: stmt.status,
            createdAt: stmt.createdAt,
            committedAt: stmt.committedAt,
            pdfPasswordCipher: stmt.pdfPasswordCipher,
            pdfPasswordIv: stmt.pdfPasswordIv,
            pdfPasswordTag: stmt.pdfPasswordTag,
            pdfPasswordKeyVersion: stmt.pdfPasswordKeyVersion,
            organizationId: stmt.organizationId,
          },
          update: {
            payPeriod: stmt.payPeriod,
            employer: stmt.employer,
            grossEarnings: stmt.grossEarnings,
            grossDeductions: stmt.grossDeductions,
            directPayment: stmt.directPayment,
            netPay: stmt.netPay,
            status: stmt.status,
            committedAt: stmt.committedAt,
            organizationId: stmt.organizationId,
          },
        });
      }
      for (const item of db.salaryLineItems || []) {
        await tx.salaryLineItem.upsert({
          where: { id: item.id },
          create: item,
          update: {
            type: item.type,
            description: item.description,
            currentAmount: item.currentAmount,
            ytdAmount: item.ytdAmount,
          },
        });
      }

      // 9. Import Batches & Staged Txns
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

      // 10. Transactions
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

      // 11. Tags & TransactionTags
      for (const tag of db.tags || []) {
        await tx.tag.upsert({
          where: { id: tag.id },
          create: { ...tag, userId },
          update: { name: tag.name, color: tag.color, description: tag.description, budgetLimit: tag.budgetLimit },
        });
      }
      for (const tTag of db.transactionTags || []) {
        await tx.transactionTag.upsert({
          where: { transactionId_tagId: { transactionId: tTag.transactionId, tagId: tTag.tagId } },
          create: tTag,
          update: { assignedAt: tTag.assignedAt },
        });
      }

      // 12. Category Budgets
      for (const b of db.budgets || []) {
        await tx.categoryBudget.upsert({
          where: { id: b.id },
          create: { ...b, userId },
          update: { monthlyLimit: b.monthlyLimit, month: b.month, year: b.year },
        });
      }

      // 13. SIPs
      for (const sip of db.sips || []) {
        await tx.activeSip.upsert({
          where: { id: sip.id },
          create: { ...sip, userId },
          update: { name: sip.name, amount: sip.amount, sipDay: sip.sipDay, billerKeyword: sip.billerKeyword },
        });
      }

      // 14. Loans & Installments
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

      // 15. Account Documents
      for (const doc of db.accountDocuments || []) {
        await tx.accountDocument.upsert({
          where: { id: doc.id },
          create: doc,
          update: { name: doc.name, mimeType: doc.mimeType, byteSize: doc.byteSize },
        });
      }

      // 16. Google Email Configs & Sync Logs
      for (const cfg of db.googleEmailConfigs || []) {
        await tx.googleEmailConfig.upsert({
          where: { userId_email: { userId, email: cfg.email } },
          create: { ...cfg, userId },
          update: {
            refreshCipher: cfg.refreshCipher,
            refreshIv: cfg.refreshIv,
            refreshTag: cfg.refreshTag,
            syncStatus: cfg.syncStatus,
            lastSyncAt: cfg.lastSyncAt,
          },
        });
      }
      for (const log of db.emailSyncLogs || []) {
        await tx.emailSyncLog.upsert({
          where: { id: log.id },
          create: { ...log, userId },
          update: {
            status: log.status,
            emailsScanned: log.emailsScanned,
            alertsParsed: log.alertsParsed,
            transactionsAdded: log.transactionsAdded,
          },
        });
      }
    });

    return {
      accountsRestored: db.accounts?.length || 0,
      transactionsRestored: db.transactions?.length || 0,
      categoriesRestored: db.categories?.length || 0,
      documentsRestored: db.accountDocuments?.length || 0,
      salariesRestored: db.salaryStatements?.length || 0,
      organizationsRestored: db.organizations?.length || 0,
      holdingsRestored: db.portfolioHoldings?.length || 0,
      filesRestored,
    };
  }
}
