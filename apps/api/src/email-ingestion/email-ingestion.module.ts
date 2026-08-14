import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EmailIngestionController } from './email-ingestion.controller';
import { EmailIngestionService } from './email-ingestion.service';
import { GoogleGmailService } from './google-gmail.service';

@Module({
  imports: [CommonModule],
  controllers: [EmailIngestionController],
  providers: [EmailIngestionService, GoogleGmailService],
  exports: [EmailIngestionService, GoogleGmailService],
})
export class EmailIngestionModule {}
