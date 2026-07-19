import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoansController } from './loans.controller';

@Module({ imports: [AuthModule], controllers: [LoansController] })
export class LoansModule {}
