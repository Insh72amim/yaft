import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { google } from 'googleapis';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialCipher } from '../common/statement-credentials.service';
import { parseMultipleEmailAlerts, ParsedEmailTransaction } from './email-alert-parser';

@Injectable()
export class GoogleGmailService {
  private readonly logger = new Logger(GoogleGmailService.name);
  private readonly cipher = new StatementCredentialCipher();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private getOAuthClient(redirectUriOverride?: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const defaultRedirect = this.configService.get<string>('GOOGLE_REDIRECT_URI') || 'http://localhost:3000/import';
    const redirectUri = redirectUriOverride || defaultRedirect;

    if (!clientId || !clientSecret) {
      return null;
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  async getAuthUrl(userId: string, redirectUri?: string) {
    const oauth2Client = this.getOAuthClient(redirectUri);
    if (!oauth2Client) {
      return {
        configured: false,
        authUrl: null,
        message: 'Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) not set in environment.',
      };
    }

    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64url');

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force refresh token issuance
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });

    return {
      configured: true,
      authUrl,
    };
  }

  async handleCallback(userId: string, code: string, redirectUri?: string) {
    const oauth2Client = this.getOAuthClient(redirectUri);
    if (!oauth2Client) {
      throw new BadRequestException('Google OAuth client is not configured on the server.');
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      if (!tokens.refresh_token) {
        // If user previously authorized without consent prompt, retrieve existing token or demand consent
        const existing = await this.prisma.googleEmailConfig.findFirst({ where: { userId } });
        if (!existing) {
          throw new BadRequestException('No refresh token returned by Google. Please disconnect and grant consent again.');
        }
      }

      // Fetch user profile email
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;

      if (!email) {
        throw new BadRequestException('Could not retrieve email address from Google Account.');
      }

      const existingConfig = await this.prisma.googleEmailConfig.findFirst({ where: { userId } });
      const refreshTokenToUse = tokens.refresh_token || (existingConfig ? this.decryptRefreshToken(userId, existingConfig) : null);

      if (!refreshTokenToUse) {
        throw new BadRequestException('Failed to secure a refresh token for background Gmail sync.');
      }

      const encrypted = this.cipher.encrypt(userId, refreshTokenToUse);

      const dataPayload = {
        email: email.toLowerCase().trim(),
        refreshCipher: new Uint8Array(encrypted.ciphertext),
        refreshIv: new Uint8Array(encrypted.iv),
        refreshTag: new Uint8Array(encrypted.authTag),
        refreshKeyVersion: encrypted.keyVersion,
        syncStatus: 'ACTIVE',
      };

      if (existingConfig) {
        await this.prisma.googleEmailConfig.update({
          where: { id: existingConfig.id },
          data: dataPayload,
        });
      } else {
        await this.prisma.googleEmailConfig.create({
          data: {
            userId,
            ...dataPayload,
          },
        });
      }

      return {
        success: true,
        message: `Successfully connected Gmail account (${email}). Ready for transaction alert ingestion.`,
        email,
      };
    } catch (err: any) {
      this.logger.error(`Google OAuth callback failed: ${err.message}`, err.stack);
      throw new BadRequestException(`Google authorization failed: ${err.message || err}`);
    }
  }

  async getConfig(userId: string) {
    const config = await this.prisma.googleEmailConfig.findFirst({
      where: { userId },
      select: {
        id: true,
        email: true,
        lastSyncAt: true,
        syncStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const isClientConfigured = !!(this.configService.get('GOOGLE_CLIENT_ID') && this.configService.get('GOOGLE_CLIENT_SECRET'));

    if (!config) {
      return {
        connected: false,
        oauthServerConfigured: isClientConfigured,
      };
    }

    return {
      connected: true,
      oauthServerConfigured: isClientConfigured,
      email: config.email,
      lastSyncAt: config.lastSyncAt,
      syncStatus: config.syncStatus,
      createdAt: config.createdAt,
    };
  }

  async syncGmail(userId: string) {
    const config = await this.prisma.googleEmailConfig.findFirst({ where: { userId } });
    if (!config) {
      throw new BadRequestException('No connected Gmail account found. Please click "Connect Gmail" first.');
    }

    const refreshToken = this.decryptRefreshToken(userId, config);
    const oauth2Client = this.getOAuthClient();

    if (!oauth2Client || !refreshToken) {
      throw new BadRequestException('Unable to authenticate with Gmail API. OAuth configuration or refresh token missing.');
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Search for transaction emails from Indian banks & cards
      const query = 'from:(hdfcbank.net OR icicibank.com OR sbi.co.in OR axisbank.com OR kotak.com OR americanexpress.com OR pnb.co.in) (debited OR credited OR spent OR alert OR transaction)';
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 20,
      });

      const messages = listRes.data.messages || [];
      const extractedAlerts: ParsedEmailTransaction[] = [];

      for (const msgRef of messages) {
        if (!msgRef.id) continue;
        const msgDetail = await gmail.users.messages.get({
          userId: 'me',
          id: msgRef.id,
          format: 'full',
        });

        const snippet = msgDetail.data.snippet || '';
        const bodyText = this.extractMessageBody(msgDetail.data.payload) || snippet;
        const headers = msgDetail.data.payload?.headers || [];
        const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || '';
        const from = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || '';

        const alerts = parseMultipleEmailAlerts(bodyText + ' ' + snippet, `${from} ${subject}`);
        for (const alert of alerts) {
          extractedAlerts.push(alert);
        }
      }

      // Update sync timestamp
      await this.prisma.googleEmailConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: new Date(), syncStatus: 'ACTIVE' },
      });

