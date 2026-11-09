import { BadRequestException } from '@nestjs/common';
import type { BankPdfParser, PdfStatementDocument } from '../../src/imports/bank-pdf-parser';
import {
  bankInstitutionMatchesSource,
  bankSourceForInstitution,
  parseLoadedBankPdfDocument,
  selectBankPdfParser,
  UnsupportedPdfLayoutException,
} from '../../src/imports/pdf-statement-registry';

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
    expect(() => selectBankPdfParser(unknown)).toThrow(UnsupportedPdfLayoutException);
    expect(() => selectBankPdfParser(unknown)).toThrow('does not match a supported');

    const ambiguous = axisDocument();
    ambiguous.tablePages[0].tables.push([['Transaction Date', 'Cheque Number', 'Withdrawal', 'Deposit', 'Balance', 'Narration']]);
    expect(() => selectBankPdfParser(ambiguous)).toThrow('more than one supported bank layout');
  });

  it('maps explicit sources only to matching bank institutions', () => {
    expect(bankSourceForInstitution('State Bank of India')).toBe('SBI');
    expect(bankInstitutionMatchesSource('Punjab National Bank', 'PNB')).toBe(true);
    expect(bankInstitutionMatchesSource('Axis Bank', 'SBI')).toBe(false);
    expect(bankSourceForInstitution('Unrelated bank')).toBeUndefined();
  });

  it('fails closed when a matched bank parser throws a reconciliation error instead of falling back to generic parser', () => {
    const failingAxisParser: BankPdfParser = {
      id: 'AXIS',
      institutionAliases: ['axis', 'axis bank'],
      matches: () => true,
      parse: () => {
        throw new BadRequestException('Axis running balance reconciliation failed at row 4.');
      },
    };

    expect(() =>
      parseLoadedBankPdfDocument(axisDocument(), { institution: 'Axis Bank' }, [failingAxisParser]),
    ).toThrow('Axis running balance reconciliation failed at row 4.');
  });
});
