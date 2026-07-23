import { MatchField, MatchType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CategoryRulesService } from './category-rules.service';

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
});
