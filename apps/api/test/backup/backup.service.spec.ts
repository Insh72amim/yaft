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
      account: { findMany: jest.fn().mockResolvedValue([{ id: 'acc-1', name: 'Test Bank', openingBalance: 1000n }]), upsert: jest.fn() },
      category: { findMany: jest.fn().mockResolvedValue([{ id: 'cat-1', name: 'Groceries' }]), upsert: jest.fn() },
      categoryRule: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      transaction: { findMany: jest.fn().mockResolvedValue([{ id: 'tx-1', amount: -500n, transactionDate: new Date('2026-07-01') }]), upsert: jest.fn() },
      categoryBudget: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      activeSip: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      loan: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      loanInstallment: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      importBatch: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      stagedTransaction: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      accountDocument: { findMany: jest.fn().mockResolvedValue([{ id: 'doc-1', storageKey: 'docs/test.pdf', mimeType: 'application/pdf', name: 'test.pdf' }]), upsert: jest.fn() },
      accountVaultEntry: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
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

  it('exports an encrypted backup buffer successfully', async () => {
    const buffer = await service.exportBackup('user-1', 'MySecretPassphrase123');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(60);
    // Header check
    expect(buffer.subarray(0, 14).toString('ascii')).toBe('YAFT_BACKUP_V1');
  });

  it('restores backup successfully when given correct passphrase', async () => {
    const passphrase = 'SuperSecurePassphrase2026';
    const encrypted = await service.exportBackup('user-1', passphrase);

    const result = await service.restoreBackup('user-1', passphrase, encrypted);
    expect(result).toEqual({
      accountsRestored: 1,
      transactionsRestored: 1,
      categoriesRestored: 1,
      documentsRestored: 1,
      filesRestored: 1,
    });

    expect(prisma.account.upsert).toHaveBeenCalled();
    expect(prisma.transaction.upsert).toHaveBeenCalled();
    expect(s3Service.uploadFile).toHaveBeenCalledWith('docs/test.pdf', expect.any(Buffer), 'application/pdf');
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
