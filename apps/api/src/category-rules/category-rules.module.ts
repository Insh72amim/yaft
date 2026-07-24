import { Module } from '@nestjs/common';
import { CategoryRulesController } from './category-rules.controller';
import { CategoriesController } from './categories.controller';
import { CategoryRulesService } from './category-rules.service';

@Module({
  controllers: [CategoryRulesController, CategoriesController],
  providers: [CategoryRulesService],
  exports: [CategoryRulesService],
})
export class CategoryRulesModule {}
