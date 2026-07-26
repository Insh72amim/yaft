import { BadRequestException, Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Patch, Query, UseGuards } from '@nestjs/common';
import { AccountType, CategoryType, InstallmentStatus } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialsService } from '../common/statement-credentials.service';
import { CreateAccountDto, DeleteAccountDto, CreateTransactionDto, UpdateAccountDto } from './accounts.dto';
import { generateAmortisationSchedule } from './loan-amortisation';
import { createHash } from 'crypto';
import { AccountDocumentsService } from '../account-documents/account-documents.service';


export const SUPPORTED_SAVINGS_INSTITUTIONS = ['Axis Bank', 'Punjab National Bank', 'State Bank of India'] as const;
export const SUPPORTED_STOCK_BROKERS = ['Zerodha', 'Groww'] as const;

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: StatementCredentialsService,
    private readonly accountDocuments: AccountDocumentsService,
  ) {}

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
        vaultEntry: { select: { last4: true, cardNetwork: true } },
        loans: {
          include: {
            installments: {
              orderBy: { dueDate: 'asc' }
            }
          }
        }
      }
    });

    return accounts.map(({ transactions, holdings = [], statementCredential, vaultEntry, loans = [], ...account }) => {
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
        cardLast4: account.type === AccountType.CREDIT_CARD ? vaultEntry?.last4 ?? null : null,
        cardNetwork: account.type === AccountType.CREDIT_CARD ? vaultEntry?.cardNetwork ?? null : null,
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

  @Get('all-transactions')
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
  ) {
    const page = Math.max(1, requestedPage);
    const pageSize = requestedPageSize ? Math.min(100, Math.max(1, Number(requestedPageSize))) : 50;

    const minAmount = minAmountStr !== undefined && minAmountStr !== '' ? Number(minAmountStr) : undefined;
    const maxAmount = maxAmountStr !== undefined && maxAmountStr !== '' ? Number(maxAmountStr) : undefined;

    const transactionWhere = buildTransactionWhere(user.id, accountId, search, minAmount, maxAmount, type, startDate, endDate, categoryId);

    const [total, amountSum, transactions, userCategories] = await Promise.all([
      this.prisma.transaction.count({ where: transactionWhere }),
      this.prisma.transaction.aggregate({ where: transactionWhere, _sum: { amount: true } }),
      this.prisma.transaction.findMany({
        where: transactionWhere,
        include: {
          account: { select: { id: true, name: true, type: true, institution: true } },
          category: { select: { id: true, name: true, color: true } },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.category.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } }),
    ]);

    return {
      transactions: transactions.map((item) => ({
        id: item.id,
        accountId: item.accountId,
        accountName: item.account.name,
        accountType: item.account.type,
        institution: item.account.institution,
        transactionDate: item.transactionDate,
        postedDate: item.postedDate,
        description: item.merchant || item.descriptionRaw,
        details: item.merchant ? item.descriptionRaw : null,
        amount: Number(item.amount),
        categoryId: item.categoryId,
        category: item.category?.name ?? 'Uncategorised',
        categoryColor: item.category?.color ?? '#94a3b8',
        isTransfer: Boolean(item.transferGroupId),
      })),
      categories: userCategories.map((c) => ({ id: c.id, name: c.name, color: c.color })),
      totalAmount: Number(amountSum._sum.amount ?? 0n),
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    };
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
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId: user.id, archived: false },
      select: { id: true, name: true, type: true, institution: true, currency: true, openingBalance: true,
        creditLimit: true, statementDay: true, dueDay: true,
        vaultEntry: { select: { last4: true, cardNetwork: true } } },
    });
    if (!account) throw new NotFoundException('Account not found.');

    const page = Math.max(1, requestedPage);
    const pageSize = 50;

    const minAmount = minAmountStr !== undefined && minAmountStr !== '' ? Number(minAmountStr) : undefined;
    const maxAmount = maxAmountStr !== undefined && maxAmountStr !== '' ? Number(maxAmountStr) : undefined;

    const transactionWhere = buildTransactionWhere(user.id, accountId, search, minAmount, maxAmount, type, startDate, endDate, categoryId);

    const [total, amount, transactions, userCategories] = await Promise.all([
      this.prisma.transaction.count({ where: transactionWhere }),
      this.prisma.transaction.aggregate({ where: { accountId, account: { userId: user.id } }, _sum: { amount: true } }),
      this.prisma.transaction.findMany({ where: transactionWhere, include: { category: { select: { id: true, name: true, color: true } } },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.category.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } }),
    ]);

    return {
      account: { id: account.id, name: account.name, type: account.type, institution: account.institution, currency: account.currency,
        openingBalance: Number(account.openingBalance), balance: Number(account.openingBalance) + Number(amount._sum.amount ?? 0n),
        creditLimit: account.creditLimit === null ? null : Number(account.creditLimit), statementDay: account.statementDay, dueDay: account.dueDay,
        cardLast4: account.type === AccountType.CREDIT_CARD ? account.vaultEntry?.last4 ?? null : null,
        cardNetwork: account.type === AccountType.CREDIT_CARD ? account.vaultEntry?.cardNetwork ?? null : null },
      transactions: transactions.map((item) => ({ id: item.id, transactionDate: item.transactionDate, postedDate: item.postedDate,
        description: item.merchant || item.descriptionRaw, details: item.merchant ? item.descriptionRaw : null, amount: Number(item.amount),
        categoryId: item.categoryId, category: item.category?.name ?? 'Uncategorised', categoryColor: item.category?.color ?? '#94a3b8',
        isTransfer: Boolean(item.transferGroupId) })),
      categories: userCategories.map((c) => ({ id: c.id, name: c.name, color: c.color })),
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
    await this.accountDocuments.purgeForAccount(user.id, account.id);
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
      await tx.account.update({ where: { id: account.id }, data: { openingBalance: 0n } });
    });
  }

  @Get('credit-cards/summary')
  async getCreditCardsSummary(@CurrentUser() user: { id: string }) {
    const cardAccounts = await this.prisma.account.findMany({
      where: { userId: user.id, type: AccountType.CREDIT_CARD, archived: false },
      include: {
        vaultEntry: true,
      },
      orderBy: { name: 'asc' },
    });

    let totalLimit = 0;
    let totalOutstanding = 0;

    const cards = await Promise.all(
      cardAccounts.map(async (acc) => {
        const creditLimit = Number(acc.creditLimit ?? 0n);
        const agg = await this.prisma.transaction.aggregate({
          where: { accountId: acc.id },
          _sum: { amount: true },
        });
        const balance = Number(acc.openingBalance) + Number(agg._sum.amount ?? 0n);
        const outstanding = Math.max(0, -balance);
        const available = Math.max(0, creditLimit - outstanding);
        const utilizationPercent = creditLimit > 0 ? Math.min(100, Math.round((outstanding / creditLimit) * 100)) : 0;

        totalLimit += creditLimit;
        totalOutstanding += outstanding;

        return {
          id: acc.id,
          name: acc.name,
          institution: acc.institution,
          cardLast4: acc.vaultEntry?.last4 ?? null,
          cardNetwork: acc.vaultEntry?.cardNetwork ?? null,
          creditLimit,
          currentBalance: balance,
          outstanding,
          availableCredit: available,
          utilizationPercent,
          statementDate: acc.statementDay ?? null,
          dueDate: acc.dueDay ?? null,
        };
      })
    );

    const totalAvailable = Math.max(0, totalLimit - totalOutstanding);
    const utilizationRate = totalLimit > 0 ? Math.min(100, Math.round((totalOutstanding / totalLimit) * 100)) : 0;

    const allCcTx = await this.prisma.transaction.findMany({
      where: {
        account: { userId: user.id, type: AccountType.CREDIT_CARD },
      },
      include: { category: true, account: true },
      orderBy: { transactionDate: 'asc' },
    });

    const monthMap = new Map<string, { month: string; spends: number; payments: number }>();
    const categoryMap = new Map<string, { categoryId: string; categoryName: string; color: string; totalAmount: number }>();

    allCcTx.forEach((tx) => {
      const d = new Date(tx.transactionDate);
      const monthKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      const val = Number(tx.amount);

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { month: monthKey, spends: 0, payments: 0 });
      }
      const entry = monthMap.get(monthKey)!;

      if (val < 0) {
        entry.spends += Math.abs(val);
        const catName = tx.category?.name ?? 'Uncategorised';
        const catColor = tx.category?.color ?? '#94a3b8';
        const catId = tx.categoryId ?? 'uncategorised';

        if (!categoryMap.has(catId)) {
          categoryMap.set(catId, { categoryId: catId, categoryName: catName, color: catColor, totalAmount: 0 });
        }
        categoryMap.get(catId)!.totalAmount += Math.abs(val);
      } else {
        entry.payments += val;
      }
    });

    const monthlySpendsAndPayments = Array.from(monthMap.values()).slice(-6);

    const totalSpendAll = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.totalAmount, 0);
    const topCategories = Array.from(categoryMap.values())
      .map((c) => ({
        ...c,
        percentage: totalSpendAll > 0 ? Math.round((c.totalAmount / totalSpendAll) * 100) : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    const recentTransactions = allCcTx
      .slice(-10)
      .reverse()
      .map((tx) => ({
        id: tx.id,
        date: tx.transactionDate,
        description: tx.merchant || tx.descriptionRaw,
        amount: Number(tx.amount),
        category: tx.category?.name ?? 'Uncategorised',
        categoryColor: tx.category?.color ?? '#94a3b8',
        accountName: tx.account.name,
      }));

    return {
      summary: {
        totalLimit,
        totalOutstanding,
        totalAvailable,
        utilizationRate,
        activeCardCount: cardAccounts.length,
      },
      cards,
      monthlySpendsAndPayments,
      topCategories,
      recentTransactions,
    };
  }

  @Get('transactions/all')
  async getAllTransactions(
    @CurrentUser() user: { id: string },
    @Query('mode') mode?: 'CREDIT_CARD' | 'BANK' | 'UPI' | 'ALL',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) requestedPage = 1,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('categoryId') categoryId?: string,
    @Query('categoryGroup') categoryGroup?: string,
    @Query('accountId') accountId?: string,
    @Query('minAmount') minAmountStr?: string,
    @Query('maxAmount') maxAmountStr?: string,
  ) {
    const page = Math.max(1, requestedPage);
    const pageSize = 50;

    const minAmount = minAmountStr !== undefined && minAmountStr.trim() !== '' ? Number(minAmountStr) : undefined;
    const maxAmount = maxAmountStr !== undefined && maxAmountStr.trim() !== '' ? Number(maxAmountStr) : undefined;

    const baseWhere = buildTransactionWhere(user.id, accountId, search, minAmount, maxAmount, type, startDate, endDate, categoryId, categoryGroup);

    if (mode === 'CREDIT_CARD') {
      baseWhere.account = { ...baseWhere.account, type: AccountType.CREDIT_CARD };
    } else if (mode === 'BANK') {
      baseWhere.account = { ...baseWhere.account, type: { in: [AccountType.BANK, AccountType.SAVINGS] } };
    } else if (mode === 'UPI') {
      baseWhere.account = { ...baseWhere.account, type: { in: [AccountType.BANK, AccountType.SAVINGS, AccountType.CREDIT_CARD] } };
      const upiConditions = [
        { merchant: { contains: 'UPI', mode: 'insensitive' } },
        { merchant: { contains: 'GPAY', mode: 'insensitive' } },
        { merchant: { contains: 'PHONEPE', mode: 'insensitive' } },
        { merchant: { contains: 'PAYTM', mode: 'insensitive' } },
        { descriptionRaw: { contains: 'UPI', mode: 'insensitive' } },
        { descriptionRaw: { contains: 'GPAY', mode: 'insensitive' } },
        { descriptionRaw: { contains: 'PHONEPE', mode: 'insensitive' } },
        { descriptionRaw: { contains: 'PAYTM', mode: 'insensitive' } },
        { descriptionRaw: { contains: '@', mode: 'insensitive' } },
      ];
      if (baseWhere.OR) {
        baseWhere.AND = [{ OR: baseWhere.OR }, { OR: upiConditions }];
        delete baseWhere.OR;
      } else {
        baseWhere.OR = upiConditions;
      }
    } else {
      // Full History (ALL): Union of Credit Cards and Bank Accounts only
      baseWhere.account = { ...baseWhere.account, type: { in: [AccountType.BANK, AccountType.SAVINGS, AccountType.CREDIT_CARD] } };
    }

    const [total, aggregate, transactions, userCategories, userAccounts] = await Promise.all([
      this.prisma.transaction.count({ where: baseWhere }),
      this.prisma.transaction.aggregate({
        where: baseWhere,
        _sum: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: baseWhere,
        include: {
          account: {
            select: { id: true, name: true, type: true, institution: true, vaultEntry: { select: { last4: true } } }
          },
          category: { select: { id: true, name: true, color: true } }
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.category.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } }),
      this.prisma.account.findMany({
        where: {
          userId: user.id,
          archived: false,
          type: { in: [AccountType.BANK, AccountType.SAVINGS, AccountType.CREDIT_CARD] },
        },
        select: { id: true, name: true, type: true, institution: true, vaultEntry: { select: { last4: true } } },
      }),
    ]);

    const debitsWhere = { ...baseWhere, amount: { lt: 0n } };
    const creditsWhere = { ...baseWhere, amount: { gt: 0n } };
    const [debitsAgg, creditsAgg] = await Promise.all([
      this.prisma.transaction.aggregate({ where: debitsWhere, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: creditsWhere, _sum: { amount: true } }),
    ]);

    return {
      summary: {
        totalSpent: Math.abs(Number(debitsAgg._sum.amount ?? 0n)),
        totalReceived: Number(creditsAgg._sum.amount ?? 0n),
        netTotal: Number(aggregate._sum.amount ?? 0n),
        totalCount: total,
      },
      transactions: transactions.map((item) => ({
        id: item.id,
        accountId: item.accountId,
        accountName: item.account.name,
        accountType: item.account.type,
        accountInstitution: item.account.institution,
        cardLast4: item.account.vaultEntry?.last4 ?? null,
        transactionDate: item.transactionDate,
        postedDate: item.postedDate,
        description: item.merchant || item.descriptionRaw,
        details: item.merchant ? item.descriptionRaw : null,
        amount: Number(item.amount),
        categoryId: item.categoryId,
        category: item.category?.name ?? 'Uncategorised',
        categoryColor: item.category?.color ?? '#94a3b8',
        isTransfer: Boolean(item.transferGroupId),
      })),
      categories: userCategories.map((c) => ({ id: c.id, name: c.name, color: c.color, type: c.type })),
      accounts: userAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        institution: a.institution,
        cardLast4: a.vaultEntry?.last4 ?? null,
      })),
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    };
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

  @Post(':accountId/transactions')
  async addEpfoTransaction(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() dto: CreateTransactionDto
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId: user.id }
    });
    if (!account) throw new NotFoundException('Account not found.');
    if (account.type !== AccountType.EPFO) {
      throw new BadRequestException('Manual transactions are only allowed for EPFO accounts.');
    }
    
    const amountBig = BigInt(dto.amount);
    
    const category = await this.prisma.category.findFirst({
      where: { userId: user.id, name: { in: ['EPFO', 'Investment', 'Investments'] } }
    });
    const categoryId = category?.id ?? null;
    
    const fingerprintSeed = `epfo-manual-${accountId}-${dto.transactionDate}-${dto.description}-${dto.amount}-${Date.now()}`;
    const fingerprint = createHash('sha256').update(fingerprintSeed).digest('hex');
    
    const transaction = await this.prisma.transaction.create({
      data: {
        accountId: account.id,
        transactionDate: new Date(dto.transactionDate),
        descriptionRaw: dto.description,
        amount: amountBig,
        categoryId,
        fingerprint,
        userVerified: true
      }
    });
    
    return {
      ...transaction,
      amount: Number(transaction.amount)
    };
  }

  @Patch(':accountId')
  async updateAccount(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() dto: UpdateAccountDto
  ) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) throw new NotFoundException('Account not found.');
    
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.institution !== undefined) updateData.institution = dto.institution;
    if (dto.creditLimit !== undefined) updateData.creditLimit = dto.creditLimit !== null ? BigInt(dto.creditLimit) : null;
    if (dto.statementDay !== undefined) updateData.statementDay = dto.statementDay;
    if (dto.dueDay !== undefined) updateData.dueDay = dto.dueDay;
    
    const updated = await this.prisma.account.update({
      where: { id: account.id },
      data: updateData
    });
    
    return {
      ...updated,
      openingBalance: Number(updated.openingBalance),
      creditLimit: updated.creditLimit !== null ? Number(updated.creditLimit) : null
    };
  }

  @Delete(':accountId/transactions/:transactionId')
  @HttpCode(204)
  async deleteEpfoTransaction(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId: user.id }
    });
    if (!account) throw new NotFoundException('Account not found.');
    if (account.type !== AccountType.EPFO) {
      throw new BadRequestException('Transaction deletion is only allowed for EPFO accounts.');
    }
    
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, accountId: account.id }
    });
    if (!transaction) throw new NotFoundException('Transaction not found.');
    
    await this.prisma.transaction.delete({
      where: { id: transaction.id }
    });
  }

  @Patch(':accountId/transactions/:transactionId')
  async updateTransactionCategory(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: { categoryId?: string | null },
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId: user.id, archived: false },
    });
    if (!account) throw new NotFoundException('Account not found.');

    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, accountId: account.id },
    });
    if (!transaction) throw new NotFoundException('Transaction not found.');

    let newCategoryId: string | null = null;
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, userId: user.id },
      });
      if (!category) throw new NotFoundException('Category not found.');
      newCategoryId = category.id;
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { categoryId: newCategoryId },
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    return {
      id: updated.id,
      categoryId: updated.categoryId,
      category: updated.category?.name ?? 'Uncategorised',
      categoryColor: updated.category?.color ?? '#94a3b8',
    };
  }
}

