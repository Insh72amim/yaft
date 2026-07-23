import { Module } from '@nestjs/common';
import { InvestmentsController } from './investments.controller';
import { SipController } from './sip.controller';
import { InvestmentsService } from './investments.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [InvestmentsController, SipController],
  providers: [InvestmentsService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
