import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

export interface StockQuote {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch single ticker quote using Yahoo Finance v8 Chart API (which does not require crumb/auth)
   */
  private async fetchSingleQuote(rawSymbol: string): Promise<StockQuote | null> {
    const symbol = rawSymbol.toUpperCase().trim();
    if (!symbol) return null;

    // Try NSE (.NS) first, then BSE (.BO)
    const candidates = symbol.includes('.') ? [symbol] : [`${symbol}.NS`, `${symbol}.BO`];

    for (const ticker of candidates) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d`;
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const json = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (meta) {
            const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
            const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
            const change = price - prevClose;
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

            if (price > 0) {
              return {
                symbol,
                price,
                previousClose: prevClose,
                change,
                changePercent,
              };
            }
          }
        }
      } catch (err) {
        // Try next candidate or continue
      }
    }

    return null;
  }

  /**
   * Fetch live stock quotes for a list of symbols with concurrency control
   */
  async fetchQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const quotes = new Map<string, StockQuote>();
    if (!symbols.length) return quotes;

    const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase().trim())));
    const concurrency = 6;
    let index = 0;

    const worker = async () => {
      while (index < uniqueSymbols.length) {
        const currentIndex = index++;
        const symbol = uniqueSymbols[currentIndex];
        try {
          const quote = await this.fetchSingleQuote(symbol);
          if (quote) {
            quotes.set(symbol, quote);
          }
        } catch (err) {
          this.logger.warn(`Failed to fetch quote for ${symbol}`, err);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, uniqueSymbols.length) }, () => worker());
    await Promise.all(workers);

    return quotes;
  }

  /**
   * Refresh all live market quotes and update valuation for an account's holdings
   */
  async refreshAccountMarketPrices(userId: string, accountId: string) {
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
        message: 'No stock holdings found in this account to update.',
        updatedCount: 0,
      };
    }

    const symbols = account.holdings.map((h) => h.asset.symbol);
    const quotes = await this.fetchQuotes(symbols);

    if (quotes.size === 0) {
      throw new BadRequestException('Could not retrieve live market quotes at this time.');
    }

    let updatedCount = 0;
    let totalValuationMinor = 0;
    const asOfDate = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const holding of account.holdings) {
        const symbol = holding.asset.symbol;
        const quote = quotes.get(symbol);
        const qty = Number(holding.quantity);

        let priceMinor = Number(holding.previousClosingPrice || holding.averagePrice || 0);
        let prevCloseMinor = Number(holding.previousClosingPrice || 0);

        if (quote && quote.price > 0) {
          priceMinor = Math.round(quote.price * 100);
          prevCloseMinor = Math.round(quote.previousClose * 100);
          updatedCount++;
        }

        const currentValMinor = Math.round((priceMinor / 100) * qty * 100);
        const avgPriceMinor = Number(holding.averagePrice);
        const pnlMinor = Math.round(((priceMinor - avgPriceMinor) / 100) * qty * 100);

        totalValuationMinor += currentValMinor;

        await tx.portfolioHolding.update({
          where: { id: holding.id },
          data: {
            previousClosingPrice: BigInt(prevCloseMinor),
            currentValue: BigInt(currentValMinor),
            unrealizedPnl: BigInt(pnlMinor),
            asOfDate,
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
      message: `Successfully refreshed live market prices for ${updatedCount} instruments.`,
      updatedCount,
      totalValuation: totalValuationMinor / 100,
      asOfDate,
    };
  }
}
