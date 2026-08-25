/**
 * Stage 4: Structured Email Parser Pipeline Orchestrator
 *
 * Combines Preprocessing (Stage 1), Intent Classification (Stage 2),
 * Clause Tokenization (Stage 3), and Financial Direction Reconciliation (Stage 4)
 * into a typed, verified ParsedEmailTransaction.
 */

import { preprocessEmailDocument } from './email-preprocessor';
import { classifyEmailIntent, TransactionalIntent } from './intent-classifier';
import { extractSemanticTokens } from './clause-tokenizer';
import { AccountType } from '../enums';
import { FINANCIAL_CONSTANTS } from '../constants';
import { parseIndianDate } from '../date-utils';
import { findEmailConfigForSender } from '../email-alert-configs';

export interface StructuredParsedEmailTransaction {
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
  suggestedCategoryName?: string;
  emailMessageId?: string;
  emailSubject?: string;
  emailSender?: string;
  emailDate?: Date;
  intent?: TransactionalIntent;
}

export function parseStructuredEmailAlert(
  bodyText: string,
  senderOrSubject?: string,
  fallbackDate?: Date
): StructuredParsedEmailTransaction | null {
  if (!bodyText || typeof bodyText !== 'string') return null;

  // Stage 1: Document Preprocessing & Section Partitioning
  const doc = preprocessEmailDocument(bodyText, senderOrSubject);

  // Stage 2: Intent Classification & Early Exit Gate
  const intentResult = classifyEmailIntent(doc);
  if (!intentResult.isTransactional) {
    return null;
  }

  const intent = intentResult.intent as TransactionalIntent;

  // Stage 3: Structured Context Tokenization
  const tokens = extractSemanticTokens(doc, intent);

  if (
    tokens.amountNumber === null ||
    tokens.amountMinor === null ||
    tokens.amountNumber <= 0 ||
    tokens.amountNumber > FINANCIAL_CONSTANTS.MAX_EMAIL_TRANSACTION_AMOUNT
  ) {
    return null;
  }

  // Stage 4: Financial Direction & Category Reconciliation
  let type: 'DEBIT' | 'CREDIT' = 'DEBIT';
  let suggestedCategoryName: string | undefined = undefined;

  const config = findEmailConfigForSender(senderOrSubject, doc.fullContext);
  if (config?.defaultCategoryName) {
    suggestedCategoryName = config.defaultCategoryName;
  }

  switch (intent) {
    case 'CARD_BILL_PAYMENT':
      type = 'CREDIT';
      suggestedCategoryName = 'Credit Card Payment';
      break;
    case 'REFUND_OR_REVERSAL':
      type = 'CREDIT';
      suggestedCategoryName = 'Refund';
      break;
    case 'INWARD_CREDIT':
      type = 'CREDIT';
      suggestedCategoryName = 'Salary';
      break;
    case 'INVESTMENT_DEBIT':
      type = 'DEBIT';
      suggestedCategoryName = config?.defaultCategoryName || 'Mutual Fund SIP';
      break;
    case 'CARD_SPEND':
    case 'ACCOUNT_DEBIT':
    default:
      type = 'DEBIT';
      break;
  }

  const signedAmountMinor = type === 'DEBIT' ? -tokens.amountMinor : tokens.amountMinor;

  // Parse Date & Time
  let transactionDate = fallbackDate ? new Date(fallbackDate) : new Date();
  if (tokens.dateStr) {
    transactionDate = parseIndianDate(tokens.dateStr, tokens.timeStr);
  }

  return {
    bankName: tokens.bankName,
    accountLast4: tokens.accountLast4,
    accountType: tokens.accountType,
    type,
    amountMinor: signedAmountMinor,
    amountDisplay: tokens.amountNumber,
    merchant: tokens.merchantCanonical,
    referenceNumber: tokens.referenceNumber,
    transactionDate,
    rawSnippet: doc.corePayload.slice(0, 300),
    suggestedCategoryName,
    emailSender: senderOrSubject,
    emailSubject: senderOrSubject,
    emailDate: fallbackDate,
    intent,
  };
}

export function parseMultipleStructuredEmailAlerts(
  emailTextContent: string,
  senderOrSubject?: string,
  fallbackDate?: Date
): StructuredParsedEmailTransaction[] {
  if (!emailTextContent) return [];

  const rawBlocks = emailTextContent
    .split(/(?:\r?\n){2,}|(?=Dear\s+(?:Customer|User|SBI|Cardholder|Account\s*holder))|(?=(?:^|\n)\s*(?:Rs\.|INR|₹)\s*[\d,]+)/im)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);

  const results: StructuredParsedEmailTransaction[] = [];
  const seenRefs = new Set<string>();

  for (const block of rawBlocks) {
    const parsed = parseStructuredEmailAlert(block, senderOrSubject, fallbackDate);
    if (parsed) {
      const key = `${parsed.bankName}-${parsed.amountMinor}-${parsed.transactionDate.toISOString().slice(0, 10)}-${parsed.merchant}`;
      if (!seenRefs.has(key)) {
        seenRefs.add(key);
        results.push(parsed);
      }
    }
  }

  if (results.length === 0) {
    const fallback = parseStructuredEmailAlert(emailTextContent, senderOrSubject, fallbackDate);
    if (fallback) results.push(fallback);
  }

  return results;
}
