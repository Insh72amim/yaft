import { PrismaService } from '../common/prisma.service';
import { EmailIngestionService } from './email-ingestion.service';
import { getAlertFingerprint, parseEmailAlertSnippet } from './email-alert-parser';

describe('EmailIngestionService Deduplication', () => {
  let service: EmailIngestionService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      account: {
        findFirst: jest.fn().mockResolvedValue({ id: 'acc_123', name: 'ICICI Bank Credit Card', type: 'CREDIT_CARD' }),
        create: jest.fn(),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      stagedTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      importBatch: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'batch_123',
          ...data,
          staged: data.staged.create,
        })),
      },
      emailSyncLog: {
        create: jest.fn().mockResolvedValue({ id: 'log_123' }),
      },
    };

    service = new EmailIngestionService(prisma as any);
  });

  it('should mark duplicate when transaction with same fingerprint exists', async () => {
    const snippet = 'Your ICICI Bank Credit Card XX0001 has been used for a transaction of INR 500.00 on Aug 09, 2026 at 07:34:01. Info: MAKEMYTRIP INDIA PVT LT.';
    const alert = parseEmailAlertSnippet(snippet)!;
    const existingFingerprint = getAlertFingerprint('acc_123', alert);

    prisma.transaction.findMany.mockResolvedValue([{ fingerprint: existingFingerprint }]);

    const result = await service.parseSnippet('user_123', {
      snippet,
      targetAccountId: 'acc_123',
    });

    expect(result.success).toBe(true);
    expect(prisma.importBatch.create).toHaveBeenCalled();
    const createArg = prisma.importBatch.create.mock.calls[0][0];
    const stagedRow = createArg.data.staged.create[0];
    expect(stagedRow.fingerprint).toBe(existingFingerprint);
    expect(stagedRow.isDuplicate).toBe(true);
    expect(stagedRow.include).toBe(false);
  });

  it('should mark as included and non-duplicate when transaction is new', async () => {
    const snippet = 'Your ICICI Bank Credit Card XX0001 has been used for a transaction of INR 500.00 on Aug 09, 2026 at 07:34:01. Info: MAKEMYTRIP INDIA PVT LT.';
    const alert = parseEmailAlertSnippet(snippet)!;
    const expectedFingerprint = getAlertFingerprint('acc_123', alert);

    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.stagedTransaction.findMany.mockResolvedValue([]);

    const result = await service.parseSnippet('user_123', {
      snippet,
      targetAccountId: 'acc_123',
    });

    expect(result.success).toBe(true);
    const createArg = prisma.importBatch.create.mock.calls[0][0];
    const stagedRow = createArg.data.staged.create[0];
    expect(stagedRow.fingerprint).toBe(expectedFingerprint);
    expect(stagedRow.isDuplicate).toBe(false);
    expect(stagedRow.include).toBe(true);
  });
});
