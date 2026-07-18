import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialsService } from '../common/statement-credentials.service';
import type { ParsedRow } from './bank-pdf-parser';
import { UpdateStagedDto, UploadStatementDto } from './imports.dto';
import { parseStatementWithMetadata } from './statement-parser';

const categoryRules: Array<[RegExp, string]> = [
  [/salary|payroll/i, 'Salary'], [/swiggy|zomato|restaurant|cafe/i, 'Food & dining'],
  [/blinkit|bigbasket|grofer|grocery/i, 'Groceries'], [/uber|ola|metro|irctc|fuel|petrol/i, 'Transport'],
  [/amazon|flipkart|myntra/i, 'Shopping'], [/electric|broadband|airtel|jio|utility/i, 'Bills'],
  [/zerodha|groww|mutual fund|sip/i, 'Investment'], [/neft|imps|upi.*self|credit card payment/i, 'Transfer'],
];

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService, private readonly credentials: StatementCredentialsService) {}

  async create(userId: string, accountId: string, file: Express.Multer.File, dto: UploadStatementDto = {}) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new ForbiddenException('Account not found.');
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.importBatch.findFirst({ where: { userId, accountId, fileHash: hash, status: { not: 'CANCELLED' } } });
    if (existing) throw new BadRequestException('This exact statement was already uploaded.');
    const isPdf = file.originalname.toLowerCase().endsWith('.pdf');
    const explicitPassword = isPdf && dto.pdfPassword?.length ? dto.pdfPassword : undefined;
    const savedPassword = isPdf && !explicitPassword ? await this.credentials.getPassword(userId, accountId) : undefined;
    const parsed = await parseStatementWithMetadata(file, { institution: account.institution ?? undefined, pdfPassword: explicitPassword ?? savedPassword });
    const categories = await this.prisma.category.findMany({ where: { userId } });
    const existingFingerprints = new Set((await this.prisma.transaction.findMany({ where: { accountId }, select: { fingerprint: true } })).map((x) => x.fingerprint));
    const staged = parsed.rows.map((row) => this.enrich(accountId, row, categories, existingFingerprints));
    const encrypted = dto.rememberPassword && explicitPassword && parsed.parserId === 'SBI'
      ? this.credentials.encrypt(accountId, explicitPassword) : undefined;
    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.importBatch.create({ data: { userId, accountId, filename: file.originalname.slice(0, 200),
        fileHash: hash, rowCount: staged.length, staged: { create: staged } } });
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

  async pending(userId: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { userId, status: 'REVIEW' }, orderBy: { createdAt: 'desc' } });
    return batch ? this.get(userId, batch.id) : null;
  }

  async get(userId: string, batchId: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id: batchId, userId },
      include: { account: { select: { id: true, name: true } }, staged: { orderBy: { rowNumber: 'asc' }, include: { category: true } } } });
    if (!batch) throw new NotFoundException('Import not found.');
    const categories = await this.prisma.category.findMany({ where: { userId }, orderBy: { name: 'asc' } });
    return { ...batch, staged: batch.staged.map((row) => ({ ...row, amount: Number(row.amount) })), categories };
  }

  async update(userId: string, batchId: string, rowId: string, dto: UpdateStagedDto) {
    const row = await this.prisma.stagedTransaction.findFirst({ where: { id: rowId, batchId, batch: { userId, status: 'REVIEW' } } });
    if (!row) throw new NotFoundException('Review row not found.');
    if (dto.categoryId && !(await this.prisma.category.findFirst({ where: { id: dto.categoryId, userId } }))) throw new ForbiddenException();
    await this.prisma.stagedTransaction.update({ where: { id: row.id }, data: { include: dto.include, categoryId: dto.categoryId } });
    return this.get(userId, batchId);
  }

  async commit(userId: string, batchId: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id: batchId, userId, status: 'REVIEW' }, include: { staged: true } });
    if (!batch) throw new NotFoundException('Reviewable import not found.');
    const included = batch.staged.filter((row) => row.include && !row.isDuplicate);
    let imported = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const row of included) {
        const alreadyCommitted = await tx.transaction.findUnique({ where: { accountId_fingerprint: { accountId: batch.accountId, fingerprint: row.fingerprint } } });
        if (alreadyCommitted) continue;
        const opposite = await tx.transaction.findFirst({ where: { account: { userId }, accountId: { not: batch.accountId }, amount: -row.amount,
          transactionDate: { gte: new Date(row.transactionDate.getTime() - 3 * 86_400_000), lte: new Date(row.transactionDate.getTime() + 3 * 86_400_000) },
          transferGroupId: null } });
        const transferGroupId = opposite ? randomUUID() : null;
        if (opposite && transferGroupId) await tx.transaction.update({ where: { id: opposite.id }, data: { transferGroupId } });
        await tx.transaction.create({ data: { accountId: batch.accountId, importBatchId: batch.id, categoryId: row.categoryId,
          transactionDate: row.transactionDate, postedDate: row.postedDate, descriptionRaw: row.descriptionRaw, merchant: row.merchant, amount: row.amount,
          reference: row.reference, fingerprint: row.fingerprint, transferGroupId, userVerified: true } });
        imported += 1;
      }
      await tx.importBatch.update({ where: { id: batch.id }, data: { status: 'COMMITTED', committedAt: new Date() } });
    });
    return { imported, skipped: batch.staged.length - imported };
  }

  async discard(userId: string, batchId: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id: batchId, userId, status: 'REVIEW' } });
    if (!batch) throw new BadRequestException('Only a pending import can be discarded.');
    await this.prisma.importBatch.delete({ where: { id: batch.id } });
  }

  private enrich(accountId: string, row: ParsedRow, categories: { id: string; name: string }[], existing: Set<string>) {
    const merchant = row.description.replace(/\b(UPI|POS|NEFT|IMPS|REF|TXN)\b/gi, ' ').replace(/[\d@/_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    const match = categoryRules.find(([pattern]) => pattern.test(row.description));
    const categoryName = match?.[1] ?? 'Uncategorised';
    const stableIdentity = row.dedupeKey || row.reference?.toLowerCase().trim() || row.description.toLowerCase().replace(/\s+/g, ' ').trim();
    const fingerprintSeed = row.postedDate || row.dedupeKey
      ? `${accountId}|${row.date.toISOString().slice(0, 10)}|${row.postedDate?.toISOString().slice(0, 10) ?? ''}|${stableIdentity}|${row.amountMinor}`
      : `${accountId}|${row.date.toISOString().slice(0, 10)}|${stableIdentity}|${row.amountMinor}`;
    const fingerprint = createHash('sha256').update(fingerprintSeed).digest('hex');
    const isDuplicate = existing.has(fingerprint);
    existing.add(fingerprint);
    return { rowNumber: row.rowNumber, transactionDate: row.date, postedDate: row.postedDate, descriptionRaw: row.description.slice(0, 500), merchant,
      amount: BigInt(row.amountMinor), reference: row.reference?.slice(0, 100), fingerprint, isDuplicate,
      include: !isDuplicate, confidence: match ? 90 : 20, categoryId: categories.find((category) => category.name === categoryName)?.id };
  }
}
