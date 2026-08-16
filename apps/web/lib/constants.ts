/**
 * Centralized Web Enums & Constants.
 */

export enum AccountType {
  BANK = 'BANK',
  SAVINGS = 'SAVINGS',
  CREDIT_CARD = 'CREDIT_CARD',
  CASH = 'CASH',
  INVESTMENT = 'INVESTMENT',
  STOCKS = 'STOCKS',
  EPFO = 'EPFO',
  LOAN = 'LOAN',
  FIXED_DEPOSIT = 'FIXED_DEPOSIT',
  UPI_LITE = 'UPI_LITE',
}

export enum ImportSourceType {
  BANK_STATEMENT = 'BANK_STATEMENT',
  CREDIT_CARD = 'CREDIT_CARD',
  SALARY_PAYSLIP = 'SALARY_PAYSLIP',
  DOCUMENT = 'DOCUMENT',
}

export enum CardNetwork {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  AMEX = 'amex',
  RUPAY = 'rupay',
  DINERS = 'diners',
  DEFAULT = 'default',
}

export enum TransactionFilterMode {
  ALL = 'ALL',
  CREDIT_CARD = 'CREDIT_CARD',
  BANK = 'BANK',
  UPI = 'UPI',
  UPI_LITE = 'UPI_LITE',
}

export enum SalarySubTab {
  SUMMARY = 'SUMMARY',
  ANALYTICS = 'ANALYTICS',
  PAYSLIPS = 'PAYSLIPS',
  HISTORY = 'HISTORY',
}

export const FINANCIAL_CONSTANTS = {
  /** Warning threshold for credit card utilization percentage */
  CREDIT_UTILIZATION_WARNING_THRESHOLD: 30,
  /** Default historical cash flow months window */
  DEFAULT_CASH_FLOW_MONTHS: 6,
  /** Default currency */
  DEFAULT_CURRENCY: 'INR',
  /** Default locale */
  DEFAULT_LOCALE: 'en-IN',
} as const;

export const TAX_CONSTANTS = {
  /** Maximum deduction limit under Section 80C of the Indian Income Tax Act */
  SECTION_80C_MAX_LIMIT: 150_000,
  /** Standard deduction under the New Tax Regime (FY 2024-25 onwards) */
  STANDARD_DEDUCTION_NEW_REGIME: 75_000,
  /** Sanity safety ceiling for a single monthly tax line item in minor units (50 Lakhs) */
  MAX_TAX_LINE_ITEM_SAFETY_CAP: 50_000_000,
} as const;
