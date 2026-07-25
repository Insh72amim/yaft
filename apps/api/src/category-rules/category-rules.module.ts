import { Module } from '@nestjs/common';
import { CategoryRulesController } from './category-rules.controller';
import { CategoriesController } from './categories.controller';
import { BudgetsController } from './budgets.controller';
import { CategoryRulesService } from './category-rules.service';
import { BudgetsService } from './budgets.service';

@Module({
  controllers: [CategoryRulesController, CategoriesController, BudgetsController],
  providers: [CategoryRulesService, BudgetsService],
  exports: [CategoryRulesService, BudgetsService],
})
export class CategoryRulesModule {}
