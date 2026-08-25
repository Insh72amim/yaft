import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchField, MatchType, CategoryRule } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateCategoryRuleDto, UpdateCategoryRuleDto } from './category-rules.dto';

export const BUILTIN_CATEGORY_PATTERNS: Array<[RegExp, string]> = [
  [/cred\s*cc|credit\s*card\s*payment|cc\s*payment|card\s*bill|cred\s*club|card\s*autopay/i, 'CC Transfer'],
  [/self\s*transfer|transfer\s*to\s*self|internal\s*transfer|own\s*account|sweep\s*transfer/i, 'Self Transfer'],
  [/upi\s*lite|upilite|topup\s*lite/i, 'UPI Lite'],
  [/swiggy|zomato|instamart|starbucks|chaayos|dominos|mcdonalds|kfc|subway|burger\s*king|pizza|haldiram|barbeque\s*nation|behrouz|faasos|eatclub|third\s*wave|blue\s*tokai|cafe\s*coffee|costa|wow\s*momo|bira|brewery|rest|cafe|diner|bakery|bistro|dhaba|kitchen|food\s*court|canteen|chai\s*point|eats/i, 'Food & Dining'],
  [/blinkit|zepto|bigbasket|bbdaily|dmart|spar|natures\s*basket|country\s*delight|dunzo\s*daily|milk\s*basket|freshtohome|licious|grocery|supermarket|kirana|provision|hypermarket|milk|vegetable|meat/i, 'Groceries'],
  [/amazon|flipkart|myntra|tatacliq|ajio|nykaa|zara|uniqlo|decathlon|westside|reliance\s*trends|meesho|max\s*fashion|h&m|lifestyle|croma|vijay\s*sales|apple\s*store|pantaloons|shoppers\s*stop|urbanic|snitch|bewakoof|fabindia|marks\s*&\s*spencer|ikea|lenskart|titan|tanishq|caratlane|kalyan|malabar/i, 'Shopping & Clothing'],
  [/uber|ola|rapido|blusmart|petrol|shell|hpcl|bpcl|iocl|indian\s*oil|fuel|irctc|indian\s*railways|indigo|air\s*india|vistara|akasa|spicejet|fastag|toll|metro|parking|makemytrip|mmt|goibibo|cleartrip|easemytrip|yatra|red\s*bus|redbus|abhibus|zoomcar/i, 'Transport & Fuel'],
  [/bescom|tata\s*power|msedcl|bses|cesc|tneb|wbsedcl|torrent\s*power|adani\s*electricity|airtel|jio|vi |actfibernet|tata\s*play|dish\s*tv|sun\s*direct|indane|bharat\s*gas|hp\s*gas|igl|mgl|adani\s*gas|electricity|water\s*bill|bwssb|djb|broadband|billdesk|bbps|recharge|paytm\s*postpaid|insurance|lic|hdfc\s*life|icici\s*pru|star\s*health|care\s*health|niva\s*bupa|max\s*life|policybazaar/i, 'Bills & Utilities'],
  [/netflix|spotify|prime\s*video|hotstar|youtube|apple\.com|bookmyshow|pvr|inox|cinepolis|cinema|playstation|steam|xbox|nintendo|amazon\s*prime|sonyliv|zee5|jiocinema|gaana|wynk|audible|kindle/i, 'Entertainment & OTT'],
  [/zerodha|groww|kfintech|cams|camsonline|mf\s*central|mutual\s*fund|sip|folio|units\s*allotted|nav\s*:|uti\s*mf|hdfc\s*mf|sbi\s*mf|icici\s*pru|axis\s*mf|mirae\s*asset|nippon\s*india|ppfas|parag\s*parikh|kotak\s*mf|motilal|quant\s*mf|dsp\s*mf|edelweiss|indmoney|kuvera|dhan|upstox|demat|sgb|nps|ppf|kite|coin/i, 'Mutual Fund SIP'],
  [/apollo|netmeds|pharmeasy|1mg|tata\s*1mg|medplus|practo|cult\.fit|cultpass|gym|gold's\s*gym|fitness|hospital|clinic|lab|diagnostics|srl|dr\s*lal|metropolis|pharmacy|chemist|healthkart|dental|optical|wellness/i, 'Medical & Health'],
  [/cred\s*rent|nobroker|society\s*maintenance|mygate|nobrokerhood|adda|housing|apartment|rent\s*payment|landlord/i, 'Housing & Rent'],
  [/salary|payroll|stipend|bonus|incentive|allowance|remuneration|employer/i, 'Salary & Wages'],
  [/cashback|interest\s*credited|bank\s*interest|reward\s*points?|refund\s*credited|auto\s*reversal|dividend/i, 'Interest & Cashback'],
];

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

    const rule = await this.prisma.categoryRule.create({
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

    void this.applyRetroactively(userId);
    return rule;
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

    const updatedRule = await this.prisma.categoryRule.update({
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

    void this.applyRetroactively(userId);
    return updatedRule;
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

  matchTransactionCategory(
    rules: CategoryRule[],
    categories: { id: string; name: string }[],
    descriptionRaw: string,
    merchant?: string | null,
    reference?: string | null,
    suggestedCategoryName?: string | null,
  ): { categoryId?: string; confidence: number } {
    // 1. Check user custom rules first (highest priority)
    if (rules && rules.length > 0) {
      const matchedCatId = this.matchRules(rules, descriptionRaw, merchant, reference);
      if (matchedCatId) {
        return { categoryId: matchedCatId, confidence: 95 };
      }
    }

    // 2. Check alert parser suggested category hint (e.g. 'Mutual Fund SIP')
    if (suggestedCategoryName) {
      const foundSuggested = categories.find(
        (c) =>
          c.name.toLowerCase() === suggestedCategoryName.toLowerCase() ||
          c.name.toLowerCase().includes(suggestedCategoryName.toLowerCase()) ||
          suggestedCategoryName.toLowerCase().includes(c.name.toLowerCase()),
      );
      if (foundSuggested) {
        return { categoryId: foundSuggested.id, confidence: 90 };
      }
    }

    // 3. Check built-in smart merchant patterns
    const textToMatch = `${merchant || ''} ${descriptionRaw} ${reference || ''}`.trim();
    for (const [pattern, catName] of BUILTIN_CATEGORY_PATTERNS) {
      if (pattern.test(textToMatch)) {
        const found = categories.find(
          (c) =>
            c.name.toLowerCase() === catName.toLowerCase() ||
            c.name.toLowerCase().includes(catName.toLowerCase()) ||
            catName.toLowerCase().includes(c.name.toLowerCase()),
        );
        if (found) {
          return { categoryId: found.id, confidence: 85 };
        }
      }
    }

    return { confidence: 20 };
  }

  async applyRetroactively(userId: string): Promise<{ updatedCount: number }> {
    const [rules, categories] = await Promise.all([
      this.prisma.categoryRule.findMany({
        where: { userId },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      this.listCategories(userId),
    ]);

    const transactions = await this.prisma.transaction.findMany({
      where: { account: { userId } },
      select: { id: true, descriptionRaw: true, merchant: true, reference: true, categoryId: true },
    });

    let updatedCount = 0;
    for (const tx of transactions) {
      const { categoryId: matchedCatId } = this.matchTransactionCategory(
        rules,
        categories,
        tx.descriptionRaw,
        tx.merchant,
        tx.reference,
      );
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
    let list = await this.prisma.category.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        superCategoryId: true,
        superCategory: {
          select: { id: true, name: true, kind: true, color: true },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    if (list.length === 0) {
      const defaults = [
        // INCOME Categories
        { name: 'Salary & Wages', type: 'INCOME' as const, color: '#22c55e' },
        { name: 'Dividends & Yield', type: 'INCOME' as const, color: '#10b981' },
        { name: 'Stock Sell Profits & Gains', type: 'INCOME' as const, color: '#059669' },
        { name: 'Freelance & Consulting', type: 'INCOME' as const, color: '#34d399' },
        { name: 'Interest & Cashback', type: 'INCOME' as const, color: '#14b8a6' },
        { name: 'Other Income', type: 'INCOME' as const, color: '#065f46' },

        // INVESTMENT Categories
        { name: 'Mutual Fund SIP', type: 'INVESTMENT' as const, color: '#3b82f6' },
        { name: 'Share Market & Equities', type: 'INVESTMENT' as const, color: '#6366f1' },
        { name: 'Fixed Deposits & RD', type: 'INVESTMENT' as const, color: '#8b5cf6' },
        { name: 'EPFO & PF Contribution', type: 'INVESTMENT' as const, color: '#a855f7' },
        { name: 'Gold & Commodities', type: 'INVESTMENT' as const, color: '#eab308' },
        { name: 'Crypto & Assets', type: 'INVESTMENT' as const, color: '#d946ef' },

        // EXPENSE Categories
        { name: 'Food & Dining', type: 'EXPENSE' as const, color: '#ef4444' },
        { name: 'Groceries', type: 'EXPENSE' as const, color: '#f97316' },
        { name: 'Shopping & Clothing', type: 'EXPENSE' as const, color: '#ec4899' },
        { name: 'Bills & Utilities', type: 'EXPENSE' as const, color: '#f59e0b' },
        { name: 'Housing & Rent', type: 'EXPENSE' as const, color: '#d97706' },
        { name: 'Transport & Fuel', type: 'EXPENSE' as const, color: '#0ea5e9' },
        { name: 'Entertainment & OTT', type: 'EXPENSE' as const, color: '#84cc16' },
        { name: 'Medical & Health', type: 'EXPENSE' as const, color: '#06b6d4' },
        { name: 'Miscellaneous', type: 'EXPENSE' as const, color: '#64748b' },
      ];

      await this.prisma.category.createMany({
        data: defaults.map((d) => ({ ...d, userId })),
        skipDuplicates: true,
      });

      list = await this.prisma.category.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
          superCategoryId: true,
          superCategory: {
            select: { id: true, name: true, kind: true, color: true },
          },
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    }

    // If user has no category rules yet, automatically seed the default system rules
    const ruleCount = await this.prisma.categoryRule.count({ where: { userId } });
    if (ruleCount === 0) {
      void this.seedDefaultRules(userId);
    }

    return list;
  }

  async createCategory(
    userId: string,
    name: string,
    color?: string,
    type?: any,
    superCategoryId?: string | null,
  ) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Category name cannot be empty.');
    }
    const existing = await this.prisma.category.findFirst({
      where: { userId, name: { equals: trimmed, mode: 'insensitive' } },
      include: { superCategory: true },
    });
    if (existing) {
      return existing;
    }

    let finalType = type || 'EXPENSE';
    if (superCategoryId) {
      const superCat = await this.prisma.superCategory.findFirst({
        where: { id: superCategoryId, userId },
      });
      if (superCat) {
        finalType = superCat.kind;
      }
    }

    return this.prisma.category.create({
      data: {
        userId,
        name: trimmed,
        color: color || '#3b82f6',
        type: finalType,
        superCategoryId: superCategoryId || null,
      },
      include: {
        superCategory: {
          select: { id: true, name: true, kind: true, color: true },
        },
      },
    });
  }

  async updateCategory(
    userId: string,
    id: string,
    name?: string,
    color?: string,
    type?: any,
    superCategoryId?: string | null,
  ) {
    const existing = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Category not found.');
    }

    const trimmed = name ? name.trim() : existing.name;
    if (!trimmed) {
      throw new BadRequestException('Category name cannot be empty.');
    }

    if (trimmed.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.category.findFirst({
        where: { userId, name: { equals: trimmed, mode: 'insensitive' }, id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestException(`Category with name "${trimmed}" already exists.`);
      }
    }

    let finalType = type !== undefined ? type : existing.type;
    if (superCategoryId) {
      const superCat = await this.prisma.superCategory.findFirst({
        where: { id: superCategoryId, userId },
      });
      if (superCat) {
        finalType = superCat.kind;
      }
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          name: trimmed,
          color: color !== undefined ? color : existing.color,
          type: finalType,
          superCategoryId: superCategoryId !== undefined ? superCategoryId : existing.superCategoryId,
        },
        include: {
          superCategory: {
            select: { id: true, name: true, kind: true, color: true },
          },
        },
      });
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Could not update category.');
    }
  }

  async deleteCategory(userId: string, id: string) {
    const existing = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Category not found.');
    }

    // Unlink transactions associated with this category
    await this.prisma.transaction.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });

    await this.prisma.category.delete({ where: { id } });
    return { success: true, message: 'Category deleted.' };
  }

  async seedDefaultRules(userId: string) {
    const categories = await this.listCategories(userId);

    const DEFAULT_SYSTEM_RULES = [
      { categoryName: 'Food & Dining', pattern: 'SWIGGY|ZOMATO|INSTAMART|STARBUCKS|CHAAYOS|DOMINOS|MCDONALDS|KFC|SUBWAY|PIZZA|REST|CAFE|DINER|BAKERY|BURGER|HALDIRAM|BARBEQUE|EATS', matchType: MatchType.REGEX, priority: 10 },
      { categoryName: 'Groceries', pattern: 'BLINKIT|ZEPTO|BIGBASKET|BBDAILY|DMART|SPAR|GROCERY|SUPERMARKET|KIRANA|NATURES BASKET|DUNZO|COUNTRY DELIGHT|MILK', matchType: MatchType.REGEX, priority: 10 },
      { categoryName: 'Shopping & Clothing', pattern: 'AMAZON|FLIPKART|MYNTRA|TATACLIQ|AJIO|NYKAA|ZARA|UNIQLO|DECATHLON|WESTSIDE|RELIANCE|MEESHO|MAX FASHION|H&M|LIFESTYLE|CROMA|VIJAY SALES', matchType: MatchType.REGEX, priority: 10 },
      { categoryName: 'Transport & Fuel', pattern: 'UBER|OLA|RAPIDO|BLUSMART|PETROL|SHELL|HPCL|BPCL|IOCL|FUEL|IRCTC|INDIGO|AIR INDIA|VISTARA|FASTAG|METRO|TOLL|MAKEMYTRIP|MMT|GOIBIBO|CLEARTRIP|EASEMYTRIP|YATRA|RED BUS|REDBUS|PARKING', matchType: MatchType.REGEX, priority: 10 },
      { categoryName: 'Bills & Utilities', pattern: 'CRED|BESCOM|TATA POWER|MSEDCL|BSES|CESC|AIRTEL|JIO|VI |ACTFIBERNET|TATA PLAY|DISH TV|INDANE|BHARAT GAS|HP GAS|ELECTRICITY|WATER BILL|BROADBAND|BILLDESK|RECHARGE|PAYTM POSTPAID|INSURANCE|LIC', matchType: MatchType.REGEX, priority: 10 },
      { categoryName: 'Entertainment & OTT', pattern: 'NETFLIX|SPOTIFY|PRIME VIDEO|HOTSTAR|YOUTUBE|APPLE.COM|BOOKMYSHOW|PVR|INOX|CINEMA|PLAYSTATION|STEAM|AMAZON PRIME', matchType: MatchType.REGEX, priority: 10 },
      { categoryName: 'Mutual Fund SIP', pattern: 'ZERODHA|GROWW|KFINTECH|CAMS|COIN|MF CENTRAL|SIP|SGB|NPS|EPFO|PPF|MUTUAL FUND|INDMONEY|KITE', matchType: MatchType.REGEX, priority: 10 },
      { categoryName: 'Medical & Health', pattern: 'APOLLO|NETMEDS|PHARMEASY|1MG|MEDPLUS|HOSPITAL|CLINIC|LAB|DIAGNOSTICS|PHARMACY|HEALTHKART|CULT.FIT|GYM', matchType: MatchType.REGEX, priority: 10 },
      { categoryName: 'Housing & Rent', pattern: 'RENT|CRED RENT|NOBROKER|SOCIETY MAINTENANCE|MYGATE|HOUSING', matchType: MatchType.REGEX, priority: 10 },
      { categoryName: 'Salary & Wages', pattern: 'SALARY|PAYROLL|STIPEND|BONUS', matchType: MatchType.REGEX, priority: 10 },
      { categoryName: 'Interest & Cashback', pattern: 'CASHBACK|INTEREST|REWARD|REFUND', matchType: MatchType.REGEX, priority: 10 },
    ];

    let createdCount = 0;
    for (const ruleDef of DEFAULT_SYSTEM_RULES) {
      const cat = categories.find((c) => c.name.toLowerCase() === ruleDef.categoryName.toLowerCase()) || categories[0];
      if (!cat) continue;

      const existing = await this.prisma.categoryRule.findFirst({
        where: { userId, pattern: ruleDef.pattern },
      });
      if (!existing) {
        await this.prisma.categoryRule.create({
          data: {
            userId,
            pattern: ruleDef.pattern,
            matchField: MatchField.DESCRIPTION,
            matchType: ruleDef.matchType,
            categoryId: cat.id,
            priority: ruleDef.priority,
          },
        });
        createdCount++;
      }
    }

    const { updatedCount } = await this.applyRetroactively(userId);
    return { createdCount, appliedCount: updatedCount };
  }

  async getUnverifiedByCategory(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        categoryId: { not: null },
        userVerified: false,
      },
      select: {
        id: true,
        transactionDate: true,
        descriptionRaw: true,
        merchant: true,
        amount: true,
        userVerified: true,
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 500,
    });

    const categoryMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        categoryColor: string;
        category: { id: string; name: string; color: string };
        totalCount: number;
        unverifiedCount: number;
        sampleDescriptions: string[];
        transactionIds: string[];
        transactions: Array<{
          id: string;
          transactionDate: Date;
          descriptionRaw: string;
          merchant: string | null;
          amount: number;
          userVerified: boolean;
        }>;
      }
    >();

    transactions.forEach((tx) => {
      if (!tx.category) return;
      const catId = tx.category.id;
      const existing = categoryMap.get(catId) || {
        categoryId: tx.category.id,
        categoryName: tx.category.name,
        categoryColor: tx.category.color,
        category: tx.category,
        totalCount: 0,
        unverifiedCount: 0,
        sampleDescriptions: [],
        transactionIds: [],
        transactions: [],
      };

      existing.totalCount++;
      existing.unverifiedCount++;
      existing.transactionIds.push(tx.id);
      if (existing.sampleDescriptions.length < 5) {
        const sample = tx.merchant || tx.descriptionRaw;
        if (sample && !existing.sampleDescriptions.includes(sample)) {
          existing.sampleDescriptions.push(sample);
        }
      }
      existing.transactions.push({
        id: tx.id,
        transactionDate: tx.transactionDate,
        descriptionRaw: tx.descriptionRaw,
        merchant: tx.merchant,
        amount: Number(tx.amount),
        userVerified: tx.userVerified,
      });

      categoryMap.set(catId, existing);
    });

    return [...categoryMap.values()].sort((a, b) => b.unverifiedCount - a.unverifiedCount);
  }

  async confirmTransactions(userId: string, transactionIds: string[]) {
    if (!transactionIds || transactionIds.length === 0) return { updatedCount: 0 };
    const res = await this.prisma.transaction.updateMany({
      where: { id: { in: transactionIds }, account: { userId } },
      data: { userVerified: true },
    });
    return { updatedCount: res.count };
  }

  async confirmCategory(userId: string, categoryId: string) {
    const res = await this.prisma.transaction.updateMany({
      where: { categoryId, account: { userId } },
      data: { userVerified: true },
    });
    return { updatedCount: res.count };
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
        userVerified: true,
      },
    });

    return { updatedCount: result.count };
  }
}
