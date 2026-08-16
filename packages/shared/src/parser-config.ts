/**
 * Centralized, declarative Parser Configuration Registry.
 * Single source of truth for statement column aliases, transaction status identifiers,
 * refund/reversal patterns, merchant canonicalization, and parsing rules.
 */

export interface StatementColumnAliases {
  date: string[];
  description: string[];
  amount: string[];
  debit: string[];
  credit: string[];
  reference: string[];
  status: string[];
}

export const STATEMENT_COLUMN_ALIASES: StatementColumnAliases = {
  date: ['date', 'transaction date', 'txn date', 'value date', 'posted date', 'posting date', 'txn_date', 'trans date'],
  description: ['description', 'narration', 'transaction details', 'particulars', 'remarks', 'merchant', 'details', 'trans details'],
  amount: ['amount', 'transaction amount', 'txn amount', 'total amount'],
  debit: ['debit', 'withdrawal', 'withdrawal amt.', 'debit amount', 'dr amount', 'dr amt'],
  credit: ['credit', 'deposit', 'deposit amt.', 'credit amount', 'cr amount', 'cr amt'],
  reference: ['reference', 'reference number', 'ref no', 'chq./ref.no.', 'transaction id', 'txn id', 'cheque no', 'utr'],
  status: ['status', 'transaction status', 'txn status', 'payment status', 'state', 'result'],
};

export const TRANSACTION_STATUS_CONFIG = {
  FAILED_STATUS_VALUES: [
    'failed',
    'declined',
    'rejected',
    'cancelled',
    'canceled',
    'unsuccessful',
    'failure',
    'pending',
    'timed out',
    'timed_out',
    'declined/failed',
  ],
  DECLINED_DESCRIPTION_REGEX: /\b(?:txn\s+declined|transaction\s+declined|payment\s+declined|payment\s+failed|txn\s+failed|transaction\s+failed|payment\s+unsuccessful|transaction\s+unsuccessful|unsuccessful\s+transaction|auto\s+reversed|auto\s+reversal|card\s+declined|declined\s+transaction|failed\s+transaction|charge\s+declined|could\s+not\s+be\s+processed|unable\s+to\s+process|was\s+not\s+completed|payment\s+timed\s*out|transaction\s+timed\s*out)\b/i,
  EMAIL_FAILURE_REGEX: /\b(?:declined|unsuccessful|failed|rejected|cancelled|canceled|not\s+successful|payment\s+failed|txn\s+failed|transaction\s+failed|payment\s+declined|txn\s+declined|transaction\s+declined|could\s+not\s+be\s+processed|unable\s+to\s+process|was\s+not\s+completed|auto-reversed|auto\s+reversal|payment\s+timed\s*out|transaction\s+timed\s*out)\b/i,
};

export function isDeclinedOrFailedStatus(status?: string | null): boolean {
  if (!status) return false;
  const clean = status.trim().toLowerCase();
  return TRANSACTION_STATUS_CONFIG.FAILED_STATUS_VALUES.includes(clean);
}

export function isDeclinedOrFailedDescription(description?: string | null): boolean {
  if (!description) return false;
  return TRANSACTION_STATUS_CONFIG.DECLINED_DESCRIPTION_REGEX.test(description);
}

export function isDeclinedOrFailedTransaction(description?: string | null, status?: string | null): boolean {
  return isDeclinedOrFailedStatus(status) || isDeclinedOrFailedDescription(description);
}

export const REFUND_REVERSAL_CONFIG = {
  REVERSAL_REGEX: /refund|reversal|returned|cashback|cb\s|credit\s*adj|cancelled|canceled/i,
  EXPLICIT_REFUND_ALERT_REGEX: /\b(?:refund\s+of|credited\s+with\s+refund|refund\s+has\s+been\s+processed|cashback\s+credited)\b/i,
};

export function isRefundOrReversal(description?: string | null): boolean {
  if (!description) return false;
  return REFUND_REVERSAL_CONFIG.REVERSAL_REGEX.test(description);
}

