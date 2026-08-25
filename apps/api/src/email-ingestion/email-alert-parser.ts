import { createHash } from 'crypto';
import { AccountType } from '../common/constants/enums';
import {
  parseIndianDate,
  MONTH_MAP,
  canonicalizeMerchantName,
  parseStructuredEmailAlert,
  parseMultipleStructuredEmailAlerts,
  StructuredParsedEmailTransaction,
} from '@yaft/shared';

export { parseIndianDate, MONTH_MAP, canonicalizeMerchantName as cleanMerchantName };

export interface ParsedEmailTransaction extends StructuredParsedEmailTransaction {}

export function parseMoneyToMinorUnits(amountStr: string): bigint {
  const cleanStr = amountStr.replace(/,/g, '').trim();
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0n;
  return BigInt(Math.round(num * 100));
}

export function parseEmailAlertSnippet(
  bodyText: string,
  senderOrSubject?: string,
  fallbackDate?: Date
): ParsedEmailTransaction | null {
  return parseStructuredEmailAlert(bodyText, senderOrSubject, fallbackDate);
}

export function parseMultipleEmailAlerts(
  emailTextContent: string,
  senderOrSubject?: string,
  fallbackDate?: Date
): ParsedEmailTransaction[] {
  return parseMultipleStructuredEmailAlerts(emailTextContent, senderOrSubject, fallbackDate);
}

export function getAlertFingerprint(accountId: string, alert: ParsedEmailTransaction): string {
  const stableIdentity = alert.referenceNumber?.toLowerCase().trim()
    || `${alert.merchant.toLowerCase().trim()}|${alert.accountLast4 || 'GEN'}`;
  const dateStr = alert.transactionDate.toISOString().slice(0, 10);
  const seed = `${accountId}|${dateStr}|${stableIdentity}|${alert.amountMinor.toString()}`;
  return createHash('sha256').update(seed).digest('hex');
}

export function getAccountCategoryKey(alert: ParsedEmailTransaction): string {
  const last4 = alert.accountLast4 ? alert.accountLast4 : 'GENERAL';
  return `${alert.bankName}::${alert.accountType}::${last4}`;
}

export function getAccountCategoryDisplayName(alert: ParsedEmailTransaction): string {
  const last4Suffix = alert.accountLast4 ? ` (••${alert.accountLast4})` : '';
  if (alert.accountType === 'CREDIT_CARD') {
    return `${alert.bankName} Credit Card${last4Suffix}`;
  }
  return `${alert.bankName} Account${alert.accountLast4 ? ` (A/C ••${alert.accountLast4})` : ''}`;
}

