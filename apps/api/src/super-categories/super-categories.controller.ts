import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SuperCategoriesService } from './super-categories.service';
import { CreateSuperCategoryDto, UpdateSuperCategoryDto } from './super-categories.dto';

@Controller('super-categories')
@UseGuards(JwtAuthGuard)
export class SuperCategoriesController {
  constructor(private readonly superCategoriesService: SuperCategoriesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.superCategoriesService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateSuperCategoryDto) {
    return this.superCategoriesService.create(user.id, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateSuperCategoryDto,
  ) {
    return this.superCategoriesService.update(user.id, id, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.superCategoriesService.delete(user.id, id);
  }
}
