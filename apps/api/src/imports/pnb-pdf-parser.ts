import { BadRequestException } from '@nestjs/common';
import 'pdf-parse/worker';
import { PDFParse, PageTableResult } from 'pdf-parse';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

export type PnbParsedRow = ParsedRow;
type ReconciledRow = PnbParsedRow & { balanceMinor: number };

const amount = (value: string) => {
  if (!value) return null;
  const cleaned = value.replace(/[₹,\s]/g, '').replace(/cr\.?|dr\.?/gi, '').replace(/-/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed !== 0 ? Math.round(parsed * 100) : null;
};

const balanceAmount = (value: string) => {
  if (!value) return null;
  const isDr = /\bdr\.?\b/i.test(value);
  const cleaned = value.replace(/[₹,\s]/g, '').replace(/cr\.?|dr\.?/gi, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  const minor = Math.round(parsed * 100);
  return isDr ? -minor : minor;
};

const date = (value: string) => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]))) : null;
};

export function extractPnbReference(narration: string, chequeNumber?: string) {
  if (chequeNumber?.trim()) return chequeNumber.trim().slice(0, 100);
  const compact = narration.replace(/\s+/g, ' ').replace(/IMPS-\s+/gi, 'IMPS-');
  const patterns = [
    /(?:UPI\/(?:DR|CR)|IMPS-(?:IN|OUT|CHG)|IMPS-IN)[/:]([A-Z0-9]{8,})/i,
    /(?:NEFT_IN|NEFT_OUT):([A-Z0-9]{8,})/i,
    /\b(PUNB[A-Z0-9]{8,})\b/i,
    /\b(\d{10,})\b/,
  ];
  return patterns.map((pattern) => compact.match(pattern)?.[1]).find(Boolean)?.slice(0, 100);
}

export function parsePnbTables(pages: PageTableResult[]): { rows: PnbParsedRow[]; closingBalanceMinor?: number } {
  const tables = pages.flatMap((page) => page.tables);
  const looksLikePnb = tables.some((table) => table.some((row) => row.join(' ').replace(/\s+/g, ' ').match(/Transaction Date.*Withdrawal.*Deposit.*Balance.*Narration/i)));
  if (!looksLikePnb) throw new BadRequestException('This PDF does not match the supported Punjab National Bank statement layout.');
  const rows: ReconciledRow[] = [];
  for (const table of tables) {
    for (const cells of table) {
      if (cells.length < 6 || !/^\d{2}\/\d{2}\/\d{4}$/.test(cells[0].trim())) continue;
      const transactionDate = date(cells[0]);
      const withdrawal = amount(cells[2]); const deposit = amount(cells[3]); const balance = balanceAmount(cells[4]);
      if (!transactionDate || balance === null || (withdrawal === null && deposit === null) || (withdrawal !== null && deposit !== null)) {
        throw new BadRequestException(`A PNB transaction row near ${cells[0]} could not be interpreted safely.`);
      }
      const narration = cells[5].replace(/\s+/g, ' ').trim();
      const chequeNumber = cells[1].replace(/\s+/g, ' ').trim();
      rows.push({ date: transactionDate, description: (narration || (chequeNumber ? `Cheque ${chequeNumber}` : 'PNB transaction')).slice(0, 500),
        amountMinor: deposit ?? -Math.abs(withdrawal!), reference: extractPnbReference(narration, chequeNumber), rowNumber: rows.length + 1,
        balanceMinor: balance });
    }
  }
  if (!rows.length) throw new BadRequestException('No PNB transaction rows were detected.');
  let isDescending = false;
  if (rows.length > 1) {
    const descendingMismatches = rows.slice(0, -1).filter((row, index) => Math.abs(rows[index + 1].balanceMinor + row.amountMinor - row.balanceMinor) > 1).length;
    const ascendingMismatches = rows.slice(1).filter((row, index) => Math.abs(rows[index].balanceMinor + row.amountMinor - row.balanceMinor) > 1).length;
    if (Math.min(descendingMismatches, ascendingMismatches) > 0) {
      throw new BadRequestException('The PNB running balances did not reconcile with the extracted deposits and withdrawals.');
    }
    isDescending = descendingMismatches < ascendingMismatches;
  }
  return {
    rows: rows.map(({ balanceMinor: _balance, ...row }) => row),
    closingBalanceMinor: rows.length > 0 ? (isDescending ? rows[0].balanceMinor : rows[rows.length - 1].balanceMinor) : undefined
  };
}

export const pnbPdfParser: BankPdfParser = {
  id: 'PNB',
  institutionAliases: ['PNB', 'PUNJAB NATIONAL BANK'],
  matches(document: PdfStatementDocument) {
    return document.tablePages.some((page) => page.tables.some((table) => table.some((row) =>
      /Transaction Date.*Withdrawal.*Deposit.*Balance.*Narration/i.test(row.join(' ').replace(/\s+/g, ' ')),
    )));
  },
  parse(document: PdfStatementDocument) {
    return parsePnbTables(document.tablePages);
  },
};

export async function parsePnbPdf(buffer: Buffer): Promise<{ rows: PnbParsedRow[]; closingBalanceMinor?: number }> {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== '%PDF-') throw new BadRequestException('The selected file is not a valid PDF.');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const info = await parser.getInfo();
    if (info.total > 100) throw new BadRequestException('Bank statement PDFs are limited to 100 pages.');
    const result = await parser.getTable();
    return parsePnbTables(result.pages);
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('This bank-statement PDF could not be read.');
  } finally { await parser.destroy().catch(() => undefined); }
}
