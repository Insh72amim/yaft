import { BadRequestException } from '@nestjs/common';
import type ExcelJS from 'exceljs';
import type { ParsedRow } from './bank-pdf-parser';

export function parseAxisCcExcel(sheet: ExcelJS.Worksheet): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let inTransactions = false;

  sheet.eachRow((row, rowNumber) => {
    // Detect start of transactions
    if (!inTransactions) {
      const col1 = String(row.getCell(1).text).trim();
      const col2 = String(row.getCell(2).text).trim();
      if (col1 === 'Date' && col2 === 'Transaction Details') {
        inTransactions = true;
      }
      return;
    }

    const firstCol = String(row.getCell(1).text).trim();
    
    // Stop at end of statement
    if (firstCol.includes('** End of Statement **') || !firstCol) {
      return;
    }

    // Attempt to parse row
    const dateText = firstCol;
    const description = String(row.getCell(2).text).trim();
    const amountText = String(row.getCell(4).text).trim(); // Usually format: '₹ 2.00' or similar
    const debitCredit = String(row.getCell(5).text).trim(); // 'Debit' or 'Credit'

    if (!description || !amountText || !debitCredit) {
      return; // Skip invalid or summary rows inside the block
    }

    // Parse date (e.g., '21 Jun \'26')
    const dateMatch = dateText.match(/^(\d{1,2})\s+([a-zA-Z]{3})\s+'(\d{2})$/);
    if (!dateMatch) return;

    const day = parseInt(dateMatch[1], 10);
    const monthStr = dateMatch[2].toLowerCase();
    const year = 2000 + parseInt(dateMatch[3], 10);
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = monthNames.indexOf(monthStr);
    if (month === -1) return;

    const date = new Date(Date.UTC(year, month, day));

    // Parse amount
    const parsedAmount = Number(amountText.replace(/[₹,$\s]/g, '').replace(/,/g, ''));
    if (Number.isNaN(parsedAmount)) return;

    let amountMinor = Math.round(parsedAmount * 100);
    
    // In YaFT, Debit is negative (spend), Credit is positive (payment/refund)
    if (debitCredit.toLowerCase() === 'debit') {
      amountMinor = -amountMinor;
    }

    rows.push({
      date,
      description,
      amountMinor,
      rowNumber,
    });
  });

  if (rows.length === 0) {
    throw new BadRequestException('No transaction rows were detected in this Axis CC statement.');
  }

  return rows;
}
