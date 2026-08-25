import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { google } from 'googleapis';
import { PrismaService } from '../common/prisma.service';
import { CategoryRulesService } from '../category-rules/category-rules.service';
import { StatementCredentialCipher } from '../common/statement-credentials.service';
import { parseMultipleEmailAlerts, ParsedEmailTransaction, getAlertFingerprint } from './email-alert-parser';
import { AccountType } from '../common/constants/enums';

@Injectable()
export class GoogleGmailService {
  private readonly logger = new Logger(GoogleGmailService.name);
  private readonly cipher = new StatementCredentialCipher();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly categoryRulesService: CategoryRulesService,
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

      // Fetch user profile email
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;

      if (!email) {
        throw new BadRequestException('Could not retrieve email address from Google Account.');
      }

      const emailLower = email.toLowerCase().trim();
      const existingConfig = await this.prisma.googleEmailConfig.findFirst({
        where: { userId, email: emailLower },
      });

      const refreshTokenToUse = tokens.refresh_token || (existingConfig ? this.decryptRefreshToken(userId, existingConfig) : null);

      if (!refreshTokenToUse) {
        throw new BadRequestException('Failed to secure a refresh token for background Gmail sync. Please grant consent again.');
      }

      const encrypted = this.cipher.encrypt(userId, refreshTokenToUse);

