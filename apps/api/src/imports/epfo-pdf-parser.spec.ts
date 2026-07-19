import { parseEpfoPassbook, isEpfoPassbook } from './epfo-pdf-parser';
import type { PdfStatementDocument } from './bank-pdf-parser';

const mockDoc: PdfStatementDocument = {
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
Closing Balance as on 31/03/2026 21,000 21,000 0
----------------------fooj.k dh lekfIr/End Of Statement----------------------
      `
    }
  ],
  tablePages: []
};

describe('EPFO PDF parser', () => {
  it('correctly identifies an EPFO passbook', () => {
    expect(isEpfoPassbook(mockDoc)).toBe(true);
  });

  it('correctly parses an EPFO passbook and extracts balances', () => {
    const result = parseEpfoPassbook(mockDoc);
    expect(result).toEqual({
      employeeBalance: 2232900,
      employerBalance: 2232900,
      totalBalance: 4465800,
      financialYear: '2025-2026',
      closingDate: '31/03/2026',
      memberName: 'TEST USER',
      uan: '100000000000',
      establishment: 'ACME CORP INDIA PRIVATE LIMITED'
    });
  });

  it('rejects documents that are not EPFO passbooks', () => {
    const invalidDoc = {
      total: 1,
      textPages: [{ num: 1, text: 'Random banking text' }],
      tablePages: []
    };
    expect(isEpfoPassbook(invalidDoc)).toBe(false);
    expect(() => parseEpfoPassbook(invalidDoc)).toThrow('This PDF does not appear to be an EPFO passbook.');
  });
});
