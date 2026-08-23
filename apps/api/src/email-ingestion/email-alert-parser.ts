import { createHash } from 'crypto';
import { findInstitution } from '../common/institutions/institution-registry';
import { AccountType } from '../common/constants/enums';
import { FINANCIAL_CONSTANTS } from '../common/constants/financial-constants';
import {
  parseIndianDate,
  MONTH_MAP,
  canonicalizeMerchantName,
  TRANSACTION_STATUS_CONFIG,
  isExplicitSuccessfulRefund,
  EMAIL_ALERT_PATTERNS,
  cleanEmailAlertText,
  extractAlertAmount,
  extractAlertAccountLast4,
  extractAlertReferenceNumber,
  extractAlertRawMerchant,
  extractAlertDateTime,
} from '@yaft/shared';

export { parseIndianDate, MONTH_MAP, canonicalizeMerchantName as cleanMerchantName };

export interface ParsedEmailTransaction {
  bankName: string;
  accountLast4?: string;
  accountType: AccountType;
  type: 'DEBIT' | 'CREDIT';
  amountMinor: bigint; // Signed minor units (negative for debit, positive for credit)
  amountDisplay: number; // Absolute rupees
  merchant: string;
  referenceNumber?: string;
  transactionDate: Date;
  rawSnippet: string;
  emailMessageId?: string;
  emailSubject?: string;
  emailSender?: string;
  emailDate?: Date;
}

export function parseMoneyToMinorUnits(amountStr: string): bigint {
  const cleanStr = amountStr.replace(/,/g, '').trim();
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0n;
  return BigInt(Math.round(num * 100));
}

export const PROMOTIONAL_OR_NON_TRANSACTION_REGEX = new RegExp([
  // EMI conversions & loan offers
  '(?:flexi\\s*emi|flexipay|easy\\s*emi|smart\\s*emi|convert.*(?:trxn|txn|transaction|expenses?|spends?).*into.*emi|converting your transaction|processing fee on converting|convert.*into.*easy.*emi|convert.*transactions? worth|turn your eligible spends into)',
  // Marketing & reward offers & discounts
  '(?:unlock.*(?:voucher|reward|cashback|exciting)|gift card, with|enjoy.*cashback on your next|special offer|pre-approved|apply now|upgrade your card|file your taxes|guide to smart credit card|switch to faster|complimentary voucher|rewards? on your.*credit card)',
  '(?:up\\s+to\\s*(?:rs\\.?|inr|₹|&#8377;)?\\s*[\\d,]+\\s*(?:off|cashback|discount|voucher|rewards?)|\\b\\d+%\\s*off|\\bflat\\s+(?:rs\\.?|inr|₹|&#8377;)?\\s*[\\d,]+\\s*off|\\boff\\s+on\\b)',
  '(?:avail\\s*(?:now|offer|discount|cashback)|exciting\\s*offer|exclusive\\s*offer|great\\s*offer|limited\\s*period\\s*offer|save\\s+up\\s+to|get\\s+up\\s+to|instant\\s+discount|discount\\s+on|discounts\\s+on|cashback\\s+offer)',
  // OTPs & Authentication emails
  '(?:one time password|\\botp\\b|authentication code|secret code)',
  // Statement notifications & monthly summary bills
  '(?:monthly statement|e-statement|your.*statement for|statement summary|total amount due|minimum amount due|payment due date|consolidated account statement)',
  // Declined & Failed
  '(?:declined|transaction declined|payment failed|unsuccessful transaction)'
].join('|'), 'i');

export const EXPLICIT_TRANSACTION_INDICATOR_REGEX = /\b(?:debited|credited|spent|charged|used\s+for|used\s+at|purchase\s+of|payment\s+of|withdrawn|received|deposited|refund\s+of|transfer\s+of|amount\s+debited|amount\s+credited|transaction\s*(?:on|amount|of|for|info|details|summary)?|processed\s+for|successful\s+transaction|paid\s+to|paid\s+for|txn\s*(?:of|on|amount)?)\b/i;

export const PROMOTIONAL_SENDER_REGEX = /offers@|deals@|marketing@|promo@|newsletter@|campaign@|digital\.axisbankmail|statements?@/i;

