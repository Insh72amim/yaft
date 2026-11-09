import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { CreditCardsService } from './credit-cards.service';
import { AccountDocumentsModule } from '../account-documents/account-documents.module';
import { LoansModule } from '../loans/loans.module';
import { RecurringDepositsModule } from '../recurring-deposits/recurring-deposits.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [AuthModule, AccountDocumentsModule, LoansModule, RecurringDepositsModule, TransactionsModule],
  controllers: [AccountsController],
  providers: [AccountsService, CreditCardsService],
  exports: [AccountsService, CreditCardsService],
})
export class AccountsModule {}
