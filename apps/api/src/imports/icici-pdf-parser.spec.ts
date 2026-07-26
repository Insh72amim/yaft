import { BadRequestException } from '@nestjs/common';
import { iciciPdfParser } from './icici-pdf-parser';
import type { PdfStatementDocument } from './bank-pdf-parser';

describe('iciciPdfParser', () => {
  const currentCcDocument = (): PdfStatementDocument => ({
    total: 1,
    tablePages: [],
    textPages: [
      {
        num: 1,
        text: `VIEW CURRENT STATEMENT
My Credit Card Details for JOHN DOE
CARD-653075******0000
Card Holder Name JOHN DOE Card Type primary
Available Credit Limit INR 0 Total Credit Limit INR 100000
Total Amount Due INR 0 Purchases and Other Charges INR 40094.81
Statement Date 25-07-2026 Previous Balance INR 21403.04
Statement Period 04-07-2026 TO 25-07-2026
Transaction Details
Transaction Date Details Amount (INR) Reward Points Reference Number
25-07-2026 UPI-100000000015-
MERCHANT PAYMENT STORE
7681.00 Dr. 76 100000000011
12-07-2026 Refund MAKEMYTRIP
INDIA PVT LTD
4390.48 Cr. -43 100000000012
`,
      },
    ],
  });

  const monthlyCcDocument = (): PdfStatementDocument => ({
    total: 1,
    tablePages: [],
    textPages: [
      {
        num: 1,
        text: `ICICI Bank Credit Card Statement
STATEMENT SUMMARY
CREDIT SUMMARY
IMPORTANT MESSAGES
Date Serial No Transaction Details Reward Points Amount (in Rs)
01/05/2026 100000000013 MAKEMYTRIP INDIA PVT LT 267 8,912.00
03/05/2026 100000000014 UPI-ZOMATO LIMITED IN 4 417.53
12/05/2026 13349998888 PAYMENT RECEIVED - THANK YOU 0 5,000.00 CR
`,
      },
    ],
  });

  const invalidDocument = (): PdfStatementDocument => ({
    total: 1,
    tablePages: [],
    textPages: [
      {
        num: 1,
        text: 'Random bank document with no transaction tables or ICICI headers.',
      },
    ],
  });

  it('correctly matches ICICI Credit Card documents', () => {
    expect(iciciPdfParser.matches(currentCcDocument())).toBe(true);
    expect(iciciPdfParser.matches(monthlyCcDocument())).toBe(true);
    expect(iciciPdfParser.matches(invalidDocument())).toBe(false);
  });

  it('parses Current ICICI Credit Card layout correctly', () => {
    const result = iciciPdfParser.parse(currentCcDocument());
    expect(result.rows).toHaveLength(2);

    // Row 1 (Debit)
    expect(result.rows[0].description).toBe('UPI-100000000015- MERCHANT PAYMENT STORE');
    expect(result.rows[0].amountMinor).toBe(-768100);
    expect(result.rows[0].reference).toBe('100000000011');
    expect(result.rows[0].date.toISOString().startsWith('2026-07-25')).toBe(true);

    // Row 2 (Credit)
    expect(result.rows[1].description).toBe('Refund MAKEMYTRIP INDIA PVT LTD');
    expect(result.rows[1].amountMinor).toBe(439048);
    expect(result.rows[1].reference).toBe('100000000012');
    expect(result.rows[1].date.toISOString().startsWith('2026-07-12')).toBe(true);
  });

  it('parses Monthly ICICI Credit Card layout correctly', () => {
    const result = iciciPdfParser.parse(monthlyCcDocument());
    expect(result.rows).toHaveLength(3);

    // Row 1 (Debit)
    expect(result.rows[0].description).toBe('MAKEMYTRIP INDIA PVT LT');
    expect(result.rows[0].amountMinor).toBe(-891200);
    expect(result.rows[0].reference).toBe('100000000013');
    expect(result.rows[0].date.toISOString().startsWith('2026-05-01')).toBe(true);

    // Row 3 (Credit)
    expect(result.rows[2].description).toBe('PAYMENT RECEIVED - THANK YOU');
    expect(result.rows[2].amountMinor).toBe(500000);
    expect(result.rows[2].reference).toBe('13349998888');
    expect(result.rows[2].date.toISOString().startsWith('2026-05-12')).toBe(true);
  });

  it('throws BadRequestException when no transactions are detected', () => {
    expect(() => iciciPdfParser.parse(invalidDocument())).toThrow(BadRequestException);
  });
});
