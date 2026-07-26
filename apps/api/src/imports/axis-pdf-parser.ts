import { BadRequestException } from '@nestjs/common';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

type AxisRow = ParsedRow & { balanceMinor: number };

const compact = (value: string | undefined) => String(value ?? '').replace(/\s+/g, ' ').trim();

const headerCell = (value: string | undefined) => compact(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const isAxisBankHeader = (cells: string[]) => {
  const expected = ['tran date', 'chq no', 'particulars', 'debit', 'credit', 'balance', 'init br'];
  return cells.length >= expected.length && expected.every((value, index) => headerCell(cells[index]) === value);
};

const isAxisCcHeader = (cells: string[]) => {
  const h = cells.map(headerCell);
  return h.includes('date') && h.includes('transaction details') && h.some((c) => c.includes('amount')) && h.some((c) => c.includes('debit') || c.includes('credit'));
};

const amount = (value: string | undefined) => {
  let cleaned = compact(value).replace(/[₹,\s]/g, '');
  if (!cleaned) return null;
  if (/^\(.*\)$/.test(cleaned)) cleaned = `-${cleaned.slice(1, -1)}`;
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isSafeInteger(Math.round(parsed * 100)) ? Math.round(parsed * 100) : null;
};

const dateBank = (value: string | undefined) => {
  const match = compact(value).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const parsed = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  return parsed.getUTCFullYear() === Number(match[3])
    && parsed.getUTCMonth() === Number(match[2]) - 1
    && parsed.getUTCDate() === Number(match[1]) ? parsed : null;
};

const dateCc = (value: string | undefined) => {
  const raw = compact(value);
  const match = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+'?(\d{2,4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const monthStr = match[2].toLowerCase();
  const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  if (!(monthStr in months)) return null;
  const month = months[monthStr];
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  const parsed = new Date(Date.UTC(year, month, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month && parsed.getUTCDate() === day ? parsed : null;
};

export function extractAxisReference(particulars: string, chequeNumber?: string) {
  const cheque = compact(chequeNumber);
  if (cheque) return cheque.slice(0, 100);
  const narration = compact(particulars);
  const transfer = narration.match(/\b(?:UPI\/(?:P2A|P2M|CRADJ)|IMPS\/P2A)\/(\d{10,14})\b/i)?.[1];
  if (transfer) return transfer;
  return narration.match(/\bREF\s*#\s*([A-Z0-9]{4,})\b/i)?.[1]?.slice(0, 100);
}

function axisBankTextMatches(document: PdfStatementDocument) {
  const text = document.textPages.map((page) => page.text).join(' ').replace(/\s+/g, ' ');
  return /\bAXIS BANK\b/i.test(text) && /Statement of Axis Account No/i.test(text);
}

function axisCcTextMatches(document: PdfStatementDocument) {
  const text = document.textPages.map((page) => page.text).join(' ').replace(/\s+/g, ' ');
  return /\bAXIS\b/i.test(text) && (/\bCredit Card\b/i.test(text) || /\bPayment Summary\b/i.test(text) || /\bMinimum Payment Due\b/i.test(text) || /\bTotal Payment Due\b/i.test(text));
}

function findLabel(cells: string[], label: RegExp) {
  return cells.findIndex((cell) => label.test(compact(cell)));
}

function malformed(): never {
  throw new BadRequestException('The Axis Bank statement contains a row that could not be interpreted safely.');
}

export function parseAxisCcPdfDocument(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number } {
  const rows: ParsedRow[] = [];

  for (const page of document.tablePages) {
    for (const table of page.tables) {
      for (const cells of table) {
        const values = cells.map(compact);
        if (values.every((v) => !v) || isAxisCcHeader(cells)) continue;

        const transactionDate = dateCc(values[0]);
        if (transactionDate) {
          const description = values[1];
          const parsedAmt = amount(values[2]);
          const typeStr = (values[3] || '').toLowerCase();
          if (!description || parsedAmt === null) continue;

          const isCredit = typeStr.includes('credit') || typeStr.includes('cr');
          const amountMinor = isCredit ? Math.abs(parsedAmt) : -Math.abs(parsedAmt);
          const reference = extractAxisReference(description);
          const dateKey = transactionDate.toISOString().slice(0, 10);
          const identity = reference ? `ref:${reference.toLowerCase()}` : `row:${description.toLowerCase()}`;

          rows.push({
            date: transactionDate,
            description: description.slice(0, 500),
            amountMinor,
            reference,
            dedupeKey: `axis_cc|${dateKey}|${amountMinor}|${identity}`,
            rowNumber: rows.length + 1,
          });
        }
      }
    }
  }

  if (!rows.length) {
    throw new BadRequestException('The Axis Bank Credit Card statement contains no valid transaction rows.');
  }

  return { rows };
}

export function parseAxisDocument(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number } {
  const hasCcHeader = document.tablePages.some((page) => page.tables.some((table) => table.some(isAxisCcHeader)));
  if (hasCcHeader || axisCcTextMatches(document)) {
    return parseAxisCcPdfDocument(document);
  }

  const hasBankHeader = document.tablePages.some((page) => page.tables.some((table) => table.some(isAxisBankHeader)));
  if (!axisBankTextMatches(document) || !hasBankHeader) {
    throw new BadRequestException('This PDF does not match the supported Axis Bank statement layout.');
  }

  const rows: AxisRow[] = [];
  let openingBalance: number | null = null;
  let printedDebitTotal: number | null = null;
  let printedCreditTotal: number | null = null;
  let printedClosingBalance: number | null = null;

  for (const page of document.tablePages) {
    for (const table of page.tables) {
      for (const cells of table) {
        const values = cells.map(compact);
        if (values.every((value) => !value) || isAxisBankHeader(cells)) continue;

        const transactionDate = dateBank(values[0]);
        if (transactionDate) {
          if (cells.length !== 7) malformed();
          const debit = amount(values[3]);
          const credit = amount(values[4]);
          const balanceMinor = amount(values[5]);
          const description = values[2];
          const chequeNumber = values[1];
          if (!description || balanceMinor === null || (debit === null) === (credit === null)) malformed();
          if ((debit !== null && debit <= 0) || (credit !== null && credit <= 0)) malformed();
          const amountMinor = credit ?? -debit!;
          const reference = extractAxisReference(description, chequeNumber);
          const dateKey = transactionDate.toISOString().slice(0, 10);
          const identity = reference ? `ref:${reference.toLowerCase()}` : `row:${description.toLowerCase()}`;
          rows.push({
            date: transactionDate,
            description: description.slice(0, 500),
            amountMinor,
            reference,
            dedupeKey: `axis|${dateKey}|${amountMinor}|${identity}|balance:${balanceMinor}`,
            rowNumber: rows.length + 1,
            balanceMinor,
          });
          continue;
        }

        const openingIndex = findLabel(values, /^OPENING BALANCE$/i);
        if (openingIndex >= 0) {
          if (openingBalance !== null || cells.length !== 7) malformed();
          openingBalance = amount(values[5]);
          if (openingBalance === null) malformed();
          continue;
        }

        const totalIndex = findLabel(values, /^TRANSACTION TOTAL$/i);
        if (totalIndex >= 0) {
          if (printedDebitTotal !== null || printedCreditTotal !== null) malformed();
          printedDebitTotal = amount(values[totalIndex + 1]);
          printedCreditTotal = amount(values[totalIndex + 2]);
          if (printedDebitTotal === null || printedCreditTotal === null) malformed();
          continue;
        }

        const closingIndex = findLabel(values, /^CLOSING BALANCE$/i);
        if (closingIndex >= 0) {
          if (printedClosingBalance !== null) malformed();
          printedClosingBalance = amount(values[closingIndex + 1]);
          if (printedClosingBalance === null) malformed();
          continue;
        }

        malformed();
      }
    }
  }

  if (!rows.length || openingBalance === null || printedDebitTotal === null
    || printedCreditTotal === null || printedClosingBalance === null) malformed();

  let balance = openingBalance;
  let debitTotal = 0;
  let creditTotal = 0;
  let previousDate: Date | undefined;
  for (const row of rows) {
    if (previousDate && row.date < previousDate) {
      throw new BadRequestException('The Axis Bank transactions are not in the expected statement order.');
    }
    if (row.amountMinor < 0) debitTotal += -row.amountMinor;
    else creditTotal += row.amountMinor;
    balance += row.amountMinor;
    if (Math.abs(balance - row.balanceMinor) > 1) {
      throw new BadRequestException('The Axis Bank running balances did not reconcile with the extracted debits and credits.');
    }
    previousDate = row.date;
  }

  if (debitTotal !== printedDebitTotal || creditTotal !== printedCreditTotal) {
    throw new BadRequestException('The Axis Bank transaction totals did not reconcile with the extracted rows.');
  }
  if (Math.abs(balance - printedClosingBalance) > 1 || Math.abs(rows.at(-1)!.balanceMinor - printedClosingBalance) > 1) {
    throw new BadRequestException('The Axis Bank closing balance did not reconcile with the extracted rows.');
  }

  return {
    rows: rows.map(({ balanceMinor: _balance, ...row }) => row),
    closingBalanceMinor: printedClosingBalance
  };
}

export const axisPdfParser: BankPdfParser = {
  id: 'AXIS',
  institutionAliases: ['AXIS', 'AXIS BANK'],
  matches(document) {
    const hasBankHeader = document.tablePages.some((page) => page.tables.some((table) => table.some(isAxisBankHeader)));
    // For CC statements, text match alone is sufficient — the parser handles header-less layouts internally.
    // Bank statements still require both text and header to avoid false positives.
    return (axisBankTextMatches(document) && hasBankHeader) || axisCcTextMatches(document);
  },
  parse: parseAxisDocument,
};
