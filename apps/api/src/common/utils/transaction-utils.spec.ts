import { extractBeneficiaryName, isRefundOrReversal, getMonthDateRange } from './transaction-utils';

describe('transaction-utils', () => {
  describe('extractBeneficiaryName', () => {
    it('extracts UPI beneficiary names correctly', () => {
      expect(extractBeneficiaryName('UPI/12345/SWIGGY/PAYMENT')).toBe('SWIGGY');
      expect(extractBeneficiaryName('UPI/REV/67890/SWIGGY/PAYMENT')).toBe('SWIGGY');
    });

    it('extracts NEFT beneficiary names correctly', () => {
      expect(extractBeneficiaryName('NEFT-CR-ZERODHA BROKING')).toBe('ZERODHA BROKING');
    });

    it('returns null for unparseable descriptions', () => {
      expect(extractBeneficiaryName('ATM WITHDRAWAL')).toBeNull();
    });
  });

  describe('isRefundOrReversal', () => {
    it('identifies refund and reversal keywords', () => {
      expect(isRefundOrReversal('Refund for cancelled order')).toBe(true);
      expect(isRefundOrReversal('REVERSAL - INCORRECT DEBIT')).toBe(true);
      expect(isRefundOrReversal('CASHBACK CREDIT')).toBe(true);
      expect(isRefundOrReversal('Regular debit purchase')).toBe(false);
    });
  });

  describe('getMonthDateRange', () => {
    it('parses YYYY-MM month parameter', () => {
      const { start, end, labelMonth } = getMonthDateRange(undefined, undefined, '2026-08');
      expect(labelMonth).toBe('2026-08');
      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(7); // August (0-indexed 7)
    });
  });
});
