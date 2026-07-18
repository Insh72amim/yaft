import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';

@Module({ imports: [AuthModule], controllers: [SalaryController], providers: [SalaryService], exports: [SalaryService] })
export class SalaryModule {}
