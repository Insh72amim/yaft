import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../common/prisma.service';
import type { ImportsService } from '../imports/imports.service';
import type { InvestmentsService } from '../investments/investments.service';
import type { SalaryService } from '../salary/salary.service';
import { UnifiedImportsService } from './unified-imports.service';

jest.mock('../imports/pdf-statement-registry', () => ({
  bankSourceForInstitution: (institution?: string) => institution?.includes('State Bank') ? 'SBI'
    : institution?.includes('Punjab') ? 'PNB' : institution?.includes('Axis') ? 'AXIS' : undefined,
  bankInstitutionMatchesSource: (institution: string | undefined, source: string) => {
    const matches: Record<string, boolean | undefined> = {
      SBI: institution?.includes('State Bank'), PNB: institution?.includes('Punjab'), AXIS: institution?.includes('Axis'),
    };
    return matches[source] === true;
  },
}));
jest.mock('../salary/payslip-parser', () => ({ PAYSLIP_SCHEMAS: [], isPayslipSchema: jest.fn(), parsePayslipPdf: jest.fn() }));

const bankFile = { originalname: 'synthetic.pdf', buffer: Buffer.from('%PDF-synthetic') } as Express.Multer.File;
const salaryFile = { originalname: 'synthetic-payslip.pdf', buffer: Buffer.from('%PDF-synthetic') } as Express.Multer.File;
const holdingsFile = { originalname: 'synthetic-holdings.xlsx', buffer: Buffer.from('PK-synthetic') } as Express.Multer.File;

const bankReview = {
  id: 'bank-review', userId: 'private-user-id', accountId: 'bank-account', filename: 'synthetic.pdf',
  fileHash: 'private-file-hash', status: 'REVIEW', rowCount: 1, createdAt: new Date('2026-07-18T12:00:00.000Z'), committedAt: null,
  account: { id: 'bank-account', name: 'Synthetic SBI' },
  categories: [{ id: 'category-1', userId: 'private-user-id', name: 'Uncategorised', color: '#000000' }],
  staged: [{ id: 'row-1', batchId: 'bank-review', rowNumber: 1, transactionDate: new Date('2026-07-01T00:00:00.000Z'),
    postedDate: null, descriptionRaw: 'Synthetic transaction', merchant: 'Synthetic', amount: -1000,
    reference: 'SYN-1', categoryId: 'category-1', isDuplicate: false, include: true, confidence: 90,
    fingerprint: 'private-fingerprint', category: { id: 'category-1', userId: 'private-user-id' } }],
};

const salaryReview = {
  id: 'salary-review', userId: 'private-user-id', fileHash: 'private-salary-hash', filename: 'synthetic-payslip.pdf',
  payPeriod: new Date('2026-07-01T00:00:00.000Z'), employer: 'Goldman Sachs', employeeName: 'Synthetic Employee',
  employeeNumberLast4: '1234', department: 'Synthetic', designation: 'Analyst', bankName: 'Synthetic Bank',
  bankAccountLast4: '5678', uanLast4: '4321', currency: 'INR', grossEarnings: 100000, grossDeductions: 10000,
  directPayment: 0, netPay: 90000, status: 'REVIEW', createdAt: new Date('2026-07-18T13:00:00.000Z'), committedAt: null,
  lineItems: [{ id: 'salary-row', statementId: 'salary-review', type: 'EARNING', description: 'Synthetic pay',
    currentAmount: 100000, ytdAmount: 500000 }],
};

function setup() {
  const prisma = {
    account: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'bank-account', name: 'Synthetic SBI', type: 'SAVINGS',
        institution: 'State Bank of India', currency: 'INR' }),
    },
  } as unknown as PrismaService;
  const imports = { create: jest.fn().mockResolvedValue(bankReview), pendingAll: jest.fn().mockResolvedValue([]) } as unknown as ImportsService;
  const salary = { upload: jest.fn().mockResolvedValue(salaryReview), pendingAll: jest.fn().mockResolvedValue([]) } as unknown as SalaryService;
  const investments = { importZerodhaHoldings: jest.fn().mockResolvedValue({ imported: 2,
    account: { accountId: 'stocks-account', name: 'Synthetic Zerodha', holdings: [] } }) } as unknown as InvestmentsService;
  const service = new UnifiedImportsService(prisma, imports, salary, investments);
  return { service, prisma: prisma as any, imports: imports as any, salary: salary as any, investments: investments as any };
}

