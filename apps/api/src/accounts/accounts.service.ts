import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountType, CategoryType, InstallmentStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { CreateAccountDto, DeleteAccountDto, UpdateAccountDto } from './accounts.dto';
import { generateAmortisationSchedule } from './loan-amortisation';
import { StatementCredentialsService } from '../common/statement-credentials.service';
import { AccountDocumentsService } from '../account-documents/account-documents.service';
import { extractBeneficiaryName, isRefundOrReversal, computeCreditCardCurrentBalance } from '../common/utils/transaction-utils';

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
  tagId?: string,
  mode?: string,
) {
  const where: any = { account: { userId, archived: false } };

  if (mode && mode !== 'all') {
    if (mode === 'CREDIT_CARD') {
      where.account.type = AccountType.CREDIT_CARD;
    } else if (mode === 'BANK') {
      where.account.type = { in: [AccountType.SAVINGS, AccountType.BANK] };
    } else if (mode === 'UPI_LITE') {
      where.account.type = AccountType.UPI_LITE;
    }
  }

  if (tagId && tagId !== 'all') {
    where.tags = { some: { tagId } };
  }

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

const SUPPORTED_SAVINGS_INSTITUTIONS = [
  'Axis Bank',
  'Punjab National Bank',
  'State Bank of India',
];

const SUPPORTED_STOCK_BROKERS = [
  'Zerodha',
  'Groww',
];

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: StatementCredentialsService,
    private readonly accountDocuments: AccountDocumentsService,
  ) {}

  async listAccounts(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    
    const accounts = await this.prisma.account.findMany({
      where: { userId, archived: false },
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: { select: { amount: true, transactionDate: true } },
        holdings: { select: { currentValue: true } },
        statementCredential: { select: { accountId: true } },
        vaultEntry: { select: { last4: true, cardNetwork: true } },
        parentAccount: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
        childAccounts: { select: { id: true, name: true, creditLimit: true } },
        loans: {
          include: {
            installments: {
              orderBy: { dueDate: 'asc' }
            }
          }
        }
      }
    });

    return accounts.map(({ transactions, holdings = [], statementCredential, vaultEntry, parentAccount, childAccounts = [], loans = [], ...account }) => {
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

      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const hasCompleteValuation = holdings.length > 0 && holdings.every((holding: any) => holding.currentValue !== null);
      
      let balance = Number(account.openingBalance) + transactions.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
      if (isPortfolio && hasCompleteValuation) {
        balance = holdings.reduce((sum: number, holding: any) => sum + Number(holding.currentValue), 0);
      } else if (account.type === AccountType.CREDIT_CARD) {
        balance = computeCreditCardCurrentBalance(account, transactions).currentBalance;
      }

      const currentMonthTxns = transactions.filter((t: any) => t.transactionDate >= startOfMonth && t.transactionDate < endOfMonth);
      const monthlyCredited = currentMonthTxns.filter((t: any) => t.amount > 0).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const monthlyDebited = Math.abs(currentMonthTxns.filter((t: any) => t.amount < 0).reduce((sum: number, t: any) => sum + Number(t.amount), 0));

      const effectiveCreditLimit = account.creditLimit !== null
        ? Number(account.creditLimit)
        : (parentAccount?.creditLimit !== null && parentAccount?.creditLimit !== undefined ? Number(parentAccount.creditLimit) : null);

      return {
        ...account,
        openingBalance: Number(account.openingBalance),
        creditLimit: effectiveCreditLimit,
        balance,
        monthlyCredited,
        monthlyDebited,
        cardLast4: account.type === AccountType.CREDIT_CARD ? vaultEntry?.last4 ?? null : null,
        cardNetwork: account.type === AccountType.CREDIT_CARD ? vaultEntry?.cardNetwork ?? null : null,
        hasStatementPassword: Boolean(statementCredential),
        parentAccountId: account.parentAccountId ?? null,
        parentAccountName: parentAccount?.name ?? null,
        isShared: Boolean(account.parentAccountId || (childAccounts && childAccounts.length > 0)),
        isChild: Boolean(account.parentAccountId),
        childAccountCount: childAccounts?.length ?? 0,
      };
    });
  }

  async createAccount(userId: string, dto: CreateAccountDto) {
    const institution = dto.institution?.trim();
    if (dto.type === AccountType.SAVINGS && !SUPPORTED_SAVINGS_INSTITUTIONS.some((bank) => bank === institution)) {
      throw new BadRequestException('Choose Axis Bank, Punjab National Bank, or State Bank of India for a savings account.');
    }
    if (dto.type === AccountType.STOCKS && !SUPPORTED_STOCK_BROKERS.some((broker) => broker === institution)) {
      throw new BadRequestException('Choose Zerodha or Groww for a stock account.');
    }

    let validatedParentAccountId: string | null = null;
    let statementDay = dto.statementDay;
    let dueDay = dto.dueDay;
    let creditLimit = dto.creditLimit !== undefined ? BigInt(dto.creditLimit) : undefined;

    if (dto.parentAccountId) {
      if (dto.type !== AccountType.CREDIT_CARD) {
        throw new BadRequestException('Only credit cards can be linked under a shared limit/bill.');
      }
      const parentCard = await this.prisma.account.findFirst({
        where: { id: dto.parentAccountId, userId, archived: false, type: AccountType.CREDIT_CARD },
      });
      if (!parentCard) {
        throw new BadRequestException('Selected parent credit card was not found.');
      }
      if (parentCard.parentAccountId) {
        throw new BadRequestException('The selected parent card is already linked to another card. Multi-level nesting is not supported.');
      }
      validatedParentAccountId = parentCard.id;
      if (statementDay === undefined && parentCard.statementDay) {
        statementDay = parentCard.statementDay;
      }
      if (dueDay === undefined && parentCard.dueDay) {
        dueDay = parentCard.dueDay;
      }
      if (creditLimit === undefined && parentCard.creditLimit) {
        creditLimit = parentCard.creditLimit;
      }
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
            userId,
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

    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type,
        institution,
        currency: dto.currency?.toUpperCase() ?? 'INR',
        openingBalance: BigInt(dto.openingBalance ?? 0),
        creditLimit,
        statementDay,
        dueDay,
        parentAccountId: validatedParentAccountId,
      },
      include: {
        parentAccount: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
      },
    });

    const effectiveCreditLimit = account.creditLimit !== null
      ? Number(account.creditLimit)
      : (account.parentAccount?.creditLimit !== null && account.parentAccount?.creditLimit !== undefined ? Number(account.parentAccount.creditLimit) : null);

    return {
      ...account,
      openingBalance: Number(account.openingBalance),
      creditLimit: effectiveCreditLimit,
      hasStatementPassword: false,
      parentAccountId: account.parentAccountId ?? null,
      parentAccountName: account.parentAccount?.name ?? null,
      isShared: Boolean(account.parentAccountId),
      isChild: Boolean(account.parentAccountId),
    };
  }

  async allTransactions(
    userId: string,
    requestedPage: number,
    requestedPageSize?: string,
    accountId?: string,
    search?: string,
    minAmountStr?: string,
    maxAmountStr?: string,
    type?: string,
    startDate?: string,
    endDate?: string,
    categoryId?: string,
    mode?: string,
  ) {
    const page = Math.max(1, requestedPage);
    const pageSize = requestedPageSize ? Math.min(100, Math.max(1, Number(requestedPageSize))) : 50;

    const minAmount = minAmountStr !== undefined && minAmountStr !== '' ? Number(minAmountStr) : undefined;
    const maxAmount = maxAmountStr !== undefined && maxAmountStr !== '' ? Number(maxAmountStr) : undefined;

    const transactionWhere = buildTransactionWhere(
      userId,
      accountId,
      search,
      minAmount,
      maxAmount,
      type,
      startDate,
      endDate,
      categoryId,
      undefined,
      undefined,
      mode,
    );

    const [total, amountSum, transactions, userCategories] = await Promise.all([
      this.prisma.transaction.count({ where: transactionWhere }),
      this.prisma.transaction.aggregate({ where: transactionWhere, _sum: { amount: true } }),
      this.prisma.transaction.findMany({
        where: transactionWhere,
        include: {
          account: { select: { id: true, name: true, type: true, institution: true } },
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              type: true,
              superCategory: { select: { id: true, name: true, color: true, kind: true } },
            },
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.category.findMany({
        where: { userId },
        include: { superCategory: { select: { id: true, name: true, color: true, kind: true } } },
        orderBy: { name: 'asc' },
      }),
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
        superCategory: item.category?.superCategory?.name ?? (item.category?.type ? item.category.type.charAt(0) + item.category.type.slice(1).toLowerCase() : null),
        superCategoryColor: item.category?.superCategory?.color ?? null,
        superCategoryKind: item.category?.superCategory?.kind ?? (item.category?.type as any ?? null),
        isTransfer: Boolean(item.transferGroupId),
        emailReference: (item.emailSnippet || item.emailMessageId || item.emailSubject) ? {
          messageId: item.emailMessageId,
          subject: item.emailSubject,
          sender: item.emailSender,
          date: item.emailDate,
          snippet: item.emailSnippet,
        } : null,
      })),
      categories: userCategories.filter((c) => c.name.toLowerCase() !== 'uncategorised' && c.name.toLowerCase() !== 'uncategorized').map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        superCategoryId: c.superCategoryId,
        superCategoryName: c.superCategory?.name ?? (c.type ? c.type.charAt(0) + c.type.slice(1).toLowerCase() : 'General'),
        superCategoryColor: c.superCategory?.color ?? null,
        superCategoryKind: c.superCategory?.kind ?? (c.type as any ?? null),
      })),
      totalAmount: Number(amountSum._sum.amount ?? 0n),
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    };
  }

  async getAccountTransactions(
    userId: string,
    accountId: string,
    requestedPage: number,
    search?: string,
    minAmountStr?: string,
    maxAmountStr?: string,
    type?: string,
    startDate?: string,
    endDate?: string,
    categoryId?: string,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
      select: {
        id: true, name: true, type: true, institution: true, currency: true, openingBalance: true,
        creditLimit: true, statementDay: true, dueDay: true, parentAccountId: true,
        parentAccount: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
        childAccounts: { select: { id: true, name: true, creditLimit: true } },
        vaultEntry: { select: { last4: true, cardNetwork: true } },
      },
    });
    if (!account) throw new NotFoundException('Account not found.');

    const page = Math.max(1, requestedPage);
    const pageSize = 50;

    const minAmount = minAmountStr !== undefined && minAmountStr !== '' ? Number(minAmountStr) : undefined;
    const maxAmount = maxAmountStr !== undefined && maxAmountStr !== '' ? Number(maxAmountStr) : undefined;

    const transactionWhere = buildTransactionWhere(userId, accountId, search, minAmount, maxAmount, type, startDate, endDate, categoryId);

    const [total, amount, transactions, userCategories] = await Promise.all([
      this.prisma.transaction.count({ where: transactionWhere }),
      this.prisma.transaction.aggregate({ where: { accountId, account: { userId } }, _sum: { amount: true } }),
      this.prisma.transaction.findMany({
        where: transactionWhere,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              type: true,
              superCategory: { select: { id: true, name: true, color: true, kind: true } },
            },
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.category.findMany({
        where: { userId },
        include: { superCategory: { select: { id: true, name: true, color: true, kind: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    const effectiveCreditLimit = account.creditLimit !== null
      ? Number(account.creditLimit)
      : (account.parentAccount?.creditLimit !== null && account.parentAccount?.creditLimit !== undefined ? Number(account.parentAccount.creditLimit) : null);

    return {
      account: {
        id: account.id, name: account.name, type: account.type, institution: account.institution, currency: account.currency,
        openingBalance: Number(account.openingBalance), balance: Number(account.openingBalance) + Number(amount._sum.amount ?? 0n),
        creditLimit: effectiveCreditLimit,
        statementDay: account.statementDay ?? account.parentAccount?.statementDay ?? null,
        dueDay: account.dueDay ?? account.parentAccount?.dueDay ?? null,
        parentAccountId: account.parentAccountId ?? null,
        parentAccountName: account.parentAccount?.name ?? null,
        isShared: Boolean(account.parentAccountId || (account.childAccounts && account.childAccounts.length > 0)),
        isChild: Boolean(account.parentAccountId),
        cardLast4: account.type === AccountType.CREDIT_CARD ? account.vaultEntry?.last4 ?? null : null,
        cardNetwork: account.type === AccountType.CREDIT_CARD ? account.vaultEntry?.cardNetwork ?? null : null,
      },
      transactions: transactions.map((item) => ({
        id: item.id,
        transactionDate: item.transactionDate,
        postedDate: item.postedDate,
        description: item.merchant || item.descriptionRaw,
        details: item.merchant ? item.descriptionRaw : null,
        amount: Number(item.amount),
        categoryId: item.categoryId,
        category: item.category?.name ?? 'Uncategorised',
        categoryColor: item.category?.color ?? '#94a3b8',
        superCategory: item.category?.superCategory?.name ?? (item.category?.type ? item.category.type.charAt(0) + item.category.type.slice(1).toLowerCase() : null),
        superCategoryColor: item.category?.superCategory?.color ?? null,
        superCategoryKind: item.category?.superCategory?.kind ?? (item.category?.type as any ?? null),
        isTransfer: Boolean(item.transferGroupId),
        emailReference: (item.emailSnippet || item.emailMessageId || item.emailSubject) ? {
          messageId: item.emailMessageId,
          subject: item.emailSubject,
          sender: item.emailSender,
          date: item.emailDate,
          snippet: item.emailSnippet,
        } : null,
      })),
      categories: userCategories.filter((c) => c.name.toLowerCase() !== 'uncategorised' && c.name.toLowerCase() !== 'uncategorized').map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        superCategoryId: c.superCategoryId,
        superCategoryName: c.superCategory?.name ?? (c.type ? c.type.charAt(0) + c.type.slice(1).toLowerCase() : 'General'),
        superCategoryColor: c.superCategory?.color ?? null,
        superCategoryKind: c.superCategory?.kind ?? (c.type as any ?? null),
      })),
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    };
  }

  async updateAccount(userId: string, accountId: string, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      include: { childAccounts: { select: { id: true } } },
    });
    if (!account) throw new NotFoundException('Account not found.');
    
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.institution !== undefined) updateData.institution = dto.institution;
    if (dto.openingBalance !== undefined) updateData.openingBalance = BigInt(dto.openingBalance);
    if (dto.creditLimit !== undefined) updateData.creditLimit = dto.creditLimit !== null ? BigInt(dto.creditLimit) : null;
    if (dto.statementDay !== undefined) updateData.statementDay = dto.statementDay;
    if (dto.dueDay !== undefined) updateData.dueDay = dto.dueDay;

    if (dto.parentAccountId !== undefined) {
      if (dto.parentAccountId) {
        if (account.type !== AccountType.CREDIT_CARD) {
          throw new BadRequestException('Only credit cards can be linked under a shared limit/bill.');
        }
        if (dto.parentAccountId === account.id) {
          throw new BadRequestException('A card cannot link to itself.');
        }
        if (account.childAccounts && account.childAccounts.length > 0) {
          throw new BadRequestException('This card has other cards linked to it and cannot become a child card.');
        }
        const parentCard = await this.prisma.account.findFirst({
          where: { id: dto.parentAccountId, userId, archived: false, type: AccountType.CREDIT_CARD },
        });
        if (!parentCard) {
          throw new BadRequestException('Selected parent credit card was not found.');
        }
        if (parentCard.parentAccountId) {
          throw new BadRequestException('The selected parent card is already linked to another card. Multi-level nesting is not supported.');
        }
        updateData.parentAccountId = parentCard.id;
      } else {
        updateData.parentAccountId = null;
      }
    }
    
    const updated = await this.prisma.account.update({
      where: { id: account.id },
      data: updateData,
      include: {
        parentAccount: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
        childAccounts: { select: { id: true, name: true, creditLimit: true } },
      },
    });

    const effectiveCreditLimit = updated.creditLimit !== null
      ? Number(updated.creditLimit)
      : (updated.parentAccount?.creditLimit !== null && updated.parentAccount?.creditLimit !== undefined ? Number(updated.parentAccount.creditLimit) : null);
    
    return {
      ...updated,
      openingBalance: Number(updated.openingBalance),
      creditLimit: effectiveCreditLimit,
      parentAccountId: updated.parentAccountId ?? null,
      parentAccountName: updated.parentAccount?.name ?? null,
      isShared: Boolean(updated.parentAccountId || (updated.childAccounts && updated.childAccounts.length > 0)),
      isChild: Boolean(updated.parentAccountId),
      childAccountCount: updated.childAccounts?.length ?? 0,
    };
  }

  async forgetStatementPassword(userId: string, accountId: string) {
    await this.credentials.forget(userId, accountId);
  }

  async deleteAccount(userId: string, accountId: string, dto: DeleteAccountDto) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true, name: true } });
    if (!account) throw new NotFoundException('Account not found.');
    if (dto.confirmationName !== account.name) throw new BadRequestException('Enter the account name exactly to confirm deletion.');
    await this.accountDocuments.purgeForAccount(userId, account.id);
    await this.prisma.$transaction(async (tx) => {
      const linkedTransfers = await tx.transaction.findMany({ where: { accountId: account.id, transferGroupId: { not: null } },
        select: { transferGroupId: true } });
      const transferGroupIds = [...new Set(linkedTransfers.flatMap((item) => item.transferGroupId ? [item.transferGroupId] : []))];
      if (transferGroupIds.length) await tx.transaction.updateMany({ where: { accountId: { not: account.id }, account: { userId },
        transferGroupId: { in: transferGroupIds } }, data: { transferGroupId: null } });
      await tx.account.delete({ where: { id: account.id } });
    });
  }

  async clearTransactions(userId: string, accountId: string, dto: DeleteAccountDto) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true, name: true } });
    if (!account) throw new NotFoundException('Account not found.');
    if (dto.confirmationName !== account.name) throw new BadRequestException('Enter the account name exactly to confirm clearing transactions.');
    await this.prisma.$transaction(async (tx) => {
      const linkedTransfers = await tx.transaction.findMany({ where: { accountId: account.id, transferGroupId: { not: null } },
        select: { transferGroupId: true } });
      const transferGroupIds = [...new Set(linkedTransfers.flatMap((item) => item.transferGroupId ? [item.transferGroupId] : []))];
      if (transferGroupIds.length) await tx.transaction.updateMany({ where: { accountId: { not: account.id }, account: { userId },
        transferGroupId: { in: transferGroupIds } }, data: { transferGroupId: null } });
      await tx.transaction.deleteMany({ where: { accountId: account.id } });
      await tx.importBatch.deleteMany({ where: { accountId: account.id } });
      await tx.account.update({ where: { id: account.id }, data: { openingBalance: 0n } });
    });
  }

  async getAccountTimeline(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true, name: true, type: true },
    });
    if (!account) throw new NotFoundException('Account not found.');

    const now = new Date();
    const startOfTimeline = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId: account.id,
        transactionDate: { gte: startOfTimeline },
      },
      select: {
        id: true,
        transactionDate: true,
        amount: true,
        transferGroupId: true,
      },
      orderBy: { transactionDate: 'desc' },
    });

    const monthsList: { month: string; monthKey: string; year: number; monthIdx: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const monthStr = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      const year = d.getUTCFullYear();
      const monthIdx = d.getUTCMonth();
      const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      monthsList.push({ month: monthStr, monthKey, year, monthIdx });
    }

    const timeline = monthsList.map(({ month, monthKey, year, monthIdx }) => {
      const monthTxns = transactions.filter((tx) => {
        const d = new Date(tx.transactionDate);
        return d.getUTCFullYear() === year && d.getUTCMonth() === monthIdx;
      });

      let inbound = 0;
      let internalTransfer = 0;
      let outbound = 0;

      monthTxns.forEach((tx) => {
        const val = Number(tx.amount);
        if (tx.transferGroupId) {
          internalTransfer += Math.abs(val);
        } else if (val > 0) {
          inbound += val;
        } else {
          outbound += Math.abs(val);
        }
      });

      const totalCount = monthTxns.length;
      const status = totalCount > 0 ? 'UPLOADED' : 'NO_TRANSACTIONS';

      return {
        month,
        monthKey,
        inbound,
        internalTransfer,
        outbound,
        totalCount,
        status,
      };
    });

    return {
      account: { id: account.id, name: account.name, type: account.type },
      timeline,
    };
  }

  async getCreditCardsSummary(
    userId: string,
    timeRange?: string,
    accountId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const cardAccounts = await this.prisma.account.findMany({
      where: { userId, type: AccountType.CREDIT_CARD, archived: false },
      include: {
        vaultEntry: true,
        parentAccount: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
        childAccounts: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
      },
    });

    const cardIds = cardAccounts.map((c) => c.id);

    const allCardTransactions = cardIds.length > 0
      ? await this.prisma.transaction.findMany({
          where: {
            accountId: { in: cardIds },
          },
          include: {
            category: { select: { id: true, name: true, color: true } },
            account: { select: { name: true } },
          },
          orderBy: { transactionDate: 'desc' },
        })
      : [];

    const now = new Date();
    let filterStart: Date | undefined;
    let filterEnd: Date | undefined;
    let timeRangeLabel = 'All-Time';

    if (startDate && endDate) {
      filterStart = new Date(`${startDate}T00:00:00.000Z`);
      filterEnd = new Date(`${endDate}T23:59:59.999Z`);
      timeRangeLabel = `${startDate} to ${endDate}`;
    } else if (timeRange === 'THIS_MONTH') {
      filterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      filterEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      timeRangeLabel = now.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    } else if (timeRange === 'LAST_MONTH') {
      filterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      filterEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      const lm = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      timeRangeLabel = lm.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    } else if (timeRange === '3M') {
      filterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
      timeRangeLabel = 'Past 3 Months';
    } else if (timeRange === '6M') {
      filterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
      timeRangeLabel = 'Past 6 Months';
    } else if (timeRange === '1Y') {
      filterStart = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
      timeRangeLabel = 'Past Year';
    }

    const cleanMerchant = (merchant?: string | null, descriptionRaw?: string | null): string => {
      if (merchant && merchant.trim().length > 0) {
        return merchant.replace(/\[.*?\]/g, '').replace(/\b(?:POS|TXN|REF|UPI)\b/gi, '').trim() || merchant.trim();
      }
      if (!descriptionRaw) return 'Unknown Merchant';
      const beneficiary = extractBeneficiaryName(descriptionRaw);
      if (beneficiary) return beneficiary;
      return descriptionRaw
        .replace(/\[.*?\]/g, '')
        .replace(/\bPOS\s+[\dX*]+\b/gi, '')
        .replace(/\b(?:POS|TXN|REF|UPI|IMPS|NEFT)\b/gi, '')
        .replace(/[\d@/_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || descriptionRaw.slice(0, 40);
    };

    const months: { label: string; year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push({
        label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + ' ' + String(d.getUTCFullYear()).slice(2),
        year: d.getUTCFullYear(),
        month: d.getUTCMonth(),
      });
    }

    const monthlySpendsAndPayments = months.map((m) => {
      const txsInMonth = allCardTransactions.filter((t) => {
        if (accountId && accountId !== 'ALL' && t.accountId !== accountId) return false;
        const d = new Date(t.transactionDate);
        return d.getUTCFullYear() === m.year && d.getUTCMonth() === m.month;
      });

      const spends = Math.abs(
        txsInMonth.filter((t) => t.amount < 0).reduce((sum, t) => sum + Number(t.amount), 0),
      );
      const payments = txsInMonth.filter((t) => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0);

      return {
        month: m.label,
        spends,
        payments,
      };
    });

    const filteredAnalyticsTransactions = allCardTransactions.filter((t) => {
      if (accountId && accountId !== 'ALL' && t.accountId !== accountId) return false;
      const tDate = new Date(t.transactionDate);
      if (filterStart && tDate < filterStart) return false;
      if (filterEnd && tDate > filterEnd) return false;
      return true;
    });

    const categoryMapOverall = new Map<string, { name: string; color: string; amount: number }>();
    const recipientMapOverall = new Map<string, { name: string; amount: number; count: number }>();

    let totalInbound = 0;
    let totalOutbound = 0;

    filteredAnalyticsTransactions.forEach((t) => {
      const amt = Number(t.amount);
      if (amt < 0) {
        const absAmt = Math.abs(amt);
        totalOutbound += absAmt;

        const catName = t.category?.name ?? 'Uncategorised';
        const catColor = t.category?.color ?? '#94a3b8';
        const currCat = categoryMapOverall.get(catName) || { name: catName, color: catColor, amount: 0 };
        categoryMapOverall.set(catName, { name: catName, color: catColor, amount: currCat.amount + absAmt });

        const recipientName = cleanMerchant(t.merchant, t.descriptionRaw);
        const currRec = recipientMapOverall.get(recipientName) || { name: recipientName, amount: 0, count: 0 };
        recipientMapOverall.set(recipientName, { name: recipientName, amount: currRec.amount + absAmt, count: currRec.count + 1 });
      } else {
        totalInbound += amt;
        if (isRefundOrReversal(t.descriptionRaw) && t.category?.name) {
          const catName = t.category.name;
          const currCat = categoryMapOverall.get(catName);
          if (currCat) {
            currCat.amount = Math.max(0, currCat.amount - amt);
          }
        }
      }
    });

    const overallCategories = [...categoryMapOverall.values()]
      .map((c) => ({
        ...c,
        percentage: totalOutbound > 0 ? Math.round((c.amount / totalOutbound) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const overallTopRecipients = [...recipientMapOverall.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const overallTopRecSum = overallTopRecipients.reduce((s, r) => s + r.amount, 0);
    const overallTopRecCount = overallTopRecipients.reduce((s, r) => s + r.count, 0);
    const overallOtherOutbound = {
      amount: Math.max(0, totalOutbound - overallTopRecSum),
      count: Math.max(0, filteredAnalyticsTransactions.filter((t) => t.amount < 0).length - overallTopRecCount),
    };

    // Pre-calculate balances for each individual card
    const cardBalances = new Map<string, { currentBalance: number; outstanding: number }>();
    cardAccounts.forEach((card) => {
      const cardTxns = allCardTransactions.filter((t) => t.accountId === card.id);
      cardBalances.set(card.id, computeCreditCardCurrentBalance(card, cardTxns));
    });

    // Group cards into shared pools by root parent ID
    const poolMap = new Map<string, { rootCard: any; members: any[]; poolLimit: number; poolOutstanding: number }>();
    cardAccounts.forEach((card) => {
      const rootId = card.parentAccountId || card.id;
      const rootCard = cardAccounts.find((c) => c.id === rootId) || card;
      const poolLimit = rootCard.creditLimit ? Number(rootCard.creditLimit) : (card.creditLimit ? Number(card.creditLimit) : 0);

      const existing = poolMap.get(rootId) || { rootCard, members: [], poolLimit, poolOutstanding: 0 };
      existing.members.push(card);
      existing.poolOutstanding += (cardBalances.get(card.id)?.outstanding ?? 0);
      if (poolLimit > existing.poolLimit) existing.poolLimit = poolLimit;
      poolMap.set(rootId, existing);
    });

    let totalLimit = 0;
    let totalOutstanding = 0;
    let totalAvailable = 0;

    // Total limit counts each unique pool once (avoids double counting child cards)
    poolMap.forEach((pool) => {
      totalLimit += pool.poolLimit;
      const poolAvailable = Math.max(0, pool.poolLimit - pool.poolOutstanding);
      totalAvailable += poolAvailable;
    });

    const cards = cardAccounts.map((card) => {
      const cardTxns = allCardTransactions.filter((t) => t.accountId === card.id);
      const rootId = card.parentAccountId || card.id;
      const pool = poolMap.get(rootId)!;

      const isChild = Boolean(card.parentAccountId);
      const isParent = Boolean(card.childAccounts && card.childAccounts.length > 0);
      const isShared = isChild || isParent;

      const { currentBalance, outstanding } = cardBalances.get(card.id)!;
      totalOutstanding += outstanding;

      const cardCreditLimit = isShared ? pool.poolLimit : (card.creditLimit ? Number(card.creditLimit) : 0);
      const availableCredit = isShared ? Math.max(0, pool.poolLimit - pool.poolOutstanding) : Math.max(0, cardCreditLimit - outstanding);
      const utilizationPercent = cardCreditLimit > 0
        ? Math.min(100, Math.round(((isShared ? pool.poolOutstanding : outstanding) / cardCreditLimit) * 100))
        : 0;

      let cardInbound = 0;
      let cardOutbound = 0;

      const cardCatMap = new Map<string, { name: string; color: string; amount: number }>();
      const cardRecMap = new Map<string, { name: string; amount: number; count: number }>();

      const cardAnalyticsTxns = cardTxns.filter((t) => {
        const tDate = new Date(t.transactionDate);
        if (filterStart && tDate < filterStart) return false;
        if (filterEnd && tDate > filterEnd) return false;
        return true;
      });

      cardAnalyticsTxns.forEach((t) => {
        const amt = Number(t.amount);
        if (amt < 0) {
          const absAmt = Math.abs(amt);
          cardOutbound += absAmt;

          const catName = t.category?.name ?? 'Uncategorised';
          const catColor = t.category?.color ?? '#94a3b8';
          const currCat = cardCatMap.get(catName) || { name: catName, color: catColor, amount: 0 };
          cardCatMap.set(catName, { name: catName, color: catColor, amount: currCat.amount + absAmt });

          const recipientName = cleanMerchant(t.merchant, t.descriptionRaw);
          const currRec = cardRecMap.get(recipientName) || { name: recipientName, amount: 0, count: 0 };
          cardRecMap.set(recipientName, { name: recipientName, amount: currRec.amount + absAmt, count: currRec.count + 1 });
        } else {
          cardInbound += amt;
          if (isRefundOrReversal(t.descriptionRaw) && t.category?.name) {
            const catName = t.category.name;
            const currCat = cardCatMap.get(catName);
            if (currCat) {
              currCat.amount = Math.max(0, currCat.amount - amt);
            }
          }
        }
      });

      const categories = [...cardCatMap.values()]
        .map((c) => ({
          ...c,
          percentage: cardOutbound > 0 ? Math.round((c.amount / cardOutbound) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const topRecipients = [...cardRecMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
      const topRecSum = topRecipients.reduce((s, r) => s + r.amount, 0);
      const topRecCount = topRecipients.reduce((s, r) => s + r.count, 0);
      const otherOutbound = {
        amount: Math.max(0, cardOutbound - topRecSum),
        count: Math.max(0, cardAnalyticsTxns.filter((t) => t.amount < 0).length - topRecCount),
      };

      const statementDate = card.statementDay ?? card.parentAccount?.statementDay ?? null;
      const dueDate = card.dueDay ?? card.parentAccount?.dueDay ?? null;
      const linkedCardNames = pool.members.filter((m) => m.id !== card.id).map((m) => m.name);

      return {
        id: card.id,
        name: card.name,
        institution: card.institution,
        cardLast4: card.vaultEntry?.last4 ?? null,
        cardNetwork: card.vaultEntry?.cardNetwork ?? null,
        creditLimit: cardCreditLimit,
        currentBalance,
        outstanding,
        availableCredit,
        utilizationPercent,
        statementDate,
        dueDate,
        isShared,
        isParent,
        isChild,
        parentAccountId: card.parentAccountId ?? null,
        parentAccountName: card.parentAccount?.name ?? null,
        linkedCardNames,
        poolCreditLimit: pool.poolLimit,
        poolOutstanding: pool.poolOutstanding,
        poolAvailableCredit: Math.max(0, pool.poolLimit - pool.poolOutstanding),
        poolUtilization: pool.poolLimit > 0 ? Math.min(100, Math.round((pool.poolOutstanding / pool.poolLimit) * 100)) : 0,
        totalInbound: cardInbound,
        totalOutbound: cardOutbound,
        categories,
        topRecipients,
        otherOutbound,
      };
    });

    const utilizationRate = totalLimit > 0 ? Math.min(100, Math.round((totalOutstanding / totalLimit) * 100)) : 0;

    const recentTransactions = allCardTransactions.slice(0, 10).map((t) => ({
      id: t.id,
      date: t.transactionDate.toISOString(),
      description: cleanMerchant(t.merchant, t.descriptionRaw),
      amount: Number(t.amount),
      category: t.category?.name ?? 'Uncategorised',
      categoryColor: t.category?.color ?? '#94a3b8',
      accountName: t.account.name,
    }));

    return {
      summary: {
        totalLimit,
        totalOutstanding,
        totalAvailable,
        utilizationRate,
        activeCardCount: cards.length,
        totalInbound,
        totalOutbound,
        timeRange: timeRange || 'ALL_TIME',
        timeRangeLabel,
      },
      overallFlow: {
        categories: overallCategories,
        topRecipients: overallTopRecipients,
        otherOutbound: overallOtherOutbound,
      },
      cards,
      monthlySpendsAndPayments,
      recentTransactions,
    };
  }

  async updateTransactionCategory(userId: string, accountId: string, transactionId: string, categoryId?: string | null) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
    });
    if (!account) throw new NotFoundException('Account not found.');

    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, accountId: account.id },
    });
    if (!transaction) throw new NotFoundException('Transaction not found.');

    let newCategoryId: string | null = null;
    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: categoryId, userId },
      });
      if (!category) throw new NotFoundException('Category not found.');
      newCategoryId = category.id;
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { categoryId: newCategoryId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            superCategory: { select: { id: true, name: true, color: true, kind: true } },
          },
        },
      },
    });

    return {
      id: updated.id,
      categoryId: updated.categoryId,
      category: updated.category?.name ?? 'Uncategorised',
      categoryColor: updated.category?.color ?? '#94a3b8',
      superCategory: updated.category?.superCategory?.name ?? null,
      superCategoryColor: updated.category?.superCategory?.color ?? null,
      superCategoryKind: updated.category?.superCategory?.kind ?? null,
    };
  }

  async addEpfoTransaction(userId: string, accountId: string, dto: { description: string; amount: number; transactionDate: string }) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false }
    });
    if (!account) throw new NotFoundException('Account not found.');
    if (account.type !== AccountType.EPFO) {
      throw new BadRequestException('Manual transactions are only allowed for EPFO accounts.');
    }
    
    const amountBig = BigInt(dto.amount);
    
    const category = await this.prisma.category.findFirst({
      where: { userId, name: { in: ['EPFO', 'Investment', 'Investments'] } }
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

  async deleteEpfoTransaction(userId: string, accountId: string, transactionId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId }
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

  async getLoanDetails(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      include: {
        loans: {
          include: {
            installments: {
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found.');
    }

    const loan = account.loans[0];
    if (!loan) {
      throw new NotFoundException('Loan details not found for this account.');
    }

    const installments = loan.installments;
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const dueIds = installments
      .filter((i: any) => i.status === 'FUTURE' && (i.dueDate <= now || i.dueDate.toISOString().slice(0, 10) <= todayYMD))
      .map((i: any) => i.id);

    if (dueIds.length > 0) {
      await this.prisma.loanInstallment.updateMany({
        where: { id: { in: dueIds } },
        data: { status: 'PAST_UNCONFIRMED' },
      });
      for (const inst of installments) {
        if (dueIds.includes(inst.id)) {
          inst.status = 'PAST_UNCONFIRMED' as any;
        }
      }
    }

    const totalInterest = installments.reduce((sum: number, i: any) => sum + Number(i.interestAmount), 0);
    const paidInstallments = installments.filter((i: any) => i.status === 'PAID');
    const totalPaid = paidInstallments.reduce((sum: number, i: any) => sum + Number(i.emiAmount), 0);
    const lastPaid = paidInstallments[paidInstallments.length - 1];
    const outstanding = lastPaid ? Number(lastPaid.balance) : Number(loan.principal);

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
        confirmedAt: i.confirmedAt ? i.confirmedAt.toISOString() : null,
      })),
      summary: {
        totalInterest,
        totalPaid,
        outstanding,
        paidCount: paidInstallments.length,
        totalCount: installments.length,
      },
    };
  }

  async confirmLoanInstallment(userId: string, accountId: string, installmentId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      include: { loans: true },
    });
    if (!account) throw new NotFoundException('Account not found.');
    const loan = account.loans[0];
    if (!loan) throw new NotFoundException('Loan not found.');

    const inst = await this.prisma.loanInstallment.findFirst({
      where: { id: installmentId, loanId: loan.id },
    });
    if (!inst) throw new NotFoundException('Installment not found.');
    if (inst.status === 'PAID') return { ok: true };

    const confirmedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          accountId: loan.accountId,
          transactionDate: confirmedAt,
          descriptionRaw: `Loan EMI payment (${loan.id})`,
          amount: BigInt(-Number(inst.emiAmount)),
          fingerprint: `${loan.id}:${inst.id}`,
        },
      });

      const updatedInst = await tx.loanInstallment.update({
        where: { id: inst.id },
        data: { status: 'PAID', confirmedAt },
      });
      return { txnId: txn.id, installmentId: updatedInst.id, ok: true };
    });
  }
}

