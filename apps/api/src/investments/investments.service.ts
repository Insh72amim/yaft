import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { parseZerodhaHoldings } from './zerodha-holdings-parser';
import { parseGrowwHoldingsXlsx as parseGrowwHoldings } from './groww-holdings-parser';

type PortfolioAccount = Prisma.AccountGetPayload<{ include: { holdings: { include: { asset: true } } } }>;
const SNAPSHOT_TRANSACTION_ATTEMPTS = 3;

function isSerializableConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolio(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, type: { in: ['INVESTMENT', 'STOCKS'] } },
      orderBy: { createdAt: 'desc' },
      include: { holdings: { include: { asset: true }, orderBy: { asset: { symbol: 'asc' } } } },
    });
    return accounts.map((account) => this.serializeAccount(account));
  }

  async importZerodhaHoldings(userId: string, accountId: string, file: Express.Multer.File) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId, archived: false } });
    if (!account) throw new ForbiddenException('Investment account not found.');
    if (!['INVESTMENT', 'STOCKS'].includes(account.type)) {
      throw new BadRequestException('Zerodha holdings can only be imported into a stock or investment account.');
    }
    const institution = account.institution?.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (institution && !institution.includes('zerodha') && !institution.includes('kite')) {
      throw new BadRequestException('The selected account belongs to a different institution.');
    }

    const parsed = await parseZerodhaHoldings(file);
    const asOfDate = new Date();
    for (let attempt = 1; attempt <= SNAPSHOT_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const importedAssetIds: string[] = [];
          for (const holding of parsed) {
            const bySymbol = await tx.asset.findUnique({ where: { symbol: holding.symbol } });
            const byIsin = await tx.asset.findUnique({ where: { isin: holding.isin } });
            if (bySymbol && byIsin && bySymbol.id !== byIsin.id) {
              throw new BadRequestException(`The Zerodha symbol ${holding.symbol} conflicts with an existing asset.`);
            }
            if (bySymbol?.isin && bySymbol.isin !== holding.isin) {
              throw new BadRequestException(`The Zerodha symbol ${holding.symbol} has a different ISIN from the existing asset.`);
            }
            const existing = bySymbol ?? byIsin;
            const asset = existing
              ? await tx.asset.update({ where: { id: existing.id }, data: { symbol: holding.symbol, name: holding.symbol,
                type: holding.assetType, isin: holding.isin, sector: holding.sector } })
              : await tx.asset.create({ data: { symbol: holding.symbol, name: holding.symbol,
                type: holding.assetType, isin: holding.isin, sector: holding.sector } });
            importedAssetIds.push(asset.id);
            const values = { quantity: holding.quantity.toString(), availableQuantity: holding.availableQuantity.toString(),
              discrepantQuantity: holding.discrepantQuantity.toString(), longTermQuantity: holding.longTermQuantity?.toString(),
              pledgedQuantity: holding.pledgedQuantity.toString(), averagePrice: BigInt(holding.averagePriceMinor),
              previousClosingPrice: BigInt(holding.previousClosingPriceMinor), currentValue: BigInt(holding.currentValueMinor),
              unrealizedPnl: BigInt(holding.unrealizedPnlMinor), asOfDate };
            await tx.portfolioHolding.upsert({ where: { accountId_assetId: { accountId, assetId: asset.id } },
              create: { accountId, assetId: asset.id, ...values }, update: values });
          }
          await tx.portfolioHolding.deleteMany({ where: { accountId, assetId: { notIn: importedAssetIds } } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (error) {
        if (!isSerializableConflict(error) || attempt === SNAPSHOT_TRANSACTION_ATTEMPTS) throw error;
      }
    }

    const portfolio = await this.getPortfolio(userId);
    return { imported: parsed.length, account: portfolio.find((item) => item.accountId === accountId) };
  }

  async importGrowwHoldings(userId: string, accountId: string, file: Express.Multer.File) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId, archived: false } });
    if (!account) throw new ForbiddenException('Investment account not found.');
    if (!['INVESTMENT', 'STOCKS'].includes(account.type)) {
      throw new BadRequestException('Groww holdings can only be imported into a stock or investment account.');
    }
    const institution = account.institution?.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (institution && !institution.includes('groww')) {
      throw new BadRequestException('The selected account belongs to a different institution.');
    }

    const parsed = await parseGrowwHoldings(file.buffer);
    const asOfDate = new Date();
    for (let attempt = 1; attempt <= SNAPSHOT_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const importedAssetIds: string[] = [];
          for (const holding of parsed) {
            const bySymbol = await tx.asset.findUnique({ where: { symbol: holding.assetName } });
            
            const asset = bySymbol
              ? await tx.asset.update({ where: { id: bySymbol.id }, data: { symbol: holding.assetName, name: holding.assetName,
                type: holding.assetType } })
              : await tx.asset.create({ data: { symbol: holding.assetName, name: holding.assetName,
                type: holding.assetType } });
            
            importedAssetIds.push(asset.id);
            const values = { quantity: holding.quantity.toString(), availableQuantity: holding.quantity.toString(),
              discrepantQuantity: '0', longTermQuantity: null,
              pledgedQuantity: '0', averagePrice: BigInt(holding.averagePriceMinor),
              previousClosingPrice: null, currentValue: holding.currentValueMinor ? BigInt(holding.currentValueMinor) : null,
              unrealizedPnl: holding.unrealizedPnlMinor ? BigInt(holding.unrealizedPnlMinor) : null, asOfDate };
            await tx.portfolioHolding.upsert({ where: { accountId_assetId: { accountId, assetId: asset.id } },
              create: { accountId, assetId: asset.id, ...values }, update: values });
          }
          await tx.portfolioHolding.deleteMany({ where: { accountId, assetId: { notIn: importedAssetIds } } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (error) {
        if (!isSerializableConflict(error) || attempt === SNAPSHOT_TRANSACTION_ATTEMPTS) throw error;
      }
    }

    const portfolio = await this.getPortfolio(userId);
    return { imported: parsed.length, account: portfolio.find((item) => item.accountId === accountId) };
  }

  private serializeAccount(account: PortfolioAccount) {
    const holdings = account.holdings.map((holding) => ({
      id: holding.id,
      asset: holding.asset.name,
      symbol: holding.asset.symbol,
      isin: holding.asset.isin,
      sector: holding.asset.sector,
      assetType: holding.asset.type,
      quantity: holding.quantity.toString(),
      availableQuantity: holding.availableQuantity.toString(),
      discrepantQuantity: holding.discrepantQuantity.toString(),
      longTermQuantity: holding.longTermQuantity?.toString() ?? null,
      pledgedQuantity: holding.pledgedQuantity.toString(),
      averagePrice: Number(holding.averagePrice),
      previousClosingPrice: holding.previousClosingPrice === null ? null : Number(holding.previousClosingPrice),
      currentValue: holding.currentValue === null ? null : Number(holding.currentValue),
      unrealizedPnl: holding.unrealizedPnl === null ? null : Number(holding.unrealizedPnl),
      asOfDate: holding.asOfDate,
    }));
    const importedValue = holdings.reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0);
    return {
      accountId: account.id,
      name: account.name,
      institution: account.institution,
      investedValue: holdings.reduce((sum, holding) => sum + Math.round(Number(holding.quantity) * holding.averagePrice), 0),
      currentValue: holdings.length ? importedValue : Number(account.openingBalance),
      unrealizedPnl: holdings.reduce((sum, holding) => sum + (holding.unrealizedPnl ?? 0), 0),
      holdings,
    };
  }
}
