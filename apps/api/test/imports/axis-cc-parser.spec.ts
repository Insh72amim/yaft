import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { parseAxisCcExcel } from '../../src/imports/axis-cc-parser';

describe('Axis CC XLSX Parser', () => {
  let workbook: ExcelJS.Workbook;
  let sheet: ExcelJS.Worksheet;

  beforeEach(() => {
    workbook = new ExcelJS.Workbook();
    sheet = workbook.addWorksheet('Sheet1');
  });

  it('fails if no transaction rows are detected', () => {
    expect(() => parseAxisCcExcel(sheet)).toThrow(BadRequestException);
  });

  it('parses valid Axis CC statement', () => {
    // Add header rows as seen in actual statements
    sheet.addRow(['JOHN DOE\nADDRESS', '', '', 'Axis Rewards Credit Card Monthly Statement']);
    sheet.addRow(['Payment Summary']);
    sheet.addRow(['Total Payment Due \n₹ 100.00', '', 'Minimum Payment Due\n₹ 10.00', '', 'Payment Due Date\n12 Jul \'26']);
    sheet.addRow(['Selected Statement Month\nJun 2026', '', 'Credit Limit\n₹ 1,25,000.00', '', 'Opening Balance\n₹ 0.00']);
    sheet.addRow(['Transaction Summary']);
    // Transaction headers
    sheet.addRow(['Date', 'Transaction Details', '', 'Amount (INR)', 'Debit/Credit']);
    // Valid transactions
    sheet.addRow(['21 Jun \'26', 'GOOGLECLOUD,MUMBAI', '', '₹ 2.00', 'Credit']);
    sheet.addRow(['14 Jun \'26', 'AMAZONAWS', '', '₹ 5.50', 'Debit']);
    // End of statement
    sheet.addRow(['** End of Statement **']);
    
    const rows = parseAxisCcExcel(sheet);
    
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: new Date(Date.UTC(2026, 5, 21)),
      description: 'GOOGLECLOUD,MUMBAI',
      amountMinor: 200, // Credit is positive
    });
    expect(rows[1]).toMatchObject({
      date: new Date(Date.UTC(2026, 5, 14)),
      description: 'AMAZONAWS',
      amountMinor: -550, // Debit is negative
    });
  });

  it('skips invalid rows inside transactions block', () => {
    sheet.addRow(['Date', 'Transaction Details', '', 'Amount (INR)', 'Debit/Credit']);
    sheet.addRow(['Invalid Date', 'Something', '', '₹ 2.00', 'Credit']);
    sheet.addRow(['21 Jun \'26', 'VALID', '', '₹ 2.00', 'Credit']);
    sheet.addRow(['22 Jun \'26', '', '', '₹ 3.00', 'Debit']); // missing description
    sheet.addRow(['** End of Statement **']);

    const rows = parseAxisCcExcel(sheet);
    
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('VALID');
    expect(rows[0].amountMinor).toBe(200);
  });
});
