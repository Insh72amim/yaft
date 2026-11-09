import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { RecurringDepositsController } from './recurring-deposits.controller';
import { RecurringDepositsService } from './recurring-deposits.service';

@Module({
  imports: [CommonModule],
  controllers: [RecurringDepositsController],
  providers: [RecurringDepositsService],
  exports: [RecurringDepositsService],
})
export class RecurringDepositsModule {}
