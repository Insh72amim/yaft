import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from '../s3/s3.module';
import { EmailIngestionModule } from '../email-ingestion/email-ingestion.module';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { GoogleDriveController } from './google-drive.controller';
import { GoogleDriveService } from './google-drive.service';
import { BackupSchedulerService } from './backup-scheduler.service';

@Module({
  imports: [ConfigModule, AuthModule, S3Module, EmailIngestionModule],
  controllers: [BackupController, GoogleDriveController],
  providers: [BackupService, GoogleDriveService, BackupSchedulerService],
  exports: [BackupService, GoogleDriveService],
})
export class BackupModule {}
