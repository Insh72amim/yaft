import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialCipher } from '../common/statement-credentials.service';
import { parseMultipleEmailAlerts } from './email-alert-parser';
import { ParseEmailSnippetDto, SaveEmailConfigDto } from './email-ingestion.dto';

@Injectable()
export class EmailIngestionService {
  private readonly cipher = new StatementCredentialCipher();

  constructor(private readonly prisma: PrismaService) {}

  async getConfig(userId: string) {
    const config = await this.prisma.emailConfig.findFirst({
      where: { userId },
      select: {
        id: true,
        email: true,
        host: true,
        port: true,
        tls: true,
        enabled: true,
        autoSync: true,
        syncIntervalMinutes: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      return { configured: false };
    }

    return {
      configured: true,
      ...config,
    };
  }

  async saveConfig(userId: string, dto: SaveEmailConfigDto) {
    const encrypted = this.cipher.encrypt(userId, dto.password);
    const existing = await this.prisma.emailConfig.findFirst({ where: { userId } });

    const dataPayload = {
      email: dto.email.trim(),
      host: dto.host?.trim() || 'imap.gmail.com',
      port: dto.port || 993,
      tls: dto.tls !== undefined ? dto.tls : true,
      autoSync: dto.autoSync !== undefined ? dto.autoSync : false,
      passwordCipher: new Uint8Array(encrypted.ciphertext),
      passwordIv: new Uint8Array(encrypted.iv),
      passwordTag: new Uint8Array(encrypted.authTag),
      passwordKeyVersion: encrypted.keyVersion,
      enabled: true,
    };

    if (existing) {
      const updated = await this.prisma.emailConfig.update({
        where: { id: existing.id },
        data: dataPayload,
      });

      return { success: true, message: 'Email configuration updated.', email: updated.email };
    }

    const created = await this.prisma.emailConfig.create({
      data: {
        userId,
        ...dataPayload,
      },
    });

    return { success: true, message: 'Email configuration saved.', email: created.email };
  }

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

  async syncInbox(userId: string) {
    const config = await this.prisma.emailConfig.findFirst({ where: { userId } });
    if (!config || !config.enabled || !config.passwordCipher || !config.passwordIv || !config.passwordTag) {
      throw new BadRequestException('No configured email account found. Please configure IMAP settings first.');
    }

    await this.prisma.emailConfig.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date() },
    });

    const log = await this.prisma.emailSyncLog.create({
      data: {
        userId,
        configId: config.id,
        status: 'SUCCESS',
        emailsScanned: 0,
        alertsParsed: 0,
        transactionsAdded: 0,
      },
    });

    return {
      success: true,
      message: `Email sync triggered for ${config.email}. Ready for incoming transaction alerts.`,
      syncLogId: log.id,
      email: config.email,
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
