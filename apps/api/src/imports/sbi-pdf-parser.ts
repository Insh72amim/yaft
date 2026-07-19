import { BadRequestException } from '@nestjs/common';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

type SbiRow = ParsedRow & { balanceMinor: number };

type SbiSummary = {
  broughtForwardMinor: number;
  debitCount: number;
  creditCount: number;
  totalDebitsMinor: number;
  totalCreditsMinor: number;
  closingBalanceMinor: number;
};

const ROW_START = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(.*))?$/;
const MONEY_CELL = /^(?:₹\s*)?(?:\d[\d,]*\.\d{2})(?:CR|DR)?$/i;
const SUMMARY_MONEY = /(?:₹\s*)?\d[\d,]*\.\d{2}(?:CR|DR)?/gi;

function normalizedText(document: PdfStatementDocument) {
  return document.textPages
    .slice()
    .sort((left, right) => left.num - right.num)
    .map((page) => page.text)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeSbi(document: PdfStatementDocument) {
  const text = normalizedText(document);
  return /\bSTATEMENT OF ACCOUNT\b/i.test(text)
    && /\bState Bank of India\b/i.test(text)
    && /\bDetails\b/i.test(text)
    && /\bDebit\b/i.test(text)
    && /\bCredit\b/i.test(text)
    && /\bBalance\b/i.test(text)
    && /Statement Summary\s*:.*?Brought Forward.*?Dr Count.*?Cr Count.*?Total Debits.*?Total Credits.*?Closing Balance/i.test(text);
}

function parseDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const result = new Date(Date.UTC(year, month - 1, day));
  return result.getUTCFullYear() === year && result.getUTCMonth() === month - 1 && result.getUTCDate() === day ? result : null;
}

function parseMoney(value: string, allowEmpty: false): number;
function parseMoney(value: string, allowEmpty: true): number | null;
function parseMoney(value: string, allowEmpty: boolean): number | null {
  const trimmed = value.trim();
  if (trimmed === '-') return allowEmpty ? null : Number.NaN;
  if (!MONEY_CELL.test(trimmed)) return Number.NaN;
  const suffix = trimmed.match(/(CR|DR)$/i)?.[1].toUpperCase();
  const numeric = Number(trimmed.replace(/[₹,\s]/g, '').replace(/(?:CR|DR)$/i, ''));
  if (!Number.isFinite(numeric)) return Number.NaN;
  const minor = Math.round(numeric * 100);
  return suffix === 'DR' ? -minor : minor;
}

function sourceReference(description: string, chequeReference: string) {
  const cheque = chequeReference.trim();
  if (cheque && cheque !== '-') return { kind: 'CHEQUE', value: cheque.slice(0, 100) };

  const compact = description.replace(/\s+/g, ' ').trim();
  const patterns: Array<[string, RegExp, boolean?]> = [
    ['IMPS', /\bIMPS\s*\/\s*([A-Z0-9]{8,})/i],
    ['NEFT', /\bNEFT\s*\*\s*([A-Z0-9]{8,})\s*\*/i],
    ['FIRD', /\bFTFRREF\s*:\s*([A-Z0-9][A-Z0-9\s]{7,}?)\s+(?=OF\b|TO\b|AT\b)/i, true],
    ['ACH', /\bACH(?:DR|CR)\s+([A-Z0-9]{8,})/i],
  ];
  for (const [kind, pattern, removeSpaces] of patterns) {
    const match = compact.match(pattern);
    if (match) return { kind, value: (removeSpaces ? match[1].replace(/\s+/g, '') : match[1]).slice(0, 100) };
  }
  return null;
}

function normalizedDetails(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isMoneyTableCell(value: string) {
  return value === '-' || MONEY_CELL.test(value);
}

function isReferenceTableCell(value: string) {
  return value === '-' || /^[A-Z0-9][A-Z0-9./:_-]{0,99}$/i.test(value);
}

function parseRowBlock(valueDateText: string, postDateText: string, parts: string[], rowNumber: number): SbiRow {
  const valueDate = parseDate(valueDateText);
  const postedDate = parseDate(postDateText);
  if (!valueDate || !postedDate) throw new BadRequestException(`SBI transaction row ${rowNumber} contains an invalid date.`);

  const candidates: Array<{ lineIndex: number; prefix: string; cells: string[] }> = [];
  parts.forEach((part, lineIndex) => {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const cells = tokens.slice(-4);
    if (cells.length === 4 && isReferenceTableCell(cells[0]) && cells.slice(1).every(isMoneyTableCell)) {
      candidates.push({ lineIndex, prefix: tokens.slice(0, -4).join(' '), cells });
    }
  });
  if (candidates.length !== 1) throw new BadRequestException(`SBI transaction row ${rowNumber} has an ambiguous amount layout.`);

  const [{ lineIndex, prefix, cells }] = candidates;
  const [chequeReference, debitText, creditText, balanceText] = cells;
  const debit = parseMoney(debitText, true);
  const credit = parseMoney(creditText, true);
  const balanceMinor = parseMoney(balanceText, false);
  if (Number.isNaN(debit) || Number.isNaN(credit) || Number.isNaN(balanceMinor)
    || (debit === null) === (credit === null) || (debit ?? credit ?? 0) <= 0) {
    throw new BadRequestException(`SBI transaction row ${rowNumber} has invalid debit, credit, or balance values.`);
  }

  const descriptionParts = parts.slice();
  descriptionParts[lineIndex] = prefix;
  const description = descriptionParts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!description) throw new BadRequestException(`SBI transaction row ${rowNumber} has no description.`);

  const amountMinor = credit ?? -Math.abs(debit!);
  const extracted = sourceReference(description, chequeReference);
  const identity = extracted ? `${extracted.kind}:${extracted.value.toUpperCase()}` : `DETAILS:${normalizedDetails(description)}`;
  const dedupeKey = ['SBI', isoDate(valueDate), isoDate(postedDate), amountMinor, balanceMinor, identity].join('|');

  return {
    date: valueDate,
    postedDate,
    description: description.slice(0, 500),
    amountMinor,
    reference: extracted?.value,
    dedupeKey,
    rowNumber,
    balanceMinor,
  };
}

