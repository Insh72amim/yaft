import type { PrismaService } from '../common/prisma.service';
import type { StatementCredentialsService } from '../common/statement-credentials.service';
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
