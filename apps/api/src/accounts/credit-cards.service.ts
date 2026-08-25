import { Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { extractBeneficiaryName, isRefundOrReversal, computeCreditCardCurrentBalance } from '../common/utils/transaction-utils';

@Injectable()
export class CreditCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCreditCardsSummary(
    userId: string,
    timeRange?: string,
    accountId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const cardAccounts = await this.prisma.account.findMany({
      where: { userId, type: AccountType.CREDIT_CARD, archived: false },
      include: {
        vaultEntry: true,
        parentAccount: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
        childAccounts: { select: { id: true, name: true, creditLimit: true, statementDay: true, dueDay: true } },
      },
    });

    const cardIds = cardAccounts.map((c) => c.id);

    const allCardTransactions = cardIds.length > 0
      ? await this.prisma.transaction.findMany({
          where: {
            accountId: { in: cardIds },
          },
          include: {
            category: { select: { id: true, name: true, color: true } },
            account: { select: { name: true } },
          },
          orderBy: { transactionDate: 'desc' },
        })
      : [];

    const now = new Date();
    let filterStart: Date | undefined;
    let filterEnd: Date | undefined;
    let timeRangeLabel = 'All-Time';

    if (startDate && endDate) {
      filterStart = new Date(`${startDate}T00:00:00.000Z`);
      filterEnd = new Date(`${endDate}T23:59:59.999Z`);
      timeRangeLabel = `${startDate} to ${endDate}`;
    } else if (timeRange === 'THIS_MONTH') {
      filterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      filterEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      timeRangeLabel = now.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    } else if (timeRange === 'LAST_MONTH') {
      filterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      filterEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      const lm = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      timeRangeLabel = lm.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    } else if (timeRange === '3M') {
      filterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
      timeRangeLabel = 'Past 3 Months';
    } else if (timeRange === '6M') {
      filterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
      timeRangeLabel = 'Past 6 Months';
    } else if (timeRange === '1Y') {
      filterStart = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
      timeRangeLabel = 'Past Year';
    }

    const cleanMerchant = (merchant?: string | null, descriptionRaw?: string | null): string => {
      if (merchant && merchant.trim().length > 0) {
        return merchant.replace(/\[.*?\]/g, '').replace(/\b(?:POS|TXN|REF|UPI)\b/gi, '').trim() || merchant.trim();
      }
      if (!descriptionRaw) return 'Unknown Merchant';
      const beneficiary = extractBeneficiaryName(descriptionRaw);
      if (beneficiary) return beneficiary;
      return descriptionRaw
        .replace(/\[.*?\]/g, '')
        .replace(/\bPOS\s+[\dX*]+\b/gi, '')
        .replace(/\b(?:POS|TXN|REF|UPI|IMPS|NEFT)\b/gi, '')
        .replace(/[\d@/_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || descriptionRaw.slice(0, 40);
    };

    const months: { label: string; year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push({
        label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + ' ' + String(d.getUTCFullYear()).slice(2),
        year: d.getUTCFullYear(),
        month: d.getUTCMonth(),
      });
    }

    const monthlySpendsAndPayments = months.map((m) => {
      const txsInMonth = allCardTransactions.filter((t) => {
        if (accountId && accountId !== 'ALL' && t.accountId !== accountId) return false;
        const d = new Date(t.transactionDate);
        return d.getUTCFullYear() === m.year && d.getUTCMonth() === m.month;
      });

      const spends = Math.abs(
        txsInMonth.filter((t) => t.amount < 0).reduce((sum, t) => sum + Number(t.amount), 0),
      );
      const payments = txsInMonth.filter((t) => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0);

      return {
        month: m.label,
        spends,
        payments,
      };
    });

    const filteredAnalyticsTransactions = allCardTransactions.filter((t) => {
      if (accountId && accountId !== 'ALL' && t.accountId !== accountId) return false;
      const tDate = new Date(t.transactionDate);
      if (filterStart && tDate < filterStart) return false;
      if (filterEnd && tDate > filterEnd) return false;
      return true;
    });

    const categoryMapOverall = new Map<string, { name: string; color: string; amount: number }>();
    const recipientMapOverall = new Map<string, { name: string; amount: number; count: number }>();

    let totalInbound = 0;
    let totalOutbound = 0;

    filteredAnalyticsTransactions.forEach((t) => {
      const amt = Number(t.amount);
      if (amt < 0) {
        const absAmt = Math.abs(amt);
        totalOutbound += absAmt;

        const catName = t.category?.name ?? 'Uncategorised';
        const catColor = t.category?.color ?? '#94a3b8';
        const currCat = categoryMapOverall.get(catName) || { name: catName, color: catColor, amount: 0 };
        categoryMapOverall.set(catName, { name: catName, color: catColor, amount: currCat.amount + absAmt });

        const recipientName = cleanMerchant(t.merchant, t.descriptionRaw);
        const currRec = recipientMapOverall.get(recipientName) || { name: recipientName, amount: 0, count: 0 };
        recipientMapOverall.set(recipientName, { name: recipientName, amount: currRec.amount + absAmt, count: currRec.count + 1 });
      } else {
        totalInbound += amt;
        if (isRefundOrReversal(t.descriptionRaw) && t.category?.name) {
          const catName = t.category.name;
          const currCat = categoryMapOverall.get(catName);
          if (currCat) {
            currCat.amount = Math.max(0, currCat.amount - amt);
          }
        }
      }
    });

    const overallCategories = [...categoryMapOverall.values()]
      .map((c) => ({
        ...c,
        percentage: totalOutbound > 0 ? Math.round((c.amount / totalOutbound) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const overallTopRecipients = [...recipientMapOverall.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const overallTopRecSum = overallTopRecipients.reduce((s, r) => s + r.amount, 0);
    const overallTopRecCount = overallTopRecipients.reduce((s, r) => s + r.count, 0);
    const overallOtherOutbound = {
      amount: Math.max(0, totalOutbound - overallTopRecSum),
      count: Math.max(0, filteredAnalyticsTransactions.filter((t) => t.amount < 0).length - overallTopRecCount),
    };

    // Pre-calculate balances for each individual card
    const cardBalances = new Map<string, { currentBalance: number; outstanding: number }>();
    cardAccounts.forEach((card) => {
      const cardTxns = allCardTransactions.filter((t) => t.accountId === card.id);
      cardBalances.set(card.id, computeCreditCardCurrentBalance(card, cardTxns));
    });

    // Group cards into shared pools by root parent ID
    const poolMap = new Map<string, { rootCard: any; members: any[]; poolLimit: number; poolOutstanding: number }>();
    cardAccounts.forEach((card) => {
      const rootId = card.parentAccountId || card.id;
      const rootCard = cardAccounts.find((c) => c.id === rootId) || card;
      const poolLimit = rootCard.creditLimit ? Number(rootCard.creditLimit) : (card.creditLimit ? Number(card.creditLimit) : 0);

      const existing = poolMap.get(rootId) || { rootCard, members: [], poolLimit, poolOutstanding: 0 };
      existing.members.push(card);
      existing.poolOutstanding += (cardBalances.get(card.id)?.outstanding ?? 0);
      if (poolLimit > existing.poolLimit) existing.poolLimit = poolLimit;
      poolMap.set(rootId, existing);
    });

    let totalLimit = 0;
    let totalOutstanding = 0;
    let totalAvailable = 0;

    // Total limit counts each unique pool once (avoids double counting child cards)
    poolMap.forEach((pool) => {
      totalLimit += pool.poolLimit;
      const poolAvailable = Math.max(0, pool.poolLimit - pool.poolOutstanding);
      totalAvailable += poolAvailable;
    });

    const cards = cardAccounts.map((card) => {
      const cardTxns = allCardTransactions.filter((t) => t.accountId === card.id);
      const rootId = card.parentAccountId || card.id;
      const pool = poolMap.get(rootId)!;

      const isChild = Boolean(card.parentAccountId);
      const isParent = Boolean(card.childAccounts && card.childAccounts.length > 0);
      const isShared = isChild || isParent;

      const { currentBalance, outstanding } = cardBalances.get(card.id)!;
      totalOutstanding += outstanding;

      const cardCreditLimit = isShared ? pool.poolLimit : (card.creditLimit ? Number(card.creditLimit) : 0);
      const availableCredit = isShared ? Math.max(0, pool.poolLimit - pool.poolOutstanding) : Math.max(0, cardCreditLimit - outstanding);
      const utilizationPercent = cardCreditLimit > 0
        ? Math.min(100, Math.round(((isShared ? pool.poolOutstanding : outstanding) / cardCreditLimit) * 100))
        : 0;

      let cardInbound = 0;
      let cardOutbound = 0;

      const cardCatMap = new Map<string, { name: string; color: string; amount: number }>();
      const cardRecMap = new Map<string, { name: string; amount: number; count: number }>();

      const cardAnalyticsTxns = cardTxns.filter((t) => {
        const tDate = new Date(t.transactionDate);
        if (filterStart && tDate < filterStart) return false;
        if (filterEnd && tDate > filterEnd) return false;
        return true;
      });

      cardAnalyticsTxns.forEach((t) => {
        const amt = Number(t.amount);
        if (amt < 0) {
          const absAmt = Math.abs(amt);
          cardOutbound += absAmt;

          const catName = t.category?.name ?? 'Uncategorised';
          const catColor = t.category?.color ?? '#94a3b8';
          const currCat = cardCatMap.get(catName) || { name: catName, color: catColor, amount: 0 };
          cardCatMap.set(catName, { name: catName, color: catColor, amount: currCat.amount + absAmt });

          const recipientName = cleanMerchant(t.merchant, t.descriptionRaw);
          const currRec = cardRecMap.get(recipientName) || { name: recipientName, amount: 0, count: 0 };
          cardRecMap.set(recipientName, { name: recipientName, amount: currRec.amount + absAmt, count: currRec.count + 1 });
        } else {
          cardInbound += amt;
          if (isRefundOrReversal(t.descriptionRaw) && t.category?.name) {
            const catName = t.category.name;
            const currCat = cardCatMap.get(catName);
            if (currCat) {
              currCat.amount = Math.max(0, currCat.amount - amt);
            }
          }
        }
      });

      const categories = [...cardCatMap.values()]
        .map((c) => ({
          ...c,
          percentage: cardOutbound > 0 ? Math.round((c.amount / cardOutbound) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const topRecipients = [...cardRecMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
      const topRecSum = topRecipients.reduce((s, r) => s + r.amount, 0);
      const topRecCount = topRecipients.reduce((s, r) => s + r.count, 0);
      const otherOutbound = {
        amount: Math.max(0, cardOutbound - topRecSum),
        count: Math.max(0, cardAnalyticsTxns.filter((t) => t.amount < 0).length - topRecCount),
      };

      const statementDate = card.statementDay ?? card.parentAccount?.statementDay ?? null;
      const dueDate = card.dueDay ?? card.parentAccount?.dueDay ?? null;
      const linkedCardNames = pool.members.filter((m) => m.id !== card.id).map((m) => m.name);

      return {
        id: card.id,
        name: card.name,
        institution: card.institution,
        cardLast4: card.vaultEntry?.last4 ?? null,
        cardNetwork: card.vaultEntry?.cardNetwork ?? null,
        creditLimit: cardCreditLimit,
        currentBalance,
        outstanding,
        availableCredit,
        utilizationPercent,
        statementDate,
        dueDate,
        isShared,
        isParent,
        isChild,
        parentAccountId: card.parentAccountId ?? null,
        parentAccountName: card.parentAccount?.name ?? null,
        linkedCardNames,
        poolCreditLimit: pool.poolLimit,
        poolOutstanding: pool.poolOutstanding,
        poolAvailableCredit: Math.max(0, pool.poolLimit - pool.poolOutstanding),
        poolUtilization: pool.poolLimit > 0 ? Math.min(100, Math.round((pool.poolOutstanding / pool.poolLimit) * 100)) : 0,
        totalInbound: cardInbound,
        totalOutbound: cardOutbound,
        categories,
        topRecipients,
        otherOutbound,
      };
    });

    const utilizationRate = totalLimit > 0 ? Math.min(100, Math.round((totalOutstanding / totalLimit) * 100)) : 0;

    const recentTransactions = allCardTransactions.slice(0, 10).map((t) => ({
      id: t.id,
      date: t.transactionDate.toISOString(),
      description: cleanMerchant(t.merchant, t.descriptionRaw),
      amount: Number(t.amount),
      category: t.category?.name ?? 'Uncategorised',
      categoryColor: t.category?.color ?? '#94a3b8',
      accountName: t.account.name,
    }));

    return {
      summary: {
        totalLimit,
        totalOutstanding,
        totalAvailable,
        utilizationRate,
        activeCardCount: cards.length,
        totalInbound,
        totalOutbound,
        timeRange: timeRange || 'ALL_TIME',
        timeRangeLabel,
      },
      overallFlow: {
        categories: overallCategories,
        topRecipients: overallTopRecipients,
        otherOutbound: overallOtherOutbound,
      },
      cards,
      monthlySpendsAndPayments,
      recentTransactions,
    };
  }
}
