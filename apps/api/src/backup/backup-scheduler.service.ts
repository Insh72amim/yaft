import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { GoogleDriveService } from './google-drive.service';

@Injectable()
export class BackupSchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleDriveService: GoogleDriveService,
  ) {}

  onApplicationBootstrap() {
    this.logger.log('Initializing automated Google Drive daily backup scheduler...');
    // Run an initial check after 1 minute, then check hourly
    setTimeout(() => {
      this.checkAndRunDailyBackups().catch((err) =>
        this.logger.error(`Daily backup scheduler check failed: ${err.message}`, err.stack),
      );
    }, 60 * 1000);

    this.timer = setInterval(() => {
      this.checkAndRunDailyBackups().catch((err) =>
        this.logger.error(`Daily backup scheduler check failed: ${err.message}`, err.stack),
      );
    }, 60 * 60 * 1000); // Hourly check
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
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
}
