import type { PrismaService } from '../common/prisma.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController & DashboardService', () => {
  it('uses fully valued holdings for an investment account in assets-history', async () => {
    const accountFindMany = jest.fn().mockResolvedValue([{
      id: 'fund-account', name: 'Synthetic mutual funds', type: 'INVESTMENT', openingBalance: 1_000n,
      creditLimit: null, dueDay: null, transactions: [{ amount: 250n, transactionDate: new Date() }],
      holdings: [{ currentValue: 2_000n, asset: { symbol: 'AAPL', name: 'Apple', type: 'STOCKS' } }, { currentValue: 3_500n, asset: { symbol: 'GOOGL', name: 'Alphabet', type: 'STOCKS' } }],
    }]);
    const prisma = {
      account: { findMany: accountFindMany },
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);
    const controller = new DashboardController(service);

    const result = await controller.getAssetsHistory({ id: 'owner-a' });

    expect(result.accounts[0]).toMatchObject({ id: 'fund-account', type: 'INVESTMENT', balance: 5_500 });
    expect(result.netWorth).toBe(5_500);
  });

  it('falls back to the ledger balance when any holding is unvalued', async () => {
    const accountFindMany = jest.fn().mockResolvedValue([{
      id: 'fund-account', name: 'Synthetic mutual funds', type: 'INVESTMENT', openingBalance: 4_000n,
      creditLimit: null, dueDay: null, transactions: [{ amount: 500n, transactionDate: new Date() }],
      holdings: [{ currentValue: 6_000n, asset: { symbol: 'AAPL', name: 'Apple', type: 'STOCKS' } }, { currentValue: null, asset: { symbol: 'GOOGL', name: 'Alphabet', type: 'STOCKS' } }],
    }]);
    const prisma = {
      account: { findMany: accountFindMany },
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);
    const controller = new DashboardController(service);

    const result = await controller.getAssetsHistory({ id: 'owner-a' });

    expect(result.accounts[0].balance).toBe(4_500);
    expect(result.netWorth).toBe(4_500);
  });

  it('calculates savingsNetInbound and savingsNetOutbound excluding internal transfers', async () => {
    const accountFindMany = jest.fn().mockResolvedValue([
      { id: 'acc-sbi', name: 'SBI Savings', type: 'SAVINGS', openingBalance: 0n, creditLimit: null, dueDay: null, transactions: [], holdings: [] },
    ]);
    const transactionFindMany = jest.fn().mockResolvedValue([
      { id: 'tx-salary', amount: 50_000n, accountId: 'acc-sbi', account: { id: 'acc-sbi', name: 'SBI Savings', type: 'SAVINGS' }, descriptionRaw: 'SALARY CREDIT' },
      { id: 'tx-transfer', amount: 10_000n, accountId: 'acc-sbi', account: { id: 'acc-sbi', name: 'SBI Savings', type: 'SAVINGS' }, descriptionRaw: 'TRANSFER TO HDFC 1234', transferGroupId: 'grp-1' },
      { id: 'tx-rent', amount: -15_000n, accountId: 'acc-sbi', account: { id: 'acc-sbi', name: 'SBI Savings', type: 'SAVINGS' }, descriptionRaw: 'HOUSE RENT' },
    ]);
    const accountVaultEntryFindMany = jest.fn().mockResolvedValue([]);

    const prisma = {
      account: { findMany: accountFindMany },
      transaction: { findMany: transactionFindMany },
      accountVaultEntry: { findMany: accountVaultEntryFindMany },
    } as unknown as PrismaService;

    const service = new DashboardService(prisma);
    const controller = new DashboardController(service);

    const result = await controller.overview({ id: 'owner-a' }, undefined, undefined, '2026-01');

    expect(result.savingsNetInbound).toBe(50_000);
    expect(result.savingsNetOutbound).toBe(15_000);
    expect(result.savings).toBe(35_000);
  });
});
