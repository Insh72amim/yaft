import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ImportsModule } from './imports/imports.module';
import { InvestmentsModule } from './investments/investments.module';
import { SalaryModule } from './salary/salary.module';
import { UnifiedImportsModule } from './unified-imports/unified-imports.module';
import { VaultModule } from './vault/vault.module';
import { LoansModule } from './loans/loans.module';
import { AccountDocumentsModule } from './account-documents/account-documents.module';
import { CategoryRulesModule } from './category-rules/category-rules.module';
import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    CommonModule,
    AuthModule,
    AccountsModule,
    AccountDocumentsModule,
    LoansModule,
    ImportsModule,
    InvestmentsModule,
    DashboardModule,
    SalaryModule,
    UnifiedImportsModule,
    VaultModule,
    CategoryRulesModule,
    TransfersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
