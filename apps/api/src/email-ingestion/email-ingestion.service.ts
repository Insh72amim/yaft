import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { CategoryRulesService } from '../category-rules/category-rules.service';
import { parseMultipleEmailAlerts, getAlertFingerprint } from './email-alert-parser';
import { ParseEmailSnippetDto } from './email-ingestion.dto';

@Injectable()
export class EmailIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryRulesService: CategoryRulesService,
  ) {}

  async parseSnippet(userId: string, dto: ParseEmailSnippetDto) {
    const parsedAlerts = parseMultipleEmailAlerts(dto.snippet, dto.senderOrSubject);
    if (!parsedAlerts || parsedAlerts.length === 0) {
      throw new BadRequestException('Could not detect any financial transaction alerts in the provided text snippet.');
    }

    let account = await this.prisma.account.findFirst({
      where: { userId, archived: false },
      orderBy: { createdAt: 'asc' },
    });

    if (dto.targetAccountId) {
      const explicitAcc = await this.prisma.account.findFirst({ where: { id: dto.targetAccountId, userId } });
      if (explicitAcc) account = explicitAcc;
    }

    if (!account) {
      throw new BadRequestException('No matching account found. Please create an account in YAFT before parsing email snippets.');
    }

    // Query existing committed transactions, pending review staged transactions, user categories & category rules
    const [existingTx, existingStaged, categories, userRules] = await Promise.all([
      this.prisma.transaction.findMany({ where: { accountId: account.id }, select: { fingerprint: true } }),
      this.prisma.stagedTransaction.findMany({ where: { batch: { accountId: account.id, status: 'REVIEW' } }, select: { fingerprint: true } }),
      this.categoryRulesService.listCategories(userId),
      this.prisma.categoryRule.findMany({ where: { userId }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] }),
    ]);

    const existingTxFingerprints = new Set(existingTx.map((x) => x.fingerprint));
    const existingStagedFingerprints = new Set(existingStaged.map((x) => x.fingerprint));

    const stagedRows = parsedAlerts.map((alert, idx) => {
      const fingerprint = getAlertFingerprint(account.id, alert);
      const isDuplicate = existingTxFingerprints.has(fingerprint) || existingStagedFingerprints.has(fingerprint);
      existingTxFingerprints.add(fingerprint);
      const descriptionRaw = `${alert.merchant} [${alert.bankName}${alert.accountLast4 ? ' A/C ' + alert.accountLast4 : ''}]`;
      const catMatch = this.categoryRulesService.matchTransactionCategory(
        userRules,
        categories,
        descriptionRaw,
        alert.merchant,
        alert.referenceNumber,
      );

        return {
          rowNumber: idx + 1,
          transactionDate: alert.transactionDate,
          descriptionRaw,
          merchant: alert.merchant,
          amount: alert.amountMinor,
          reference: alert.referenceNumber || null,
          fingerprint,
          categoryId: catMatch.categoryId ?? null,
          isDuplicate,
          include: !isDuplicate,
          confidence: isDuplicate ? 100 : catMatch.confidence,
          emailMessageId: alert.emailMessageId ?? null,
          emailSubject: dto.senderOrSubject ?? null,
          emailSender: null,
          emailDate: alert.transactionDate ?? null,
          emailSnippet: alert.rawSnippet ?? null,
        };
    });

    const fileHash = createHash('sha256').update(dto.snippet + stagedRows.map(r => r.fingerprint).join('-')).digest('hex');

    const batch = await this.prisma.importBatch.create({
      data: {
        userId,
        accountId: account.id,
        filename: `email-alert-${new Date().toISOString().slice(0, 10)}.txt`,
        fileHash,
        rowCount: stagedRows.length,
        status: 'REVIEW',
        staged: {
          create: stagedRows,
        },
      },
      include: {
        staged: true,
      },
    });

    await this.prisma.emailSyncLog.create({
      data: {
        userId,
        status: 'SUCCESS',
        emailsScanned: 1,
        alertsParsed: parsedAlerts.length,
        transactionsAdded: parsedAlerts.length,
        sourceSnippet: dto.snippet.slice(0, 200),
      },
    });

    return {
      success: true,
      message: `Parsed ${parsedAlerts.length} transaction alert(s) from email snippet.`,
      batchId: batch.id,
      accountId: account.id,
      parsedAlerts,
      stagedRowsCount: batch.staged.length,
    };
  }

  async listLogs(userId: string) {
    const logs = await this.prisma.emailSyncLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return logs;
  }
}
