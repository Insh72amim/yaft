import { BadRequestException, Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Patch, Query, UseGuards } from '@nestjs/common';
import { AccountType, InstallmentStatus } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialsService } from '../common/statement-credentials.service';
import { CreateAccountDto, DeleteAccountDto } from './accounts.dto';
import { generateAmortisationSchedule } from './loan-amortisation';

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
    
    const accounts = await this.prisma.account.findMany({
      where: { userId: user.id, archived: false },
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: { select: { amount: true, transactionDate: true } },
        holdings: { select: { currentValue: true } },
        statementCredential: { select: { accountId: true } },
        loans: {
          include: {
            installments: {
              orderBy: { dueDate: 'asc' }
            }
          }
        }
      }
    });

    return accounts.map(({ transactions, holdings = [], statementCredential, loans = [], ...account }) => {
      if (account.type === AccountType.LOAN) {
        const loan = loans[0];
        let balance = Number(account.openingBalance);
        let loanOutstanding = loan ? Number(loan.principal) : 0;
        let nextEmiDate: Date | null = null;
        let nextEmiAmount = 0;
        let paidInstallments = 0;
        let totalInstallments = 0;

        if (loan) {
          totalInstallments = loan.installments.length;
          const paidInsts = loan.installments.filter((i: any) => i.status === InstallmentStatus.PAID);
          paidInstallments = paidInsts.length;
          
          if (paidInsts.length > 0) {
            const lastPaid = paidInsts[paidInsts.length - 1];
            loanOutstanding = Number(lastPaid.balance);
          }
          
          balance = -loanOutstanding;

          const nextInst = loan.installments.find((i: any) => i.status !== InstallmentStatus.PAID);
          if (nextInst) {
            nextEmiDate = nextInst.dueDate;
            nextEmiAmount = Number(nextInst.emiAmount);
          }
        }

        return {
          ...account,
          openingBalance: Number(account.openingBalance),
          creditLimit: null,
          balance,
          monthlyCredited: 0,
          monthlyDebited: 0,
          hasStatementPassword: false,
          loanOutstanding,
          nextEmiDate: nextEmiDate ? nextEmiDate.toISOString() : null,
          nextEmiAmount,
          paidInstallments,
          totalInstallments,
        };
      }

      const ledgerBalance = Number(account.openingBalance) + transactions.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const hasCompleteValuation = holdings.length > 0 && holdings.every((holding: any) => holding.currentValue !== null);
      
      const currentMonthTxns = transactions.filter((t: any) => t.transactionDate >= startOfMonth && t.transactionDate < endOfMonth);
      const monthlyCredited = currentMonthTxns.filter((t: any) => t.amount > 0).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const monthlyDebited = Math.abs(currentMonthTxns.filter((t: any) => t.amount < 0).reduce((sum: number, t: any) => sum + Number(t.amount), 0));

      return { ...account, openingBalance: Number(account.openingBalance),
        creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
        balance: isPortfolio && hasCompleteValuation
          ? holdings.reduce((sum: number, holding: any) => sum + Number(holding.currentValue), 0) : ledgerBalance,
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

    if (dto.type === AccountType.LOAN) {
      if (!dto.loanStartDate || !dto.loanPrincipal || !dto.loanInterestRate || !dto.loanEmiAmount || !dto.loanEmiDay || !dto.loanTermMonths) {
        throw new BadRequestException('All loan details are required.');
      }
      
      const principalBig = BigInt(dto.loanPrincipal);
      const openingBalance = -principalBig;
      
      const schedule = generateAmortisationSchedule(
        dto.loanPrincipal,
        dto.loanInterestRate,
        dto.loanEmiAmount,
        dto.loanEmiDay,
        new Date(dto.loanStartDate),
        dto.loanTermMonths,
      );
      
      const now = new Date();
      
      const result = await this.prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            userId: user.id,
            name: dto.name.trim(),
            type: dto.type,
            institution,
            currency: dto.currency?.toUpperCase() ?? 'INR',
            openingBalance,
          }
        });
        
        const loan = await tx.loan.create({
          data: {
            accountId: account.id,
            startDate: new Date(dto.loanStartDate!),
            principal: principalBig,
            interestRate: dto.loanInterestRate!,
            emiAmount: BigInt(dto.loanEmiAmount!),
            emiDay: dto.loanEmiDay!,
            termMonths: dto.loanTermMonths!,
          }
        });
        
        await tx.loanInstallment.createMany({
          data: schedule.map((inst) => {
            const isPast = inst.dueDate <= now;
            return {
              loanId: loan.id,
              dueDate: inst.dueDate,
              principalAmount: BigInt(inst.principalAmount),
              interestAmount: BigInt(inst.interestAmount),
              emiAmount: BigInt(inst.emiAmount),
              balance: BigInt(inst.balance),
              status: isPast ? InstallmentStatus.PAST_UNCONFIRMED : InstallmentStatus.FUTURE,
            };
          })
        });
        
        return account;
      });
      
      return {
        ...result,
        openingBalance: Number(result.openingBalance),
        creditLimit: null,
        hasStatementPassword: false,
      };
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

  @Delete(':accountId/transactions') @HttpCode(204)
  async clearTransactions(@CurrentUser() user: { id: string }, @Param('accountId') accountId: string, @Body() dto: DeleteAccountDto) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId: user.id }, select: { id: true, name: true } });
    if (!account) throw new NotFoundException('Account not found.');
    if (dto.confirmationName !== account.name) throw new BadRequestException('Enter the account name exactly to confirm clearing transactions.');
    await this.prisma.$transaction(async (tx) => {
      const linkedTransfers = await tx.transaction.findMany({ where: { accountId: account.id, transferGroupId: { not: null } },
        select: { transferGroupId: true } });
      const transferGroupIds = [...new Set(linkedTransfers.flatMap((item) => item.transferGroupId ? [item.transferGroupId] : []))];
      if (transferGroupIds.length) await tx.transaction.updateMany({ where: { accountId: { not: account.id }, account: { userId: user.id },
        transferGroupId: { in: transferGroupIds } }, data: { transferGroupId: null } });
      await tx.transaction.deleteMany({ where: { accountId: account.id } });
      await tx.importBatch.deleteMany({ where: { accountId: account.id } });
    });
  }

  @Get(':accountId/loan')
  async getLoanDetails(@CurrentUser() user: { id: string }, @Param('accountId') accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId: user.id, archived: false, type: AccountType.LOAN },
      include: {
        loans: {
          include: {
            installments: {
              orderBy: { dueDate: 'asc' }
            }
          }
        }
      }
    });
    if (!account) throw new NotFoundException('Loan account not found.');
    
    const loan = account.loans[0];
    if (!loan) throw new NotFoundException('No active loan found for this account.');
    
    const installments = loan.installments;
    const paidInstallments = installments.filter((i: any) => i.status === InstallmentStatus.PAID);
    
    let outstanding = Number(loan.principal);
    if (paidInstallments.length > 0) {
      outstanding = Number(paidInstallments[paidInstallments.length - 1].balance);
    }
    
    const totalInterest = installments.reduce((sum: number, i: any) => sum + Number(i.interestAmount), 0);
    const totalPaid = paidInstallments.reduce((sum: number, i: any) => sum + Number(i.emiAmount), 0);
    
    return {
      accountName: account.name,
      loan: {
        id: loan.id,
        startDate: loan.startDate.toISOString(),
        principal: Number(loan.principal),
        interestRate: Number(loan.interestRate),
        emiAmount: Number(loan.emiAmount),
        emiDay: loan.emiDay,
        termMonths: loan.termMonths,
      },
      installments: installments.map((i: any, idx: number) => ({
        id: i.id,
        number: idx + 1,
        dueDate: i.dueDate.toISOString(),
        principalAmount: Number(i.principalAmount),
        interestAmount: Number(i.interestAmount),
        emiAmount: Number(i.emiAmount),
        balance: Number(i.balance),
        status: i.status,
        confirmedAt: i.confirmedAt?.toISOString() ?? null,
      })),
      summary: {
        totalInterest,
        totalPaid,
        outstanding,
        paidCount: paidInstallments.length,
        totalCount: installments.length,
      }
    };
  }

  @Patch(':accountId/installments/:installmentId/confirm')
  @HttpCode(200)
  async confirmInstallment(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('installmentId') installmentId: string,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId: user.id, archived: false },
      include: { loans: true }
    });
    if (!account) throw new NotFoundException('Account not found.');
    
    const loan = account.loans[0];
    if (!loan) throw new NotFoundException('Loan details not found.');
    
    const installment = await this.prisma.loanInstallment.findFirst({
      where: { id: installmentId, loanId: loan.id }
    });
    if (!installment) throw new NotFoundException('Installment not found.');
    if (installment.status !== InstallmentStatus.PAST_UNCONFIRMED) {
      throw new BadRequestException('Only past due installments awaiting confirmation can be confirmed.');
    }
    
    const updated = await this.prisma.loanInstallment.update({
      where: { id: installmentId },
      data: {
        status: InstallmentStatus.PAID,
        confirmedAt: new Date(),
      }
    });
    
    return {
      ...updated,
      principalAmount: Number(updated.principalAmount),
      interestAmount: Number(updated.interestAmount),
      emiAmount: Number(updated.emiAmount),
      balance: Number(updated.balance),
    };
  }
}
