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
   * Fetch live stock quotes from Yahoo Finance (free, supports .NS and .BO tickers)
   */
  async fetchQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const quotes = new Map<string, StockQuote>();
    if (!symbols.length) return quotes;

    // Filter unique clean uppercase symbols
    const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase().trim())));
    
    // Chunk requests into batches of 20
    const chunkSize = 20;
    for (let i = 0; i < uniqueSymbols.length; i += chunkSize) {
      const chunk = uniqueSymbols.slice(i, i + chunkSize);
      
      // Try NSE ticker (.NS)
      const yahooSymbols = chunk.map((s) => (s.includes('.') ? s : `${s}.NS`)).join(',');
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbols)}`;

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (res.ok) {
          const json = await res.json();
          const result = json?.quoteResponse?.result;
          if (Array.isArray(result)) {
            for (const item of result) {
              const baseSymbol = item.symbol.replace('.NS', '').replace('.BO', '');
              const price = item.regularMarketPrice ?? item.currentPrice ?? 0;
              const prevClose = item.regularMarketPreviousClose ?? item.previousClose ?? price;
              const change = item.regularMarketChange ?? (price - prevClose);
              const changePercent = item.regularMarketChangePercent ?? 0;

              if (price > 0) {
                quotes.set(baseSymbol, {
                  symbol: baseSymbol,
                  price,
                  previousClose: prevClose,
                  change,
                  changePercent,
                });
              }
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch Yahoo Finance quotes for batch: ${chunk.join(', ')}`, err);
      }
    }

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
