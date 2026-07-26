import { BadRequestException } from '@nestjs/common';
import { fixHdfcText, hdfcCcPdfParser } from './hdfc-cc-pdf-parser';
import type { PdfStatementDocument } from './bank-pdf-parser';

describe('hdfcCcPdfParser', () => {
  const hdfcDocument = (): PdfStatementDocument => ({
    total: 1,
    tablePages: [],
    textPages: [
      {
        num: 1,
        text: `HDFC\u0000Bank\u0000Credit\u0000Card\u0000Statement
Statement\u0000Date\u000014\u0000Jun\u00002026
TOTAL\u0000AMOUNT\u0000DUE\u0000₹65,436.84
DATE\u0000&\u0000TIME\tTRANSACTION\u0000DESCRIPTION\tCASHPOINTS\tAMOUNT
\uE071\uE073\u0000Jun\u0000\uE073\uE071\uE073\uE077\uE093\u0000\uE073\uE071\uEE47\uE076\uE077\tBlinkit\t\uEE6A36\t₹\uE078\uE072\uE073\uE094\uE071\uE071
\uE071\uE077\u0000Jun\u0000\uE073\uE071\uE073\uE077\uE093\u0000\uE071\uE074\uEE47\uE074\uE076\tZomato\t\uEE6A17\t₹\uE074\uE075\uE075\uE094\uE071\uE074
\uE072\uE071\u0000Jun\u0000\uE073\uE071\uE073\uE077\uE093\u0000\uE072\uE079\uEE47\uE076\uE071\tPayment\u0000Received\t₹\uE076\uE071\uE094\uE071\uE071\u0000CR
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
        text: 'Random document with no HDFC transaction headers.',
      },
    ],
  });

  it('decodes PUA custom font characters and fixes text properly', () => {
    const raw = '\uE071\uE073\u0000Jun\u0000\uE073\uE071\uE073\uE077\uE093\u0000\uE073\uE071\uEE47\uE076\uE077\tBlinkit\t₹\uE078\uE072\uE073\uE094\uE071\uE071';
    const fixed = fixHdfcText(raw);
    expect(fixed).toContain('02 Jun 2026, 20:56');
    expect(fixed).toContain('₹712.00');
  });

  it('correctly matches HDFC Credit Card documents', () => {
    expect(hdfcCcPdfParser.matches(hdfcDocument())).toBe(true);
    expect(hdfcCcPdfParser.matches(invalidDocument())).toBe(false);
  });

  it('parses HDFC Credit Card layout correctly', () => {
    const result = hdfcCcPdfParser.parse(hdfcDocument());
    expect(result.closingBalanceMinor).toBe(6543684);
    expect(result.rows).toHaveLength(3);

    // Row 1: Blinkit Spend (-71200 minor)
    expect(result.rows[0].description).toBe('Blinkit');
    expect(result.rows[0].amountMinor).toBe(-71200);
    expect(result.rows[0].date.toISOString().startsWith('2026-06-02')).toBe(true);

    // Row 2: Zomato Spend (-34403 minor)
    expect(result.rows[1].description).toBe('Zomato');
    expect(result.rows[1].amountMinor).toBe(-34403);
    expect(result.rows[1].date.toISOString().startsWith('2026-06-06')).toBe(true);

    // Row 3: Payment Received CR (+5000 minor)
    expect(result.rows[2].description).toBe('Payment Received');
    expect(result.rows[2].amountMinor).toBe(5000);
    expect(result.rows[2].date.toISOString().startsWith('2026-06-10')).toBe(true);
  });

  it('throws BadRequestException when no transaction rows match', () => {
    expect(() => hdfcCcPdfParser.parse(invalidDocument())).toThrow(BadRequestException);
  });
});
