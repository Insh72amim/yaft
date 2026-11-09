import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateRecurringDepositDto, UpdateRecurringDepositSettingsDto } from './recurring-deposits.dto';
import { RecurringDepositsService } from './recurring-deposits.service';

@Controller('accounts/:accountId/recurring-deposit')
@UseGuards(JwtAuthGuard)
export class RecurringDepositsController {
  constructor(private readonly recurringDepositsService: RecurringDepositsService) {}

  @Get()
  async getDetails(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
  ) {
    return this.recurringDepositsService.getRecurringDepositDetails(user.id, accountId);
  }

  @Post()
  async createOrUpdate(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() dto: CreateRecurringDepositDto,
  ) {
    return this.recurringDepositsService.createOrUpdateSchedule(user.id, accountId, dto);
  }

  @Patch('settings')
  async updateSettings(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() dto: UpdateRecurringDepositSettingsDto,
  ) {
    return this.recurringDepositsService.updateSettings(user.id, accountId, dto);
  }

  @Patch('installments/:installmentId/confirm')
  async confirmInstallment(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('installmentId') installmentId: string,
  ) {
    return this.recurringDepositsService.confirmInstallment(user.id, accountId, installmentId);
  }

  @Patch('installments/:installmentId/unconfirm')
  async unconfirmInstallment(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('installmentId') installmentId: string,
  ) {
    return this.recurringDepositsService.unconfirmInstallment(user.id, accountId, installmentId);
  }
}
