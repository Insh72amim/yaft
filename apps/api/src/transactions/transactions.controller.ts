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
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get(['', 'all'])
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
    @Query('categoryGroup') categoryGroup?: string,
    @Query('tagId') tagId?: string,
    @Query('mode') mode?: string,
  ) {
    return this.transactionsService.allTransactions(
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
      categoryGroup,
      tagId,
      mode,
    );
  }

  @Patch(':accountId/:transactionId/category')
  async updateTransactionCategory(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: { categoryId?: string | null },
  ) {
    return this.transactionsService.updateTransactionCategory(user.id, accountId, transactionId, dto.categoryId);
  }

  @Patch(':accountId/:transactionId')
  async updateTransaction(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: { merchant?: string; categoryId?: string | null },
  ) {
    return this.transactionsService.updateTransaction(user.id, transactionId, dto, accountId);
  }

  @Patch(':transactionId')
  async updateTransactionDirect(
    @CurrentUser() user: { id: string },
    @Param('transactionId') transactionId: string,
    @Body() dto: { merchant?: string; categoryId?: string | null },
  ) {
    return this.transactionsService.updateTransaction(user.id, transactionId, dto);
  }

  @Post(':accountId/epfo')
  async addEpfoTransaction(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() dto: { description: string; amount: number; transactionDate: string },
  ) {
    return this.transactionsService.addEpfoTransaction(user.id, accountId, dto);
  }

  @Delete(':accountId/epfo/:transactionId')
  @HttpCode(204)
  async deleteEpfoTransaction(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionsService.deleteEpfoTransaction(user.id, accountId, transactionId);
  }
}
