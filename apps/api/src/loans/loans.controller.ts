import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateLoanDto } from './loans.dto';
import { LoansService } from './loans.service';

@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateLoanDto) {
    return this.loansService.createLoan(user.id, dto);
  }

  @Get(':loanId/installments')
  async listInstallments(@CurrentUser() user: { id: string }, @Param('loanId') loanId: string) {
    return this.loansService.listInstallments(user.id, loanId);
  }

  @Post(':loanId/installments/:instId/confirm')
  async confirmInstallment(
    @CurrentUser() user: { id: string },
    @Param('loanId') loanId: string,
    @Param('instId') instId: string,
  ) {
    return this.loansService.confirmInstallment(user.id, loanId, instId);
  }
}
