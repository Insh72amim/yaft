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
  EXPLICIT_REFUND_ALERT_REGEX: /\b(?:refund\s+of|credited.*(?:refund|cashback|reversal)|refund\s+(?:has\s+been\s+)?(?:processed|credited|initiated)|cashback\s+credited|amount\s+refunded|refund\s+processed|towards\s+refund|refund\s+from|reversal\s+of|reversal\s+credit)\b/i,
};

export const CARD_PAYMENT_RECEIVED_REGEX = /\b(?:payment\s+received|received\s+payment|payment\s+of\s+(?:inr|rs\.?|₹)?\s*[\d,.]+\s+(?:on|towards|for)\s+your|thank\s+you\s+for\s+(?:your\s+)?payment|payment\s+towards\s+your\s+(?:credit\s*card|card|sbi\s*card|icici\s*bank\s*credit\s*card)|we\s+have\s+received\s+payment)\b/i;

export function isRefundOrReversal(description?: string | null): boolean {
  if (!description) return false;
  return REFUND_REVERSAL_CONFIG.REVERSAL_REGEX.test(description);
}

export function isExplicitSuccessfulRefund(text?: string | null): boolean {
  if (!text) return false;
  return REFUND_REVERSAL_CONFIG.EXPLICIT_REFUND_ALERT_REGEX.test(text);
}

export function isCardPaymentReceived(text?: string | null): boolean {
  if (!text) return false;
  return CARD_PAYMENT_RECEIVED_REGEX.test(text);
}

export interface BrandCanonicalRule {
  pattern: RegExp;
  canonical: string;
}

