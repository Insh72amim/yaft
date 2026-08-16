import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import type { ParsedRow, ParseStatementOptions } from './bank-pdf-parser';
import { parseBankPdf } from './pdf-statement-registry';
import { parseAxisCcExcel } from './axis-cc-parser';

export type { ParsedRow } from './bank-pdf-parser';
type RawRow = Record<string, unknown>;

const aliases = {
  date: ['date', 'transaction date', 'txn date', 'value date', 'posted date'],
  description: ['description', 'narration', 'transaction details', 'particulars', 'remarks', 'merchant'],
  amount: ['amount', 'transaction amount', 'txn amount'],
  debit: ['debit', 'withdrawal', 'withdrawal amt.', 'debit amount'],
  credit: ['credit', 'deposit', 'deposit amt.', 'credit amount'],
  reference: ['reference', 'reference number', 'ref no', 'chq./ref.no.', 'transaction id'],
  status: ['status', 'transaction status', 'txn status', 'payment status', 'state', 'result'],
};

const normalizedKey = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function find(row: RawRow, names: string[]) {
  const key = Object.keys(row).find((candidate) => names.includes(normalizedKey(candidate)));
  return key ? row[key] : undefined;
}

function money(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim().replace(/[₹,$\s]/g, '').replace(/,/g, '').replace(/\((.*)\)/, '-$1');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
  const text = String(value ?? '').trim();
  const indian = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (indian) {
    const year = Number(indian[3]) + (indian[3].length === 2 ? 2000 : 0);
    const result = new Date(Date.UTC(year, Number(indian[2]) - 1, Number(indian[1])));
    return Number.isNaN(result.getTime()) ? null : result;
  }
  const result = new Date(text);
  return Number.isNaN(result.getTime()) ? null : result;
}

function normalize(rows: RawRow[]): ParsedRow[] {
  const parsed = rows.map<ParsedRow | null>((row, index) => {
    const date = dateValue(find(row, aliases.date));
    const description = String(find(row, aliases.description) ?? '').trim();
    const statusVal = String(find(row, aliases.status) ?? '').trim().toLowerCase();

    // Check if status explicitly denotes a failed, declined, rejected, or cancelled attempt
    if (statusVal && /^(?:failed|declined|rejected|cancelled|canceled|unsuccessful|failure|declined\/failed|pending)$/i.test(statusVal)) {
      return null;
    }

    // Check if description indicates a declined or failed transaction attempt
    if (/\b(?:txn\s+declined|transaction\s+declined|payment\s+declined|payment\s+failed|txn\s+failed|transaction\s+failed|payment\s+unsuccessful|transaction\s+unsuccessful|unsuccessful\s+transaction|auto\s+reversed|declined\s+at|card\s+declined|declined\s+transaction|failed\s+transaction|charge\s+declined)\b/i.test(description)) {
      return null;
    }

    const direct = money(find(row, aliases.amount));
    const debit = money(find(row, aliases.debit));
    const credit = money(find(row, aliases.credit));
    const amountMinor = direct ?? (credit !== null ? Math.abs(credit) : debit !== null ? -Math.abs(debit) : null);
    if (!date || !description || amountMinor === null || amountMinor === 0) return null;
    const reference = String(find(row, aliases.reference) ?? '').trim() || undefined;
    return { date, description, amountMinor, reference, rowNumber: index + 2 };
  }).filter((row): row is ParsedRow => row !== null);
  if (!parsed.length) throw new BadRequestException('No transaction rows were detected. Include date, description, and amount—or debit/credit—columns.');
  return parsed;
}

export type ParsedStatement = {
  rows: ParsedRow[];
  parserId?: 'PNB' | 'AXIS' | 'SBI' | 'EPFO' | 'ICICI' | 'HDFC' | 'SBI_CC' | 'GPAY';
  closingBalanceMinor?: number;
  extractedAccountDigits?: string;
};

export async function parseStatementWithMetadata(file: Express.Multer.File, _options: ParseStatementOptions = {}): Promise<ParsedStatement> {
  if (file.originalname.toLowerCase().endsWith('.pdf')) return parseBankPdf(file.buffer, _options);
  if (file.originalname.toLowerCase().endsWith('.csv')) {
    const rows = parse(file.buffer, { columns: true, skip_empty_lines: true, bom: true, trim: true, relax_column_count: true }) as RawRow[];
    return { rows: normalize(rows) };
  }
  if (/\.xlsx?$/i.test(file.originalname)) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('The workbook has no worksheets.');

    // Check if it's an Axis Bank Credit Card statement
    const firstCellText = String(sheet.getRow(1).getCell(1).text).trim();
    const fourthCellText = String(sheet.getRow(1).getCell(4).text).trim();
    if (
      firstCellText.includes('Axis Bank Credit Card') ||
      fourthCellText.includes('Axis Rewards Credit Card Monthly Statement') ||
      fourthCellText.includes('Axis Bank')
    ) {
      return { rows: parseAxisCcExcel(sheet), parserId: 'AXIS' }; // We'll just use AXIS here or add AXIS_CC if preferred
    }

    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, column) => { headers[column] = String(cell.text).trim(); });
    const rows: RawRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: RawRow = {};
      headers.forEach((header, column) => { if (header) record[header] = row.getCell(column).value; });
      rows.push(record);
    });
    return { rows: normalize(rows) };
  }
  throw new BadRequestException('Only CSV, XLSX, and supported bank-statement PDFs are accepted.');
}

export async function parseStatement(file: Express.Multer.File, options: ParseStatementOptions = {}): Promise<ParsedRow[]> {
  return (await parseStatementWithMetadata(file, options)).rows;
}
