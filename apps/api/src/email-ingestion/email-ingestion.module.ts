import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EmailIngestionController } from './email-ingestion.controller';
import { EmailIngestionService } from './email-ingestion.service';

@Module({
  imports: [CommonModule],
  controllers: [EmailIngestionController],
  providers: [EmailIngestionService],
  exports: [EmailIngestionService],
})
export class EmailIngestionModule {}