export const BRAND_CANONICAL_RULES: BrandCanonicalRule[] = [
  { pattern: /youtube/i, canonical: 'YouTube Google' },
  { pattern: /urbancompany|urban\s*company/i, canonical: 'Urban Company' },
  { pattern: /zomato/i, canonical: 'Zomato' },
  { pattern: /swiggy\s*instamart|instamart/i, canonical: 'Swiggy Instamart' },
  { pattern: /swiggy/i, canonical: 'Swiggy' },
  { pattern: /makemytrip|make\s*my\s*trip|\bmmt\b|mmtrip/i, canonical: 'MakeMyTrip' },
  { pattern: /amazon/i, canonical: 'Amazon' },
  { pattern: /zepto|ze\s*pto/i, canonical: 'Zepto' },
  { pattern: /blinkit/i, canonical: 'Blinkit' },
  { pattern: /bigbasket|big\s*basket|\bbb\s*now\b/i, canonical: 'BigBasket' },
  { pattern: /myntra/i, canonical: 'Myntra' },
  { pattern: /nykaa/i, canonical: 'Nykaa' },
  { pattern: /ajio/i, canonical: 'Ajio' },
  { pattern: /meesho/i, canonical: 'Meesho' },
  { pattern: /dunzo/i, canonical: 'Dunzo' },
  { pattern: /rapido/i, canonical: 'Rapido' },
  { pattern: /lenskart/i, canonical: 'Lenskart' },
  { pattern: /ola\b|olacabs/i, canonical: 'Ola' },
  { pattern: /uber/i, canonical: 'Uber' },
  { pattern: /airtel/i, canonical: 'Airtel' },
  { pattern: /flipkart/i, canonical: 'Flipkart' },
  { pattern: /\bop(?:en)?ai\b|chatgpt/i, canonical: 'OpenAI' },
  { pattern: /starbucks/i, canonical: 'Starbucks' },
  { pattern: /netflix/i, canonical: 'Netflix' },
  { pattern: /spotify/i, canonical: 'Spotify' },
  { pattern: /apple/i, canonical: 'Apple' },
  { pattern: /bookmyshow|book\s*my\s*show/i, canonical: 'BookMyShow' },
  { pattern: /irctc/i, canonical: 'IRCTC' },
  { pattern: /godaddy/i, canonical: 'GoDaddy' },
  { pattern: /jiomart|jio\b/i, canonical: 'Jio' },
  { pattern: /paytm/i, canonical: 'Paytm' },
  { pattern: /phonepe|phone\s*pe/i, canonical: 'PhonePe' },
  { pattern: /\bgpay\b|google\s*pay|googlepay/i, canonical: 'Google Pay' },
  { pattern: /razorpay/i, canonical: 'Razorpay' },
  { pattern: /\bcred\b/i, canonical: 'CRED' },
  { pattern: /payment\s*received/i, canonical: 'Payment Received' },
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

export const EMAIL_ALERT_PATTERNS = {
  BOILERPLATE_WARNINGS_REGEX: /(?:Trxn\.?\s*not\s*done\s*by\s*you|Safe\s*Banking\s*Tip|If\s*you\s*have\s*not\s*authorized|Report\s*at\s*https?:\/\/[^\s]+|Caution:\s*Be\s*Alert|Exclusive\s*offer\*?!|If (?:this )?transaction was not (?:done|initiated) by you|To block UPI|Please SMS BLOCK|We care about your security|Call us at:|Always open to help you|Warm Regards|This is an auto-generated (?:email|message)|Please do not reply to this (?:email|message)|For any queries,?\s*(?:please\s*)?contact|RBI Disclaimer|DICGC)[\s\S]*/i,

  EXPLICIT_CREDIT_CARD_REGEX: /credit\s*card|creditcard|pixel\s*play|card\s*ending|card\s*no\.?\s*(?:xx|\d)|card\s*xx\d|amazon\s*pay|card\s+4[xX]+|sbi\s*card/i,
  EXPLICIT_BANK_ACCOUNT_REGEX: /(?:debited\s+from|credited\s+to|transferred\s+from|transferred\s+to|deposited\s+in|received\s+in)\s+(?:your\s+)?(?:A\/c|account|savings\s*a\/c|bank\s*a\/c)|\bAccount\s*Number:\s*XX|\bA\/c\s*no\.?|\bA\/c\s*(?:is|was)?\s*(?:credited|debited)|\bA\/c\s*(?:ending\s+(?:with|in)\s+)?(?:XX|\*+|\d{4})|\bto\s+your\s+A\/c|\bfrom\s+account\s*[\*xX\d]+|\bsavings\s*a\/c|\bbank\s*a\/c/i,
  EXPLICIT_INVESTMENT_REGEX: /mutual\s*fund|sip\s*(?:debit|installment|transaction|amount)|folio\s*no\.?|units\s*allotted|nav\s*:\s*|camsonline|kfintech|mfcentral|zerodha\s*coin|groww\s*invest|amc\b|uti\s*mf|hdfc\s*mf|sbi\s*mf|icici\s*pru(?:dential)?\s*mf|axis\s*mf|mirae\s*asset|nippon\s*india|parag\s*parikh/i,

  CREDIT_TXN_REGEX: /credited|received|deposited|refund/i,
  DEBIT_TXN_REGEX: /debited|spent|used|charged|purchase|auto\s*debit|sip\s*debit|invested|\bdebit\b/i,

  LIMITS_NOISE_REGEX: /(?:available\s*(?:credit)?\s*limit|total\s*(?:credit)?\s*limit|credit\s*limit|total\s*due|total\s*outstanding|available\s*balance|bal\s*limit|available\s*a\/c\s*bal|clear\s*bal)\*?\s*(?:is|:)?\s*(?:rs\.?|inr|₹|&#8377;|&#x20b9;)?\s*[\d,]+(?:\.\d{1,2})?/gi,

  LABEL_AMOUNT_REGEX: /(?:transaction\s*amount|amount\s*debited|amount\s*credited|amount\s*invested|sip\s*amount|amount)\s*[:=]\s*(?:rs\.?|inr|₹|&#8377;|&#x20b9;)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  VERB_AMOUNT_REGEXES: [
    /(?:spent|debited|charged|used\s+for|purchase\s+of|transaction\s+(?:of|for|on)|refund\s+(?:of|worth|for|amount\s+of)?|cashback\s+(?:of|worth|for)?|reversal\s+(?:of|worth|for)?|payment\s+of|received\s+payment\s+of|amount\s+of|for\s+(?:an\s+amount\s+of\s+)?(?:inr|rs\.?|₹)|txn\s+of|noticed\s+a\s+transaction\s+of|auto\s*debit\s+of|mandate\s+of|si\s+debit\s+of|standing\s+instruction\s+of|transfer\s+of|credited\s+by|credited\s+with|sip\s+installment\s+of|sip\s+debit\s+of|sip\s+amount\s+of|invested\s+amount\s+of|purchase\s+of\s+units\s+worth|has\s+a\s+debit\s+by\s+[a-zA-Z0-9\s]+\s+of|has\s+a\s+debit\s+of|debit\s+by\s+[a-zA-Z0-9\s]+\s+of|debit\s+of)\s*(?:rs\.?|inr|₹|&#8377;|&#x20b9;)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:rs\.?|inr|₹|&#8377;|&#x20b9;)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has\s+been|was|is)?\s*(?:spent|debited|charged|used|paid|credited|transferred|processed|invested|refunded|received)/i,
    /^(?:.*?\b)?(?:inr|rs\.?|₹|&#8377;|&#x20b9;)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:spent|was\s+debited|debited|credited|processed|invested|refunded|received)/i,
    /(?:for|towards)\s+(?:inr|rs\.?|₹|&#8377;|&#x20b9;)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:credited|debited|spent|charged|paid|transferred|withdrawn|refunded)\s+(?:by|with|for)?\s*(?:rs\.?|inr|₹|&#8377;|&#x20b9;)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:NEFT|IMPS|RTGS|UPI|SIP)\s*(?:CR|DR)?\s*[:\s-]+\s*(?:inr|rs\.?|₹|&#8377;|&#x20b9;)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ],

  ACCOUNT_LAST4_REGEXES: [
    /(?:credit\s*card|account\s*number|a\/c\s*no\.?|a\/c|account|card)\s*(?:no\.?|is|:)?\s*(?:\d{4}\s*[xX*]+[\s*xX\d-]*|4[xX]+[\s*xX\d-]*|[xX*]{4,}[\s*xX\d-]*)\s*(\d{4})\b/i,
    /(?:ending\s+(?:with|in)|ending|ending\s+xx)\s*(?:XX|\*+)?(\d{4,8})\b/i,
    /(?:credit\s*card|account\s*number|a\/c\s*no\.?|a\/c|account|card)\s*(?:ending\s*(?:with|in)?|no\.?|is|:)?\s*(?:XX|\*+|4[xX]+)?(\d{4,8})\b/i,
    /\b(?:XX|\*+|4[xX]+)(\d{4,8})\b/i,
  ],

  REFERENCE_NUMBER_REGEXES: [
    /(?:ref\s*(?:no\.?|id)?|txn\s*(?:id|no\.?)?|utr|auth\s*code|reference\s*number|neft\s*ref(?:erence)?|imps\s*ref(?:erence)?)[:\s]*([a-zA-Z0-9]{6,22})/i,
    /UPI\/(?:P2A|P2M|P2P)\/(\d{8,18})\//i,
  ],

  MERCHANT_NAME_LABEL_REGEX: /(?:merchant\s*name|info|payee\s*name|beneficiary\s*name)[:\s]+([a-zA-Z0-9\s._\-&@]{2,50}?)(?=\s+(?:AutoPay|Auto\s*Pay|Axis|Date|Available|Total|The|Ref|Avail|Auth|Max|Card|To|Please|Mandate|\*|\.|$))/i,
  MERCHANT_TXN_INFO_REGEX: /transaction\s*info[:\s]+([a-zA-Z0-9\s._\-&@\/]{3,60}?)(?=\s+(?:If|To|Please|Available|Date|\.|$))/i,
  MERCHANT_TO_VPA_REGEX: /to\s+(?:VPA\s+)?(?!(?:your\s+)?(?:a\/c|account|bank|savings|card)\b)([a-zA-Z0-9._\-@&]{3,50})(?=\s+(?:on\s+\d|at\s+\d|\.|\bref\b|$))/i,
  MERCHANT_TOWARDS_REGEX: /towards\s+(?:refund\s+(?:from|for)\s+)?([a-zA-Z0-9\s._\-&@]{2,45}?)(?=\s+(?:at\s+\d|on\s+\d|\.|Bal|Total|Ref|via|$))/i,
  MERCHANT_FROM_REGEX: /from\s+(?!(?:your\s+)?(?:a\/c|account|bank|savings|card|credit\s*card)\b)([a-zA-Z0-9\s._\-&@]{2,45}?)(?=\s*[.]|\s+(?:\bNEFT|\bIMPS|\bRef|\bUPI|\bon\s+\d|\bat\s+\d|$))/i,
  MERCHANT_AT_REGEX: /\bat\s+(?!\d{1,2}:\d{2})(?!\d{1,2}[-/]\d{1,2})([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:on\s+\d|at\s+\d|\.|\binfo\b|\bavail|\btotal|\bref|\bcard|\ba\/c|\btrxn|\breport|$))/i,

  DATE_REGEX: /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}|\d{1,2}[-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s,]?\s*\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}-\d{2}-\d{2})\b/i,
  TIME_REGEXES: [
    /(?:at|time)[:\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:am|pm))?)/i,
    /,\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:IST)?/i,
    /\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:IST)?/i,
  ],
};

