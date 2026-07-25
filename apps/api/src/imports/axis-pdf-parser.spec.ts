import type { PdfStatementDocument } from './bank-pdf-parser';
import { axisPdfParser, extractAxisReference, parseAxisDocument } from './axis-pdf-parser';

const header = ['Tran\nDate', 'Chq No', 'Particulars', 'Debit', 'Credit', 'Balance', 'Init.\nBr.'];

function fixture(): PdfStatementDocument {
  return {
    total: 5,
    textPages: [
      { num: 1, text: 'AXIS BANK Statement of Axis Account No :XXXXXXXX' },
      { num: 5, text: 'End of Statement' },
    ],
    tablePages: [
      { num: 1, tables: [[
        [...header],
        ['', '', 'OPENING BALANCE', '', '', '1,000.00', ''],
        ['01-04-2026', '', 'UPI/P2A/111111111111/SYNTHETIC', '100.00', '', '900.00', '001'],
        ['02-04-2026', '', 'UPI/P2A/111111111111/SYNTHETIC/REVERSAL', '', '100.00', '1,000.00', '001'],
      ]] },
      { num: 2, tables: [[
        ['03-04-2026', '', 'IMPS/P2A/222222222222/SYNTHETIC', '', '200.00', '1,200.00', '001'],
        ['04-04-2026', '', 'CreditCard Payment Ref#CARD1234', '25.00', '', '1,175.00', '001'],
      ]] },
      { num: 3, tables: [[
        ['05-04-2026', '', 'SERVICE CHARGE', '5.00', '', '1,170.00', '001'],
      ]] },
      { num: 4, tables: [[
        ['06-04-2026', '000123', 'CHEQUE CLEARING', '70.00', '', '1,100.00', '001'],
        ['', 'TRANSACTION TOTAL', '200.00', '300.00', '', ''],
        ['', 'CLOSING BALANCE', '1,100.00', ''],
      ]] },
      { num: 5, tables: [] },
    ],
  };
}

describe('Axis Bank PDF parser', () => {
  it('parses page continuations, signed amounts, references, and reversal-safe identities', () => {
    const document = fixture();
    expect(axisPdfParser.matches(document)).toBe(true);

    const { rows } = parseAxisDocument(document);
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.amountMinor)).toEqual([-10000, 10000, 20000, -2500, -500, -7000]);
    expect(rows[0]).toMatchObject({ rowNumber: 1, reference: '111111111111' });
    expect(rows[2].reference).toBe('222222222222');
    expect(rows[3].reference).toBe('CARD1234');
    expect(rows[5].reference).toBe('000123');
    expect(rows[0].dedupeKey).not.toBe(rows[1].dedupeKey);
    expect(rows[4].dedupeKey).toContain('balance:117000');
  });

  it('extracts supported references without mistaking narration for an identity', () => {
    expect(extractAxisReference('UPI/P2M/333333333333/MERCHANT')).toBe('333333333333');
    expect(extractAxisReference('UPI/CRADJ/444444444444/ADJUSTMENT')).toBe('444444444444');
    expect(extractAxisReference('NO EXTERNAL REFERENCE')).toBeUndefined();
  });

  it('requires both Axis document markers and the exact table header', () => {
    const wrongBank = fixture();
    wrongBank.textPages[0].text = 'OTHER BANK Statement';
    expect(axisPdfParser.matches(wrongBank)).toBe(false);
    expect(() => parseAxisDocument(wrongBank)).toThrow('does not match');

    const wrongHeader = fixture();
    wrongHeader.tablePages[0].tables[0][0][3] = 'Amount';
    expect(axisPdfParser.matches(wrongHeader)).toBe(false);
  });

  it('rejects a running-balance mismatch', () => {
    const document = fixture();
    document.tablePages[1].tables[0][0][5] = '1,201.00';
    expect(() => parseAxisDocument(document)).toThrow('running balances did not reconcile');
  });

  it('rejects printed totals and closing balances that do not reconcile', () => {
    const wrongTotals = fixture();
    wrongTotals.tablePages[3].tables[0][1][2] = '201.00';
    expect(() => parseAxisDocument(wrongTotals)).toThrow('transaction totals did not reconcile');

    const wrongClosing = fixture();
    wrongClosing.tablePages[3].tables[0][2][2] = '1,101.00';
    expect(() => parseAxisDocument(wrongClosing)).toThrow('closing balance did not reconcile');
  });

  it('rejects ambiguous and unexplained financial rows', () => {
    const ambiguous = fixture();
    ambiguous.tablePages[1].tables[0][0][3] = '1.00';
    expect(() => parseAxisDocument(ambiguous)).toThrow('could not be interpreted safely');

    const unexplained = fixture();
    unexplained.tablePages[2].tables[0].push(['', '', 'CONTINUATION', '1.00', '', '1,169.00', '001']);
    expect(() => parseAxisDocument(unexplained)).toThrow('could not be interpreted safely');
  });

  it('parses Axis Credit Card PDF statements', () => {
    const ccDocument: PdfStatementDocument = {
      total: 2,
      textPages: [
        { num: 1, text: 'AXIS BANK Credit Card Number: 5000XXXXXXXX0001 Payment Summary Minimum Payment Due ₹ 5,000.00' },
        { num: 2, text: 'End of Statement' },
      ],
      tablePages: [
        {
          num: 1,
          tables: [[
            ['Date', 'Transaction Details', 'Amount (INR)', 'Debit/Credit'],
            ["30 Jun '26", 'EMI Interest - 2/9, Ref# 10000001', '₹ 124.00', 'Debit'],
            ["21 Jun '26", 'GOOGLECLOUD,MUMBAI', '₹ 200.00', 'Credit'],
          ]],
        },
      ],
    };

    expect(axisPdfParser.matches(ccDocument)).toBe(true);
    const { rows } = parseAxisDocument(ccDocument);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: new Date(Date.UTC(2026, 5, 30)),
      description: 'EMI Interest - 2/9, Ref# 10000001',
      amountMinor: -12400,
      reference: '10000001',
    });
    expect(rows[1]).toMatchObject({
      date: new Date(Date.UTC(2026, 5, 21)),
      description: 'GOOGLECLOUD,MUMBAI',
      amountMinor: 20000,
    });
  });
});
