import { BadRequestException } from '@nestjs/common';
import {
  EPFO_PASSBOOK_PATTERNS,
  parseMoneyToMinor,
  isCreditIndicator,
} from '@yaft/shared';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

export function isEpfoPassbook(document: PdfStatementDocument): boolean {
  const fullText = document.textPages.map((p) => p.text).join('\n');
  return EPFO_PASSBOOK_PATTERNS.PASSBOOK_LAYOUT_REGEX.test(fullText);
}

export const epfoPdfParser: BankPdfParser = {
  id: 'EPFO',
  institutionAliases: ['EPFO', 'EPFO India', 'Employees Provident Fund Organisation'],

  matches(document: PdfStatementDocument): boolean {
    return isEpfoPassbook(document);
  },

  parse(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number } {
    const fullText = document.textPages.map((p) => p.text).join('\n');

    if (!this.matches(document)) {
      throw new BadRequestException('This PDF does not appear to be an EPFO passbook.');
    }

    // Extract closing balance: "Closing Balance as on DD/MM/YYYY  <employee>  <employer>  <pension>"
    const closingMatch = fullText.match(EPFO_PASSBOOK_PATTERNS.CLOSING_BALANCE_REGEX);

    if (!closingMatch) {
      throw new BadRequestException('Could not find closing balance in the EPFO passbook. Make sure the passbook PDF is complete.');
    }

    const employeeBalance = parseMoneyToMinor(closingMatch[2]) || 0;
    const employerBalance = parseMoneyToMinor(closingMatch[3]) || 0;
    const pensionBalance = parseMoneyToMinor(closingMatch[4]) || 0;
    // The total value of EPFO is the sum of Employee share + Employer share + Pension share.
    const closingBalanceMinor = employeeBalance + employerBalance + pensionBalance;

    const rows: ParsedRow[] = [];
    const lines = fullText.split('\n');
    let rowCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // 1. Match contribution row
      // e.g. Mar-2025 01-04-2025 CR Cont. for Due-Month 042025 50,000 15,000 6,000 5,000 1,000
      const contribMatch = trimmed.match(EPFO_PASSBOOK_PATTERNS.CONTRIBUTION_ROW_REGEX);

      if (contribMatch) {
        const wageMonth = contribMatch[1];
        const dateParts = contribMatch[2].split('-');
        const date = new Date(Date.UTC(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0])));
        const type = contribMatch[3];
        const particulars = contribMatch[4];
        const epfContribution = parseMoneyToMinor(contribMatch[7]) || 0;
        const employerContribution = parseMoneyToMinor(contribMatch[8]) || 0;
        const pensionContribution = parseMoneyToMinor(contribMatch[9]) || 0;

        const isCredit = isCreditIndicator(type);
        const totalContribution = epfContribution + employerContribution + pensionContribution;
        const netAmount = isCredit ? totalContribution : -totalContribution;

        if (netAmount !== 0) {
          rowCount++;
          rows.push({
            rowNumber: rowCount,
            date,
            description: `${particulars} (Wage Month: ${wageMonth})`,
            amountMinor: netAmount,
            reference: wageMonth,
          });
        }
        continue;
      }

      // 2. Match interest row
      // e.g. Int. Updated upto 31/03/2026 10,000 8,000 0
      const interestMatch = trimmed.match(EPFO_PASSBOOK_PATTERNS.INTEREST_ROW_REGEX);

      if (interestMatch) {
        const dateParts = interestMatch[2].split('/');
        const date = new Date(Date.UTC(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0])));
        const epfInterest = parseMoneyToMinor(interestMatch[3]) || 0;
        const employerInterest = parseMoneyToMinor(interestMatch[4]) || 0;
        const pensionInterest = parseMoneyToMinor(interestMatch[5]) || 0;

        const totalInterest = epfInterest + employerInterest + pensionInterest;

        if (totalInterest !== 0) {
          rowCount++;
          rows.push({
            rowNumber: rowCount,
            date,
            description: `Interest credit upto ${interestMatch[2]}`,
            amountMinor: totalInterest,
            reference: `INT-${dateParts[2]}`,
          });
        }
      }
    }

    return { rows, closingBalanceMinor };
  },
};
