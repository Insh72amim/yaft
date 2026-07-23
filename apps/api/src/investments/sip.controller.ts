import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../common/prisma.service';

export class CreateSipDto {
  accountId!: string;
  name!: string;
  folioNumber?: string;
  amount!: number;
  frequency?: string;
  sipDay?: number;
  sourceAccountId?: string;
  billerKeyword?: string;
  status?: string;
}

export class UpdateSipDto {
  name?: string;
  folioNumber?: string;
  amount?: number;
  frequency?: string;
  sipDay?: number;
  sourceAccountId?: string;
  billerKeyword?: string;
  status?: string;
}

@Controller('investments/sips')
@UseGuards(JwtAuthGuard)
export class SipController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getSips(
    @CurrentUser() user: { id: string },
    @Query('accountId') accountId?: string,
  ) {
    const where: Record<string, any> = { userId: user.id };
    if (accountId) where.accountId = accountId;

    const sips = await (this.prisma as any).activeSip.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, institution: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sourceAccountIds = sips
      .map((s: { sourceAccountId: string | null }) => s.sourceAccountId)
      .filter((id: string | null): id is string => Boolean(id));

    const sourceAccounts = sourceAccountIds.length
      ? await this.prisma.account.findMany({
          where: { id: { in: sourceAccountIds }, userId: user.id },
          select: {
            id: true,
            name: true,
            institution: true,
            vaultEntry: { select: { last4: true } },
          },
        })
      : [];

    const sourceMap = new Map<string, any>(sourceAccounts.map((a: any) => [a.id, a]));

    return sips.map((sip: any) => {
      const sourceAcc = sip.sourceAccountId ? sourceMap.get(sip.sourceAccountId) : null;
      return {
        id: sip.id,
        accountId: sip.accountId,
        accountName: sip.account.name,
        name: sip.name,
        folioNumber: sip.folioNumber,
        amount: Number(sip.amount),
        frequency: sip.frequency,
        sipDay: sip.sipDay,
        sourceAccountId: sip.sourceAccountId,
        sourceAccountName: sourceAcc ? sourceAcc.name : null,
        sourceAccountLast4: sourceAcc?.vaultEntry?.last4 ?? null,
        billerKeyword: sip.billerKeyword,
        status: sip.status,
        createdAt: sip.createdAt,
      };
    });
  }

  @Post()
  async createSip(@CurrentUser() user: { id: string }, @Body() dto: CreateSipDto) {
    if (!dto.accountId || !dto.name || dto.amount == null || dto.amount <= 0) {
      throw new BadRequestException('Account ID, Mutual Fund name, and positive amount are required.');
    }

    const brokerAcc = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId: user.id },
    });
    if (!brokerAcc) throw new NotFoundException('Broker account not found.');

    if (dto.sourceAccountId) {
      const sourceAcc = await this.prisma.account.findFirst({
        where: { id: dto.sourceAccountId, userId: user.id },
      });
      if (!sourceAcc) throw new NotFoundException('Linked bank account not found.');
    }

    const sip = await (this.prisma as any).activeSip.create({
      data: {
        userId: user.id,
        accountId: dto.accountId,
        name: dto.name.trim(),
        folioNumber: dto.folioNumber?.trim() || null,
        amount: BigInt(Math.round(dto.amount)),
        frequency: dto.frequency || 'MONTHLY',
        sipDay: dto.sipDay ? Math.min(31, Math.max(1, Number(dto.sipDay))) : 10,
        sourceAccountId: dto.sourceAccountId || null,
        billerKeyword: dto.billerKeyword?.trim() || null,
        status: dto.status || 'ACTIVE',
      },
    });

    return {
      ...sip,
      amount: Number(sip.amount),
    };
  }

  @Patch(':id')
  async updateSip(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateSipDto,
  ) {
    const existing = await (this.prisma as any).activeSip.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) throw new NotFoundException('Active SIP not found.');

    if (dto.sourceAccountId) {
      const sourceAcc = await this.prisma.account.findFirst({
        where: { id: dto.sourceAccountId, userId: user.id },
      });
      if (!sourceAcc) throw new NotFoundException('Linked bank account not found.');
    }

    const data: Record<string, any> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.folioNumber !== undefined) data.folioNumber = dto.folioNumber?.trim() || null;
    if (dto.amount !== undefined) data.amount = BigInt(Math.round(dto.amount));
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.sipDay !== undefined) data.sipDay = Math.min(31, Math.max(1, Number(dto.sipDay)));
    if (dto.sourceAccountId !== undefined) data.sourceAccountId = dto.sourceAccountId || null;
    if (dto.billerKeyword !== undefined) data.billerKeyword = dto.billerKeyword?.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await (this.prisma as any).activeSip.update({
      where: { id: existing.id },
      data,
    });

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteSip(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const existing = await (this.prisma as any).activeSip.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) throw new NotFoundException('Active SIP not found.');

    await (this.prisma as any).activeSip.delete({
      where: { id: existing.id },
    });
  }
}
