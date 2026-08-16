import { forwardRef, Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { GoogleDriveService } from './google-drive.service';
import { GoogleGmailService } from '../email-ingestion/google-gmail.service';

@Injectable()
export class BackupSchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleDriveService: GoogleDriveService,
    @Inject(forwardRef(() => GoogleGmailService))
    private readonly googleGmailService: GoogleGmailService,
  ) {}

  onApplicationBootstrap() {
    this.logger.log('Initializing automated daily scheduler (Google Drive Backup & Gmail Transaction Sync)...');
    // Run an initial check after 1 minute, then check hourly
    setTimeout(() => {
      this.runScheduledTasks().catch((err) =>
        this.logger.error(`Scheduled task run failed: ${err.message}`, err.stack),
      );
    }, 60 * 1000);

    this.timer = setInterval(() => {
      this.runScheduledTasks().catch((err) =>
        this.logger.error(`Scheduled task run failed: ${err.message}`, err.stack),
      );
    }, 60 * 60 * 1000); // Hourly check
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runScheduledTasks() {
    await this.checkAndRunDailyBackups();
    await this.checkAndRunDailyGmailSync();
  }

  async checkAndRunDailyBackups() {
    const configs = await this.prisma.googleDriveConfig.findMany({
      where: {
        autoBackupEnabled: true,
        autoPassphraseCipher: { not: null },
      },
    });

    if (configs.length === 0) {
      return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    for (const cfg of configs) {
      const lastBackupDateStr = cfg.lastBackupAt ? cfg.lastBackupAt.toISOString().split('T')[0] : null;

      // If already backed up today, skip
      if (lastBackupDateStr === todayStr) {
        continue;
      }

      this.logger.log(`Executing automated daily Google Drive backup for user ${cfg.userId}...`);
      try {
        await this.googleDriveService.uploadBackup(cfg.userId);
        this.logger.log(`Automated daily backup succeeded for user ${cfg.userId}`);
      } catch (err: any) {
        this.logger.error(`Automated daily backup failed for user ${cfg.userId}: ${err.message}`);
      }
    }
  }

  async checkAndRunDailyGmailSync() {
    const emailConfigs = await this.prisma.googleEmailConfig.findMany({
      where: {
        syncStatus: { not: 'DISCONNECTED' },
      },
    });

    if (emailConfigs.length === 0) {
      return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    for (const cfg of emailConfigs) {
      const lastSyncDateStr = cfg.lastSyncAt ? cfg.lastSyncAt.toISOString().split('T')[0] : null;

      // If already synced today, skip
      if (lastSyncDateStr === todayStr) {
        continue;
      }

      this.logger.log(`Executing automated daily Gmail transaction alert sync for user ${cfg.userId} (${cfg.email})...`);
      try {
        // Sync last 7 days of credit card & bank alert emails
        const syncResult = await this.googleGmailService.syncGmail(cfg.userId, 7);
        this.logger.log(
          `Automated daily Gmail sync succeeded for user ${cfg.userId}: ${syncResult.message}`,
        );
      } catch (err: any) {
        this.logger.error(`Automated daily Gmail sync failed for user ${cfg.userId}: ${err.message}`);
      }
    }
  }
}
