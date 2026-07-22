import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { basename } from 'path';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../s3/s3.service';

export const MAX_ACCOUNT_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ACCOUNT_DOCUMENTS_PER_UPLOAD = 10;

const ELIGIBLE_ACCOUNT_TYPES: AccountType[] = [
  AccountType.BANK,
  AccountType.SAVINGS,
  AccountType.LOAN,
];

type StoredDocument = {
  id: string;
  accountId: string;
  name: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
  createdAt: Date;
};

type ValidatedFile = {
  name: string;
  mimeType: string;
  extension: 'pdf' | 'png' | 'jpg';
  byteSize: number;
  buffer: Buffer;
};

function identifyFile(buffer: Buffer): Pick<ValidatedFile, 'mimeType' | 'extension'> | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  return null;
}

function safeDisplayName(originalName: string, extension: ValidatedFile['extension']): string {
  const leaf = basename(originalName.replace(/\\/g, '/'))
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/gi, '')
    .trim();
  const stem = leaf.replace(/\.[^.]*$/, '').trim().slice(0, 150) || 'document';
  return `${stem}.${extension}`;
}

function serialize(document: StoredDocument) {
  return {
    id: document.id,
    name: document.name,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    createdAt: document.createdAt,
  };
}

@Injectable()
export class AccountDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async list(userId: string, accountId: string) {
    await this.requireEligibleAccount(userId, accountId);
    const documents = await this.prisma.accountDocument.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map((document) => serialize(document));
  }

  async upload(userId: string, accountId: string, files: Express.Multer.File[] | undefined) {
    await this.requireEligibleAccount(userId, accountId);
    if (!files?.length) throw new BadRequestException('Choose at least one PDF or image.');
    if (files.length > MAX_ACCOUNT_DOCUMENTS_PER_UPLOAD) {
      throw new BadRequestException(`Upload up to ${MAX_ACCOUNT_DOCUMENTS_PER_UPLOAD} documents at a time.`);
    }

    const validated = files.map((file) => this.validateFile(file));
    const pending = validated.map((file) => {
      const id = randomUUID();
      return {
        id,
        ...file,
        storageKey: `account-documents/${userId}/${accountId}/${id}.${file.extension}`,
      };
    });
    const uploadedKeys: string[] = [];

    try {
      for (const document of pending) {
        await this.s3.uploadFile(document.storageKey, document.buffer, document.mimeType);
        uploadedKeys.push(document.storageKey);
      }
      await this.prisma.accountDocument.createMany({
        data: pending.map((document) => ({
          id: document.id,
          accountId,
          name: document.name,
          mimeType: document.mimeType,
          byteSize: document.byteSize,
          storageKey: document.storageKey,
        })),
      });
      const created = await this.prisma.accountDocument.findMany({
        where: { id: { in: pending.map((document) => document.id) } },
        orderBy: { createdAt: 'desc' },
      });
      return created.map((document) => serialize(document));
    } catch {
      await this.prisma.accountDocument.deleteMany({
        where: { id: { in: pending.map((document) => document.id) } },
      }).catch(() => undefined);
      await Promise.allSettled(uploadedKeys.map((key) => this.s3.deleteFile(key)));
      throw new ServiceUnavailableException('Documents could not be stored. Try again.');
    }
  }

  async content(userId: string, accountId: string, documentId: string) {
    const document = await this.findOwnedDocument(userId, accountId, documentId);
    const buffer = await this.s3.downloadFile(document.storageKey);
    return { buffer, name: document.name, mimeType: document.mimeType };
  }

  async remove(userId: string, accountId: string, documentId: string) {
    const document = await this.findOwnedDocument(userId, accountId, documentId);
    await this.s3.deleteFile(document.storageKey);
    await this.prisma.accountDocument.delete({ where: { id: document.id } });
  }

  async purgeForAccount(userId: string, accountId: string) {
    const documents = await this.prisma.accountDocument.findMany({
      where: { accountId, account: { userId } },
      select: { id: true, storageKey: true },
    });
    for (const document of documents) await this.s3.deleteFile(document.storageKey);
    if (documents.length) {
      await this.prisma.accountDocument.deleteMany({
        where: { id: { in: documents.map((document) => document.id) } },
      });
    }
  }

  private async requireEligibleAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        userId,
        archived: false,
        type: { in: ELIGIBLE_ACCOUNT_TYPES },
      },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Eligible account not found.');
    return account;
  }

  private async findOwnedDocument(userId: string, accountId: string, documentId: string): Promise<StoredDocument> {
    const document = await this.prisma.accountDocument.findFirst({
      where: {
        id: documentId,
        accountId,
        account: {
          userId,
          archived: false,
          type: { in: ELIGIBLE_ACCOUNT_TYPES },
        },
      },
    });
    if (!document) throw new NotFoundException('Document not found.');
    return document;
  }

  private validateFile(file: Express.Multer.File): ValidatedFile {
    if (!file.buffer.length) throw new BadRequestException('Empty documents cannot be uploaded.');
    if (file.buffer.length > MAX_ACCOUNT_DOCUMENT_BYTES) {
      throw new BadRequestException('Each document must be 8 MB or smaller.');
    }
    const identified = identifyFile(file.buffer);
    if (!identified) throw new BadRequestException('Only PDF, PNG, and JPEG documents are supported.');
    return {
      ...identified,
      name: safeDisplayName(file.originalname, identified.extension),
      byteSize: file.buffer.length,
      buffer: file.buffer,
    };
  }
}
