import { BadRequestException } from '@nestjs/common';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

export const isIciciCcCurrentLayout = (text: string) => {
  return /VIEW CURRENT STATEMENT|My Credit Card Details/i.test(text);
};

export const isIciciCcMonthlyLayout = (text: string) => {
  return /STATEMENT SUMMARY|CREDIT SUMMARY|IMPORTANT MESSAGES/i.test(text) && /ICICI/i.test(text);
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
          const endMatch = combined.match(/^(.*?)\s+([\d,]+\.?\d*)\s+(Dr|Cr)\.?(?:\s+(-?\d+))?(?:\s+(\d{6,20}))?\s*$/i);
          if (endMatch) {
            rowNumber++;
            const desc = endMatch[1].trim();
            const rawAmount = Number(endMatch[2].replace(/,/g, ''));
            const isDebit = endMatch[3].toUpperCase() === 'DR';
            const amountMinor = isDebit ? -Math.round(rawAmount * 100) : Math.round(rawAmount * 100);
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
        const monthlyMatch = line.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(?:(\d{8,20})\s+)?(.*?)\s+(?:(-?\d+)\s+)?([\d,]+\.\d{2})\s*(CR|DR)?$/i);
        if (monthlyMatch) {
          rowNumber++;
          const day = Number(monthlyMatch[1]);
          const month = Number(monthlyMatch[2]) - 1;
          const year = Number(monthlyMatch[3]);
          const date = new Date(Date.UTC(year, month, day));
          const refNo = monthlyMatch[4] || undefined;
          const desc = monthlyMatch[5].trim();
          const rawAmount = Number(monthlyMatch[7].replace(/,/g, ''));
          const isCredit = monthlyMatch[8] ? monthlyMatch[8].toUpperCase() === 'CR' : false;
          const amountMinor = isCredit ? Math.round(rawAmount * 100) : -Math.round(rawAmount * 100);
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