describe('UnifiedImportsService catalog and dispatch', () => {
  it('returns safe account metadata with server-computed eligibility per source', async () => {
    const { service, prisma } = setup();
    prisma.account.findMany.mockResolvedValue([
      { id: 'sbi', name: 'SBI', type: 'SAVINGS', institution: 'State Bank of India', currency: 'INR', statementCredential: { accountId: 'sbi' } },
      { id: 'axis', name: 'Axis', type: 'SAVINGS', institution: 'Axis Bank', currency: 'INR', statementCredential: null },
      { id: 'kite', name: 'Kite', type: 'STOCKS', institution: 'Zerodha', currency: 'INR', statementCredential: null },
    ]);
    const result = await service.options('user-1');
    expect(result.accounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'sbi', hasStatementPassword: true }),
      expect.objectContaining({ id: 'kite', hasStatementPassword: false }),
    ]));
    expect(result.options.find((item) => item.kind === 'BANK_STATEMENT')?.sources.find((item) => item.source === 'SBI')?.eligibleAccountIds).toEqual(['sbi']);
    expect(result.options.find((item) => item.kind === 'BANK_STATEMENT')?.sources.every((item) =>
      item.extensions.length === 1 && item.extensions[0] === '.pdf')).toBe(true);
    expect(result.options.find((item) => item.kind === 'BROKER_HOLDINGS')?.sources[0].eligibleAccountIds).toEqual(['kite']);
    expect(JSON.stringify(result)).not.toContain('userId');
  });

  it('dispatches every supported pair without duplicating source parsers', async () => {
    const bank = setup();
    await expect(bank.service.upload('user-1', bankFile, { kind: 'BANK_STATEMENT', source: 'SBI', accountId: 'bank-account' }))
      .resolves.toMatchObject({ kind: 'BANK_STATEMENT', source: 'SBI', mode: 'REVIEW_REQUIRED' });
    expect(bank.imports.create).toHaveBeenCalledWith('user-1', 'bank-account', bankFile,
      { pdfPassword: undefined, rememberPassword: undefined }, 'SBI');

    const salary = setup();
    await expect(salary.service.upload('user-1', salaryFile, { kind: 'SALARY_PAYSLIP', source: 'GOLDMAN_SACHS' }))
      .resolves.toMatchObject({ kind: 'SALARY_PAYSLIP', source: 'GOLDMAN_SACHS', mode: 'REVIEW_REQUIRED' });
    expect(salary.salary.upload).toHaveBeenCalledWith('user-1', salaryFile, 'GOLDMAN_SACHS');

    const holdings = setup();
    holdings.prisma.account.findFirst.mockResolvedValue({ id: 'stocks-account', name: 'Synthetic Zerodha', type: 'STOCKS', institution: 'Zerodha', currency: 'INR' });
    await expect(holdings.service.upload('user-1', holdingsFile, { kind: 'BROKER_HOLDINGS', source: 'ZERODHA_KITE', accountId: 'stocks-account' }))
      .resolves.toMatchObject({ kind: 'BROKER_HOLDINGS', mode: 'IMMEDIATE_ATOMIC_REPLACEMENT', result: { imported: 2 } });
    expect(holdings.investments.importZerodhaHoldings).toHaveBeenCalledWith('user-1', 'stocks-account', holdingsFile);
  });
});