export function isExplicitSuccessfulRefund(text?: string | null): boolean {
  if (!text) return false;
  return REFUND_REVERSAL_CONFIG.EXPLICIT_REFUND_ALERT_REGEX.test(text);
}

export interface BrandCanonicalRule {
  pattern: RegExp;
  canonical: string;
}

export const BRAND_CANONICAL_RULES: BrandCanonicalRule[] = [
  { pattern: /youtube/i, canonical: 'YouTube Google' },
  { pattern: /urbancompany/i, canonical: 'Urban Company' },
  { pattern: /zomato/i, canonical: 'Zomato' },
  { pattern: /swiggy/i, canonical: 'Swiggy' },
  { pattern: /makemytrip/i, canonical: 'MakeMyTrip' },
  { pattern: /amazon/i, canonical: 'Amazon' },
  { pattern: /zepto|ze\s*pto/i, canonical: 'Zepto' },
  { pattern: /blinkit/i, canonical: 'Blinkit' },
  { pattern: /airtel/i, canonical: 'Airtel' },
  { pattern: /flipkart/i, canonical: 'Flipkart' },
  { pattern: /uber/i, canonical: 'Uber' },
  { pattern: /\bop(?:en)?ai\b|chatgpt/i, canonical: 'OpenAI' },
  { pattern: /starbucks/i, canonical: 'Starbucks' },
  { pattern: /netflix/i, canonical: 'Netflix' },
  { pattern: /spotify/i, canonical: 'Spotify' },
  { pattern: /apple/i, canonical: 'Apple' },
];

export function cleanBeneficiaryToken(token: string): string {
  if (!token) return '';
  return token
    .replace(/\[.*?\]/g, '')
    .replace(/\b(?:PVT|LTD|LT|LIMITED|PRIVATE|INDIA|CORP|LLP|INC)\b/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[.,\s\-_]+$/, '')
    .replace(/^[.,\s\-_]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalizeMerchantName(raw: string): string {
  if (!raw) return 'General Merchant';

  let s = raw.trim();

  // 1. If it's a UPI VPA e.g. "paytm-urbancompany@ptybl", "payzomato@hdfcbank", "airtel-billpayment.paytm@ptybl"
  if (s.includes('@')) {
    s = s.replace(/@[a-zA-Z0-9.-]+$/, '');
    s = s.replace(/^paytm[-.]?/i, '');
    s = s.replace(/^pay[-.]?/i, '');
    s = s.replace(/^ibkpos\.[a-z0-9]+[-.]?/i, '');
    s = s.replace(/^upi[-.]?/i, '');
  }

  // 2. If it's a POS / PUR / UPI path e.g. "PUR/YOUTUBEGOOGLE/YOUTUBEGOOGLE/123456" or "UPI/P2A/100000000005/MERCHANT_ONE"
  if (s.includes('/')) {
    const parts = s.split('/').filter((p) => p && !/^\d+$/.test(p) && !/^(PUR|POS|UPI|P2A|P2M|P2P|INF|NEFT|IMPS)$/i.test(p));
    if (parts.length > 0) {
      s = parts[0];
    }
  }

  // 3. Known cleanups and brand canonicalization
  s = s
    .replace(/^(VPA|UPI|VPS|POS|INF|NEFT|IMPS|PUR)\s*[\/:\*]?\s*/i, '')
    .replace(/^(?:PVT\s*LTD|PVT\s*LT|LTD|LIMITED|SERVICES|INDIA)$/i, '')
    .replace(/\b(?:PVT\s*LTD|PVT\s*LT|PRIVATE\s*LIMITED|INDIA\s*PVT\s*LTD)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const rule of BRAND_CANONICAL_RULES) {
    if (rule.pattern.test(s)) {
      s = rule.canonical;
      break;
    }
  }

  s = s
    .replace(/[.,\s\-_]+$/, '')
    .replace(/^[.,\s\-_]+/, '')
    .trim()
    .toUpperCase();

  if (!s || s.length < 2 || /^(VPA|ACCOUNT|A\/C|BANK|REF|TRANSACTION|PURCHASE|CUSTOMER|SUPPORT|HELP|ORM)$/i.test(s)) {
    return 'General Merchant';
  }

  return s;
}
