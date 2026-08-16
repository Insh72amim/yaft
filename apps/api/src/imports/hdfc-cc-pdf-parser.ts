import { BadRequestException } from '@nestjs/common';
import {
  MONTH_NAME_TO_INDEX,
  CREDIT_CARD_PARSER_PATTERNS,
  parseMoneyToMinor,
  isCreditIndicator,
} from '@yaft/shared';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

export function fixHdfcText(raw: string): string {
  if (!raw) return '';
  let s = raw;
  // HDFC PDFs use \u0000 for word boundaries and \u0020 for tracking spaces between characters within words
  if (s.includes('\u0000')) {
    s = s.replace(/\u0000/g, ' ___ ');
    s = s.replace(/ /g, '');
    s = s.replace(/___/g, ' ');
  }
  s = s.replace(/\s+/g, ' ').trim();

  // Map PUA custom font characters to ASCII digits and punctuation
  s = s
    .replace(/\uE071/g, '0')
    .replace(/\uE072/g, '1')
    .replace(/\uE073/g, '2')
    .replace(/\uE074/g, '3')
    .replace(/\uE075/g, '4')
    .replace(/\uE076/g, '5')
    .replace(/\uE077/g, '6')
    .replace(/\uE078/g, '7')
    .replace(/\uE079/g, '8')
    .replace(/\uE07A/g, '9')
    .replace(/\uE094/g, '.')
    .replace(/\uE093/g, ',')
    .replace(/\uEE47/g, ':')
    .replace(/\uE095/g, ':');

  return s;
}

export const hdfcCcPdfParser: BankPdfParser = {
  id: 'HDFC',
  institutionAliases: ['HDFC', 'HDFC BANK', 'HDFC BANK CREDIT CARD', 'HDFC CREDIT CARD', 'HDFC_CC'],

  matches(document: PdfStatementDocument): boolean {
    const fullText = document.textPages
      .map((p) => p.text.split('\n').map(fixHdfcText).join(' '))
      .join(' ');

    return /HDFC/i.test(fullText) && (/CREDIT CARD|TOTAL AMOUNT DUE|DATE & TIME|TRANSACTION DESCRIPTION/i.test(fullText));
  },

  parse(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number } {
    const rows: ParsedRow[] = [];
    let closingBalanceMinor: number | undefined;
    let inTransactions = false;
    let globalRowIndex = 0;

    for (const page of document.textPages) {
      const lines = page.text.split('\n').map(fixHdfcText).filter(Boolean);

      for (const line of lines) {
        // Detect statement summary total if present
        if (!closingBalanceMinor) {
          const totalMatch = line.match(CREDIT_CARD_PARSER_PATTERNS.HDFC.TOTAL_AMOUNT_DUE_REGEX);
          if (totalMatch) {
            const parsed = parseMoneyToMinor(totalMatch[1]);
            if (parsed !== null) {
              closingBalanceMinor = parsed;
            }
          }
        }

        // Detect start of transaction table
        if (!inTransactions) {
          if (line.includes('DATE & TIME') || (line.includes('TRANSACTION DESCRIPTION') && line.includes('AMOUNT'))) {
            inTransactions = true;
          }
          continue;
        }

        // Match transaction row: DD MMM YYYY, HH:MM Description Amount [CR]
        // Example: "02 Jun 2026, 21:57 Blinkit ₹723.00" or "02 Jun 2026 Blinkit ₹723.00"
        const dateMatch = line.match(CREDIT_CARD_PARSER_PATTERNS.HDFC.ROW_REGEX);
        if (!dateMatch) {
          continue;
        }

        const day = parseInt(dateMatch[1], 10);
        const monthStr = dateMatch[2].toLowerCase();
        const year = parseInt(dateMatch[3], 10);
        const hour = dateMatch[4] ? parseInt(dateMatch[4], 10) : 0;
        const minute = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;

        const month = MONTH_NAME_TO_INDEX[monthStr];
        if (month === undefined) continue;

        const date = new Date(Date.UTC(year, month, day, hour, minute));

        let rawDesc = dateMatch[6].trim();
        // Clean out reward/cashpoint tokens like 36 or ₹ amounts embedded in desc
        rawDesc = rawDesc.replace(/[\uE000-\uFFFF]\d+/g, '').replace(/₹.*$/, '').trim();
        if (!rawDesc) continue;

        const parsedMinor = parseMoneyToMinor(dateMatch[7]);
        if (parsedMinor === null || parsedMinor === 0) continue;

        const isCredit = Boolean(dateMatch[8]) || isCreditIndicator(line);
        const amountMinor = isCredit ? Math.abs(parsedMinor) : -Math.abs(parsedMinor);

        globalRowIndex++;
        rows.push({
          date,
          description: rawDesc,
          amountMinor,
          rowNumber: globalRowIndex,
          dedupeKey: `hdfc-cc-${year}-${month + 1}-${day}-${rawDesc.toLowerCase().slice(0, 20)}-${amountMinor}`,
        });
      }
    }

    if (rows.length === 0) {
      throw new BadRequestException('No transaction rows were detected in this HDFC Credit Card statement.');
    }

    return { rows, closingBalanceMinor };
  },
};
