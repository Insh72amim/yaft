import {
  extractBeneficiaryName,
  isRefundOrReversal,
  getMonthDateRange,
  computeCreditCardCurrentBalance,
} from './transaction-utils';

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

  describe('computeCreditCardCurrentBalance', () => {
    it('anchors to spends strictly after latest payment when bill is paid', () => {
      const card = { openingBalance: 0n };
      const txs = [
        { amount: -500000n, transactionDate: new Date('2026-07-10T10:00:00Z') },
        { amount: -200000n, transactionDate: new Date('2026-07-20T10:00:00Z') },
        // Payment made on Aug 15
        { amount: 700000n, transactionDate: new Date('2026-08-15T00:00:00Z') },
        // New transaction after payment
        { amount: -50000n, transactionDate: new Date('2026-08-15T10:00:00Z') },
      ];

      const { currentBalance, outstanding } = computeCreditCardCurrentBalance(card, txs);
      expect(outstanding).toBe(50000);
      expect(currentBalance).toBe(-50000);
    });

    it('returns 0 outstanding when card is fully settled with no subsequent spends', () => {
      const card = { openingBalance: 0n };
      const txs = [
        { amount: -2225200n, transactionDate: new Date('2026-08-10T10:00:00Z') },
        { amount: 2225200n, transactionDate: new Date('2026-08-15T12:00:00Z') },
      ];

      const { currentBalance, outstanding } = computeCreditCardCurrentBalance(card, txs);
      expect(outstanding).toBe(0);
      expect(currentBalance).toBe(0);
    });

    it('respects explicitly calibrated non-zero opening balance', () => {
      const card = { openingBalance: -100000n };
      const txs = [
        { amount: -50000n, transactionDate: new Date('2026-08-10T10:00:00Z') },
      ];

      const { currentBalance, outstanding } = computeCreditCardCurrentBalance(card, txs);
      expect(outstanding).toBe(150000);
      expect(currentBalance).toBe(-150000);
    });
  });
});
