import { BackupSchedulerService } from '../../src/backup/backup-scheduler.service';
import { PrismaService } from '../../src/common/prisma.service';
import { GoogleDriveService } from '../../src/backup/google-drive.service';
import { GoogleGmailService } from '../../src/email-ingestion/google-gmail.service';

describe('BackupSchedulerService', () => {
  let scheduler: BackupSchedulerService;
  let prisma: any;
  let googleDriveService: any;
  let googleGmailService: any;

  beforeEach(() => {
    prisma = {
      googleDriveConfig: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            autoBackupEnabled: true,
            autoPassphraseCipher: Buffer.from('cipher'),
            lastBackupAt: new Date('2026-08-10T00:00:00Z'),
          },
        ]),
      },
      googleEmailConfig: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            email: 'user@example.com',
            syncStatus: 'ACTIVE',
            lastSyncAt: new Date('2026-08-10T00:00:00Z'),
          },
        ]),
      },
    };

    googleDriveService = {
      uploadBackup: jest.fn().mockResolvedValue({ success: true }),
    };

    googleGmailService = {
      syncGmail: jest.fn().mockResolvedValue({
        success: true,
        message: 'Successfully scanned 10 emails and parsed 2 transactions.',
      }),
    };

    scheduler = new BackupSchedulerService(
      prisma as unknown as PrismaService,
      googleDriveService as unknown as GoogleDriveService,
      googleGmailService as unknown as GoogleGmailService,
    );
  });

  afterEach(() => {
    scheduler.onApplicationShutdown();
  });

  it('runs daily backup when not backed up today', async () => {
    await scheduler.checkAndRunDailyBackups();
    expect(googleDriveService.uploadBackup).toHaveBeenCalledWith('user-1');
  });

  it('skips daily backup if already backed up today', async () => {
    prisma.googleDriveConfig.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        autoBackupEnabled: true,
        autoPassphraseCipher: Buffer.from('cipher'),
        lastBackupAt: new Date(), // Today
      },
    ]);

    await scheduler.checkAndRunDailyBackups();
    expect(googleDriveService.uploadBackup).not.toHaveBeenCalled();
  });

  it('runs daily Gmail sync when not synced today', async () => {
    await scheduler.checkAndRunDailyGmailSync();
    expect(googleGmailService.syncGmail).toHaveBeenCalledWith('user-1', 7);
  });

  it('skips daily Gmail sync if already synced today', async () => {
    prisma.googleEmailConfig.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        email: 'user@example.com',
        syncStatus: 'ACTIVE',
        lastSyncAt: new Date(), // Today
      },
    ]);

    await scheduler.checkAndRunDailyGmailSync();
    expect(googleGmailService.syncGmail).not.toHaveBeenCalled();
  });
});
