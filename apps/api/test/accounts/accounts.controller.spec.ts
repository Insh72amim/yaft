import type { PrismaService } from '../../src/common/prisma.service';
import type { StatementCredentialsService } from '../../src/common/statement-credentials.service';
import type { AccountDocumentsService } from '../../src/account-documents/account-documents.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountsController } from '../../src/accounts/accounts.controller';
import { AccountsService } from '../../src/accounts/accounts.service';

const accountDocuments = () => ({ purgeForAccount: jest.fn() }) as unknown as AccountDocumentsService;

describe('AccountsController & AccountsService statement credential exposure', () => {
  it('returns only saved-password status, never credential storage fields', async () => {
    const prisma = { account: { findMany: jest.fn().mockResolvedValue([{
      id: 'account-a', userId: 'owner-a', name: 'Synthetic bank', type: 'SAVINGS', institution: 'SBI', currency: 'INR',
      openingBalance: 1000n, creditLimit: null, statementDay: null, dueDay: null, archived: false, createdAt: new Date(0),
      transactions: [{ amount: -250n }], statementCredential: { accountId: 'account-a' }, vaultEntry: null,
    }]) } } as unknown as PrismaService;
    const credentials = {} as StatementCredentialsService;
    const service = new AccountsService(prisma, credentials, accountDocuments());
    const controller = new AccountsController(service);

    const [account] = await controller.list({ id: 'owner-a' });
    expect(account).toMatchObject({ id: 'account-a', hasStatementPassword: true, balance: 750 });
    expect(account).not.toHaveProperty('statementCredential');
    expect(account).not.toHaveProperty('vaultEntry');
    expect(account).not.toHaveProperty('ciphertext');
  });

  it('returns only safe card display metadata from the vault', async () => {
    const prisma = { account: { findMany: jest.fn().mockResolvedValue([{
      id: 'card-a', userId: 'owner-a', name: 'Synthetic card', type: 'CREDIT_CARD', institution: 'Example Bank', currency: 'INR',
      openingBalance: 0n, creditLimit: 100000n, statementDay: 12, dueDay: 30, archived: false, createdAt: new Date(0),
      transactions: [{ amount: -2500n }], statementCredential: null, loans: [], holdings: [],
      vaultEntry: { last4: '4242', cardNetwork: 'Visa' },
    }]) } } as unknown as PrismaService;
    const service = new AccountsService(prisma, {} as StatementCredentialsService, accountDocuments());
    const controller = new AccountsController(service);

    const [account] = await controller.list({ id: 'owner-a' });

    expect(account).toMatchObject({ id: 'card-a', cardLast4: '4242', cardNetwork: 'Visa', balance: -2500 });
    expect(account).not.toHaveProperty('vaultEntry');
  });
});

