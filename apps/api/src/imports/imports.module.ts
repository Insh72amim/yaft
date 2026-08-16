import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TransfersModule } from '../transfers/transfers.module';
import { CategoryRulesModule } from '../category-rules/category-rules.module';
import { ImportsService } from './imports.service';

@Module({ imports: [AuthModule, TransfersModule, CategoryRulesModule], providers: [ImportsService], exports: [ImportsService] })
export class ImportsModule {}