describe('UnifiedImportsService fail-closed validation', () => {
  it.each([
    [{ kind: 'BANK_STATEMENT', source: 'ZERODHA_KITE', accountId: 'bank-account' }, bankFile, 'supported import type and source'],
    [{ kind: 'SALARY_PAYSLIP', source: 'GOLDMAN_SACHS', accountId: 'bank-account' }, salaryFile, 'does not use a destination account'],
    [{ kind: 'SALARY_PAYSLIP', source: 'GOLDMAN_SACHS', pdfPassword: 'not-applicable' }, salaryFile, 'Password fields do not apply'],
    [{ kind: 'BROKER_HOLDINGS', source: 'ZERODHA_KITE', accountId: 'bank-account', rememberPassword: false }, holdingsFile, 'Password fields do not apply'],
    [{ kind: 'BANK_STATEMENT', source: 'SBI', accountId: 'bank-account' },
      { ...bankFile, originalname: 'synthetic.csv' }, 'accepts only PDF'],
    [{ kind: 'BANK_STATEMENT', source: 'AXIS', accountId: 'bank-account' },
      { ...bankFile, originalname: 'synthetic.xlsx' }, 'accepts only PDF'],
    [{ kind: 'BANK_STATEMENT', source: 'PNB', accountId: 'bank-account', rememberPassword: true }, bankFile, 'only for SBI PDFs'],
    [{ kind: 'BANK_STATEMENT', source: 'SBI', accountId: 'bank-account' }, { ...bankFile, originalname: 'legacy.xls' }, 'accepts only'],
  ])('rejects invalid pairs, fields, and extensions', async (dto, file, message) => {
    const { service } = setup();
    await expect(service.upload('user-1', file as Express.Multer.File, dto as any)).rejects.toThrow(message as string);
  });

  it('rejects oversized, empty, missing, foreign, archived, wrong-type, and wrong-institution accounts', async () => {
    const oversized = setup();
    await expect(oversized.service.upload('user-1', { ...bankFile, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
      { kind: 'BANK_STATEMENT', source: 'SBI', accountId: 'bank-account' })).rejects.toThrow('limited to 5 MB');
    const empty = setup();
    await expect(empty.service.upload('user-1', { ...salaryFile, buffer: Buffer.alloc(0) },
      { kind: 'SALARY_PAYSLIP', source: 'GOLDMAN_SACHS' })).rejects.toThrow('empty');
    const missing = setup();
    await expect(missing.service.upload('user-1', bankFile, { kind: 'BANK_STATEMENT', source: 'SBI' })).rejects.toThrow('eligible destination');
    const unavailable = setup();
    unavailable.prisma.account.findFirst.mockResolvedValue(null);
    await expect(unavailable.service.upload('user-1', bankFile,
      { kind: 'BANK_STATEMENT', source: 'SBI', accountId: 'foreign-or-archived' })).rejects.toThrow('not found');
    const wrong = setup();
    wrong.prisma.account.findFirst.mockResolvedValue({ id: 'bank-account', name: 'Wrong', type: 'CASH', institution: 'Axis Bank', currency: 'INR' });
    await expect(wrong.service.upload('user-1', bankFile,
      { kind: 'BANK_STATEMENT', source: 'SBI', accountId: 'bank-account' })).rejects.toThrow('does not match');
  });

  it('accepts one-time passwords for supported PDFs and remembers only an entered SBI password', async () => {
    const pnb = setup();
    pnb.prisma.account.findFirst.mockResolvedValue({ id: 'bank-account', name: 'PNB', type: 'SAVINGS', institution: 'Punjab National Bank', currency: 'INR' });
    await pnb.service.upload('user-1', bankFile,
      { kind: 'BANK_STATEMENT', source: 'PNB', accountId: 'bank-account', pdfPassword: 'one time' });
    expect(pnb.imports.create).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(),
      expect.objectContaining({ pdfPassword: 'one time', rememberPassword: undefined }), 'PNB');

    const sbi = setup();
    await sbi.service.upload('user-1', bankFile,
      { kind: 'BANK_STATEMENT', source: 'SBI', accountId: 'bank-account', pdfPassword: 'verified later', rememberPassword: true });
    expect(sbi.imports.create).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(),
      expect.objectContaining({ rememberPassword: true }), 'SBI');
  });
});

describe('UnifiedImportsService safe pending reviews', () => {
  it('returns every bank and salary review newest first with safe discriminated payloads and actions', async () => {
    const { service, prisma, imports, salary } = setup();
    imports.pendingAll.mockResolvedValue([bankReview]);
    salary.pendingAll.mockResolvedValue([salaryReview]);
    prisma.account.findMany.mockResolvedValue([{ id: 'bank-account', institution: 'State Bank of India' }]);
    const result = await service.pending('user-1');
    expect(result.map((item) => item.kind)).toEqual(['SALARY_PAYSLIP', 'BANK_STATEMENT']);
    expect(result[1]).toMatchObject({ source: 'SBI', review: { id: 'bank-review' },
      actions: { commit: '/imports/unified/bank-reviews/bank-review/commit', discard: '/imports/unified/bank-reviews/bank-review' } });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('private-user-id');
    expect(serialized).not.toContain('private-file-hash');
    expect(serialized).not.toContain('private-salary-hash');
    expect(serialized).not.toContain('private-fingerprint');
  });

  it('also strips unsafe fields from upload responses', async () => {
    const { service } = setup();
    const result = await service.upload('user-1', bankFile,
      { kind: 'BANK_STATEMENT', source: 'SBI', accountId: 'bank-account' });
    expect(JSON.stringify(result)).not.toMatch(/private-user-id|private-file-hash|private-fingerprint/);
  });
});
