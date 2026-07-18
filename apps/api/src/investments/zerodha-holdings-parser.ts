import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export type ZerodhaAssetType = 'STOCK' | 'MUTUAL_FUND' | 'ETF' | 'OTHER';

export type ParsedZerodhaHolding = {
  symbol: string;
  isin: string;
  sector?: string;
  assetType: ZerodhaAssetType;
  quantity: number;
  availableQuantity: number;
  discrepantQuantity: number;
  longTermQuantity?: number;
  pledgedQuantity: number;
  averagePriceMinor: number;
  previousClosingPriceMinor: number;
  currentValueMinor: number;
  unrealizedPnlMinor: number;
};

const SUPPORTED_SHEETS = new Set(['equity', 'mutual funds']);
const MAX_ROWS = 20_000;
const MAX_COLUMNS = 40;
const MONEY_TOLERANCE_RUPEES = 0.1;

function normalized(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function displayValue(cell: ExcelJS.Cell) {
  if (cell.value && typeof cell.value === 'object' && 'formula' in cell.value) {
    throw new BadRequestException('Formula cells are not accepted in Zerodha holdings exports. Download a fresh holdings XLSX and try again.');
  }
  return cell.value;
}

function text(cell: ExcelJS.Cell) {
  return String(displayValue(cell) ?? '').trim();
}

function number(cell: ExcelJS.Cell, label: string, required = true) {
  const value = displayValue(cell);
  if ((value === null || value === undefined || value === '') && !required) return 0;
  const candidate = typeof value === 'number' ? value : Number(String(value).replace(/[₹,%\s]/g, '').replace(/,/g, ''));
  if (!Number.isFinite(candidate)) throw new BadRequestException(`Zerodha holding ${label} must be a finite number.`);
  return candidate;
}

function minorUnits(value: number) {
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result)) throw new BadRequestException('A Zerodha holding amount is outside the supported range.');
  return result;
}

function near(left: number, right: number) {
  return Math.abs(left - right) <= MONEY_TOLERANCE_RUPEES;
}

type SheetLayout = {
  headerRow: number;
  symbol: number;
  isin: number;
  sector?: number;
  instrumentType?: number;
  available: number;
  discrepant: number;
  longTerm?: number;
  pledged: number[];
  averagePrice: number;
  previousClosingPrice: number;
  unrealizedPnl: number;
};

function findColumn(headers: string[], words: string[], exact = false) {
  const index = headers.findIndex((header) => exact ? header === words.join(' ') : words.every((word) => header.includes(word)));
  return index < 0 ? undefined : index + 1;
}

function layoutFor(sheet: ExcelJS.Worksheet): SheetLayout {
  const sheetKind = normalized(sheet.name);
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 40); rowNumber += 1) {
    const headers = Array.from({ length: sheet.columnCount }, (_, index) => normalized(sheet.getRow(rowNumber).getCell(index + 1).value));
    const symbol = findColumn(headers, ['symbol'], true);
    if (!symbol) continue;
    const isin = findColumn(headers, ['isin'], true);
    const sector = findColumn(headers, ['sector'], true);
    const instrumentType = findColumn(headers, ['instrument', 'type']);
    const available = findColumn(headers, ['quantity', 'available']);
    const discrepant = findColumn(headers, ['quantity', 'discrepant']);
    const longTerm = findColumn(headers, ['quantity', 'long', 'term']);
    const pledged = headers.flatMap((header, index) => header.includes('quantity') && header.includes('pledged') ? [index + 1] : []);
    const averagePrice = findColumn(headers, ['average', 'price']);
    const previousClosingPrice = findColumn(headers, ['previous', 'closing', 'price']);
    const unrealizedPnl = findColumn(headers, ['unrealized', 'p', 'l'], true);
    const sheetSpecificColumnsPresent = sheetKind === 'equity' ? Boolean(sector && longTerm) : Boolean(instrumentType);
    if (!isin || !available || !discrepant || pledged.length !== 2 || !averagePrice || !previousClosingPrice || !unrealizedPnl || !sheetSpecificColumnsPresent) {
      throw new BadRequestException(`The Zerodha ${sheet.name} sheet layout is unsupported or has changed.`);
    }
    return { headerRow: rowNumber, symbol, isin, sector, instrumentType, available, discrepant, longTerm,
      pledged, averagePrice, previousClosingPrice, unrealizedPnl };
  }
  throw new BadRequestException(`The Zerodha ${sheet.name} sheet does not contain the supported holdings table.`);
}

