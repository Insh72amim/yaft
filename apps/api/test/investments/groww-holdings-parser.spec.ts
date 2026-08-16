import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { parseGrowwHoldingsXlsx } from '../../src/investments/groww-holdings-parser';

describe('Groww Holdings Parser', () => {
  it('should throw error if file is not an excel file', async () => {
    await expect(parseGrowwHoldingsXlsx(Buffer.from('not an excel'))).rejects.toThrow(BadRequestException);
  });

  it('should parse valid groww holdings xlsx', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Holdings');
    
    // Add dummy header and info that Groww adds
    for (let i = 0; i < 18; i++) {
      sheet.addRow(['Some random info', 'More info']);
    }

    // Add header row
    sheet.addRow(['Scheme Name', 'AMC', 'Category', 'Sub-category', 'Folio No.', 'Source', 'Units', 'Invested Value', 'Current Value', 'Returns', 'XIRR']);
    
    // Add valid row
    sheet.addRow(['Mutual Fund 1', 'AMC', 'Cat', 'Subcat', '1234', 'Groww', 10.5, 1050, 1100, 50, '5%']);
    
    // Add empty row
    sheet.addRow([]);

    const buffer = await workbook.xlsx.writeBuffer();
    
    const holdings = await parseGrowwHoldingsXlsx(Buffer.from(buffer));
    
    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toEqual({
      assetName: 'Mutual Fund 1',
      assetType: 'MUTUAL_FUND',
      quantity: 10.5,
      averagePriceMinor: 10000, // 1050 / 10.5 = 100 * 100 (minor)
      currentValueMinor: 110000,
      unrealizedPnlMinor: 5000,
    });
  });

  // Private Smoke Test
  const fs = require('fs');
  const path = require('path');
  const privateSamplePath = '/Users/yaft/Code/YAFT-private-inputs/Mutual_Funds_1234567890_19-07-2026_19-07-2026.xlsx';
  
  if (fs.existsSync(privateSamplePath)) {
    it('should successfully parse the private Groww smoke test sample', async () => {
      const buffer = fs.readFileSync(privateSamplePath);
      const holdings = await parseGrowwHoldingsXlsx(buffer);
      console.log(`Smoke test passed. Parsed ${holdings.length} holdings from Groww export.`);
      expect(holdings.length).toBeGreaterThan(0);
    });
  }
});
