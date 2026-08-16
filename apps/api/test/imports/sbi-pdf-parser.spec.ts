import type { PdfStatementDocument } from '../../src/imports/bank-pdf-parser';
import { parseSbiDocument, sbiPdfParser } from '../../src/imports/sbi-pdf-parser';

const relationshipSummary = `
SBI
Relationship Summary
As on 18-07-2026
MY ACCOUNTS
Account Summary
`;

const firstStatementPage = `
SBI
Account Summary
STATEMENT OF ACCOUNT
State Bank of India
Date of Statement : 18-07-2026
Statement From : 01-04-2026 to 18-07-2026
Value Date Post Date Details Ref No/ Cheque No ₹ Debit ₹ Credit Balance
02/04/2026 02/04/2026 DEBIT ACHDr
TESTBANK00000001 Synthetic clearing
- 100.00 - 1,100.00
02/04/2026 02/04/2026 DEBIT ACHDr
TESTBANK00000001 Synthetic clearing
- 100.00 - 1,000.00
Page no. 1
`;

const finalStatementPage = `
Balance
04/04/2026 04/04/2026 DEP TFR
IMPS/123456789012/SYNTHETIC SOURCE
- - 250.00 1,000.00
25/06/2026 25/06/2026 INTEREST CREDIT - - 50.00 1,300.00
Statement Summary : 01-04-2026 To 18-07-2026
Brought Forward (₹) Dr Count Cr Count Total Debits (₹) Total Credits (₹) Closing Balance (₹)
1,200.00CR 200.00 300.00 1,300.00CR 2 2
Please do not share private credentials.
Page no. 2
`;

function documentWith(pageTwo = firstStatementPage, pageThree = finalStatementPage): PdfStatementDocument {
  return {
    total: 3,
    textPages: [
      { num: 1, text: relationshipSummary },
      { num: 2, text: pageTwo },
      { num: 3, text: pageThree },
    ],
    tablePages: [],
  };
}

describe('SBI PDF parser', () => {
  it('detects the exact SBI statement layout and ignores the relationship summary page', () => {
    expect(sbiPdfParser.matches(documentWith())).toBe(true);
    expect(sbiPdfParser.matches({ total: 1, textPages: [{ num: 1, text: relationshipSummary }], tablePages: [] })).toBe(false);
  });

  it('parses wrapped and same-line rows, preserves both dates, and signs amounts', () => {
    const { rows } = parseSbiDocument(documentWith());
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.amountMinor)).toEqual([-10000, -10000, 25000, 5000]);
    expect(rows[0]).toMatchObject({
      date: new Date(Date.UTC(2026, 3, 2)),
      postedDate: new Date(Date.UTC(2026, 3, 2)),
      description: 'DEBIT ACHDr TESTBANK00000001 Synthetic clearing',
      reference: 'TESTBANK00000001',
      rowNumber: 1,
    });
    expect(rows[2]).toMatchObject({ reference: '123456789012', rowNumber: 3 });
    expect(rows[3]).toMatchObject({ description: 'INTEREST CREDIT', reference: undefined, rowNumber: 4 });
  });

  it('uses the resulting balance to preserve legitimate identical transactions', () => {
    const { rows: [first, second] } = parseSbiDocument(documentWith());
    expect(first.date).toEqual(second.date);
    expect(first.description).toBe(second.description);
    expect(first.reference).toBe(second.reference);
    expect(first.amountMinor).toBe(second.amountMinor);
    expect(first.dedupeKey).not.toBe(second.dedupeKey);
  });

  it('accepts a populated cheque-reference column as the stable reference', () => {
    const withCheque = firstStatementPage.replace('- 100.00 - 1,100.00', 'CHEQUE42 100.00 - 1,100.00');
    expect(parseSbiDocument(documentWith(withCheque)).rows[0].reference).toBe('CHEQUE42');
  });

  it('rejects a running-balance mismatch', () => {
    const broken = firstStatementPage.replace('- 100.00 - 1,000.00', '- 100.00 - 999.00');
    expect(() => parseSbiDocument(documentWith(broken))).toThrow('running balances did not reconcile');
  });

  it('rejects an invalid debit/credit row', () => {
    const broken = firstStatementPage.replace('- 100.00 - 1,100.00', '- 100.00 25.00 1,100.00');
    expect(() => parseSbiDocument(documentWith(broken))).toThrow('invalid debit, credit, or balance');
  });

  it('rejects a statement-summary mismatch', () => {
    const broken = finalStatementPage.replace('200.00 300.00', '201.00 300.00');
    expect(() => parseSbiDocument(documentWith(firstStatementPage, broken))).toThrow('summary did not reconcile');
  });

  it('rejects a missing or unknown statement layout', () => {
    const unknown: PdfStatementDocument = { total: 1, textPages: [{ num: 1, text: 'Generic bank export' }], tablePages: [] };
    expect(() => parseSbiDocument(unknown)).toThrow('does not match');
    const missingSummary = documentWith(firstStatementPage, finalStatementPage.replace(/Statement Summary[\s\S]*/, ''));
    expect(() => parseSbiDocument(missingSummary)).toThrow('does not match');
  });
});
