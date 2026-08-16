import { PrismaService } from '../common/prisma.service';
import { TransfersService } from './transfers.service';

describe('TransfersService', () => {
  it('reconciles matching debit and credit transactions occurring on the exact same calendar date', async () => {
    const findManyTx = jest.fn().mockResolvedValue([
      {
        id: 'tx-debit-1',
        accountId: 'acc-hdfc',
        amount: -500000n,
        transactionDate: new Date('2026-07-10T10:00:00Z'),
        descriptionRaw: 'TRANSFER TO SBI XX9988',
        account: { id: 'acc-hdfc', name: 'HDFC Bank', institution: 'HDFC', type: 'BANK' },
      },
      {
        id: 'tx-credit-1',
        accountId: 'acc-sbi',
        amount: 500000n,
        transactionDate: new Date('2026-07-10T14:00:00Z'),
        descriptionRaw: 'NEFT FROM HDFC',
        account: { id: 'acc-sbi', name: 'SBI Bank', institution: 'SBI', type: 'SAVINGS' },
      },
    ]);

    const findManyVault = jest.fn().mockResolvedValue([
      { accountId: 'acc-sbi', last4: '9988' },
    ]);

    const updateTx = jest.fn().mockResolvedValue({});
    const transactionMock = jest.fn().mockImplementation((promises) => Promise.all(promises));

    const prisma = {
      transaction: {
        findMany: findManyTx,
        update: updateTx,
      },
      accountVaultEntry: {
        findMany: findManyVault,
      },
      $transaction: transactionMock,
    } as unknown as PrismaService;

    const service = new TransfersService(prisma);
    const result = await service.reconcileTransfers('user-1');

    expect(result).toEqual({ matchedPairsCount: 1 });
    expect(updateTx).toHaveBeenCalledTimes(2);
  });

  it('reconciles matching cross-account transactions settling across 1 calendar day', async () => {
    const findManyTx = jest.fn().mockResolvedValue([
      {
        id: 'tx-debit-1',
        accountId: 'acc-hdfc',
        amount: -500000n,
        transactionDate: new Date('2026-07-10T23:30:00Z'),
        descriptionRaw: 'TRANSFER TO SBI XX9988',
        account: { id: 'acc-hdfc', name: 'HDFC Bank', institution: 'HDFC', type: 'BANK' },
      },
      {
        id: 'tx-credit-1',
        accountId: 'acc-sbi',
        amount: 500000n,
        transactionDate: new Date('2026-07-11T08:00:00Z'),
        descriptionRaw: 'NEFT FROM HDFC',
        account: { id: 'acc-sbi', name: 'SBI Bank', institution: 'SBI', type: 'SAVINGS' },
      },
    ]);

    const findManyVault = jest.fn().mockResolvedValue([
      { accountId: 'acc-sbi', last4: '9988' },
    ]);

    const updateTx = jest.fn().mockResolvedValue({});
    const transactionMock = jest.fn().mockImplementation((promises) => Promise.all(promises));

    const prisma = {
      transaction: {
        findMany: findManyTx,
        update: updateTx,
      },
      accountVaultEntry: {
        findMany: findManyVault,
      },
      $transaction: transactionMock,
    } as unknown as PrismaService;

    const service = new TransfersService(prisma);
    const result = await service.reconcileTransfers('user-1');

    expect(result).toEqual({ matchedPairsCount: 1 });
    expect(updateTx).toHaveBeenCalledTimes(2);
  });

  it('rejects matching transactions occurring beyond the allowed multi-day tolerance window', async () => {
    const findManyTx = jest.fn().mockResolvedValue([
      {
        id: 'tx-debit-1',
        accountId: 'acc-hdfc',
        amount: -500000n,
        transactionDate: new Date('2026-07-10T10:00:00Z'),
        descriptionRaw: 'TRANSFER TO SBI XX9988',
        account: { id: 'acc-hdfc', name: 'HDFC Bank', institution: 'HDFC', type: 'BANK' },
      },
      {
        id: 'tx-credit-1',
        accountId: 'acc-sbi',
        amount: 500000n,
        transactionDate: new Date('2026-07-15T12:00:00Z'),
        descriptionRaw: 'NEFT FROM HDFC',
        account: { id: 'acc-sbi', name: 'SBI Bank', institution: 'SBI', type: 'SAVINGS' },
      },
    ]);

    const findManyVault = jest.fn().mockResolvedValue([
      { accountId: 'acc-sbi', last4: '9988' },
    ]);

    const updateTx = jest.fn().mockResolvedValue({});

    const prisma = {
      transaction: {
        findMany: findManyTx,
        update: updateTx,
      },
      accountVaultEntry: {
        findMany: findManyVault,
      },
    } as unknown as PrismaService;

    const service = new TransfersService(prisma);
    const result = await service.reconcileTransfers('user-1');

    expect(result).toEqual({ matchedPairsCount: 0 });
    expect(updateTx).not.toHaveBeenCalled();
  });
});
