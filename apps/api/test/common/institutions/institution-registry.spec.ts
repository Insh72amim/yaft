import {
  findInstitution,
  getInstitutionDomain,
  getInstitutionLocalLogo,
  getInstitutionName,
  INSTITUTIONS,
} from '../../../src/common/institutions/institution-registry';

describe('InstitutionRegistry', () => {
  it('identifies institutions by exact ID and canonical name', () => {
    const hdfc = findInstitution('hdfc');
    expect(hdfc?.name).toBe('HDFC Bank');
    expect(hdfc?.domain).toBe('hdfcbank.com');

    const icici = findInstitution('ICICI Bank');
    expect(icici?.id).toBe('icici');
  });

  it('identifies institutions by fuzzy alias', () => {
    const sbi = findInstitution('State Bank of India Savings Account');
    expect(sbi?.id).toBe('sbi');

    const axis = findInstitution('Axis Bank Credit Card XX1234');
    expect(axis?.id).toBe('axis');

    const zerodha = findInstitution('Zerodha Kite Trading');
    expect(zerodha?.id).toBe('zerodha');
  });

  it('returns default values for unknown institutions', () => {
    expect(getInstitutionDomain('Unknown Bank XYZ')).toBe('bank.com');
    expect(getInstitutionLocalLogo('Unknown Bank XYZ')).toBeNull();
    expect(getInstitutionName('Unknown Bank XYZ')).toBe('Unknown Bank XYZ');
  });

  it('resolves correct local logos when available', () => {
    expect(getInstitutionLocalLogo('HDFC Bank')).toBe('/logos/hdfc.png');
    expect(getInstitutionLocalLogo('ICICI Bank')).toBe('/logos/icici.png');
    expect(getInstitutionLocalLogo('SBI')).toBe('/logos/sbi.png');
    expect(getInstitutionLocalLogo('Kotak Mahindra Bank')).toBeNull();
  });
});