function assetType(sheetKind: string, sector: string | undefined, instrumentType: string | undefined): ZerodhaAssetType {
  const description = normalized(`${sector ?? ''} ${instrumentType ?? ''}`);
  if (description.includes('exchange traded fund') || /(^| )etf( |$)/.test(description)) return 'ETF';
  if (sheetKind === 'mutual funds' || description.includes('mutual fund')) return 'MUTUAL_FUND';
  if (sheetKind === 'equity') return 'STOCK';
  return 'OTHER';
}

function summaryValue(sheet: ExcelJS.Worksheet, beforeRow: number, label: string) {
  for (let rowNumber = 1; rowNumber < beforeRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      if (normalized(row.getCell(column).value) !== label) continue;
      for (let valueColumn = column + 1; valueColumn <= sheet.columnCount; valueColumn += 1) {
        const value = displayValue(row.getCell(valueColumn));
        if (typeof value === 'number' && Number.isFinite(value)) return value;
      }
    }
  }
  throw new BadRequestException(`The Zerodha ${sheet.name} sheet is missing its ${label} summary.`);
}

function parseSheet(sheet: ExcelJS.Worksheet) {
  if (sheet.rowCount > MAX_ROWS || sheet.columnCount > MAX_COLUMNS) {
    throw new BadRequestException('The Zerodha holdings workbook is larger than the supported report layout.');
  }
  const sheetKind = normalized(sheet.name);
  const layout = layoutFor(sheet);
  const rows: ParsedZerodhaHolding[] = [];
  let investedValue = 0;
  let presentValue = 0;
  let unrealizedPnl = 0;

  for (let rowNumber = layout.headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const symbol = text(row.getCell(layout.symbol)).toUpperCase();
    const isin = text(row.getCell(layout.isin)).toUpperCase();
    const hasFinancialValue = [layout.available, layout.discrepant, ...layout.pledged, layout.averagePrice,
      layout.previousClosingPrice, layout.unrealizedPnl].some((column) => row.getCell(column).value !== null && row.getCell(column).value !== undefined && row.getCell(column).value !== '');
    if (!symbol && !isin && !hasFinancialValue) continue;
    if (!symbol || symbol.length > 80 || !/^[A-Z0-9][A-Z0-9 .&()/-]*$/.test(symbol)) {
      throw new BadRequestException(`Zerodha holdings row ${rowNumber} has an invalid symbol.`);
    }
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
      throw new BadRequestException(`Zerodha holdings row ${rowNumber} has an invalid ISIN.`);
    }

    const availableQuantity = number(row.getCell(layout.available), 'available quantity');
    const discrepantQuantity = number(row.getCell(layout.discrepant), 'discrepant quantity');
    const longTermQuantity = layout.longTerm === undefined ? undefined : number(row.getCell(layout.longTerm), 'long-term quantity');
    const pledgedQuantity = layout.pledged.reduce((sum, column) => sum + number(row.getCell(column), 'pledged quantity'), 0);
    const quantities = [availableQuantity, discrepantQuantity, pledgedQuantity, ...(longTermQuantity === undefined ? [] : [longTermQuantity])];
    if (quantities.some((value) => value < 0 || value > 1_000_000_000)) {
      throw new BadRequestException(`Zerodha holdings row ${rowNumber} has an invalid quantity.`);
    }
    const quantity = availableQuantity + discrepantQuantity + pledgedQuantity;
    if (quantity <= 0) throw new BadRequestException(`Zerodha holdings row ${rowNumber} has no owned quantity.`);
    if (longTermQuantity !== undefined && longTermQuantity > quantity) {
      throw new BadRequestException(`Zerodha holdings row ${rowNumber} has a long-term quantity larger than its owned quantity.`);
    }

    const averagePrice = number(row.getCell(layout.averagePrice), 'average price');
    const previousClosingPrice = number(row.getCell(layout.previousClosingPrice), 'previous closing price');
    const reportedPnl = number(row.getCell(layout.unrealizedPnl), 'unrealized P&L');
    if (averagePrice < 0 || previousClosingPrice < 0) {
      throw new BadRequestException(`Zerodha holdings row ${rowNumber} has a negative price.`);
    }
    const calculatedPnl = (previousClosingPrice - averagePrice) * quantity;
    if (!near(calculatedPnl, reportedPnl)) {
      throw new BadRequestException(`Zerodha holdings row ${rowNumber} does not reconcile its unrealized P&L.`);
    }

    const rowInvestedValue = averagePrice * quantity;
    const rowPresentValue = previousClosingPrice * quantity;
    investedValue += rowInvestedValue;
    presentValue += rowPresentValue;
    unrealizedPnl += reportedPnl;
    const sector = layout.sector === undefined ? undefined : text(row.getCell(layout.sector)).slice(0, 100) || undefined;
    const instrumentType = layout.instrumentType === undefined ? undefined : text(row.getCell(layout.instrumentType)).slice(0, 100) || undefined;
    rows.push({ symbol, isin, sector, assetType: assetType(sheetKind, sector, instrumentType), quantity,
      availableQuantity, discrepantQuantity, longTermQuantity, pledgedQuantity,
      averagePriceMinor: minorUnits(averagePrice), previousClosingPriceMinor: minorUnits(previousClosingPrice),
      currentValueMinor: minorUnits(rowPresentValue), unrealizedPnlMinor: minorUnits(reportedPnl) });
  }

  const reportedInvestedValue = summaryValue(sheet, layout.headerRow, 'invested value');
  const reportedPresentValue = summaryValue(sheet, layout.headerRow, 'present value');
  const reportedUnrealizedPnl = summaryValue(sheet, layout.headerRow, 'unrealized p l');
  if (!near(investedValue, reportedInvestedValue) || !near(presentValue, reportedPresentValue) || !near(unrealizedPnl, reportedUnrealizedPnl)) {
    throw new BadRequestException(`The Zerodha ${sheet.name} sheet totals do not reconcile.`);
  }
  return rows;
}

export async function parseZerodhaHoldings(file: Express.Multer.File): Promise<ParsedZerodhaHolding[]> {
  if (!file.originalname.toLowerCase().endsWith('.xlsx') || file.buffer.length < 4 || file.buffer.subarray(0, 2).toString() !== 'PK') {
    throw new BadRequestException('Upload the XLSX holdings report downloaded from Zerodha Console.');
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException('The Zerodha holdings workbook could not be read safely.');
  }
  const supportedSheets = workbook.worksheets.filter((sheet) => SUPPORTED_SHEETS.has(normalized(sheet.name)));
  if (!supportedSheets.length) {
    throw new BadRequestException('This workbook does not contain the supported Zerodha Equity or Mutual Funds holdings sheets.');
  }
  const holdings = supportedSheets.flatMap(parseSheet);
  if (!holdings.length) throw new BadRequestException('The Zerodha workbook contains no holdings to import.');
  const seen = new Set<string>();
  for (const holding of holdings) {
    if (seen.has(holding.symbol)) throw new BadRequestException(`The Zerodha workbook repeats the symbol ${holding.symbol}.`);
    seen.add(holding.symbol);
  }
  return holdings;
}