export function parseEmailAlertSnippet(bodyText: string, senderOrSubject?: string): ParsedEmailTransaction | null {
  if (!bodyText || typeof bodyText !== 'string') return null;

  // Reject explicit marketing senders immediately
  if (senderOrSubject && PROMOTIONAL_SENDER_REGEX.test(senderOrSubject)) {
    return null;
  }

  // Pre-clean boilerplate warnings and footers so they don't corrupt merchant or account extraction
  const text = cleanEmailAlertText(bodyText);
  const fullContext = `${senderOrSubject || ''} ${text}`;

  // 0. Detect and reject Declined / Failed / Unsuccessful / Cancelled / Promotional / EMI / Statement transactions
  const isRejected = PROMOTIONAL_OR_NON_TRANSACTION_REGEX.test(fullContext) || TRANSACTION_STATUS_CONFIG.EMAIL_FAILURE_REGEX.test(fullContext);

  if (isRejected && !isExplicitSuccessfulRefund(text)) {
    return null;
  }

  // Require an explicit transaction action verb or confirmation indicator unless it's a valid refund
  const hasTransactionAction = EXPLICIT_TRANSACTION_INDICATOR_REGEX.test(fullContext) || EMAIL_ALERT_PATTERNS.DEBIT_TXN_REGEX.test(text) || EMAIL_ALERT_PATTERNS.CREDIT_TXN_REGEX.test(text);
  if (!hasTransactionAction && !isExplicitSuccessfulRefund(text)) {
    return null;
  }

  // 1. Detect Bank Name
  const matchedInst = findInstitution(fullContext);
  const bankName = matchedInst ? matchedInst.name : 'Bank Alert';

  // 2. Detect Account Type (Credit Card vs Bank Account)
  const isExplicitCreditCard = EMAIL_ALERT_PATTERNS.EXPLICIT_CREDIT_CARD_REGEX.test(fullContext);
  const isExplicitBankAccount = EMAIL_ALERT_PATTERNS.EXPLICIT_BANK_ACCOUNT_REGEX.test(text);

  const accountType: AccountType =
    isExplicitCreditCard && !isExplicitBankAccount
      ? AccountType.CREDIT_CARD
      : isExplicitBankAccount
      ? AccountType.BANK
      : isExplicitCreditCard
      ? AccountType.CREDIT_CARD
      : AccountType.BANK;

  // 3. Detect Debit vs Credit
  const isCredit = EMAIL_ALERT_PATTERNS.CREDIT_TXN_REGEX.test(text) && !EMAIL_ALERT_PATTERNS.DEBIT_TXN_REGEX.test(text);
  const type: 'DEBIT' | 'CREDIT' = isCredit ? 'CREDIT' : 'DEBIT';

  // 4. Extract Amount
  const rawAmountNum = extractAlertAmount(text);
  if (rawAmountNum === null || rawAmountNum <= 0 || rawAmountNum > FINANCIAL_CONSTANTS.MAX_EMAIL_TRANSACTION_AMOUNT) {
    return null;
  }

  const rawMinor = BigInt(Math.round(rawAmountNum * 100));
  const amountMinor = type === 'DEBIT' ? -rawMinor : rawMinor;

  // 5. Extract Account / Card Last 4 Digits
  const accountLast4 = extractAlertAccountLast4(text);

  // 6. Extract Reference / UTR Number
  const referenceNumber = extractAlertReferenceNumber(text);

  // 7. Extract Merchant / Payee
  const rawMerchant = extractAlertRawMerchant(text);
  const merchant = canonicalizeMerchantName(rawMerchant);

  // 8. Extract Date & Time
  let transactionDate = new Date();
  const { dateStr, timeStr } = extractAlertDateTime(text);
  if (dateStr) {
    transactionDate = parseIndianDate(dateStr, timeStr);
  }

  return {
    bankName,
    accountLast4,
    accountType,
    type,
    amountMinor,
    amountDisplay: rawAmountNum,
    merchant,
    referenceNumber,
    transactionDate,
    rawSnippet: text.slice(0, 300),
  };
}

export function parseMultipleEmailAlerts(emailTextContent: string, senderOrSubject?: string): ParsedEmailTransaction[] {
  if (!emailTextContent) return [];

  const rawBlocks = emailTextContent
    .split(/(?:\r?\n){2,}|(?=Dear\s+(?:Customer|User|SBI|Cardholder|Account\s*holder))|(?=(?:^|\n)\s*(?:Rs\.|INR|₹)\s*[\d,]+)/im)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);

  const results: ParsedEmailTransaction[] = [];
  const seenRefs = new Set<string>();

  for (const block of rawBlocks) {
    const parsed = parseEmailAlertSnippet(block, senderOrSubject);
    if (parsed) {
      const key = `${parsed.bankName}-${parsed.amountMinor}-${parsed.transactionDate.toISOString().slice(0, 10)}-${parsed.merchant}`;
      if (!seenRefs.has(key)) {
        seenRefs.add(key);
        results.push(parsed);
      }
    }
  }

  if (results.length === 0) {
    const fallback = parseEmailAlertSnippet(emailTextContent, senderOrSubject);
    if (fallback) results.push(fallback);
  }

  return results;
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

