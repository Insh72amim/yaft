import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialsService } from '../common/statement-credentials.service';
import type { BankPdfParser, ParsedRow } from './bank-pdf-parser';
import { UpdateStagedDto, UploadStatementDto } from './imports.dto';
import { parseStatementWithMetadata } from './statement-parser';

import { TransfersService } from '../transfers/transfers.service';
import { CategoryRulesService } from '../category-rules/category-rules.service';
import { CategoryRule, AccountType } from '@prisma/client';
import { isDeclinedOrFailedDescription } from '@yaft/shared';

const categoryRules: Array<[RegExp, string]> = [
  [/salary|payroll/i, 'Salary'], [/swiggy|zomato|restaurant|cafe/i, 'Food & dining'],
  [/blinkit|bigbasket|grofer|grocery/i, 'Groceries'], [/uber|ola|metro|irctc|fuel|petrol/i, 'Transport'],
  [/amazon|flipkart|myntra/i, 'Shopping'], [/electric|broadband|airtel|jio|utility/i, 'Bills'],
  [/zerodha|groww|mutual fund|sip/i, 'Investment'], [/neft|imps|upi.*self|credit card payment/i, 'Transfer'],
];

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: StatementCredentialsService,
    private readonly transfersService: TransfersService,
    private readonly categoryRulesService: CategoryRulesService,
  ) {}

  private async parseWithPasswordFallback(
    file: Express.Multer.File,
    institution: string | undefined,
    explicitPassword: string | undefined,
    userId: string,
    targetAccountId: string,
  ) {
    const isPdf = file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return parseStatementWithMetadata(file, { institution });
    }

    const candidates: (string | undefined)[] = [];
    if (explicitPassword) {
      candidates.push(explicitPassword);
    } else {
      candidates.push(undefined);
    }

    if (!explicitPassword && (!institution || institution.toLowerCase().includes('axis'))) {
      const autoCandidates = await this.getAxisPasswordCandidates(userId, targetAccountId, file.originalname);
      for (const cand of autoCandidates) {
        if (!candidates.includes(cand)) {
          candidates.push(cand);
        }
      }
    }

    let lastError: any = null;
    for (const pwd of candidates) {
      try {
        return await parseStatementWithMetadata(file, {
          institution,
          pdfPassword: pwd,
        });
      } catch (err) {
        lastError = err;
        const msg = String((err as any)?.message || '').toLowerCase();
        if (msg.includes('password') || msg.includes('protected') || msg.includes('incorrect')) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new BadRequestException('This PDF is password-protected. Enter its document-opening password (e.g. FIRST4LETTERS + LAST4CARDDIGITS) in the password field and try again.');
  }

  async getAxisPasswordCandidates(
    userId: string,
    targetAccountId: string,
    filename: string,
  ): Promise<string[]> {
    const user = this.prisma.user ? await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;

    const prefixes = new Set<string>();
    if (user?.name) {
      const fullLetters = user.name.replace(/[^a-zA-Z]/g, '');
      if (fullLetters.length >= 4) {
        const p = fullLetters.slice(0, 4);
        prefixes.add(p.toUpperCase());
        prefixes.add(p.toLowerCase());
        prefixes.add(p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
      }
      const words = user.name.split(/\s+/).map((w) => w.replace(/[^a-zA-Z]/g, '')).filter(Boolean);
      if (words[0] && words[0].length >= 4) {
        const p = words[0].slice(0, 4);
        prefixes.add(p.toUpperCase());
        prefixes.add(p.toLowerCase());
      }
      if (words.length > 1 && words[words.length - 1].length >= 4) {
        const p = words[words.length - 1].slice(0, 4);
        prefixes.add(p.toUpperCase());
        prefixes.add(p.toLowerCase());
      }
      if (words.length >= 2 && words[0].length >= 2 && words[1].length >= 2) {
        const p = words[0].slice(0, 2) + words[1].slice(0, 2);
        prefixes.add(p.toUpperCase());
        prefixes.add(p.toLowerCase());
      }
    }

    const accounts = this.prisma.account?.findMany
      ? await this.prisma.account.findMany({
          where: { userId, archived: false },
          select: { id: true, name: true, type: true, institution: true, vaultEntry: { select: { last4: true } } },
        })
      : [];

    const fourDigitCodes = new Set<string>();
    for (const acc of accounts) {
      const matches = acc.name.match(/\b\d{4}\b/g) || acc.name.match(/\d{4}/g);
      if (matches) {
        for (const m of matches) fourDigitCodes.add(m);
      }
      if (acc.vaultEntry?.last4 && /^\d{4}$/.test(acc.vaultEntry.last4)) {
        fourDigitCodes.add(acc.vaultEntry.last4);
      }
    }

    const fnMatches = filename.match(/\b\d{4}\b/g) || filename.match(/\d{4}/g);
    if (fnMatches) {
      for (const m of fnMatches) fourDigitCodes.add(m);
    }

    const namePrefixes = Array.from(prefixes);
    const targetedCandidates = new Set<string>();

    for (const p of namePrefixes) {
      for (const code of fourDigitCodes) {
        targetedCandidates.add(`${p}${code}`);
      }
    }

    return Array.from(targetedCandidates);
  }

  async create(userId: string, accountId: string, file: Express.Multer.File, dto: UploadStatementDto = {},
    expectedParserId?: BankPdfParser['id']) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId, archived: false,
      type: { in: ['BANK', 'SAVINGS', 'EPFO', 'UPI_LITE'] } } });
    if (!account) throw new ForbiddenException('Eligible account not found.');
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.importBatch.findFirst({ where: { userId, accountId, fileHash: hash, status: { not: 'CANCELLED' } } });
    if (existing) throw new BadRequestException('This exact statement was already uploaded.');
    const isPdf = file.originalname.toLowerCase().endsWith('.pdf');
    const explicitPassword = isPdf && dto.pdfPassword?.length ? dto.pdfPassword : undefined;
    const savedPassword = isPdf && !explicitPassword ? await this.credentials.getPassword(userId, accountId) : undefined;
    const parsed = await this.parseWithPasswordFallback(file, account.institution ?? undefined, explicitPassword ?? savedPassword, userId, accountId);
    if (isPdf && expectedParserId && parsed.parserId !== expectedParserId) {
      throw new BadRequestException(`The uploaded PDF does not match the selected ${expectedParserId} statement source.`);
    }
    const [categories, userRules] = await Promise.all([
      this.prisma.category.findMany({ where: { userId } }),
      this.prisma.categoryRule.findMany({ where: { userId }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] }),
    ]);
    const existingFingerprints = new Set((await this.prisma.transaction.findMany({ where: { accountId }, select: { fingerprint: true } })).map((x) => x.fingerprint));
    const staged = parsed.rows.map((row) => this.enrich(accountId, row, categories, existingFingerprints, userRules));
    const encrypted = dto.rememberPassword && explicitPassword && parsed.parserId === 'SBI'
      ? this.credentials.encrypt(accountId, explicitPassword) : undefined;
    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.importBatch.create({ data: { userId, accountId, filename: file.originalname.slice(0, 200),
        fileHash: hash, rowCount: staged.length, statementBalance: parsed.closingBalanceMinor, staged: { create: staged } } });
      if (encrypted) {
        const stored = { ciphertext: Uint8Array.from(encrypted.ciphertext), iv: Uint8Array.from(encrypted.iv),
          authTag: Uint8Array.from(encrypted.authTag), keyVersion: encrypted.keyVersion };
        await tx.statementCredential.upsert({ where: { accountId },
          create: { accountId, ...stored }, update: stored });
      }
      return created;
    });
    return this.get(userId, batch.id);
  }

  async createForCreditCard(userId: string, accountId: string, file: Express.Multer.File, dto: { pdfPassword?: string } = {}) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId, archived: false,
      type: AccountType.CREDIT_CARD } });
    if (!account) throw new ForbiddenException('Eligible credit card account not found.');
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.importBatch.findFirst({ where: { userId, accountId, fileHash: hash, status: { not: 'CANCELLED' } } });
    if (existing) throw new BadRequestException('This exact statement was already uploaded.');
    const isPdf = file.originalname.toLowerCase().endsWith('.pdf');
    const explicitPassword = isPdf && dto.pdfPassword?.length ? dto.pdfPassword : undefined;
    const parsed = await this.parseWithPasswordFallback(file, account.institution ?? undefined, explicitPassword, userId, accountId);
    let targetAccountId = account.id;
    if (parsed.extractedAccountDigits && /^\d{4}$/.test(parsed.extractedAccountDigits)) {
      const matchingAccount = await this.prisma.account.findFirst({
        where: {
          userId,
          archived: false,
          type: AccountType.CREDIT_CARD,
          OR: [
            { vaultEntry: { last4: parsed.extractedAccountDigits } },
            { name: { contains: parsed.extractedAccountDigits } },
          ],
        },
      });
      if (matchingAccount) {
        targetAccountId = matchingAccount.id;
      }
    }
    const [categories, userRules] = await Promise.all([
      this.prisma.category.findMany({ where: { userId } }),
      this.prisma.categoryRule.findMany({ where: { userId }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] }),
    ]);
    const existingFingerprints = new Set((await this.prisma.transaction.findMany({ where: { accountId: targetAccountId }, select: { fingerprint: true } })).map((x) => x.fingerprint));
    const staged = parsed.rows.map((row) => this.enrich(targetAccountId, row, categories, existingFingerprints, userRules));
    const batch = await this.prisma.importBatch.create({ data: { userId, accountId: targetAccountId, filename: file.originalname.slice(0, 200),
      fileHash: hash, rowCount: staged.length, statementBalance: parsed.closingBalanceMinor, staged: { create: staged } } });
    return this.get(userId, batch.id);
  }

  async pending(userId: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { userId, status: 'REVIEW' }, orderBy: { createdAt: 'desc' } });
    return batch ? this.get(userId, batch.id) : null;
  }

  async pendingAll(userId: string) {
    const batches = await this.prisma.importBatch.findMany({ where: { userId, status: 'REVIEW' },
      select: { id: true }, orderBy: { createdAt: 'desc' } });
    return Promise.all(batches.map((batch) => this.get(userId, batch.id)));
  }

  async get(userId: string, batchId: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id: batchId, userId },
      include: { account: { select: { id: true, name: true, institution: true, vaultEntry: { select: { last4: true } } } }, staged: { orderBy: { rowNumber: 'asc' }, include: { category: true } } } });
    if (!batch) throw new NotFoundException('Import not found.');
    const categories = await this.prisma.category.findMany({ where: { userId }, orderBy: { name: 'asc' } });
    return {
      id: batch.id, filename: batch.filename, status: batch.status, rowCount: batch.rowCount,
      statementBalance: batch.statementBalance !== null ? Number(batch.statementBalance) : null,
      createdAt: batch.createdAt, committedAt: batch.committedAt,
      account: { id: batch.account.id, name: batch.account.name, institution: batch.account.institution, last4: batch.account.vaultEntry?.last4 ?? null },
      staged: batch.staged.map((row) => ({
        id: row.id, rowNumber: row.rowNumber, transactionDate: row.transactionDate, postedDate: row.postedDate,
        descriptionRaw: row.descriptionRaw, merchant: row.merchant, amount: Number(row.amount), reference: row.reference,
        categoryId: row.categoryId, isDuplicate: row.isDuplicate, include: row.include, confidence: row.confidence,
        category: row.category ? { id: row.category.id, name: row.category.name, color: row.category.color } : null,
        emailReference: (row.emailSnippet || row.emailMessageId || row.emailSubject) ? {
          messageId: row.emailMessageId,
          subject: row.emailSubject,
          sender: row.emailSender,
          date: row.emailDate,
          snippet: row.emailSnippet,
        } : null,
      })),
      categories: categories.map((category) => ({ id: category.id, name: category.name, color: category.color })),
    };
  }

  async update(userId: string, batchId: string, rowId: string, dto: UpdateStagedDto) {
    const row = await this.prisma.stagedTransaction.findFirst({ where: { id: rowId, batchId, batch: { userId, status: 'REVIEW' } } });
    if (!row) throw new NotFoundException('Review row not found.');
    if (dto.categoryId && !(await this.prisma.category.findFirst({ where: { id: dto.categoryId, userId } }))) throw new ForbiddenException();
    await this.prisma.stagedTransaction.update({ where: { id: row.id }, data: { include: dto.include, categoryId: dto.categoryId } });
    return this.get(userId, batchId);
  }

  async commit(userId: string, batchId: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id: batchId, userId, status: 'REVIEW' }, include: { staged: true, account: true } });
    if (!batch) throw new NotFoundException('Reviewable import not found.');
    const included = batch.staged.filter((row) => row.include && !row.isDuplicate);
    
    // Pre-fetch vault records to do explicit matching on last4 digits
    const vaults = await this.prisma.accountVaultEntry.findMany({
      where: { account: { userId } },
      select: { accountId: true, last4: true },
    });
    const activeVaults = vaults.filter(v => v.last4);

    let imported = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const row of included) {
        // If this is a GPay / UPI App statement import, check if row is a non-UPI-Lite transaction (from Bank/CC)
        // If so, update exact transaction timestamp on matching existing bank/CC transaction instead of duplicating
        const isUpiLiteRow = /UPI\s+Lite/i.test(row.descriptionRaw) || (row.reference && /UPI\s+Lite/i.test(row.reference));
        const isGpayStatement = batch.account.type === AccountType.UPI_LITE || batch.filename.toLowerCase().includes('gpay');

        if (isGpayStatement && !isUpiLiteRow && row.reference) {
          const refClean = row.reference.trim();
          const existingBankTx = await tx.transaction.findFirst({
            where: {
              account: { userId, type: { in: [AccountType.BANK, AccountType.SAVINGS, AccountType.CREDIT_CARD] } },
              OR: [
                { reference: refClean },
                { descriptionRaw: { contains: refClean } },
                { merchant: { contains: refClean } },
              ],
            },
          });

          if (existingBankTx) {
            await tx.transaction.update({
              where: { id: existingBankTx.id },
              data: { transactionDate: row.transactionDate },
            });
            imported += 1;
            continue;
          }
        }

        const alreadyCommitted = await tx.transaction.findUnique({ where: { accountId_fingerprint: { accountId: batch.accountId, fingerprint: row.fingerprint } } });
        if (alreadyCommitted) continue;

        // Check if the transaction description explicitly names an account/card by last4
        let targetAccountId: string | undefined;
        for (const v of activeVaults) {
          if (v.last4 && row.descriptionRaw.includes(v.last4) && v.accountId !== batch.accountId) {
            targetAccountId = v.accountId;
            break;
          }
        }

        const startOfDay = new Date(Date.UTC(row.transactionDate.getUTCFullYear(), row.transactionDate.getUTCMonth(), row.transactionDate.getUTCDate()));
        const endOfDay = new Date(Date.UTC(row.transactionDate.getUTCFullYear(), row.transactionDate.getUTCMonth(), row.transactionDate.getUTCDate(), 23, 59, 59, 999));

        const opposite = await tx.transaction.findFirst({ where: { 
          account: { userId }, 
          accountId: targetAccountId ? targetAccountId : { not: batch.accountId }, 
          amount: -row.amount,
          transactionDate: { gte: startOfDay, lte: endOfDay },
          transferGroupId: null 
        } });
        
        const transferGroupId = opposite ? randomUUID() : null;
        if (opposite && transferGroupId) await tx.transaction.update({ where: { id: opposite.id }, data: { transferGroupId } });
        
        await tx.transaction.create({ data: {
          accountId: batch.accountId,
          importBatchId: batch.id,
          categoryId: row.categoryId,
          transactionDate: row.transactionDate,
          postedDate: row.postedDate,
          descriptionRaw: row.descriptionRaw,
          merchant: row.merchant,
          amount: row.amount,
          reference: row.reference,
          fingerprint: row.fingerprint,
          transferGroupId,
          userVerified: true,
          emailMessageId: row.emailMessageId,
          emailSubject: row.emailSubject,
          emailSender: row.emailSender,
          emailDate: row.emailDate,
          emailSnippet: row.emailSnippet,
        } });
        imported += 1;
      }

      if (batch.statementBalance !== null && batch.account.type !== 'EPFO') {
        const maxDate = batch.staged.length > 0
          ? new Date(Math.max(...batch.staged.map(s => s.transactionDate.getTime())))
          : new Date();
        const sumResult = await tx.transaction.aggregate({
          where: { accountId: batch.accountId, transactionDate: { lte: maxDate } },
          _sum: { amount: true },
        });
        const sumBeforeStatementEnd = sumResult._sum.amount || 0n;
        const newOpeningBalance = batch.statementBalance - sumBeforeStatementEnd;
        
        await tx.account.update({
          where: { id: batch.accountId },
          data: { openingBalance: newOpeningBalance }
        });
      }

      await tx.importBatch.update({ where: { id: batch.id }, data: { status: 'COMMITTED', committedAt: new Date() } });
    });

    await this.transfersService.reconcileTransfers(userId);
    return { imported, skipped: batch.staged.length - imported };
  }

  async discard(userId: string, batchId: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id: batchId, userId, status: 'REVIEW' } });
    if (!batch) throw new BadRequestException('Only a pending import can be discarded.');
    await this.prisma.importBatch.delete({ where: { id: batch.id } });
  }

  private enrich(
    accountId: string,
    row: ParsedRow,
    categories: { id: string; name: string }[],
    existing: Set<string>,
    userRules: CategoryRule[] = [],
  ) {
    const merchant = row.description.replace(/\b(UPI|POS|NEFT|IMPS|REF|TXN)\b/gi, ' ').replace(/[\d@/_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    
    const catMatch = this.categoryRulesService.matchTransactionCategory(
      userRules,
      categories,
      row.description,
      merchant,
      row.reference,
    );

    const stableIdentity = row.dedupeKey || row.reference?.toLowerCase().trim() || row.description.toLowerCase().replace(/\s+/g, ' ').trim();
    const fingerprintSeed = row.postedDate || row.dedupeKey
      ? `${accountId}|${row.date.toISOString().slice(0, 10)}|${row.postedDate?.toISOString().slice(0, 10) ?? ''}|${stableIdentity}|${row.amountMinor}`
      : `${accountId}|${row.date.toISOString().slice(0, 10)}|${stableIdentity}|${row.amountMinor}`;
    const fingerprint = createHash('sha256').update(fingerprintSeed).digest('hex');
    const isDuplicate = existing.has(fingerprint);
    existing.add(fingerprint);

    const isDeclinedOrFailed = isDeclinedOrFailedDescription(row.description);

    return {
      rowNumber: row.rowNumber,
      transactionDate: row.date,
      postedDate: row.postedDate,
      descriptionRaw: row.description.slice(0, 500),
      merchant,
      amount: BigInt(row.amountMinor),
      reference: row.reference?.slice(0, 100),
      fingerprint,
      isDuplicate,
      include: !isDuplicate && !isDeclinedOrFailed,
      confidence: catMatch.confidence,
      categoryId: catMatch.categoryId,
    };
  }
}
