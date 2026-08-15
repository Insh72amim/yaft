import { createHash } from 'crypto';

export interface ParsedEmailTransaction {
  bankName: string;
  accountLast4?: string;
  accountType: 'CREDIT_CARD' | 'BANK';
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

export function parseIndianDate(dateStr: string, timeStr?: string): Date {
  if (!dateStr) return new Date();
  const months: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
    aug: 7, august: 7, sep: 8, sept: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  };

  let hours = 0, minutes = 0, seconds = 0;
  if (timeStr) {
    const tMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(am|pm))?/i);
    if (tMatch) {
      hours = parseInt(tMatch[1], 10);
      minutes = parseInt(tMatch[2], 10);
      if (tMatch[3]) seconds = parseInt(tMatch[3], 10);
      if (tMatch[4]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (tMatch[4]?.toLowerCase() === 'am' && hours === 12) hours = 0;
    }
  }

  const cleanDate = dateStr.trim();

  // 1. Match Month DD, YYYY e.g. "Aug 09, 2026", "August 9 2026", "Aug 11, 2026"
  const monthFirstMatch = cleanDate.match(/^([a-zA-Z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (monthFirstMatch) {
    const month = months[monthFirstMatch[1].toLowerCase()] ?? 0;
    const day = parseInt(monthFirstMatch[2], 10);
    let year = parseInt(monthFirstMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  // 2. Match DD-Mon-YYYY or DD Mon YYYY e.g. "09-Aug-2026", "09 Aug 2026", "14Aug26"
  const alphaMatch = cleanDate.match(/^(\d{1,2})[-\s]?([a-zA-Z]{3,9})[-\s,]?(\d{2,4})$/);
  if (alphaMatch) {
    const day = parseInt(alphaMatch[1], 10);
    const month = months[alphaMatch[2].toLowerCase()] ?? 0;
    let year = parseInt(alphaMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  // 3. Match DD-MM-YY or DD-MM-YYYY or DD/MM/YYYY or DD/MM/YY e.g. "15/08/26", "14-08-2026"
  const numMatch = cleanDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10) - 1;
    let year = parseInt(numMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  // 4. Match YYYY-MM-DD
  const isoMatch = cleanDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  const parsed = new Date(cleanDate);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function cleanMerchantName(raw: string): string {
  if (!raw) return 'General Merchant';

  let s = raw.trim();

  // 1. If it's a UPI VPA e.g. "paytm-urbancompany@ptybl", "payzomato@hdfcbank", "airtel-billpayment.paytm@ptybl"
  if (s.includes('@')) {
    s = s.replace(/@[a-zA-Z0-9.-]+$/, ''); // remove handle
    s = s.replace(/^paytm[-.]?/i, '');
    s = s.replace(/^pay[-.]?/i, '');
    s = s.replace(/^ibkpos\.[a-z0-9]+[-.]?/i, '');
    s = s.replace(/^upi[-.]?/i, '');
  }

  // 2. If it's a POS / PUR / UPI path e.g. "PUR/YOUTUBEGOOGLE/YOUTUBEGOOGLE/123456" or "UPI/P2A/100000000005/MERCHANT_ONE"
  if (s.includes('/')) {
    const parts = s.split('/').filter(p => p && !/^\d+$/.test(p) && !/^(PUR|POS|UPI|P2A|P2M|P2P|INF|NEFT|IMPS)$/i.test(p));
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

  if (/youtube/i.test(s)) s = 'YouTube Google';
  else if (/urbancompany/i.test(s)) s = 'Urban Company';
  else if (/zomato/i.test(s)) s = 'Zomato';
  else if (/swiggy/i.test(s)) s = 'Swiggy';
  else if (/makemytrip/i.test(s)) s = 'MakeMyTrip';
  else if (/amazon/i.test(s)) s = 'Amazon';
  else if (/zepto|ze\s*pto/i.test(s)) s = 'Zepto';
  else if (/blinkit/i.test(s)) s = 'Blinkit';
  else if (/airtel/i.test(s)) s = 'Airtel';

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

export function parseEmailAlertSnippet(bodyText: string, senderOrSubject?: string): ParsedEmailTransaction | null {
  if (!bodyText || typeof bodyText !== 'string') return null;

  // Pre-clean boilerplate warnings and footers so they don't corrupt merchant or account extraction
  let text = bodyText.replace(/\s+/g, ' ').trim();
  text = text.replace(/(?:If (?:this )?transaction was not (?:done|initiated) by you|To block UPI|Please SMS BLOCK|We care about your security|Call us at:|Always open to help you|Warm Regards)[\s\S]*/i, '');

  const fullContext = `${senderOrSubject || ''} ${text}`;

  // 1. Detect Bank Name
  let bankName = 'Bank Alert';
  if (/hdfc/i.test(fullContext)) bankName = 'HDFC Bank';
  else if (/icici/i.test(fullContext)) bankName = 'ICICI Bank';
  else if (/sbi|state bank/i.test(fullContext)) bankName = 'State Bank of India';
  else if (/axis/i.test(fullContext)) bankName = 'Axis Bank';
  else if (/pnb|punjab national/i.test(fullContext)) bankName = 'Punjab National Bank';
  else if (/kotak/i.test(fullContext)) bankName = 'Kotak Mahindra Bank';
  else if (/amex|american express/i.test(fullContext)) bankName = 'American Express';
  else if (/indusind/i.test(fullContext)) bankName = 'IndusInd Bank';
  else if (/idfc/i.test(fullContext)) bankName = 'IDFC First Bank';
  else if (/rbl/i.test(fullContext)) bankName = 'RBL Bank';
  else if (/yes bank/i.test(fullContext)) bankName = 'Yes Bank';
  else if (/standard chartered|scb/i.test(fullContext)) bankName = 'Standard Chartered';
  else if (/citi/i.test(fullContext)) bankName = 'Citi';

  // 2. Detect Account Type (Credit Card vs Bank Account)
  const isExplicitCreditCard = /credit\s*card|creditcard|pixel\s*play|card\s*ending|card\s*no\.?\s*(?:xx|\d)|card\s*xx\d|amazon\s*pay|card\s+4[xX]+/i.test(fullContext);
  const isExplicitBankAccount = /(?:debited\s+from\s+your\s+A\/c|debited\s+from\s+A\/c|Account\s*Number:\s*XX|from\s+account\s*[\*xX\d]+|savings\s*a\/c|bank\s*a\/c)/i.test(text);

  let accountType: 'CREDIT_CARD' | 'BANK' = isExplicitCreditCard && !isExplicitBankAccount ? 'CREDIT_CARD' : isExplicitBankAccount ? 'BANK' : isExplicitCreditCard ? 'CREDIT_CARD' : 'BANK';

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

  if (isNaN(rawAmountNum) || rawAmountNum <= 0 || rawAmountNum > 10_000_000) return null;

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

  const merchant = cleanMerchantName(rawMerchant);

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

