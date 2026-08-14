import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { parseMultipleEmailAlerts } from './email-alert-parser';
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

    const fileHash = createHash('sha256').update(dto.snippet + Date.now().toString()).digest('hex');

    const batch = await this.prisma.importBatch.create({
      data: {
        userId,
        accountId: account.id,
        filename: `email-alert-${new Date().toISOString().slice(0, 10)}.txt`,
        fileHash,
        rowCount: parsedAlerts.length,
        status: 'REVIEW',
        staged: {
          create: parsedAlerts.map((alert, idx) => ({
            rowNumber: idx + 1,
            transactionDate: alert.transactionDate,
            descriptionRaw: `${alert.merchant} [${alert.bankName}${alert.accountLast4 ? ' A/C ' + alert.accountLast4 : ''}]`,
            merchant: alert.merchant,
            amount: alert.amountMinor,
            reference: alert.referenceNumber || null,
            fingerprint: `${account.id}-${alert.transactionDate.toISOString()}-${alert.amountMinor}-${idx}`,
            include: true,
            confidence: 0.9,
          })),
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
