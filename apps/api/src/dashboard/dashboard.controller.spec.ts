import type { PrismaService } from '../common/prisma.service';
import { DashboardController } from './dashboard.controller';

describe('DashboardController portfolio valuation', () => {
  it('uses fully valued holdings for an investment account and net worth', async () => {
    const accountFindMany = jest.fn().mockResolvedValue([{
      id: 'fund-account', name: 'Synthetic mutual funds', type: 'INVESTMENT', openingBalance: 1_000n,
      creditLimit: null, dueDay: null, transactions: [{ amount: 250n }],
      holdings: [{ currentValue: 2_000n }, { currentValue: 3_500n }],
    }]);
    const transactionFindMany = jest.fn().mockResolvedValue([]);
    const prisma = { account: { findMany: accountFindMany }, transaction: { findMany: transactionFindMany } } as unknown as PrismaService;
    const controller = new DashboardController(prisma);

    const result = await controller.overview({ id: 'owner-a' }, '2026-01');

    expect(result.accounts[0]).toMatchObject({ id: 'fund-account', type: 'INVESTMENT', balance: 5_500 });
    expect(result.netWorth).toBe(5_500);
    expect(accountFindMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ holdings: { select: { currentValue: true } } }),
    }));
  });

  it('falls back to the ledger balance when any holding is unvalued', async () => {
    const accountFindMany = jest.fn().mockResolvedValue([{
      id: 'fund-account', name: 'Synthetic mutual funds', type: 'INVESTMENT', openingBalance: 4_000n,
      creditLimit: null, dueDay: null, transactions: [{ amount: 500n }],
      holdings: [{ currentValue: 6_000n }, { currentValue: null }],
    }]);
    const prisma = { account: { findMany: accountFindMany }, transaction: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService;
    const controller = new DashboardController(prisma);

    const result = await controller.overview({ id: 'owner-a' }, '2026-01');

    expect(result.accounts[0].balance).toBe(4_500);
    expect(result.netWorth).toBe(4_500);
  });
});
