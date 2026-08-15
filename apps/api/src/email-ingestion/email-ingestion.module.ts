import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CategoryRulesModule } from '../category-rules/category-rules.module';
import { EmailIngestionController } from './email-ingestion.controller';
import { EmailIngestionService } from './email-ingestion.service';
import { GoogleGmailService } from './google-gmail.service';

@Module({
  imports: [CommonModule, CategoryRulesModule],
  controllers: [EmailIngestionController],
  providers: [EmailIngestionService, GoogleGmailService],
  exports: [EmailIngestionService, GoogleGmailService],
})
export class EmailIngestionModule {}
