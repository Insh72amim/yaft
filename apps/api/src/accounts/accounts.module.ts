import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountsController } from './accounts.controller';
import { AccountDocumentsModule } from '../account-documents/account-documents.module';

@Module({ imports: [AuthModule, AccountDocumentsModule], controllers: [AccountsController] })
export class AccountsModule {}
