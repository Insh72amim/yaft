import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { UpdateStagedDto } from './imports.dto';
import { ImportsService } from './imports.service';

@Controller('imports')
@UseGuards(JwtAuthGuard)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post(':accountId')
  @UseInterceptors(FileInterceptor('statement', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() user: { id: string }, @Param('accountId') accountId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('A statement file is required.');
    return this.imports.create(user.id, accountId, file);
  }

  @Get()
  pending(@CurrentUser() user: { id: string }) { return this.imports.pending(user.id); }

  @Get(':batchId')
  get(@CurrentUser() user: { id: string }, @Param('batchId') batchId: string) { return this.imports.get(user.id, batchId); }

  @Patch(':batchId/rows/:rowId')
  update(@CurrentUser() user: { id: string }, @Param('batchId') batchId: string, @Param('rowId') rowId: string, @Body() dto: UpdateStagedDto) {
    return this.imports.update(user.id, batchId, rowId, dto);
  }

  @Post(':batchId/commit')
  commit(@CurrentUser() user: { id: string }, @Param('batchId') batchId: string) { return this.imports.commit(user.id, batchId); }

  @Delete(':batchId') @HttpCode(204)
  discard(@CurrentUser() user: { id: string }, @Param('batchId') batchId: string) { return this.imports.discard(user.id, batchId); }
}
