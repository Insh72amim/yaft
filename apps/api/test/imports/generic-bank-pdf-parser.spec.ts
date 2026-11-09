import {
  genericBankPdfParser,
  parseGenericDate,
  parseGenericMoney,
  extractGenericReference,
  parseGenericBankTextLines,
} from '../../src/imports/generic-bank-pdf-parser';
import type { PdfStatementDocument } from '../../src/imports/bank-pdf-parser';

describe('GenericBankPdfParser', () => {
  describe('parseGenericDate', () => {
    it('parses DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY', () => {
      const d1 = parseGenericDate('25/09/2026');
      expect(d1?.toISOString().slice(0, 10)).toBe('2026-09-25');

      const d2 = parseGenericDate('05-08-2026');
      expect(d2?.toISOString().slice(0, 10)).toBe('2026-08-05');

      const d3 = parseGenericDate('15.01.2026');
      expect(d3?.toISOString().slice(0, 10)).toBe('2026-01-15');
    });

    it('parses DD-Mon-YYYY and DD Mon YYYY', () => {
      const d1 = parseGenericDate('25-Sep-2026');
      expect(d1?.toISOString().slice(0, 10)).toBe('2026-09-25');

      const d2 = parseGenericDate('01 Oct 2026');
      expect(d2?.toISOString().slice(0, 10)).toBe('2026-10-01');

      const d3 = parseGenericDate('15-JUL-26');
      expect(d3?.toISOString().slice(0, 10)).toBe('2026-07-15');
    });

    it('parses Mon DD, YYYY and YYYY-MM-DD', () => {
      const d1 = parseGenericDate('Sep 25, 2026');
      expect(d1?.toISOString().slice(0, 10)).toBe('2026-09-25');

      const d2 = parseGenericDate('2026-09-25');
      expect(d2?.toISOString().slice(0, 10)).toBe('2026-09-25');
    });

    it('returns null on invalid or empty date', () => {
      expect(parseGenericDate('')).toBeNull();
      expect(parseGenericDate('-')).toBeNull();
      expect(parseGenericDate('invalid')).toBeNull();
    });
  });

  describe('parseGenericMoney', () => {
    it('parses standard money strings and returns minor units', () => {
      expect(parseGenericMoney('1,000.50')).toBe(100050);
      expect(parseGenericMoney('₹ 5,000.00')).toBe(500000);
      expect(parseGenericMoney('Rs. 100.00')).toBe(10000);
    });

    it('parses debit indicators and negative numbers', () => {
      expect(parseGenericMoney('1,000.00 Dr')).toBe(-100000);
      expect(parseGenericMoney('-500.00')).toBe(-50000);
      expect(parseGenericMoney('(750.00)')).toBe(-75000);
    });

    it('parses credit indicators', () => {
      expect(parseGenericMoney('10,000.00 Cr')).toBe(1000000);
    });
  });

  describe('extractGenericReference', () => {
    it('extracts UPI RRN from narration', () => {
      expect(extractGenericReference('UPI/P2A/100000000005/SWIGGY')).toBe('100000000005');
      expect(extractGenericReference('UPI-123456789012-MERCHANT')).toBe('123456789012');
    });

    it('extracts IMPS and NEFT references', () => {
      expect(extractGenericReference('IMPS/425619384721/TRANSFER')).toBe('425619384721');
      expect(extractGenericReference('NEFT-N260925001234-SALARY')).toBe('N260925001234');
    });

    it('uses cell reference if provided', () => {
      expect(extractGenericReference('Some narration', 'CHQ123456')).toBe('CHQ123456');
    });
  });

  describe('multi-line text stream extraction', () => {
    it('parses realistic 3-line multi-line SBI PDF statement text', () => {
      const sbiText = `
STATEMENT OF ACCOUNT
State Bank of India
Date of Statement : 18-07-2026
Value Date Post Date Details Ref No/ Cheque No ₹ Debit ₹ Credit Balance
02/04/2026 02/04/2026 DEBIT ACHDr
TESTBANK00000001 Synthetic clearing
- 100.00 - 1,100.00
03/04/2026 03/04/2026 TO TRANSFER-UPI/DR/123456789012/SWIGGY
BANGALORE IN ORDER 4492
- 450.00 - 650.00
04/04/2026 04/04/2026 DEP TFR
IMPS/425619384721/SYNTHETIC SALARY
- - 50,000.00 50,650.00
Statement Summary : 01-04-2026 To 18-07-2026
Page no. 1
`;
      const doc: PdfStatementDocument = {
        total: 1,
        textPages: [{ num: 1, text: sbiText }],
        tablePages: [],
      };

      const result = genericBankPdfParser.parse(doc);
      expect(result.rows).toHaveLength(3);
      expect(result.closingBalanceMinor).toBe(5065000);

      expect(result.rows[0]).toMatchObject({
        rowNumber: 1,
        amountMinor: -10000,
        balanceMinor: 110000,
      });

      expect(result.rows[1]).toMatchObject({
        rowNumber: 2,
        amountMinor: -45000,
        balanceMinor: 65000,
        reference: '123456789012',
      });

      expect(result.rows[2]).toMatchObject({
        rowNumber: 3,
        amountMinor: 5000000,
        balanceMinor: 5065000,
        reference: '425619384721',
      });
    });

    it('parses 2-line HDFC/ICICI statements with running balance tracking', () => {
      const hdfcText = `
HDFC BANK LIMITED
Account Statement from 01/08/2026 to 31/08/2026
Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance
01/08/2026 UPI-ZOMATO-100000000005-PYMT@HDFC
01/08/2026 350.00 - 49,650.00
05/08/2026 ACH D-NETFLIX-992123
05/08/2026 649.00 - 49,001.00
10/08/2026 NEFT CR-HDFC0001-GOOGLE INDIA-SALARY
10/08/2026 - 1,50,000.00 1,99,001.00
`;
      const doc: PdfStatementDocument = {
        total: 1,
        textPages: [{ num: 1, text: hdfcText }],
        tablePages: [],
      };

      const result = genericBankPdfParser.parse(doc);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].amountMinor).toBe(-35000);
      expect(result.rows[0].reference).toBe('100000000005');
      expect(result.rows[1].amountMinor).toBe(-64900);
      expect(result.rows[2].amountMinor).toBe(15000000);
      expect(result.rows[2].balanceMinor).toBe(19900100);
    });

    it('parses statements with row index numbers before date', () => {
      const indexedText = `
Kotak Mahindra Bank
1 01-Sep-2026 UPI/P2M/998877665544/AMAZON 1,499.00 18,501.00
2 02-Sep-2026 SALARY CREDITED FROM ACME CORP 85,000.00 1,03,501.00
`;
      const doc: PdfStatementDocument = {
        total: 1,
        textPages: [{ num: 1, text: indexedText }],
        tablePages: [],
      };

      const result = genericBankPdfParser.parse(doc);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].amountMinor).toBe(-149900);
      expect(result.rows[0].reference).toBe('998877665544');
      expect(result.rows[1].amountMinor).toBe(8500000);
    });
  });

  describe('table extraction', () => {
    it('parses standard bank table layout with Date, Particulars, Debit, Credit, Balance', () => {
      const doc: PdfStatementDocument = {
        total: 1,
        textPages: [{ num: 1, text: 'HDFC Bank Statement' }],
        tablePages: [{
          num: 1,
          tables: [
            [
              ['Date', 'Narration', 'Chq/Ref No', 'Debit Amount', 'Credit Amount', 'Closing Balance'],
              ['01/09/2026', 'UPI/SWIGGY/123456', 'REF001', '450.00', '', '49,550.00'],
              ['02/09/2026', 'SALARY FOR AUGUST', 'NEFT999', '', '1,00,000.00', '1,49,550.00'],
              ['03/09/2026', 'ATM CASH WITHDRAWAL', '', '5,000.00', '', '1,44,550.00'],
            ]
          ]
        }]
      };

      const result = genericBankPdfParser.parse(doc);
      expect(result.rows).toHaveLength(3);
      expect(result.closingBalanceMinor).toBe(14455000);

      expect(result.rows[0]).toMatchObject({
        rowNumber: 1,
        description: 'UPI/SWIGGY/123456',
        amountMinor: -45000,
        balanceMinor: 4955000,
        reference: 'REF001',
      });

      expect(result.rows[1]).toMatchObject({
        rowNumber: 2,
        description: 'SALARY FOR AUGUST',
        amountMinor: 10000000,
        balanceMinor: 14955000,
        reference: 'NEFT999',
      });

      expect(result.rows[2]).toMatchObject({
        rowNumber: 3,
        description: 'ATM CASH WITHDRAWAL',
        amountMinor: -500000,
        balanceMinor: 14455000,
      });
    });

    it('stitches multi-line narration rows', () => {
      const doc: PdfStatementDocument = {
        total: 1,
        textPages: [{ num: 1, text: 'ICICI Bank Statement' }],
        tablePages: [{
          num: 1,
          tables: [
            [
              ['Tran Date', 'Particulars', 'Dr Amount', 'Cr Amount', 'Balance'],
              ['10/09/2026', 'UPI/P2M/100000000005/ZOMATO', '650.00', '', '25,000.00'],
              ['', 'BANGALORE IN ORDER #9921', '', '', ''],
            ]
          ]
        }]
      };

      const result = genericBankPdfParser.parse(doc);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].description).toBe('UPI/P2M/100000000005/ZOMATO BANGALORE IN ORDER #9921');
      expect(result.rows[0].amountMinor).toBe(-65000);
      expect(result.rows[0].balanceMinor).toBe(2500000);
      expect(result.rows[0].reference).toBe('100000000005');
    });

    it('handles single Amount column with Type (DR/CR) column', () => {
      const doc: PdfStatementDocument = {
        total: 1,
        textPages: [{ num: 1, text: 'Kotak Bank Statement' }],
        tablePages: [{
          num: 1,
          tables: [
            [
              ['Date', 'Description', 'Amount', 'Type', 'Balance'],
              ['15/09/2026', 'AMAZON PAY INDIA', '1,299.00', 'DR', '50,000.00'],
              ['16/09/2026', 'INTEREST CREDITED', '350.00', 'CR', '50,350.00'],
            ]
          ]
        }]
      };

      const result = genericBankPdfParser.parse(doc);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].amountMinor).toBe(-129900);
      expect(result.rows[0].balanceMinor).toBe(5000000);
      expect(result.rows[1].amountMinor).toBe(35000);
      expect(result.rows[1].balanceMinor).toBe(5035000);
    });
  });
});
