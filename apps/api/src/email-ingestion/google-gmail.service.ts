import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { google } from 'googleapis';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialCipher } from '../common/statement-credentials.service';
import { parseMultipleEmailAlerts, ParsedEmailTransaction, getAccountCategoryKey, getAccountCategoryDisplayName, getAlertFingerprint } from './email-alert-parser';

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

  async syncGmail(userId: string, days?: number) {
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

    const syncDays = typeof days === 'number' && days > 0 ? days : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - syncDays);
    const afterDateStr = `${cutoffDate.getFullYear()}/${String(cutoffDate.getMonth() + 1).padStart(2, '0')}/${String(cutoffDate.getDate()).padStart(2, '0')}`;

    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Fast server-side filtered search for transaction emails across all major Indian banks & cards within the time window
      const baseBankFilter = 'from:(hdfcbank.net OR hdfcbank.com OR icicibank.com OR icicibank.co.in OR icici.com OR sbi.co.in OR axisbank.com OR kotak.com OR americanexpress.com OR pnb.co.in OR indusind.com OR idfcfirstbank.com OR rblbank.com OR standardchartered.co.in OR citibank.com OR "ICICI Bank")';
      const keywordsFilter = '(debited OR credited OR spent OR alert OR transaction OR payment OR "credit card" OR "a/c" OR "ending with" OR "XX")';
      const query = `${baseBankFilter} ${keywordsFilter} after:${afterDateStr}`;

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
      });

      const messages = listRes.data.messages || [];
      const extractedAlerts: ParsedEmailTransaction[] = [];

      // Parallel batch fetching in chunks of 10 for maximum throughput without rate limiting
      const BATCH_SIZE = 10;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const chunk = messages.slice(i, i + BATCH_SIZE);
        const details = await Promise.all(
          chunk.map((msgRef) =>
            msgRef.id
              ? gmail.users.messages
                  .get({
                    userId: 'me',
                    id: msgRef.id,
                    format: 'full',
                  })
                  .catch((e) => {
                    this.logger.warn(`Failed to fetch message ${msgRef.id}: ${e.message}`);
                    return null;
                  })
              : null,
          ),
        );

        for (const msgDetail of details) {
          if (!msgDetail || !msgDetail.data) continue;
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
      }

      // Update sync timestamp
      await this.prisma.googleEmailConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: new Date(), syncStatus: 'ACTIVE' },
      });

      if (extractedAlerts.length === 0) {
        const emptySnippet = `Scanned ${messages.length} email(s) for the past ${syncDays} days (since ${cutoffDate.toLocaleDateString('en-IN')}). No new financial alerts found.`;
        await this.prisma.emailSyncLog.create({
          data: {
            userId,
            status: 'SUCCESS',
            emailsScanned: messages.length,
            alertsParsed: 0,
            transactionsAdded: 0,
            sourceSnippet: emptySnippet,
          },
        });

        return {
          success: true,
          message: `Scanned ${messages.length} email(s) from ${config.email} for the past ${syncDays} days. No new transaction alerts detected.`,
          scannedCount: messages.length,
          parsedCount: 0,
          dateRange: {
            earliest: null,
            latest: null,
            daysSynced: syncDays,
          },
        };
      }

      // Compute earliest and latest alert dates
      const validDates = extractedAlerts
        .map((a) => a.transactionDate)
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      const earliestAlertDate = validDates[0] || null;
      const latestAlertDate = validDates[validDates.length - 1] || null;

      const dateRangeLabel = earliestAlertDate && latestAlertDate
        ? `${earliestAlertDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} to ${latestAlertDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : `Past ${syncDays} days`;

      // Group alerts by granular Account Category: Institution + Type + Account Last 4
      const groups: Record<string, ParsedEmailTransaction[]> = {};
      for (const alert of extractedAlerts) {
        const categoryKey = getAccountCategoryKey(alert);
        if (!groups[categoryKey]) groups[categoryKey] = [];
        groups[categoryKey].push(alert);
      }

      const createdBatchIds: string[] = [];
      let totalStaged = 0;

      // Fetch user's active accounts once for smart matching
      const userAccounts = await this.prisma.account.findMany({
        where: { userId, archived: false },
      });

      for (const [groupKey, groupAlerts] of Object.entries(groups)) {
        const sampleAlert = groupAlerts[0];
        const targetType = sampleAlert.accountType;
        const bankName = sampleAlert.bankName;
        const last4 = sampleAlert.accountLast4;
        const displayName = getAccountCategoryDisplayName(sampleAlert);

        // 1. Precise Match: Same account type + (matches last4 in name/number OR matches exact institution + last4)
        let matchedAccount = userAccounts.find((acc) => {
          if (acc.type !== targetType) return false;
          const accName = (acc.name || '').toLowerCase();
          const accInst = (acc.institution || '').toLowerCase();
          const targetBank = bankName.toLowerCase();

          // Check if last4 matches
          if (last4 && (accName.includes(last4) || accName.includes(`••${last4}`) || accName.includes(`xx${last4}`))) {
            return accInst.includes(targetBank) || targetBank.includes(accInst) || accName.includes(targetBank);
          }

          return false;
        });

        // 2. Secondary Match: Same type and institution name
        if (!matchedAccount) {
          matchedAccount = userAccounts.find((acc) => {
            if (acc.type !== targetType) return false;
            const accInst = (acc.institution || '').toLowerCase();
            const accName = (acc.name || '').toLowerCase();
            const targetBank = bankName.toLowerCase();
            return (accInst && (accInst.includes(targetBank) || targetBank.includes(accInst))) || accName.includes(targetBank);
          });
        }

        // 3. Fallback: If no account matched, auto-create a clearly labeled Account profile for this exact category
        if (!matchedAccount) {
          matchedAccount = await this.prisma.account.create({
            data: {
              userId,
              name: displayName,
              type: targetType,
              institution: bankName,
            },
          });
          userAccounts.push(matchedAccount);
        }

        // Query existing committed transactions and pending review staged transactions for this account
        const existingTxFingerprints = new Set(
          (await this.prisma.transaction.findMany({ where: { accountId: matchedAccount.id }, select: { fingerprint: true } })).map((x) => x.fingerprint)
        );
        const existingStagedFingerprints = new Set(
          (await this.prisma.stagedTransaction.findMany({ where: { batch: { accountId: matchedAccount.id, status: 'REVIEW' } }, select: { fingerprint: true } })).map((x) => x.fingerprint)
        );

        const stagedRows = groupAlerts.map((alert, idx) => {
          const fingerprint = getAlertFingerprint(matchedAccount!.id, alert);
          const isDuplicate = existingTxFingerprints.has(fingerprint) || existingStagedFingerprints.has(fingerprint);
          existingTxFingerprints.add(fingerprint);
          return {
            rowNumber: idx + 1,
            transactionDate: alert.transactionDate,
            descriptionRaw: `${alert.merchant} [${alert.bankName}${alert.accountLast4 ? ' ••' + alert.accountLast4 : ''}]`,
            merchant: alert.merchant,
            amount: alert.amountMinor,
            reference: alert.referenceNumber || null,
            fingerprint,
            isDuplicate,
            include: !isDuplicate,
            confidence: isDuplicate ? 100 : 95,
          };
        });

        // Count how many new (non-duplicate) items exist
        const newRowsCount = stagedRows.filter((r) => !r.isDuplicate).length;

        // If every single alert is already committed/staged, we don't need to create a redundant review batch
        if (newRowsCount === 0 && stagedRows.length > 0) {
          continue;
        }

        const fileHash = createHash('sha256')
          .update(groupKey + stagedRows.map((r) => r.fingerprint).join(';'))
          .digest('hex');

        // Check if an identical batch with this exact hash is already pending review
        const existingPendingBatch = await this.prisma.importBatch.findFirst({
          where: { accountId: matchedAccount.id, fileHash, status: 'REVIEW' },
        });
        if (existingPendingBatch) {
          createdBatchIds.push(existingPendingBatch.id);
          continue;
        }

        const cleanBankSlug = bankName.replace(/[^a-zA-Z0-9]/g, '-');
        const batchFilename = `gmail-sync-${cleanBankSlug}-${targetType}-${last4 || 'all'}-${new Date().toISOString().slice(0, 10)}.txt`;

        const batch = await this.prisma.importBatch.create({
          data: {
            userId,
            accountId: matchedAccount.id,
            filename: batchFilename,
            fileHash,
            rowCount: stagedRows.length,
            status: 'REVIEW',
            staged: {
              create: stagedRows,
            },
          },
          include: { staged: true },
        });

        createdBatchIds.push(batch.id);
        totalStaged += stagedRows.filter((r) => !r.isDuplicate).length;
      }

      await this.prisma.emailSyncLog.create({
        data: {
          userId,
          status: 'SUCCESS',
          emailsScanned: messages.length,
          alertsParsed: extractedAlerts.length,
          transactionsAdded: totalStaged,
          sourceSnippet: `Ingested ${totalStaged} new alert(s) across ${createdBatchIds.length} account batch(es) from ${config.email} (${dateRangeLabel}).`,
        },
      });

      const message = totalStaged > 0
        ? `Successfully ingested ${totalStaged} new alert(s) across ${createdBatchIds.length} account batch(es) from ${config.email} (${dateRangeLabel})!`
        : `Scanned ${messages.length} email(s) (${dateRangeLabel}). Found ${extractedAlerts.length} alert(s), all of which were already previously imported.`;

      return {
        success: true,
        message,
        batchIds: createdBatchIds,
        scannedCount: messages.length,
        parsedCount: extractedAlerts.length,
        stagedRowsCount: totalStaged,
        dateRange: {
          earliest: earliestAlertDate?.toISOString() || null,
          latest: latestAlertDate?.toISOString() || null,
          daysSynced: syncDays,
          label: dateRangeLabel,
        },
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
    let rawContent = '';

    if (payload.body && payload.body.data) {
      rawContent = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts && Array.isArray(payload.parts)) {
      // Look for text/plain part first
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          rawContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }
      // If no text/plain, look for text/html part
      if (!rawContent) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/html' && part.body && part.body.data) {
            rawContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      }
      // If still empty, recurse into nested multipart
      if (!rawContent) {
        for (const part of payload.parts) {
          const nested = this.extractMessageBody(part);
          if (nested) {
            rawContent = nested;
            break;
          }
        }
      }
    }

    if (!rawContent) return '';

    return this.cleanHtml(rawContent);
  }

  private cleanHtml(content: string): string {
    return content
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/(?:p|div|tr|td|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
