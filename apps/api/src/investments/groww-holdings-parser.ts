import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  parseMoneyToMinor,
  normalizeHeaderKey,
  INVESTMENT_COLUMN_ALIASES,
} from '@yaft/shared';

export interface ParsedHolding {
  assetName: string;
  assetType: 'MUTUAL_FUND' | 'STOCK';
  quantity: number;
  averagePriceMinor: number;
  currentValueMinor?: number;
  unrealizedPnlMinor?: number;
}

function parseQuantity(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function parseGrowwHoldingsXlsx(buffer: Buffer): Promise<ParsedHolding[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException('Invalid XLSX file.');
  }

  const sheet = workbook.getWorksheet('Holdings');
  if (!sheet) {
    throw new BadRequestException('The workbook must contain a "Holdings" sheet for Groww exports.');
  }

  let headerRowIndex = -1;
  sheet.eachRow((row, rowNumber) => {
    if (headerRowIndex === -1) {
      const firstCol = normalizeHeaderKey(row.getCell(1).value);
      if (INVESTMENT_COLUMN_ALIASES.schemeOrSymbol.includes(firstCol)) {
        headerRowIndex = rowNumber;
      }
    }
  });

  if (headerRowIndex === -1) {
    throw new BadRequestException('Could not find the header row starting with "Scheme Name" in the Holdings sheet.');
  }

  const holdings: ParsedHolding[] = [];
  const headerRow = sheet.getRow(headerRowIndex);
  
  const colIndexes = {
    schemeName: -1,
    units: -1,
    investedValue: -1,
    currentValue: -1,
    returns: -1,
  };

  headerRow.eachCell((cell, colNumber) => {
    const header = normalizeHeaderKey(cell.value);
    if (INVESTMENT_COLUMN_ALIASES.schemeOrSymbol.includes(header)) colIndexes.schemeName = colNumber;
    if (INVESTMENT_COLUMN_ALIASES.units.includes(header)) colIndexes.units = colNumber;
    if (INVESTMENT_COLUMN_ALIASES.investedValue.includes(header)) colIndexes.investedValue = colNumber;
    if (INVESTMENT_COLUMN_ALIASES.currentValue.includes(header)) colIndexes.currentValue = colNumber;
    if (INVESTMENT_COLUMN_ALIASES.returns.includes(header)) colIndexes.returns = colNumber;
  });

  if (colIndexes.schemeName === -1 || colIndexes.units === -1 || colIndexes.investedValue === -1) {
    throw new BadRequestException('Missing required columns in the Holdings sheet (Scheme Name, Units, Invested Value).');
  }


  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const schemeName = String(row.getCell(colIndexes.schemeName).value || '').trim();
    if (!schemeName) return; // Skip empty rows

    const units = parseQuantity(row.getCell(colIndexes.units).value);
    const investedValueMinor = parseMoneyToMinor(row.getCell(colIndexes.investedValue).value);
    const currentValueMinor = parseMoneyToMinor(row.getCell(colIndexes.currentValue).value);
    const returnsMinor = parseMoneyToMinor(row.getCell(colIndexes.returns).value);

    if (units === undefined || investedValueMinor === null || units <= 0) {
      return; // Skip invalid rows
    }

    const averagePriceMinor = Math.round(investedValueMinor / units);

    holdings.push({
      assetName: schemeName,
      assetType: 'MUTUAL_FUND', // Groww holdings export in this format is primarily for MFs
      quantity: units,
      averagePriceMinor,
      currentValueMinor: currentValueMinor ?? undefined,
      unrealizedPnlMinor: returnsMinor ?? undefined,
    });
  });

  if (holdings.length === 0) {
    throw new BadRequestException('No valid holdings were found in the export.');
  }

  return holdings;
}
