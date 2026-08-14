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

export function parseIndianDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  // Match DD-MM-YY or DD-MM-YYYY or DD/MM/YYYY
  const numMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numMatch) {
    let day = parseInt(numMatch[1], 10);
    let month = parseInt(numMatch[2], 10) - 1;
    let year = parseInt(numMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day));
  }

  // Match DD-Mon-YY or DDMonYY e.g., 14-Aug-26, 14Aug26
  const alphaMatch = dateStr.match(/^(\d{1,2})[-]?([a-zA-Z]{3})[-]?(\d{2,4})$/);
  if (alphaMatch) {
    let day = parseInt(alphaMatch[1], 10);
    let monthStr = alphaMatch[2].toLowerCase();
    let month = months[monthStr] !== undefined ? months[monthStr] : 0;
    let year = parseInt(alphaMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day));
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function parseEmailAlertSnippet(bodyText: string, senderOrSubject?: string): ParsedEmailTransaction | null {
  if (!bodyText || typeof bodyText !== 'string') return null;
  const text = bodyText.replace(/\s+/g, ' ').trim();
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

  // 2. Detect Debit vs Credit
  const isCredit = /credited|received|deposited|added/i.test(text) && !/debited/i.test(text);
  const type: 'DEBIT' | 'CREDIT' = isCredit ? 'CREDIT' : 'DEBIT';

  // 3. Extract Amount
  const amountMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;
  const rawAmountNum = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (isNaN(rawAmountNum) || rawAmountNum <= 0) return null;

  const rawMinor = BigInt(Math.round(rawAmountNum * 100));
  const amountMinor = type === 'DEBIT' ? -rawMinor : rawMinor;

  // 4. Extract Account / Card Last 4 Digits
  let accountLast4: string | undefined;
  const accMatch = text.match(/(?:a\/c|account|card|ending|xx+)\s*[*x-]*(\d{4})/i);
  if (accMatch) {
    accountLast4 = accMatch[1];
  }

  // 5. Extract Merchant / Payee
  let merchant = 'General Merchant';
  const upiMatch = text.match(/(?:to\s+(?:vpa\s+)?|vpa\s+)([a-zA-Z0-9._\-@&]{3,40})/i);
  if (upiMatch && !/^(vpa|account|a\/c|debited|credited|ref|bank)$/i.test(upiMatch[1].trim())) {
    merchant = upiMatch[1].replace(/@.*$/, '').replace(/[^a-zA-Z0-9\s]/g, ' ').trim().toUpperCase();
  } else {
    const atMatch = text.match(/(?:at|to|info:)\s+([A-Z0-9\s.\-_]{3,30})/i);
    if (atMatch && !/^(vpa|account|a\/c|debited|credited|ref|bank)$/i.test(atMatch[1].trim())) {
      merchant = atMatch[1].trim().toUpperCase();
    }
  }

  // Clean up merchant name prefix/suffixes
  merchant = merchant
    .replace(/^(VPA|UPI|VPS|POS|INF|NEFT|IMPS)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!merchant || merchant.length < 2 || /^(vpa|account|bank|ref)$/i.test(merchant)) {
    merchant = 'General Merchant';
  }

  // 6. Extract Reference / UTR Number
  let referenceNumber: string | undefined;
  const refMatch = text.match(/(?:ref|txn|utr|id)[:\s]*([a-zA-Z0-9]{8,20})/i);
  if (refMatch) {
    referenceNumber = refMatch[1];
  }

  // 7. Extract Date
  let transactionDate = new Date();
  const dateMatch = text.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}[-]?\w{3}[-]?\d{2,4})\b/i);
  if (dateMatch) {
    transactionDate = parseIndianDate(dateMatch[1]);
  }

  // 1.5 Detect Account Type (Credit Card vs Bank Account)
  const isCreditCard = /credit\s*card|creditcard|card\s*ending|credit\s*a\/c|amex|american express/i.test(fullContext);
  const accountType: 'CREDIT_CARD' | 'BANK' = isCreditCard ? 'CREDIT_CARD' : 'BANK';

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
    .split(/(?:\r?\n){2,}|(?=Dear Customer|Dear User|Rs\.|INR|₹)/i)
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

  return results;
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
