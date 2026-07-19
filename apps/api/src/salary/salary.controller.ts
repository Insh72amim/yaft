import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SalaryService } from './salary.service';

@Controller('salary-statements')
@UseGuards(JwtAuthGuard)
export class SalaryController {
  constructor(private readonly salary: SalaryService) {}

  @Get()
  overview(@CurrentUser() user: { id: string }) { return this.salary.overview(user.id); }

  @Get(':statementId')
  get(@CurrentUser() user: { id: string }, @Param('statementId') statementId: string) { return this.salary.get(user.id, statementId); }

  @Post('upload')
  @UseInterceptors(FileInterceptor('payslip', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() user: { id: string }, @UploadedFile() file: Express.Multer.File, @Body('payslipSchema') payslipSchema?: string, @Body('pdfPassword') pdfPassword?: string, @Body('salaryType') salaryType?: string) {
    if (!file || !/\.pdf$/i.test(file.originalname)) throw new BadRequestException('Choose a PDF payslip.');
    return this.salary.upload(user.id, file, payslipSchema, pdfPassword, salaryType);
  }


  @Post(':statementId/commit')
  commit(@CurrentUser() user: { id: string }, @Param('statementId') statementId: string) { return this.salary.commit(user.id, statementId); }

  @Delete(':statementId') @HttpCode(204)
  discard(@CurrentUser() user: { id: string }, @Param('statementId') statementId: string) { return this.salary.discard(user.id, statementId); }

  @Get(':statementId/view')
  async view(@CurrentUser() user: { id: string }, @Param('statementId') statementId: string, @Res() res: Response) {
    const buffer = await this.salary.view(user.id, statementId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
    });
    res.send(buffer);
  }

  @Get(':statementId/download')
  async download(@CurrentUser() user: { id: string }, @Param('statementId') statementId: string, @Res() res: Response) {
    const { buffer, payPeriod } = await this.salary.download(user.id, statementId);
    const date = payPeriod.toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payslip-${date}.pdf"`,
    });
    res.send(buffer);
  }
}
