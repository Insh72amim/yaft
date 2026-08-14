import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CategoryRulesService } from './category-rules.service';
import { CreateCategoryRuleDto, UpdateCategoryRuleDto } from './category-rules.dto';

@Controller('category-rules')
@UseGuards(JwtAuthGuard)
export class CategoryRulesController {
  constructor(private readonly categoryRules: CategoryRulesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.categoryRules.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateCategoryRuleDto) {
    return this.categoryRules.create(user.id, dto);
  }

  @Post('apply')
  applyRetroactively(@CurrentUser() user: { id: string }) {
    return this.categoryRules.applyRetroactively(user.id);
  }

  @Put(':id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateCategoryRuleDto) {
    return this.categoryRules.update(user.id, id, dto);
  }

  @Get('categories')
  getCategories(@CurrentUser() user: { id: string }) {
    return this.categoryRules.listCategories(user.id);
  }

  @Post('batch-update')
  batchUpdate(
    @CurrentUser() user: { id: string },
    @Body() body: { transactionIds: string[]; categoryId: string | null },
  ) {
    return this.categoryRules.batchUpdate(user.id, body.transactionIds, body.categoryId);
  }

  @Post('seed-defaults')
  seedDefaults(@CurrentUser() user: { id: string }) {
    return this.categoryRules.seedDefaultRules(user.id);
  }

  @Get('unverified')
  getUnverified(@CurrentUser() user: { id: string }) {
    return this.categoryRules.getUnverifiedByCategory(user.id);
  }

  @Post('confirm')
  confirmTransactions(
    @CurrentUser() user: { id: string },
    @Body() body: { transactionIds: string[] },
  ) {
    return this.categoryRules.confirmTransactions(user.id, body.transactionIds);
  }

  @Post('confirm-category/:id')
  confirmCategory(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.categoryRules.confirmCategory(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.categoryRules.delete(user.id, id);
  }
}
