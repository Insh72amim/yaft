import type { PrismaService } from '../common/prisma.service';
import type { StatementCredentialsService } from '../common/statement-credentials.service';
import type { AccountDocumentsService } from '../account-documents/account-documents.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountsController } from './accounts.controller';

const accountDocuments = () => ({ purgeForAccount: jest.fn() }) as unknown as AccountDocumentsService;

describe('AccountsController statement credential exposure', () => {
  it('returns only saved-password status, never credential storage fields', async () => {
    const prisma = { account: { findMany: jest.fn().mockResolvedValue([{
      id: 'account-a', userId: 'owner-a', name: 'Synthetic bank', type: 'SAVINGS', institution: 'SBI', currency: 'INR',
      openingBalance: 1000n, creditLimit: null, statementDay: null, dueDay: null, archived: false, createdAt: new Date(0),
      transactions: [{ amount: -250n }], statementCredential: { accountId: 'account-a' }, vaultEntry: null,
    }]) } } as unknown as PrismaService;
    const credentials = {} as StatementCredentialsService;
    const controller = new AccountsController(prisma, credentials, accountDocuments());

    const [account] = await controller.list({ id: 'owner-a' });
    expect(account).toMatchObject({ id: 'account-a', hasStatementPassword: true, balance: 750 });
    expect(account).not.toHaveProperty('statementCredential');
    expect(account).not.toHaveProperty('vaultEntry');
    expect(account).not.toHaveProperty('ciphertext');
    expect((prisma as any).account.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ statementCredential: { select: { accountId: true } },
        vaultEntry: { select: { last4: true, cardNetwork: true } } }),
    }));
  });

  it('returns only safe card display metadata from the vault', async () => {
    const prisma = { account: { findMany: jest.fn().mockResolvedValue([{
      id: 'card-a', userId: 'owner-a', name: 'Synthetic card', type: 'CREDIT_CARD', institution: 'Example Bank', currency: 'INR',
      openingBalance: 0n, creditLimit: 100000n, statementDay: 12, dueDay: 30, archived: false, createdAt: new Date(0),
      transactions: [{ amount: -2500n }], statementCredential: null, loans: [], holdings: [],
      vaultEntry: { last4: '4242', cardNetwork: 'Visa' },
    }]) } } as unknown as PrismaService;
    const controller = new AccountsController(prisma, {} as StatementCredentialsService, accountDocuments());

    const [account] = await controller.list({ id: 'owner-a' });

    expect(account).toMatchObject({ id: 'card-a', cardLast4: '4242', cardNetwork: 'Visa', balance: -2500 });
    expect(account).not.toHaveProperty('vaultEntry');
    expect(account).not.toHaveProperty('cardNumber');
    expect(account).not.toHaveProperty('cardNumberCipher');
  });
});

