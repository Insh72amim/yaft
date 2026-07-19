import { BadRequestException } from '@nestjs/common';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

function parseIndianNumber(text: string): number {
  const cleaned = text.replace(/,/g, '').trim();
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function isEpfoPassbook(document: PdfStatementDocument): boolean {
  const fullText = document.textPages.map(p => p.text).join('\n');
  return /EPF Passbook|Member Passbook|lnL; iklcqd/i.test(fullText);
}

export const epfoPdfParser: BankPdfParser = {
  id: 'EPFO',
  institutionAliases: ['EPFO', 'EPFO India', 'Employees Provident Fund Organisation'],

  matches(document: PdfStatementDocument): boolean {
    return isEpfoPassbook(document);
  },

  parse(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number } {
    const fullText = document.textPages.map(p => p.text).join('\n');

    if (!this.matches(document)) {
      throw new BadRequestException('This PDF does not appear to be an EPFO passbook.');
    }

    // Extract closing balance: "Closing Balance as on DD/MM/YYYY  <employee>  <employer>  <pension>"
    const closingMatch = fullText.match(
      /Closing Balance as on\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/i
    );

    if (!closingMatch) {
      throw new BadRequestException('Could not find closing balance in the EPFO passbook. Make sure the passbook PDF is complete.');
    }

    const employeeBalance = parseIndianNumber(closingMatch[2]);
    const employerBalance = parseIndianNumber(closingMatch[3]);
    const pensionBalance = parseIndianNumber(closingMatch[4]);
    // The total value of EPFO is the sum of Employee share + Employer share + Pension share.
    const closingBalanceMinor = employeeBalance + employerBalance + pensionBalance;

    const rows: ParsedRow[] = [];
    const lines = fullText.split('\n');
    let rowCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // 1. Match contribution row
      // e.g. Mar-2025 01-04-2025 CR Cont. for Due-Month 042025 50,000 15,000 6,000 5,000 1,000
      const contribMatch = trimmed.match(
        /^([a-zA-Z]{3}-\d{4})\s+(\d{2}-\d{2}-\d{4})\s+(CR|DR)\s+(.*?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$/
      );

      if (contribMatch) {
        const wageMonth = contribMatch[1];
        const dateParts = contribMatch[2].split('-');
        const date = new Date(Date.UTC(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0])));
        const type = contribMatch[3];
        const particulars = contribMatch[4];
        const epfContribution = parseIndianNumber(contribMatch[7]);
        const employerContribution = parseIndianNumber(contribMatch[8]);
        const pensionContribution = parseIndianNumber(contribMatch[9]);

        const netAmount = (type === 'CR' ? 1 : -1) * (epfContribution + employerContribution + pensionContribution);

        if (netAmount !== 0) {
          rowCount++;
          rows.push({
            rowNumber: rowCount,
            date,
            description: `${particulars} (Wage Month: ${wageMonth})`,
            amountMinor: netAmount,
            reference: wageMonth
          });
        }
        continue;
      }

      // 2. Match interest row
      // e.g. Int. Updated upto 31/03/2026 10,000 8,000 0
      const interestMatch = trimmed.match(
        /^(Int\.\s+Updated\s+upto\s+(\d{2}\/\d{2}\/\d{4}))\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$/i
      );

      if (interestMatch) {
        const dateParts = interestMatch[2].split('/');
        const date = new Date(Date.UTC(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0])));
        const epfInterest = parseIndianNumber(interestMatch[3]);
        const employerInterest = parseIndianNumber(interestMatch[4]);
        const pensionInterest = parseIndianNumber(interestMatch[5]);

        const totalInterest = epfInterest + employerInterest + pensionInterest;

        if (totalInterest !== 0) {
          rowCount++;
          rows.push({
            rowNumber: rowCount,
            date,
            description: `Interest credit upto ${interestMatch[2]}`,
            amountMinor: totalInterest,
            reference: `INT-${dateParts[2]}`
          });
        }
      }
    }

    return { rows, closingBalanceMinor };
  }
};
