import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TransfersModule } from '../transfers/transfers.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({ imports: [AuthModule, TransfersModule], controllers: [ImportsController], providers: [ImportsService], exports: [ImportsService] })
export class ImportsModule {}
