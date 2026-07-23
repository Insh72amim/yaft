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

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.categoryRules.delete(user.id, id);
  }
}
