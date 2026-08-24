import { Module } from '@nestjs/common';
import { InvestmentsController } from './investments.controller';
import { SipController } from './sip.controller';
import { InvestmentsService } from './investments.service';
import { ZerodhaSyncService } from './zerodha-sync.service';
import { GrowwSyncService } from './groww-sync.service';
import { MarketDataService } from './market-data.service';
import { AmfiNavService } from './amfi-nav.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [InvestmentsController, SipController],
  providers: [InvestmentsService, ZerodhaSyncService, GrowwSyncService, MarketDataService, AmfiNavService],
  exports: [InvestmentsService, ZerodhaSyncService, GrowwSyncService, MarketDataService, AmfiNavService],
})
export class InvestmentsModule {}

