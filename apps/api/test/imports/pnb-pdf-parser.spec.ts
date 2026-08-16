import { parsePnbTables } from '../../src/imports/pnb-pdf-parser';

const pages = [{ num: 1, tables: [[
  ['Transaction\nDate', 'Cheque\nNumber', 'Withdrawal', 'Deposit', 'Balance', 'Narration'],
  ['12/07/2026', '', '1,000.00', '', '4,000.00', 'UPI/DR/100000000001/SHOP/'],
  ['11/07/2026', '', '', '2,000.00', '5,000.00', 'IMPS-IN/100000000002/SENDER'],
  ['10/07/2026', '', '500.00', '', '3,000.00', 'ATM WDR 1234'],
]] }];

describe('PNB PDF parser', () => {
  it('preserves explicit debit/credit columns and extracts transaction references', () => {
    const { rows: result } = parsePnbTables(pages);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ amountMinor: -100000, reference: '100000000001' });
    expect(result[1]).toMatchObject({ amountMinor: 200000, reference: '100000000002' });
    expect(result[2].amountMinor).toBe(-50000);
  });

  it('supports Cr. and Dr. annotated balances in PNB statement tables', () => {
    const crPages = [{ num: 1, tables: [[
      ['Transaction Date', 'Cheque Number', 'Withdrawal', 'Deposit', 'Balance', 'Narration'],
      ['12/08/2026', '', '', '24.00', '25,000.00 Cr.', 'NEFT_IN:100000000003/SALARY'],
      ['10/08/2026', '', '13,000.00', '', '20,000.00 Cr.', 'UPI/DR/100000000004/RENT'],
    ]] }];
    const { rows: result, closingBalanceMinor } = parsePnbTables(crPages);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ amountMinor: 2400, reference: '100000000003' });
    expect(result[1]).toMatchObject({ amountMinor: -1300000, reference: '100000000004' });
    expect(closingBalanceMinor).toBe(2500000);
  });

  it('rejects statements whose running balance does not reconcile', () => {
    const broken = structuredClone(pages); broken[0].tables[0][1][4] = '9,999.00';
    expect(() => parsePnbTables(broken)).toThrow('did not reconcile');
  });
});
