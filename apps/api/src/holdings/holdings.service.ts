import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { parseGrowwHoldingsXlsx } from './groww-holdings-parser';

@Injectable()
export class HoldingsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadHoldings(userId: string, accountId: string, file: Express.Multer.File) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new ForbiddenException('Account not found.');
    }

    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Only .xlsx files are currently supported for holdings uploads.');
    }

    let parsedHoldings;
    try {
      // Currently, we only support Groww exports
      parsedHoldings = await parseGrowwHoldingsXlsx(file.buffer);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to parse the holdings file.');
    }

    // Process the holdings in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Get all existing portfolio holdings for this account to compare
      const existingHoldings = await tx.portfolioHolding.findMany({
        where: { accountId },
        include: { asset: true },
      });

      const updatedAssetIds = new Set<string>();

      for (const item of parsedHoldings) {
        // Upsert Asset using symbol (fallback to name if no symbol/isin is provided)
        // Note: Groww doesn't provide ISIN for mutual funds in this export format, so we use schemeName as the symbol
        const asset = await tx.asset.upsert({
          where: { symbol: item.assetName },
          create: {
            symbol: item.assetName,
            name: item.assetName,
            type: item.assetType,
          },
          update: {},
        });

        updatedAssetIds.add(asset.id);

        await tx.portfolioHolding.upsert({
          where: { accountId_assetId: { accountId, assetId: asset.id } },
          create: {
            accountId,
            assetId: asset.id,
            quantity: item.quantity,
            availableQuantity: item.quantity,
            averagePrice: BigInt(item.averagePriceMinor),
            currentValue: item.currentValueMinor ? BigInt(item.currentValueMinor) : null,
            unrealizedPnl: item.unrealizedPnlMinor ? BigInt(item.unrealizedPnlMinor) : null,
            asOfDate: new Date(),
          },
          update: {
            quantity: item.quantity,
            availableQuantity: item.quantity,
            averagePrice: BigInt(item.averagePriceMinor),
            currentValue: item.currentValueMinor ? BigInt(item.currentValueMinor) : null,
            unrealizedPnl: item.unrealizedPnlMinor ? BigInt(item.unrealizedPnlMinor) : null,
            asOfDate: new Date(),
          },
        });
      }

      // Any holding that was not in this upload should have quantity set to 0
      for (const existing of existingHoldings) {
        if (!updatedAssetIds.has(existing.assetId)) {
          await tx.portfolioHolding.update({
            where: { id: existing.id },
            data: {
              quantity: 0,
              availableQuantity: 0,
              currentValue: 0,
              asOfDate: new Date(),
            },
          });
        }
      }
    });

    return { message: 'Holdings updated successfully.', parsedCount: parsedHoldings.length };
  }
}
