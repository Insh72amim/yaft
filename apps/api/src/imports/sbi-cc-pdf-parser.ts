import { BadRequestException } from '@nestjs/common';
import {
  MONTH_NAME_TO_INDEX,
  CREDIT_CARD_PARSER_PATTERNS,
  parseMoneyToMinor,
  isCreditIndicator,
} from '@yaft/shared';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

function parseSbiCcDate(day: string, mon: string, yr: string): Date {
  const month = MONTH_NAME_TO_INDEX[mon.toLowerCase()];
  if (month === undefined) throw new Error(`Unknown month: ${mon}`);
  // SBI uses 2-digit year (e.g. "26" = 2026)
  const year = 2000 + Number(yr);
  return new Date(Date.UTC(year, month, Number(day)));
}

export const isSbiCcLayout = (text: string): boolean => {
  // SBI CC statements always mention "SBI Card" and have a statement period line
  return (
    CREDIT_CARD_PARSER_PATTERNS.SBI.LAYOUT_REGEX.test(text) &&
    CREDIT_CARD_PARSER_PATTERNS.SBI.PERIOD_REGEX.test(text)
  );
};

export function parseSbiCcPdf(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number } {
  const fullText = document.textPages.map((p) => p.text).join('\n');

  if (!isSbiCcLayout(fullText)) {
    throw new BadRequestException('The uploaded PDF does not match a supported SBI Credit Card statement layout.');
  }

  const rows: ParsedRow[] = [];
  let rowNumber = 0;

  for (const page of document.textPages) {
    const lines = page.text.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      const m = line.match(CREDIT_CARD_PARSER_PATTERNS.SBI.ROW_REGEX);
      if (!m) continue;

      const [, day, mon, yr, descAndRef, amountStr, flag] = m;

      let date: Date;
      try {
        date = parseSbiCcDate(day, mon, yr);
      } catch {
        continue;
      }

      const parsedMinor = parseMoneyToMinor(amountStr);
      if (parsedMinor === null) continue;

      const isCredit = isCreditIndicator(flag);
      const amountMinor = isCredit ? Math.abs(parsedMinor) : -Math.abs(parsedMinor);

      // Extract reference: last token that is a long alphanumeric string (no spaces, ≥8 chars)
      // Reference codes in SBI look like: REF00000000000000000000
      const refMatch = descAndRef.match(CREDIT_CARD_PARSER_PATTERNS.SBI.REFERENCE_REGEX);
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
