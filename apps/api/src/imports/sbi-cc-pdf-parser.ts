import { BadRequestException } from '@nestjs/common';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseSbiCcDate(day: string, mon: string, yr: string): Date {
  const month = MONTH_MAP[mon];
  if (month === undefined) throw new Error(`Unknown month: ${mon}`);
  // SBI uses 2-digit year (e.g. "26" = 2026)
  const year = 2000 + Number(yr);
  return new Date(Date.UTC(year, month, Number(day)));
}

export const isSbiCcLayout = (text: string): boolean => {
  // SBI CC statements always mention "SBI Card" and have a statement period line
  return /SBI\s*Card/i.test(text) && /Statement\s*Period/i.test(text);
};

export function parseSbiCcPdf(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number } {
  const fullText = document.textPages.map((p) => p.text).join('\n');

  if (!isSbiCcLayout(fullText)) {
    throw new BadRequestException('The uploaded PDF does not match a supported SBI Credit Card statement layout.');
  }

  const rows: ParsedRow[] = [];
  let rowNumber = 0;

  // Transaction line format (from PDF analysis):
  //   DD Mon YY <description> [<ref>] <amount> C|D
  //   e.g. "24 May 26 PAYMENT RECEIVED REF00000000000000000000 8.00 C"
  //   e.g. "31 May 26 BLINKIT GURGAON IND 850.00 D"
  //
  // The regex captures:
  //   group 1: day (2 digits)
  //   group 2: month (3 letters)
  //   group 3: year (2 digits)
  //   group 4: description (may include reference codes with alphanumeric chars)
  //   group 5: amount (digits with optional commas + decimal)
  //   group 6: C or D flag
  const TX_RE = /^(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2})\s+(.*?)\s+([\d,]+\.\d{2})\s+(C|D)\s*$/i;

  for (const page of document.textPages) {
    const lines = page.text.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      const m = line.match(TX_RE);
      if (!m) continue;

      const [, day, mon, yr, descAndRef, amountStr, flag] = m;

      let date: Date;
      try {
        date = parseSbiCcDate(day, mon, yr);
      } catch {
        continue;
      }

      const rawAmount = Number(amountStr.replace(/,/g, ''));
      const isCredit = flag.toUpperCase() === 'C';
      const amountMinor = isCredit ? Math.round(rawAmount * 100) : -Math.round(rawAmount * 100);

      // Extract reference: last token that is a long alphanumeric string (no spaces, ≥8 chars)
      // Reference codes in SBI look like: REF00000000000000000000
      const refMatch = descAndRef.match(/\s+([A-Z0-9]{8,})\s*$/i);
      let description = descAndRef;
      let reference: string | undefined;

      if (refMatch) {
        reference = refMatch[1];
        description = descAndRef.slice(0, descAndRef.lastIndexOf(refMatch[0])).trim();
      }

      description = description.replace(/\s+/g, ' ').trim();

      const dedupeKey = reference
        ? `sbi-cc:${reference}`
        : `sbi-cc:${date.toISOString().split('T')[0]}:${amountMinor}:${description.slice(0, 30)}`;

      rowNumber++;
      rows.push({
        date,
        description,
        amountMinor,
        reference,
        dedupeKey,
        rowNumber,
      });
    }
  }

  if (rows.length === 0) {
    throw new BadRequestException('No transaction rows were detected in this SBI Credit Card statement.');
  }

  return { rows };
}

export const sbiCcPdfParser: BankPdfParser = {
  id: 'SBI_CC',
  institutionAliases: ['SBI CREDIT CARD', 'SBI CARD', 'SBI CC', 'STATE BANK CREDIT CARD'],
  matches(document: PdfStatementDocument): boolean {
    const fullText = document.textPages.map((p) => p.text).join('\n');
    return isSbiCcLayout(fullText);
  },
  parse(document: PdfStatementDocument) {
    return parseSbiCcPdf(document);
  },
};
