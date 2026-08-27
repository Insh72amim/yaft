/**
 * Shared domain interfaces and DTO contract types.
 */

import { AccountType, CardNetwork, CategoryType, MatchField, MatchType } from './enums';

export interface CategoryItem {
  id: string;
  name: string;
  type?: CategoryType;
  color: string;
  superCategoryId?: string | null;
  superCategory?: {
    id: string;
    name: string;
    kind: CategoryType;
    color: string;
  } | null;
}

export interface SuperCategoryItem {
  id: string;
  name: string;
  kind: CategoryType;
  color: string;
  icon?: string | null;
  order?: number;
  categories?: { id: string; name: string; color: string; type: string }[];
  _count?: { categories: number };
}

export type CategoryOption = CategoryItem;
export type SuperCategoryOption = SuperCategoryItem;

export interface CategoryBudgetItem {
  id: string;
  budgetId: string | null;
  hasBudget: boolean;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  monthlyLimit: number;
  spentAmount: number;
  percentage: number;
  status: 'OK' | 'WARNING' | 'EXCEEDED' | 'NO_LIMIT';
  transactionCount: number;
}

export interface BudgetSummary {
  totalBudgeted: number;
  totalBudgetedSpent?: number;
  totalSpent: number;
  totalAllExpensesSpent?: number;
  totalRemaining: number;
  overallPercentage: number;
  totalTransactionsCount?: number;
}

export interface CategoryRuleItem {
  id: string;
  pattern: string;
  matchField: MatchField;
  matchType: MatchType;
  priority?: number;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  createdAt?: string;
}

export interface TagItem {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  targetBudgetMinor?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  transactionCount?: number;
  totalSpentMinor?: number;
}

export interface AccountItem {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  currency: string;
  openingBalance: number | string;
  currentBalance?: number;
  creditLimit?: number | null;
  statementDay?: number | null;
  dueDay?: number | null;
  cardNetwork?: CardNetwork | null;
  archived?: boolean;
}

export type ExpenseGranularity = 'month' | 'week' | 'day';

export interface ExpenseCategoryContribution {
  id: string;
  name: string;
  color: string;
  superCategoryId?: string | null;
  superCategoryName?: string | null;
  superCategoryColor?: string | null;
  amount: number;
  percentage: number;
  count: number;
}

export interface ExpenseAnalyticsBucket {
  intervalKey: string;
  label: string;
  subLabel?: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  categories: ExpenseCategoryContribution[];
}

export interface ExpenseAnalyticsLegendItem {
  id: string;
  name: string;
  color: string;
  superCategoryName?: string | null;
  totalAmount: number;
  percentage: number;
  count: number;
}

export interface ExpenseAnalyticsSummary {
  totalExpense: number;
  averagePerInterval: number;
  peakInterval: {
    key: string;
    label: string;
    amount: number;
  } | null;
  topCategory: {
    name: string;
    color: string;
    amount: number;
    percentage: number;
  } | null;
  totalTransactionsCount: number;
  intervalCount: number;
}

export interface AvailableCategoryType {
  type: string;
  label: string;
  count: number;
  totalAmount: number;
}

export interface ExpenseAnalyticsResponse {
  granularity: ExpenseGranularity;
  startDate: string;
  endDate: string;
  buckets: ExpenseAnalyticsBucket[];
  summary: ExpenseAnalyticsSummary;
  categoryLegend: ExpenseAnalyticsLegendItem[];
  availableCategoryTypes?: AvailableCategoryType[];
}
