import { BadRequestException } from '@nestjs/common';
import {
  CREDIT_CARD_PARSER_PATTERNS,
  parseMoneyToMinor,
  isDebitIndicator,
  isCreditIndicator,
} from '@yaft/shared';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

export const isIciciCcCurrentLayout = (text: string) => {
  return CREDIT_CARD_PARSER_PATTERNS.ICICI.CURRENT_LAYOUT_REGEX.test(text);
};

export const isIciciCcMonthlyLayout = (text: string) => {
  return CREDIT_CARD_PARSER_PATTERNS.ICICI.MONTHLY_LAYOUT_REGEX.test(text) && /ICICI/i.test(text);
};

export function parseIciciPdf(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number } {
  const fullText = document.textPages.map((p) => p.text).join('\n');
  const isCurrent = isIciciCcCurrentLayout(fullText);
  const isMonthly = isIciciCcMonthlyLayout(fullText);

  if (!isCurrent && !isMonthly) {
    throw new BadRequestException('The uploaded PDF does not match a supported ICICI Credit Card statement layout.');
  }

  const rows: ParsedRow[] = [];
  let rowNumber = 0;

  if (isCurrent) {
    let currentDate: Date | null = null;
    let detailsParts: string[] = [];

    for (const page of document.textPages) {
      const lines = page.text.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const dateStartMatch = line.match(/^(\d{2})-(\d{2})-(\d{4})\s*(.*)$/);
        if (dateStartMatch) {
          currentDate = new Date(Date.UTC(Number(dateStartMatch[3]), Number(dateStartMatch[2]) - 1, Number(dateStartMatch[1])));
          detailsParts = [dateStartMatch[4]];
        } else if (currentDate) {
          detailsParts.push(line);
        }

        if (currentDate && detailsParts.length > 0) {
          const combined = detailsParts.join(' ');
          const endMatch = combined.match(CREDIT_CARD_PARSER_PATTERNS.ICICI.CURRENT_ROW_END_REGEX);
          if (endMatch) {
            rowNumber++;
            const desc = endMatch[1].trim();
            const parsedMinor = parseMoneyToMinor(endMatch[2]);
            if (parsedMinor !== null) {
              const isDebit = isDebitIndicator(endMatch[3]);
              const amountMinor = isDebit ? -Math.abs(parsedMinor) : Math.abs(parsedMinor);
              const refNo = endMatch[5] || undefined;
              const dedupeKey = refNo
                ? `icici-cc:${refNo}`
                : `icici-cc:${currentDate.toISOString().split('T')[0]}:${amountMinor}:${desc.slice(0, 30)}`;

              rows.push({
                date: currentDate,
                description: desc,
                amountMinor,
                reference: refNo,
                dedupeKey,
                rowNumber,
              });
            }

            currentDate = null;
            detailsParts = [];
          }
        }
      }
    }
  } else if (isMonthly) {
    for (const page of document.textPages) {
      const lines = page.text.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const monthlyMatch = line.match(CREDIT_CARD_PARSER_PATTERNS.ICICI.MONTHLY_ROW_REGEX);
        if (monthlyMatch) {
          rowNumber++;
          const day = Number(monthlyMatch[1]);
          const month = Number(monthlyMatch[2]) - 1;
          const year = Number(monthlyMatch[3]);
          const date = new Date(Date.UTC(year, month, day));
          const refNo = monthlyMatch[4] || undefined;
          const desc = monthlyMatch[5].trim();
          const parsedMinor = parseMoneyToMinor(monthlyMatch[7]);
          if (parsedMinor !== null) {
            const isCredit = monthlyMatch[8] ? isCreditIndicator(monthlyMatch[8]) : false;
            const amountMinor = isCredit ? Math.abs(parsedMinor) : -Math.abs(parsedMinor);
            const dedupeKey = refNo
              ? `icici-cc:${refNo}`
              : `icici-cc:${date.toISOString().split('T')[0]}:${amountMinor}:${desc.slice(0, 30)}`;

            rows.push({
              date,
              description: desc,
              amountMinor,
              reference: refNo,
              dedupeKey,
              rowNumber,
            });
          }
        }
      }
    }
  }

  if (rows.length === 0) {
    throw new BadRequestException('No transaction rows were detected in this ICICI Credit Card statement.');
  }

  return { rows };
}

export const iciciPdfParser: BankPdfParser = {
  id: 'ICICI',
  institutionAliases: ['ICICI', 'ICICI BANK', 'ICICI BANK CREDIT CARD'],

  matches(document: PdfStatementDocument): boolean {
    const fullText = document.textPages.map((p) => p.text).join('\n');
    return isIciciCcCurrentLayout(fullText) || isIciciCcMonthlyLayout(fullText);
  },
  parse(document: PdfStatementDocument) {
    return parseIciciPdf(document);
  },
};
