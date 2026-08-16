import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CreateAccountDto, DeleteAccountDto, UpdateAccountDto } from './accounts.dto';
import { AccountsService } from './accounts.service';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    return this.accountsService.listAccounts(user.id);
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateAccountDto) {
    return this.accountsService.createAccount(user.id, dto);
  }

  @Get(['all-transactions', 'transactions/all'])
  async allTransactions(
    @CurrentUser() user: { id: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) requestedPage: number,
    @Query('pageSize') requestedPageSize?: string,
    @Query('accountId') accountId?: string,
    @Query('search') search?: string,
    @Query('minAmount') minAmountStr?: string,
    @Query('maxAmount') maxAmountStr?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('categoryId') categoryId?: string,
    @Query('mode') mode?: string,
  ) {
    return this.accountsService.allTransactions(
      user.id,
      requestedPage,
      requestedPageSize,
      accountId,
      search,
      minAmountStr,
      maxAmountStr,
      type,
      startDate,
      endDate,
      categoryId,
      mode,
    );
  }

  @Get(['credit-cards/summary', 'credit-cards'])
  async getCreditCardsSummary(
    @CurrentUser() user: { id: string },
    @Query('timeRange') timeRange?: string,
    @Query('accountId') accountId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.accountsService.getCreditCardsSummary(user.id, timeRange, accountId, startDate, endDate);
  }

  @Get(':accountId/transactions')
  async transactions(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) requestedPage: number,
    @Query('search') search?: string,
    @Query('minAmount') minAmountStr?: string,
    @Query('maxAmount') maxAmountStr?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.accountsService.getAccountTransactions(
      user.id,
      accountId,
      requestedPage,
      search,
      minAmountStr,
      maxAmountStr,
      type,
      startDate,
      endDate,
      categoryId,
    );
  }

  @Delete(':accountId/statement-password')
  @HttpCode(204)
  async forgetStatementPassword(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
  ) {
    return this.accountsService.forgetStatementPassword(user.id, accountId);
  }

  @Delete(':accountId')
  @HttpCode(204)
  async deleteAccount(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.accountsService.deleteAccount(user.id, accountId, dto);
  }

  @Delete(':accountId/transactions')
  @HttpCode(204)
  async clearTransactions(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.accountsService.clearTransactions(user.id, accountId, dto);
  }

  @Get(':accountId/timeline')
  async getAccountTimeline(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
  ) {
    return this.accountsService.getAccountTimeline(user.id, accountId);
  }

  @Post(':accountId/epfo-transactions')
  async addEpfoTransaction(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() dto: { description: string; amount: number; transactionDate: string },
  ) {
    return this.accountsService.addEpfoTransaction(user.id, accountId, dto);
  }

  @Patch(':accountId')
  async updateAccount(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.updateAccount(user.id, accountId, dto);
  }

  @Delete(':accountId/transactions/:transactionId')
  @HttpCode(204)
  async deleteEpfoTransaction(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.accountsService.deleteEpfoTransaction(user.id, accountId, transactionId);
  }

  @Patch(':accountId/transactions/:transactionId')
  async updateTransactionCategory(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: { categoryId?: string | null },
  ) {
    return this.accountsService.updateTransactionCategory(user.id, accountId, transactionId, dto.categoryId);
  }

  @Get(':accountId/loan')
  async getLoanDetails(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
  ) {
    return this.accountsService.getLoanDetails(user.id, accountId);
  }

  @Patch(':accountId/installments/:installmentId/confirm')
  async confirmLoanInstallment(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('installmentId') installmentId: string,
  ) {
    return this.accountsService.confirmLoanInstallment(user.id, accountId, installmentId);
  }
}