describe('AccountsController & AccountsService savings institutions', () => {
  const credentials = {} as StatementCredentialsService;

  it('creates a savings account for a supported parser bank', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'account-a', userId: 'owner-a', name: 'Salary account', type: 'SAVINGS',
      institution: 'State Bank of India', currency: 'INR', openingBalance: 0n, creditLimit: null });
    const prisma = { account: { create } } as unknown as PrismaService;
    const service = new AccountsService(prisma, credentials, accountDocuments());
    const controller = new AccountsController(service);

    await controller.create({ id: 'owner-a' }, { name: 'Salary account', type: 'SAVINGS' as never, institution: 'State Bank of India' });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ institution: 'State Bank of India' }) }));
  });

  it('rejects a savings account without one of the three supported parser banks', async () => {
    const create = jest.fn();
    const prisma = { account: { create } } as unknown as PrismaService;
    const service = new AccountsService(prisma, credentials, accountDocuments());
    const controller = new AccountsController(service);

    await expect(controller.create({ id: 'owner-a' }, { name: 'Other bank', type: 'SAVINGS' as never, institution: 'Other Bank' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('AccountsController & AccountsService stock brokers', () => {
  const credentials = {} as StatementCredentialsService;

  it('creates a stock account for a supported broker', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'account-a', userId: 'owner-a', name: 'Demat account', type: 'STOCKS',
      institution: 'Zerodha', currency: 'INR', openingBalance: 0n, creditLimit: null });
    const prisma = { account: { create } } as unknown as PrismaService;
    const service = new AccountsService(prisma, credentials, accountDocuments());
    const controller = new AccountsController(service);

    await controller.create({ id: 'owner-a' }, { name: 'Demat account', type: 'STOCKS' as never, institution: 'Zerodha' });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ institution: 'Zerodha' }) }));
  });

  it('rejects a stock account without the supported broker', async () => {
    const create = jest.fn();
    const prisma = { account: { create } } as unknown as PrismaService;
    const service = new AccountsService(prisma, credentials, accountDocuments());
    const controller = new AccountsController(service);

    await expect(controller.create({ id: 'owner-a' }, { name: 'Other demat', type: 'STOCKS' as never, institution: 'Other Broker' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('AccountsController & AccountsService transaction history', () => {
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
    const service = new AccountsService(prisma, credentials, accountDocuments());
    const controller = new AccountsController(service);

    const result = await controller.transactions({ id: 'owner-a' }, 'account-a', 1);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'account-a', userId: 'owner-a', archived: false } }));
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
    const service = new AccountsService(prisma, credentials, accountDocuments());
    const controller = new AccountsController(service);

    const result = await controller.transactions({ id: 'owner-a' }, 'card-a', 1);

    expect(result.account).toEqual(expect.objectContaining({ creditLimit: 100000, statementDay: 12, dueDay: 30,
      cardLast4: '4242', cardNetwork: 'Visa', balance: -2500 }));
  });

  it('does not query transactions when the account is not owned by the current user', async () => {
    const count = jest.fn();
    const prisma = { account: { findFirst: jest.fn().mockResolvedValue(null) },
      transaction: { count, aggregate: jest.fn(), findMany: jest.fn() }, category: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService;
    const service = new AccountsService(prisma, credentials, accountDocuments());
    const controller = new AccountsController(service);

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
    const service = new AccountsService(prisma, credentials, accountDocuments());
    const controller = new AccountsController(service);

    const result = await controller.allTransactions({ id: 'owner-a' }, 1, '50', undefined, 'super', '10', '100', 'EXPENSE');

    expect(findMany).toHaveBeenCalled();
    expect(result.transactions[0]).toMatchObject({ id: 'tx-1', accountName: 'HDFC', amount: -5000 });
  });
});

