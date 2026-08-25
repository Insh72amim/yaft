/**
 * Stage 2: Intent Classification & Early Exit Gate
 *
 * Evaluates semantic document intent to strictly differentiate actual
 * financial mutations from promotional noise, OTPs, digests, and failures.
 */

import { PreprocessedEmailDocument } from './email-preprocessor';

export type TransactionalIntent =
  | 'CARD_SPEND'
  | 'ACCOUNT_DEBIT'
  | 'CARD_BILL_PAYMENT'
  | 'REFUND_OR_REVERSAL'
  | 'INWARD_CREDIT'
  | 'INVESTMENT_DEBIT';

export type NonTransactionalIntent =
  | 'PROMO_OR_OFFER'
  | 'CARD_BENEFIT_OR_AGREEMENT'
  | 'SECURITY_OR_OTP'
  | 'STATEMENT_SUMMARY'
  | 'DECLINED_OR_FAILED'
  | 'UPCOMING_REMINDER'
  | 'UNKNOWN_NON_TRANSACTIONAL';

export type DocumentIntent = TransactionalIntent | NonTransactionalIntent;

export interface IntentClassificationResult {
  intent: DocumentIntent;
  isTransactional: boolean;
  confidence: number;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Intent Matchers
// ---------------------------------------------------------------------------

const MARKETING_SENDER_PATTERNS = [
  /offers@|deals@|marketing@|promo@|newsletter@|campaign@|digital\.axisbankmail|statements?@/i,
];

const NON_TRANSACTIONAL_PATTERNS = {
  SECURITY_OR_OTP: /\b(?:one\s+time\s+password|otp|secret\s+code|authentication\s+code|verification\s+code)\b/i,
  DECLINED_OR_FAILED: /\b(?:declined|transaction\s+declined|payment\s+failed|unsuccessful\s+transaction|could\s+not\s+be\s+processed|insufficient\s+funds?)\b/i,
  UPCOMING_REMINDER: /\b(?:upcoming\s+autopay|autopay.*reminder|to\s+be\s+debited\s+by)\b/i,
  STATEMENT_SUMMARY: /\b(?:monthly\s+statement|e-statement|your.*statement\s+for\s+the\s+period|total\s+amount\s+due.*minimum\s+amount\s+due|consolidated\s+account\s+statement|attached\s+herewith\s+is\s+the\s+monthly\s+statement|statement\s+of\s+your.*credit\s*card)\b/i,
  CARD_BENEFIT_OR_AGREEMENT: /\b(?:glance\s+at\s+(?:the\s+)?benefits|benefits\s+that\s+come\s+with|benefits\s+on\s+your\s+(?:card|account)|hand-picked\s+benefits|edge\s+reward\s+points|features\s+and\s+benefits|schedule\s+of\s+charges|annual\s+fee\s+structure|know\s+(?:more\s+about\s+)?your\s+card|welcome\s+to\s+your\s+new|terms\s+(?:and|&)\s+conditions|cardholder\s+agreement|explore\s+benefits)\b/i,
  PROMO_OR_OFFER: /\b(?:unlock.*(?:voucher|reward|cashback|exciting)|gift\s+card,\s+with|enjoy.*cashback\s+on\s+your\s+next|special\s+offer|pre-approved|apply\s+now|upgrade\s+your\s+card|file\s+your\s+taxes|guide\s+to\s+smart\s+credit\s+card|complimentary\s+voucher|up\s+to\s*(?:rs\.?|inr|₹)\s*[\d,]+\s*(?:off|discount|voucher)|flat\s+(?:rs\.?|inr|₹)\s*[\d,]+\s*off|avail\s*(?:now|offer|discount)|exclusive\s*offer|limited\s*period\s*offer)\b/i,
};

const TRANSACTIONAL_PATTERNS = {
  CARD_BILL_PAYMENT: /(?:received\s+payment\s+of|payment\s+of.*received|payment\s+received|payment\s+towards\s+your\s+credit\s+card|thank\s+you\s+for\s+(?:your\s+)?payment\s+(?:of|towards)|auto\s*debit\s+payment\s+towards\s+your\s+credit\s+card)/i,
  REFUND_OR_REVERSAL: /(?:refund\s+(?:of|for|worth|has\s+been|from)|refund\s+processed|refund\s+successful|cashback\s+(?:credited|worth)|towards\s+cashback|reversal\s+(?:of|for)|credited\s+back|reversed\s+to\s+your\s+card|amount\s+refunded|towards\s+refund\s+from)/i,
  INVESTMENT_DEBIT: /(?:sip\s+debit|sip\s+installment|mutual\s+fund\s+purchase|units?\s+(?:will\s+be\s+)?allotted|zerodha\s+broking|groww\s+pay|cams|kfintech|bse\s+star|purchase\s+order\s+executed)/i,
  INWARD_CREDIT: /(?:salary\s+credited|amount\s+credited|credited\s+by|has\s+been\s+credited|inward\s+remittance|deposited\s+in\s+your\s+account|neft\s+cr|imps\s+cr|credited\s+to\s+your\s+account|credited\s+to\s+your\s+sbi\s*card)/i,
  CARD_SPEND: /(?:spent\s+on|used\s+for|used\s+at|purchase\s+of|charged\s+on|Transaction\s+on.*Credit\s*Card|Credit\s*Card.*Transaction|Transaction\s+Amount|noticed\s+a\s+transaction|summary\s+of\s+your.*Credit\s*Card\s*Transaction|successful\s+AutoPay\s+transaction|thank\s+you\s+for\s+using\s+your.*Credit\s*Card)/i,
  ACCOUNT_DEBIT: /(?:debited\s+with|debited\s+from|amount\s+debited|withdrawn\s+from|transferred\s+to|auto\s*debit|mandate\s+executed|paid\s+using\s+upi|has\s+been\s+debited|\bdebited\b)/i,
};

export function classifyEmailIntent(doc: PreprocessedEmailDocument): IntentClassificationResult {
  const { corePayload, fullContext, sender } = doc;

  // 1. Sender domain hard rejects
  if (sender && MARKETING_SENDER_PATTERNS.some((p) => p.test(sender))) {
    return { intent: 'PROMO_OR_OFFER', isTransactional: false, confidence: 95, reason: 'Marketing sender' };
  }

  // 2. Early non-transactional filters (Failures, OTPs, Reminders, Statements)
  if (NON_TRANSACTIONAL_PATTERNS.DECLINED_OR_FAILED.test(corePayload) || NON_TRANSACTIONAL_PATTERNS.DECLINED_OR_FAILED.test(fullContext)) {
    return { intent: 'DECLINED_OR_FAILED', isTransactional: false, confidence: 95, reason: 'Failed/declined attempt' };
  }

  if (NON_TRANSACTIONAL_PATTERNS.UPCOMING_REMINDER.test(corePayload) || NON_TRANSACTIONAL_PATTERNS.UPCOMING_REMINDER.test(fullContext)) {
    return { intent: 'UPCOMING_REMINDER', isTransactional: false, confidence: 95, reason: 'Upcoming reminder' };
  }

  if (NON_TRANSACTIONAL_PATTERNS.SECURITY_OR_OTP.test(corePayload)) {
    return { intent: 'SECURITY_OR_OTP', isTransactional: false, confidence: 99, reason: 'OTP/Security code' };
  }

  if (NON_TRANSACTIONAL_PATTERNS.CARD_BENEFIT_OR_AGREEMENT.test(corePayload)) {
    return { intent: 'CARD_BENEFIT_OR_AGREEMENT', isTransactional: false, confidence: 90, reason: 'Card feature or terms' };
  }

  if (NON_TRANSACTIONAL_PATTERNS.PROMO_OR_OFFER.test(corePayload)) {
    return { intent: 'PROMO_OR_OFFER', isTransactional: false, confidence: 90, reason: 'Promo or marketing voucher' };
  }

  if (NON_TRANSACTIONAL_PATTERNS.STATEMENT_SUMMARY.test(corePayload)) {
    return { intent: 'STATEMENT_SUMMARY', isTransactional: false, confidence: 85, reason: 'Monthly statement digest' };
  }

  // 3. High-priority explicit transactional intents (Payments, Refunds, Investments)
  if (TRANSACTIONAL_PATTERNS.CARD_BILL_PAYMENT.test(corePayload) || TRANSACTIONAL_PATTERNS.CARD_BILL_PAYMENT.test(fullContext)) {
    return { intent: 'CARD_BILL_PAYMENT', isTransactional: true, confidence: 95 };
  }

  if (TRANSACTIONAL_PATTERNS.REFUND_OR_REVERSAL.test(corePayload) || TRANSACTIONAL_PATTERNS.REFUND_OR_REVERSAL.test(fullContext)) {
    return { intent: 'REFUND_OR_REVERSAL', isTransactional: true, confidence: 95 };
  }

  if (TRANSACTIONAL_PATTERNS.INVESTMENT_DEBIT.test(corePayload) || TRANSACTIONAL_PATTERNS.INVESTMENT_DEBIT.test(fullContext)) {
    return { intent: 'INVESTMENT_DEBIT', isTransactional: true, confidence: 90 };
  }

  // 4. Standard transactional classification
  if (TRANSACTIONAL_PATTERNS.CARD_SPEND.test(corePayload) || (/\bspent\b/i.test(corePayload) && /\bcard\b/i.test(corePayload))) {
    return { intent: 'CARD_SPEND', isTransactional: true, confidence: 90 };
  }

  if (TRANSACTIONAL_PATTERNS.INWARD_CREDIT.test(corePayload) || /\bcredited\b/i.test(corePayload)) {
    return { intent: 'INWARD_CREDIT', isTransactional: true, confidence: 90 };
  }

  if (TRANSACTIONAL_PATTERNS.ACCOUNT_DEBIT.test(corePayload) || /\bdebited\b/i.test(corePayload)) {
    return { intent: 'ACCOUNT_DEBIT', isTransactional: true, confidence: 85 };
  }

  // Fallback check
  return { intent: 'UNKNOWN_NON_TRANSACTIONAL', isTransactional: false, confidence: 20, reason: 'No financial transaction indicator detected' };
}
