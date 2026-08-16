import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../s3/s3.service';
import { decryptYaftBackup, encryptYaftBackup, YaftBackupPayload } from '../s3/s3-crypto';

const BYTES_FIELDS = new Set([
  'accountNumberCipher',
  'accountNumberIv',
  'accountNumberTag',
  'cardNumberCipher',
  'cardNumberIv',
  'cardNumberTag',
  'cvvCipher',
  'cvvIv',
  'cvvTag',
  'ciphertext',
  'iv',
  'authTag',
  'pdfPasswordCipher',
  'pdfPasswordIv',
  'pdfPasswordTag',
  'refreshCipher',
  'refreshIv',
  'refreshTag',
  'autoPassphraseCipher',
  'autoPassphraseIv',
  'autoPassphraseTag',
]);

const DATE_FIELDS = new Set([
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
]);

const DECIMAL_FIELDS = new Set([
  'quantity',
  'availableQuantity',
  'discrepantQuantity',
  'longTermQuantity',
  'pledgedQuantity',
  'interestRate',
]);

function toBuffer(val: any): Buffer | null {
  if (val === null || val === undefined) return null;
  if (Buffer.isBuffer(val)) return val;
  if (val instanceof Uint8Array || ArrayBuffer.isView(val)) {
    const view = val as Uint8Array;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  }
  if (typeof val === 'object') {
    if (val.__buffer !== undefined) return Buffer.from(val.__buffer, 'base64');
    if (val.type === 'Buffer' && Array.isArray(val.data)) return Buffer.from(val.data);
    const keys = Object.keys(val);
    if (keys.length > 0 && keys.every((k) => !isNaN(Number(k)))) {
      const arr = new Uint8Array(keys.length);
      for (const k of keys) {
        arr[Number(k)] = val[k];
      }
      return Buffer.from(arr);
    }
  }
  if (typeof val === 'string') {
    return Buffer.from(val, 'base64');
  }
  return null;
}

function toDecimal(val: any): Prisma.Decimal | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Prisma.Decimal) return val;
  if (typeof val === 'object' && val.__decimal !== undefined) return new Prisma.Decimal(val.__decimal);
  if (typeof val === 'string' || typeof val === 'number') return new Prisma.Decimal(val);
  if (typeof val === 'object' && val.d && Array.isArray(val.d)) {
    try {
      const s = val.s === -1 ? '-' : '';
      const digits = val.d.join('');
      const exp = (val.e !== undefined ? val.e : digits.length - 1) - digits.length + 1;
      return new Prisma.Decimal(`${s}${digits}e${exp}`);
    } catch {
      return new Prisma.Decimal(0);
    }
  }
  return null;
}

function serializeBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return { __bigint: obj.toString() };
  if (Buffer.isBuffer(obj)) return { __buffer: obj.toString('base64') };
  if (obj instanceof Uint8Array || ArrayBuffer.isView(obj)) {
    const view = obj as Uint8Array;
    return { __buffer: Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('base64') };
  }
  if (obj instanceof Date) return obj.toISOString();
  if (obj && typeof obj === 'object' && (typeof obj.toFixed === 'function' || (obj as any).isDecimal || obj.constructor?.name === 'Decimal')) {
    return { __decimal: obj.toString() };
  }
  if (Array.isArray(obj)) return obj.map(serializeBigInts);
  if (typeof obj === 'object') {
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return { __buffer: Buffer.from(obj.data).toString('base64') };
    }
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
  if (typeof obj === 'object' && obj.__decimal !== undefined) {
    return new Prisma.Decimal(obj.__decimal);
  }
  if (Array.isArray(obj)) return obj.map(deserializeBigInts);
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (BYTES_FIELDS.has(key)) {
        res[key] = toBuffer(obj[key]);
      } else if (DECIMAL_FIELDS.has(key)) {
        res[key] = toDecimal(obj[key]);
      } else if (DATE_FIELDS.has(key) && typeof obj[key] === 'string') {
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
    const isDifferentUser = Boolean(originalUserId && originalUserId !== userId);

    // Maintain ID mapping when restoring into a different account on the same database
    const idMap = new Map<string, string>();
    const mapId = (oldId?: string | null): string => {
      if (!oldId) return '';
      if (!isDifferentUser) return oldId;
      if (!idMap.has(oldId)) {
        idMap.set(oldId, randomUUID());
      }
      return idMap.get(oldId)!;
    };

    // Re-upload attachments to S3 / MinIO
    let filesRestored = 0;
    if (Array.isArray(payload.files)) {
      for (const file of payload.files) {
        try {
          const fileBuffer = Buffer.from(file.base64Data, 'base64');
          let targetKey = file.s3Key;

          if (isDifferentUser) {
            if (file.s3Key.startsWith(`salaries/${originalUserId}/`)) {
              const oldStmtId = file.s3Key.replace(`salaries/${originalUserId}/`, '').replace('.pdf', '');
              const newStmtId = mapId(oldStmtId);
              targetKey = `salaries/${userId}/${newStmtId}.pdf`;
            } else if (file.s3Key.startsWith('account-documents/')) {
              const parts = file.s3Key.split('/');
              if (parts.length >= 4) {
                const oldAccId = parts[2];
                const oldDocIdWithExt = parts[3];
                const dotIdx = oldDocIdWithExt.lastIndexOf('.');
                const oldDocId = dotIdx !== -1 ? oldDocIdWithExt.substring(0, dotIdx) : oldDocIdWithExt;
                const ext = dotIdx !== -1 ? oldDocIdWithExt.substring(dotIdx) : '';
                targetKey = `account-documents/${userId}/${mapId(oldAccId)}/${mapId(oldDocId)}${ext}`;
              }
            }
          }

          await this.s3Service.uploadFile(targetKey, fileBuffer, file.mimeType);
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
        const targetId = mapId(org.id);
        const existing = await tx.organization.findUnique({ where: { userId_name: { userId, name: org.name } } });
        if (existing) {
          idMap.set(org.id, existing.id);
          await tx.organization.update({
            where: { id: existing.id },
            data: {
              code: org.code,
              taxId: org.taxId,
              currency: org.currency,
              color: org.color,
              parsingConfig: org.parsingConfig,
              sampleFilename: org.sampleFilename,
              isCurrent: org.isCurrent,
            },
          });
        } else {
          await tx.organization.create({
            data: {
              id: targetId,
              userId,
              name: org.name,
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
      }

      // 2. Categories
      for (const cat of db.categories || []) {
        const targetId = mapId(cat.id);
        const existing = await tx.category.findUnique({ where: { userId_name: { userId, name: cat.name } } });
        if (existing) {
          idMap.set(cat.id, existing.id);
          await tx.category.update({
            where: { id: existing.id },
            data: { color: cat.color, type: cat.type },
          });
        } else {
          await tx.category.create({
            data: {
              id: targetId,
              userId,
              name: cat.name,
              color: cat.color,
              type: cat.type,
            },
          });
        }
      }

      // 3. Category Rules
      for (const rule of db.categoryRules || []) {
        const targetId = mapId(rule.id);
        const mappedCatId = rule.categoryId ? mapId(rule.categoryId) : '';
        if (!mappedCatId) continue;
        await tx.categoryRule.upsert({
          where: { id: targetId },
          create: {
            id: targetId,
            userId,
            pattern: rule.pattern,
            matchField: rule.matchField,
            matchType: rule.matchType,
            categoryId: mappedCatId,
            priority: rule.priority,
          },
          update: {
            pattern: rule.pattern,
            matchField: rule.matchField,
            matchType: rule.matchType,
            categoryId: mappedCatId,
            priority: rule.priority,
          },
        });
      }

      // 4. Accounts
      for (const acc of db.accounts || []) {
        const targetId = mapId(acc.id);
        const parentId = acc.parentAccountId ? mapId(acc.parentAccountId) : null;
        const existingAcc = isDifferentUser
          ? await tx.account.findFirst({ where: { userId, name: acc.name, institution: acc.institution } })
          : null;

        if (existingAcc) {
          idMap.set(acc.id, existingAcc.id);
          await tx.account.update({
            where: { id: existingAcc.id },
            data: {
              type: acc.type,
              currency: acc.currency,
              openingBalance: acc.openingBalance,
              creditLimit: acc.creditLimit,
              statementDay: acc.statementDay,
              dueDay: acc.dueDay,
              archived: acc.archived,
              parentAccountId: parentId,
            },
          });
        } else {
          await tx.account.upsert({
            where: { id: targetId },
            create: {
              id: targetId,
              userId,
              name: acc.name,
              type: acc.type,
              institution: acc.institution,
              currency: acc.currency,
              openingBalance: acc.openingBalance,
              creditLimit: acc.creditLimit,
              statementDay: acc.statementDay,
              dueDay: acc.dueDay,
              archived: acc.archived,
              parentAccountId: parentId,
            },
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
              parentAccountId: parentId,
            },
          });
        }
      }

      // 5. Account Vault Entries
      for (const vault of db.accountVaultEntries || []) {
        const targetId = mapId(vault.id);
        const mappedAccId = mapId(vault.accountId);
        await tx.accountVaultEntry.upsert({
          where: { accountId: mappedAccId },
          create: {
            id: targetId,
            accountId: mappedAccId,
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
        const targetId = mapId(cred.id);
        const mappedAccId = mapId(cred.accountId);
        await tx.statementCredential.upsert({
          where: { accountId: mappedAccId },
          create: {
            id: targetId,
            accountId: mappedAccId,
            ciphertext: cred.ciphertext,
            iv: cred.iv,
            authTag: cred.authTag,
            keyVersion: cred.keyVersion,
          },
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
        const existing = await tx.asset.findUnique({ where: { symbol: asset.symbol } });
        if (existing) {
          idMap.set(asset.id, existing.id);
          await tx.asset.update({
            where: { id: existing.id },
            data: {
              name: asset.name,
              type: asset.type,
              isin: asset.isin,
              sector: asset.sector,
            },
          });
        } else {
          const targetAssetId = isDifferentUser ? randomUUID() : asset.id;
          idMap.set(asset.id, targetAssetId);
          await tx.asset.create({
            data: {
              id: targetAssetId,
              symbol: asset.symbol,
              name: asset.name,
              type: asset.type,
              isin: asset.isin,
              sector: asset.sector,
            },
          });
        }
      }
      for (const holding of db.portfolioHoldings || []) {
        const targetId = mapId(holding.id);
        const mappedAccId = mapId(holding.accountId);
        const mappedAssetId = mapId(holding.assetId);
        await tx.portfolioHolding.upsert({
          where: { accountId_assetId: { accountId: mappedAccId, assetId: mappedAssetId } },
          create: {
            id: targetId,
            accountId: mappedAccId,
            assetId: mappedAssetId,
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
        const targetId = mapId(stmt.id);
        const mappedOrgId = stmt.organizationId ? mapId(stmt.organizationId) : null;
        const existingStmt = isDifferentUser
          ? await tx.salaryStatement.findFirst({
              where: {
                userId,
                OR: [
                  { employer: stmt.employer, payPeriod: stmt.payPeriod },
                  { fileHash: stmt.fileHash },
                ],
              },
            })
          : null;

        if (existingStmt) {
          idMap.set(stmt.id, existingStmt.id);
          await tx.salaryStatement.update({
            where: { id: existingStmt.id },
            data: {
              employeeName: stmt.employeeName,
              employeeNumberLast4: stmt.employeeNumberLast4,
              department: stmt.department,
              designation: stmt.designation,
              bankName: stmt.bankName,
              bankAccountLast4: stmt.bankAccountLast4,
              uanLast4: stmt.uanLast4,
              grossEarnings: stmt.grossEarnings,
              grossDeductions: stmt.grossDeductions,
              directPayment: stmt.directPayment,
              netPay: stmt.netPay,
              status: stmt.status,
              committedAt: stmt.committedAt,
              organizationId: mappedOrgId,
            },
          });
        } else {
          await tx.salaryStatement.upsert({
            where: { id: targetId },
            create: {
              id: targetId,
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
              organizationId: mappedOrgId,
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
              organizationId: mappedOrgId,
            },
          });
        }
      }
      for (const item of db.salaryLineItems || []) {
        const targetId = mapId(item.id);
        const mappedStmtId = mapId(item.statementId);
        await tx.salaryLineItem.upsert({
          where: { id: targetId },
          create: {
            id: targetId,
            statementId: mappedStmtId,
            type: item.type,
            description: item.description,
            currentAmount: item.currentAmount,
            ytdAmount: item.ytdAmount,
          },
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
        const targetId = mapId(batch.id);
        const mappedAccId = mapId(batch.accountId);
        const existingBatch = isDifferentUser
          ? await tx.importBatch.findFirst({ where: { accountId: mappedAccId, fileHash: batch.fileHash } })
          : null;

        if (existingBatch) {
          idMap.set(batch.id, existingBatch.id);
          await tx.importBatch.update({
            where: { id: existingBatch.id },
            data: { status: batch.status, rowCount: batch.rowCount, statementBalance: batch.statementBalance },
          });
        } else {
          await tx.importBatch.upsert({
            where: { id: targetId },
            create: {
              id: targetId,
              userId,
              accountId: mappedAccId,
              filename: batch.filename,
              fileHash: batch.fileHash,
              status: batch.status,
              rowCount: batch.rowCount,
              statementBalance: batch.statementBalance,
              createdAt: batch.createdAt,
              committedAt: batch.committedAt,
            },
            update: { status: batch.status, rowCount: batch.rowCount, statementBalance: batch.statementBalance },
          });
        }
      }
      for (const staged of db.stagedTransactions || []) {
        const targetId = mapId(staged.id);
        const mappedBatchId = mapId(staged.batchId);
        const mappedCatId = staged.categoryId ? mapId(staged.categoryId) : null;
        await tx.stagedTransaction.upsert({
          where: { batchId_rowNumber: { batchId: mappedBatchId, rowNumber: staged.rowNumber } },
          create: {
            id: targetId,
            batchId: mappedBatchId,
            rowNumber: staged.rowNumber,
            transactionDate: staged.transactionDate,
            postedDate: staged.postedDate,
            descriptionRaw: staged.descriptionRaw,
            merchant: staged.merchant,
            amount: staged.amount,
            reference: staged.reference,
            categoryId: mappedCatId,
            fingerprint: staged.fingerprint,
            isDuplicate: staged.isDuplicate,
            include: staged.include,
            confidence: staged.confidence,
          },
          update: { include: staged.include, categoryId: mappedCatId },
        });
      }

      // 10. Transactions
      for (const t of db.transactions || []) {
        const targetId = mapId(t.id);
        const mappedAccId = mapId(t.accountId);
        const mappedCatId = t.categoryId ? mapId(t.categoryId) : null;
        const mappedBatchId = t.importBatchId ? mapId(t.importBatchId) : null;
        const mappedTransferGroupId = t.transferGroupId ? mapId(t.transferGroupId) : null;

        const existingTx = isDifferentUser && t.fingerprint
          ? await tx.transaction.findFirst({ where: { accountId: mappedAccId, fingerprint: t.fingerprint } })
          : null;

        if (existingTx) {
          idMap.set(t.id, existingTx.id);
          await tx.transaction.update({
            where: { id: existingTx.id },
            data: {
              transactionDate: t.transactionDate,
              postedDate: t.postedDate,
              descriptionRaw: t.descriptionRaw,
              merchant: t.merchant,
              amount: t.amount,
              reference: t.reference,
              categoryId: mappedCatId,
              transferGroupId: mappedTransferGroupId,
              userVerified: t.userVerified,
            },
          });
        } else {
          await tx.transaction.upsert({
            where: { id: targetId },
            create: {
              id: targetId,
              accountId: mappedAccId,
              importBatchId: mappedBatchId,
              transactionDate: t.transactionDate,
              postedDate: t.postedDate,
              descriptionRaw: t.descriptionRaw,
              merchant: t.merchant,
              amount: t.amount,
              reference: t.reference,
              fingerprint: t.fingerprint,
              categoryId: mappedCatId,
              transferGroupId: mappedTransferGroupId,
              userVerified: t.userVerified,
            },
            update: {
              transactionDate: t.transactionDate,
              postedDate: t.postedDate,
              descriptionRaw: t.descriptionRaw,
              merchant: t.merchant,
              amount: t.amount,
              reference: t.reference,
              categoryId: mappedCatId,
              transferGroupId: mappedTransferGroupId,
              userVerified: t.userVerified,
            },
          });
        }
      }

      // 11. Tags & TransactionTags
      for (const tag of db.tags || []) {
        const targetId = mapId(tag.id);
        const existing = await tx.tag.findUnique({ where: { userId_name: { userId, name: tag.name } } });
        if (existing) {
          idMap.set(tag.id, existing.id);
          await tx.tag.update({
            where: { id: existing.id },
            data: { color: tag.color, description: tag.description, budgetLimit: tag.budgetLimit },
          });
        } else {
          await tx.tag.create({
            data: {
              id: targetId,
              userId,
              name: tag.name,
              color: tag.color,
              description: tag.description,
              budgetLimit: tag.budgetLimit,
            },
          });
        }
      }
      for (const tTag of db.transactionTags || []) {
        const mappedTxId = mapId(tTag.transactionId);
        const mappedTagId = mapId(tTag.tagId);
        await tx.transactionTag.upsert({
          where: { transactionId_tagId: { transactionId: mappedTxId, tagId: mappedTagId } },
          create: {
            transactionId: mappedTxId,
            tagId: mappedTagId,
            assignedAt: tTag.assignedAt,
          },
          update: { assignedAt: tTag.assignedAt },
        });
      }

      // 12. Category Budgets
      for (const b of db.budgets || []) {
        const targetId = mapId(b.id);
        const mappedCatId = mapId(b.categoryId);
        await tx.categoryBudget.upsert({
          where: { userId_categoryId_month_year: { userId, categoryId: mappedCatId, month: b.month, year: b.year } },
          create: {
            id: targetId,
            userId,
            categoryId: mappedCatId,
            monthlyLimit: b.monthlyLimit,
            month: b.month,
            year: b.year,
          },
          update: { monthlyLimit: b.monthlyLimit, month: b.month, year: b.year },
        });
      }

      // 13. SIPs
      for (const sip of db.sips || []) {
        const targetId = mapId(sip.id);
        const mappedAccId = mapId(sip.accountId);
        const mappedCatId = sip.categoryId ? mapId(sip.categoryId) : null;
        await tx.activeSip.upsert({
          where: { id: targetId },
          create: {
            id: targetId,
            userId,
            accountId: mappedAccId,
            name: sip.name,
            amount: sip.amount,
            sipDay: sip.sipDay,
            folioNumber: sip.folioNumber,
            frequency: sip.frequency,
            sourceAccountId: sip.sourceAccountId ? mapId(sip.sourceAccountId) : null,
            destinationAccount: sip.destinationAccount,
            billerKeyword: sip.billerKeyword,
            status: sip.status,
          },
          update: {
            name: sip.name,
            amount: sip.amount,
            sipDay: sip.sipDay,
            billerKeyword: sip.billerKeyword,
            accountId: mappedAccId,
          },
        });
      }

      // 14. Loans & Installments
      for (const loan of db.loans || []) {
        const targetId = mapId(loan.id);
        const mappedAccId = mapId(loan.accountId);
        await tx.loan.upsert({
          where: { id: targetId },
          create: {
            id: targetId,
            accountId: mappedAccId,
            principal: loan.principal,
            interestRate: loan.interestRate,
            termMonths: loan.termMonths,
            emiAmount: loan.emiAmount,
            emiDay: loan.emiDay,
            startDate: loan.startDate,
          },
          update: { principal: loan.principal, interestRate: loan.interestRate, emiAmount: loan.emiAmount },
        });
      }
      for (const inst of db.loanInstallments || []) {
        const targetId = mapId(inst.id);
        const mappedLoanId = mapId(inst.loanId);
        await tx.loanInstallment.upsert({
          where: { id: targetId },
          create: {
            id: targetId,
            loanId: mappedLoanId,
            dueDate: inst.dueDate,
            principalAmount: inst.principalAmount,
            interestAmount: inst.interestAmount,
            emiAmount: inst.emiAmount,
            balance: inst.balance,
            status: inst.status,
            confirmedAt: inst.confirmedAt,
          },
          update: { status: inst.status, confirmedAt: inst.confirmedAt },
        });
      }

      // 15. Account Documents
      for (const doc of db.accountDocuments || []) {
        const targetId = mapId(doc.id);
        const mappedAccId = mapId(doc.accountId);
        let storageKey = doc.storageKey;
        if (isDifferentUser && storageKey.startsWith('account-documents/')) {
          const parts = storageKey.split('/');
          if (parts.length >= 4) {
            const oldDocIdWithExt = parts[3];
            const dotIdx = oldDocIdWithExt.lastIndexOf('.');
            const ext = dotIdx !== -1 ? oldDocIdWithExt.substring(dotIdx) : '';
            storageKey = `account-documents/${userId}/${mappedAccId}/${targetId}${ext}`;
          }
        }
        await tx.accountDocument.upsert({
          where: { id: targetId },
          create: {
            id: targetId,
            accountId: mappedAccId,
            name: doc.name,
            mimeType: doc.mimeType,
            byteSize: doc.byteSize,
            storageKey,
          },
          update: { name: doc.name, mimeType: doc.mimeType, byteSize: doc.byteSize, storageKey },
        });
      }

      // 16. Google Email Configs & Sync Logs
      for (const cfg of db.googleEmailConfigs || []) {
        const targetId = mapId(cfg.id);
        await tx.googleEmailConfig.upsert({
          where: { userId_email: { userId, email: cfg.email } },
          create: {
            id: targetId,
            userId,
            email: cfg.email,
            refreshCipher: cfg.refreshCipher,
            refreshIv: cfg.refreshIv,
            refreshTag: cfg.refreshTag,
            refreshKeyVersion: cfg.refreshKeyVersion,
            syncStatus: cfg.syncStatus,
            lastSyncAt: cfg.lastSyncAt,
          },
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
        const targetId = mapId(log.id);
        await tx.emailSyncLog.upsert({
          where: { id: targetId },
          create: {
            id: targetId,
            userId,
            status: log.status,
            emailsScanned: log.emailsScanned,
            alertsParsed: log.alertsParsed,
            transactionsAdded: log.transactionsAdded,
            errorMessage: log.errorMessage,
            sourceSnippet: log.sourceSnippet,
          },
          update: {
            status: log.status,
            emailsScanned: log.emailsScanned,
            alertsParsed: log.alertsParsed,
            transactionsAdded: log.transactionsAdded,
            errorMessage: log.errorMessage,
          },
        });
      }
    }, { maxWait: 30000, timeout: 180000 });

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
