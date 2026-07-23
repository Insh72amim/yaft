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
    const accountVaultEntryFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      account: { findMany: accountFindMany },
      transaction: { findMany: transactionFindMany },
      accountVaultEntry: { findMany: accountVaultEntryFindMany },
    } as unknown as PrismaService;
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
    const prisma = {
      account: { findMany: accountFindMany },
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
      accountVaultEntry: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const controller = new DashboardController(prisma);

    const result = await controller.overview({ id: 'owner-a' }, '2026-01');

    expect(result.accounts[0].balance).toBe(4_500);
    expect(result.netWorth).toBe(4_500);
  });

  it('calculates savingsNetInbound and savingsNetOutbound excluding internal transfers', async () => {
    const accountFindMany = jest.fn().mockResolvedValue([
      { id: 'acc-sbi', name: 'SBI Savings', type: 'SAVINGS', openingBalance: 0n, creditLimit: null, dueDay: null, transactions: [], holdings: [] },
      { id: 'acc-axis', name: 'Axis Bank', type: 'BANK', openingBalance: 0n, creditLimit: null, dueDay: null, transactions: [], holdings: [] },
    ]);

    const transactionFindMany = jest.fn().mockResolvedValue([
      {
        id: 't1', accountId: 'acc-sbi', amount: 1000000n, descriptionRaw: 'SALARY CREDIT', transferGroupId: null,
        account: { id: 'acc-sbi', name: 'SBI Savings', type: 'SAVINGS' }, transactionDate: new Date(),
      },
      {
        id: 't2', accountId: 'acc-sbi', amount: -200000n, descriptionRaw: 'TRANSFER TO XX9988', transferGroupId: 'transfer-1',
        account: { id: 'acc-sbi', name: 'SBI Savings', type: 'SAVINGS' }, transactionDate: new Date(),
      },
      {
        id: 't3', accountId: 'acc-axis', amount: 200000n, descriptionRaw: 'TRANSFER FROM SBI', transferGroupId: 'transfer-1',
        account: { id: 'acc-axis', name: 'Axis Bank', type: 'BANK' }, transactionDate: new Date(),
      },
      {
        id: 't4', accountId: 'acc-axis', amount: -50000n, descriptionRaw: 'SWIGGY ORDER', transferGroupId: null,
        account: { id: 'acc-axis', name: 'Axis Bank', type: 'BANK' }, transactionDate: new Date(),
      },
    ]);

    const accountVaultEntryFindMany = jest.fn().mockResolvedValue([
      { accountId: 'acc-axis', last4: '9988' },
    ]);

    const prisma = {
      account: { findMany: accountFindMany },
      transaction: { findMany: transactionFindMany },
      accountVaultEntry: { findMany: accountVaultEntryFindMany },
    } as unknown as PrismaService;

    const controller = new DashboardController(prisma);
    const result = await controller.overview({ id: 'owner-a' }, '2026-01');

    expect(result.savingsNetInbound).toBe(1000000);
    expect(result.savingsNetOutbound).toBe(50000);
    expect(result.accountFlow).toBeDefined();
    expect(result.accountFlow.accounts).toHaveLength(2);
    expect(result.accountFlow.internalTransfers).toHaveLength(1);
    expect(result.accountFlow.internalTransfers[0]).toMatchObject({
      fromAccountId: 'acc-sbi',
      toAccountId: 'acc-axis',
      amount: 200000,
    });
  });
});
