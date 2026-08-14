import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AssignTagsDto, AutoApplyTagDto, CreateTagDto, RangeTagAndCategorizeDto, UpdateTagDto } from './tags.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const tags = await this.prisma.tag.findMany({
      where: { userId },
      include: {
        transactions: {
          include: {
            transaction: {
              select: {
                id: true,
                amount: true,
                categoryId: true,
                category: { select: { id: true, name: true, color: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tags.map((t) => {
      let totalSpent = 0n;
      let totalReceived = 0n;

      t.transactions.forEach((tt) => {
        const amt = tt.transaction.amount;
        if (amt < 0n) {
          totalSpent += -amt;
        } else {
          totalReceived += amt;
        }
      });

      const netTotal = totalReceived - totalSpent;

      return {
        id: t.id,
        name: t.name,
        color: t.color,
        description: t.description,
        startDate: t.startDate,
        endDate: t.endDate,
        budgetLimit: t.budgetLimit ? Number(t.budgetLimit) / 100 : null,
        transactionCount: t.transactions.length,
        totalSpent: Number(totalSpent) / 100,
        totalReceived: Number(totalReceived) / 100,
        netTotal: Number(netTotal) / 100,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
  }

  async create(userId: string, dto: CreateTagDto) {
    const nameTrimmed = dto.name.trim();
    if (!nameTrimmed) {
      throw new BadRequestException('Tag name cannot be empty.');
    }

    const existing = await this.prisma.tag.findFirst({
      where: { userId, name: { equals: nameTrimmed, mode: 'insensitive' } },
    });
    if (existing) {
      throw new BadRequestException(`Tag "${nameTrimmed}" already exists.`);
    }

    const tag = await this.prisma.tag.create({
      data: {
        userId,
        name: nameTrimmed,
        color: dto.color || '#3b82f6',
        description: dto.description?.trim() || null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        budgetLimit: dto.budgetLimit ? BigInt(Math.round(dto.budgetLimit * 100)) : null,
      },
    });

    return {
      ...tag,
      budgetLimit: tag.budgetLimit ? Number(tag.budgetLimit) / 100 : null,
    };
  }

  async update(userId: string, tagId: string, dto: UpdateTagDto) {
    const existing = await this.prisma.tag.findFirst({
      where: { id: tagId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Tag not found.');
    }

    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.tag.findFirst({
        where: { userId, name: { equals: dto.name.trim(), mode: 'insensitive' }, id: { not: tagId } },
      });
      if (duplicate) {
        throw new BadRequestException(`Tag "${dto.name.trim()}" already exists.`);
      }
    }

    const updated = await this.prisma.tag.update({
      where: { id: tagId },
      data: {
        name: dto.name ? dto.name.trim() : existing.name,
        color: dto.color !== undefined ? dto.color : existing.color,
        description: dto.description !== undefined ? dto.description?.trim() || null : existing.description,
        startDate: dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : existing.startDate,
        endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : existing.endDate,
        budgetLimit: dto.budgetLimit !== undefined ? (dto.budgetLimit ? BigInt(Math.round(dto.budgetLimit * 100)) : null) : existing.budgetLimit,
      },
    });

    return {
      ...updated,
      budgetLimit: updated.budgetLimit ? Number(updated.budgetLimit) / 100 : null,
    };
  }

  async delete(userId: string, tagId: string) {
    const existing = await this.prisma.tag.findFirst({
      where: { id: tagId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Tag not found.');
    }

    await this.prisma.tag.delete({ where: { id: tagId } });
    return { success: true, message: 'Tag deleted successfully.' };
  }

  async assignTags(userId: string, dto: AssignTagsDto) {
    const { transactionIds, tagIds, action = 'ADD' } = dto;
    if (!transactionIds || transactionIds.length === 0) {
      return { updatedCount: 0 };
    }

    // Verify all transactions belong to the user
    const txs = await this.prisma.transaction.findMany({
      where: { id: { in: transactionIds }, account: { userId } },
      select: { id: true },
    });
    const validTxIds = txs.map((t) => t.id);

    if (validTxIds.length === 0) {
      return { updatedCount: 0 };
    }

    // Verify all tags belong to user
    const userTags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds }, userId },
      select: { id: true },
    });
    const validTagIds = userTags.map((t) => t.id);

    if (action === 'SET') {
      // Delete existing tags for these transactions
      await this.prisma.transactionTag.deleteMany({
        where: { transactionId: { in: validTxIds } },
      });
    }

    if (action === 'REMOVE') {
      const res = await this.prisma.transactionTag.deleteMany({
        where: {
          transactionId: { in: validTxIds },
          tagId: { in: validTagIds },
        },
      });
      return { updatedCount: res.count };
    }

    // ADD or SET
    let addedCount = 0;
    for (const txId of validTxIds) {
      for (const tagId of validTagIds) {
        try {
          await this.prisma.transactionTag.create({
            data: { transactionId: txId, tagId },
          });
          addedCount++;
        } catch {
          // Ignore duplicate primary key constraint
        }
      }
    }

    return { updatedCount: addedCount };
  }

  async getTagAnalytics(userId: string, tagId: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, userId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found.');
    }

    const txTags = await this.prisma.transactionTag.findMany({
      where: { tagId, transaction: { account: { userId } } },
      include: {
        transaction: {
          include: {
            account: { select: { id: true, name: true, type: true, institution: true } },
            category: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: { transaction: { transactionDate: 'desc' } },
    });

    let totalSpent = 0n;
    let totalReceived = 0n;

    const categoryMap = new Map<string, { id: string; name: string; color: string; amount: bigint }>();
    const accountMap = new Map<string, { id: string; name: string; type: string; institution: string | null; amount: bigint }>();
    const timelineMap = new Map<string, { date: string; spent: bigint; received: bigint; count: number }>();

    const transactions = txTags.map((tt) => {
      const t = tt.transaction;
      const amt = t.amount;

      if (amt < 0n) {
        totalSpent += -amt;
      } else {
        totalReceived += amt;
      }

      // Category breakdown
      const catId = t.categoryId || 'uncategorised';
      const catName = t.category?.name || 'Uncategorised';
      const catColor = t.category?.color || '#94a3b8';
      const existingCat = categoryMap.get(catId) || { id: catId, name: catName, color: catColor, amount: 0n };
      existingCat.amount += amt < 0n ? -amt : 0n;
      categoryMap.set(catId, existingCat);

      // Account breakdown
      const accId = t.accountId;
      const accName = t.account.name;
      const accType = t.account.type;
      const accInst = t.account.institution;
      const existingAcc = accountMap.get(accId) || { id: accId, name: accName, type: accType, institution: accInst, amount: 0n };
      existingAcc.amount += amt < 0n ? -amt : 0n;
      accountMap.set(accId, existingAcc);

      // Timeline breakdown
      const dateStr = t.transactionDate.toISOString().split('T')[0];
      const existingTime = timelineMap.get(dateStr) || { date: dateStr, spent: 0n, received: 0n, count: 0 };
      if (amt < 0n) existingTime.spent += -amt;
      else existingTime.received += amt;
      existingTime.count++;
      timelineMap.set(dateStr, existingTime);

      return {
        id: t.id,
        transactionDate: t.transactionDate,
        description: t.descriptionRaw,
        merchant: t.merchant,
        amount: Number(amt) / 100,
        category: catName,
        categoryColor: catColor,
        accountName: accName,
        accountType: accType,
      };
    });

    const totalExpenseSum = Number(totalSpent) / 100;
    const categoryBreakdown = Array.from(categoryMap.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        amount: Number(c.amount) / 100,
        percentage: totalExpenseSum > 0 ? Math.round((Number(c.amount) / 100 / totalExpenseSum) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const accountBreakdown = Array.from(accountMap.values())
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        institution: a.institution,
        amount: Number(a.amount) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);

    const timeline = Array.from(timelineMap.values())
      .map((t) => ({
        date: t.date,
        spent: Number(t.spent) / 100,
        received: Number(t.received) / 100,
        count: t.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: tag.description,
        startDate: tag.startDate,
        endDate: tag.endDate,
        budgetLimit: tag.budgetLimit ? Number(tag.budgetLimit) / 100 : null,
      },
      summary: {
        totalCount: transactions.length,
        totalSpent: totalExpenseSum,
        totalReceived: Number(totalReceived) / 100,
        netTotal: Number(totalReceived - totalSpent) / 100,
      },
      categories: categoryBreakdown,
      accounts: accountBreakdown,
      timeline,
      transactions,
    };
  }

  async autoApplyTag(userId: string, tagId: string, dto: AutoApplyTagDto) {
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, userId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found.');
    }

    const whereClause: any = {
      account: { userId },
    };

    if (dto.startDate || dto.endDate) {
      whereClause.transactionDate = {};
      if (dto.startDate) whereClause.transactionDate.gte = parseDateBoundary(dto.startDate, false);
      if (dto.endDate) whereClause.transactionDate.lte = parseDateBoundary(dto.endDate, true);
    } else if (tag.startDate || tag.endDate) {
      whereClause.transactionDate = {};
      if (tag.startDate) whereClause.transactionDate.gte = tag.startDate;
      if (tag.endDate) whereClause.transactionDate.lte = tag.endDate;
    }

    if (dto.keywords && dto.keywords.length > 0) {
      whereClause.OR = dto.keywords.map((kw) => ({
        descriptionRaw: { contains: kw.trim(), mode: 'insensitive' },
      }));
    }

    const matchingTx = await this.prisma.transaction.findMany({
      where: whereClause,
      select: { id: true },
    });

    const txIds = matchingTx.map((t) => t.id);

    let newlyCategorizedCount = 0;
    if (dto.categoryId && txIds.length > 0) {
      const catId = dto.categoryId === 'uncategorised' || dto.categoryId === 'none' ? null : dto.categoryId;
      const res = await this.prisma.transaction.updateMany({
        where: { id: { in: txIds } },
        data: { categoryId: catId },
      });
      newlyCategorizedCount = res.count;
    }

    let newlyTaggedCount = 0;
    for (const txId of txIds) {
      try {
        await this.prisma.transactionTag.create({
          data: { transactionId: txId, tagId },
        });
        newlyTaggedCount++;
      } catch {
        // Ignore already existing link
      }
    }

    return {
      matchedCount: matchingTx.length,
      newlyTaggedCount,
      newlyCategorizedCount,
    };
  }

  async rangeTagAndCategorize(userId: string, dto: RangeTagAndCategorizeDto) {
    const whereClause: any = {
      account: { userId, archived: false },
    };

    if (dto.accountId && dto.accountId !== 'all') {
      whereClause.accountId = dto.accountId;
    }

    if (dto.startDate || dto.endDate) {
      whereClause.transactionDate = {};
      if (dto.startDate) whereClause.transactionDate.gte = parseDateBoundary(dto.startDate, false);
      if (dto.endDate) whereClause.transactionDate.lte = parseDateBoundary(dto.endDate, true);
    }

    if (dto.keywords && dto.keywords.length > 0) {
      whereClause.OR = dto.keywords.map((kw: string) => ({
        descriptionRaw: { contains: kw.trim(), mode: 'insensitive' },
      }));
    }

    const matchingTx = await this.prisma.transaction.findMany({
      where: whereClause,
      select: { id: true },
    });

    const txIds = matchingTx.map((t) => t.id);
    if (txIds.length === 0) {
      return { matchedCount: 0, newlyTaggedCount: 0, newlyCategorizedCount: 0 };
    }

    let newlyCategorizedCount = 0;
    if (dto.categoryId !== undefined && dto.categoryId !== '') {
      const catId = dto.categoryId === 'uncategorised' || dto.categoryId === 'none' ? null : dto.categoryId;
      const res = await this.prisma.transaction.updateMany({
        where: { id: { in: txIds } },
        data: { categoryId: catId },
      });
      newlyCategorizedCount = res.count;
    }

    let newlyTaggedCount = 0;
    if (dto.tagIds && dto.tagIds.length > 0) {
      const userTags = await this.prisma.tag.findMany({
        where: { id: { in: dto.tagIds }, userId },
        select: { id: true },
      });
      const validTagIds = userTags.map((t) => t.id);

      for (const txId of txIds) {
        for (const tagId of validTagIds) {
          try {
            await this.prisma.transactionTag.create({
              data: { transactionId: txId, tagId },
            });
            newlyTaggedCount++;
          } catch {
            // Ignore duplicate
          }
        }
      }
    }

    return {
      matchedCount: txIds.length,
      newlyTaggedCount,
      newlyCategorizedCount,
    };
  }
}

function parseDateBoundary(dateStr: string, isEnd = false): Date {
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }
  if (isEnd) {
    return new Date(`${dateStr}T23:59:59.999Z`);
  }
  return new Date(`${dateStr}T00:00:00.000Z`);
}
