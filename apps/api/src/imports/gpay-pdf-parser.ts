import { BadRequestException } from '@nestjs/common';
import { isDeclinedOrFailedTransaction } from '@yaft/shared';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

export function parseGPayDate(dateStr: string, timeStr: string): Date {
  const combined = `${dateStr.trim()} ${timeStr.trim()}`;
  const date = new Date(combined);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date/time format: ${combined}`);
  }
  return date;
}

export function parseGpayDocument(document: PdfStatementDocument): { rows: ParsedRow[] } {
  const fullText = document.textPages.map((p) => p.text).join('\n');

  if (!fullText.includes('UPI Transaction ID') && !fullText.toLowerCase().includes('google pay')) {
    throw new BadRequestException('The selected PDF does not appear to be a valid Google Pay statement.');
  }

  // Regex matching GPay transaction blocks
  const txRegex = /(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})\s*\n\s*(\d{1,2}:\d{2}\s+(?:AM|PM))\s*\n\s*([^\n]+)\s*\n\s*UPI Transaction ID:\s*(\d{10,18})\s*\n\s*([^\n]+)\s*\n\s*₹\s*([\d,]+(?:\.\d{1,2})?)/gi;

  const rows: ParsedRow[] = [];
  let match: RegExpExecArray | null;
  let rowNumber = 1;

  while ((match = txRegex.exec(fullText)) !== null) {
    const [, dateStr, timeStr, rawDescription, refNo, paymentMethodRaw, amountStr] = match;

    const descTrim = rawDescription.trim();
    const paymentMethod = paymentMethodRaw.trim();

    // Skip failed / declined / cancelled transactions
    if (isDeclinedOrFailedTransaction(descTrim, paymentMethod) || isDeclinedOrFailedTransaction(paymentMethod)) {
      continue;
    }

    const date = parseGPayDate(dateStr, timeStr);
    const amountVal = parseFloat(amountStr.replace(/,/g, ''));
    const isCredit = /^Received\s+from|^Refund\s+from/i.test(descTrim);
    const amountMinor = Math.round((isCredit ? amountVal : -amountVal) * 100);

    const isUpiLite = /UPI\s+Lite/i.test(paymentMethod);

    rows.push({
      date,
      postedDate: date,
      description: rawDescription.trim(),
      amountMinor,
      reference: refNo.trim(),
      dedupeKey: `gpay_${refNo.trim()}`,
      rowNumber: rowNumber++,
      paymentMethod,
      isUpiLite,
    });
  }

  if (rows.length === 0) {
    throw new BadRequestException('No transaction entries could be extracted from this Google Pay statement.');
  }

  return { rows };
}

export const gpayPdfParser: BankPdfParser = {
  id: 'GPAY',
  institutionAliases: ['GOOGLE PAY', 'GPAY', 'G PAY', 'GOOGLE PAY STATEMENT'],
  matches(document: PdfStatementDocument): boolean {
    const fullText = document.textPages.map((p) => p.text).join('\n');
    return fullText.includes('UPI Transaction ID') && (fullText.toLowerCase().includes('google pay') || fullText.includes('Paid by'));
  },
  parse(document: PdfStatementDocument) {
    return parseGpayDocument(document);
  },
};