export function cleanEmailAlertText(bodyText: string): string {
  if (!bodyText) return '';
  let text = bodyText
    .replace(/&#8377;|&amp;#8377;|&#x20b9;/gi, '₹')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return text.replace(EMAIL_ALERT_PATTERNS.BOILERPLATE_WARNINGS_REGEX, '');
}

export function extractAlertAmount(text: string): number | null {
  const textWithoutLimits = text.replace(EMAIL_ALERT_PATTERNS.LIMITS_NOISE_REGEX, '');

  const labelMatch = textWithoutLimits.match(EMAIL_ALERT_PATTERNS.LABEL_AMOUNT_REGEX);
  if (labelMatch) {
    const parsed = parseFloat(labelMatch[1].replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  for (const regex of EMAIL_ALERT_PATTERNS.VERB_AMOUNT_REGEXES) {
    const verbMatch = textWithoutLimits.match(regex);
    if (verbMatch) {
      const parsed = parseFloat(verbMatch[1].replace(/,/g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  return null;
}

export function extractAlertAccountLast4(text: string): string | undefined {
  for (const pattern of EMAIL_ALERT_PATTERNS.ACCOUNT_LAST4_REGEXES) {
    const match = text.match(pattern);
    if (match) {
      const digits = match[1];
      return digits.length >= 4 ? digits.slice(-4) : digits;
    }
  }
  return undefined;
}

export function extractAlertReferenceNumber(text: string): string | undefined {
  for (const pattern of EMAIL_ALERT_PATTERNS.REFERENCE_NUMBER_REGEXES) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

export function extractAlertRawMerchant(text: string, senderOrSubject?: string): string {
  const merchantNameMatch = text.match(EMAIL_ALERT_PATTERNS.MERCHANT_NAME_LABEL_REGEX);
  if (merchantNameMatch) return merchantNameMatch[1].replace(/[.,\s\-_]+$/, '').trim();

  const txnInfoMatch = text.match(EMAIL_ALERT_PATTERNS.MERCHANT_TXN_INFO_REGEX);
  if (txnInfoMatch) return txnInfoMatch[1].replace(/[.,\s\-_]+$/, '').trim();

  const fromMatch = text.match(EMAIL_ALERT_PATTERNS.MERCHANT_FROM_REGEX);
  if (fromMatch && !/^(account|a\/c|your\s+a\/c|your\s+account|bank|credit\s*card|savings)$/i.test(fromMatch[1].trim())) {
    return fromMatch[1].replace(/[.,\s\-_]+$/, '').trim();
  }

  const toVpaMatch = text.match(EMAIL_ALERT_PATTERNS.MERCHANT_TO_VPA_REGEX);
  if (toVpaMatch && !/^(vpa|account|a\/c|your|debited|credited|ref|bank|savings|primary)$/i.test(toVpaMatch[1].trim())) {
    return toVpaMatch[1].replace(/[.,\s\-_]+$/, '').trim();
  }

  const towardsMatch = text.match(EMAIL_ALERT_PATTERNS.MERCHANT_TOWARDS_REGEX);
  if (towardsMatch) return towardsMatch[1].replace(/[.,\s\-_]+$/, '').trim();

  const atMatch = text.match(EMAIL_ALERT_PATTERNS.MERCHANT_AT_REGEX);
  if (atMatch) return atMatch[1].replace(/[.,\s\-_]+$/, '').trim();

  // Check for known brand names in text or sender/subject
  const combinedContext = `${text} ${senderOrSubject || ''}`;
  for (const rule of BRAND_CANONICAL_RULES) {
    if (rule.pattern.test(combinedContext)) {
      return rule.canonical;
    }
  }

  return 'General Merchant';
}

export function extractAlertDateTime(text: string): { dateStr?: string; timeStr?: string } {
  const dateMatch = text.match(EMAIL_ALERT_PATTERNS.DATE_REGEX);
  let timeStr: string | undefined;

  for (const pattern of EMAIL_ALERT_PATTERNS.TIME_REGEXES) {
    const timeMatch = text.match(pattern);
    if (timeMatch) {
      timeStr = timeMatch[1];
      break;
    }
  }

  return {
    dateStr: dateMatch ? dateMatch[1] : undefined,
    timeStr,
  };
}

// ---------------------------------------------------------------------------
// Common Normalization & Money Helpers
// ---------------------------------------------------------------------------

export function normalizeHeaderKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function parseMoneyToMinor(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value)
    .trim()
    .replace(/[₹,$\s%]/g, '')
    .replace(/,/g, '')
    .replace(/\((.*)\)/, '-$1');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export const DEBIT_CREDIT_INDICATORS = {
  CREDIT_VALUES: ['c', 'cr', 'credit', 'deposit', 'received', 'refund', 'payment'],
  DEBIT_VALUES: ['d', 'dr', 'debit', 'withdrawal', 'spent', 'purchase', 'charged'],
  CREDIT_REGEX: /\b(?:cr|credit|deposit|received|refund|payment)\b/i,
  DEBIT_REGEX: /\b(?:dr|debit|withdrawal|spent|purchase|charged)\b/i,
};

export function isCreditIndicator(indicator?: string | null): boolean {
  if (!indicator) return false;
  const clean = indicator.trim().toLowerCase().replace(/\.$/, '');
  return (
    DEBIT_CREDIT_INDICATORS.CREDIT_VALUES.includes(clean) ||
    DEBIT_CREDIT_INDICATORS.CREDIT_REGEX.test(indicator)
  );
}

export function isDebitIndicator(indicator?: string | null): boolean {
  if (!indicator) return false;
  const clean = indicator.trim().toLowerCase().replace(/\.$/, '');
  return (
    DEBIT_CREDIT_INDICATORS.DEBIT_VALUES.includes(clean) ||
    DEBIT_CREDIT_INDICATORS.DEBIT_REGEX.test(indicator)
  );
}

// ---------------------------------------------------------------------------
// Centralized Month Lookup & Common Date Matchers
// ---------------------------------------------------------------------------

export const MONTH_NAME_TO_INDEX: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export const COMMON_DATE_PATTERNS = {
  DD_MON_YY_REGEX: /^(\d{1,2})\s+([a-zA-Z]{3})\s+'?(\d{2})$/i,
  DD_MMM_YYYY_REGEX: /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:,\s*(\d{2}):(\d{2}))?/i,
  DD_MM_YYYY_SLASH_OR_DASH_REGEX: /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/,
  MON_YYYY_REGEX: /^([a-zA-Z]{3})[- ](\d{4})/i,
};

// ---------------------------------------------------------------------------
// Investment / Stock / Mutual Fund Parser Config
// ---------------------------------------------------------------------------

export const INVESTMENT_COLUMN_ALIASES = {
  schemeOrSymbol: ['scheme name', 'symbol', 'stock', 'instrument', 'asset', 'security'],
  isin: ['isin', 'isin code'],
  units: ['units', 'quantity', 'qty', 'shares', 'available quantity', 'quantity available'],
  investedValue: ['invested value', 'total cost', 'investment amount', 'buy value'],
  currentValue: ['current value', 'present value', 'market value'],
  returns: ['returns', 'unrealized p l', 'unrealized p&l', 'unrealised pnl', 'p&l', 'profit/loss'],
  averagePrice: ['average price', 'avg price', 'buy avg', 'avg cost'],
  previousClosingPrice: ['previous closing price', 'prev close'],
};

export function classifyInvestmentAssetType(
  sheetKind?: string,
  sector?: string,
  instrumentType?: string
): 'STOCK' | 'MUTUAL_FUND' | 'ETF' | 'OTHER' {
  const desc = normalizeHeaderKey(`${sector ?? ''} ${instrumentType ?? ''}`);
  const sheet = normalizeHeaderKey(sheetKind ?? '');

  if (desc.includes('exchange traded fund') || /(^| )etf( |$)/.test(desc)) return 'ETF';
  if (sheet === 'mutual funds' || desc.includes('mutual fund')) return 'MUTUAL_FUND';
  if (sheet === 'equity') return 'STOCK';
  return 'OTHER';
}

// ---------------------------------------------------------------------------
// EPFO Passbook Parser Config
// ---------------------------------------------------------------------------

export const EPFO_PASSBOOK_PATTERNS = {
  PASSBOOK_LAYOUT_REGEX: /EPF Passbook|Member Passbook|lnL; iklcqd/i,
  CLOSING_BALANCE_REGEX: /Closing Balance as on\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/i,
  CONTRIBUTION_ROW_REGEX: /^([a-zA-Z]{3}-\d{4})\s+(\d{2}-\d{2}-\d{4})\s+(CR|DR)\s+(.*?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$/,
  INTEREST_ROW_REGEX: /^(Int\.\s+Updated\s+upto\s+(\d{2}\/\d{2}\/\d{4}))\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$/i,
};

// ---------------------------------------------------------------------------
// Cross-Source Transaction Deduplication Helper
// ---------------------------------------------------------------------------

export interface ExistingTxSummary {
  fingerprint?: string;
  reference?: string | null;
  amount: bigint | number;
  transactionDate: Date;
  merchant?: string | null;
  descriptionRaw?: string | null;
}

export function isDuplicateTransaction(
  existingTxns: ExistingTxSummary[],
  existingFingerprints: Set<string>,
  rowAmountMinor: bigint | number,
  rowDate: Date,
  rowReference?: string | null,
  rowDescriptionOrMerchant?: string | null,
  rowFingerprint?: string | null,
): boolean {
  if (rowFingerprint && existingFingerprints.has(rowFingerprint)) return true;

  const targetAmountMinor = typeof rowAmountMinor === 'bigint' ? rowAmountMinor : BigInt(Math.round(rowAmountMinor));
  const rowCanonical = rowDescriptionOrMerchant ? canonicalizeMerchantName(rowDescriptionOrMerchant) : null;
  const rowCleanRef = rowReference?.trim().toLowerCase();
  const rowDescAlphaNum = rowDescriptionOrMerchant?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? null;

  for (const tx of existingTxns) {
    const txAmountMinor = typeof tx.amount === 'bigint' ? tx.amount : BigInt(Math.round(tx.amount));
    if (txAmountMinor !== targetAmountMinor) continue;

    // 1. Exact reference number match
    if (rowCleanRef && tx.reference) {
      const txCleanRef = tx.reference.trim().toLowerCase();
      if (rowCleanRef === txCleanRef) {
        return true;
      }
    }

    // 2. Cross-format reference match: reference embedded in the other side's descriptionRaw
    if (rowCleanRef && rowCleanRef.length >= 6 && tx.descriptionRaw) {
      const txDescAlpha = tx.descriptionRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const refAlpha = rowCleanRef.replace(/[^a-z0-9]/g, '');
      if (refAlpha.length >= 6 && txDescAlpha.includes(refAlpha)) {
        return true;
      }
    }
    if (tx.reference && tx.reference.trim().length >= 6 && rowDescAlphaNum) {
      const txRefAlpha = tx.reference.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (txRefAlpha.length >= 6 && rowDescAlphaNum.includes(txRefAlpha)) {
        return true;
      }
    }

    // 3. Date proximity (within 2.5 days) + matching canonical merchant / description
    const txTime = tx.transactionDate instanceof Date ? tx.transactionDate.getTime() : new Date(tx.transactionDate).getTime();
    const rowTime = rowDate instanceof Date ? rowDate.getTime() : new Date(rowDate).getTime();
    const diffDays = Math.abs(rowTime - txTime) / 86_400_000;

    if (diffDays <= 2.5) {
      if (rowCanonical && tx.merchant && rowCanonical !== 'General Merchant') {
        const txCanonical = canonicalizeMerchantName(tx.merchant);
        if (rowCanonical === txCanonical || rowCanonical === tx.merchant.toUpperCase()) {
          return true;
        }
      }
      if (rowDescriptionOrMerchant && tx.descriptionRaw) {
        const d1 = rowDescAlphaNum!;
        const d2 = tx.descriptionRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (d1.length >= 4 && (d1.includes(d2) || d2.includes(d1))) {
          return true;
        }
      }
    }

    // 4. Same-day + "General Merchant" cross-source dedup
    //    If either side canonicalizes to "General Merchant" (vague bank narration like
    //    NEFT/IMPS/UPI self-transfers) and dates are within 1 day, treat as duplicate.
    //    This catches cross-source dupes where email alert has a real merchant name
    //    but the bank statement description is too generic to match.
    if (diffDays <= 1) {
      const txCanonical = tx.merchant ? canonicalizeMerchantName(tx.merchant) : 'General Merchant';
      const eitherGeneral = rowCanonical === 'General Merchant' || txCanonical === 'General Merchant';
      if (eitherGeneral) {
        return true;
      }
    }
  }

  return false;
}
