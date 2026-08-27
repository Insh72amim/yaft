import type { PrismaService } from '../../src/common/prisma.service';
import { DashboardController } from '../../src/dashboard/dashboard.controller';
import { DashboardService } from '../../src/dashboard/dashboard.service';

describe('ExpenseAnalytics & Stacked Subcategory Buckets', () => {
  it('returns monthly stacked category buckets with correct amounts and percentages', async () => {
    const mockTxns = [
      {
        id: 'tx-1',
        amount: -500000n, // 5000 INR
        transactionDate: new Date('2026-06-10T10:00:00Z'),
        descriptionRaw: 'BIGBASKET GROCERIES',
        categoryId: 'cat-groceries',
        category: { id: 'cat-groceries', name: 'Groceries', color: '#10b981', superCategory: { name: 'Food', color: '#059669' } },
        account: { id: 'acc-1', name: 'Axis Bank', type: 'SAVINGS' },
        transferGroupId: null,
      },
      {
        id: 'tx-2',
        amount: -300000n, // 3000 INR
        transactionDate: new Date('2026-06-15T12:00:00Z'),
        descriptionRaw: 'RESTAURANT BILL',
        categoryId: 'cat-dining',
        category: { id: 'cat-dining', name: 'Dining', color: '#f59e0b', superCategory: { name: 'Food', color: '#059669' } },
        account: { id: 'acc-1', name: 'Axis Bank', type: 'SAVINGS' },
        transferGroupId: null,
      },
      {
        id: 'tx-3',
        amount: -1200000n, // 12000 INR
        transactionDate: new Date('2026-07-05T09:00:00Z'),
        descriptionRaw: 'ELECTRICITY BILL',
        categoryId: 'cat-utilities',
        category: { id: 'cat-utilities', name: 'Electricity', color: '#3b82f6', superCategory: { name: 'Bills', color: '#2563eb' } },
        account: { id: 'acc-1', name: 'Axis Bank', type: 'SAVINGS' },
        transferGroupId: null,
      },
    ];

    const prisma = {
      transaction: { findMany: jest.fn().mockResolvedValue(mockTxns) },
    } as unknown as PrismaService;

    const service = new DashboardService(prisma);
    const controller = new DashboardController(service);

    const res = await controller.getExpenseAnalytics(
      { id: 'user-1' },
      'month',
      '2026-06-01',
      '2026-07-31',
    );

    expect(res.granularity).toBe('month');
    expect(res.buckets).toHaveLength(2);

    const junBucket = res.buckets.find((b) => b.intervalKey === '2026-06')!;
    expect(junBucket.totalAmount).toBe(800000);
    expect(junBucket.categories).toHaveLength(2);
    expect(junBucket.categories[0]).toMatchObject({
      name: 'Groceries',
      amount: 500000,
      percentage: 63, // 5000 / 8000 = 62.5% -> 63%
    });
    expect(junBucket.categories[1]).toMatchObject({
      name: 'Dining',
      amount: 300000,
      percentage: 38, // 3000 / 8000 = 37.5% -> 38%
    });

    const julBucket = res.buckets.find((b) => b.intervalKey === '2026-07')!;
    expect(julBucket.totalAmount).toBe(1200000);
    expect(julBucket.categories).toHaveLength(1);
    expect(julBucket.categories[0]).toMatchObject({
      name: 'Electricity',
      amount: 1200000,
      percentage: 100,
    });

    expect(res.summary.totalExpense).toBe(2000000);
    expect(res.summary.peakInterval?.amount).toBe(1200000);
    expect(res.summary.topCategory?.name).toBe('Electricity');
    expect(res.categoryLegend).toHaveLength(3);
  });

  it('correctly handles day-by-day granularity and fills empty date intervals with 0', async () => {
    const mockTxns = [
      {
        id: 'tx-1',
        amount: -150000n, // 1500 INR
        transactionDate: new Date('2026-08-01T10:00:00Z'),
        descriptionRaw: 'UBER TRIP',
        categoryId: 'cat-travel',
        category: { id: 'cat-travel', name: 'Travel', color: '#8b5cf6', superCategory: null },
        account: { id: 'acc-1', name: 'SBI', type: 'SAVINGS' },
        transferGroupId: null,
      },
    ];

    const prisma = {
      transaction: { findMany: jest.fn().mockResolvedValue(mockTxns) },
    } as unknown as PrismaService;

    const service = new DashboardService(prisma);
    const controller = new DashboardController(service);

    const res = await controller.getExpenseAnalytics(
      { id: 'user-1' },
      'day',
      '2026-08-01',
      '2026-08-03',
    );

    expect(res.granularity).toBe('day');
    expect(res.buckets).toHaveLength(3); // 01, 02, 03
    expect(res.buckets[0].totalAmount).toBe(150000);
    expect(res.buckets[1].totalAmount).toBe(0);
    expect(res.buckets[2].totalAmount).toBe(0);
  });

  it('filters out CC bill payments and internal transfers from expense analytics', async () => {
    const mockTxns = [
      {
        id: 'tx-1',
        amount: -2500000n, // CC Bill Payment 25000
        transactionDate: new Date('2026-08-05T10:00:00Z'),
        descriptionRaw: 'CRED.CLUB CREDIT CARD PAYMENT',
        categoryId: null,
        category: null,
        account: { id: 'acc-1', name: 'Axis Bank', type: 'SAVINGS' },
        transferGroupId: null,
      },
      {
        id: 'tx-2',
        amount: -100000n, // Real Expense 1000
        transactionDate: new Date('2026-08-05T12:00:00Z'),
        descriptionRaw: 'SWIGGY FOOD ORDER',
        categoryId: 'cat-dining',
        category: { id: 'cat-dining', name: 'Dining', color: '#f59e0b' },
        account: { id: 'acc-1', name: 'Axis Bank', type: 'SAVINGS' },
        transferGroupId: null,
      },
    ];

    const prisma = {
      transaction: { findMany: jest.fn().mockResolvedValue(mockTxns) },
    } as unknown as PrismaService;

    const service = new DashboardService(prisma);
    const controller = new DashboardController(service);

    const res = await controller.getExpenseAnalytics(
      { id: 'user-1' },
      'day',
      '2026-08-05',
      '2026-08-05',
    );

    expect(res.buckets[0].totalAmount).toBe(100000);
    expect(res.summary.totalExpense).toBe(100000);
  });
});
