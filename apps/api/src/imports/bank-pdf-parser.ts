import type { PageTableResult, PageTextResult } from 'pdf-parse';

export type ParsedRow = {
  date: Date;
  postedDate?: Date;
  description: string;
  amountMinor: number;
  reference?: string;
  dedupeKey?: string;
  rowNumber: number;
  paymentMethod?: string;
  isUpiLite?: boolean;
};

export type ParseStatementOptions = {
  institution?: string;
  pdfPassword?: string;
};

export type PdfStatementDocument = {
  total: number;
  textPages: PageTextResult[];
  tablePages: PageTableResult[];
};

export type BankPdfParser = {
  id: 'PNB' | 'AXIS' | 'SBI' | 'EPFO' | 'ICICI' | 'HDFC' | 'SBI_CC' | 'GPAY';
  institutionAliases: readonly string[];
  matches(document: PdfStatementDocument): boolean;
  parse(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number };
};

export function normalizeInstitution(value?: string) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}
