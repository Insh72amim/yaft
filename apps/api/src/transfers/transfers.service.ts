import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';

function getCalendarDayDifference(d1: Date, d2: Date): number {
  const utc1 = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate());
  const utc2 = Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate());
  return Math.abs(Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24)));
}

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

      // Tiered Multi-Day Candidate Scoring
      const scoredCandidates = credits
        .filter((credit) => {
          if (usedCreditIds.has(credit.id)) return false;
          if (credit.accountId === debit.accountId) return false;
          if (credit.amount !== positiveAmount) return false;

          const dayDiff = getCalendarDayDifference(debit.transactionDate, credit.transactionDate);
          const isCrossAccountType =
            (debit.account.type === 'CREDIT_CARD' && credit.account.type !== 'CREDIT_CARD') ||
            (credit.account.type === 'CREDIT_CARD' && debit.account.type !== 'CREDIT_CARD') ||
            (debit.account.type === 'MUTUAL_FUND' || credit.account.type === 'MUTUAL_FUND' || debit.account.type === 'STOCKS' || credit.account.type === 'STOCKS');

          const maxAllowedDays = targetAccountId ? 2 : isCrossAccountType ? 2 : 1;
          if (dayDiff > maxAllowedDays) return false;
          if (targetAccountId && credit.accountId !== targetAccountId) return false;
          return true;
        })
        .map((credit) => {
          const dayDiff = getCalendarDayDifference(debit.transactionDate, credit.transactionDate);
          let score = 100 - dayDiff * 20;
          if (targetAccountId && credit.accountId === targetAccountId) score += 50;
          return { credit, score };
        })
        .sort((a, b) => b.score - a.score);

      if (scoredCandidates.length > 0) {
        const match = scoredCandidates[0].credit;
        const transferGroupId = randomUUID();

        const isCcTransfer =
          debit.account.type === 'CREDIT_CARD' ||
          match.account.type === 'CREDIT_CARD' ||
          /cred|credit\s*card|cc\s*payment|card\s*pmt/i.test(debit.descriptionRaw) ||
          /cred|credit\s*card|cc\s*payment|card\s*pmt/i.test(match.descriptionRaw);

        const isUpiLite =
          /upi\s*lite/i.test(debit.descriptionRaw) || /upi\s*lite/i.test(match.descriptionRaw);

        const autoCatId = await this.findTransferCategory(userId, isCcTransfer, isUpiLite);

        await this.prisma.$transaction([
          this.prisma.transaction.update({
            where: { id: debit.id },
            data: {
              transferGroupId,
              ...(autoCatId && !debit.categoryId ? { categoryId: autoCatId } : {}),
            },
          }),
          this.prisma.transaction.update({
            where: { id: match.id },
            data: {
              transferGroupId,
              ...(autoCatId && !match.categoryId ? { categoryId: autoCatId } : {}),
            },
          }),
        ]);

        usedCreditIds.add(match.id);
        matchedPairsCount++;
      }
    }

    return { matchedPairsCount };
  }

  async findTransferCategory(userId: string, isCcTransfer: boolean, isUpiLite: boolean): Promise<string | null> {
    if (!this.prisma?.category?.findMany) return null;
    const categories = await this.prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, superCategory: { select: { kind: true } } },
    });

    if (isUpiLite) {
      const upiLiteCat = categories.find((c) => /upi\s*lite/i.test(c.name));
      if (upiLiteCat) return upiLiteCat.id;
    }
    if (isCcTransfer) {
      const ccCat = categories.find((c) => /cc\s*transfer|credit\s*card/i.test(c.name));
      if (ccCat) return ccCat.id;
    }
    const selfCat = categories.find((c) => /self\s*transfer|internal\s*transfer/i.test(c.name));
    if (selfCat) return selfCat.id;

    const transferCat = categories.find((c) => c.superCategory?.kind === 'TRANSFER');
    return transferCat ? transferCat.id : null;
  }

  async manualLink(userId: string, txId1: string, txId2: string) {
    const tx1 = await this.prisma.transaction.findFirst({
      where: { id: txId1, account: { userId } },
      include: { account: { select: { type: true } } },
    });
    const tx2 = await this.prisma.transaction.findFirst({
      where: { id: txId2, account: { userId } },
      include: { account: { select: { type: true } } },
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

    const isCcTransfer =
      tx1.account?.type === 'CREDIT_CARD' ||
      tx2.account?.type === 'CREDIT_CARD' ||
      /cred|credit\s*card|cc\s*payment|card\s*pmt/i.test(tx1.descriptionRaw) ||
      /cred|credit\s*card|cc\s*payment|card\s*pmt/i.test(tx2.descriptionRaw);

    const isUpiLite =
      /upi\s*lite/i.test(tx1.descriptionRaw) || /upi\s*lite/i.test(tx2.descriptionRaw);

    const autoCatId = await this.findTransferCategory(userId, isCcTransfer, isUpiLite);

    const transferGroupId = randomUUID();
    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: tx1.id },
        data: {
          transferGroupId,
          ...(autoCatId && !tx1.categoryId ? { categoryId: autoCatId } : {}),
        },
      }),
      this.prisma.transaction.update({
        where: { id: tx2.id },
        data: {
          transferGroupId,
          ...(autoCatId && !tx2.categoryId ? { categoryId: autoCatId } : {}),
        },
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

      const candidate = credits.find(
        (c) => c.accountId !== debit.accountId && c.amount === positiveAmount && getCalendarDayDifference(debit.transactionDate, c.transactionDate) <= 1,
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