function parseRows(document: PdfStatementDocument) {
  const rows: SbiRow[] = [];
  let pending: { valueDate: string; postDate: string; parts: string[] } | null = null;

  const flush = () => {
    if (!pending) return;
    rows.push(parseRowBlock(pending.valueDate, pending.postDate, pending.parts, rows.length + 1));
    pending = null;
  };

  for (const page of document.textPages.slice().sort((left, right) => left.num - right.num)) {
    for (const line of page.text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
      const start = line.match(ROW_START);
      if (start) {
        flush();
        pending = { valueDate: start[1], postDate: start[2], parts: [start[3] ?? ''] };
        continue;
      }
      if (!pending) continue;
      if (/^(?:\d+\s+)?Page no\./i.test(line) || /^Statement Summary\b/i.test(line)) {
        flush();
        continue;
      }
      pending.parts.push(line);
    }
    flush();
  }

  if (!rows.length) throw new BadRequestException('No SBI transaction rows were detected.');
  return rows;
}

function parseSummary(document: PdfStatementDocument): SbiSummary {
  const lines = document.textPages
    .slice()
    .sort((left, right) => left.num - right.num)
    .flatMap((page) => page.text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean));
  const summaryIndex = lines.findIndex((line) => /^Statement Summary\b/i.test(line));
  if (summaryIndex < 0) throw new BadRequestException('The SBI statement summary is missing.');

  const summaryLines: string[] = [];
  for (const line of lines.slice(summaryIndex + 1)) {
    if (/^(?:Please\b|If your account\b|This is a computer\b|(?:\d+\s+)?Page no\.)/i.test(line)) break;
    summaryLines.push(line);
  }
  const values = summaryLines.join(' ').match(SUMMARY_MONEY) ?? [];
  if (values.length !== 4) throw new BadRequestException('The SBI statement summary contains ambiguous monetary totals.');

  const numericTail = summaryLines
    .join(' ')
    .replace(SUMMARY_MONEY, ' ')
    .match(/(?:^|\s)(\d+)(?=\s|$)/g)
    ?.map((value) => Number(value.trim())) ?? [];
  if (numericTail.length !== 2) throw new BadRequestException('The SBI statement summary contains ambiguous transaction counts.');

  const parsedValues = values.map((value) => parseMoney(value, false));
  if (parsedValues.some(Number.isNaN)) throw new BadRequestException('The SBI statement summary could not be interpreted safely.');
  return {
    broughtForwardMinor: parsedValues[0]!,
    totalDebitsMinor: parsedValues[1]!,
    totalCreditsMinor: parsedValues[2]!,
    closingBalanceMinor: parsedValues[3]!,
    debitCount: numericTail[0],
    creditCount: numericTail[1],
  };
}

function validate(rows: SbiRow[], summary: SbiSummary) {
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index - 1].balanceMinor + rows[index].amountMinor !== rows[index].balanceMinor) {
      throw new BadRequestException('The SBI running balances did not reconcile with the extracted debits and credits.');
    }
  }

  const debitRows = rows.filter((row) => row.amountMinor < 0);
  const creditRows = rows.filter((row) => row.amountMinor > 0);
  const totalDebitsMinor = debitRows.reduce((total, row) => total + Math.abs(row.amountMinor), 0);
  const totalCreditsMinor = creditRows.reduce((total, row) => total + row.amountMinor, 0);
  const summaryMatches = summary.broughtForwardMinor + rows[0].amountMinor === rows[0].balanceMinor
    && rows.at(-1)!.balanceMinor === summary.closingBalanceMinor
    && summary.broughtForwardMinor + summary.totalCreditsMinor - summary.totalDebitsMinor === summary.closingBalanceMinor
    && debitRows.length === summary.debitCount
    && creditRows.length === summary.creditCount
    && totalDebitsMinor === summary.totalDebitsMinor
    && totalCreditsMinor === summary.totalCreditsMinor;
  if (!summaryMatches) throw new BadRequestException('The SBI statement summary did not reconcile with the extracted transactions.');
}

export function parseSbiDocument(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number } {
  if (!looksLikeSbi(document)) throw new BadRequestException('This PDF does not match the supported State Bank of India statement layout.');
  const rows = parseRows(document);
  const summary = parseSummary(document);
  validate(rows, summary);
  return {
    rows: rows.map(({ balanceMinor: _balanceMinor, ...row }) => row),
    closingBalanceMinor: summary.closingBalanceMinor
  };
}

export const sbiPdfParser: BankPdfParser = {
  id: 'SBI',
  institutionAliases: ['SBI', 'STATE BANK OF INDIA'],
  matches: looksLikeSbi,
  parse: parseSbiDocument,
};
