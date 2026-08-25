/**
 * Centralized formatting utilities for YAFT.
 * Standardizes currency (INR minor units), numbers, percentages, and dates.
 */

import { FINANCIAL_CONSTANTS } from './constants';

export interface FormatMoneyOptions {
  /** Use compact notation (e.g., ₹1.5L, ₹50K) */
  compact?: boolean;
  /** ISO 4217 Currency code (default: INR) */
  currency?: string;
  /** BCP 47 Language Tag (default: en-IN) */
  locale?: string;
  /** Max fraction digits to show (default: 0 for INR) */
  maxFractionDigits?: number;
  /** Min fraction digits to show */
  minFractionDigits?: number;
  /** How to display signs (+/-) */
  signDisplay?: 'auto' | 'never' | 'always' | 'exceptZero';
  /** Fallback string if value is null or undefined */
  fallback?: string;
}

/**
 * Formats a monetary amount in minor units (e.g. paise/cents) to a localized currency string.
 * Example: `formatMoney(150000)` -> `"₹1,500"`
 * Example: `formatMoney(15000000, { compact: true })` -> `"₹1.5L"`
 */
export function formatMoney(
  minor: number | bigint | null | undefined,
  options: FormatMoneyOptions = {},
): string {
  if (minor === null || minor === undefined || (typeof minor === 'number' && isNaN(minor))) {
    return options.fallback ?? '₹0';
  }

  const {
    compact = false,
    currency = FINANCIAL_CONSTANTS.DEFAULT_CURRENCY,
    locale = FINANCIAL_CONSTANTS.DEFAULT_LOCALE,
    maxFractionDigits = 0,
    minFractionDigits = 0,
    signDisplay = 'auto',
  } = options;

  const major = typeof minor === 'bigint' ? Number(minor) / 100 : minor / 100;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: minFractionDigits,
    notation: compact ? 'compact' : 'standard',
    signDisplay,
  }).format(major);
}

/**
 * Formats standard decimal numbers with Indian locale grouping.
 * Example: `formatQuantity("1234567.89", 2)` -> `"12,34,567.89"`
 */
export function formatQuantity(
  value: number | string | null | undefined,
  maxDecimals = 6,
  fallback = '—',
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return fallback;

  return new Intl.NumberFormat(FINANCIAL_CONSTANTS.DEFAULT_LOCALE, {
    maximumFractionDigits: maxDecimals,
  }).format(num);
}

/**
 * Formats a percentage value.
 * Example: `formatPercent(85.4)` -> `"85%"`
 * Example: `formatPercent(85.4, 1)` -> `"85.4%"`
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 0,
  fallback = '0%',
): string {
  if (value === null || value === undefined || isNaN(value)) return fallback;
  return `${value.toFixed(decimals)}%`;
}

/**
 * Returns formatted month and year label (e.g. "August 2026").
 */
export const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export function formatMonthYear(month: number, year: number, format: 'full' | 'short' = 'full'): string {
  const clampedMonth = Math.max(1, Math.min(12, month));
  const list = format === 'short' ? MONTH_NAMES_SHORT : MONTH_NAMES_FULL;
  return `${list[clampedMonth - 1]} ${year}`;
}