      const dataPayload = {
        email: emailLower,
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
        message: `Successfully connected Gmail account (${emailLower}). Ready for bank & credit card alert ingestion.`,
        email: emailLower,
      };
    } catch (err: any) {
      this.logger.error(`Google OAuth callback failed: ${err.message}`, err.stack);
      throw new BadRequestException(`Google authorization failed: ${err.message || err}`);
    }
  }

  async getConfig(userId: string) {
    const configs = await this.prisma.googleEmailConfig.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        lastSyncAt: true,
        syncStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const isClientConfigured = !!(this.configService.get('GOOGLE_CLIENT_ID') && this.configService.get('GOOGLE_CLIENT_SECRET'));

    if (configs.length === 0) {
      return {
        connected: false,
        oauthServerConfigured: isClientConfigured,
        configs: [],
      };
    }

    return {
      connected: true,
      oauthServerConfigured: isClientConfigured,
      email: configs[0].email,
      lastSyncAt: configs[0].lastSyncAt,
      syncStatus: configs[0].syncStatus,
      createdAt: configs[0].createdAt,
      configs,
    };
  }

  async syncGmail(userId: string, days?: number, emailId?: string) {
    let configs = [];
    if (emailId) {
      const cfg = await this.prisma.googleEmailConfig.findFirst({ where: { id: emailId, userId } });
      if (cfg) configs.push(cfg);
    } else {
      configs = await this.prisma.googleEmailConfig.findMany({ where: { userId } });
    }

    if (configs.length === 0) {
      throw new BadRequestException('No connected Gmail accounts found. Please click "Connect Gmail" first.');
    }

    const syncDays = typeof days === 'number' && days > 0 ? days : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - syncDays);
    const afterDateStr = `${cutoffDate.getFullYear()}/${String(cutoffDate.getMonth() + 1).padStart(2, '0')}/${String(cutoffDate.getDate()).padStart(2, '0')}`;

    const allBatchIds: string[] = [];
    let grandTotalScanned = 0;
    let grandTotalParsed = 0;
    let grandTotalStaged = 0;
    const emailSummaries: string[] = [];

    // Fetch user's active accounts, categories, and category rules once for all Gmail accounts
    const [userAccounts, categories, userRules] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId, archived: false },
      }),
      this.prisma.category.findMany({ where: { userId } }),
      this.prisma.categoryRule.findMany({
        where: { userId },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    for (const config of configs) {
      const refreshToken = this.decryptRefreshToken(userId, config);
      const oauth2Client = this.getOAuthClient();

      if (!oauth2Client || !refreshToken) {
        this.logger.warn(`Unable to decrypt refresh token for ${config.email}`);
        continue;
      }

      oauth2Client.setCredentials({ refresh_token: refreshToken });

      try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Fast server-side filtered search for transaction emails across all major Indian banks & cards
        const baseBankFilter = 'from:(hdfcbank.net OR hdfcbank.com OR hdfc.bank.in OR icicibank.com OR icicibank.co.in OR icici.bank.in OR axisbank.com OR axis.bank.in OR sbi.co.in OR sbi.bank.in OR kotak.com OR kotak.bank.in OR americanexpress.com OR pnb.co.in OR pnb.bank.in OR indusind.com OR idfcfirstbank.com OR rblbank.com OR standardchartered.co.in OR citibank.com OR "ICICI Bank" OR "Axis Bank" OR "HDFC Bank" OR "State Bank of India" OR "Punjab National Bank")';
        const keywordsFilter = '(debited OR credited OR spent OR alert OR transaction OR payment OR "credit card" OR "a/c" OR "ending with" OR "XX" OR "INR" OR "Rs.")';
        const query = `${baseBankFilter} ${keywordsFilter} after:${afterDateStr}`;

        let pageToken: string | undefined = undefined;
        const messages: { id?: string | null; threadId?: string | null }[] = [];
        do {
          const listRes: any = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 100,
            pageToken,
          });
          if (listRes.data.messages && listRes.data.messages.length > 0) {
            messages.push(...listRes.data.messages);
          }
          pageToken = listRes.data.nextPageToken || undefined;
        } while (pageToken && messages.length < 500);

        grandTotalScanned += messages.length;
        const extractedAlerts: ParsedEmailTransaction[] = [];

        // Parallel batch fetching in chunks of 10
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
            const dateHeader = headers.find((h: any) => h.name?.toLowerCase() === 'date')?.value;
            const internalDate = msgDetail.data.internalDate ? new Date(Number(msgDetail.data.internalDate)) : (dateHeader ? new Date(dateHeader) : undefined);
            const validEmailDate = internalDate && !isNaN(internalDate.getTime()) ? internalDate : undefined;

            const alerts = parseMultipleEmailAlerts(bodyText + ' ' + snippet, `${from} ${subject}`);
            for (const alert of alerts) {
              alert.emailMessageId = msgDetail.data.id || undefined;
              alert.emailSubject = subject || undefined;
              alert.emailSender = from || undefined;
              alert.emailDate = validEmailDate;
              extractedAlerts.push(alert);
            }
          }
        }

        // Update sync timestamp
        await this.prisma.googleEmailConfig.update({
          where: { id: config.id },
          data: { lastSyncAt: new Date(), syncStatus: 'ACTIVE' },
        });

        grandTotalParsed += extractedAlerts.length;

        if (extractedAlerts.length === 0) {
          emailSummaries.push(`${config.email}: 0 alerts from ${messages.length} email(s)`);
          continue;
        }

        // Route alerts to existing user accounts (both Bank accounts and Credit Cards)
        const accountGroups = new Map<string, { account: any; alerts: ParsedEmailTransaction[] }>();

        for (const alert of extractedAlerts) {
          const matchedAccount = this.findMatchingAccount(userAccounts, alert, alert.rawSnippet);
          if (!matchedAccount) {
            this.logger.warn(`Skipping alert: No matching account found for type="${alert.accountType}", bank="${alert.bankName}", last4="${alert.accountLast4 || ''}", merchant="${alert.merchant}"`);
            continue;
          }

          if (!accountGroups.has(matchedAccount.id)) {
            accountGroups.set(matchedAccount.id, { account: matchedAccount, alerts: [] });
          }
          accountGroups.get(matchedAccount.id)!.alerts.push(alert);
        }

        let configStagedCount = 0;

        for (const [accountId, { account, alerts: groupAlerts }] of accountGroups.entries()) {
          const sampleAlert = groupAlerts[0];
          const targetType = account.type;
          const bankName = account.institution || sampleAlert.bankName;
          const last4 = sampleAlert.accountLast4;

          const existingTxFingerprints = new Set(
            (await this.prisma.transaction.findMany({ where: { accountId: account.id }, select: { fingerprint: true } })).map((x) => x.fingerprint)
          );
          const existingStagedFingerprints = new Set(
            (await this.prisma.stagedTransaction.findMany({ where: { batch: { accountId: account.id, status: 'REVIEW' } }, select: { fingerprint: true } })).map((x) => x.fingerprint)
          );

          const stagedRows = groupAlerts.map((alert, idx) => {
            const fingerprint = getAlertFingerprint(account.id, alert);
            const isDuplicate = existingTxFingerprints.has(fingerprint) || existingStagedFingerprints.has(fingerprint);
            existingTxFingerprints.add(fingerprint);
            const descriptionRaw = `${alert.merchant} [${alert.bankName}${alert.accountLast4 ? ' ••' + alert.accountLast4 : ''}]`;
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
              emailSubject: alert.emailSubject ?? null,
              emailSender: alert.emailSender ?? null,
              emailDate: alert.emailDate ?? null,
              emailSnippet: alert.rawSnippet ?? null,
            };
          });

          const newRowsCount = stagedRows.filter((r) => !r.isDuplicate).length;

          if (newRowsCount === 0 && stagedRows.length > 0) {
            continue;
          }

          const fileHash = createHash('sha256')
            .update(accountId + stagedRows.map((r) => r.fingerprint).join(';'))
            .digest('hex');

          const existingPendingBatch = await this.prisma.importBatch.findFirst({
            where: { accountId: account.id, fileHash, status: 'REVIEW' },
          });
          if (existingPendingBatch) {
            allBatchIds.push(existingPendingBatch.id);
            continue;
          }

          const cleanBankSlug = (account.institution || bankName).replace(/[^a-zA-Z0-9]/g, '-');
          const batchFilename = `gmail-sync-${cleanBankSlug}-${targetType}-${last4 || 'all'}-${new Date().toISOString().slice(0, 10)}.txt`;

          const batch = await this.prisma.importBatch.create({
            data: {
              userId,
              accountId: account.id,
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

          allBatchIds.push(batch.id);
          const addedCount = stagedRows.filter((r) => !r.isDuplicate).length;
          grandTotalStaged += addedCount;
          configStagedCount += addedCount;
        }

        emailSummaries.push(`${config.email}: ${configStagedCount} new alert(s) from ${messages.length} email(s)`);
      } catch (err: any) {
        this.logger.error(`Gmail sync failed for ${config.email}: ${err.message}`, err.stack);
        await this.prisma.googleEmailConfig.update({
          where: { id: config.id },
          data: { syncStatus: 'ERROR' },
        });
      }
    }

    await this.prisma.emailSyncLog.create({
      data: {
        userId,
        status: 'SUCCESS',
        emailsScanned: grandTotalScanned,
        alertsParsed: grandTotalParsed,
        transactionsAdded: grandTotalStaged,
        sourceSnippet: `Synced ${configs.length} Gmail account(s) for past ${syncDays} days: ${emailSummaries.join('; ')}`,
      },
    });

    const summaryText = grandTotalStaged > 0
      ? `Successfully ingested ${grandTotalStaged} new alert(s) across ${configs.length} connected Gmail account(s) for past ${syncDays} days!`
      : `Scanned ${grandTotalScanned} email(s) across ${configs.length} Gmail account(s) (past ${syncDays} days). No new alerts pending import.`;

    return {
      success: true,
      message: summaryText,
      batchIds: allBatchIds,
      scannedCount: grandTotalScanned,
      parsedCount: grandTotalParsed,
      stagedRowsCount: grandTotalStaged,
      summaries: emailSummaries,
    };
  }

  async disconnect(userId: string, emailId?: string) {
    if (emailId) {
      const config = await this.prisma.googleEmailConfig.findFirst({ where: { id: emailId, userId } });
      if (!config) return { success: true, message: 'Specified Gmail account not found.' };

      await this.prisma.googleEmailConfig.delete({ where: { id: config.id } });
      return { success: true, message: `Disconnected Gmail account (${config.email}).` };
    }

    const configs = await this.prisma.googleEmailConfig.findMany({ where: { userId } });
    if (configs.length === 0) return { success: true, message: 'No connected Gmail accounts found.' };

    await this.prisma.googleEmailConfig.deleteMany({ where: { userId } });
    return { success: true, message: `Disconnected ${configs.length} Gmail account(s).` };
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
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          rawContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }
      if (!rawContent) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/html' && part.body && part.body.data) {
            rawContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      }
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
      .replace(/&#8377;?/gi, '₹')
      .replace(/&#x20B9;?/gi, '₹')
      .replace(/&inr;?/gi, '₹')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findMatchingAccount(userAccounts: any[], alert: ParsedEmailTransaction, rawSnippetText?: string): any | null {
    const bankName = (alert.bankName || '').toLowerCase();
    const last4 = alert.accountLast4 ? alert.accountLast4.toLowerCase() : '';
    const text = (rawSnippetText || '').toLowerCase();

    // Filter candidate user accounts matching the alert type
    let candidateAccounts: any[] = [];
    if (alert.accountType === AccountType.CREDIT_CARD) {
      candidateAccounts = userAccounts.filter((acc) => acc.type === AccountType.CREDIT_CARD);
    } else {
      candidateAccounts = userAccounts.filter((acc) =>
        [AccountType.BANK, AccountType.SAVINGS, AccountType.UPI_LITE, AccountType.CASH].includes(acc.type as any)
      );
      if (candidateAccounts.length === 0) {
        candidateAccounts = userAccounts;
      }
    }

    if (candidateAccounts.length === 0) {
      return null;
    }

    // 1. Exact match on last4 digits in account name or institution
    if (last4) {
      const last4Match = candidateAccounts.find((acc) => {
        const name = (acc.name || '').toLowerCase();
        const inst = (acc.institution || '').toLowerCase();
        const isInstMatch = inst.includes(bankName) || bankName.includes(inst) || name.includes(bankName);
        if (!isInstMatch && candidateAccounts.length > 1) return false;
        return name.includes(last4) || name.includes(`••${last4}`) || name.includes(`xx${last4}`) || name.includes(`*${last4}`);
      });
      if (last4Match) return last4Match;

      // Also try last4 match without institution restriction if uniquely matching an account
      const anyLast4Matches = candidateAccounts.filter((acc) => {
        const name = (acc.name || '').toLowerCase();
        return name.includes(last4) || name.includes(`••${last4}`) || name.includes(`xx${last4}`) || name.includes(`*${last4}`);
      });
      if (anyLast4Matches.length === 1) return anyLast4Matches[0];
    }

    // 2. Card / Account product or brand keyword matching in email snippet
    const productMatch = candidateAccounts.find((acc) => {
      const name = (acc.name || '').toLowerCase();
      const inst = (acc.institution || '').toLowerCase();
      const isInstMatch = inst.includes(bankName) || bankName.includes(inst);
      if (!isInstMatch && candidateAccounts.length > 1) return false;

      if (name.includes('flipkart') && text.includes('flipkart')) return true;
      if (name.includes('amazon') && (text.includes('amazon') || text.includes('amz'))) return true;
      if (name.includes('pixel') && text.includes('pixel')) return true;
      if ((name.includes('mmt') || name.includes('makemytrip')) && (text.includes('makemytrip') || text.includes('mmt'))) return true;
      if (name.includes('neo') && text.includes('neo')) return true;
      if (name.includes('rewards') && text.includes('reward')) return true;
      if (name.length > 3 && text.includes(name)) return true;
      return false;
    });
    if (productMatch) return productMatch;

    // 3. Institution match
    const instMatches = candidateAccounts.filter((acc) => {
      const inst = (acc.institution || '').toLowerCase();
      const name = (acc.name || '').toLowerCase();
      return (inst && (inst.includes(bankName) || bankName.includes(inst))) || name.includes(bankName);
    });

    if (instMatches.length === 1) {
      return instMatches[0];
    } else if (instMatches.length > 1) {
      if (text.includes('rupay') || text.includes('upi')) {
        const rupayAcc = instMatches.find((a) => a.name.toLowerCase().includes('rupay') || a.type === AccountType.UPI_LITE);
        if (rupayAcc) return rupayAcc;
      }
      return instMatches[0];
    }

    if (candidateAccounts.length === 1) {
      return candidateAccounts[0];
    }

    return null;
  }
}
