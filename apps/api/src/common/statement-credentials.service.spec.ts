import { randomBytes } from 'crypto';
import type { PrismaService } from './prisma.service';
import { StatementCredentialCipher, StatementCredentialsService } from './statement-credentials.service';

describe('StatementCredentialCipher', () => {
  const key = randomBytes(32).toString('base64');

  it('round trips account-bound passwords with random ciphertext', () => {
    const cipher = new StatementCredentialCipher(key);
    const first = cipher.encrypt('account-a', 'document password');
    const second = cipher.encrypt('account-a', 'document password');
    expect(first.ciphertext.equals(second.ciphertext) && first.iv.equals(second.iv)).toBe(false);
    expect(cipher.decrypt('account-a', first)).toBe('document password');
  });

  it('rejects a tampered tag and a different account id', () => {
    const cipher = new StatementCredentialCipher(key);
    const encrypted = cipher.encrypt('account-a', 'document password');
    const tampered = { ...encrypted, authTag: Buffer.from(encrypted.authTag) };
    tampered.authTag[0] ^= 1;
    expect(() => cipher.decrypt('account-a', tampered)).toThrow('authentication failed');
    expect(() => cipher.decrypt('account-b', encrypted)).toThrow('authentication failed');
  });

  it('refuses to initialise without a valid dedicated key', () => {
    expect(() => new StatementCredentialCipher('')).toThrow('YAFT_CREDENTIAL_ENCRYPTION_KEY is required');
    expect(() => new StatementCredentialCipher(Buffer.alloc(31).toString('base64'))).toThrow('base64-encoded 32-byte key');
  });

  it('forgets only a credential belonging to the authenticated owner', async () => {
    const previous = process.env.YAFT_CREDENTIAL_ENCRYPTION_KEY;
    process.env.YAFT_CREDENTIAL_ENCRYPTION_KEY = key;
    const prisma = { account: { findFirst: jest.fn().mockResolvedValue({ id: 'account-a' }) },
      statementCredential: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } } as unknown as PrismaService;
    try {
      const service = new StatementCredentialsService(prisma);
      await expect(service.forget('owner-a', 'account-a')).resolves.toBe(true);
      expect((prisma as any).account.findFirst).toHaveBeenCalledWith({ where: { id: 'account-a', userId: 'owner-a' }, select: { id: true } });
      expect((prisma as any).statementCredential.deleteMany).toHaveBeenCalledWith({ where: { accountId: 'account-a' } });
    } finally {
      if (previous === undefined) delete process.env.YAFT_CREDENTIAL_ENCRYPTION_KEY;
      else process.env.YAFT_CREDENTIAL_ENCRYPTION_KEY = previous;
    }
  });
});
