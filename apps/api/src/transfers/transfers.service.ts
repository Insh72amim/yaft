import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcileTransfers(userId: string): Promise<{ matchedPairsCount: number }> {
    const unlinked = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        transferGroupId: null,
      },
      include: {
        account: { select: { id: true, name: true, institution: true, type: true } },
      },
      orderBy: { transactionDate: 'desc' },
    });

    const activeVaults = await this.prisma.accountVaultEntry.findMany({
      where: { account: { userId } },
      select: { accountId: true, last4: true },
    });

    const debits = unlinked.filter((t) => t.amount < 0n);
    const credits = unlinked.filter((t) => t.amount > 0n);
    const usedCreditIds = new Set<string>();
    let matchedPairsCount = 0;

    for (const debit of debits) {
      const positiveAmount = -debit.amount;

      // 1. Vault last4 match
      let targetAccountId: string | undefined;
      for (const vault of activeVaults) {
        if (vault.last4 && debit.descriptionRaw.includes(vault.last4) && vault.accountId !== debit.accountId) {
          targetAccountId = vault.accountId;
          break;
        }
      }

      // Find candidate credit within ±3 days
      const minDate = new Date(debit.transactionDate.getTime() - 3 * 86_400_000);
      const maxDate = new Date(debit.transactionDate.getTime() + 3 * 86_400_000);

      const candidates = credits.filter((credit) => {
        if (usedCreditIds.has(credit.id)) return false;
        if (credit.accountId === debit.accountId) return false;
        if (credit.amount !== positiveAmount) return false;
        if (credit.transactionDate < minDate || credit.transactionDate > maxDate) return false;
        if (targetAccountId && credit.accountId !== targetAccountId) return false;
        return true;
      });

      if (candidates.length > 0) {
        const match = candidates[0];
        const transferGroupId = randomUUID();

        await this.prisma.$transaction([
          this.prisma.transaction.update({
            where: { id: debit.id },
            data: { transferGroupId },
          }),
          this.prisma.transaction.update({
            where: { id: match.id },
            data: { transferGroupId },
          }),
        ]);

        usedCreditIds.add(match.id);
        matchedPairsCount++;
      }
    }

    return { matchedPairsCount };
  }

  async manualLink(userId: string, txId1: string, txId2: string) {
    const tx1 = await this.prisma.transaction.findFirst({
      where: { id: txId1, account: { userId } },
    });
    const tx2 = await this.prisma.transaction.findFirst({
      where: { id: txId2, account: { userId } },
    });

    if (!tx1 || !tx2) {
      throw new NotFoundException('One or both transactions were not found.');
    }
    if (tx1.accountId === tx2.accountId) {
      throw new BadRequestException('Cannot link transactions within the same account as an internal transfer.');
    }
    if (tx1.amount + tx2.amount !== 0n) {
      throw new BadRequestException('Transfer legs must have opposite and equal amounts.');
    }

    const transferGroupId = randomUUID();
    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: tx1.id },
        data: { transferGroupId },
      }),
      this.prisma.transaction.update({
        where: { id: tx2.id },
        data: { transferGroupId },
      }),
    ]);

    return { transferGroupId };
  }

  async unlinkGroup(userId: string, transferGroupId: string) {
    const txs = await this.prisma.transaction.findMany({
      where: { transferGroupId, account: { userId } },
    });
    if (txs.length === 0) {
      throw new NotFoundException('Transfer group not found.');
    }

    await this.prisma.transaction.updateMany({
      where: { transferGroupId, account: { userId } },
      data: { transferGroupId: null },
    });
  }

  async findPotentialMatches(userId: string) {
    const unlinked = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        transferGroupId: null,
      },
      include: {
        account: { select: { id: true, name: true, institution: true, type: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 100,
    });

    const debits = unlinked.filter((t) => t.amount < 0n);
    const credits = unlinked.filter((t) => t.amount > 0n);
    const suggestions: Array<{ debit: any; credit: any }> = [];

    for (const debit of debits) {
      const positiveAmount = -debit.amount;
      const minDate = new Date(debit.transactionDate.getTime() - 4 * 86_400_000);
      const maxDate = new Date(debit.transactionDate.getTime() + 4 * 86_400_000);

      const candidate = credits.find(
        (c) => c.accountId !== debit.accountId && c.amount === positiveAmount && c.transactionDate >= minDate && c.transactionDate <= maxDate,
      );

      if (candidate) {
        suggestions.push({
          debit: {
            id: debit.id,
            account: debit.account.name,
            amount: Number(debit.amount),
            date: debit.transactionDate,
            description: debit.merchant || debit.descriptionRaw,
          },
          credit: {
            id: candidate.id,
            account: candidate.account.name,
            amount: Number(candidate.amount),
            date: candidate.transactionDate,
            description: candidate.merchant || candidate.descriptionRaw,
          },
        });
      }
    }

    return suggestions;
  }
}
