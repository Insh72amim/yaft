import { Body, BadRequestException, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { InvestmentsService } from './investments.service';
import { ZerodhaSyncService, SyncZerodhaDto } from './zerodha-sync.service';
import { MarketDataService } from './market-data.service';

@Controller('investments')
@UseGuards(JwtAuthGuard)
export class InvestmentsController {
  constructor(
    private readonly investmentsService: InvestmentsService,
    private readonly zerodhaSync: ZerodhaSyncService,
    private readonly marketData: MarketDataService,
  ) {}

  @Get('portfolio')
  async getPortfolio(@CurrentUser() user: any) {
    return this.investmentsService.getPortfolio(user.id);
  }

  @Post(':accountId/sync-zerodha')
  async syncZerodha(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() body: SyncZerodhaDto,
  ) {
    return this.zerodhaSync.syncHoldings(user.id, accountId, body);
  }

  @Post(':accountId/refresh-quotes')
  async refreshQuotes(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
  ) {
    return this.marketData.refreshAccountMarketPrices(user.id, accountId);
  }

  @Post(':accountId/zerodha-holdings')
  @UseInterceptors(FileInterceptor('holdings', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async importZerodhaHoldings(@CurrentUser() user: { id: string }, @Param('accountId') accountId: string,
    @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('A Zerodha holdings XLSX file is required.');
    return this.investmentsService.importZerodhaHoldings(user.id, accountId, file);
  }
}

