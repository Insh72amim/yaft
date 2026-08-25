import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountType, CategoryType } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';

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

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

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
    categoryGroup?: string,
    tagId?: string,
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
      categoryGroup,
      tagId,
      mode,
    );

    const [total, amountSum, debitsSum, creditsSum, transactions, userCategories, userAccounts, userTags] = await Promise.all([
      this.prisma.transaction.count({ where: transactionWhere }),
      this.prisma.transaction.aggregate({ where: transactionWhere, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { ...transactionWhere, amount: { lt: 0n } }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { ...transactionWhere, amount: { gt: 0n } }, _sum: { amount: true } }),
      this.prisma.transaction.findMany({
        where: transactionWhere,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              type: true,
              institution: true,
              vaultEntry: { select: { last4: true } },
            },
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
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
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.category.findMany({
        where: { userId },
        include: { superCategory: { select: { id: true, name: true, color: true, kind: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.account.findMany({
        where: { userId, archived: false },
        select: {
          id: true,
          name: true,
          type: true,
          institution: true,
          vaultEntry: { select: { last4: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.tag.findMany({
        where: { userId },
        select: { id: true, name: true, color: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const totalSpent = Number(debitsSum._sum.amount ?? 0n);
    const totalReceived = Number(creditsSum._sum.amount ?? 0n);
    const netTotal = Number(amountSum._sum.amount ?? 0n);

    return {
      summary: {
        totalSpent: Math.abs(totalSpent),
        totalReceived,
        netTotal,
        totalCount: total,
      },
      transactions: transactions.map((item) => ({
        id: item.id,
        accountId: item.accountId,
        accountName: item.account.name,
        accountType: item.account.type,
        institution: item.account.institution,
        cardLast4: item.account.vaultEntry?.last4 ?? null,
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
        tags: item.tags?.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })) ?? [],
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
      accounts: userAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        institution: a.institution,
        cardLast4: a.vaultEntry?.last4 ?? null,
      })),
      tags: userTags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      })),
      totalAmount: netTotal,
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
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
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
}
