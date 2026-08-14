import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../common/prisma.service';
import { CreateLoanDto } from './loans.dto';

@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoansController {
  constructor(private readonly prisma: PrismaService) {}

  // helper: generate amortization schedule (paise integers)
  private generateSchedule(principalPaise: bigint, annualRatePct: number, emiPaise: bigint, startDate: Date, termMonths?: number) {
    const schedule: Array<any> = [];
    let balance = BigInt(principalPaise);
    const monthlyRate = (annualRatePct / 100) / 12; // e.g. 9.5 -> 0.095/12

    if (Number(emiPaise) <= 0) throw new Error('EMI must be positive');

    // quick safety: if emi <= interest on initial balance -> negative amortization
    const initialInterest = Math.round(Number(balance) * monthlyRate);
    if (Number(emiPaise) <= initialInterest) throw new Error('EMI too small to cover interest; increase EMI or provide term.');

    let month = 0;
    while (balance > 0n) {
      if (termMonths !== undefined && month >= termMonths) break;
      const interest = Math.round(Number(balance) * monthlyRate);
      let principalPayment = Number(emiPaise) - interest;
      if (principalPayment < 0) principalPayment = 0;
      if (BigInt(principalPayment) > balance) {
        principalPayment = Number(balance);
      }
      const emiPaid = interest + principalPayment;
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + month);

      schedule.push({ dueDate, principalAmount: BigInt(principalPayment), interestAmount: BigInt(interest), emiAmount: BigInt(emiPaid), balance: balance - BigInt(principalPayment) });

      balance = balance - BigInt(principalPayment);
      month += 1;

      // safety cap to avoid infinite loop
      if (month > 600) break; // 50 years
    }

    return schedule;
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateLoanDto) {
    // validate account exists and belongs to user
    const account = await this.prisma.account.findFirst({ where: { id: dto.accountId, userId: user.id } });
    if (!account) throw new NotFoundException('Account not found');

    const principalPaise = BigInt(dto.principal);
    const emiPaise = BigInt(dto.emiAmount);
    const startDate = new Date(dto.startDate);

    let schedule;
    try {
      schedule = this.generateSchedule(principalPaise, dto.interestRate, emiPaise, startDate, dto.termMonths);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid loan parameters');
    }

    // create loan and installments in a transaction
    const loan = await this.prisma.$transaction(async (tx) => {
      const createdLoan = await tx.loan.create({ data: { accountId: dto.accountId, startDate: startDate, principal: principalPaise, interestRate: dto.interestRate.toString(), emiAmount: emiPaise, emiDay: dto.emiDay, termMonths: dto.termMonths ?? schedule.length } });

      const installmentsData = schedule.map((s, idx) => ({ loanId: createdLoan.id, dueDate: s.dueDate, principalAmount: s.principalAmount, interestAmount: s.interestAmount, emiAmount: s.emiAmount, balance: s.balance, status: s.dueDate < new Date() ? ('PAST_UNCONFIRMED' as const) : ('FUTURE' as const) }));

      await tx.loanInstallment.createMany({ data: installmentsData });
      return createdLoan;
    });

    return { loanId: loan.id, installments: schedule.length };
  }

  @Get(':loanId/installments')
  async listInstallments(@CurrentUser() user: { id: string }, @Param('loanId') loanId: string) {
    const loan = await this.prisma.loan.findFirst({ where: { id: loanId }, include: { account: true } });
    if (!loan) throw new NotFoundException('Loan not found');
    // ensure account belongs to user
    if (loan.account.userId !== user.id) throw new NotFoundException('Loan not found');

    const installments = await this.prisma.loanInstallment.findMany({ where: { loanId }, orderBy: { dueDate: 'asc' } });
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const dueIds = installments
      .filter((i: any) => i.status === 'FUTURE' && (i.dueDate <= now || i.dueDate.toISOString().slice(0, 10) <= todayYMD))
      .map((i: any) => i.id);

    if (dueIds.length > 0) {
      await this.prisma.loanInstallment.updateMany({
        where: { id: { in: dueIds } },
        data: { status: 'PAST_UNCONFIRMED' },
      });
      for (const inst of installments) {
        if (dueIds.includes(inst.id)) {
          inst.status = 'PAST_UNCONFIRMED';
        }
      }
    }

    return installments.map((i: any) => ({ id: i.id, dueDate: i.dueDate, principalAmount: Number(i.principalAmount), interestAmount: Number(i.interestAmount), emiAmount: Number(i.emiAmount), balance: Number(i.balance), status: i.status, confirmedAt: i.confirmedAt }));
  }

  @Post(':loanId/installments/:instId/confirm')
  async confirmInstallment(@CurrentUser() user: { id: string }, @Param('loanId') loanId: string, @Param('instId') instId: string) {
    const loan = await this.prisma.loan.findFirst({ where: { id: loanId }, include: { account: true } });
    if (!loan || loan.account.userId !== user.id) throw new NotFoundException('Loan not found');

    const inst = await this.prisma.loanInstallment.findFirst({ where: { id: instId, loanId } });
    if (!inst) throw new NotFoundException('Installment not found');
    if (inst.status === 'PAID') return { ok: true };

    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const instYMD = inst.dueDate.toISOString().slice(0, 10);
    const isDueOrPast = inst.status === 'PAST_UNCONFIRMED' || inst.dueDate <= now || instYMD <= todayYMD;
    if (!isDueOrPast) {
      throw new BadRequestException('Future installments cannot be confirmed until their due date.');
    }

    // create transaction and mark installment PAID
    const txResult = await this.prisma.$transaction(async (tx) => {
      const confirmedAt = new Date();
      const txn = await tx.transaction.create({ data: {
        accountId: loan.accountId,
        transactionDate: confirmedAt,
        descriptionRaw: `Loan EMI payment (${loan.id})`,
        amount: BigInt(-Number(inst.emiAmount)),
        fingerprint: `${loan.id}:${inst.id}`,
      } });

      const updatedInst = await tx.loanInstallment.update({ where: { id: inst.id }, data: { status: 'PAID', confirmedAt } });
      return { txnId: txn.id, installmentId: updatedInst.id };
    });

    return txResult;
  }
}
