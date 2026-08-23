import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSuperCategoryDto, UpdateSuperCategoryDto } from './super-categories.dto';
import { CategoryType } from '@prisma/client';

@Injectable()
export class SuperCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    let superCats = await this.prisma.superCategory.findMany({
      where: { userId },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            color: true,
            type: true,
            _count: { select: { transactions: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { categories: true } },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    if (superCats.length === 0) {
      // Seed default system super categories
      const defaults = [
        { name: 'Expense', kind: CategoryType.EXPENSE, color: '#ef4444', order: 1 },
        { name: 'Income', kind: CategoryType.INCOME, color: '#10b981', order: 2 },
        { name: 'Investment', kind: CategoryType.INVESTMENT, color: '#8b5cf6', order: 3 },
        { name: 'Internal Transfer', kind: CategoryType.TRANSFER, color: '#3b82f6', order: 4 },
        { name: 'Others', kind: CategoryType.OTHER, color: '#64748b', order: 5 },
      ];

      for (const d of defaults) {
        const created = await this.prisma.superCategory.upsert({
          where: { userId_name: { userId, name: d.name } },
          update: { kind: d.kind, color: d.color, order: d.order },
          create: { userId, name: d.name, kind: d.kind, color: d.color, order: d.order },
        });

        // Link existing categories of this kind
        await this.prisma.category.updateMany({
          where: { userId, type: d.kind, superCategoryId: null },
          data: { superCategoryId: created.id },
        });
      }

      superCats = await this.prisma.superCategory.findMany({
        where: { userId },
        include: {
          categories: {
            select: {
              id: true,
              name: true,
              color: true,
              type: true,
              _count: { select: { transactions: true } },
            },
            orderBy: { name: 'asc' },
          },
          _count: { select: { categories: true } },
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
    }

    return superCats;
  }

  async create(userId: string, dto: CreateSuperCategoryDto) {
    const trimmed = dto.name?.trim();
    if (!trimmed) {
      throw new BadRequestException('Super category name is required.');
    }

    const existing = await this.prisma.superCategory.findFirst({
      where: { userId, name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) {
      throw new BadRequestException(`Super category "${trimmed}" already exists.`);
    }

    return this.prisma.superCategory.create({
      data: {
        userId,
        name: trimmed,
        kind: dto.kind || CategoryType.EXPENSE,
        color: dto.color || '#3b82f6',
        icon: dto.icon || null,
        order: dto.order ?? 0,
      },
      include: {
        categories: true,
        _count: { select: { categories: true } },
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateSuperCategoryDto) {
    const existing = await this.prisma.superCategory.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Super category not found.');
    }

    const trimmed = dto.name ? dto.name.trim() : existing.name;
    if (!trimmed) {
      throw new BadRequestException('Super category name cannot be empty.');
    }

    if (trimmed.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.superCategory.findFirst({
        where: { userId, name: { equals: trimmed, mode: 'insensitive' }, id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestException(`Super category "${trimmed}" already exists.`);
      }
    }

    const updated = await this.prisma.superCategory.update({
      where: { id },
      data: {
        name: trimmed,
        kind: dto.kind !== undefined ? dto.kind : existing.kind,
        color: dto.color !== undefined ? dto.color : existing.color,
        icon: dto.icon !== undefined ? dto.icon : existing.icon,
        order: dto.order !== undefined ? dto.order : existing.order,
      },
      include: {
        categories: true,
        _count: { select: { categories: true } },
      },
    });

    // If kind changed, synchronize kind with all child categories
    if (dto.kind && dto.kind !== existing.kind) {
      await this.prisma.category.updateMany({
        where: { superCategoryId: id, userId },
        data: { type: dto.kind },
      });
    }

    return updated;
  }

  async delete(userId: string, id: string) {
    const existing = await this.prisma.superCategory.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Super category not found.');
    }

    // Unlink child categories
    await this.prisma.category.updateMany({
      where: { superCategoryId: id, userId },
      data: { superCategoryId: null },
    });

    await this.prisma.superCategory.delete({ where: { id } });
    return { success: true, message: `Deleted super category "${existing.name}".` };
  }
}
