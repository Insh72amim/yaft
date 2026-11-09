import { BadRequestException } from '@nestjs/common';
import {
  isCreditIndicator,
  isDebitIndicator,
  normalizeHeaderKey,
  MONTH_NAME_TO_INDEX,
} from '@yaft/shared';
import type { BankPdfParser, ParsedRow, PdfStatementDocument } from './bank-pdf-parser';

export type GenericParsedRow = ParsedRow & { balanceMinor?: number };

const SUMMARY_ROW_REGEX = /^(total|closing balance|opening balance|brought forward|carried forward|statement summary|dr count|cr count|sub total|grand total|page\s+\d+|b\/f|c\/f|summary\s*:|this is a computer|generated on|please check)\b/i;

const DEBIT_KEYWORDS_REGEX = /\b(dr|dr\.|debit|withdrawal|withdrawals|atm|pos|purchase|paid to|to transfer|transfer to|tfr to|ach dr|ach\/dr|upi\/dr|charges|fee|interest debit|penalty|tax|tds|emi|reversal dr)\b/i;
const CREDIT_KEYWORDS_REGEX = /\b(cr|cr\.|credit|deposit|deposits|salary|refund|cashback|by transfer|transfer from|tfr from|ach cr|ach\/cr|upi\/cr|interest credit|interest received|dividend|reversed|reversal cr)\b/i;

export function parseGenericDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const clean = String(value).replace(/\s+/g, ' ').trim();
  if (!clean || clean === '-' || clean === '--') return null;

  // 1. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy4 = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy4) {
    const day = Number(dmy4[1]);
    const month = Number(dmy4[2]) - 1;
    const year = Number(dmy4[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month, day));
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
        return d;
      }
    }
  }

  // 2. DD/MM/YY or DD-MM-YY or DD.MM.YY
  const dmy2 = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (dmy2) {
    const day = Number(dmy2[1]);
    const month = Number(dmy2[2]) - 1;
    let year = Number(dmy2[3]);
    year += year < 70 ? 2000 : 1900;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month, day));
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
        return d;
      }
    }
  }

  // 3. DD Mon YYYY / DD-Mon-YYYY / DD-MMM-YY / DD-MMM-YYYY e.g. "25 Sep 2026", "25-SEP-2026", "25 Sep 26"
  const dMonY = clean.match(/^(\d{1,2})[\s\-\/\.]([a-zA-Z]{3,9})[\s\-\/\.]'?(\d{2,4})/);
  if (dMonY) {
    const day = Number(dMonY[1]);
    const monStr = dMonY[2].toLowerCase().slice(0, 3);
    if (monStr in MONTH_NAME_TO_INDEX) {
      const month = MONTH_NAME_TO_INDEX[monStr];
      let year = Number(dMonY[3]);
      if (year < 100) year += year < 70 ? 2000 : 1900;
      if (day >= 1 && day <= 31) {
        const d = new Date(Date.UTC(year, month, day));
        if (d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
          return d;
        }
      }
    }
  }

  // 4. Mon DD, YYYY e.g. "Sep 25, 2026"
  const monDY = clean.match(/^([a-zA-Z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})/);
  if (monDY) {
    const monStr = monDY[1].toLowerCase().slice(0, 3);
    if (monStr in MONTH_NAME_TO_INDEX) {
      const month = MONTH_NAME_TO_INDEX[monStr];
      const day = Number(monDY[2]);
      let year = Number(monDY[3]);
      if (year < 100) year += year < 70 ? 2000 : 1900;
      if (day >= 1 && day <= 31) {
        const d = new Date(Date.UTC(year, month, day));
        if (d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
          return d;
        }
      }
    }
  }

  // 5. YYYY-MM-DD or YYYY/MM/DD
  const ymd = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]) - 1;
    const day = Number(ymd[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month, day));
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
        return d;
      }
    }
  }

  return null;
}

