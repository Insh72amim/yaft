import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../common/prisma.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      organization: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue({ id: 'org-1' }),
      },
      salaryStatement: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    service = new OrganizationsService(prismaMock as unknown as PrismaService);
  });

  describe('update', () => {
    it('throws NotFoundException if organization does not exist or belong to user', async () => {
      prismaMock.organization.findFirst.mockResolvedValue(null);

      await expect(service.update('user-1', 'org-1', { name: 'Acme Corp' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates organization attributes without triggering any salaryStatement updates', async () => {
      const existingOrg = {
        id: 'org-1',
        userId: 'user-1',
        name: 'Old Org Name',
        isCurrent: false,
      };
      const updatedOrg = {
        ...existingOrg,
        name: 'New Org Name',
        color: '#ff0000',
      };

      prismaMock.organization.findFirst.mockResolvedValue(existingOrg);
      prismaMock.organization.update.mockResolvedValue(updatedOrg);

      const result = await service.update('user-1', 'org-1', {
        name: 'New Org Name',
        color: '#ff0000',
      });

      expect(result).toEqual(updatedOrg);
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: expect.objectContaining({
          name: 'New Org Name',
          color: '#ff0000',
        }),
      });

      // Verify that salaryStatement update and findMany were NEVER called
      expect(prismaMock.salaryStatement.update).not.toHaveBeenCalled();
      expect(prismaMock.salaryStatement.findMany).not.toHaveBeenCalled();
    });

    it('resets other organizations current flag when isCurrent is set to true', async () => {
      const existingOrg = { id: 'org-1', userId: 'user-1', name: 'Acme', isCurrent: false };
      prismaMock.organization.findFirst.mockResolvedValue(existingOrg);
      prismaMock.organization.update.mockResolvedValue({ ...existingOrg, isCurrent: true });

      await service.update('user-1', 'org-1', { isCurrent: true });

      expect(prismaMock.organization.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isCurrent: false },
      });
    });
  });

  describe('create', () => {
    it('throws BadRequestException if organization with same name exists', async () => {
      prismaMock.organization.findFirst.mockResolvedValue({ id: 'org-1', name: 'Google' });

      await expect(service.create('user-1', { name: 'Google' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates organization and auto-links unlinked salary statements via updateMany', async () => {
      const createdOrg = {
        id: 'org-new',
        userId: 'user-1',
        name: 'Google India',
        currency: 'INR',
        color: '#4f46e5',
        isCurrent: true,
      };

      prismaMock.organization.findFirst.mockResolvedValue(null);
      prismaMock.organization.count.mockResolvedValue(0);
      prismaMock.organization.create.mockResolvedValue(createdOrg);

      const result = await service.create('user-1', { name: 'Google India' });

      expect(result).toEqual(createdOrg);
      expect(prismaMock.salaryStatement.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: null,
          employer: { contains: 'Google India', mode: 'insensitive' },
        },
        data: { organizationId: 'org-new' },
      });
    });
  });
});
