import { BadRequestException } from '@nestjs/common';
import type { PdfStatementDocument } from './bank-pdf-parser';

export type EpfoPassbookResult = {
  employeeBalance: number;   // minor units (paise)
  employerBalance: number;   // minor units (paise)
  totalBalance: number;      // minor units (paise)
  financialYear: string;     // e.g. "2025-2026"
  closingDate: string;       // e.g. "31/03/2026"
  memberName?: string;
  uan?: string;
  establishment?: string;
};

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

export function parseEpfoPassbook(document: PdfStatementDocument): EpfoPassbookResult {
  const fullText = document.textPages.map(p => p.text).join('\n');

  if (!isEpfoPassbook(document)) {
    throw new BadRequestException('This PDF does not appear to be an EPFO passbook.');
  }

  // Extract financial year
  const fyMatch = fullText.match(/Financial Year\s*-\s*(\d{4}-\d{4})/i)
    || fullText.match(/foÙkh; o"kZ\s*-\s*(\d{4}-\d{4})/);
  const financialYear = fyMatch?.[1] ?? 'unknown';

  // Extract closing balance line: "Closing Balance as on DD/MM/YYYY  <employee>  <employer>  <pension>"
  const closingMatch = fullText.match(
    /Closing Balance as on\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/i
  );

  if (!closingMatch) {
    throw new BadRequestException('Could not find closing balance in the EPFO passbook. Make sure the passbook PDF is complete.');
  }

  const closingDate = closingMatch[1];
  const employeeBalance = parseIndianNumber(closingMatch[2]);
  const employerBalance = parseIndianNumber(closingMatch[3]);
  const totalBalance = employeeBalance + employerBalance;

  // Extract member name
  const nameMatch = fullText.match(/Member ID\/Name\s+\S+\s*\/\s*(.+)/i)
    || fullText.match(/lnL; vkbZMh\/uke\s*\|\s*Member ID\/Name\s+\S+\s*\/\s*(.+)/i);
  const memberName = nameMatch?.[1]?.trim();

  // Extract UAN
  const uanMatch = fullText.match(/UAN\s+([\d]+)/i);
  const uan = uanMatch?.[1];

  // Extract establishment
  const estMatch = fullText.match(/Establishment ID\/Name\s+\S+\s*\/\s*(.+)/i);
  const establishment = estMatch?.[1]?.trim();

  return {
    employeeBalance,
    employerBalance,
    totalBalance,
    financialYear,
    closingDate,
    memberName,
    uan,
    establishment,
  };
}