export function buildTransactionWhere(
  userId: string,
  accountId?: string,
  search?: string,
  minAmount?: number,
  maxAmount?: number,
  type?: string,
  startDateStr?: string,
  endDateStr?: string,
  categoryId?: string,
  categoryGroup?: string,
) {
  const where: any = { account: { userId, archived: false } };

  if (accountId && accountId !== 'all') {
    where.accountId = accountId;
  }

  if (categoryId && categoryId !== 'all') {
    if (categoryId === 'uncategorised') {
      where.categoryId = null;
      where.transferGroupId = null;
    } else if (categoryId === 'transfers') {
      where.transferGroupId = { not: null };
    } else {
      where.categoryId = categoryId;
    }
  }

  if (categoryGroup && categoryGroup !== 'ALL') {
    if (categoryGroup === 'TRANSFER') {
      const transferCond = [
        { category: { type: CategoryType.TRANSFER } },
        { transferGroupId: { not: null } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: transferCond }];
        delete where.OR;
      } else {
        where.OR = transferCond;
      }
    } else {
      where.category = { type: categoryGroup as CategoryType };
    }
  }

  if (search && search.trim()) {
    const query = search.trim();
    where.OR = [
      { merchant: { contains: query, mode: 'insensitive' } },
      { descriptionRaw: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (startDateStr || endDateStr) {
    where.transactionDate = {};
    if (startDateStr) {
      const start = new Date(startDateStr);
      if (!isNaN(start.getTime())) {
        where.transactionDate.gte = start;
      }
    }
    if (endDateStr) {
      const end = new Date(endDateStr);
      if (!isNaN(end.getTime())) {
        end.setUTCHours(23, 59, 59, 999);
        where.transactionDate.lte = end;
      }
    }
  }

  const minPaise = minAmount !== undefined && !isNaN(minAmount) ? BigInt(Math.round(Math.abs(minAmount) * 100)) : undefined;
  const maxPaise = maxAmount !== undefined && !isNaN(maxAmount) ? BigInt(Math.round(Math.abs(maxAmount) * 100)) : undefined;

  const conditions: any[] = [];

  if (type === 'EXPENSE') {
    conditions.push({ amount: { lt: 0n } });
    if (minPaise !== undefined) conditions.push({ amount: { lte: -minPaise } });
    if (maxPaise !== undefined) conditions.push({ amount: { gte: -maxPaise } });
  } else if (type === 'INCOME') {
    conditions.push({ amount: { gt: 0n } });
    if (minPaise !== undefined) conditions.push({ amount: { gte: minPaise } });
    if (maxPaise !== undefined) conditions.push({ amount: { lte: maxPaise } });
  } else if (minPaise !== undefined || maxPaise !== undefined) {
    const posCond: any = { amount: { gt: 0n } };
    if (minPaise !== undefined) posCond.amount.gte = minPaise;
    if (maxPaise !== undefined) posCond.amount.lte = maxPaise;

    const negCond: any = { amount: { lt: 0n } };
    if (minPaise !== undefined) negCond.amount.lte = -minPaise;
    if (maxPaise !== undefined) negCond.amount.gte = -maxPaise;

    conditions.push({ OR: [posCond, negCond] });
  }

  if (conditions.length > 0) {
    where.AND = conditions;
  }

  return where;
}
