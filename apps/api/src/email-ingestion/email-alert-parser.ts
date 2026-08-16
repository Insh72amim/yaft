import { createHash } from 'crypto';
import { findInstitution } from '../common/institutions/institution-registry';
import { parseIndianDate, MONTH_MAP } from '../common/utils/date-utils';
import { AccountType } from '../common/constants/enums';
import { FINANCIAL_CONSTANTS } from '../common/constants/financial-constants';
import {
  canonicalizeMerchantName,
  TRANSACTION_STATUS_CONFIG,
  isExplicitSuccessfulRefund,
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
}

export function parseMoneyToMinorUnits(amountStr: string): bigint {
  const cleanStr = amountStr.replace(/,/g, '').trim();
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0n;
  return BigInt(Math.round(num * 100));
}

export function parseEmailAlertSnippet(bodyText: string, senderOrSubject?: string): ParsedEmailTransaction | null {
  if (!bodyText || typeof bodyText !== 'string') return null;

  // Pre-clean boilerplate warnings and footers so they don't corrupt merchant or account extraction
  let text = bodyText.replace(/\s+/g, ' ').trim();
  text = text.replace(/(?:If (?:this )?transaction was not (?:done|initiated) by you|To block UPI|Please SMS BLOCK|We care about your security|Call us at:|Always open to help you|Warm Regards)[\s\S]*/i, '');

  const fullContext = `${senderOrSubject || ''} ${text}`;

  // 0. Detect and reject Declined / Failed / Unsuccessful / Cancelled transactions
  // Banks & Card issuers send decline alerts when transactions fail (e.g. limit exceeded, incorrect OTP/PIN, security check, network timeout).
  // These failed attempts must NEVER be imported as ledger transactions.
  const isDeclinedOrFailed = TRANSACTION_STATUS_CONFIG.EMAIL_FAILURE_REGEX.test(fullContext);

  if (isDeclinedOrFailed) {
    // Preserve genuine successful refunds/cashbacks that happen to contain the word "refund"
    if (!isExplicitSuccessfulRefund(text)) {
      return null;
    }
  }

  // 1. Detect Bank Name
  const matchedInst = findInstitution(fullContext);
  const bankName = matchedInst ? matchedInst.name : 'Bank Alert';

  // 2. Detect Account Type (Credit Card vs Bank Account)
  const isExplicitCreditCard = /credit\s*card|creditcard|pixel\s*play|card\s*ending|card\s*no\.?\s*(?:xx|\d)|card\s*xx\d|amazon\s*pay|card\s+4[xX]+/i.test(fullContext);
  const isExplicitBankAccount = /(?:debited\s+from\s+your\s+A\/c|debited\s+from\s+A\/c|Account\s*Number:\s*XX|from\s+account\s*[\*xX\d]+|savings\s*a\/c|bank\s*a\/c)/i.test(text);

  let accountType: AccountType =
    isExplicitCreditCard && !isExplicitBankAccount
      ? AccountType.CREDIT_CARD
      : isExplicitBankAccount
      ? AccountType.BANK
      : isExplicitCreditCard
      ? AccountType.CREDIT_CARD
      : AccountType.BANK;

  // 3. Detect Debit vs Credit
  const isCredit = /credited|received|deposited|refund/i.test(text) && !/debited|spent|used|charged|purchase/i.test(text);
  const type: 'DEBIT' | 'CREDIT' = isCredit ? 'CREDIT' : 'DEBIT';

  // 4. Extract Amount
  // Remove distracting "Available Limit", "Credit Limit", "Total Due", "Total Outstanding", "Available Balance" before searching
  const textWithoutLimits = text
    .replace(/(?:available\s*(?:credit)?\s*limit|total\s*(?:credit)?\s*limit|credit\s*limit|total\s*due|total\s*outstanding|available\s*balance|bal\s*limit)\*?\s*(?:is|:)?\s*(?:rs\.?|inr|₹|&#8377;)?\s*[\d,]+(?:\.\d{1,2})?/gi, '');

  let rawAmountNum = 0;

  // Patterns for amount:
  // a. "Transaction Amount: INR 1611" or "Amount Debited: INR 67.00"
  const labelAmountMatch = textWithoutLimits.match(/(?:transaction\s*amount|amount\s*debited|amount\s*credited|amount)\s*[:=]\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  // b. "INR 1611 spent on" or "Rs. 204.00 at" or "Rs. 149.00 was spent" or "noticed a transaction of Rs. 608.28"
  const verbAmountMatch = textWithoutLimits.match(/(?:spent|debited|charged|used\s+for|purchase\s+of|transaction\s+of|amount\s+of|for\s+inr|txn\s+of|noticed\s+a\s+transaction\s+of)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i)
    || textWithoutLimits.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been|was|is)?\s*(?:spent|debited|charged|used|paid|credited)/i)
    || textWithoutLimits.match(/^(?:.*?\b)?(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:spent|was\s+debited|debited)/i);

  if (labelAmountMatch) {
    rawAmountNum = parseFloat(labelAmountMatch[1].replace(/,/g, ''));
  } else if (verbAmountMatch) {
    rawAmountNum = parseFloat(verbAmountMatch[1].replace(/,/g, ''));
  } else {
    const fallbackMatch = textWithoutLimits.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (fallbackMatch) {
      rawAmountNum = parseFloat(fallbackMatch[1].replace(/,/g, ''));
    }
  }

  if (isNaN(rawAmountNum) || rawAmountNum <= 0 || rawAmountNum > FINANCIAL_CONSTANTS.MAX_EMAIL_TRANSACTION_AMOUNT) return null;

  const rawMinor = BigInt(Math.round(rawAmountNum * 100));
  const amountMinor = type === 'DEBIT' ? -rawMinor : rawMinor;

  // 5. Extract Account / Card Last 4 Digits
  let accountLast4: string | undefined;

  const specificAccMatch = text.match(/(?:credit\s*card|account\s*number|a\/c\s*no\.?|a\/c|account|card)\s*(?:ending\s*(?:with|in)?|no\.?|is|:)?\s*(?:XX|\*+|4[xX]+)?(\d{4,8})\b/i)
    || text.match(/(?:ending\s+with|ending\s+in|ending)\s*(?:XX|\*+)?(\d{4})\b/i)
    || text.match(/(?:\b\d{4}|\b[xX]{4}|\b[*]{4})[*xX\d-]{4,16}(\d{4})\b/i)
    || text.match(/\b(?:XX|\*+|4[xX]+)(\d{4})\b/i);

  if (specificAccMatch) {
    const rawDigits = specificAccMatch[1];
    accountLast4 = rawDigits.length >= 4 ? rawDigits.slice(-4) : rawDigits;
  }

  // 6. Extract Reference / UTR Number
  let referenceNumber: string | undefined;
  const refMatch = text.match(/(?:ref\s*(?:no\.?|id)?|txn\s*(?:id|no\.?)?|utr|auth\s*code|reference\s*number)[:\s]*([a-zA-Z0-9]{6,22})/i)
    || text.match(/UPI\/(?:P2A|P2M|P2P)\/(\d{8,18})\//i);

  if (refMatch) {
    referenceNumber = refMatch[1];
  }

  // 7. Extract Merchant / Payee
  let rawMerchant = 'General Merchant';

  const merchantNameMatch = text.match(/(?:merchant\s*name|info)[:\s]+([a-zA-Z0-9\s._\-&@]{2,50}?)(?=\s+(?:Axis|Date|Available|Total|The|Ref|Avail|Auth|\*|\.|$))/i);
  const txnInfoMatch = text.match(/transaction\s*info[:\s]+([a-zA-Z0-9\s._\-&@\/]{3,60}?)(?=\s+(?:If|To|Please|Available|Date|\.|$))/i);
  const toVpaMatch = text.match(/to\s+(?:VPA\s+)?([a-zA-Z0-9._\-@&]{3,50})(?=\s+(?:on\s+\d|at\s+\d|\.|\bref\b|$))/i);
  const towardsMatch = text.match(/towards\s+([a-zA-Z0-9\s._\-&@]{2,45}?)(?=\s+(?:at\s+\d|on\s+\d|\.|Bal|Total|Ref|via|$))/i);
  const atMatch = text.match(/\bat\s+(?!\d{1,2}:\d{2})(?!\d{1,2}[-/]\d{1,2})([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:on\s+\d|at\s+\d|\.|\binfo\b|\bavail|\btotal|\bref|\bcard|\ba\/c|$))/i);

  if (merchantNameMatch) {
    rawMerchant = merchantNameMatch[1];
  } else if (txnInfoMatch) {
    rawMerchant = txnInfoMatch[1];
  } else if (toVpaMatch && !/^(vpa|account|a\/c|debited|credited|ref|bank)$/i.test(toVpaMatch[1].trim())) {
    rawMerchant = toVpaMatch[1];
  } else if (towardsMatch) {
    rawMerchant = towardsMatch[1];
  } else if (atMatch) {
    rawMerchant = atMatch[1];
  }

  const merchant = canonicalizeMerchantName(rawMerchant);

  // 8. Extract Date & Time
  let transactionDate = new Date();
  const dateMatch = text.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}|\d{1,2}[-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s,]?\s*\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}-\d{2}-\d{2})\b/i);
  const timeMatch = text.match(/(?:at|time)[:\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:am|pm))?)/i)
    || text.match(/,\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:IST)?/i)
    || text.match(/\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:IST)?/i);

  if (dateMatch) {
    transactionDate = parseIndianDate(dateMatch[1], timeMatch ? timeMatch[1] : undefined);
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

