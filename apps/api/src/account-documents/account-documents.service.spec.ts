import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import type { PrismaService } from '../common/prisma.service';
import type { S3Service } from '../s3/s3.service';
import { AccountDocumentsService } from './account-documents.service';

const pdf = Buffer.from('%PDF-1.7\nsynthetic');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function file(name: string, buffer: Buffer, mimetype = 'application/octet-stream') {
  return { originalname: name, buffer, size: buffer.length, mimetype } as Express.Multer.File;
}

function document(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'document-a',
    accountId: 'account-a',
    name: 'agreement.pdf',
    mimeType: 'application/pdf',
    byteSize: pdf.length,
    storageKey: 'account-documents/opaque-key.pdf',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function setup() {
  const prisma = {
    account: { findFirst: jest.fn().mockResolvedValue({ id: 'account-a' }) },
    accountDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const s3 = {
    uploadFile: jest.fn().mockResolvedValue(undefined),
    downloadFile: jest.fn().mockResolvedValue(pdf),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };
  return {
    prisma,
    s3,
    service: new AccountDocumentsService(prisma as unknown as PrismaService, s3 as unknown as S3Service),
  };
}

describe('AccountDocumentsService', () => {
  it('lists only metadata and never exposes storage keys', async () => {
    const { service, prisma } = setup();
    prisma.accountDocument.findMany.mockResolvedValue([document()]);

    const result = await service.list('owner-a', 'account-a');

    expect(prisma.account.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'account-a',
        userId: 'owner-a',
        archived: false,
        type: { in: Object.values(AccountType) },
      }),
    }));
    expect(result[0]).toEqual({
      id: 'document-a',
      name: 'agreement.pdf',
      mimeType: 'application/pdf',
      byteSize: pdf.length,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(result[0]).not.toHaveProperty('storageKey');
  });

  it('rejects document access when the account is not owned and eligible', async () => {
    const { service, prisma } = setup();
    prisma.account.findFirst.mockResolvedValue(null);

    await expect(service.list('owner-a', 'another-account')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.accountDocument.findMany).not.toHaveBeenCalled();
  });

  it('validates file signatures instead of trusting names or MIME headers', async () => {
    const { service, s3 } = setup();

    await expect(service.upload('owner-a', 'account-a', [file('unsafe.pdf', Buffer.from('not a pdf'), 'application/pdf')]))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });

  it('stores multiple PDFs and images under opaque keys and returns safe metadata', async () => {
    const { service, prisma, s3 } = setup();
    prisma.accountDocument.findMany.mockImplementation(({ where }: any) => Promise.resolve([
      document({ id: where.id.in[0], name: 'agreement.pdf' }),
      document({ id: where.id.in[1], name: 'scan.png', mimeType: 'image/png', byteSize: png.length }),
    ]));

    const result = await service.upload('owner-a', 'account-a', [
      file('../agreement.exe', pdf),
      file('scan.png', png),
    ]);

    expect(s3.uploadFile).toHaveBeenCalledTimes(2);
    for (const [key] of s3.uploadFile.mock.calls) {
      expect(key).toMatch(/^account-documents\/owner-a\/account-a\/[0-9a-f-]+\.(pdf|png)$/);
      expect(key).not.toContain('agreement');
      expect(key).not.toContain('scan');
    }
    expect(prisma.accountDocument.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ name: 'agreement.pdf', mimeType: 'application/pdf' }),
        expect.objectContaining({ name: 'scan.png', mimeType: 'image/png' }),
      ]),
    });
    expect(result).toHaveLength(2);
    expect(result[0]).not.toHaveProperty('storageKey');
  });

  it('removes already uploaded objects when a later upload fails', async () => {
    const { service, s3 } = setup();
    s3.uploadFile.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(service.upload('owner-a', 'account-a', [file('one.pdf', pdf), file('two.png', png)]))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(s3.deleteFile).toHaveBeenCalledTimes(1);
  });

  it('scopes inline content lookup to the owner and requested account', async () => {
    const { service, prisma, s3 } = setup();
    prisma.accountDocument.findFirst.mockResolvedValue(document());

    const result = await service.content('owner-a', 'account-a', 'document-a');

    expect(prisma.accountDocument.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-a',
        accountId: 'account-a',
        account: expect.objectContaining({ userId: 'owner-a', archived: false }),
      },
    });
    expect(s3.downloadFile).toHaveBeenCalledWith('account-documents/opaque-key.pdf');
    expect(result).toEqual({ buffer: pdf, name: 'agreement.pdf', mimeType: 'application/pdf' });
  });

  it('does not reveal whether an unowned document exists', async () => {
    const { service, prisma, s3 } = setup();
    prisma.accountDocument.findFirst.mockResolvedValue(null);

    await expect(service.content('owner-a', 'account-a', 'another-document')).rejects.toBeInstanceOf(NotFoundException);
    expect(s3.downloadFile).not.toHaveBeenCalled();
  });

  it('deletes the stored object before its metadata', async () => {
    const { service, prisma, s3 } = setup();
    prisma.accountDocument.findFirst.mockResolvedValue(document());

    await service.remove('owner-a', 'account-a', 'document-a');

    expect(s3.deleteFile).toHaveBeenCalledWith('account-documents/opaque-key.pdf');
    expect(prisma.accountDocument.delete).toHaveBeenCalledWith({ where: { id: 'document-a' } });
    expect(s3.deleteFile.mock.invocationCallOrder[0]).toBeLessThan(prisma.accountDocument.delete.mock.invocationCallOrder[0]);
  });

  it('purges storage objects using an owner-scoped database lookup', async () => {
    const { service, prisma, s3 } = setup();
    prisma.accountDocument.findMany.mockResolvedValue([
      { id: 'document-a', storageKey: 'account-documents/opaque-a.pdf' },
      { id: 'document-b', storageKey: 'account-documents/opaque-b.png' },
    ]);

    await service.purgeForAccount('owner-a', 'account-a');

    expect(prisma.accountDocument.findMany).toHaveBeenCalledWith({
      where: { accountId: 'account-a', account: { userId: 'owner-a' } },
      select: { id: true, storageKey: true },
    });
    expect(s3.deleteFile).toHaveBeenCalledTimes(2);
    expect(prisma.accountDocument.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['document-a', 'document-b'] } },
    });
  });
});
