import {
  extractBeneficiaryName,
  isRefundOrReversal,
  getMonthDateRange,
  computeCreditCardCurrentBalance,
} from '../../../src/common/utils/transaction-utils';

describe('transaction-utils', () => {
  describe('extractBeneficiaryName', () => {
    it('extracts UPI beneficiary names correctly', () => {
      expect(extractBeneficiaryName('UPI/12345/SWIGGY/PAYMENT')).toBe('SWIGGY');
      expect(extractBeneficiaryName('UPI/REV/67890/SWIGGY/PAYMENT')).toBe('SWIGGY');
    });

    it('extracts UPI VPA handles correctly', () => {
      expect(extractBeneficiaryName('paytm-swiggy@ptybl')).toBe('swiggy');
      expect(extractBeneficiaryName('zomato@hdfcbank')).toBe('zomato');
    });

    it('extracts Card POS terminal merchants correctly', () => {
      expect(extractBeneficiaryName('POS 4000XXXXXXXX0001 MAKEMYTRIP INDIA PVT LT BANGALORE')).toBe('MAKEMYTRIP');
    });

    it('extracts NEFT beneficiary names correctly', () => {
      expect(extractBeneficiaryName('NEFT-CR-ZERODHA BROKING')).toBe('ZERODHA BROKING');
    });

    it('extracts IMPS beneficiary names correctly', () => {
      expect(extractBeneficiaryName('IMPS/P2A/1234567890/MAKEMYTRIP')).toBe('MAKEMYTRIP');
    });

    it('extracts NACH mandate beneficiaries correctly', () => {
      expect(extractBeneficiaryName('NACH-HDFC-LOAN-EMI/123')).toBe('HDFC-LOAN-EMI');
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
    it('accurately calculates outstanding after payments and spends', () => {
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

    it('retains remaining outstanding debt after partial payment', () => {
      const card = { openingBalance: 0n };
      const txs = [
        { amount: -5000000n, transactionDate: new Date('2026-07-10T10:00:00Z') }, // ₹50,000 spend
        { amount: 1000000n, transactionDate: new Date('2026-08-15T00:00:00Z') },  // ₹10,000 partial payment
      ];

      const { currentBalance, outstanding } = computeCreditCardCurrentBalance(card, txs);
      expect(outstanding).toBe(4000000); // ₹40,000 debt remaining
      expect(currentBalance).toBe(-4000000);
    });

    it('correctly reduces outstanding balance upon receiving a merchant refund without dropping history', () => {
      const card = { openingBalance: 0n };
      const txs = [
        { amount: -5000000n, transactionDate: new Date('2026-07-10T10:00:00Z') }, // ₹50,000 spend
        { amount: 50000n, transactionDate: new Date('2026-08-15T00:00:00Z') },    // ₹500 refund
      ];

      const { currentBalance, outstanding } = computeCreditCardCurrentBalance(card, txs);
      expect(outstanding).toBe(4950000); // ₹49,500 debt remaining
      expect(currentBalance).toBe(-4950000);
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
