import ExcelJS from 'exceljs';
import { parseZerodhaHoldings } from './zerodha-holdings-parser';

type SyntheticHolding = {
  symbol: string;
  isin: string;
  sector: string;
  available: number;
  discrepant?: number;
  longTerm?: number;
  pledgedMargin?: number;
  pledgedLoan?: number;
  averagePrice: number;
  previousClose: number;
};

async function workbookFile(rows: SyntheticHolding[], mutate?: (workbook: ExcelJS.Workbook) => void) {
  const workbook = new ExcelJS.Workbook();
  const equity = workbook.addWorksheet('Equity');
  equity.getCell('B11').value = 'Holdings';
  equity.getCell('B15').value = 'Invested Value';
  equity.getCell('B16').value = 'Present Value';
  equity.getCell('B17').value = 'Unrealized P&L';
  equity.getCell('B18').value = 'Unrealized P&L (%)';
  equity.getRow(23).values = [undefined, 'Symbol', 'ISIN', 'Sector', 'Quantity Available', 'Quantity Discrepant',
    'Quantity Long Term', 'Quantity Pledged (Margin)', 'Quantity Pledged (Loan)', 'Average Price',
    'Previous Closing Price', 'Unrealized P&L', 'Unrealized P&L (%)'];
  let invested = 0;
  let present = 0;
  let pnl = 0;
  rows.forEach((holding, index) => {
    const quantity = holding.available + (holding.discrepant ?? 0) + (holding.pledgedMargin ?? 0) + (holding.pledgedLoan ?? 0);
    const rowPnl = (holding.previousClose - holding.averagePrice) * quantity;
    equity.getRow(24 + index).values = [undefined, holding.symbol, holding.isin, holding.sector, holding.available,
      holding.discrepant ?? 0, holding.longTerm ?? 0, holding.pledgedMargin ?? 0, holding.pledgedLoan ?? 0,
      holding.averagePrice, holding.previousClose, rowPnl, holding.averagePrice ? rowPnl / (holding.averagePrice * quantity) * 100 : 0];
    invested += holding.averagePrice * quantity;
    present += holding.previousClose * quantity;
    pnl += rowPnl;
  });
  equity.getCell('C15').value = invested;
  equity.getCell('C16').value = present;
  equity.getCell('C17').value = pnl;
  equity.getCell('C18').value = invested ? pnl / invested * 100 : 0;

  const mutualFunds = workbook.addWorksheet('Mutual Funds');
  mutualFunds.getCell('B11').value = 'Holdings';
  mutualFunds.getCell('B15').value = 'Invested Value';
  mutualFunds.getCell('B16').value = 'Present Value';
  mutualFunds.getCell('B17').value = 'Unrealized P&L';
  mutualFunds.getCell('C15').value = 0;
  mutualFunds.getCell('C16').value = 0;
  mutualFunds.getCell('C17').value = 0;
  mutualFunds.getRow(22).values = [undefined, 'Symbol', 'ISIN', 'Instrument Type', 'Quantity Available',
    'Quantity Discrepant', 'Quantity Pledged (Margin)', 'Quantity Pledged (Loan)', 'Average Price',
    'Previous Closing Price', 'Unrealized P&L', 'Unrealized P&L (%)'];
  mutate?.(workbook);
  return { originalname: 'synthetic-zerodha-holdings.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) } as Express.Multer.File;
}

const holdings: SyntheticHolding[] = [
  { symbol: 'SYNTHCO', isin: 'INE000A01001', sector: 'Synthetic services', available: 8, longTerm: 5,
    pledgedMargin: 2, averagePrice: 100.25, previousClose: 110.5 },
  { symbol: 'TESTBANK', isin: 'INE000B01000', sector: 'Synthetic banking', available: 4,
    averagePrice: 50, previousClose: 45 },
];

describe('Zerodha holdings parser', () => {
  it('parses the verified report layout and excludes long-term quantity from the owned-quantity sum', async () => {
    const parsed = await parseZerodhaHoldings(await workbookFile(holdings));
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual(expect.objectContaining({ symbol: 'SYNTHCO', isin: 'INE000A01001', assetType: 'STOCK',
      quantity: 10, availableQuantity: 8, longTermQuantity: 5, pledgedQuantity: 2,
      averagePriceMinor: 10025, previousClosingPriceMinor: 11050, currentValueMinor: 110500, unrealizedPnlMinor: 10250 }));
    expect(parsed[1].unrealizedPnlMinor).toBe(-2000);
  });

  it('rejects a changed table layout', async () => {
    const file = await workbookFile(holdings, (workbook) => { workbook.getWorksheet('Equity')!.getCell('J23').value = 'Cost'; });
    await expect(parseZerodhaHoldings(file)).rejects.toThrow('layout is unsupported or has changed');
  });

  it('rejects a row whose unrealized P&L does not reconcile', async () => {
    const file = await workbookFile(holdings, (workbook) => { workbook.getWorksheet('Equity')!.getCell('L24').value = 999; });
    await expect(parseZerodhaHoldings(file)).rejects.toThrow('does not reconcile its unrealized P&L');
  });

  it('rejects unreconciled printed totals', async () => {
    const file = await workbookFile(holdings, (workbook) => { workbook.getWorksheet('Equity')!.getCell('C16').value = 1; });
    await expect(parseZerodhaHoldings(file)).rejects.toThrow('sheet totals do not reconcile');
  });

  it('rejects repeated symbols and non-Zerodha workbooks', async () => {
    const repeated = await workbookFile([holdings[0], { ...holdings[1], symbol: holdings[0].symbol }]);
    await expect(parseZerodhaHoldings(repeated)).rejects.toThrow('repeats the symbol');
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Unknown');
    const file = { originalname: 'unknown.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) } as Express.Multer.File;
    await expect(parseZerodhaHoldings(file)).rejects.toThrow('does not contain the supported Zerodha');
  });
});
