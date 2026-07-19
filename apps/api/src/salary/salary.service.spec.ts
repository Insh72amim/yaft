import type { PrismaService } from '../common/prisma.service';
import { SalaryService } from './salary.service';

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
