import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';

const MAGIC_BYTES = Buffer.from('YAFT_BACKUP_V1', 'ascii'); // 14 bytes
const SALT_SIZE = 32;
const IV_SIZE = 12;
const AUTH_TAG_SIZE = 16;
const HEADER_SIZE = MAGIC_BYTES.length + SALT_SIZE + IV_SIZE + AUTH_TAG_SIZE;

export type YaftBackupPayload = {
  metadata: {
    version: string;
    exportedAt: string;
    userId: string;
    accountCount: number;
    transactionCount: number;
    fileCount: number;
    salaryCount?: number;
    organizationCount?: number;
  };
  database: {
    accounts: any[];
    categories: any[];
    categoryRules: any[];
    transactions: any[];
    budgets: any[];
    sips: any[];
    loans: any[];
    loanInstallments: any[];
    importBatches: any[];
    stagedTransactions: any[];
    accountDocuments: any[];
    accountVaultEntries: any[];
    statementCredentials?: any[];
    organizations?: any[];
    salaryStatements?: any[];
    salaryLineItems?: any[];
    tags?: any[];
    transactionTags?: any[];
  };
  files: Array<{
    s3Key: string;
    mimeType: string;
    originalName: string;
    base64Data: string;
  }>;
};

export function encryptYaftBackup(payload: YaftBackupPayload, passphrase: string): Buffer {
  const jsonStr = JSON.stringify(payload);
  const compressedBuffer = gzipSync(Buffer.from(jsonStr, 'utf-8'));

  const salt = randomBytes(SALT_SIZE);
  const iv = randomBytes(IV_SIZE);
  const key = pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha256');

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(compressedBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([MAGIC_BYTES, salt, iv, authTag, ciphertext]);
}

export function decryptYaftBackup(encryptedBuffer: Buffer, passphrase: string): YaftBackupPayload {
  if (encryptedBuffer.length < HEADER_SIZE) {
    throw new Error('Invalid backup file format: File size too small.');
  }

  const magic = encryptedBuffer.subarray(0, MAGIC_BYTES.length);
  if (!magic.equals(MAGIC_BYTES)) {
    throw new Error('Invalid backup file format: Unrecognized header signature.');
  }

  let offset = MAGIC_BYTES.length;
  const salt = encryptedBuffer.subarray(offset, offset + SALT_SIZE);
  offset += SALT_SIZE;

  const iv = encryptedBuffer.subarray(offset, offset + IV_SIZE);
  offset += IV_SIZE;

  const authTag = encryptedBuffer.subarray(offset, offset + AUTH_TAG_SIZE);
  offset += AUTH_TAG_SIZE;

  const ciphertext = encryptedBuffer.subarray(offset);

  const key = pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha256');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const jsonStr = gunzipSync(compressed).toString('utf-8');
    return JSON.parse(jsonStr) as YaftBackupPayload;
  } catch (err: any) {
    throw new Error('Incorrect backup passphrase or corrupted archive file.');
  }
}
