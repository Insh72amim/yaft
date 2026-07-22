import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountDocumentsController } from './account-documents.controller';
import { AccountDocumentsService } from './account-documents.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountDocumentsController],
  providers: [AccountDocumentsService],
  exports: [AccountDocumentsService],
})
export class AccountDocumentsModule {}
