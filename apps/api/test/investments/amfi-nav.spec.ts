import { AmfiNavService } from '../../src/investments/amfi-nav.service';

describe('AmfiNavService', () => {
  let service: AmfiNavService;

  beforeEach(() => {
    const mockPrisma: any = {};
    service = new AmfiNavService(mockPrisma);
    (service as any).cachedSchemes = [
      {
        schemeCode: '118989',
        isinGrowth: 'INF209K01YN0',
        isinReinv: '',
        schemeName: 'HDFC Mid Cap Fund Direct Plan GROWTH',
        plan: 'Direct Plan',
        option: 'GROWTH',
        nav: 237.124,
        date: '24-Aug-2026',
        normalizedName: 'hdfc mid cap fund direct plan growth',
      },
      {
        schemeCode: '145206',
        isinGrowth: 'INF277K01Y69',
        isinReinv: '',
        schemeName: 'Tata Small Cap Fund Direct Plan Growth',
        plan: 'Direct Plan',
        option: 'Growth',
        nav: 44.7641,
        date: '24-Aug-2026',
        normalizedName: 'tata small cap fund direct plan growth',
      },
      {
        schemeCode: '147662',
        isinGrowth: 'INF109K01YY0',
        isinReinv: '',
        schemeName: 'ICICI Prudential Commodities Fund Direct Plan Growth',
        plan: 'Direct Plan',
        option: 'Growth',
        nav: 52.13,
        date: '21-Aug-2026',
        normalizedName: 'icici prudential commodities fund direct plan growth',
      },
    ];
    (service as any).isinMap = new Map([
      ['INF209K01YN0', (service as any).cachedSchemes[0]],
      ['INF277K01Y69', (service as any).cachedSchemes[1]],
      ['INF109K01YY0', (service as any).cachedSchemes[2]],
    ]);
  });

  it('matches scheme by ISIN accurately', () => {
    const match = service.findMatchingScheme('HDFC Mid Cap', 'INF209K01YN0');
    expect(match).toBeDefined();
    expect(match?.schemeCode).toBe('118989');
    expect(match?.nav).toBe(237.124);
  });

  it('matches scheme by normalized fund name for Direct Growth plans', () => {
    const match = service.findMatchingScheme('HDFC Mid Cap Fund Direct Growth');
    expect(match).toBeDefined();
    expect(match?.schemeCode).toBe('118989');
    expect(match?.nav).toBe(237.124);
  });

  it('matches Tata Small Cap Direct Growth', () => {
    const match = service.findMatchingScheme('Tata Small Cap Fund Direct Growth');
    expect(match).toBeDefined();
    expect(match?.schemeCode).toBe('145206');
    expect(match?.nav).toBe(44.7641);
  });

  it('matches ICICI Prudential Commodities Fund Direct Growth', () => {
    const match = service.findMatchingScheme('ICICI Prudential Commodities Fund Direct Growth');
    expect(match).toBeDefined();
    expect(match?.schemeCode).toBe('147662');
    expect(match?.nav).toBe(52.13);
  });
});
