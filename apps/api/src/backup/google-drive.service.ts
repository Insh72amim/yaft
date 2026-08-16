import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialCipher } from '../common/statement-credentials.service';
import { BackupService } from './backup.service';

export interface DriveRevisionItem {
  id: string;
  modifiedTime: string;
  size: number;
  keepForever?: boolean;
}

function toBuffer(val: any): Buffer | null {
  if (val === null || val === undefined) return null;
  if (Buffer.isBuffer(val)) return val;
  if (val instanceof Uint8Array || ArrayBuffer.isView(val)) {
    const view = val as Uint8Array;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  }
  return Buffer.from(val);
}

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private readonly cipher = new StatementCredentialCipher();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly backupService: BackupService,
  ) {}

  private getOAuthClient(redirectUriOverride?: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const defaultRedirect = this.configService.get<string>('GOOGLE_DRIVE_REDIRECT_URI') || 'http://localhost:3000/settings';
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
      prompt: 'consent', // Ensure refresh token is always returned
      scope: [
        'https://www.googleapis.com/auth/drive.file',
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

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;

      if (!email) {
        throw new BadRequestException('Could not retrieve email address from Google Account.');
      }

      const existingConfig = await this.prisma.googleDriveConfig.findUnique({ where: { userId } });
      const refreshTokenToUse = tokens.refresh_token || (existingConfig ? this.decryptRefreshToken(userId, existingConfig) : null);

      if (!refreshTokenToUse) {
        throw new BadRequestException('Failed to obtain a refresh token for Google Drive. Please grant consent again.');
      }

      const encrypted = this.cipher.encrypt(userId, refreshTokenToUse);

      const saved = await this.prisma.googleDriveConfig.upsert({
        where: { userId },
        create: {
          userId,
          email: email.toLowerCase().trim(),
          refreshCipher: Buffer.from(encrypted.ciphertext),
          refreshIv: Buffer.from(encrypted.iv),
          refreshTag: Buffer.from(encrypted.authTag),
          refreshKeyVersion: encrypted.keyVersion,
          autoBackupEnabled: true,
        },
        update: {
          email: email.toLowerCase().trim(),
          refreshCipher: Buffer.from(encrypted.ciphertext),
          refreshIv: Buffer.from(encrypted.iv),
          refreshTag: Buffer.from(encrypted.authTag),
          refreshKeyVersion: encrypted.keyVersion,
        },
      });

      return {
        success: true,
        email: saved.email,
        autoBackupEnabled: saved.autoBackupEnabled,
      };
    } catch (err: any) {
      this.logger.error(`Failed to complete Google Drive OAuth exchange: ${err.message}`, err.stack);
      throw new BadRequestException(err.message || 'Google Drive authorization failed.');
    }
  }

  private decryptRefreshToken(userId: string, config: { refreshCipher: any; refreshIv: any; refreshTag: any; refreshKeyVersion: number }): string {
    return this.cipher.decrypt(userId, {
      ciphertext: toBuffer(config.refreshCipher)!,
      iv: toBuffer(config.refreshIv)!,
      authTag: toBuffer(config.refreshTag)!,
      keyVersion: config.refreshKeyVersion,
    });
  }

  private decryptAutoPassphrase(userId: string, config: { autoPassphraseCipher: any; autoPassphraseIv: any; autoPassphraseTag: any }): string | null {
    const cipher = toBuffer(config.autoPassphraseCipher);
    const iv = toBuffer(config.autoPassphraseIv);
    const tag = toBuffer(config.autoPassphraseTag);
    if (!cipher || !iv || !tag) {
      return null;
    }
    try {
      return this.cipher.decrypt(userId, {
        ciphertext: cipher,
        iv,
        authTag: tag,
        keyVersion: 1,
      });
    } catch {
      return null;
    }
  }

  async getAuthenticatedDriveClient(userId: string) {
    const config = await this.prisma.googleDriveConfig.findUnique({ where: { userId } });
    if (!config) {
      throw new BadRequestException('Google Drive is not connected for this account.');
    }

    const oauth2Client = this.getOAuthClient();
    if (!oauth2Client) {
      throw new BadRequestException('Google OAuth client credentials not set in environment.');
    }

    const refreshToken = this.decryptRefreshToken(userId, config);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    return {
      drive: google.drive({ version: 'v3', auth: oauth2Client }),
      config,
    };
  }

  async getConfig(userId: string) {
    const config = await this.prisma.googleDriveConfig.findUnique({ where: { userId } });
    if (!config) {
      return {
        connected: false,
        email: null,
        autoBackupEnabled: false,
        hasAutoPassphrase: false,
        lastBackupAt: null,
        lastBackupStatus: null,
        lastBackupError: null,
      };
    }

    return {
      connected: true,
      email: config.email,
      autoBackupEnabled: config.autoBackupEnabled,
      hasAutoPassphrase: Boolean(config.autoPassphraseCipher),
      lastBackupAt: config.lastBackupAt,
      lastBackupStatus: config.lastBackupStatus,
      lastBackupError: config.lastBackupError,
    };
  }

  async updateSettings(userId: string, autoBackupEnabled?: boolean, autoPassphrase?: string) {
    const config = await this.prisma.googleDriveConfig.findUnique({ where: { userId } });
    if (!config) {
      throw new BadRequestException('Google Drive is not connected.');
    }

    const updateData: any = {};
    if (typeof autoBackupEnabled === 'boolean') {
      updateData.autoBackupEnabled = autoBackupEnabled;
    }

    if (typeof autoPassphrase === 'string') {
      if (autoPassphrase.trim().length === 0) {
        updateData.autoPassphraseCipher = null;
        updateData.autoPassphraseIv = null;
        updateData.autoPassphraseTag = null;
      } else {
        if (autoPassphrase.trim().length < 6) {
          throw new BadRequestException('Passphrase must be at least 6 characters long.');
        }
        const encrypted = this.cipher.encrypt(userId, autoPassphrase.trim());
        updateData.autoPassphraseCipher = Buffer.from(encrypted.ciphertext);
        updateData.autoPassphraseIv = Buffer.from(encrypted.iv);
        updateData.autoPassphraseTag = Buffer.from(encrypted.authTag);
      }
    }

    const updated = await this.prisma.googleDriveConfig.update({
      where: { userId },
      data: updateData,
    });

    return {
      success: true,
      autoBackupEnabled: updated.autoBackupEnabled,
      hasAutoPassphrase: Boolean(updated.autoPassphraseCipher),
    };
  }

  async uploadBackup(userId: string, passphraseOverride?: string) {
    const { drive, config } = await this.getAuthenticatedDriveClient(userId);

    const passphrase = passphraseOverride || this.decryptAutoPassphrase(userId, config);
    if (!passphrase || passphrase.trim().length < 6) {
      throw new BadRequestException('A backup encryption passphrase is required to upload to Google Drive.');
    }

    this.logger.log(`Starting Google Drive backup export for user ${userId}...`);
    const encryptedBuffer = await this.backupService.exportBackup(userId, passphrase.trim());

    try {
      // 1. Locate or create "YAFT Backups" folder
      let folderId = config.folderId;
      if (!folderId) {
        const folderSearch = await drive.files.list({
          q: "mimeType = 'application/vnd.google-apps.folder' and name = 'YAFT Backups' and trashed = false",
          fields: 'files(id, name)',
          spaces: 'drive',
        });

        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
          folderId = folderSearch.data.files[0].id!;
        } else {
          const createdFolder = await drive.files.create({
            requestBody: {
              name: 'YAFT Backups',
              mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
          });
          folderId = createdFolder.data.id!;
        }
      }

      // 2. Locate or create the "yaft-backup.yaft-backup" file inside the folder
      let fileId = config.fileId;
      if (!fileId) {
        const fileSearch = await drive.files.list({
          q: `'${folderId}' in parents and name = 'yaft-backup.yaft-backup' and trashed = false`,
          fields: 'files(id, name)',
          spaces: 'drive',
        });

        if (fileSearch.data.files && fileSearch.data.files.length > 0) {
          fileId = fileSearch.data.files[0].id!;
        }
      }

      let revisionDetails: any;

      if (!fileId) {
        // Create initial file
        const createdFile = await drive.files.create({
          requestBody: {
            name: 'yaft-backup.yaft-backup',
            parents: [folderId!],
            description: 'Automated encrypted YAFT financial ledger backup archive.',
          },
          media: {
            mimeType: 'application/octet-stream',
            body: Readable.from(encryptedBuffer),
          },
          fields: 'id, name, size, modifiedTime, headRevisionId',
        });

        fileId = createdFile.data.id!;
        revisionDetails = {
          fileId,
          revisionId: createdFile.data.headRevisionId || 'initial',
          size: encryptedBuffer.length,
          modifiedTime: createdFile.data.modifiedTime || new Date().toISOString(),
        };
      } else {
        // Overwrite and create new permanent revision
        const updatedFile = await drive.files.update({
          fileId,
          media: {
            mimeType: 'application/octet-stream',
            body: Readable.from(encryptedBuffer),
          },
          fields: 'id, name, size, modifiedTime, headRevisionId',
        });

        const headRevId = updatedFile.data.headRevisionId;
        if (headRevId) {
          try {
            await drive.revisions.update({
              fileId,
              revisionId: headRevId,
              requestBody: { keepForever: true },
            });
          } catch {
            // Non-fatal if keepForever update fails
          }
        }

        revisionDetails = {
          fileId,
          revisionId: headRevId || 'latest',
          size: encryptedBuffer.length,
          modifiedTime: updatedFile.data.modifiedTime || new Date().toISOString(),
        };
      }

      // 3. Update database config with latest status
      await this.prisma.googleDriveConfig.update({
        where: { userId },
        data: {
          folderId,
          fileId,
          lastBackupAt: new Date(),
          lastBackupStatus: 'SUCCESS',
          lastBackupError: null,
        },
      });

      this.logger.log(`Google Drive backup uploaded successfully for user ${userId} (${encryptedBuffer.length} bytes)`);

      return {
        success: true,
        byteSize: encryptedBuffer.length,
        ...revisionDetails,
      };
    } catch (err: any) {
      this.logger.error(`Failed to upload backup to Google Drive: ${err.message}`, err.stack);
      await this.prisma.googleDriveConfig.update({
        where: { userId },
        data: {
          lastBackupStatus: 'ERROR',
          lastBackupError: err.message || 'Google Drive upload error',
        },
      });
      throw new BadRequestException(`Google Drive upload failed: ${err.message}`);
    }
  }

  async listRevisions(userId: string): Promise<DriveRevisionItem[]> {
    const { drive, config } = await this.getAuthenticatedDriveClient(userId);

    if (!config.fileId) {
      return [];
    }

    try {
      const response = await drive.revisions.list({
        fileId: config.fileId,
        fields: 'revisions(id, mimeType, modifiedTime, size, keepForever)',
      });

      const revisions = (response.data.revisions || []).map((rev) => ({
        id: rev.id!,
        modifiedTime: rev.modifiedTime || new Date().toISOString(),
        size: Number(rev.size || 0),
        keepForever: Boolean(rev.keepForever),
      }));

      // Sort newest to oldest
      return revisions.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
    } catch (err: any) {
      this.logger.warn(`Could not list revisions for file ${config.fileId}: ${err.message}`);
      return [];
    }
  }

  async restoreFromRevision(userId: string, passphrase: string, revisionId?: string) {
    if (!passphrase || passphrase.trim().length === 0) {
      throw new BadRequestException('Passphrase is required to restore cloud backup.');
    }

    const { drive, config } = await this.getAuthenticatedDriveClient(userId);

    if (!config.fileId) {
      throw new NotFoundException('No backup file found in Google Drive.');
    }

    this.logger.log(`Downloading cloud backup from Google Drive (fileId: ${config.fileId}, rev: ${revisionId || 'latest'})...`);

    let arrayBuffer: ArrayBuffer;
    try {
      if (revisionId && revisionId !== 'latest' && revisionId !== 'initial') {
        const res = await drive.revisions.get(
          { fileId: config.fileId, revisionId, alt: 'media' },
          { responseType: 'arraybuffer' },
        );
        arrayBuffer = res.data as ArrayBuffer;
      } else {
        const res = await drive.files.get(
          { fileId: config.fileId, alt: 'media' },
          { responseType: 'arraybuffer' },
        );
        arrayBuffer = res.data as ArrayBuffer;
      }
    } catch (err: any) {
      this.logger.error(`Failed to download revision from Google Drive: ${err.message}`);
      throw new BadRequestException(`Failed to download backup revision from Google Drive: ${err.message}`);
    }

    const backupBuffer = Buffer.from(arrayBuffer);
    this.logger.log(`Downloaded cloud backup: ${backupBuffer.length} bytes. Restoring into ledger...`);

    const result = await this.backupService.restoreBackup(userId, passphrase.trim(), backupBuffer);
    return {
      success: true,
      message: 'Cloud backup restored successfully.',
      ...result,
    };
  }

  async disconnect(userId: string) {
    await this.prisma.googleDriveConfig.deleteMany({ where: { userId } });
    return { success: true, message: 'Google Drive disconnected successfully.' };
  }
}
