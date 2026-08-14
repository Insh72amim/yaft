import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TagsService } from './tags.service';
import { AssignTagsDto, AutoApplyTagDto, CreateTagDto, RangeTagAndCategorizeDto, UpdateTagDto } from './tags.dto';

@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.tagsService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateTagDto) {
    return this.tagsService.create(user.id, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tagsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.tagsService.delete(user.id, id);
  }

  @Get(':id/analytics')
  getTagAnalytics(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.tagsService.getTagAnalytics(user.id, id);
  }

  @Post('assign')
  assignTags(@CurrentUser() user: { id: string }, @Body() dto: AssignTagsDto) {
    return this.tagsService.assignTags(user.id, dto);
  }

  @Post('range-apply')
  rangeTagAndCategorize(@CurrentUser() user: { id: string }, @Body() dto: RangeTagAndCategorizeDto) {
    return this.tagsService.rangeTagAndCategorize(user.id, dto);
  }

  @Post(':id/auto-apply')
  autoApplyTag(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: AutoApplyTagDto) {
    return this.tagsService.autoApplyTag(user.id, id, dto);
  }
}
