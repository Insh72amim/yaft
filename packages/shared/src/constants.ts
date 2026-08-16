/**
 * Centralized Financial & Tax Constants.
 */

export const FINANCIAL_CONSTANTS = {
  /** Warning threshold for credit card utilization percentage */
  CREDIT_UTILIZATION_WARNING_THRESHOLD: 30,
  /** Default historical cash flow months window */
  DEFAULT_CASH_FLOW_MONTHS: 6,
  /** Max safety threshold for email parsed transaction amount in INR */
  MAX_EMAIL_TRANSACTION_AMOUNT: 10_000_000,
  /** Default ISO currency */
  DEFAULT_CURRENCY: 'INR',
  /** Default currency symbol */
  DEFAULT_CURRENCY_SYMBOL: '₹',
  /** Default locale */
  DEFAULT_LOCALE: 'en-IN',
  /** Default S3 Bucket Name */
  DEFAULT_S3_BUCKET: 'yaft-documents',
} as const;

export const TAX_CONSTANTS = {
  /** Maximum deduction limit under Section 80C of the Indian Income Tax Act */
  SECTION_80C_MAX_LIMIT: 150_000,
  /** Standard deduction under the New Tax Regime (FY 2024-25 onwards) */
  STANDARD_DEDUCTION_NEW_REGIME: 75_000,
  /** Sanity safety ceiling for a single monthly tax line item in minor units (50 Lakhs) */
  MAX_TAX_LINE_ITEM_SAFETY_CAP: 50_000_000,
} as const;
