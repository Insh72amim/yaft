import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../src/common/prisma.service';
import { S3Service } from '../../src/s3/s3.service';
import { BackupService } from '../../src/backup/backup.service';

describe('BackupService', () => {
  let service: BackupService;
  let prisma: any;
  let s3Service: any;

  beforeEach(() => {
    prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([{ id: 'org-1', name: 'Acme Corp', isCurrent: true }]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      account: {
        findMany: jest.fn().mockResolvedValue([{ id: 'acc-1', name: 'Test Bank', openingBalance: 1000n }]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      statementCredential: {
        findMany: jest.fn().mockResolvedValue([{ accountId: 'acc-1', ciphertext: Buffer.from('cipher'), iv: Buffer.from('iv'), authTag: Buffer.from('tag') }]),
        upsert: jest.fn(),
      },
      accountVaultEntry: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: 'cat-1', name: 'Groceries' }]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      categoryRule: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      transaction: {
        findMany: jest.fn().mockResolvedValue([{ id: 'tx-1', amount: -500n, transactionDate: new Date('2026-07-01'), categoryId: 'cat-1' }]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      categoryBudget: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      activeSip: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      loan: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      loanInstallment: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      asset: {
        findMany: jest.fn().mockResolvedValue([{ id: 'asset-1', symbol: 'RELIANCE', name: 'Reliance Industries', type: 'STOCK' }]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      portfolioHolding: {
        findMany: jest.fn().mockResolvedValue([{ id: 'hold-1', accountId: 'acc-1', assetId: 'asset-1', quantity: 10, averagePrice: 250000n }]),
        upsert: jest.fn(),
      },
      importBatch: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      stagedTransaction: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      accountDocument: { findMany: jest.fn().mockResolvedValue([{ id: 'doc-1', storageKey: 'docs/test.pdf', mimeType: 'application/pdf', name: 'test.pdf' }]), upsert: jest.fn() },
      salaryStatement: {
        findMany: jest.fn().mockResolvedValue([{ id: 'stmt-1', employer: 'Acme Corp', payPeriod: new Date('2026-07-01'), grossEarnings: 100000n, grossDeductions: 10000n, netPay: 90000n, filename: 'payslip.pdf', fileHash: 'hash123' }]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      salaryLineItem: { findMany: jest.fn().mockResolvedValue([{ id: 'item-1', statementId: 'stmt-1', type: 'BASIC', description: 'Basic Salary', currentAmount: 50000n }]), upsert: jest.fn() },
      tag: {
        findMany: jest.fn().mockResolvedValue([{ id: 'tag-1', name: 'Vacation' }]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      transactionTag: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      googleEmailConfig: { findMany: jest.fn().mockResolvedValue([{ id: 'g-1', email: 'user@example.com', refreshCipher: Buffer.from('rc'), refreshIv: Buffer.from('ri'), refreshTag: Buffer.from('rt') }]), upsert: jest.fn() },
      emailSyncLog: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    s3Service = {
      downloadFile: jest.fn().mockResolvedValue(Buffer.from('%PDF-synthetic')),
      uploadFile: jest.fn().mockResolvedValue(undefined),
    };

    service = new BackupService(prisma as unknown as PrismaService, s3Service as unknown as S3Service);
  });

  it('throws BadRequestException if passphrase is less than 6 characters', async () => {
    await expect(service.exportBackup('user-1', '12345')).rejects.toThrow(BadRequestException);
  });

  it('exports an encrypted backup buffer successfully including salary, assets, and documents', async () => {
    const buffer = await service.exportBackup('user-1', 'MySecretPassphrase123');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(60);
    // Header check
    expect(buffer.subarray(0, 14).toString('ascii')).toBe('YAFT_BACKUP_V1');
    // Verify both account document and salary payslip were downloaded from S3
    expect(s3Service.downloadFile).toHaveBeenCalledWith('docs/test.pdf');
    expect(s3Service.downloadFile).toHaveBeenCalledWith('salaries/user-1/stmt-1.pdf');
  });

  it('restores backup successfully into a new account re-binding all user data', async () => {
    const passphrase = 'SuperSecurePassphrase2026';
    const encrypted = await service.exportBackup('user-1', passphrase);

    // Restore into a different user account ('new-user-999')
    const result = await service.restoreBackup('new-user-999', passphrase, encrypted);
    expect(result).toEqual({
      accountsRestored: 1,
      transactionsRestored: 1,
      categoriesRestored: 1,
      documentsRestored: 1,
      salariesRestored: 1,
      organizationsRestored: 1,
      holdingsRestored: 1,
      filesRestored: 2, // 1 account document + 1 salary payslip
    });

    expect(prisma.organization.create).toHaveBeenCalled();
    expect(prisma.account.upsert).toHaveBeenCalled();
    expect(prisma.asset.create).toHaveBeenCalled();
    expect(prisma.portfolioHolding.upsert).toHaveBeenCalled();
    expect(prisma.statementCredential.upsert).toHaveBeenCalled();
    expect(prisma.salaryStatement.upsert).toHaveBeenCalled();
    expect(prisma.salaryLineItem.upsert).toHaveBeenCalled();
    expect(prisma.tag.create).toHaveBeenCalled();
    expect(prisma.transaction.upsert).toHaveBeenCalled();
    expect(prisma.googleEmailConfig.upsert).toHaveBeenCalled();
    expect(s3Service.uploadFile).toHaveBeenCalledWith('docs/test.pdf', expect.any(Buffer), 'application/pdf');
    expect(s3Service.uploadFile).toHaveBeenCalled();
  });

  it('fails closed when restoring with an incorrect passphrase', async () => {
    const encrypted = await service.exportBackup('user-1', 'CorrectPassphrase');

    await expect(service.restoreBackup('user-1', 'WrongPassphrase', encrypted)).rejects.toThrow(
      'Incorrect backup passphrase or corrupted archive file.',
    );
  });

  it('fails when given a corrupted or truncated backup file', async () => {
    const corrupted = Buffer.from('YAFT_BACKUP_V1_CORRUPTED_DATA');
    await expect(service.restoreBackup('user-1', 'AnyPassword', corrupted)).rejects.toThrow(BadRequestException);
  });
});
