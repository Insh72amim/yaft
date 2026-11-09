import {
  ExpenseAnalyticsBucket,
  ExpenseAnalyticsLegendItem,
  ExpenseAnalyticsResponse,
  ExpenseCategoryContribution,
} from '@yaft/shared';
import { ClassifiableTransaction, classifyTransaction } from './transaction-classifier';

export type ExpenseGranularity = 'month' | 'week' | 'day';

export interface ExpenseAnalyticsTransactionInput extends ClassifiableTransaction {
  transactionDate: Date | string;
}

/**
 * Resolves the UTC start and end boundaries for an expense analytics query.
 */
export function resolveExpenseAnalyticsDateRange(
  granularity: ExpenseGranularity,
  startDateStr?: string,
  endDateStr?: string,
  now: Date = new Date(),
): { startDate: Date; endDate: Date } {
  if (startDateStr && endDateStr) {
    const parsedStart = new Date(startDateStr);
    const parsedEnd = new Date(endDateStr);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return {
        startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)),
        endDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
      };
    }
    return {
      startDate: new Date(
        Date.UTC(
          parsedStart.getUTCFullYear(),
          parsedStart.getUTCMonth(),
          parsedStart.getUTCDate(),
          0,
          0,
          0,
          0,
        ),
      ),
      endDate: new Date(
        Date.UTC(
          parsedEnd.getUTCFullYear(),
          parsedEnd.getUTCMonth(),
          parsedEnd.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      ),
    };
  }

  if (granularity === 'day') {
    return {
      startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      endDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
    };
  }

  if (granularity === 'week') {
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    return {
      startDate: new Date(
        Date.UTC(
          eightWeeksAgo.getUTCFullYear(),
          eightWeeksAgo.getUTCMonth(),
          eightWeeksAgo.getUTCDate(),
          0,
          0,
          0,
          0,
        ),
      ),
      endDate: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
      ),
    };
  }

  return {
    startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)),
    endDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
  };
}

/**
 * Pure domain calculator for stacked expense analytics across month, week, and day granularities.
 */
