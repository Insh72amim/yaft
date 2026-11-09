import { InstallmentStatus } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma.service';
import { RecurringDepositsService } from '../../src/recurring-deposits/recurring-deposits.service';

describe('RecurringDepositsService', () => {
  let service: RecurringDepositsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      account: {
        findFirst: jest.fn(),
      },
      recurringDeposit: {
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      recurringDepositInstallment: {
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };
    service = new RecurringDepositsService(prisma as unknown as PrismaService);
  });

  describe('calculateMaturity', () => {
    it('calculates quarterly compounded RD maturity correctly for 12 months at 7.0%', () => {
      // Monthly 5,000 INR = 500,000 paise. 12 months @ 7.0% p.a.
      const monthlyAmountPaise = 500000n;
      const rate = 7.0;
      const termMonths = 12;

      const maturity = service.calculateMaturity(monthlyAmountPaise, rate, termMonths);
      const maturityINR = Number(maturity) / 100;
      // Expected Indian bank quarterly compounding for 5000/mo @ 7% for 12 mo is ~62,319
      expect(maturityINR).toBeGreaterThanOrEqual(62300);
      expect(maturityINR).toBeLessThanOrEqual(62350);
    });

    it('calculates maturity for 36 months at 7.5%', () => {
      // Monthly 10,000 INR = 1,000,000 paise. 36 months @ 7.5% p.a.
      const monthlyAmountPaise = 1000000n;
      const rate = 7.5;
      const termMonths = 36;

      const maturity = service.calculateMaturity(monthlyAmountPaise, rate, termMonths);
      const maturityINR = Number(maturity) / 100;
      // Principal is 360,000. Expected maturity ~404,000
      expect(maturityINR).toBeGreaterThan(360000);
      expect(maturityINR).toBeGreaterThanOrEqual(403000);
      expect(maturityINR).toBeLessThanOrEqual(406000);
    });
  });

  describe('generateSchedule', () => {
    it('generates accurate installment rows with auto-increase marking past installments as PAID', () => {
      const monthlyAmountPaise = 500000n;
      const rate = 7.1;
      const depositDay = 5;
      // Start date 3 months ago
      const now = new Date();
      const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 5));
      const termMonths = 12;

      const schedule = service.generateSchedule(
        monthlyAmountPaise,
        rate,
        depositDay,
        startDate,
        termMonths,
        true, // autoIncrease = true
      );

      expect(schedule).toHaveLength(12);
      expect(schedule[0].installmentNumber).toBe(1);
      expect(schedule[0].amount).toBe(500000n);
      expect(schedule[0].accumulatedBalance).toBe(500000n);
      expect(schedule[11].accumulatedBalance).toBe(6000000n);

      // Past installments should be PAID because autoIncrease is true
      const paid = schedule.filter((s) => s.status === InstallmentStatus.PAID);
      expect(paid.length).toBeGreaterThanOrEqual(3);

      // Future installments should be FUTURE
      const future = schedule.filter((s) => s.status === InstallmentStatus.FUTURE);
      expect(future.length).toBeGreaterThanOrEqual(8);
    });

    it('generates schedule with manual mode marking past installments as PAST_UNCONFIRMED', () => {
      const monthlyAmountPaise = 500000n;
      const rate = 7.1;
      const depositDay = 5;
      const now = new Date();
      const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 5));
      const termMonths = 12;

      const schedule = service.generateSchedule(
        monthlyAmountPaise,
        rate,
        depositDay,
        startDate,
        termMonths,
        false, // autoIncrease = false (Manual mode)
      );

      const pastUnconfirmed = schedule.filter((s) => s.status === InstallmentStatus.PAST_UNCONFIRMED);
      expect(pastUnconfirmed.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('createOrUpdateSchedule', () => {
    it('creates RD schedule and returns details', async () => {
      const now = new Date();
      prisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        name: 'SBI Monthly RD',
        institution: 'State Bank of India',
        archived: false,
        recurringDeposits: [],
      });

      prisma.recurringDeposit.create.mockResolvedValue({
        id: 'rd-1',
        accountId: 'acc-1',
        startDate: new Date('2026-01-05'),
        monthlyAmount: 500000n,
        interestRate: '7.1',
        depositDay: 5,
        termMonths: 12,
        maturityAmount: 6235000n,
        autoIncrease: true,
        sourceAccountId: null,
        createdAt: now,
      });

      // After creation, getDetails is called
      prisma.account.findFirst.mockResolvedValueOnce({
        id: 'acc-1',
        userId: 'user-1',
        name: 'SBI Monthly RD',
        institution: 'State Bank of India',
        archived: false,
      }).mockResolvedValueOnce({
        id: 'acc-1',
        userId: 'user-1',
        name: 'SBI Monthly RD',
        institution: 'State Bank of India',
        archived: false,
        recurringDeposits: [{
          id: 'rd-1',
          startDate: new Date('2026-01-05'),
          monthlyAmount: 500000n,
          interestRate: '7.1',
          depositDay: 5,
          termMonths: 12,
          maturityAmount: 6235000n,
          autoIncrease: true,
          sourceAccountId: null,
          createdAt: now,
          installments: [
            { id: 'inst-1', installmentNumber: 1, dueDate: new Date('2026-01-05'), amount: 500000n, accumulatedBalance: 500000n, status: InstallmentStatus.PAID, confirmedAt: now },
            { id: 'inst-2', installmentNumber: 2, dueDate: new Date('2026-02-05'), amount: 500000n, accumulatedBalance: 1000000n, status: InstallmentStatus.PAID, confirmedAt: now },
          ],
        }],
      });

      const result = await service.createOrUpdateSchedule('user-1', 'acc-1', {
        startDate: '2026-01-05',
        monthlyAmount: 500000,
        interestRate: 7.1,
        depositDay: 5,
        termMonths: 12,
        autoIncrease: true,
      });

      expect(result.hasSchedule).toBe(true);
      if (result.hasSchedule) {
        expect(result.summary.paidCount).toBe(2);
        expect(result.summary.totalDeposited).toBe(1000000);
        expect(result.rd.autoIncrease).toBe(true);
      }
    });
  });

  describe('confirmInstallment and unconfirmInstallment', () => {
    it('confirms single installment deposit manually', async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        archived: false,
        recurringDeposits: [{ id: 'rd-1' }],
      });
      prisma.recurringDepositInstallment.findFirst.mockResolvedValue({
        id: 'inst-3',
        recurringDepositId: 'rd-1',
        status: InstallmentStatus.PAST_UNCONFIRMED,
      });

      const res = await service.confirmInstallment('user-1', 'acc-1', 'inst-3');
      expect(res).toEqual({ ok: true, installmentId: 'inst-3' });
      expect(prisma.recurringDepositInstallment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inst-3' },
          data: expect.objectContaining({ status: InstallmentStatus.PAID }),
        }),
      );
    });

    it('unconfirms installment deposit', async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        archived: false,
        recurringDeposits: [{ id: 'rd-1' }],
      });
      prisma.recurringDepositInstallment.findFirst.mockResolvedValue({
        id: 'inst-3',
        recurringDepositId: 'rd-1',
        dueDate: new Date('2026-01-05'),
        status: InstallmentStatus.PAID,
      });

      const res = await service.unconfirmInstallment('user-1', 'acc-1', 'inst-3');
      expect(res).toEqual({ ok: true, installmentId: 'inst-3' });
      expect(prisma.recurringDepositInstallment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inst-3' },
          data: expect.objectContaining({ status: InstallmentStatus.PAST_UNCONFIRMED, confirmedAt: null }),
        }),
      );
    });
  });
});
