import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  parseCamsCasPdf,
  parseCamsCasXlsx,
  parseCamsCas,
  normalizeBrokerName,
  isCamsCasDocument,
} from '../../src/investments/cams-cas-parser';
import type { PdfStatementDocument } from '../../src/imports/bank-pdf-parser';

describe('CAMS / KFintech CAS Parser', () => {
  describe('normalizeBrokerName', () => {
    it('correctly maps advisor and broker names', () => {
      expect(normalizeBrokerName('DIRECT')).toBe('Direct');
      expect(normalizeBrokerName('ARN-11111 / Nextbillion Technology Pvt. Ltd.')).toBe('Groww');
      expect(normalizeBrokerName('Groww Invest')).toBe('Groww');
      expect(normalizeBrokerName('Zerodha Broking Ltd')).toBe('Zerodha');
      expect(normalizeBrokerName('Kuvera Technologies')).toBe('Kuvera');
      expect(normalizeBrokerName(undefined)).toBe('Direct');
      expect(normalizeBrokerName('XYZ Wealth')).toBe('XYZ Wealth');
    });
  });

  describe('isCamsCasDocument', () => {
    it('detects CAMS CAS documents', () => {
      const doc: PdfStatementDocument = {
        total: 1,
        textPages: [{ num: 1, text: 'Consolidated Account Statement CAMS Computer Age Management Services' }],
        tablePages: [],
      };
      expect(isCamsCasDocument(doc)).toBe(true);
    });

    it('rejects unrelated documents', () => {
      const doc: PdfStatementDocument = {
        total: 1,
        textPages: [{ num: 1, text: 'Random invoice or bank receipt' }],
        tablePages: [],
      };
      expect(isCamsCasDocument(doc)).toBe(false);
    });
  });

  describe('parseCamsCasXlsx', () => {
    it('throws on non-excel buffer', async () => {
      await expect(parseCamsCasXlsx(Buffer.from('not an excel file'))).rejects.toThrow(BadRequestException);
    });

    it('parses valid CAMS CAS Excel sheet', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('CAS Summary');

      sheet.addRow(['Consolidated Account Statement']);
      sheet.addRow(['Investor: John Doe', 'PAN: ABCDE1234F']);
      sheet.addRow(['Scheme Name', 'Folio No', 'ISIN', 'Mutual Fund', 'Units', 'Cost Value', 'Market Value', 'Advisor']);
      sheet.addRow([
        'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
        '14919414/0',
        'INF879O01019',
        'PPFAS Mutual Fund',
        100.5,
        10050,
        12500,
        'Nextbillion Technology Pvt Ltd',
      ]);
      sheet.addRow([
        'HDFC Balanced Advantage Fund - Direct Plan - Growth',
        '25613619/1',
        'INF179K01BE2',
        'HDFC Mutual Fund',
        50.0,
        5000,
        6200,
        'DIRECT',
      ]);

      const buffer = await workbook.xlsx.writeBuffer();
      const holdings = await parseCamsCasXlsx(Buffer.from(buffer));

      expect(holdings).toHaveLength(2);

      expect(holdings[0]).toEqual({
        assetName: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
        assetType: 'MUTUAL_FUND',
        folio: '14919414/0',
        isin: 'INF879O01019',
        amcName: 'PPFAS Mutual Fund',
        quantity: 100.5,
        averagePriceMinor: 10000, // 10050 / 100.5 = 100 * 100
        costValueMinor: 1005000,
        currentValueMinor: 1250000,
        unrealizedPnlMinor: 245000,
        advisor: 'Nextbillion Technology Pvt Ltd',
        broker: 'Groww',
      });

      expect(holdings[1]).toEqual({
        assetName: 'HDFC Balanced Advantage Fund - Direct Plan - Growth',
        assetType: 'MUTUAL_FUND',
        folio: '25613619/1',
        isin: 'INF179K01BE2',
        amcName: 'HDFC Mutual Fund',
        quantity: 50.0,
        averagePriceMinor: 10000,
        costValueMinor: 500000,
        currentValueMinor: 620000,
        unrealizedPnlMinor: 120000,
        advisor: 'DIRECT',
        broker: 'Direct',
      });
    });
  });

  describe('parseCamsCas (Universal Entry Point)', () => {
    it('dispatches XLSX files properly', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Holdings');
      sheet.addRow(['Scheme Name', 'Folio No', 'Units', 'Cost Value', 'Market Value']);
      sheet.addRow(['SBI Small Cap Fund - Direct Plan', '35527491', 20.0, 2000, 2500]);
      const buffer = await workbook.xlsx.writeBuffer();

      const mockFile: Express.Multer.File = {
        originalname: 'CAMS_CAS_Statement.xlsx',
        buffer: Buffer.from(buffer),
      } as any;

      const holdings = await parseCamsCas(mockFile);
      expect(holdings).toHaveLength(1);
      expect(holdings[0].assetName).toBe('SBI Small Cap Fund - Direct Plan');
      expect(holdings[0].quantity).toBe(20.0);
    });

    it('rejects unsupported file formats', async () => {
      const mockFile: Express.Multer.File = {
        originalname: 'statement.csv',
        buffer: Buffer.from('foo,bar'),
      } as any;

      await expect(parseCamsCas(mockFile)).rejects.toThrow(BadRequestException);
    });
  });
});
