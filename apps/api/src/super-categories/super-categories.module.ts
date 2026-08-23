import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { SuperCategoriesService } from './super-categories.service';
import { SuperCategoriesController } from './super-categories.controller';

@Module({
  imports: [CommonModule],
  controllers: [SuperCategoriesController],
  providers: [SuperCategoriesService],
  exports: [SuperCategoriesService],
})
export class SuperCategoriesModule {}
