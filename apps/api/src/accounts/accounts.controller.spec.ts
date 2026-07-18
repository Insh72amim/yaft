import type { PrismaService } from '../common/prisma.service';
import type { StatementCredentialsService } from '../common/statement-credentials.service';
import { BadRequestException } from '@nestjs/common';
import { AccountsController } from './accounts.controller';

describe('AccountsController statement credential exposure', () => {
  it('returns only saved-password status, never credential storage fields', async () => {
    const prisma = { account: { findMany: jest.fn().mockResolvedValue([{
      id: 'account-a', userId: 'owner-a', name: 'Synthetic bank', type: 'SAVINGS', institution: 'SBI', currency: 'INR',
      openingBalance: 1000n, creditLimit: null, statementDay: null, dueDay: null, archived: false, createdAt: new Date(0),
      transactions: [{ amount: -250n }], statementCredential: { accountId: 'account-a' },
    }]) } } as unknown as PrismaService;
    const credentials = {} as StatementCredentialsService;
    const controller = new AccountsController(prisma, credentials);

    const [account] = await controller.list({ id: 'owner-a' });
    expect(account).toMatchObject({ id: 'account-a', hasStatementPassword: true, balance: 750 });
    expect(account).not.toHaveProperty('statementCredential');
    expect(account).not.toHaveProperty('ciphertext');
    expect((prisma as any).account.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ statementCredential: { select: { accountId: true } } }),
    }));
  });
});

describe('AccountsController savings institutions', () => {
  const credentials = {} as StatementCredentialsService;

  it('creates a savings account for a supported parser bank', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'account-a', userId: 'owner-a', name: 'Salary account', type: 'SAVINGS',
      institution: 'State Bank of India', currency: 'INR', openingBalance: 0n, creditLimit: null });
    const controller = new AccountsController({ account: { create } } as unknown as PrismaService, credentials);

    await controller.create({ id: 'owner-a' }, { name: 'Salary account', type: 'SAVINGS' as never, institution: 'State Bank of India' });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ institution: 'State Bank of India' }) }));
  });

  it('rejects a savings account without one of the three supported parser banks', async () => {
    const create = jest.fn();
    const controller = new AccountsController({ account: { create } } as unknown as PrismaService, credentials);

    await expect(controller.create({ id: 'owner-a' }, { name: 'Other bank', type: 'SAVINGS' as never, institution: 'Other Bank' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
