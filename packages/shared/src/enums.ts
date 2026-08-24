/**
 * Centralized YAFT Domain Enums.
 */

export enum AccountType {
  BANK = 'BANK',
  SAVINGS = 'SAVINGS',
  CREDIT_CARD = 'CREDIT_CARD',
  CASH = 'CASH',
  MUTUAL_FUND = 'MUTUAL_FUND',
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

export enum ImportStatus {
  PENDING = 'PENDING',
  COMMITTED = 'COMMITTED',
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR',
}

export enum SalaryItemType {
  EARNING = 'EARNING',
  DEDUCTION = 'DEDUCTION',
  EMPLOYER_CONTRIBUTION = 'EMPLOYER_CONTRIBUTION',
  BASIC = 'BASIC',
  HRA = 'HRA',
  SPECIAL_ALLOWANCE = 'SPECIAL_ALLOWANCE',
  PF = 'PF',
  PROFESSIONAL_TAX = 'PROFESSIONAL_TAX',
  INCOME_TAX = 'INCOME_TAX',
  OTHER_EARNING = 'OTHER_EARNING',
  OTHER_DEDUCTION = 'OTHER_DEDUCTION',
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

export enum MatchField {
  DESCRIPTION = 'DESCRIPTION',
  MERCHANT = 'MERCHANT',
  AMOUNT = 'AMOUNT',
}

export enum MatchType {
  CONTAINS = 'CONTAINS',
  EXACT = 'EXACT',
  STARTS_WITH = 'STARTS_WITH',
  REGEX = 'REGEX',
}
