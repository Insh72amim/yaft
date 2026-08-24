import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface AmfiScheme {
  schemeCode: string;
  isinGrowth: string;
  isinReinv: string;
  schemeName: string;
  plan: string;
  option: string;
  nav: number;
  date: string;
  normalizedName: string;
}

@Injectable()
export class AmfiNavService {
  private readonly logger = new Logger(AmfiNavService.name);
  private cachedSchemes: AmfiScheme[] = [];
  private isinMap = new Map<string, AmfiScheme>();
  private codeMap = new Map<string, AmfiScheme>();
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cleans and normalizes scheme names for fuzzy comparison
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Fetches latest AMFI NAV data from portal.amfiindia.com
   */
  async loadAmfiNavMaster(forceRefresh = false): Promise<AmfiScheme[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedSchemes.length > 0 && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cachedSchemes;
    }

    try {
      this.logger.log('Fetching latest AMFI NAV master from portal.amfiindia.com...');
      const res = await fetch('https://portal.amfiindia.com/spages/NAVAll.txt', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/plain, */*',
        },
      });

      if (!res.ok) {
        throw new Error(`AMFI portal returned HTTP ${res.status}`);
      }

      const text = await res.text();
      const lines = text.split('\n');
      const schemes: AmfiScheme[] = [];
      const isinMap = new Map<string, AmfiScheme>();
      const codeMap = new Map<string, AmfiScheme>();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('Scheme Code') || trimmed.includes('Open Ended Schemes') || trimmed.includes('Close Ended')) {
          continue;
        }

        const parts = trimmed.split(';');
        if (parts.length >= 6) {
          const schemeCode = parts[0]?.trim();
          const isinGrowth = parts[1]?.trim();
          const isinReinv = parts[2]?.trim();
          const schemeName = parts[3]?.trim();
          const plan = parts[4]?.trim() || '';
          const option = parts[5]?.trim() || '';
          const navStr = parts[6]?.trim() || parts[5]?.trim();
          const date = parts[7]?.trim() || parts[6]?.trim();

          const nav = parseFloat(navStr);
          if (schemeCode && schemeName && !isNaN(nav) && nav > 0) {
            const fullName = `${schemeName} ${plan} ${option}`.trim();
            const scheme: AmfiScheme = {
              schemeCode,
              isinGrowth: isinGrowth === '-' ? '' : isinGrowth,
              isinReinv: isinReinv === '-' ? '' : isinReinv,
              schemeName: fullName,
              plan,
              option,
              nav,
              date,
              normalizedName: this.normalizeName(fullName),
            };

            schemes.push(scheme);
            if (schemeCode) codeMap.set(schemeCode, scheme);
            if (scheme.isinGrowth) isinMap.set(scheme.isinGrowth.toUpperCase(), scheme);
            if (scheme.isinReinv) isinMap.set(scheme.isinReinv.toUpperCase(), scheme);
          }
        }
      }

      this.cachedSchemes = schemes;
      this.isinMap = isinMap;
      this.codeMap = codeMap;
      this.lastFetchTime = now;
      this.logger.log(`Loaded ${schemes.length} AMFI schemes into memory.`);
      return schemes;
    } catch (err: any) {
      this.logger.error('Failed to fetch AMFI NAV master', err);
      if (this.cachedSchemes.length > 0) {
        this.logger.warn('Falling back to previously cached AMFI NAV data');
        return this.cachedSchemes;
      }
      throw new BadRequestException('Could not connect to AMFI NAV feed. Please try again later.');
    }
  }

  /**
   * Find matching AMFI scheme for a mutual fund asset
   */
  findMatchingScheme(assetName: string, isin?: string | null): AmfiScheme | null {
    // 1. Match by ISIN
    if (isin) {
      const cleanIsin = isin.toUpperCase().trim();
      const byIsin = this.isinMap.get(cleanIsin);
      if (byIsin) return byIsin;
    }

    // 2. Exact normalized name match
    const norm = this.normalizeName(assetName);
    const isDirect = norm.includes('direct');
    const isGrowth = norm.includes('growth');
    const isDividend = norm.includes('idcw') || norm.includes('dividend');

    // Filter candidate schemes with matching plan & option
    const candidates = this.cachedSchemes.filter((s) => {
      const sNorm = s.normalizedName;
      if (isDirect && !sNorm.includes('direct')) return false;
      if (!isDirect && sNorm.includes('direct')) return false;
      if (isGrowth && !sNorm.includes('growth')) return false;
      if (isDividend && !(sNorm.includes('idcw') || sNorm.includes('dividend'))) return false;
      return true;
    });

    // Score candidates by token overlap
    const tokens = norm.split(' ').filter((t) => t.length > 2 && t !== 'direct' && t !== 'growth' && t !== 'fund' && t !== 'plan');
    let bestMatch: AmfiScheme | null = null;
    let highestScore = 0;

    for (const cand of candidates) {
      let score = 0;
      for (const token of tokens) {
        if (cand.normalizedName.includes(token)) {
          score += 1;
        }
      }
      if (score > highestScore && score >= Math.min(tokens.length, 3)) {
        highestScore = score;
        bestMatch = cand;
      }
    }

    return bestMatch;
  }

  /**
   * Refresh all live NAVs and recalculate valuations for a specific Mutual Fund account
   */
  async refreshAccountNavs(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
      include: {
        holdings: {
          include: { asset: true },
        },
      },
    });

    if (!account) throw new ForbiddenException('Account not found.');
    if (!account.holdings.length) {
      return {
        success: true,
        message: 'No mutual fund holdings found in this account to update.',
        updatedCount: 0,
      };
    }

    await this.loadAmfiNavMaster();

    let updatedCount = 0;
    let totalValuationMinor = 0;
    let totalInvestedMinor = 0;
    let latestNavDate = '';

    await this.prisma.$transaction(async (tx) => {
      for (const holding of account.holdings) {
        const assetName = holding.asset.name || holding.asset.symbol;
        const matched = this.findMatchingScheme(assetName, holding.asset.isin);
        const qty = Number(holding.quantity);
        const avgPriceMinor = Number(holding.averagePrice || 0);

        let navMinor = Number(holding.previousClosingPrice || 0);
        let navDate = holding.asOfDate;

        if (matched && matched.nav > 0) {
          navMinor = Math.round(matched.nav * 100);
          latestNavDate = matched.date;
          updatedCount++;
        }

        const currentValMinor = Math.round((navMinor / 100) * qty * 100);
        const investedValMinor = Math.round((avgPriceMinor / 100) * qty * 100);
        const pnlMinor = currentValMinor - investedValMinor;

        totalValuationMinor += currentValMinor;
        totalInvestedMinor += investedValMinor;

        await tx.portfolioHolding.update({
          where: { id: holding.id },
          data: {
            previousClosingPrice: BigInt(navMinor),
            currentValue: BigInt(currentValMinor),
            unrealizedPnl: BigInt(pnlMinor),
            asOfDate: new Date(),
          },
        });
      }

      await tx.account.update({
        where: { id: accountId },
        data: {
          openingBalance: BigInt(totalValuationMinor),
        },
      });
    });

    return {
      success: true,
      message: `Successfully updated ${updatedCount} mutual funds with official AMFI NAVs${latestNavDate ? ` as of ${latestNavDate}` : ''}.`,
      updatedCount,
      totalHoldings: account.holdings.length,
      totalValuation: totalValuationMinor / 100,
      totalInvested: totalInvestedMinor / 100,
      unrealizedPnl: (totalValuationMinor - totalInvestedMinor) / 100,
      navDate: latestNavDate,
    };
  }

  /**
   * Scheduled job / Bulk refresh for all Mutual Fund accounts
   */
  async refreshAllMutualFunds(userId?: string) {
    try {
      this.logger.log('Executing automated AMFI NAV sync for all Mutual Fund accounts...');
      await this.loadAmfiNavMaster(true);

      const accounts = await this.prisma.account.findMany({
        where: {
          archived: false,
          type: 'MUTUAL_FUND',
          ...(userId ? { userId } : {}),
        },
      });

      let totalUpdated = 0;
      for (const account of accounts) {
        try {
          const res = await this.refreshAccountNavs(account.userId, account.id);
          totalUpdated += res.updatedCount || 0;
        } catch (err) {
          this.logger.warn(`Failed to auto-refresh NAVs for account ${account.name} (${account.id})`, err);
        }
      }

      this.logger.log(`Completed automated AMFI NAV sync. Refreshed ${totalUpdated} mutual fund holdings.`);
      return { totalAccounts: accounts.length, totalUpdated };
    } catch (err) {
      this.logger.error('Failed automated AMFI NAV sync', err);
      throw err;
    }
  }
}
