import { BadRequestException } from '@nestjs/common';
import { isSbiCcLayout, parseSbiCcPdf, sbiCcPdfParser } from '../../src/imports/sbi-cc-pdf-parser';
import type { PdfStatementDocument } from '../../src/imports/bank-pdf-parser';

function makeDoc(pages: string[]): PdfStatementDocument {
  return {
    total: pages.length,
    textPages: pages.map((text, i) => ({ num: i + 1, text })),
    tablePages: [],
  };
}

const SAMPLE_PAGE1 = `
XXXX XXXX XXXX XX88
Statement Period: 22 May 26 to 21 Jun 26
SBI Card Account Summary
Total Amount Due: 1,628.00
Minimum Amount Due: 200.00
Date Amount	Transaction Details
24 May 26 PAYMENT RECEIVED REF00000000000000000000 8.00 C
TRANSACTIONS FOR TEST USER
31 May 26 BLINKIT GURGAON IND 850.00 D
20 Jun 26 ING*MYNTRA DESIGNS PVT MUMBAI IND 777.87 D
`;

describe('isSbiCcLayout', () => {
  it('returns true for SBI CC statement text', () => {
    expect(isSbiCcLayout('SBI Card XXXX Statement Period 22 May 26 to 21 Jun 26')).toBe(true);
  });

  it('returns false when SBI Card not present', () => {
    expect(isSbiCcLayout('Some other bank Statement Period 22 May 26')).toBe(false);
  });

  it('returns false when Statement Period not present', () => {
    expect(isSbiCcLayout('SBI Card but no period marker here')).toBe(false);
  });
});

describe('parseSbiCcPdf', () => {
  it('parses credit and debit transactions from sample page', () => {
    const doc = makeDoc([SAMPLE_PAGE1]);
    const { rows } = parseSbiCcPdf(doc);

    expect(rows.length).toBe(3);

    // Credit transaction
    const payment = rows[0];
    expect(payment.date).toEqual(new Date(Date.UTC(2026, 4, 24)));  // 24 May 2026
    expect(payment.description).toBe('PAYMENT RECEIVED');
    expect(payment.reference).toBe('REF00000000000000000000');
    expect(payment.amountMinor).toBe(800);  // positive = credit

    // Debit transaction - no reference
    const blinkit = rows[1];
    expect(blinkit.date).toEqual(new Date(Date.UTC(2026, 4, 31)));  // 31 May 2026
    expect(blinkit.description).toBe('BLINKIT GURGAON IND');
    expect(blinkit.amountMinor).toBe(-85000);  // negative = debit

    // Debit transaction
    const myntra = rows[2];
    expect(myntra.date).toEqual(new Date(Date.UTC(2026, 5, 20)));  // 20 Jun 2026
    expect(myntra.amountMinor).toBe(-77787);
  });

  it('builds dedupeKey using reference when available', () => {
    const doc = makeDoc([SAMPLE_PAGE1]);
    const { rows } = parseSbiCcPdf(doc);
    expect(rows[0].dedupeKey).toBe('sbi-cc:REF00000000000000000000');
  });

  it('builds dedupeKey without reference for description-only rows', () => {
    const doc = makeDoc([SAMPLE_PAGE1]);
    const { rows } = parseSbiCcPdf(doc);
    expect(rows[1].dedupeKey).toMatch(/^sbi-cc:2026-05-31:-85000:/);
  });

  it('throws when no transactions found', () => {
    const doc = makeDoc(['SBI Card statement with no transaction lines. Statement Period: 01 Jan 26 to 31 Jan 26']);
    expect(() => parseSbiCcPdf(doc)).toThrow(BadRequestException);
  });

  it('throws when layout does not match', () => {
    const doc = makeDoc(['Random PDF with no SBI markers']);
    expect(() => parseSbiCcPdf(doc)).toThrow(BadRequestException);
  });
});

describe('sbiCcPdfParser', () => {
  it('matches an SBI CC document', () => {
    const doc = makeDoc([SAMPLE_PAGE1]);
    expect(sbiCcPdfParser.matches(doc)).toBe(true);
  });

  it('does not match an unrelated document', () => {
    const doc = makeDoc(['Axis Bank Statement of Account']);
    expect(sbiCcPdfParser.matches(doc)).toBe(false);
  });

  it('has id SBI_CC', () => {
    expect(sbiCcPdfParser.id).toBe('SBI_CC');
  });

  it('parses via the parse method', () => {
    const doc = makeDoc([SAMPLE_PAGE1]);
    const { rows } = sbiCcPdfParser.parse(doc);
    expect(rows.length).toBeGreaterThan(0);
  });
});
