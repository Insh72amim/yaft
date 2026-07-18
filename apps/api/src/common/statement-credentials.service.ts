import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from './prisma.service';

export type EncryptedStatementCredential = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
};

const KEY_VERSION = 1;

function decodeKey(encoded = process.env.YAFT_CREDENTIAL_ENCRYPTION_KEY) {
  if (!encoded) throw new Error('YAFT_CREDENTIAL_ENCRYPTION_KEY is required. Generate a base64-encoded 32-byte key.');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) {
    throw new Error('YAFT_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error('YAFT_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
}

export class StatementCredentialCipher {
  private readonly key: Buffer;

  constructor(encodedKey?: string) {
    this.key = decodeKey(encodedKey);
  }

  encrypt(accountId: string, password: string): EncryptedStatementCredential {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(accountId, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    return { ciphertext, iv, authTag: cipher.getAuthTag(), keyVersion: KEY_VERSION };
  }

  decrypt(accountId: string, encrypted: EncryptedStatementCredential) {
    if (encrypted.keyVersion !== KEY_VERSION) throw new Error('Unsupported statement credential key version.');
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, encrypted.iv);
      decipher.setAAD(Buffer.from(accountId, 'utf8'));
      decipher.setAuthTag(encrypted.authTag);
      return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('Statement credential authentication failed.');
    }
  }
}

@Injectable()
export class StatementCredentialsService {
  private readonly cipher = new StatementCredentialCipher();

  constructor(private readonly prisma: PrismaService) {}

  encrypt(accountId: string, password: string) {
    return this.cipher.encrypt(accountId, password);
  }

  async getPassword(userId: string, accountId: string) {
    const credential = await this.prisma.statementCredential.findFirst({
      where: { accountId, account: { userId } },
    });
    if (!credential) return undefined;
    try {
      return this.cipher.decrypt(accountId, {
        ciphertext: Buffer.from(credential.ciphertext), iv: Buffer.from(credential.iv),
        authTag: Buffer.from(credential.authTag), keyVersion: credential.keyVersion,
      });
    } catch {
      throw new InternalServerErrorException('The saved statement password cannot be decrypted. Forget it and enter the password again.');
    }
  }

  async forget(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true } });
    if (!account) return false;
    await this.prisma.statementCredential.deleteMany({ where: { accountId } });
    return true;
  }
}
