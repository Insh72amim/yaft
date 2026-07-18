import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialsService } from '../common/statement-credentials.service';
import { CreateAccountDto } from './accounts.dto';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly prisma: PrismaService, private readonly credentials: StatementCredentialsService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    const accounts = await this.prisma.account.findMany({ where: { userId: user.id, archived: false },
      orderBy: { createdAt: 'asc' }, include: { transactions: { select: { amount: true } }, statementCredential: { select: { accountId: true } } } });
    return accounts.map(({ transactions, statementCredential, ...account }) => ({ ...account,
      openingBalance: Number(account.openingBalance), creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
      balance: Number(account.openingBalance) + transactions.reduce((sum, item) => sum + Number(item.amount), 0),
      hasStatementPassword: Boolean(statementCredential) }));
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateAccountDto) {
    const account = await this.prisma.account.create({ data: { userId: user.id, name: dto.name.trim(), type: dto.type,
      institution: dto.institution?.trim(), currency: dto.currency?.toUpperCase() ?? 'INR',
      openingBalance: BigInt(dto.openingBalance ?? 0), creditLimit: dto.creditLimit === undefined ? undefined : BigInt(dto.creditLimit),
      statementDay: dto.statementDay, dueDay: dto.dueDay } });
    return { ...account, openingBalance: Number(account.openingBalance),
      creditLimit: account.creditLimit === null ? null : Number(account.creditLimit), hasStatementPassword: false };
  }

  @Delete(':accountId/statement-password') @HttpCode(204)
  async forgetStatementPassword(@CurrentUser() user: { id: string }, @Param('accountId') accountId: string) {
    await this.credentials.forget(user.id, accountId);
  }
}
