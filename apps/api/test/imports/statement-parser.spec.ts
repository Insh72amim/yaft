import { parseStatement } from '../../src/imports/statement-parser';

describe('statement parser', () => {
  it('normalises Indian dates and debit/credit columns into paise', async () => {
    const file = {
      originalname: 'hdfc.csv',
      buffer: Buffer.from('Txn Date,Narration,Debit,Credit,Ref No\n01/07/2026,UPI SWIGGY,849.50,,A1\n02/07/2026,SALARY,,125000,B2'),
    } as Express.Multer.File;

    await expect(parseStatement(file)).resolves.toEqual([
      expect.objectContaining({ rowNumber: 2, description: 'UPI SWIGGY', amountMinor: -84950, reference: 'A1' }),
      expect.objectContaining({ rowNumber: 3, description: 'SALARY', amountMinor: 12500000, reference: 'B2' }),
    ]);
  });

  it('filters out failed, declined, or unsuccessful transaction rows in CSV statements', async () => {
    const file = {
      originalname: 'transactions.csv',
      buffer: Buffer.from(
        'Txn Date,Narration,Amount,Status,Ref No\n' +
        '01/07/2026,UPI SWIGGY,-450.00,SUCCESS,REF1\n' +
        '02/07/2026,AMAZON PURCHASE,-1200.00,FAILED,REF2\n' +
        '03/07/2026,PAYMENT DECLINED AT POS,-3000.00,DECLINED,REF3\n' +
        '04/07/2026,ZOMATO FOOD,-350.00,COMPLETED,REF4\n' +
        '05/07/2026,FLIPKART,-899.00,REJECTED,REF5\n'
      ),
    } as Express.Multer.File;

    const rows = await parseStatement(file);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ description: 'UPI SWIGGY', amountMinor: -45000 });
    expect(rows[1]).toMatchObject({ description: 'ZOMATO FOOD', amountMinor: -35000 });
  });

  it('rejects files with no detectable financial rows', async () => {
    const file = { originalname: 'bad.csv', buffer: Buffer.from('Thing,Other\nhello,world') } as Express.Multer.File;
    await expect(parseStatement(file)).rejects.toThrow('No transaction rows were detected');
  });
});
