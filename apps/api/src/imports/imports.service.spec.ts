import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import type { PrismaService } from '../common/prisma.service';
import type { StatementCredentialsService } from '../common/statement-credentials.service';
import { ImportsService } from './imports.service';
import { parseStatementWithMetadata } from './statement-parser';

jest.mock('./statement-parser', () => ({ parseStatementWithMetadata: jest.fn() }));

const parseStatement = jest.mocked(parseStatementWithMetadata);
const file = { originalname: 'statement.pdf', buffer: Buffer.from('%PDF-synthetic') } as Express.Multer.File;
const row = { date: new Date('2026-07-01T00:00:00.000Z'), postedDate: new Date('2026-07-02T00:00:00.000Z'),
  description: 'Synthetic transaction', amountMinor: -12500, reference: 'SYN-1', dedupeKey: 'synthetic-1', rowNumber: 1 };

function setup() {
  const tx = { importBatch: { create: jest.fn().mockResolvedValue({ id: 'batch-1' }) },
    statementCredential: { upsert: jest.fn().mockResolvedValue({}) } };
  const prisma = {
    account: { findFirst: jest.fn().mockResolvedValue({ id: 'account-1', userId: 'user-1', institution: 'SBI' }) },
    importBatch: { findFirst: jest.fn().mockResolvedValue(null) },
    category: { findMany: jest.fn().mockResolvedValue([]) },
    transaction: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  const credentials = { getPassword: jest.fn().mockResolvedValue(undefined),
    encrypt: jest.fn().mockReturnValue({ ciphertext: Buffer.from('cipher'), iv: Buffer.alloc(12), authTag: Buffer.alloc(16), keyVersion: 1 }) } as unknown as StatementCredentialsService;
  const service = new ImportsService(prisma, credentials);
  jest.spyOn(service, 'get').mockResolvedValue({ id: 'batch-1' } as never);
  parseStatement.mockResolvedValue({ rows: [row], parserId: 'SBI' });
  return { service, prisma: prisma as any, credentials: credentials as any, tx };
}

describe('ImportsService statement password flow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves or replaces an explicit password only after a verified SBI parse', async () => {
    const { service, credentials, tx } = setup();
    await service.create('user-1', 'account-1', file, { pdfPassword: 'entered once', rememberPassword: true });
    expect(parseStatement).toHaveBeenCalledWith(file, { institution: 'SBI', pdfPassword: 'entered once' });
    expect(credentials.encrypt).toHaveBeenCalledWith('account-1', 'entered once');
    expect(tx.statementCredential.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { accountId: 'account-1' } }));
  });

  it('uses a saved password without returning or re-encrypting it', async () => {
    const { service, credentials, tx } = setup();
    credentials.getPassword.mockResolvedValue('saved value');
    await service.create('user-1', 'account-1', file);
    expect(parseStatement).toHaveBeenCalledWith(file, { institution: 'SBI', pdfPassword: 'saved value' });
    expect(credentials.encrypt).not.toHaveBeenCalled();
    expect(tx.statementCredential.upsert).not.toHaveBeenCalled();
  });

  it('supports a one-time password without changing a saved credential', async () => {
    const { service, credentials, tx } = setup();
    await service.create('user-1', 'account-1', file, { pdfPassword: 'one time', rememberPassword: false });
    expect(credentials.encrypt).not.toHaveBeenCalled();
    expect(tx.statementCredential.upsert).not.toHaveBeenCalled();
  });

  it('creates no import batch or credential when parsing fails', async () => {
    const { service, credentials, prisma } = setup();
    parseStatement.mockRejectedValue(new BadRequestException('The PDF password is incorrect.'));
    await expect(service.create('user-1', 'account-1', file, { pdfPassword: 'wrong', rememberPassword: true })).rejects.toThrow('incorrect');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(credentials.encrypt).not.toHaveBeenCalled();
  });

  it('rejects an exact-file reupload before decrypting or parsing', async () => {
    const { service, credentials, prisma } = setup();
    prisma.importBatch.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create('user-1', 'account-1', file)).rejects.toThrow('already uploaded');
    expect(credentials.getPassword).not.toHaveBeenCalled();
    expect(parseStatement).not.toHaveBeenCalled();
  });

  it('stages a byte-different overlapping transaction as a duplicate without overwriting it', async () => {
    const { service, prisma, tx } = setup();
    const fingerprint = createHash('sha256').update('account-1|2026-07-01|2026-07-02|synthetic-1|-12500').digest('hex');
    prisma.transaction.findMany.mockResolvedValue([{ fingerprint }]);
    await service.create('user-1', 'account-1', { ...file, buffer: Buffer.from('%PDF-byte-different') }, { pdfPassword: 'one time' });
    const staged = tx.importBatch.create.mock.calls[0][0].data.staged.create;
    expect(staged[0]).toMatchObject({ fingerprint, isDuplicate: true, include: false });
  });

  it('preserves legacy PNB and CSV fingerprints that have no post date or bank dedupe key', async () => {
    const { service, prisma, tx } = setup();
    const legacy = { ...row, postedDate: undefined, dedupeKey: undefined };
    parseStatement.mockResolvedValue({ rows: [legacy], parserId: 'PNB' });
    const fingerprint = createHash('sha256').update('account-1|2026-07-01|syn-1|-12500').digest('hex');
    prisma.transaction.findMany.mockResolvedValue([{ fingerprint }]);
    await service.create('user-1', 'account-1', file);
    expect(tx.importBatch.create.mock.calls[0][0].data.staged.create[0]).toMatchObject({ fingerprint, isDuplicate: true, include: false });
  });

  it('fails closed when an explicit PDF source does not match the verified parser', async () => {
    const { service, prisma } = setup();
    parseStatement.mockResolvedValue({ rows: [row], parserId: 'AXIS' });
    await expect(service.create('user-1', 'account-1', file, {}, 'SBI')).rejects.toThrow('does not match the selected SBI');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
