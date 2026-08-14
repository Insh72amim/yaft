import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { UpdateStagedDto } from '../imports/imports.dto';
import { UnifiedImportUploadDto } from './unified-imports.dto';
import { UnifiedImportsService } from './unified-imports.service';

@Controller('imports/unified')
@UseGuards(JwtAuthGuard)
export class UnifiedImportsController {
  constructor(private readonly unifiedImports: UnifiedImportsService) {}

  @Get('options')
  options(@CurrentUser() user: { id: string }) { return this.unifiedImports.options(user.id); }

  @Get('pending')
  pending(@CurrentUser() user: { id: string }) { return this.unifiedImports.pending(user.id); }

  @Get('history')
  history(@CurrentUser() user: { id: string }) { return this.unifiedImports.getHistory(user.id); }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() user: { id: string }, @UploadedFile() file: Express.Multer.File, @Body() dto: UnifiedImportUploadDto) {
    if (!file) throw new BadRequestException('Choose a file to import.');
    return this.unifiedImports.upload(user.id, file, dto);
  }

  @Patch('bank-reviews/:batchId/rows/:rowId')
  updateBankReview(@CurrentUser() user: { id: string }, @Param('batchId') batchId: string,
    @Param('rowId') rowId: string, @Body() dto: UpdateStagedDto) {
    return this.unifiedImports.updateBankReview(user.id, batchId, rowId, dto);
  }

  @Post('bank-reviews/:batchId/commit')
  commitBankReview(@CurrentUser() user: { id: string }, @Param('batchId') batchId: string) {
    return this.unifiedImports.commitBankReview(user.id, batchId);
  }

  @Delete('bank-reviews/:batchId') @HttpCode(204)
  discardBankReview(@CurrentUser() user: { id: string }, @Param('batchId') batchId: string) {
    return this.unifiedImports.discardBankReview(user.id, batchId);
  }

  @Post('salary-reviews/:statementId/commit')
  commitSalaryReview(@CurrentUser() user: { id: string }, @Param('statementId') statementId: string) {
    return this.unifiedImports.commitSalaryReview(user.id, statementId);
  }

  @Delete('salary-reviews/:statementId') @HttpCode(204)
  discardSalaryReview(@CurrentUser() user: { id: string }, @Param('statementId') statementId: string) {
    return this.unifiedImports.discardSalaryReview(user.id, statementId);
  }
}
