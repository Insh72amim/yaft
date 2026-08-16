import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/common/prisma.service';
import { BackupService } from '../../src/backup/backup.service';
import { GoogleDriveService } from '../../src/backup/google-drive.service';
import { StatementCredentialCipher } from '../../src/common/statement-credentials.service';

process.env.YAFT_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;
  let prisma: any;
  let configService: any;
  let backupService: any;
  let cipher: StatementCredentialCipher;

  beforeEach(() => {
    cipher = new StatementCredentialCipher();
    const mockEncrypted = cipher.encrypt('user-1', 'mock-refresh-token-12345');

    prisma = {
      googleDriveConfig: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user-1',
          email: 'user@example.com',
          folderId: 'folder-123',
          fileId: 'file-123',
          refreshCipher: mockEncrypted.ciphertext,
          refreshIv: mockEncrypted.iv,
          refreshTag: mockEncrypted.authTag,
          refreshKeyVersion: mockEncrypted.keyVersion,
          autoBackupEnabled: true,
          autoPassphraseCipher: null,
          autoPassphraseIv: null,
          autoPassphraseTag: null,
          lastBackupAt: new Date('2026-08-16T12:00:00Z'),
          lastBackupStatus: 'SUCCESS',
        }),
        upsert: jest.fn().mockResolvedValue({
          email: 'user@example.com',
          autoBackupEnabled: true,
        }),
        update: jest.fn().mockResolvedValue({
          autoBackupEnabled: true,
          autoPassphraseCipher: Buffer.from('cipher'),
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    configService = {
      get: jest.fn((key) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'mock-client-id';
        if (key === 'GOOGLE_CLIENT_SECRET') return 'mock-client-secret';
        if (key === 'GOOGLE_DRIVE_REDIRECT_URI') return 'http://localhost:3000/settings';
        return null;
      }),
    };

    backupService = {
      exportBackup: jest.fn().mockResolvedValue(Buffer.from('YAFT_BACKUP_V1_MOCK_ENCRYPTED_PAYLOAD')),
      restoreBackup: jest.fn().mockResolvedValue({
        accountsRestored: 5,
        transactionsRestored: 100,
        categoriesRestored: 10,
        documentsRestored: 2,
        salariesRestored: 1,
        organizationsRestored: 1,
        holdingsRestored: 10,
        filesRestored: 3,
      }),
    };

    service = new GoogleDriveService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      backupService as unknown as BackupService,
    );
  });

  describe('getAuthUrl', () => {
    it('generates a Google OAuth authorization URL with drive.file scope', async () => {
      const res = await service.getAuthUrl('user-1');
      expect(res.configured).toBe(true);
      expect(res.authUrl).toContain('accounts.google.com');
      expect(res.authUrl).toContain('drive.file');
      expect(res.authUrl).toContain('userinfo.email');
    });

    it('returns configured: false when credentials are not in environment', async () => {
      configService.get.mockReturnValue(null);
      const res = await service.getAuthUrl('user-1');
      expect(res.configured).toBe(false);
      expect(res.authUrl).toBeNull();
    });
  });

  describe('getConfig', () => {
    it('returns connected config details for user', async () => {
      const config = await service.getConfig('user-1');
      expect(config.connected).toBe(true);
      expect(config.email).toBe('user@example.com');
      expect(config.autoBackupEnabled).toBe(true);
      expect(config.lastBackupStatus).toBe('SUCCESS');
    });

    it('returns connected: false if no config exists', async () => {
      prisma.googleDriveConfig.findUnique.mockResolvedValue(null);
      const config = await service.getConfig('user-unknown');
      expect(config.connected).toBe(false);
      expect(config.email).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('updates autoBackupEnabled and stores encrypted passphrase', async () => {
      const res = await service.updateSettings('user-1', true, 'MySecretPassphrase123');
      expect(res.success).toBe(true);
      expect(prisma.googleDriveConfig.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: expect.objectContaining({
          autoBackupEnabled: true,
          autoPassphraseCipher: expect.any(Buffer),
        }),
      });
    });

    it('throws if passphrase is less than 6 characters', async () => {
      await expect(service.updateSettings('user-1', true, '12345')).rejects.toThrow(BadRequestException);
    });
  });

  describe('disconnect', () => {
    it('deletes googleDriveConfig record for the user', async () => {
      const res = await service.disconnect('user-1');
      expect(res.success).toBe(true);
      expect(prisma.googleDriveConfig.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });
});