export function buildExpenseAnalyticsResponse(
  transactions: readonly ExpenseAnalyticsTransactionInput[],
  granularity: ExpenseGranularity,
  startDate: Date,
  endDate: Date,
  categoryTypes?: string[],
): ExpenseAnalyticsResponse {
  const typeSummaries = {
    EXPENSE: { type: 'EXPENSE', label: 'Direct Expenses', count: 0, totalAmount: 0 },
    OTHER: { type: 'OTHER', label: 'Indirect / Others', count: 0, totalAmount: 0 },
    INVESTMENT: { type: 'INVESTMENT', label: 'Investments', count: 0, totalAmount: 0 },
    TRANSFER: { type: 'TRANSFER', label: 'Transfers & CC', count: 0, totalAmount: 0 },
  };

  for (const tx of transactions) {
    const txKind = classifyTransaction(tx, [], [], []);
    const bucketType =
      txKind === 'CC_PAYMENT' || txKind === 'UPI_LITE' ? 'TRANSFER' : txKind;
    const absAmount = Math.abs(Number(tx.amount));
    typeSummaries[bucketType].count += 1;
    typeSummaries[bucketType].totalAmount += absAmount;
  }

  const availableCategoryTypes = Object.values(typeSummaries);

  let activeTypes: Set<string>;
  if (!categoryTypes || categoryTypes.length === 0) {
    activeTypes = new Set(['EXPENSE']);
  } else if (categoryTypes.includes('ALL')) {
    activeTypes = new Set(['EXPENSE', 'OTHER', 'INVESTMENT', 'TRANSFER']);
  } else {
    activeTypes = new Set(categoryTypes);
  }

  const expenseTxns = transactions.filter((tx) => {
    const txKind = classifyTransaction(tx, [], [], []);
    const bucketType =
      txKind === 'CC_PAYMENT' || txKind === 'UPI_LITE' ? 'TRANSFER' : txKind;
    return activeTypes.has(bucketType);
  });

  const bucketMap = new Map<string, ExpenseAnalyticsBucket>();

  if (granularity === 'month') {
    const cur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const endMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

    while (cur <= endMonth) {
      const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = cur.toLocaleString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
      const subLabel = `${cur.getUTCFullYear()}`;
      const monthStart = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
      const monthEnd = new Date(
        Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0, 23, 59, 59, 999),
      );

      bucketMap.set(key, {
        intervalKey: key,
        label,
        subLabel,
        startDate: monthStart.toISOString().slice(0, 10),
        endDate: monthEnd.toISOString().slice(0, 10),
        totalAmount: 0,
        categories: [],
      });

      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
  } else if (granularity === 'week') {
    let curStart = new Date(startDate.getTime());
    let weekIndex = 1;

    while (curStart <= endDate) {
      const curEnd = new Date(
        Math.min(
          endDate.getTime(),
          curStart.getTime() + 6 * 24 * 60 * 60 * 1000 + (23 * 3600 + 59 * 60 + 59) * 1000 + 999,
        ),
      );
      const startStr = curStart.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      const endStr = curEnd.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      const key = `W${weekIndex}_${curStart.toISOString().slice(0, 10)}`;
      const label = `W${weekIndex} (${startStr} – ${endStr})`;
      const subLabel = `${startStr} – ${endStr}`;

      bucketMap.set(key, {
        intervalKey: key,
        label,
        subLabel,
        startDate: curStart.toISOString().slice(0, 10),
        endDate: curEnd.toISOString().slice(0, 10),
        totalAmount: 0,
        categories: [],
      });

      weekIndex += 1;
      curStart = new Date(curStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  } else {
    const cur = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()),
    );
    const endDay = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()),
    );

    while (cur <= endDay) {
      const key = cur.toISOString().slice(0, 10);
      const dayNum = cur.getUTCDate();
      const monthShort = cur.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const label = `${dayNum} ${monthShort}`;
      const subLabel = cur.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });

      bucketMap.set(key, {
        intervalKey: key,
        label,
        subLabel,
        startDate: key,
        endDate: key,
        totalAmount: 0,
        categories: [],
      });

      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  const globalCategoryMap = new Map<
    string,
    {
      id: string;
      name: string;
      color: string;
      superCategoryName?: string | null;
      totalAmount: number;
      count: number;
    }
  >();
  const bucketCategoryMaps = new Map<string, Map<string, ExpenseCategoryContribution>>();
  for (const key of bucketMap.keys()) {
    bucketCategoryMaps.set(key, new Map());
  }

  let totalTransactionsCount = 0;

  for (const tx of expenseTxns) {
    const txDate = new Date(tx.transactionDate);
    let targetBucketKey: string | undefined;

    if (granularity === 'month') {
      targetBucketKey = `${txDate.getUTCFullYear()}-${String(txDate.getUTCMonth() + 1).padStart(2, '0')}`;
    } else if (granularity === 'week') {
      const txTime = txDate.getTime();
      for (const bucket of bucketMap.values()) {
        const bStart = new Date(bucket.startDate).getTime();
        const bEnd = new Date(bucket.endDate).setUTCHours(23, 59, 59, 999);
        if (txTime >= bStart && txTime <= bEnd) {
          targetBucketKey = bucket.intervalKey;
          break;
        }
      }
    } else {
      targetBucketKey = txDate.toISOString().slice(0, 10);
    }

    if (!targetBucketKey || !bucketMap.has(targetBucketKey)) continue;

    const amount = Math.abs(Number(tx.amount));
    const bucket = bucketMap.get(targetBucketKey)!;
    bucket.totalAmount += amount;
    totalTransactionsCount += 1;

    const catId = tx.categoryId || 'uncategorised';
    const catName = tx.category?.name || 'Uncategorised';
    const catColor = tx.category?.color || '#94a3b8';
    const superCatName = tx.category?.superCategory?.name || null;
    const superCatColor = tx.category?.superCategory?.color || null;

    const bCatMap = bucketCategoryMaps.get(targetBucketKey)!;
    const existing = bCatMap.get(catId);
    if (existing) {
      existing.amount += amount;
      existing.count += 1;
    } else {
      bCatMap.set(catId, {
        id: catId,
        name: catName,
        color: catColor,
        superCategoryId: tx.category?.superCategoryId || null,
        superCategoryName: superCatName,
        superCategoryColor: superCatColor,
        amount,
        percentage: 0,
        count: 1,
      });
    }

    const globalCat = globalCategoryMap.get(catId);
    if (globalCat) {
      globalCat.totalAmount += amount;
      globalCat.count += 1;
    } else {
      globalCategoryMap.set(catId, {
        id: catId,
        name: catName,
        color: catColor,
        superCategoryName: superCatName,
        totalAmount: amount,
        count: 1,
      });
    }
  }

  const buckets: ExpenseAnalyticsBucket[] = [];
  let peakBucket: { key: string; label: string; amount: number } | null = null;
  let totalExpense = 0;

  for (const bucket of bucketMap.values()) {
    const bCatMap = bucketCategoryMaps.get(bucket.intervalKey)!;
    const catList = Array.from(bCatMap.values()).sort((a, b) => b.amount - a.amount);
    if (bucket.totalAmount > 0) {
      catList.forEach((c) => {
        c.percentage = Math.round((c.amount / bucket.totalAmount) * 100);
      });
    }
    bucket.categories = catList;
    buckets.push(bucket);
    totalExpense += bucket.totalAmount;

    if (!peakBucket || bucket.totalAmount > peakBucket.amount) {
      peakBucket = {
        key: bucket.intervalKey,
        label: bucket.label,
        amount: bucket.totalAmount,
      };
    }
  }

  const intervalCount = buckets.length;
  const averagePerInterval = intervalCount > 0 ? Math.round(totalExpense / intervalCount) : 0;

  const categoryLegend: ExpenseAnalyticsLegendItem[] = Array.from(globalCategoryMap.values())
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      superCategoryName: c.superCategoryName,
      totalAmount: c.totalAmount,
      percentage: totalExpense > 0 ? Math.round((c.totalAmount / totalExpense) * 100) : 0,
      count: c.count,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const topCategory =
    categoryLegend.length > 0
      ? {
          name: categoryLegend[0].name,
          color: categoryLegend[0].color,
          amount: categoryLegend[0].totalAmount,
          percentage: categoryLegend[0].percentage,
        }
      : null;

  return {
    granularity,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    buckets,
    summary: {
      totalExpense,
      averagePerInterval,
      peakInterval: peakBucket && peakBucket.amount > 0 ? peakBucket : null,
      topCategory,
      totalTransactionsCount,
      intervalCount,
    },
    categoryLegend,
    availableCategoryTypes,
  };
}
