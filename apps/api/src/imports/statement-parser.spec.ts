import { parseStatement } from './statement-parser';

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

  it('rejects files with no detectable financial rows', async () => {
    const file = { originalname: 'bad.csv', buffer: Buffer.from('Thing,Other\nhello,world') } as Express.Multer.File;
    await expect(parseStatement(file)).rejects.toThrow('No transaction rows were detected');
  });
});