      if (extractedAlerts.length === 0) {
        await this.prisma.emailSyncLog.create({
          data: {
            userId,
            status: 'SUCCESS',
            emailsScanned: messages.length,
            alertsParsed: 0,
            transactionsAdded: 0,
            sourceSnippet: `Scanned ${messages.length} emails. No new financial transaction alerts found.`,
          },
        });

        return {
          success: true,
          message: `Scanned ${messages.length} email(s) from ${config.email}. No new transaction alerts detected.`,
          scannedCount: messages.length,
          parsedCount: 0,
        };
      }

      // Find or create default account
      let account = await this.prisma.account.findFirst({
        where: { userId, archived: false },
        orderBy: { createdAt: 'asc' },
      });

      if (!account) {
        account = await this.prisma.account.create({
          data: {
            userId,
            name: 'Gmail Alert Account',
            type: 'BANK',
            institution: extractedAlerts[0].bankName,
          },
        });
      }

      const fileHash = createHash('sha256').update(JSON.stringify(extractedAlerts) + Date.now().toString()).digest('hex');

      const batch = await this.prisma.importBatch.create({
        data: {
          userId,
          accountId: account.id,
          filename: `gmail-alert-${config.email}-${new Date().toISOString().slice(0, 10)}.txt`,
          fileHash,
          rowCount: extractedAlerts.length,
          status: 'REVIEW',
          staged: {
            create: extractedAlerts.map((alert, idx) => ({
              rowNumber: idx + 1,
              transactionDate: alert.transactionDate,
              descriptionRaw: `${alert.merchant} [${alert.bankName}${alert.accountLast4 ? ' A/C ' + alert.accountLast4 : ''}]`,
              merchant: alert.merchant,
              amount: alert.amountMinor,
              reference: alert.referenceNumber || null,
              fingerprint: `${account.id}-${alert.transactionDate.toISOString()}-${alert.amountMinor}-${idx}`,
              include: true,
              confidence: 0.95,
            })),
          },
        },
        include: { staged: true },
      });

      await this.prisma.emailSyncLog.create({
        data: {
          userId,
          status: 'SUCCESS',
          emailsScanned: messages.length,
          alertsParsed: extractedAlerts.length,
          transactionsAdded: extractedAlerts.length,
          sourceSnippet: `Ingested ${extractedAlerts.length} alert(s) from ${config.email}.`,
        },
      });

      return {
        success: true,
        message: `Successfully ingested ${extractedAlerts.length} transaction alert(s) from ${config.email}!`,
        batchId: batch.id,
        scannedCount: messages.length,
        parsedCount: extractedAlerts.length,
        stagedRowsCount: batch.staged.length,
      };
    } catch (err: any) {
      this.logger.error(`Gmail sync failed for user ${userId}: ${err.message}`, err.stack);
      await this.prisma.googleEmailConfig.update({
        where: { id: config.id },
        data: { syncStatus: 'ERROR' },
      });
      throw new BadRequestException(`Gmail sync error: ${err.message || err}`);
    }
  }

  async disconnect(userId: string) {
    const config = await this.prisma.googleEmailConfig.findFirst({ where: { userId } });
    if (!config) return { success: true, message: 'No connected Gmail account found.' };

    await this.prisma.googleEmailConfig.delete({ where: { id: config.id } });
    return { success: true, message: `Disconnected Gmail account (${config.email}).` };
  }

  private decryptRefreshToken(userId: string, config: any): string | null {
    if (!config.refreshCipher || !config.refreshIv || !config.refreshTag) return null;
    try {
      return this.cipher.decrypt(userId, {
        ciphertext: Buffer.from(config.refreshCipher),
        iv: Buffer.from(config.refreshIv),
        authTag: Buffer.from(config.refreshTag),
        keyVersion: config.refreshKeyVersion || 1,
      });
    } catch (err) {
      this.logger.error('Failed to decrypt Google refresh token', err);
      return null;
    }
  }

  private extractMessageBody(payload: any): string {
    if (!payload) return '';
    if (payload.body && payload.body.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      for (const part of payload.parts) {
        const nested = this.extractMessageBody(part);
        if (nested) return nested;
      }
    }
    return '';
  }
}
