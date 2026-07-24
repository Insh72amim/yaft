import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchField, MatchType, CategoryRule } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateCategoryRuleDto, UpdateCategoryRuleDto } from './category-rules.dto';

@Injectable()
export class CategoryRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.categoryRule.findMany({
      where: { userId },
      include: { category: { select: { id: true, name: true, color: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateCategoryRuleDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, userId },
    });
    if (!category) {
      throw new BadRequestException('Category not found.');
    }

    if (dto.matchType === MatchType.REGEX) {
      try {
        new RegExp(dto.pattern, 'i');
      } catch (err) {
        throw new BadRequestException('Invalid regular expression pattern.');
      }
    }

    return this.prisma.categoryRule.create({
      data: {
        userId,
        pattern: dto.pattern.trim(),
        matchField: dto.matchField ?? MatchField.DESCRIPTION,
        matchType: dto.matchType ?? MatchType.CONTAINS,
        categoryId: dto.categoryId,
        priority: dto.priority ?? 0,
      },
      include: { category: { select: { id: true, name: true, color: true } } },
    });
  }

  async update(userId: string, id: string, dto: UpdateCategoryRuleDto) {
    const existing = await this.prisma.categoryRule.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Category rule not found.');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, userId },
      });
      if (!category) {
        throw new BadRequestException('Category not found.');
      }
    }

    const pattern = dto.pattern ? dto.pattern.trim() : existing.pattern;
    const matchType = dto.matchType ?? existing.matchType;

    if (matchType === MatchType.REGEX) {
      try {
        new RegExp(pattern, 'i');
      } catch (err) {
        throw new BadRequestException('Invalid regular expression pattern.');
      }
    }

    return this.prisma.categoryRule.update({
      where: { id },
      data: {
        pattern,
        matchField: dto.matchField ?? existing.matchField,
        matchType,
        categoryId: dto.categoryId ?? existing.categoryId,
        priority: dto.priority ?? existing.priority,
      },
      include: { category: { select: { id: true, name: true, color: true } } },
    });
  }

  async delete(userId: string, id: string) {
    const existing = await this.prisma.categoryRule.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Category rule not found.');
    }
    await this.prisma.categoryRule.delete({ where: { id } });
  }

  matchesText(text: string, pattern: string, matchType: MatchType): boolean {
    if (!text || !pattern) return false;
    const source = text.toLowerCase();
    const target = pattern.toLowerCase();

    switch (matchType) {
      case MatchType.EXACT:
        return source === target;
      case MatchType.STARTS_WITH:
        return source.startsWith(target);
      case MatchType.CONTAINS:
        return source.includes(target);
      case MatchType.REGEX:
        try {
          return new RegExp(pattern, 'i').test(text);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  matchRules(
    rules: CategoryRule[],
    descriptionRaw: string,
    merchant?: string | null,
    reference?: string | null,
  ): string | null {
    for (const rule of rules) {
      let targetText = descriptionRaw;
      if (rule.matchField === MatchField.MERCHANT && merchant) {
        targetText = merchant;
      } else if (rule.matchField === MatchField.REFERENCE && reference) {
        targetText = reference;
      }

      if (this.matchesText(targetText, rule.pattern, rule.matchType)) {
        return rule.categoryId;
      }
    }
    return null;
  }

  async applyRetroactively(userId: string): Promise<{ updatedCount: number }> {
    const rules = await this.prisma.categoryRule.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    if (rules.length === 0) return { updatedCount: 0 };

    const transactions = await this.prisma.transaction.findMany({
      where: { account: { userId } },
      select: { id: true, descriptionRaw: true, merchant: true, reference: true, categoryId: true },
    });

    let updatedCount = 0;
    for (const tx of transactions) {
      const matchedCatId = this.matchRules(rules, tx.descriptionRaw, tx.merchant, tx.reference);
      if (matchedCatId && matchedCatId !== tx.categoryId) {
        await this.prisma.transaction.update({
          where: { id: tx.id },
          data: { categoryId: matchedCatId },
        });
        updatedCount++;
      }
    }

    return { updatedCount };
  }

  async listCategories(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
  }

  async batchUpdate(userId: string, transactionIds: string[], categoryId: string | null) {
    if (!transactionIds || transactionIds.length === 0) {
      return { updatedCount: 0 };
    }

    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: categoryId, userId },
      });
      if (!category) {
        throw new BadRequestException('Category not found.');
      }
    }

    const result = await this.prisma.transaction.updateMany({
      where: {
        id: { in: transactionIds },
        account: { userId },
      },
      data: {
        categoryId: categoryId || null,
      },
    });

    return { updatedCount: result.count };
  }
}
