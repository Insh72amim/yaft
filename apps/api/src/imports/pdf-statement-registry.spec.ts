import type { PdfStatementDocument } from './bank-pdf-parser';
import { selectBankPdfParser } from './pdf-statement-registry';

function axisDocument(): PdfStatementDocument {
  return {
    total: 1,
    textPages: [{ num: 1, text: 'AXIS BANK Statement of Axis Account No : XXXXXXXX' }],
    tablePages: [{ num: 1, tables: [[['Tran Date', 'Chq No', 'Particulars', 'Debit', 'Credit', 'Balance', 'Init. Br.']]] }],
  };
}

describe('bank PDF parser registry', () => {
  it('routes by a normalised institution and verifies the selected layout', () => {
    expect(selectBankPdfParser(axisDocument(), 'Axis Bank Limited').id).toBe('AXIS');
    expect(() => selectBankPdfParser(axisDocument(), 'State Bank of India')).toThrow('does not match the selected SBI');
  });

  it('allows exactly one content match when the institution is absent', () => {
    expect(selectBankPdfParser(axisDocument()).id).toBe('AXIS');
  });

  it('rejects unknown and ambiguous content', () => {
    const unknown: PdfStatementDocument = { total: 1, textPages: [{ num: 1, text: 'Unknown scanned content' }], tablePages: [] };
    expect(() => selectBankPdfParser(unknown)).toThrow('does not match a supported');

    const ambiguous = axisDocument();
    ambiguous.tablePages[0].tables.push([['Transaction Date', 'Cheque Number', 'Withdrawal', 'Deposit', 'Balance', 'Narration']]);
    expect(() => selectBankPdfParser(ambiguous)).toThrow('more than one supported bank layout');
  });
});
