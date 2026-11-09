import { epfoPdfParser, isEpfoPassbook } from '../../src/imports/epfo-pdf-parser';
import type { PdfStatementDocument } from '../../src/imports/bank-pdf-parser';

const mockDocWithNoTxs: PdfStatementDocument = {
  total: 1,
  textPages: [
    {
      num: 1,
      text: `
lnL; iklcqd / Member Passbook
LFkkiuk vkbZMh@uke | Establishment ID/Name EST10000000000 / ACME CORP INDIA PRIVATE LIMITED
lnL; vkbZMh@uke | Member ID/Name MEM10000000000000001 / TEST USER
UAN 100000000000
EPF Passbook [ Financial Year - 2025-2026 ]
OB Int. Updated upto 31/03/2025 20,000 20,000 0
---No Transactions available for the this year.---
Int. Updated upto 31/03/2026 1,000 1,000 0
Closing Balance as on 31/03/2026 21,000 21,000 0
----------------------fooj.k dh lekfIr/End Of Statement----------------------
      `
    }
  ],
  tablePages: []
};

const mockDocWithTxs: PdfStatementDocument = {
  total: 1,
  textPages: [
    {
      num: 1,
      text: `
lnL; iklcqd / Member Passbook
LFkkiuk vkbZMh@uke | Establishment ID/Name EST20000000000 / GLOBEX CORP PRIVATE LIMITED
lnL; vkbZMh@uke | Member ID/Name MEM20000000000000002 / TEST USER
UAN 100000000000
EPF Passbook [ Financial Year - 2025-2026 ]
OB Int. Updated upto 31/03/2025 100,000 80,000 20,000
Mar-2025 01-04-2025 CR Cont. for Due-Month 042025 50,000 15,000 6,000 5,000 1,000
Apr-2025 01-05-2025 CR Cont. for Due-Month 052025 50,000 15,000 6,000 5,000 1,000
Int. Updated upto 31/03/2026 10,000 8,000 0
Closing Balance as on 31/03/2026 122,000 98,000 22,000
----------------------fooj.k dh lekfIr/End Of Statement----------------------
      `
    }
  ],
  tablePages: []
};

describe('EPFO PDF parser', () => {
  it('correctly identifies an EPFO passbook', () => {
    expect(isEpfoPassbook(mockDocWithNoTxs)).toBe(true);
  });

  it('correctly parses an EPFO passbook with no contribution transactions', () => {
    const { rows, closingBalanceMinor } = epfoPdfParser.parse(mockDocWithNoTxs);
    expect(closingBalanceMinor).toBe(4200000); // 2100000 employee + 2100000 employer + 0 pension
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 1,
      description: 'Interest credit upto 31/03/2026',
      amountMinor: 200000, // 100000 + 100000
      reference: 'INT-2026'
    });
  });

  it('correctly parses an EPFO passbook and extracts monthly contribution rows', () => {
    const { rows, closingBalanceMinor } = epfoPdfParser.parse(mockDocWithTxs);
    expect(closingBalanceMinor).toBe(24200000); // 12200000 + 9800000 + 2200000

    expect(rows).toHaveLength(3);
    
    // Check first contribution
    expect(rows[0]).toMatchObject({
      rowNumber: 1,
      description: 'Cont. for Due-Month 042025 (Wage Month: Mar-2025)',
      amountMinor: 1200000, // 600000 employee + 500000 employer + 100000 pension
      reference: 'Mar-2025'
    });
    expect(rows[0].date.toISOString()).toBe(new Date(Date.UTC(2025, 3, 1)).toISOString());

    // Check second contribution
    expect(rows[1]).toMatchObject({
      rowNumber: 2,
      description: 'Cont. for Due-Month 052025 (Wage Month: Apr-2025)',
      amountMinor: 1200000, // 600000 + 500000 + 100000
      reference: 'Apr-2025'
    });

    // Check interest
    expect(rows[2]).toMatchObject({
      rowNumber: 3,
      description: 'Interest credit upto 31/03/2026',
      amountMinor: 1800000, // 1000000 + 800000 + 0
      reference: 'INT-2026'
    });
  });

  it('rejects documents that are not EPFO passbooks', () => {
    const invalidDoc = {
      total: 1,
      textPages: [{ num: 1, text: 'Random banking text' }],
      tablePages: []
    };
    expect(isEpfoPassbook(invalidDoc)).toBe(false);
    expect(() => epfoPdfParser.parse(invalidDoc)).toThrow('This PDF does not appear to be an EPFO passbook.');
  });
});
