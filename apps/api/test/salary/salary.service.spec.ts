import type { PrismaService } from '../../src/common/prisma.service';
import { SalaryService } from '../../src/salary/salary.service';

const statement = (values: {
  id: string;
  month: string;
  gross: bigint;
  net: bigint;
  tax: bigint;
  status?: 'COMMITTED' | 'REVIEW';
}) => ({
  id: values.id,
  userId: 'owner-a',
  payPeriod: new Date(`${values.month}-01T00:00:00.000Z`),
  employer: `Synthetic employer ${values.id}`,
  currency: 'INR',
  grossEarnings: values.gross,
  grossDeductions: values.gross - values.net,
  directPayment: 0n,
  netPay: values.net,
  filename: 'synthetic.pdf',
  fileHash: `synthetic-${values.id}`,
  status: values.status ?? 'COMMITTED',
  lineItems: [
    { id: `tax-${values.id}`, statementId: values.id, type: 'DEDUCTION', description: 'Income Tax', currentAmount: values.tax, ytdAmount: null },
    { id: `pf-${values.id}`, statementId: values.id, type: 'DEDUCTION', description: 'Provident Fund', currentAmount: 50_000n, ytdAmount: null },
  ],
});

describe('SalaryService timeline', () => {
  it('groups verified statements by month and builds gross and tax running totals', async () => {
    const findMany = jest.fn().mockResolvedValue([
      statement({ id: 'february', month: '2026-02', gross: 12_000_000n, net: 9_500_000n, tax: 1_800_000n }),
      statement({ id: 'january-secondary', month: '2026-01', gross: 5_000_000n, net: 4_000_000n, tax: 500_000n }),
      statement({ id: 'january-primary', month: '2026-01', gross: 10_000_000n, net: 8_000_000n, tax: 1_500_000n }),
      statement({ id: 'review', month: '2026-03', gross: 20_000_000n, net: 15_000_000n, tax: 3_000_000n, status: 'REVIEW' }),
    ]);
    const service = new SalaryService({ salaryStatement: { findMany } } as unknown as PrismaService, { uploadFile: jest.fn(), downloadFile: jest.fn(), deleteFile: jest.fn(), onModuleInit: jest.fn() } as any);

    const overview = await service.overview('owner-a');

    expect(overview.timeline).toEqual([
      { month: '2026-01', grossEarnings: 15_000_000, netPay: 12_000_000, tax: 2_000_000,
        cumulativeGross: 15_000_000, cumulativeTax: 2_000_000 },
      { month: '2026-02', grossEarnings: 12_000_000, netPay: 9_500_000, tax: 1_800_000,
        cumulativeGross: 27_000_000, cumulativeTax: 3_800_000 },
    ]);
    expect(overview.summary).toMatchObject({ statementCount: 3, totalGross: 27_000_000, totalNet: 21_500_000, taxes: 3_800_000 });
  });
});

describe('SalaryService createManual', () => {
  it('creates manual statement and line items', async () => {
    const create = jest.fn().mockImplementation(({ data }) => ({
      id: 'manual-stmt-1',
      ...data,
      lineItems: [],
    }));
    const update = jest.fn().mockResolvedValue({});
    const findFirst = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'manual-stmt-1',
        employer: 'Manual Employer',
        payPeriod: new Date('2026-07-01'),
        grossEarnings: 1000000n,
        grossDeductions: 100000n,
        netPay: 900000n,
        filename: 'Manual Entry',
        fileHash: 'manual-manual-stmt-1',
        status: 'COMMITTED',
        lineItems: [
          { id: 'tax-1', type: 'DEDUCTION', description: 'Income Tax', currentAmount: 50000n, ytdAmount: null },
        ],
      });

    const prisma = {
      salaryStatement: {
        findFirst,
        create,
        update,
      },
    } as unknown as PrismaService;

    const service = new SalaryService(prisma, { uploadFile: jest.fn(), downloadFile: jest.fn(), deleteFile: jest.fn(), onModuleInit: jest.fn() } as any);

    const result = await service.createManual('owner-a', {
      employer: 'Manual Employer',
      payPeriod: '2026-07-01',
      grossEarnings: '1000000',
      grossDeductions: '100000',
      netPay: '900000',
      tax: '50000',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'owner-a',
        payPeriod: new Date('2026-07-01'),
        employer: 'Manual Employer',
        grossEarnings: 1000000n,
        grossDeductions: 100000n,
        netPay: 900000n,
        filename: 'Manual Entry',
        fileHash: 'manual-placeholder',
        status: 'COMMITTED',
        committedAt: expect.any(Date),
      },
    });

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'manual-stmt-1' },
      data: { fileHash: 'manual-manual-stmt-1' },
    });

    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'manual-stmt-1' },
      data: {
        lineItems: {
          create: [
            { type: 'DEDUCTION', description: 'Income Tax', currentAmount: 50000n },
          ],
        },
      },
    });

    expect(result).toMatchObject({
      id: 'manual-stmt-1',
      employer: 'Manual Employer',
      grossEarnings: 1000000,
      grossDeductions: 100000,
      netPay: 900000,
      filename: 'Manual Entry',
      lineItems: [
        { type: 'DEDUCTION', description: 'Income Tax', currentAmount: 50000 },
      ],
    });
  });
});
