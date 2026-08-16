import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../src/common/prisma.service';
import { InvestmentsService } from '../../src/investments/investments.service';
import { parseZerodhaHoldings } from '../../src/investments/zerodha-holdings-parser';

jest.mock('../../src/investments/zerodha-holdings-parser', () => ({ parseZerodhaHoldings: jest.fn() }));

const parseHoldings = jest.mocked(parseZerodhaHoldings);
const file = { originalname: 'synthetic-holdings.xlsx', buffer: Buffer.from('PK-synthetic') } as Express.Multer.File;
const parsed = [{ symbol: 'SYNTHCO', isin: 'INE000A01001', sector: 'Synthetic services', assetType: 'STOCK' as const,
  quantity: 10, availableQuantity: 8, discrepantQuantity: 0, longTermQuantity: 5, pledgedQuantity: 2,
  averagePriceMinor: 10025, previousClosingPriceMinor: 11050, currentValueMinor: 110500, unrealizedPnlMinor: 10250 }];

function setup(institution: string | null = 'Zerodha') {
  const tx = {
    asset: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'asset-1' }), update: jest.fn() },
    portfolioHolding: { upsert: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma = {
    account: { findFirst: jest.fn().mockResolvedValue({ id: 'account-1', userId: 'user-1', type: 'STOCKS', institution }) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  const service = new InvestmentsService(prisma);
  jest.spyOn(service, 'getPortfolio').mockResolvedValue([{ accountId: 'account-1' }] as never);
  parseHoldings.mockResolvedValue(parsed);
  return { service, prisma: prisma as any, tx };
}

describe('InvestmentsService Zerodha import', () => {
  beforeEach(() => jest.clearAllMocks());

  it('atomically upserts a verified snapshot and removes holdings absent from it', async () => {
    const { service, prisma, tx } = setup();
    await expect(service.importZerodhaHoldings('user-1', 'account-1', file)).resolves.toEqual({
      imported: 1, account: { accountId: 'account-1' },
    });
    expect(parseHoldings).toHaveBeenCalledWith(file);
    expect(tx.asset.create).toHaveBeenCalledWith({ data: expect.objectContaining({ symbol: 'SYNTHCO', isin: 'INE000A01001' }) });
    expect(tx.portfolioHolding.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { accountId_assetId: { accountId: 'account-1', assetId: 'asset-1' } },
    }));
    expect(tx.portfolioHolding.deleteMany).toHaveBeenCalledWith({ where: { accountId: 'account-1', assetId: { notIn: ['asset-1'] } } });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('makes no database changes when parsing fails', async () => {
    const { service, prisma } = setup();
    parseHoldings.mockRejectedValue(new BadRequestException('Totals do not reconcile.'));
    await expect(service.importZerodhaHoldings('user-1', 'account-1', file)).rejects.toThrow('do not reconcile');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an account explicitly assigned to another institution', async () => {
    const { service } = setup('Another broker');
    await expect(service.importZerodhaHoldings('user-1', 'account-1', file)).rejects.toThrow('different institution');
    expect(parseHoldings).not.toHaveBeenCalled();
  });

  it('rejects an existing symbol bound to a different ISIN', async () => {
    const { service, tx } = setup();
    tx.asset.findUnique.mockResolvedValueOnce({ id: 'asset-1', symbol: 'SYNTHCO', isin: 'INE999Z01000' });
    await expect(service.importZerodhaHoldings('user-1', 'account-1', file)).rejects.toThrow('different ISIN');
    expect(tx.portfolioHolding.upsert).not.toHaveBeenCalled();
  });

  it('retries the complete serializable snapshot replacement after a transaction conflict', async () => {
    const { service, prisma, tx } = setup();
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce((callback: (client: typeof tx) => unknown) => callback(tx));
    await expect(service.importZerodhaHoldings('user-1', 'account-1', file)).resolves.toMatchObject({ imported: 1 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction.mock.calls.every((call: unknown[]) =>
      (call[1] as { isolationLevel?: string })?.isolationLevel === 'Serializable')).toBe(true);
    expect(parseHoldings).toHaveBeenCalledTimes(1);
  });

  it('stops after the bounded number of serializable transaction conflicts', async () => {
    const { service, prisma } = setup();
    prisma.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(service.importZerodhaHoldings('user-1', 'account-1', file)).rejects.toMatchObject({ code: 'P2034' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
});

describe('InvestmentsService portfolio details', () => {
  it('serializes quantity buckets, prices, identifiers, values, and totals', async () => {
    const prisma = { account: { findMany: jest.fn().mockResolvedValue([{ id: 'account-1', name: 'Synthetic portfolio',
      institution: 'Zerodha', openingBalance: 0n, createdAt: new Date(), holdings: [{ id: 'holding-1', quantity: { toString: () => '10' },
        availableQuantity: { toString: () => '8' }, discrepantQuantity: { toString: () => '0' },
        longTermQuantity: { toString: () => '5' }, pledgedQuantity: { toString: () => '2' }, averagePrice: 10025n,
        previousClosingPrice: 11050n, currentValue: 110500n, unrealizedPnl: 10250n, asOfDate: new Date('2026-07-18T00:00:00.000Z'),
        asset: { name: 'SYNTHCO', symbol: 'SYNTHCO', isin: 'INE000A01001', sector: 'Synthetic services', type: 'STOCK' } }] }]) } } as unknown as PrismaService;
    const service = new InvestmentsService(prisma);
    await expect(service.getPortfolio('user-1')).resolves.toEqual([expect.objectContaining({ accountId: 'account-1',
      investedValue: 100250, currentValue: 110500, unrealizedPnl: 10250,
      holdings: [expect.objectContaining({ symbol: 'SYNTHCO', isin: 'INE000A01001', quantity: '10',
        availableQuantity: '8', pledgedQuantity: '2', averagePrice: 10025, previousClosingPrice: 11050 })] })]);
  });

  it('uses the manually entered account value until the first holdings snapshot is imported', async () => {
    const prisma = { account: { findMany: jest.fn().mockResolvedValue([{ id: 'account-1', name: 'Manual portfolio',
      institution: 'Zerodha', openingBalance: 250000n, createdAt: new Date(), holdings: [] }]) } } as unknown as PrismaService;
    const service = new InvestmentsService(prisma);
    await expect(service.getPortfolio('user-1')).resolves.toEqual([expect.objectContaining({ currentValue: 250000, holdings: [] })]);
  });
});
