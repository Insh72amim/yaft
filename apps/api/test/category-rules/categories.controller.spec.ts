import { CategoriesController } from '../../src/category-rules/categories.controller';
import { CategoryRulesService } from '../../src/category-rules/category-rules.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let mockService: Partial<CategoryRulesService>;

  const mockUser = { id: 'user-123' };

  beforeEach(() => {
    mockService = {
      listCategories: jest.fn().mockResolvedValue([
        { id: 'cat-1', name: 'Food & Dining', color: '#3b82f6', type: 'EXPENSE' },
      ]),
      createCategory: jest.fn().mockImplementation((userId, name, color, type, superCategoryId) =>
        Promise.resolve({ id: 'cat-2', name, color: color || '#3b82f6', type: type || 'EXPENSE', superCategoryId: superCategoryId || null, userId })
      ),
      updateCategory: jest.fn().mockImplementation((userId, id, name, color, type, superCategoryId) =>
        Promise.resolve({ id, name: name || 'Updated Name', color: color || '#10b981', type: type || 'EXPENSE', superCategoryId: superCategoryId || null, userId })
      ),
      deleteCategory: jest.fn().mockResolvedValue({ success: true, message: 'Category deleted successfully' }),
    };

    controller = new CategoriesController(mockService as CategoryRulesService);
  });

  it('should list categories for current user', async () => {
    const categories = await controller.getCategories(mockUser);
    expect(mockService.listCategories).toHaveBeenCalledWith('user-123');
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe('Food & Dining');
  });

  it('should create new custom category', async () => {
    const created = await controller.createCategory(mockUser, {
      name: 'Subscriptions',
      color: '#ef4444',
      type: 'EXPENSE',
      superCategoryId: 'sc-1',
    });
    expect(mockService.createCategory).toHaveBeenCalledWith('user-123', 'Subscriptions', '#ef4444', 'EXPENSE', 'sc-1');
    expect(created.name).toBe('Subscriptions');
    expect(created.color).toBe('#ef4444');
  });

  it('should update existing category', async () => {
    const updated = await controller.updateCategory(mockUser, 'cat-1', {
      name: 'Dining & Outing',
      color: '#10b981',
      superCategoryId: 'sc-1',
    });
    expect(mockService.updateCategory).toHaveBeenCalledWith('user-123', 'cat-1', 'Dining & Outing', '#10b981', undefined, 'sc-1');
    expect(updated.name).toBe('Dining & Outing');
  });

  it('should delete custom category', async () => {
    const result = await controller.deleteCategory(mockUser, 'cat-1');
    expect(mockService.deleteCategory).toHaveBeenCalledWith('user-123', 'cat-1');
    expect(result.success).toBe(true);
  });
});
