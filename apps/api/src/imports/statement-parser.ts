import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { parsePnbPdf } from './pnb-pdf-parser';

export type ParsedRow = { date: Date; description: string; amountMinor: number; reference: string | undefined; rowNumber: number };
type RawRow = Record<string, unknown>;

const aliases = {
  date: ['date', 'transaction date', 'txn date', 'value date', 'posted date'],
  description: ['description', 'narration', 'transaction details', 'particulars', 'remarks', 'merchant'],
  amount: ['amount', 'transaction amount', 'txn amount'],
  debit: ['debit', 'withdrawal', 'withdrawal amt.', 'debit amount'],
  credit: ['credit', 'deposit', 'deposit amt.', 'credit amount'],
  reference: ['reference', 'reference number', 'ref no', 'chq./ref.no.', 'transaction id'],
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
  const parsed = rows.map((row, index) => {
    const date = dateValue(find(row, aliases.date));
    const description = String(find(row, aliases.description) ?? '').trim();
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

export async function parseStatement(file: Express.Multer.File): Promise<ParsedRow[]> {
  if (file.originalname.toLowerCase().endsWith('.pdf')) return parsePnbPdf(file.buffer);
  if (file.originalname.toLowerCase().endsWith('.csv')) {
    const rows = parse(file.buffer, { columns: true, skip_empty_lines: true, bom: true, trim: true, relax_column_count: true }) as RawRow[];
    return normalize(rows);
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
    return normalize(rows);
  }
  throw new BadRequestException('Only CSV, XLSX, and supported bank-statement PDFs are accepted.');
}
