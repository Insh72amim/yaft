import { SuperCategoriesController } from '../../src/super-categories/super-categories.controller';
import { SuperCategoriesService } from '../../src/super-categories/super-categories.service';
import { CategoryType } from '@prisma/client';

describe('SuperCategoriesController', () => {
  let controller: SuperCategoriesController;
  let mockService: Partial<SuperCategoriesService>;

  const mockUser = { id: 'user-123' };

  beforeEach(() => {
    mockService = {
      list: jest.fn().mockResolvedValue([
        { id: 'sc-1', name: 'Living & Household', kind: CategoryType.EXPENSE, color: '#ef4444', categories: [] },
      ]),
      create: jest.fn().mockImplementation((userId, dto) =>
        Promise.resolve({ id: 'sc-2', name: dto.name, kind: dto.kind || CategoryType.EXPENSE, color: dto.color || '#3b82f6', userId })
      ),
      update: jest.fn().mockImplementation((userId, id, dto) =>
        Promise.resolve({ id, name: dto.name || 'Updated Super', kind: dto.kind || CategoryType.EXPENSE, color: dto.color || '#10b981', userId })
      ),
      delete: jest.fn().mockResolvedValue({ success: true, message: 'Super category deleted successfully' }),
    };

    controller = new SuperCategoriesController(mockService as SuperCategoriesService);
  });

  it('should list super categories for current user', async () => {
    const list = await controller.list(mockUser);
    expect(mockService.list).toHaveBeenCalledWith('user-123');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Living & Household');
  });

  it('should create new custom super category', async () => {
    const created = await controller.create(mockUser, {
      name: 'Lifestyle & Fun',
      kind: CategoryType.EXPENSE,
      color: '#ec4899',
    });
    expect(mockService.create).toHaveBeenCalledWith('user-123', {
      name: 'Lifestyle & Fun',
      kind: CategoryType.EXPENSE,
      color: '#ec4899',
    });
    expect(created.name).toBe('Lifestyle & Fun');
  });

  it('should update existing super category', async () => {
    const updated = await controller.update(mockUser, 'sc-1', {
      name: 'Household & Bills',
      color: '#10b981',
    });
    expect(mockService.update).toHaveBeenCalledWith('user-123', 'sc-1', {
      name: 'Household & Bills',
      color: '#10b981',
    });
    expect(updated.name).toBe('Household & Bills');
  });

  it('should delete super category', async () => {
    const result = await controller.delete(mockUser, 'sc-1');
    expect(mockService.delete).toHaveBeenCalledWith('user-123', 'sc-1');
    expect(result.success).toBe(true);
  });
});
