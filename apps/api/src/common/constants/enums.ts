import {
  AccountType,
  SalaryItemType,
  ImportStatus,
  MatchField,
  MatchType,
} from '@prisma/client';

export {
  AccountType,
  SalaryItemType,
  ImportStatus,
  MatchField,
  MatchType,
};

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