export function parseGenericMoney(value: string | undefined | null): number | null {
  if (!value) return null;
  const clean = String(value).replace(/\s+/g, ' ').trim();
  if (!clean || clean === '-' || clean === '--' || clean === 'NIL' || clean === '0.00' || clean === '0') return null;

  const isDr = /\b(dr|debit)\b/i.test(clean) || /^\(.*\)$/.test(clean) || /^-\s*\d/.test(clean) || /\bdr$/i.test(clean);
  const isCr = /\b(cr|credit)\b/i.test(clean) || /\bcr$/i.test(clean);

  const numStr = clean
    .replace(/(?:INR|Rs\.?|₹|\$|€|£)/gi, '')
    .replace(/\b(?:CR|DR)\b/gi, '')
    .replace(/[()]/g, '')
    .replace(/,/g, '')
    .trim();

  const num = Number(numStr);
  if (!Number.isFinite(num) || num === 0) return null;

  const minor = Math.round(Math.abs(num) * 100);
  return isDr ? -minor : isCr ? minor : minor;
}

export function extractGenericReference(narration: string, cellRef?: string): string | undefined {
  if (cellRef) {
    const c = cellRef.replace(/\s+/g, ' ').trim();
    if (c && c !== '-' && c !== '--' && c.length >= 2 && !/^(NIL|NA|NONE)$/i.test(c)) {
      return c.slice(0, 100);
    }
  }

  const text = narration.replace(/\s+/g, ' ').trim();

  // 1. UPI Ref / 12-digit RRN
  const upiFull = text.match(/\bUPI(?:[-/][A-Za-z0-9]+)*[-/](\d{12})\b/i)
    || text.match(/\bUPI\/(?:P2A|P2M|P2P|CRADJ|REV|DR|CR)?\/?([A-Z0-9]{8,18})\b/i)
    || text.match(/\bUPI\s*[-/:]\s*([A-Z0-9]{8,18})\b/i)
    || text.match(/\b(\d{12})\b/);
  if (upiFull) return upiFull[1].slice(0, 100);

  // 2. IMPS Ref
  const impsMatch = text.match(/\bIMPS(?:[-/][A-Za-z0-9]+)*[-/:]?\s*([A-Z0-9]{8,18})\b/i)
    || text.match(/\bIMPS\s*[-/:]\s*([A-Z0-9]{8,18})\b/i)
    || text.match(/\bIMPS\s+([A-Z0-9]{8,18})\b/i)
    || text.match(/\bIMPS\/([A-Z0-9]{8,18})/i);
  if (impsMatch) return impsMatch[1].slice(0, 100);

  // 3. NEFT / RTGS Ref
  const neftMatch = text.match(/\b(?:NEFT|RTGS)\s*[-/*:]\s*([A-Z0-9]{8,22})\b/i)
    || text.match(/\b(N[A-Z0-9]{10,20})\b/i)
    || text.match(/\b(R[A-Z0-9]{10,20})\b/i);
  if (neftMatch) return neftMatch[1].slice(0, 100);

  // 4. Cheque
  const chqMatch = text.match(/\b(?:CHQ|CHEQUE|CHQNO|CHQ\s*NO)\s*[:#.-]?\s*(\d{4,8})\b/i);
  if (chqMatch) return chqMatch[1].slice(0, 100);

  // 5. General Ref / Txn ID
  const genRef = text.match(/\b(?:REF|TXN|UTR|RRN|TRAN)\s*#?[:= -]\s*([A-Z0-9]{6,25})\b/i);
  if (genRef) return genRef[1].slice(0, 100);

  return undefined;
}

export type ColumnMapping = {
  dateCol: number;
  valDateCol: number;
  descCol: number;
  refCol: number;
  debitCol: number;
  creditCol: number;
  amountCol: number;
  typeCol: number;
  balanceCol: number;
};

export function detectHeaderColumns(cells: string[]): ColumnMapping | null {
  const norm = cells.map((c) => normalizeHeaderKey(c));

  let dateCol = -1;
  let valDateCol = -1;
  let descCol = -1;
  let refCol = -1;
  let debitCol = -1;
  let creditCol = -1;
  let amountCol = -1;
  let typeCol = -1;
  let balanceCol = -1;

  for (let i = 0; i < norm.length; i++) {
    const h = norm[i];
    if (!h) continue;

    // Date / Value Date
    if (/^(value date|val date|value_date|val_date|vdate|v_date)$/.test(h)) {
      valDateCol = i;
    } else if (/^(date|txn date|txndate|transaction date|tran date|trans date|date of txn|posting date|posted date|entry date|booking date|payment date|tdate|t_date)$/.test(h)
      || (h.includes('date') && !h.includes('value') && !h.includes('update') && !h.includes('birth'))) {
      if (dateCol === -1) dateCol = i;
    }

    // Description / Particulars
    if (/^(narration|description|particulars|transaction details|details|remarks|transaction remark|transaction particulars|payee merchant|description narration|desc|txn description|summary|activity|narrative)$/.test(h)
      || (h.includes('particular') || h.includes('narration') || h.includes('description') || h.includes('details') || h.includes('remark'))) {
      if (descCol === -1) descCol = i;
    }

    // Cheque / Reference
    if (/^(chq no|cheque no|chq|cheque|ref no|reference no|reference|chq ref no|cheque ref no|utr|rrn|txn id|transaction id|trans id|journal no|tran id|ref|chq utr)$/.test(h)
      || (h.includes('ref') && !h.includes('refund')) || h.includes('cheque') || h.includes('chq') || h.includes('utr')) {
      if (refCol === -1) refCol = i;
    }

    // Debit / Withdrawal
    if (/^(debit|withdrawal|withdrawals|dr|dr amount|debit amount|withdrawal amt|debit inr|debit rs|dr amt|payment|withdraw|dr inr|dr rs)$/.test(h)
      || (h.includes('debit') || h.includes('withdrawal') || (h.includes('dr') && !h.includes('address') && !h.includes('branch')))) {
      if (debitCol === -1) debitCol = i;
    }

    // Credit / Deposit
    if (/^(credit|deposit|deposits|cr|cr amount|credit amount|deposit amt|credit inr|credit rs|cr amt|receipt|credit amt|cr inr|cr rs)$/.test(h)
      || (h.includes('credit') || h.includes('deposit') || (h.includes('cr') && !h.includes('description') && !h.includes('branch')))) {
      if (creditCol === -1) creditCol = i;
    }

    // Amount
    if (/^(amount|txn amount|transaction amount|amount inr|amount rs|net amount|amt|trans amount|total amt)$/.test(h)
      || (h.includes('amount') && !h.includes('debit') && !h.includes('credit') && !h.includes('balance') && !h.includes('limit'))) {
      if (amountCol === -1) amountCol = i;
    }

    // Type / Cr/Dr
    if (/^(type|dr cr|cr dr|txn type|d c|c d|dr or cr|cr or dr)$/.test(h) || (h.includes('type') && !h.includes('asset'))) {
      if (typeCol === -1) typeCol = i;
    }

    // Balance
    if (/^(balance|closing balance|running balance|available balance|bal|book balance|balance inr|balance rs|net balance|account balance|bal inr)$/.test(h)
      || (h.includes('balance') || h.includes('running bal') || h.includes('closing bal') || h.includes('avail bal'))) {
      if (balanceCol === -1) balanceCol = i;
    }
  }

  const hasDate = dateCol !== -1;
  const hasDesc = descCol !== -1;
  const hasMoney = debitCol !== -1 || creditCol !== -1 || amountCol !== -1;

  if (hasDate && hasDesc && hasMoney) {
    return {
      dateCol,
      valDateCol,
      descCol,
      refCol,
      debitCol,
      creditCol,
      amountCol,
      typeCol,
      balanceCol,
    };
  }

  return null;
}

export function parseGenericBankTables(document: PdfStatementDocument): { rows: GenericParsedRow[]; closingBalanceMinor?: number } {
  const rows: GenericParsedRow[] = [];
  let currentMapping: ColumnMapping | null = null;
  let lastClosingBalance: number | undefined = undefined;
  let lastBalance: number | null = null;

  for (const page of document.tablePages || []) {
    for (const table of page.tables || []) {
      for (const rawCells of table) {
        const cells = rawCells.map((c) => String(c ?? '').trim());
        if (cells.every((c) => !c)) continue;

        // Check if this row is a new table header
        const detected = detectHeaderColumns(cells);
        if (detected) {
          currentMapping = detected;
          continue;
        }

        if (!currentMapping) continue;

        const dateStr = cells[currentMapping.dateCol];
        const rowDate = parseGenericDate(dateStr);

        // Check summary/footer row
        const rowText = cells.join(' ').trim();
        if (SUMMARY_ROW_REGEX.test(rowText)) {
          if (currentMapping.balanceCol !== -1 && cells[currentMapping.balanceCol]) {
            const bal = parseGenericMoney(cells[currentMapping.balanceCol]);
            if (bal !== null) lastClosingBalance = bal;
          }
          continue;
        }

        if (rowDate) {
          const rawDesc = (cells[currentMapping.descCol] || '').replace(/\s+/g, ' ').trim();
          const desc = rawDesc || 'Bank transaction';
          const postedDate = currentMapping.valDateCol !== -1 ? parseGenericDate(cells[currentMapping.valDateCol]) ?? undefined : undefined;
          const rawCellRef = currentMapping.refCol !== -1 ? cells[currentMapping.refCol] : undefined;
          const reference = extractGenericReference(desc, rawCellRef);

          const debit = currentMapping.debitCol !== -1 ? parseGenericMoney(cells[currentMapping.debitCol]) : null;
          const credit = currentMapping.creditCol !== -1 ? parseGenericMoney(cells[currentMapping.creditCol]) : null;
          const rawAmount = currentMapping.amountCol !== -1 ? parseGenericMoney(cells[currentMapping.amountCol]) : null;
          const typeStr = currentMapping.typeCol !== -1 ? cells[currentMapping.typeCol] : '';
          const bal = currentMapping.balanceCol !== -1 ? parseGenericMoney(cells[currentMapping.balanceCol]) : null;

          let amountMinor: number | null = null;
          if (debit !== null && debit !== 0) {
            amountMinor = -Math.abs(debit);
          } else if (credit !== null && credit !== 0) {
            amountMinor = Math.abs(credit);
          } else if (rawAmount !== null && rawAmount !== 0) {
            if (isCreditIndicator(typeStr) || isCreditIndicator(cells[currentMapping.amountCol])) {
              amountMinor = Math.abs(rawAmount);
            } else if (isDebitIndicator(typeStr) || isDebitIndicator(cells[currentMapping.amountCol])) {
              amountMinor = -Math.abs(rawAmount);
            } else if (lastBalance !== null && bal !== null) {
              const diff = bal - lastBalance;
              amountMinor = diff < 0 ? -Math.abs(rawAmount) : Math.abs(rawAmount);
            } else if (DEBIT_KEYWORDS_REGEX.test(desc)) {
              amountMinor = -Math.abs(rawAmount);
            } else if (CREDIT_KEYWORDS_REGEX.test(desc)) {
              amountMinor = Math.abs(rawAmount);
            } else {
              amountMinor = rawAmount;
            }
          }

          if (amountMinor !== null && amountMinor !== 0) {
            if (bal !== null) {
              lastBalance = bal;
              lastClosingBalance = bal;
            }

            const dateKey = rowDate.toISOString().slice(0, 10);
            const identity = reference ? `ref:${reference.toLowerCase()}` : `desc:${desc.toLowerCase()}`;
            const dedupeKey = `gen_tbl|${dateKey}|${amountMinor}|${identity}|row:${rows.length + 1}`;

            rows.push({
              date: rowDate,
              postedDate,
              description: desc.slice(0, 500),
              amountMinor,
              reference,
              balanceMinor: bal !== null ? bal : undefined,
              dedupeKey,
              rowNumber: rows.length + 1,
            });
          }
        } else {
          // Multiline text continuation for description
          if (rows.length > 0 && currentMapping.descCol !== -1 && cells[currentMapping.descCol]) {
            const extraDesc = cells[currentMapping.descCol].replace(/\s+/g, ' ').trim();
            const debit = currentMapping.debitCol !== -1 ? parseGenericMoney(cells[currentMapping.debitCol]) : null;
            const credit = currentMapping.creditCol !== -1 ? parseGenericMoney(cells[currentMapping.creditCol]) : null;

            if (extraDesc && debit === null && credit === null && !SUMMARY_ROW_REGEX.test(extraDesc)) {
              const prev = rows[rows.length - 1];
              prev.description = `${prev.description} ${extraDesc}`.slice(0, 500);
              if (!prev.reference) {
                prev.reference = extractGenericReference(prev.description, currentMapping.refCol !== -1 ? cells[currentMapping.refCol] : undefined);
              }
            }
          }
        }
      }
    }
  }

  return { rows, closingBalanceMinor: lastClosingBalance };
}

/**
 * Universal Multi-Line Text Stream Chunking Parser
 * Handles any bank statement PDF where text lines are extracted sequentially.
 * Segments text into transaction blocks bounded by transaction dates.
 */
export function parseGenericBankTextLines(document: PdfStatementDocument): { rows: GenericParsedRow[]; closingBalanceMinor?: number } {
  const rows: GenericParsedRow[] = [];
  let lastClosingBalance: number | undefined = undefined;
  let lastRunningBalance: number | null = null;

  // Flatten all lines across pages
  const allLines: string[] = [];
  for (const page of (document.textPages || []).slice().sort((a, b) => a.num - b.num)) {
    const pageLines = page.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    allLines.push(...pageLines);
  }

  if (allLines.length === 0) {
    return { rows: [], closingBalanceMinor: undefined };
  }

  // Find date pattern in line
  // Supports standalone dates or dates preceded by index e.g. "1 02/04/2026", "02/04/2026 02/04/2026", "15-Sep-2026"
  const DATE_MATCH_REGEX = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\s\-\/\.][a-zA-Z]{3,9}[\s\-\/\.]'?\d{2,4}|[a-zA-Z]{3,9}\s+\d{1,2},?\s+\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/;

  type Block = {
    firstDate: Date;
    secondDate?: Date;
    lines: string[];
  };

  const blocks: Block[] = [];
  let currentBlock: Block | null = null;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];

    // Check if line is a table header or summary header
    if (SUMMARY_ROW_REGEX.test(line)) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Skip column header lines
    const norm = normalizeHeaderKey(line);
    if ((norm.includes('date') && norm.includes('particular')) || (norm.includes('date') && norm.includes('amount')) || (norm.includes('debit') && norm.includes('credit'))) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Search for date tokens in the line
    const dateMatches = [...line.matchAll(new RegExp(DATE_MATCH_REGEX, 'g'))];
    const dates = dateMatches.map((m) => parseGenericDate(m[0])).filter((d): d is Date => d !== null);

    if (dates.length >= 1) {
      // Line starts or contains a new transaction date
      // Check if the date is at the beginning of the line (or after a row number e.g. "1", "12.")
      const firstMatch = dateMatches[0];
      const prefix = line.slice(0, firstMatch.index).trim();
      const isHeaderDate = /^(statement|generated|from|to|as on|period|date of statement)\b/i.test(prefix);

      if (!isHeaderDate && (/^\d{1,4}\.?$/.test(prefix) || prefix.length === 0 || prefix === '-' || prefix === '*')) {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          firstDate: dates[0],
          secondDate: dates.length > 1 ? dates[1] : undefined,
          lines: [line],
        };
        continue;
      }
    }

    if (currentBlock) {
      currentBlock.lines.push(line);
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Helper to check if a block contains monetary values
  function blockHasMoney(b: Block): boolean {
    const text = b.lines.join(' ');
    const tokens = text.split(/\s+/).filter(Boolean);
    return tokens.some((t) => /^(?:₹|Rs\.?|INR)?\s*-?[\d,]+\.\d{2}(?:CR|DR|Cr|Dr)?$/i.test(t));
  }

  // Merge incomplete blocks (e.g. Line 1 has Narration+Date, Line 2 has Value Date+Amounts)
  const mergedBlocks: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!blockHasMoney(b) && i + 1 < blocks.length && blockHasMoney(blocks[i + 1])) {
      // Merge b into blocks[i + 1]
      const next = blocks[i + 1];
      next.lines = [...b.lines, ...next.lines];
      next.secondDate = next.firstDate;
      next.firstDate = b.firstDate;
    } else {
      mergedBlocks.push(b);
    }
  }

  // Parse each transaction block
  for (const block of mergedBlocks) {
    const blockText = block.lines.join(' ');
    
    // Extract all money tokens from the block
    // Matches numbers like "100.00", "1,000.50", "₹500.00", "50.00CR", "100.00 DR", "-"
    const rawTokens = blockText.split(/\s+/).filter(Boolean);
    const moneyCandidates: Array<{ index: number; text: string; minor: number; isDr: boolean; isCr: boolean }> = [];

    rawTokens.forEach((token, idx) => {
      const isDash = token === '-' || token === '--' || token === 'NIL';
      const isMoney = /^(?:₹|Rs\.?|INR)?\s*-?[\d,]+\.\d{2}(?:CR|DR|Cr|Dr)?$/i.test(token) || isDash;
      if (isMoney) {
        const val = isDash ? 0 : parseGenericMoney(token);
        const isDr = /\b(dr|debit)\b/i.test(token) || /^\(.*\)$/.test(token) || /^-\s*\d/.test(token) || /\bdr$/i.test(token);
        const isCr = /\b(cr|credit)\b/i.test(token) || /\bcr$/i.test(token);
        if (val !== null) {
          moneyCandidates.push({ index: idx, text: token, minor: val, isDr, isCr });
        }
      }
    });

    if (moneyCandidates.length === 0) continue;

    let amountMinor: number | null = null;
    let balanceMinor: number | undefined = undefined;

    // Pattern A: 3 money values at the end of block: [Debit, Credit, Balance]
    if (moneyCandidates.length >= 3) {
      const debitCand = moneyCandidates[moneyCandidates.length - 3];
      const creditCand = moneyCandidates[moneyCandidates.length - 2];
      const balCand = moneyCandidates[moneyCandidates.length - 1];

      const debitVal = Math.abs(debitCand.minor);
      const creditVal = Math.abs(creditCand.minor);

      if (debitVal > 0 && creditVal === 0) {
        amountMinor = -debitVal;
      } else if (creditVal > 0 && debitVal === 0) {
        amountMinor = creditVal;
      } else if (debitVal > 0) {
        amountMinor = -debitVal;
      } else if (creditVal > 0) {
        amountMinor = creditVal;
      }

      if (balCand.minor > 0 || balCand.text.includes('.')) {
        balanceMinor = balCand.minor;
      }
    }
    // Pattern B: 2 money values: [Amount, Balance]
    else if (moneyCandidates.length === 2) {
      const amtCand = moneyCandidates[0];
      const balCand = moneyCandidates[1];
      const rawAmt = Math.abs(amtCand.minor);
      const balVal = balCand.minor;

      if (amtCand.isCr || balCand.text.toUpperCase().endsWith('CR') && !amtCand.text.toUpperCase().endsWith('DR')) {
        // Check Dr/Cr explicit flags
        if (amtCand.isDr) amountMinor = -rawAmt;
        else if (amtCand.isCr) amountMinor = rawAmt;
      }

      if (amountMinor === null) {
        // Check running balance difference
        if (lastRunningBalance !== null && balVal !== null) {
          const diff = balVal - lastRunningBalance;
          if (diff < 0) {
            amountMinor = -rawAmt;
          } else if (diff > 0) {
            amountMinor = rawAmt;
          }
        }
      }

      if (amountMinor === null) {
        // Fallback to keyword matching in blockText
        if (DEBIT_KEYWORDS_REGEX.test(blockText)) {
          amountMinor = -rawAmt;
        } else if (CREDIT_KEYWORDS_REGEX.test(blockText)) {
          amountMinor = rawAmt;
        } else {
          amountMinor = amtCand.minor < 0 ? amtCand.minor : -rawAmt; // default to debit if outflow
        }
      }

      balanceMinor = balVal;
    }
    // Pattern C: 1 money value: [Amount]
    else if (moneyCandidates.length === 1) {
      const amtCand = moneyCandidates[0];
      const rawAmt = Math.abs(amtCand.minor);

      if (amtCand.isDr || DEBIT_KEYWORDS_REGEX.test(blockText)) {
        amountMinor = -rawAmt;
      } else if (amtCand.isCr || CREDIT_KEYWORDS_REGEX.test(blockText)) {
        amountMinor = rawAmt;
      } else {
        amountMinor = amtCand.minor;
      }
    }

    if (amountMinor === null || amountMinor === 0) continue;

    if (balanceMinor !== undefined) {
      lastRunningBalance = balanceMinor;
      lastClosingBalance = balanceMinor;
    }

    // Clean narration by removing dates and money values
    let desc = blockText;
    // Strip dates
    desc = desc.replace(new RegExp(DATE_MATCH_REGEX, 'g'), ' ');
    // Strip money candidates
    moneyCandidates.forEach((c) => {
      desc = desc.replace(c.text, ' ');
    });
    // Strip leading row numbers e.g. "1 ", "12 "
    desc = desc.replace(/^\s*\d{1,4}\s+/, ' ');
    desc = desc.replace(/\s+/g, ' ').trim();

    if (!desc || desc.length < 2) {
      desc = 'Bank transaction';
    }

    const reference = extractGenericReference(blockText) || extractGenericReference(desc);
    const dateKey = block.firstDate.toISOString().slice(0, 10);
    const identity = reference ? `ref:${reference.toLowerCase()}` : `desc:${desc.toLowerCase()}`;
    const dedupeKey = `gen_block|${dateKey}|${amountMinor}|${identity}|row:${rows.length + 1}`;

    rows.push({
      date: block.firstDate,
      postedDate: block.secondDate,
      description: desc.slice(0, 500),
      amountMinor,
      reference,
      balanceMinor,
      dedupeKey,
      rowNumber: rows.length + 1,
    });
  }

  return { rows, closingBalanceMinor: lastClosingBalance };
}