describe('AccountsController & AccountsService account deletion', () => {
  const credentials = {} as StatementCredentialsService;

  it('deletes an owned account after an exact name confirmation', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'account-a', name: 'Synthetic bank' });
    const deleteAccount = jest.fn().mockResolvedValue({ id: 'account-a' });
    const findLinkedTransfers = jest.fn().mockResolvedValue([{ transferGroupId: 'synthetic-transfer' }]);
    const unlinkTransfers = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = { account: { delete: deleteAccount }, transaction: { findMany: findLinkedTransfers, updateMany: unlinkTransfers } };
    const runTransaction = jest.fn().mockImplementation((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction));
    const documents = accountDocuments();
    const prisma = { account: { findFirst, delete: deleteAccount }, statementCredential: { deleteMany: jest.fn() }, transaction: { deleteMany: jest.fn() }, accountVaultEntry: { deleteMany: jest.fn() }, loan: { deleteMany: jest.fn() }, $transaction: runTransaction } as unknown as PrismaService;
    const service = new AccountsService(prisma, credentials, documents);
    const controller = new AccountsController(service);

    await expect(controller.deleteAccount({ id: 'owner-a' }, 'account-a', { confirmationName: 'Synthetic bank' })).resolves.toBeUndefined();
    expect(documents.purgeForAccount).toHaveBeenCalledWith('owner-a', 'account-a');
  });

  it('rejects an inexact confirmation without deleting anything', async () => {
    const deleteAccount = jest.fn();
    const runTransaction = jest.fn();
    const prisma = { account: { findFirst: jest.fn().mockResolvedValue({ id: 'account-a', name: 'Synthetic bank' }) },
      $transaction: runTransaction } as unknown as PrismaService;
    const service = new AccountsService(prisma, credentials, accountDocuments());
    const controller = new AccountsController(service);

    await expect(controller.deleteAccount({ id: 'owner-a' }, 'account-a', { confirmationName: 'synthetic bank' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });
});

describe('AccountsController & AccountsService getCreditCardsSummary', () => {
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

    const service = new AccountsService(prisma, {} as StatementCredentialsService, accountDocuments());
    const controller = new AccountsController(service);
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

  it('correctly calculates pooled limit and available credit for parent and child cards without double-counting', async () => {
    const parentCard = {
      id: 'card-parent',
      name: 'ICICI Sapphiro',
      type: 'CREDIT_CARD',
      institution: 'ICICI Bank',
      openingBalance: 0n,
      creditLimit: 500000n,
      statementDay: 15,
      dueDay: 5,
      parentAccountId: null,
      parentAccount: null,
      childAccounts: [{ id: 'card-child', name: 'ICICI Amazon Pay', creditLimit: null, statementDay: 15, dueDay: 5 }],
      vaultEntry: { last4: '1001', cardNetwork: 'VISA' },
    };

    const childCard = {
      id: 'card-child',
      name: 'ICICI Amazon Pay',
      type: 'CREDIT_CARD',
      institution: 'ICICI Bank',
      openingBalance: 0n,
      creditLimit: null,
      statementDay: 15,
      dueDay: 5,
      parentAccountId: 'card-parent',
      parentAccount: { id: 'card-parent', name: 'ICICI Sapphiro', creditLimit: 500000n, statementDay: 15, dueDay: 5 },
      childAccounts: [],
      vaultEntry: { last4: '2002', cardNetwork: 'VISA' },
    };

    const findManyAccounts = jest.fn().mockResolvedValue([parentCard, childCard]);
    const findManyTx = jest.fn().mockResolvedValue([
      {
        id: 'tx-1',
        accountId: 'card-parent',
        amount: -10000n,
        transactionDate: new Date('2026-07-20T10:00:00Z'),
        descriptionRaw: 'HOTEL STAY',
        merchant: 'HOTEL STAY',
        categoryId: 'cat-1',
        category: { id: 'cat-1', name: 'Travel', color: '#10b981' },
        account: { id: 'card-parent', name: 'ICICI Sapphiro' },
      },
      {
        id: 'tx-2',
        accountId: 'card-child',
        amount: -40000n,
        transactionDate: new Date('2026-07-21T10:00:00Z'),
        descriptionRaw: 'AMAZON IN',
        merchant: 'AMAZON IN',
        categoryId: 'cat-2',
        category: { id: 'cat-2', name: 'Shopping', color: '#3b82f6' },
        account: { id: 'card-child', name: 'ICICI Amazon Pay' },
      },
    ]);

    const prisma = {
      account: { findMany: findManyAccounts },
      transaction: { findMany: findManyTx },
    } as unknown as PrismaService;

    const service = new AccountsService(prisma, {} as StatementCredentialsService, accountDocuments());
    const controller = new AccountsController(service);
    const res = await controller.getCreditCardsSummary({ id: 'user-a' });

    // Pool limit is 500,000 (NOT 1,000,000)
    expect(res.summary.totalLimit).toBe(500000);
    // Group spends = 10,000 + 40,000 = 50,000
    expect(res.summary.totalOutstanding).toBe(50000);
    // Available credit = 450,000
    expect(res.summary.totalAvailable).toBe(450000);
    // Utilization = (50,000 / 500,000) * 100 = 10%
    expect(res.summary.utilizationRate).toBe(10);

    const parentRes = res.cards.find((c) => c.id === 'card-parent')!;
    const childRes = res.cards.find((c) => c.id === 'card-child')!;

    expect(parentRes.isParent).toBe(true);
    expect(parentRes.isShared).toBe(true);
    expect(parentRes.poolOutstanding).toBe(50000);
    expect(parentRes.poolAvailableCredit).toBe(450000);
    expect(parentRes.outstanding).toBe(10000);

    expect(childRes.isChild).toBe(true);
    expect(childRes.isShared).toBe(true);
    expect(childRes.parentAccountName).toBe('ICICI Sapphiro');
    expect(childRes.poolOutstanding).toBe(50000);
    expect(childRes.poolAvailableCredit).toBe(450000);
    expect(childRes.outstanding).toBe(40000);
  });
});
