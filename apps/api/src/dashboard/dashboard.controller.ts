import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async overview(
    @CurrentUser() user: { id: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('month') month?: string,
  ) {
    return this.dashboardService.getOverview(user.id, startDate, endDate, month);
  }

  @Get('assets-history')
  async getAssetsHistory(@CurrentUser() user: { id: string }) {
    return this.dashboardService.getAssetsHistory(user.id);
  }

  @Get('expense-analytics')
  async getExpenseAnalytics(
    @CurrentUser() user: { id: string },
    @Query('granularity') granularity?: 'month' | 'week' | 'day',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('categoryId') categoryId?: string,
    @Query('categoryTypes') categoryTypesStr?: string,
  ) {
    const categoryTypes = categoryTypesStr
      ? categoryTypesStr.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : undefined;
    return this.dashboardService.getExpenseAnalytics(user.id, granularity, startDate, endDate, categoryId, categoryTypes);
  }
}