export const genericBankPdfParser: BankPdfParser = {
  id: 'GENERIC',
  institutionAliases: [
    'GENERIC',
    'OTHER BANK',
    'STANDARD BANK',
    'HDFC BANK',
    'ICICI BANK',
    'KOTAK MAHINDRA BANK',
    'CANARA BANK',
    'BANK OF BARODA',
    'FEDERAL BANK',
    'INDUSIND BANK',
    'UNION BANK OF INDIA',
    'PUNJAB NATIONAL BANK',
    'STATE BANK OF INDIA',
    'AXIS BANK',
  ],
  matches(_document: PdfStatementDocument): boolean {
    return true; // Universal fallback matching
  },
  parse(document: PdfStatementDocument): { rows: ParsedRow[]; closingBalanceMinor?: number } {
    // 1. Try table-based extraction first
    const tableResult = parseGenericBankTables(document);
    if (tableResult.rows && tableResult.rows.length > 0) {
      return tableResult;
    }

    // 2. Try multi-line text stream block extraction
    const textResult = parseGenericBankTextLines(document);
    if (textResult.rows && textResult.rows.length > 0) {
      return textResult;
    }

    throw new BadRequestException('No transaction rows could be extracted from this statement PDF. Ensure the PDF contains a standard transaction table with Date, Narration/Description, Amount, and Balance and is not a scanned photo/image.');
  },
};
