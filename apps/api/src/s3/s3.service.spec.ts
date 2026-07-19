import type { S3Client } from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

const createMockS3Client = () => ({
  send: jest.fn(),
});

const createMockConfigService = (overrides: Record<string, string> = {}): jest.Mocked<ConfigService> => ({
  getOrThrow: jest.fn((key: string) => {
    const defaults: Record<string, string> = {
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
      S3_BUCKET: 'yaft-documents',
    };
    return defaults[key] ?? overrides[key];
  }),
  get: jest.fn((key: string) => overrides[key]),
} as unknown as jest.Mocked<ConfigService>);

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => createMockS3Client()),
  HeadBucketCommand: jest.fn(),
  CreateBucketCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

describe('S3Service', () => {
  let service: S3Service;
  let config: jest.Mocked<ConfigService>;
  let mockSend: jest.Mock;
  let MockS3Client: jest.Mock;

  beforeEach(() => {
    mockSend = jest.fn();
    MockS3Client = require('@aws-sdk/client-s3').S3Client as jest.Mock;
    MockS3Client.mockImplementation(() => ({ send: mockSend } as unknown as S3Client));
    config = createMockConfigService();
    service = new S3Service(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('does not create the bucket when HeadBucket succeeds', async () => {
      mockSend.mockResolvedValueOnce({});
      await service.onModuleInit();
      expect(require('@aws-sdk/client-s3').CreateBucketCommand).not.toHaveBeenCalled();
    });

    it('creates the bucket when HeadBucket returns 404', async () => {
      const notFound = new Error('Not Found');
      (notFound as any).name = 'NotFound';
      (notFound as any).$metadata = { httpStatusCode: 404 };
      mockSend.mockRejectedValueOnce(notFound).mockResolvedValueOnce({});
      await service.onModuleInit();
      expect(require('@aws-sdk/client-s3').CreateBucketCommand).toHaveBeenCalled();
    });

    it('rethrows non-NotFound errors', async () => {
      const serverError = new Error('Server error');
      (serverError as any).$metadata = { httpStatusCode: 500 };
      mockSend.mockRejectedValueOnce(serverError);
      await expect(service.onModuleInit()).rejects.toThrow('Server error');
    });
  });

  describe('uploadFile', () => {
    it('sends a PutObjectCommand with the correct payload', async () => {
      mockSend.mockResolvedValueOnce({});
      await service.uploadFile('salaries/user-1/stmt-1.pdf', Buffer.from('pdf'), 'application/pdf');
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'yaft-documents',
        Key: 'salaries/user-1/stmt-1.pdf',
        Body: Buffer.from('pdf'),
        ContentType: 'application/pdf',
      });
      expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    });
  });

  describe('downloadFile', () => {
    it('concatenates stream chunks into a buffer', async () => {
      mockSend.mockResolvedValueOnce({
        Body: (async function* () { yield Buffer.from('hel'); yield Buffer.from('lo'); })() as any,
      });
      const buffer = await service.downloadFile('salaries/user-1/stmt-1.pdf');
      expect(buffer.toString()).toBe('hello');
    });
  });

  describe('deleteFile', () => {
    it('sends a DeleteObjectCommand with the correct key', async () => {
      mockSend.mockResolvedValueOnce({});
      await service.deleteFile('salaries/user-1/stmt-1.pdf');
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'yaft-documents',
        Key: 'salaries/user-1/stmt-1.pdf',
      });
      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });
  });
});
