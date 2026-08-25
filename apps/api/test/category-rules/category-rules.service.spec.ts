import { MatchField, MatchType } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma.service';
import { CategoryRulesService } from '../../src/category-rules/category-rules.service';

describe('CategoryRulesService', () => {
  let service: CategoryRulesService;

  beforeEach(() => {
    service = new CategoryRulesService({} as PrismaService);
  });

  describe('matchesText', () => {
    it('matches CONTAINS pattern correctly case-insensitively', () => {
      expect(service.matchesText('Swiggy Bangalore IN', 'swiggy', MatchType.CONTAINS)).toBe(true);
      expect(service.matchesText('Zomato Media', 'swiggy', MatchType.CONTAINS)).toBe(false);
    });

    it('matches EXACT pattern correctly', () => {
      expect(service.matchesText('Uber', 'Uber', MatchType.EXACT)).toBe(true);
      expect(service.matchesText('Uber India', 'Uber', MatchType.EXACT)).toBe(false);
    });

    it('matches STARTS_WITH pattern correctly', () => {
      expect(service.matchesText('NEFT-AXIS0001-PAYEE', 'NEFT-', MatchType.STARTS_WITH)).toBe(true);
      expect(service.matchesText('PAYMENT NEFT-', 'NEFT-', MatchType.STARTS_WITH)).toBe(false);
    });

    it('matches REGEX pattern correctly', () => {
      expect(service.matchesText('UPI/12345/JOHN/PAY', '^UPI/.*JOHN', MatchType.REGEX)).toBe(true);
      expect(service.matchesText('CARD SWIPE 1234', '^UPI/.*JOHN', MatchType.REGEX)).toBe(false);
    });
  });

  describe('matchRules', () => {
    it('returns the categoryId of the highest priority matching rule', () => {
      const rules: any[] = [
        { id: '1', pattern: 'Swiggy', matchField: MatchField.DESCRIPTION, matchType: MatchType.CONTAINS, categoryId: 'cat-dining' },
        { id: '2', pattern: 'Zomato', matchField: MatchField.DESCRIPTION, matchType: MatchType.CONTAINS, categoryId: 'cat-dining' },
      ];

      expect(service.matchRules(rules, 'Swiggy Order #123')).toBe('cat-dining');
      expect(service.matchRules(rules, 'Amazon Purchase')).toBe(null);
    });
  });

  describe('matchTransactionCategory', () => {
    const categories = [
      { id: 'cat-food', name: 'Food & Dining' },
      { id: 'cat-groceries', name: 'Groceries' },
      { id: 'cat-transport', name: 'Transport & Fuel' },
      { id: 'cat-shopping', name: 'Shopping & Clothing' },
      { id: 'cat-bills', name: 'Bills & Utilities' },
      { id: 'cat-mf', name: 'Mutual Fund SIP' },
      { id: 'cat-ott', name: 'Entertainment & OTT' },
    ];

    it('matches built-in pattern for MakeMyTrip credit card spend to Transport & Fuel', () => {
      const result = service.matchTransactionCategory([], categories, 'MAKEMYTRIP INDIA PVT LT [ICICI Bank Credit Card ••0001]', 'MAKEMYTRIP INDIA PVT LT');
      expect(result.categoryId).toBe('cat-transport');
      expect(result.confidence).toBe(85);
    });

    it('matches built-in pattern for Amazon credit card spend to Shopping & Clothing', () => {
      const result = service.matchTransactionCategory([], categories, 'AMAZON PAY INDIA [HDFC Credit Card]', 'AMAZON PAY');
      expect(result.categoryId).toBe('cat-shopping');
      expect(result.confidence).toBe(85);
    });

    it('matches built-in pattern for Blinkit credit card spend to Groceries', () => {
      const result = service.matchTransactionCategory([], categories, 'BLINKIT COMMERCE [SBI Card ••0004]', 'BLINKIT');
      expect(result.categoryId).toBe('cat-groceries');
      expect(result.confidence).toBe(85);
    });

    it('matches suggestedCategoryName from email alert parser', () => {
      const result = service.matchTransactionCategory([], categories, 'UTI NIFTY 50 INDEX FUND [Folio 12345]', 'UTI MUTUAL FUND', undefined, 'Mutual Fund SIP');
      expect(result.categoryId).toBe('cat-mf');
      expect(result.confidence).toBe(90);
    });

    it('prioritizes user custom rules over built-in patterns', () => {
      const customRules: any[] = [
        { id: '1', pattern: 'AMAZON', matchField: MatchField.MERCHANT, matchType: MatchType.CONTAINS, categoryId: 'cat-bills', priority: 20 },
      ];
      const result = service.matchTransactionCategory(customRules, categories, 'AMAZON PAY INDIA', 'AMAZON PAY');
      expect(result.categoryId).toBe('cat-bills');
      expect(result.confidence).toBe(95);
    });
  });
});
