import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { parseMultipleEmailAlerts, getAlertFingerprint } from './email-alert-parser';
import { ParseEmailSnippetDto } from './email-ingestion.dto';

@Injectable()
export class EmailIngestionService {
  constructor(private readonly prisma: PrismaService) {}

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
      account = await this.prisma.account.create({
        data: {
          userId,
          name: 'Email Alert Account',
          type: 'BANK',
          institution: parsedAlerts[0].bankName,
        },
      });
    }

    // Query existing committed transactions and pending review staged transactions for this account
    const existingTxFingerprints = new Set(
      (await this.prisma.transaction.findMany({ where: { accountId: account.id }, select: { fingerprint: true } })).map((x) => x.fingerprint)
    );
    const existingStagedFingerprints = new Set(
      (await this.prisma.stagedTransaction.findMany({ where: { batch: { accountId: account.id, status: 'REVIEW' } }, select: { fingerprint: true } })).map((x) => x.fingerprint)
    );

    const stagedRows = parsedAlerts.map((alert, idx) => {
      const fingerprint = getAlertFingerprint(account.id, alert);
      const isDuplicate = existingTxFingerprints.has(fingerprint) || existingStagedFingerprints.has(fingerprint);
      existingTxFingerprints.add(fingerprint);
      return {
        rowNumber: idx + 1,
        transactionDate: alert.transactionDate,
        descriptionRaw: `${alert.merchant} [${alert.bankName}${alert.accountLast4 ? ' A/C ' + alert.accountLast4 : ''}]`,
        merchant: alert.merchant,
        amount: alert.amountMinor,
        reference: alert.referenceNumber || null,
        fingerprint,
        isDuplicate,
        include: !isDuplicate,
        confidence: isDuplicate ? 100 : 90,
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
