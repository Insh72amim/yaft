import { BadRequestException, Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialsService } from '../common/statement-credentials.service';
import { CreateAccountDto, DeleteAccountDto } from './accounts.dto';

export const SUPPORTED_SAVINGS_INSTITUTIONS = ['Axis Bank', 'Punjab National Bank', 'State Bank of India'] as const;
export const SUPPORTED_STOCK_BROKERS = ['Zerodha', 'Groww'] as const;

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly prisma: PrismaService, private readonly credentials: StatementCredentialsService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    
    const accounts = await this.prisma.account.findMany({ where: { userId: user.id, archived: false },
      orderBy: { createdAt: 'asc' }, include: { transactions: { select: { amount: true, transactionDate: true } },
        holdings: { select: { currentValue: true } }, statementCredential: { select: { accountId: true } } } });
    return accounts.map(({ transactions, holdings = [], statementCredential, ...account }) => {
      const ledgerBalance = Number(account.openingBalance) + transactions.reduce((sum, item) => sum + Number(item.amount), 0);
      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const hasCompleteValuation = holdings.length > 0 && holdings.every((holding) => holding.currentValue !== null);
      
      const currentMonthTxns = transactions.filter((t) => t.transactionDate >= startOfMonth && t.transactionDate < endOfMonth);
      const monthlyCredited = currentMonthTxns.filter((t) => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0);
      const monthlyDebited = Math.abs(currentMonthTxns.filter((t) => t.amount < 0).reduce((sum, t) => sum + Number(t.amount), 0));

      return { ...account, openingBalance: Number(account.openingBalance),
        creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
        balance: isPortfolio && hasCompleteValuation
          ? holdings.reduce((sum, holding) => sum + Number(holding.currentValue), 0) : ledgerBalance,
        monthlyCredited, monthlyDebited,
        hasStatementPassword: Boolean(statementCredential) };
    });
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateAccountDto) {
    const institution = dto.institution?.trim();
    if (dto.type === AccountType.SAVINGS && !SUPPORTED_SAVINGS_INSTITUTIONS.some((bank) => bank === institution)) {
      throw new BadRequestException('Choose Axis Bank, Punjab National Bank, or State Bank of India for a savings account.');
    }
    if (dto.type === AccountType.STOCKS && !SUPPORTED_STOCK_BROKERS.some((broker) => broker === institution)) {
      throw new BadRequestException('Choose Zerodha or Groww for a stock account.');
    }
    const account = await this.prisma.account.create({ data: { userId: user.id, name: dto.name.trim(), type: dto.type,
      institution, currency: dto.currency?.toUpperCase() ?? 'INR',
      openingBalance: BigInt(dto.openingBalance ?? 0), creditLimit: dto.creditLimit === undefined ? undefined : BigInt(dto.creditLimit),
      statementDay: dto.statementDay, dueDay: dto.dueDay } });
    return { ...account, openingBalance: Number(account.openingBalance),
      creditLimit: account.creditLimit === null ? null : Number(account.creditLimit), hasStatementPassword: false };
  }

  @Get(':accountId/transactions')
  async transactions(@CurrentUser() user: { id: string }, @Param('accountId') accountId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) requestedPage: number) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId: user.id, archived: false },
      select: { id: true, name: true, type: true, institution: true, currency: true, openingBalance: true },
    });
    if (!account) throw new NotFoundException('Account not found.');

    const page = Math.max(1, requestedPage);
    const pageSize = 50;
    const transactionWhere = { accountId, account: { userId: user.id } };
    const [total, amount, transactions] = await Promise.all([
      this.prisma.transaction.count({ where: transactionWhere }),
      this.prisma.transaction.aggregate({ where: transactionWhere, _sum: { amount: true } }),
      this.prisma.transaction.findMany({ where: transactionWhere, include: { category: { select: { name: true } } },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    ]);

    return {
      account: { id: account.id, name: account.name, type: account.type, institution: account.institution, currency: account.currency,
        openingBalance: Number(account.openingBalance), balance: Number(account.openingBalance) + Number(amount._sum.amount ?? 0n) },
      transactions: transactions.map((item) => ({ id: item.id, transactionDate: item.transactionDate, postedDate: item.postedDate,
        description: item.merchant || item.descriptionRaw, details: item.merchant ? item.descriptionRaw : null, amount: Number(item.amount),
        category: item.category?.name ?? 'Uncategorised', isTransfer: Boolean(item.transferGroupId) })),
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    };
  }

  @Delete(':accountId/statement-password') @HttpCode(204)
  async forgetStatementPassword(@CurrentUser() user: { id: string }, @Param('accountId') accountId: string) {
    await this.credentials.forget(user.id, accountId);
  }

  @Delete(':accountId') @HttpCode(204)
  async deleteAccount(@CurrentUser() user: { id: string }, @Param('accountId') accountId: string, @Body() dto: DeleteAccountDto) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId: user.id }, select: { id: true, name: true } });
    if (!account) throw new NotFoundException('Account not found.');
    if (dto.confirmationName !== account.name) throw new BadRequestException('Enter the account name exactly to confirm deletion.');
    await this.prisma.$transaction(async (tx) => {
      const linkedTransfers = await tx.transaction.findMany({ where: { accountId: account.id, transferGroupId: { not: null } },
        select: { transferGroupId: true } });
      const transferGroupIds = [...new Set(linkedTransfers.flatMap((item) => item.transferGroupId ? [item.transferGroupId] : []))];
      if (transferGroupIds.length) await tx.transaction.updateMany({ where: { accountId: { not: account.id }, account: { userId: user.id },
        transferGroupId: { in: transferGroupIds } }, data: { transferGroupId: null } });
      await tx.account.delete({ where: { id: account.id } });
    });
  }
}