describe('AccountsController savings institutions', () => {
  const credentials = {} as StatementCredentialsService;

  it('creates a savings account for a supported parser bank', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'account-a', userId: 'owner-a', name: 'Salary account', type: 'SAVINGS',
      institution: 'State Bank of India', currency: 'INR', openingBalance: 0n, creditLimit: null });
    const controller = new AccountsController({ account: { create } } as unknown as PrismaService, credentials, accountDocuments());

    await controller.create({ id: 'owner-a' }, { name: 'Salary account', type: 'SAVINGS' as never, institution: 'State Bank of India' });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ institution: 'State Bank of India' }) }));
  });

  it('rejects a savings account without one of the three supported parser banks', async () => {
    const create = jest.fn();
    const controller = new AccountsController({ account: { create } } as unknown as PrismaService, credentials, accountDocuments());

    await expect(controller.create({ id: 'owner-a' }, { name: 'Other bank', type: 'SAVINGS' as never, institution: 'Other Bank' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('AccountsController stock brokers', () => {
  const credentials = {} as StatementCredentialsService;

  it('creates a stock account for a supported broker', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'account-a', userId: 'owner-a', name: 'Demat account', type: 'STOCKS',
      institution: 'Zerodha', currency: 'INR', openingBalance: 0n, creditLimit: null });
    const controller = new AccountsController({ account: { create } } as unknown as PrismaService, credentials, accountDocuments());

    await controller.create({ id: 'owner-a' }, { name: 'Demat account', type: 'STOCKS' as never, institution: 'Zerodha' });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ institution: 'Zerodha' }) }));
  });

  it('rejects a stock account without the supported broker', async () => {
    const create = jest.fn();
    const controller = new AccountsController({ account: { create } } as unknown as PrismaService, credentials, accountDocuments());

    await expect(controller.create({ id: 'owner-a' }, { name: 'Other demat', type: 'STOCKS' as never, institution: 'Other Broker' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('AccountsController transaction history', () => {
  const credentials = {} as StatementCredentialsService;

  it('returns a paginated ledger for an account owned by the current user', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'account-a', name: 'Synthetic bank', type: 'SAVINGS',
      institution: 'Axis Bank', currency: 'INR', openingBalance: 1000n, creditLimit: null, statementDay: null, dueDay: null,
      vaultEntry: null });
    const count = jest.fn().mockResolvedValue(1);
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: -250n } });
    const findMany = jest.fn().mockResolvedValue([{ id: 'transaction-a', transactionDate: new Date('2026-01-02T00:00:00Z'), postedDate: null,
      descriptionRaw: 'SYNTHETIC PURCHASE', merchant: 'Synthetic merchant', amount: -250n, transferGroupId: null,
      category: { name: 'Shopping' } }]);
    const prisma = { account: { findFirst }, transaction: { count, aggregate, findMany }, category: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService;
    const controller = new AccountsController(prisma, credentials, accountDocuments());

    const result = await controller.transactions({ id: 'owner-a' }, 'account-a', 1);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'account-a', userId: 'owner-a', archived: false } }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ accountId: 'account-a', account: expect.objectContaining({ userId: 'owner-a', archived: false }) }), skip: 0, take: 50,
    }));
    expect(result.account).toMatchObject({ id: 'account-a', openingBalance: 1000, balance: 750 });
    expect(result.transactions[0]).toMatchObject({ id: 'transaction-a', description: 'Synthetic merchant', amount: -250, category: 'Shopping' });
    expect(result.pagination).toEqual({ page: 1, pageSize: 50, total: 1, pages: 1 });
  });

  it('includes safe credit-card display and cycle details in the ledger response', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'card-a', name: 'Synthetic card', type: 'CREDIT_CARD',
      institution: 'Example Bank', currency: 'INR', openingBalance: 0n, creditLimit: 100000n, statementDay: 12, dueDay: 30,
      vaultEntry: { last4: '4242', cardNetwork: 'Visa' } });
    const prisma = { account: { findFirst }, transaction: {
      count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: -2500n } }),
      findMany: jest.fn().mockResolvedValue([]),
    }, category: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService;
    const controller = new AccountsController(prisma, credentials, accountDocuments());

    const result = await controller.transactions({ id: 'owner-a' }, 'card-a', 1);

    expect(result.account).toEqual(expect.objectContaining({ creditLimit: 100000, statementDay: 12, dueDay: 30,
      cardLast4: '4242', cardNetwork: 'Visa', balance: -2500 }));
    expect(result.account).not.toHaveProperty('vaultEntry');
  });

  it('does not query transactions when the account is not owned by the current user', async () => {
    const count = jest.fn();
    const controller = new AccountsController({ account: { findFirst: jest.fn().mockResolvedValue(null) },
      transaction: { count, aggregate: jest.fn(), findMany: jest.fn() }, category: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService, credentials, accountDocuments());

    await expect(controller.transactions({ id: 'owner-a' }, 'another-account', 1)).rejects.toBeInstanceOf(NotFoundException);
    expect(count).not.toHaveBeenCalled();
  });

  it('queries all-transactions across accounts with amount range filters', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: -5000n } });
    const findMany = jest.fn().mockResolvedValue([{
      id: 'tx-1', accountId: 'acc-1', transactionDate: new Date(), postedDate: null,
      descriptionRaw: 'SHOPPING', merchant: 'Supermarket', amount: -5000n, transferGroupId: null,
      account: { id: 'acc-1', name: 'HDFC', type: 'SAVINGS', institution: 'HDFC' },
      category: { name: 'Groceries' },
    }]);
    const prisma = { transaction: { count, aggregate, findMany }, category: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService;
    const controller = new AccountsController(prisma, credentials, accountDocuments());

    const result = await controller.allTransactions({ id: 'owner-a' }, 1, '50', undefined, 'super', '10', '100', 'EXPENSE');

    expect(findMany).toHaveBeenCalled();
    expect(result.transactions[0]).toMatchObject({ id: 'tx-1', accountName: 'HDFC', amount: -5000 });
  });

  it('queries all-transactions with date range filters', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: -5000n } });
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { transaction: { count, aggregate, findMany }, category: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService;
    const controller = new AccountsController(prisma, credentials, accountDocuments());

    await controller.allTransactions({ id: 'owner-a' }, 1, '50', undefined, undefined, undefined, undefined, undefined, '2026-04-01', '2026-04-30');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        transactionDate: expect.objectContaining({
          gte: new Date('2026-04-01'),
        }),
      }),
    }));
  });
});

