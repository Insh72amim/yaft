import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CategoryRulesService } from './category-rules.service';
import { CreateCategoryRuleDto, UpdateCategoryRuleDto } from './category-rules.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoryRules: CategoryRulesService) {}

  @Get()
  getCategories(@CurrentUser() user: { id: string }) {
    return this.categoryRules.listCategories(user.id);
  }

  @Post()
  createCategory(
    @CurrentUser() user: { id: string },
    @Body() body: { name: string; color?: string; type?: any; superCategoryId?: string | null },
  ) {
    return this.categoryRules.createCategory(user.id, body.name, body.color, body.type, body.superCategoryId);
  }

  @Put(':id')
  updateCategory(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string; type?: any; superCategoryId?: string | null },
  ) {
    return this.categoryRules.updateCategory(user.id, id, body.name, body.color, body.type, body.superCategoryId);
  }

  @Delete(':id')
  deleteCategory(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.categoryRules.deleteCategory(user.id, id);
  }

  @Get('rules')
  listRules(@CurrentUser() user: { id: string }) {
    return this.categoryRules.list(user.id);
  }

  @Post('rules')
  createRule(@CurrentUser() user: { id: string }, @Body() dto: CreateCategoryRuleDto) {
    return this.categoryRules.create(user.id, dto);
  }

  @Post('rules/apply')
  applyRetroactively(@CurrentUser() user: { id: string }) {
    return this.categoryRules.applyRetroactively(user.id);
  }

  @Put('rules/:id')
  updateRule(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateCategoryRuleDto) {
    return this.categoryRules.update(user.id, id, dto);
  }

  @Delete('rules/:id')
  @HttpCode(204)
  deleteRule(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.categoryRules.delete(user.id, id);
  }

  @Post('batch-update')
  batchUpdate(
    @CurrentUser() user: { id: string },
    @Body() body: { transactionIds: string[]; categoryId: string | null },
  ) {
    return this.categoryRules.batchUpdate(user.id, body.transactionIds, body.categoryId);
  }
}
