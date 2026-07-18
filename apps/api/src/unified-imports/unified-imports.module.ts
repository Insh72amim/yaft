import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ImportsModule } from '../imports/imports.module';
import { InvestmentsModule } from '../investments/investments.module';
import { SalaryModule } from '../salary/salary.module';
import { UnifiedImportsController } from './unified-imports.controller';
import { UnifiedImportsService } from './unified-imports.service';

@Module({
  imports: [AuthModule, ImportsModule, SalaryModule, InvestmentsModule],
  controllers: [UnifiedImportsController],
  providers: [UnifiedImportsService],
})
export class UnifiedImportsModule {}
