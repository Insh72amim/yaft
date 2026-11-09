import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import {
  STATEMENT_COLUMN_ALIASES,
  isDeclinedOrFailedTransaction,
  parseMoneyToMinor,
  normalizeHeaderKey,
  COMMON_DATE_PATTERNS,
} from '@yaft/shared';
import type { ParsedRow, ParseStatementOptions } from './bank-pdf-parser';
import { parseBankPdf } from './pdf-statement-registry';

export type { ParsedRow } from './bank-pdf-parser';
type RawRow = Record<string, unknown>;

function find(row: RawRow, names: string[]) {
  const key = Object.keys(row).find((candidate) => names.includes(normalizeHeaderKey(candidate)));
  return key ? row[key] : undefined;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
  const text = String(value ?? '').trim();
  const indian = text.match(COMMON_DATE_PATTERNS.DD_MM_YYYY_SLASH_OR_DASH_REGEX);
  if (indian) {
    const year = Number(indian[3]) + (indian[3].length === 2 ? 2000 : 0);
    const result = new Date(Date.UTC(year, Number(indian[2]) - 1, Number(indian[1])));
    return Number.isNaN(result.getTime()) ? null : result;
  }
  const result = new Date(text);
  return Number.isNaN(result.getTime()) ? null : result;
}

function normalize(rows: RawRow[]): { rows: ParsedRow[]; closingBalanceMinor?: number } {
  let lastClosingBalance: number | undefined = undefined;
  const parsed = rows.map<ParsedRow | null>((row, index) => {
    const date = dateValue(find(row, STATEMENT_COLUMN_ALIASES.date));
    const description = String(find(row, STATEMENT_COLUMN_ALIASES.description) ?? '').trim();
    const statusVal = String(find(row, STATEMENT_COLUMN_ALIASES.status) ?? '').trim();

    // Check if status or description denotes a failed, declined, rejected, or cancelled attempt
    if (isDeclinedOrFailedTransaction(description, statusVal)) {
      return null;
    }

    const direct = parseMoneyToMinor(find(row, STATEMENT_COLUMN_ALIASES.amount));
    const debit = parseMoneyToMinor(find(row, STATEMENT_COLUMN_ALIASES.debit));
    const credit = parseMoneyToMinor(find(row, STATEMENT_COLUMN_ALIASES.credit));
    const amountMinor = direct ?? (credit !== null ? Math.abs(credit) : debit !== null ? -Math.abs(debit) : null);
    if (!date || !description || amountMinor === null || amountMinor === 0) return null;
    const reference = String(find(row, STATEMENT_COLUMN_ALIASES.reference) ?? '').trim() || undefined;
    const balanceMinor = parseMoneyToMinor(find(row, STATEMENT_COLUMN_ALIASES.balance));
    if (balanceMinor !== null) lastClosingBalance = balanceMinor;
    return { date, description, amountMinor, reference, balanceMinor: balanceMinor ?? undefined, rowNumber: index + 2 };
  }).filter((row): row is ParsedRow => row !== null);
  if (!parsed.length) throw new BadRequestException('No transaction rows were detected. Include date, description, and amount—or debit/credit—columns.');
  return { rows: parsed, closingBalanceMinor: lastClosingBalance };
}

export type ParsedStatement = {
  rows: ParsedRow[];
  parserId?: 'PNB' | 'AXIS' | 'SBI' | 'EPFO' | 'GPAY' | 'GENERIC' | string;
  closingBalanceMinor?: number;
  extractedAccountDigits?: string;
};

export async function parseStatementWithMetadata(file: Express.Multer.File, _options: ParseStatementOptions = {}): Promise<ParsedStatement> {
  if (file.originalname.toLowerCase().endsWith('.pdf')) return parseBankPdf(file.buffer, _options);
  if (file.originalname.toLowerCase().endsWith('.csv')) {
    const rows = parse(file.buffer, { columns: true, skip_empty_lines: true, bom: true, trim: true, relax_column_count: true }) as RawRow[];
    const result = normalize(rows);
    return { rows: result.rows, closingBalanceMinor: result.closingBalanceMinor, parserId: 'GENERIC' };
  }
  if (/\.xlsx?$/i.test(file.originalname)) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('The workbook has no worksheets.');

    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, column) => { headers[column] = String(cell.text).trim(); });
    const rows: RawRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: RawRow = {};
      headers.forEach((header, column) => { if (header) record[header] = row.getCell(column).value; });
      rows.push(record);
    });
    const result = normalize(rows);
    return { rows: result.rows, closingBalanceMinor: result.closingBalanceMinor, parserId: 'GENERIC' };
  }
  throw new BadRequestException('Only CSV, XLSX, and supported bank-statement PDFs are accepted.');
}

export async function parseStatement(file: Express.Multer.File, options: ParseStatementOptions = {}): Promise<ParsedRow[]> {
  return (await parseStatementWithMetadata(file, options)).rows;
}