describe('AccountsController account deletion', () => {
  const credentials = {} as StatementCredentialsService;

  it('deletes an owned account after an exact name confirmation', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'account-a', name: 'Synthetic bank' });
    const deleteAccount = jest.fn().mockResolvedValue({ id: 'account-a' });
    const findLinkedTransfers = jest.fn().mockResolvedValue([{ transferGroupId: 'synthetic-transfer' }]);
    const unlinkTransfers = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = { account: { delete: deleteAccount }, transaction: { findMany: findLinkedTransfers, updateMany: unlinkTransfers } };
    const runTransaction = jest.fn().mockImplementation((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction));
    const documents = accountDocuments();
    const controller = new AccountsController({ account: { findFirst }, $transaction: runTransaction } as unknown as PrismaService, credentials, documents);

    await expect(controller.deleteAccount({ id: 'owner-a' }, 'account-a', { confirmationName: 'Synthetic bank' })).resolves.toBeUndefined();

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'account-a', userId: 'owner-a' }, select: { id: true, name: true } });
    expect(documents.purgeForAccount).toHaveBeenCalledWith('owner-a', 'account-a');
    expect(deleteAccount).toHaveBeenCalledWith({ where: { id: 'account-a' } });
    expect(unlinkTransfers).toHaveBeenCalledWith({ where: { accountId: { not: 'account-a' }, account: { userId: 'owner-a' },
      transferGroupId: { in: ['synthetic-transfer'] } }, data: { transferGroupId: null } });
  });

  it('rejects an inexact confirmation without deleting anything', async () => {
    const deleteAccount = jest.fn();
    const runTransaction = jest.fn();
    const controller = new AccountsController({ account: { findFirst: jest.fn().mockResolvedValue({ id: 'account-a', name: 'Synthetic bank' }) },
      $transaction: runTransaction } as unknown as PrismaService, credentials, accountDocuments());

    await expect(controller.deleteAccount({ id: 'owner-a' }, 'account-a', { confirmationName: 'synthetic bank' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('does not delete an account that is not owned by the current user', async () => {
    const deleteAccount = jest.fn();
    const runTransaction = jest.fn();
    const controller = new AccountsController({ account: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: runTransaction } as unknown as PrismaService, credentials, accountDocuments());

    await expect(controller.deleteAccount({ id: 'owner-a' }, 'another-account', { confirmationName: 'Synthetic bank' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });
});

describe('AccountsController getCreditCardsSummary', () => {
  it('returns aggregated credit utilization, card stack, and monthly cash flow', async () => {
    const cardAccounts = [
      {
        id: 'card-1',
        name: 'Axis Bank Credit Card',
        type: 'CREDIT_CARD',
        institution: 'Axis Bank',
        openingBalance: 0n,
        creditLimit: 100000n,
        statementDay: 15,
        dueDay: 5,
        vaultEntry: { last4: '0001', cardNetwork: 'VISA' },
      },
    ];

    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: -25000n } });
    const findManyAccounts = jest.fn().mockResolvedValue(cardAccounts);
    const findManyTx = jest.fn().mockResolvedValue([
      {
        id: 'tx-1',
        accountId: 'card-1',
        amount: -25000n,
        transactionDate: new Date('2026-07-20T10:00:00Z'),
        descriptionRaw: 'SHOPPING STORE',
        merchant: 'SHOPPING STORE',
        categoryId: 'cat-1',
        category: { id: 'cat-1', name: 'Shopping', color: '#10b981' },
        account: { id: 'card-1', name: 'Axis Bank Credit Card' },
      },
    ]);

    const prisma = {
      account: { findMany: findManyAccounts },
      transaction: { aggregate, findMany: findManyTx },
    } as unknown as PrismaService;

    const controller = new AccountsController(prisma, {} as StatementCredentialsService, accountDocuments());
    const res = await controller.getCreditCardsSummary({ id: 'user-a' });

    expect(res.summary.totalLimit).toBe(100000);
    expect(res.summary.totalOutstanding).toBe(25000);
    expect(res.summary.totalAvailable).toBe(75000);
    expect(res.summary.utilizationRate).toBe(25);
    expect(res.cards).toHaveLength(1);
    expect(res.cards[0].cardLast4).toBe('0001');
    expect(res.overallFlow.topRecipients).toHaveLength(1);
    expect(res.recentTransactions).toHaveLength(1);
  });
});
