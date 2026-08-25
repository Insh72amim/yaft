import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { google } from 'googleapis';
import { PrismaService } from '../common/prisma.service';
import { CategoryRulesService } from '../category-rules/category-rules.service';
import { StatementCredentialCipher } from '../common/statement-credentials.service';
import { parseMultipleEmailAlerts, ParsedEmailTransaction, getAlertFingerprint } from './email-alert-parser';
import { AccountType } from '../common/constants/enums';
import { INSTITUTION_EMAIL_CONFIGS, getEmailConfigsForAccounts } from '@yaft/shared';

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

  async syncGmail(userId: string, dtoOrDays?: any, legacyEmailId?: string) {
    let days = 90;
    let emailId: string | undefined = undefined;
    let accountScope: 'ALL' | 'ALL_BANKS' | 'ALL_CARDS' | 'ALL_INVESTMENTS' | 'CUSTOM' = 'ALL';
    let targetAccountIds: string[] = [];

    if (typeof dtoOrDays === 'number') {
      days = dtoOrDays;
      emailId = legacyEmailId;
    } else if (dtoOrDays && typeof dtoOrDays === 'object') {
      days = dtoOrDays.days ?? 90;
      emailId = dtoOrDays.emailId;
      accountScope = dtoOrDays.accountScope ?? 'ALL';
      targetAccountIds = Array.isArray(dtoOrDays.targetAccountIds) ? dtoOrDays.targetAccountIds : [];
    }

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
    const [allUserAccounts, categories, userRules] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId, archived: false },
      }),
      this.prisma.category.findMany({ where: { userId } }),
      this.prisma.categoryRule.findMany({
        where: { userId },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    // Filter to only accounts supported by email ingestion (exclude UPI_LITE, EPFO, FIXED_DEPOSIT, LOAN)
    const emailSupportedAccounts = allUserAccounts.filter((a) => {
      if (a.type === 'UPI_LITE' || a.type === 'FIXED_DEPOSIT' || a.type === 'LOAN' || a.type === 'EPFO') return false;
      if (a.name.toLowerCase().includes('epfo') || a.institution?.toLowerCase().includes('epfo')) return false;
      if (a.name.toLowerCase().includes('-fd-') || a.name.toLowerCase().includes('loan')) return false;
      return true;
    });

    // Apply granular candidate account filtering based on accountScope / targetAccountIds
    let candidateAccounts = emailSupportedAccounts;
    if (accountScope === 'ALL_BANKS') {
      candidateAccounts = emailSupportedAccounts.filter((acc) =>
        [AccountType.BANK, AccountType.SAVINGS].includes(acc.type as any)
      );
    } else if (accountScope === 'ALL_CARDS') {
      candidateAccounts = emailSupportedAccounts.filter((acc) => acc.type === AccountType.CREDIT_CARD);
    } else if (accountScope === 'ALL_INVESTMENTS') {
      candidateAccounts = emailSupportedAccounts.filter((acc) =>
        acc.type === AccountType.MUTUAL_FUND ||
        acc.type === AccountType.STOCKS ||
        acc.name.toLowerCase().includes('mutual') ||
        acc.name.toLowerCase().includes('sip') ||
        acc.name.toLowerCase().includes('coin') ||
        acc.name.toLowerCase().includes('groww')
      );
    } else if (accountScope === 'CUSTOM' && targetAccountIds.length > 0) {
      candidateAccounts = emailSupportedAccounts.filter((acc) => targetAccountIds.includes(acc.id));
    }

    if (candidateAccounts.length === 0 && allUserAccounts.length > 0) {
      // If user filtered for a scope with 0 matching accounts, inform them gracefully
      return {
        success: true,
        message: `No active accounts matched the selected sync scope (${accountScope}).`,
        batchIds: [],
        scannedCount: 0,
        parsedCount: 0,
        stagedRowsCount: 0,
        summaries: [],
      };
    }

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

        // Build dynamic configuration-driven search query based on selected scope
        let query = '';
        if (accountScope === 'ALL_CARDS') {
          const cardConfigs = INSTITUTION_EMAIL_CONFIGS.filter((c) => c.accountType === AccountType.CREDIT_CARD);
          const senders = Array.from(new Set(cardConfigs.flatMap((c) => c.senders)));
          query = `from:(${senders.join(' OR ')}) (spent OR debited OR credited OR refund OR refunded OR reversal OR cashback OR "credit card" OR "card ending" OR "card ending with" OR "spent on your card" OR "transaction on your card" OR "amazon pay" OR "pixel" OR "card no" OR "card xx") after:${afterDateStr}`;
        } else if (accountScope === 'ALL_BANKS') {
          const bankConfigs = INSTITUTION_EMAIL_CONFIGS.filter((c) => c.accountType === AccountType.BANK);
          const senders = Array.from(new Set(bankConfigs.flatMap((c) => c.senders)));
          query = `from:(${senders.join(' OR ')}) (debited OR credited OR spent OR refund OR reversal OR alert OR transaction OR payment OR "a/c" OR "ending with" OR "XX" OR "INR" OR "Rs." OR "UPI" OR "NEFT" OR "IMPS") after:${afterDateStr}`;
        } else if (accountScope === 'ALL_INVESTMENTS') {
          const sipConfigs = INSTITUTION_EMAIL_CONFIGS.filter((c) => c.accountType === AccountType.MUTUAL_FUND);
          const senders = Array.from(new Set(sipConfigs.flatMap((c) => c.senders)));
          query = `from:(${senders.join(' OR ')}) (SIP OR "Mutual Fund" OR "allotted" OR "Folio" OR "NAV" OR "Purchase" OR "debited" OR "transaction") after:${afterDateStr}`;
        } else if (accountScope === 'CUSTOM') {
          const matchedConfigs = getEmailConfigsForAccounts(candidateAccounts);
          const allSenders = Array.from(new Set(matchedConfigs.flatMap((c) => c.senders)));
          const allKeywords = Array.from(new Set(matchedConfigs.flatMap((c) => c.queryKeywords || [])));
          if (allSenders.length > 0) {
            const senderFilter = `from:(${allSenders.join(' OR ')})`;
            const keywordFilter = allKeywords.length > 0
              ? `(${allKeywords.map((k) => k.includes(' ') ? `"${k}"` : k).join(' OR ')})`
              : '(debited OR credited OR spent OR refund OR reversal OR alert OR transaction OR payment OR "credit card" OR "a/c" OR "INR" OR "Rs.")';
            query = `${senderFilter} ${keywordFilter} after:${afterDateStr}`;
          } else {
            query = `(debited OR credited OR spent OR refund OR reversal OR alert OR transaction OR payment OR "credit card" OR "a/c" OR "INR" OR "Rs.") after:${afterDateStr}`;
          }
        } else {
          // Default ALL
          const allSenders = Array.from(new Set(INSTITUTION_EMAIL_CONFIGS.flatMap((c) => c.senders)));
          query = `from:(${allSenders.join(' OR ')}) (debited OR credited OR spent OR refund OR reversal OR alert OR transaction OR payment OR "credit card" OR "a/c" OR "INR" OR "Rs." OR "SIP" OR "Mutual Fund") after:${afterDateStr}`;
        }

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

        // Route alerts to filtered candidate user accounts
        const accountGroups = new Map<string, { account: any; alerts: ParsedEmailTransaction[] }>();

        for (const alert of extractedAlerts) {
          const matchedAccount = this.findMatchingAccount(candidateAccounts, alert, alert.rawSnippet);
          if (!matchedAccount) {
            this.logger.warn(`Skipping alert: No matching candidate account found in selected scope for type="${alert.accountType}", bank="${alert.bankName}", last4="${alert.accountLast4 || ''}", merchant="${alert.merchant}"`);
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
              alert.suggestedCategoryName,
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
    } else if (alert.accountType === AccountType.MUTUAL_FUND) {
      candidateAccounts = userAccounts.filter((acc) =>
        acc.type === AccountType.MUTUAL_FUND ||
        acc.type === AccountType.STOCKS ||
        acc.name.toLowerCase().includes('mutual') ||
        acc.name.toLowerCase().includes('sip') ||
        acc.name.toLowerCase().includes('coin') ||
        acc.name.toLowerCase().includes('groww') ||
        acc.name.toLowerCase().includes('zerodha')
      );
    } else {
      candidateAccounts = userAccounts.filter((acc) =>
        [AccountType.BANK, AccountType.SAVINGS, AccountType.CASH].includes(acc.type as any) &&
        acc.type !== AccountType.UPI_LITE
      );
    }

    if (candidateAccounts.length === 0) {
      return null;
    }

    // Helper to check if bank/institution matches
    const isInstitutionMatch = (acc: any, bName: string) => {
      const inst = (acc.institution || '').toLowerCase();
      const name = (acc.name || '').toLowerCase();
      const b = (bName || '').toLowerCase();
      if (!b || b === 'bank alert') return false;

      // Mutually exclusive bank checks
      const isSbiAlert = b.includes('sbi') || b.includes('state bank');
      if (isSbiAlert) return inst.includes('sbi') || name.includes('sbi') || inst.includes('state bank') || name.includes('state bank');

      const isAxisAlert = b.includes('axis');
      if (isAxisAlert) return inst.includes('axis') || name.includes('axis');

      const isHdfcAlert = b.includes('hdfc');
      if (isHdfcAlert) return inst.includes('hdfc') || name.includes('hdfc') || name.includes('pixel');

      const isIciciAlert = b.includes('icici');
      if (isIciciAlert) return inst.includes('icici') || name.includes('icici') || name.includes('amazon');

      const isKotakAlert = b.includes('kotak');
      if (isKotakAlert) return inst.includes('kotak') || name.includes('kotak');

      const isPnbAlert = b.includes('pnb') || b.includes('punjab');
      if (isPnbAlert) return inst.includes('pnb') || name.includes('pnb') || inst.includes('punjab') || name.includes('punjab');

      const isIdfcAlert = b.includes('idfc');
      if (isIdfcAlert) return inst.includes('idfc') || name.includes('idfc');

      const isIndusindAlert = b.includes('indusind');
      if (isIndusindAlert) return inst.includes('indusind') || name.includes('indusind');

      const isAmexAlert = b.includes('amex') || b.includes('american express');
      if (isAmexAlert) return inst.includes('amex') || name.includes('amex') || inst.includes('american express') || name.includes('american express');

      return (inst && (inst.includes(b) || b.includes(inst))) || name.includes(b);
    };

    // 1. Exact match on last4 digits in account name or institution
    if (last4) {
      const last4Match = candidateAccounts.find((acc) => {
        const name = (acc.name || '').toLowerCase();
        const isInstMatch = isInstitutionMatch(acc, bankName);
        if (!isInstMatch && candidateAccounts.length > 1) return false;
        return name.includes(last4) || name.includes(`••${last4}`) || name.includes(`xx${last4}`) || name.includes(`*${last4}`);
      });
      if (last4Match) return last4Match;

      // Also try last4 match without institution restriction if uniquely matching an account AND institution matches
      const anyLast4Matches = candidateAccounts.filter((acc) => {
        const name = (acc.name || '').toLowerCase();
        return name.includes(last4) || name.includes(`••${last4}`) || name.includes(`xx${last4}`) || name.includes(`*${last4}`);
      });
      if (anyLast4Matches.length === 1 && isInstitutionMatch(anyLast4Matches[0], bankName)) {
        return anyLast4Matches[0];
      }
    }

    // 2. Card / Account product or brand keyword matching in email snippet
    const productMatch = candidateAccounts.find((acc) => {
      const name = (acc.name || '').toLowerCase();
      const isInstMatch = isInstitutionMatch(acc, bankName);
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
    const instMatches = candidateAccounts.filter((acc) => isInstitutionMatch(acc, bankName));

    if (instMatches.length === 1) {
      return instMatches[0];
    } else if (instMatches.length > 1) {
      if (text.includes('rupay') || text.includes('upi')) {
        const rupayAcc = instMatches.find((a) => a.name.toLowerCase().includes('rupay') || a.type === AccountType.UPI_LITE);
        if (rupayAcc) return rupayAcc;
      }
      return instMatches[0];
    }

    // Only return candidateAccounts[0] if bankName is generic non-conflicting placeholder
    if (candidateAccounts.length === 1 && (bankName === 'bank alert' || bankName === 'mutual fund')) {
      return candidateAccounts[0];
    }

    return null;
  }
}
