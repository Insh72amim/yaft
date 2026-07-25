import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BudgetsService, SetCategoryBudgetDto } from './budgets.service';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  async getBudgets(
    @CurrentUser() user: { id: string },
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const targetYear = year ? parseInt(year, 10) : undefined;
    const targetMonth = month !== undefined && month !== null && month !== '' ? parseInt(month, 10) : undefined;
    return this.budgetsService.listBudgets(user.id, targetYear, targetMonth);
  }

  @Post()
  async setBudget(
    @CurrentUser() user: { id: string },
    @Body() dto: SetCategoryBudgetDto,
  ) {
    return this.budgetsService.setBudget(user.id, dto);
  }

  @Delete(':id')
  async deleteBudget(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.budgetsService.deleteBudget(user.id, id);
  }
}
