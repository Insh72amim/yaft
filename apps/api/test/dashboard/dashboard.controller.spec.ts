import type { PrismaService } from '../../src/common/prisma.service';
import { DashboardController } from '../../src/dashboard/dashboard.controller';
import { DashboardService } from '../../src/dashboard/dashboard.service';

describe('DashboardController & DashboardService', () => {
  it('uses fully valued holdings for an investment account in assets-history', async () => {
    const accountFindMany = jest.fn().mockResolvedValue([{
      id: 'fund-account', name: 'Synthetic mutual funds', type: 'MUTUAL_FUND', openingBalance: 1_000n,
      creditLimit: null, dueDay: null, transactions: [{ amount: 250n, transactionDate: new Date() }],
      holdings: [{ currentValue: 2_000n, asset: { symbol: 'AAPL', name: 'Apple', type: 'STOCKS' } }, { currentValue: 3_500n, asset: { symbol: 'GOOGL', name: 'Alphabet', type: 'STOCKS' } }],
    }]);
    const prisma = {
      account: { findMany: accountFindMany },
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);
    const controller = new DashboardController(service);

    const result = await controller.getAssetsHistory({ id: 'owner-a' });

    expect(result.accounts[0]).toMatchObject({ id: 'fund-account', type: 'MUTUAL_FUND', balance: 5_500 });
    expect(result.netWorth).toBe(5_500);
  });

  it('falls back to the ledger balance when any holding is unvalued', async () => {
    const accountFindMany = jest.fn().mockResolvedValue([{
      id: 'fund-account', name: 'Synthetic mutual funds', type: 'MUTUAL_FUND', openingBalance: 4_000n,
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

  it('distributes credit card payments into true categories in accountFlow', async () => {
    const accountFindMany = jest.fn().mockResolvedValue([
      { id: 'acc-axis', name: 'Axis Bank', type: 'SAVINGS', openingBalance: 100_000n, creditLimit: null, dueDay: null, transactions: [], holdings: [] },
      { id: 'acc-cc', name: 'HDFC CC', type: 'CREDIT_CARD', openingBalance: 0n, creditLimit: 200_000n, dueDay: 15, transactions: [], holdings: [] },
    ]);
    const transactionFindMany = jest.fn().mockResolvedValue([
      // Income
      { id: 'tx-1', amount: 100_000n, accountId: 'acc-axis', account: { id: 'acc-axis', name: 'Axis Bank', type: 'SAVINGS' }, descriptionRaw: 'SALARY' },
      // CC Payment from Axis
      { id: 'tx-2', amount: -20_000n, accountId: 'acc-axis', account: { id: 'acc-axis', name: 'Axis Bank', type: 'SAVINGS' }, descriptionRaw: 'CC PAYMENT', category: { name: 'CC Transfer', color: '#10b981' } },
      // Real spends on Credit Card
      { id: 'tx-3', amount: -15_000n, accountId: 'acc-cc', account: { id: 'acc-cc', name: 'HDFC CC', type: 'CREDIT_CARD' }, descriptionRaw: 'SWIGGY', category: { name: 'Food & dining', color: '#ef4444' } },
      { id: 'tx-4', amount: -5_000n, accountId: 'acc-cc', account: { id: 'acc-cc', name: 'HDFC CC', type: 'CREDIT_CARD' }, descriptionRaw: 'ZEPTO', category: { name: 'Groceries', color: '#10b981' } },
    ]);

    const prisma = {
      account: { findMany: accountFindMany },
      transaction: { findMany: transactionFindMany },
      accountVaultEntry: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const service = new DashboardService(prisma);
    const controller = new DashboardController(service);

    const result = await controller.overview({ id: 'owner-a' }, undefined, undefined, '2026-01');

    const ccSupergroup = result.accountFlow.overall.supergroups.find((sg) => sg.id === 'CC_PAYMENTS');
    expect(ccSupergroup).toBeDefined();
    expect(ccSupergroup?.amount).toBe(20_000);
    // CC categories should be distributed into Food & dining (75%) and Groceries (25%)
    expect(ccSupergroup?.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Food & dining', amount: 15_000 }),
        expect.objectContaining({ name: 'Groceries', amount: 5_000 }),
      ]),
    );

    // Final categories should not include "CC Transfer"
    const catNames = result.categories.map((c) => c.name);
    expect(catNames).not.toContain('CC Transfer');
  });
});
