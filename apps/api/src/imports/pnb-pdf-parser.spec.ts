import { parsePnbTables } from './pnb-pdf-parser';

const pages = [{ num: 1, tables: [[
  ['Transaction\nDate', 'Cheque\nNumber', 'Withdrawal', 'Deposit', 'Balance', 'Narration'],
  ['12/07/2026', '', '1,000.00', '', '4,000.00', 'UPI/DR/100000000001/SHOP/'],
  ['11/07/2026', '', '', '2,000.00', '5,000.00', 'IMPS-IN/100000000002/SENDER'],
  ['10/07/2026', '', '500.00', '', '3,000.00', 'ATM WDR 1234'],
]] }];

describe('PNB PDF parser', () => {
  it('preserves explicit debit/credit columns and extracts transaction references', () => {
    const result = parsePnbTables(pages);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ amountMinor: -100000, reference: '100000000001' });
    expect(result[1]).toMatchObject({ amountMinor: 200000, reference: '100000000002' });
    expect(result[2].amountMinor).toBe(-50000);
  });

  it('rejects statements whose running balance does not reconcile', () => {
    const broken = structuredClone(pages); broken[0].tables[0][1][4] = '9,999.00';
    expect(() => parsePnbTables(broken)).toThrow('did not reconcile');
  });
});
