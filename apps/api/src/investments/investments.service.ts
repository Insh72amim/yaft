import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolio(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, type: { in: ['INVESTMENT', 'STOCKS'] } },
      include: {
        holdings: {
          include: { asset: true }
        }
      }
    });

    return accounts.map(account => ({
      accountId: account.id,
      name: account.name,
      holdings: account.holdings.map(h => ({
        id: h.id,
        asset: h.asset.name,
        symbol: h.asset.symbol,
        quantity: h.quantity,
        averagePrice: h.averagePrice,
        currentValue: h.currentValue,
        asOfDate: h.asOfDate
      }))
    }));
  }
}
