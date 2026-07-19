import {
  Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Put, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialCipher } from '../common/statement-credentials.service';
import { UpsertVaultEntryDto } from './vault.dto';

const KEY_VERSION = 1;

function detectNetwork(cardNumber: string): string {
  if (/^4/.test(cardNumber)) return 'Visa';
  if (/^5[1-5]/.test(cardNumber) || /^2(2[2-9][1-9]|[3-6]\d{2}|7[01]\d|720)/.test(cardNumber)) return 'Mastercard';
  if (/^3[47]/.test(cardNumber)) return 'Amex';
  if (/^6(0|5|22[1-9]|2[3-9])/.test(cardNumber)) return 'RuPay';
  return 'Unknown';
}

@Controller('vault')
@UseGuards(JwtAuthGuard)
export class VaultController {
  private readonly cipher = new StatementCredentialCipher();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    const accounts = await this.prisma.account.findMany({
      where: { userId: user.id, archived: false },
      orderBy: { createdAt: 'asc' },
      include: {
        vaultEntry: {
          select: {
            last4: true, ifsc: true, upiId: true,
            cardExpiryMm: true, cardExpiryYy: true, cardNetwork: true,
            // boolean presence flags — never return cipher bytes in list
            accountNumberCipher: true,
            cardNumberCipher: true,
            cvvCipher: true,
            updatedAt: true,
          },
        },
      },
    });

    return accounts.map(({ vaultEntry, ...account }) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      institution: account.institution,
      currency: account.currency,
      vault: vaultEntry
        ? {
            last4: vaultEntry.last4,
            ifsc: vaultEntry.ifsc,
            upiId: vaultEntry.upiId,
            cardExpiryMm: vaultEntry.cardExpiryMm,
            cardExpiryYy: vaultEntry.cardExpiryYy,
            cardNetwork: vaultEntry.cardNetwork,
            hasAccountNumber: vaultEntry.accountNumberCipher !== null,
            hasCardNumber: vaultEntry.cardNumberCipher !== null,
            hasCvv: vaultEntry.cvvCipher !== null,
            updatedAt: vaultEntry.updatedAt,
          }
        : null,
    }));
  }

  @Put(':accountId')
  async upsert(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Body() dto: UpsertVaultEntryDto,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
      select: { id: true, type: true },
    });
    if (!account) throw new NotFoundException('Account not found.');

    const data: Record<string, unknown> = {
      keyVersion: KEY_VERSION,
      ifsc: dto.ifsc?.toUpperCase() ?? undefined,
      upiId: dto.upiId ?? undefined,
      cardExpiryMm: dto.cardExpiryMm ?? undefined,
      cardExpiryYy: dto.cardExpiryYy ?? undefined,
    };

    if (dto.accountNumber !== undefined) {
      const enc = this.cipher.encrypt(accountId, dto.accountNumber);
      data.accountNumberCipher = enc.ciphertext;
      data.accountNumberIv = enc.iv;
      data.accountNumberTag = enc.authTag;
      data.last4 = dto.accountNumber.slice(-4);
    }

    if (dto.cardNumber !== undefined) {
      const enc = this.cipher.encrypt(accountId, dto.cardNumber);
      data.cardNumberCipher = enc.ciphertext;
      data.cardNumberIv = enc.iv;
      data.cardNumberTag = enc.authTag;
      data.last4 = dto.cardNumber.slice(-4);
      data.cardNetwork = detectNetwork(dto.cardNumber);
    }

    if (dto.cvv !== undefined) {
      const enc = this.cipher.encrypt(accountId, dto.cvv);
      data.cvvCipher = enc.ciphertext;
      data.cvvIv = enc.iv;
      data.cvvTag = enc.authTag;
    }

    await this.prisma.accountVaultEntry.upsert({
      where: { accountId },
      create: { accountId, ...data } as never,
      update: data as never,
    });

    return { ok: true };
  }

  @Get(':accountId/reveal')
  async reveal(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Account not found.');

    const entry = await this.prisma.accountVaultEntry.findUnique({ where: { accountId } });
    if (!entry) throw new NotFoundException('No vault entry for this account.');

    const result: Record<string, string | null> = {};

    if (entry.accountNumberCipher) {
      result.accountNumber = this.cipher.decrypt(accountId, {
        ciphertext: Buffer.from(entry.accountNumberCipher),
        iv: Buffer.from(entry.accountNumberIv!),
        authTag: Buffer.from(entry.accountNumberTag!),
        keyVersion: entry.keyVersion,
      });
    }

    if (entry.cardNumberCipher) {
      result.cardNumber = this.cipher.decrypt(accountId, {
        ciphertext: Buffer.from(entry.cardNumberCipher),
        iv: Buffer.from(entry.cardNumberIv!),
        authTag: Buffer.from(entry.cardNumberTag!),
        keyVersion: entry.keyVersion,
      });
    }

    if (entry.cvvCipher) {
      result.cvv = this.cipher.decrypt(accountId, {
        ciphertext: Buffer.from(entry.cvvCipher),
        iv: Buffer.from(entry.cvvIv!),
        authTag: Buffer.from(entry.cvvTag!),
        keyVersion: entry.keyVersion,
      });
    }

    return result;
  }

  @Delete(':accountId') @HttpCode(204)
  async remove(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Account not found.');
    await this.prisma.accountVaultEntry.deleteMany({ where: { accountId } });
  }
}
