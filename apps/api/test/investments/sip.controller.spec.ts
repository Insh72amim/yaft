import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../src/common/prisma.service';
import { SipController } from '../../src/investments/sip.controller';

describe('SipController', () => {
  let controller: SipController;
  let prisma: PrismaService;

  const mockUser = { id: 'user-1' };

  beforeEach(() => {
    prisma = {
      activeSip: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      account: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;

    controller = new SipController(prisma);
  });

  describe('getSips', () => {
    it('returns formatted list of active SIPs', async () => {
      ((prisma as any).activeSip.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sip-1',
          accountId: 'broker-1',
          account: { id: 'broker-1', name: 'Zerodha', institution: 'Zerodha' },
          name: 'Parag Parikh Flexi Cap',
          folioNumber: '12345/67',
          amount: 500000n,
          frequency: 'MONTHLY',
          sipDay: 10,
          sourceAccountId: 'bank-1',
          billerKeyword: 'BSE MEMBERS',
          status: 'ACTIVE',
          createdAt: new Date(),
        },
      ]);

      (prisma.account.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'bank-1',
          name: 'HDFC Savings',
          institution: 'HDFC',
          vaultEntry: { last4: '1234' },
        },
      ]);

      const result = await controller.getSips(mockUser);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'sip-1',
        name: 'Parag Parikh Flexi Cap',
        amount: 500000,
        sourceAccountName: 'HDFC Savings',
        sourceAccountLast4: '1234',
      });
    });
  });

  describe('createSip', () => {
    it('creates a new SIP when inputs are valid', async () => {
      (prisma.account.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'broker-1', userId: 'user-1' }) // broker check
        .mockResolvedValueOnce({ id: 'bank-1', userId: 'user-1' }); // bank check

      ((prisma as any).activeSip.create as jest.Mock).mockResolvedValue({
        id: 'sip-new',
        userId: 'user-1',
        accountId: 'broker-1',
        name: 'Nippon India Small Cap',
        folioNumber: null,
        amount: 250000n,
        frequency: 'MONTHLY',
        sipDay: 5,
        sourceAccountId: 'bank-1',
        billerKeyword: 'NIPPON',
        status: 'ACTIVE',
      });

      const result = await controller.createSip(mockUser, {
        accountId: 'broker-1',
        name: 'Nippon India Small Cap',
        amount: 2500,
        sourceAccountId: 'bank-1',
        billerKeyword: 'NIPPON',
      });

      expect(result).toMatchObject({
        id: 'sip-new',
        name: 'Nippon India Small Cap',
        amount: 250000,
      });
    });

    it('throws BadRequestException if required fields are missing', async () => {
      await expect(
        controller.createSip(mockUser, { accountId: '', name: '', amount: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if broker account does not exist', async () => {
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        controller.createSip(mockUser, {
          accountId: 'nonexistent',
          name: 'Fund A',
          amount: 1000,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSip', () => {
    it('updates an active SIP', async () => {
      ((prisma as any).activeSip.findFirst as jest.Mock).mockResolvedValue({
        id: 'sip-1',
        userId: 'user-1',
      });
      ((prisma as any).activeSip.update as jest.Mock).mockResolvedValue({
        id: 'sip-1',
        name: 'Updated Fund Name',
        amount: 1000000n,
      });

      const result = await controller.updateSip(mockUser, 'sip-1', {
        name: 'Updated Fund Name',
        amount: 10000,
      });

      expect(result).toMatchObject({
        id: 'sip-1',
        name: 'Updated Fund Name',
        amount: 1000000,
      });
    });
  });

  describe('deleteSip', () => {
    it('deletes an active SIP', async () => {
      ((prisma as any).activeSip.findFirst as jest.Mock).mockResolvedValue({
        id: 'sip-1',
        userId: 'user-1',
      });
      ((prisma as any).activeSip.delete as jest.Mock).mockResolvedValue({});

      await controller.deleteSip(mockUser, 'sip-1');

      expect((prisma as any).activeSip.delete).toHaveBeenCalledWith({
        where: { id: 'sip-1' },
      });
    });
  });
});
