import {
  STATEMENT_COLUMN_ALIASES,
  TRANSACTION_STATUS_CONFIG,
  isDeclinedOrFailedStatus,
  isDeclinedOrFailedDescription,
  isDeclinedOrFailedTransaction,
  isRefundOrReversal,
  isExplicitSuccessfulRefund,
  canonicalizeMerchantName,
  cleanBeneficiaryToken,
  extractAlertAmount,
  extractAlertAccountLast4,
  extractAlertReferenceNumber,
  extractAlertRawMerchant,
  extractAlertDateTime,
  normalizeHeaderKey,
  parseMoneyToMinor,
  isCreditIndicator,
  isDebitIndicator,
  MONTH_NAME_TO_INDEX,
  COMMON_DATE_PATTERNS,
  INVESTMENT_COLUMN_ALIASES,
  classifyInvestmentAssetType,
  EPFO_PASSBOOK_PATTERNS,
} from '@yaft/shared';

describe('Parser Config Registry (@yaft/shared)', () => {
  describe('STATEMENT_COLUMN_ALIASES', () => {
    it('contains comprehensive aliases for standard statement headers', () => {
      expect(STATEMENT_COLUMN_ALIASES.date).toEqual(expect.arrayContaining(['date', 'txn date', 'value date']));
      expect(STATEMENT_COLUMN_ALIASES.description).toEqual(expect.arrayContaining(['narration', 'particulars', 'merchant']));
      expect(STATEMENT_COLUMN_ALIASES.amount).toEqual(expect.arrayContaining(['amount', 'txn amount']));
      expect(STATEMENT_COLUMN_ALIASES.debit).toEqual(expect.arrayContaining(['debit', 'withdrawal', 'dr amount']));
      expect(STATEMENT_COLUMN_ALIASES.credit).toEqual(expect.arrayContaining(['credit', 'deposit', 'cr amount']));
      expect(STATEMENT_COLUMN_ALIASES.reference).toEqual(expect.arrayContaining(['reference', 'ref no', 'utr']));
      expect(STATEMENT_COLUMN_ALIASES.status).toEqual(expect.arrayContaining(['status', 'transaction status', 'state']));
    });
  });

  describe('Transaction Status & Failure Detection', () => {
    it('identifies explicit failed / declined status codes', () => {
      expect(isDeclinedOrFailedStatus('FAILED')).toBe(true);
      expect(isDeclinedOrFailedStatus('Declined')).toBe(true);
      expect(isDeclinedOrFailedStatus('REJECTED')).toBe(true);
      expect(isDeclinedOrFailedStatus('Cancelled')).toBe(true);
      expect(isDeclinedOrFailedStatus('Unsuccessful')).toBe(true);
      expect(isDeclinedOrFailedStatus('Pending')).toBe(true);
      expect(isDeclinedOrFailedStatus('SUCCESS')).toBe(false);
      expect(isDeclinedOrFailedStatus('COMPLETED')).toBe(false);
      expect(isDeclinedOrFailedStatus(undefined)).toBe(false);
    });

    it('identifies declined / failed description keywords', () => {
      expect(isDeclinedOrFailedDescription('PAYMENT DECLINED AT POS')).toBe(true);
      expect(isDeclinedOrFailedDescription('UPI TXN FAILED TO SWIGGY')).toBe(true);
      expect(isDeclinedOrFailedDescription('Card Declined due to limits')).toBe(true);
      expect(isDeclinedOrFailedDescription('Transaction could not be processed')).toBe(true);
      expect(isDeclinedOrFailedDescription('UPI/12345/SWIGGY/PAYMENT')).toBe(false);
      expect(isDeclinedOrFailedDescription('SALARY FOR AUGUST')).toBe(false);
      expect(isDeclinedOrFailedDescription(undefined)).toBe(false);
    });

    it('combines status and description evaluation', () => {
      expect(isDeclinedOrFailedTransaction('SWIGGY ORDER', 'FAILED')).toBe(true);
      expect(isDeclinedOrFailedTransaction('PAYMENT DECLINED', 'SUCCESS')).toBe(true);
      expect(isDeclinedOrFailedTransaction('SWIGGY ORDER', 'SUCCESS')).toBe(false);
    });
  });

  describe('Refund & Reversal Detection', () => {
    it('detects refund and reversal descriptions', () => {
      expect(isRefundOrReversal('REFUND FROM SWIGGY')).toBe(true);
      expect(isRefundOrReversal('REVERSAL OF TXN 1234')).toBe(true);
      expect(isRefundOrReversal('CASHBACK CREDITED')).toBe(true);
      expect(isRefundOrReversal('PURCHASE AT ZOMATO')).toBe(false);
    });

    it('identifies explicit successful refund alert phrases', () => {
      expect(isExplicitSuccessfulRefund('Your account was credited with refund of Rs 500')).toBe(true);
      expect(isExplicitSuccessfulRefund('Refund has been processed for your order')).toBe(true);
      expect(isExplicitSuccessfulRefund('Cashback credited to your credit card')).toBe(true);
      expect(isExplicitSuccessfulRefund('Transaction of Rs 500 was declined')).toBe(false);
    });
  });

  describe('Merchant Canonicalization & Cleaning', () => {
    it('cleans company noise and trailing terminal info', () => {
      expect(cleanBeneficiaryToken('SWIGGY PRIVATE LIMITED')).toBe('SWIGGY');
      expect(cleanBeneficiaryToken('ZOMATO INDIA PVT LTD')).toBe('ZOMATO');
      expect(cleanBeneficiaryToken('MAKEMYTRIP PVT. LTD.')).toBe('MAKEMYTRIP');
    });

    it('canonicalizes known brands from UPI handles and POS raw strings', () => {
      expect(canonicalizeMerchantName('paytm-urbancompany@ptybl')).toBe('URBAN COMPANY');
      expect(canonicalizeMerchantName('payzomato@hdfcbank')).toBe('ZOMATO');
      expect(canonicalizeMerchantName('PUR/YOUTUBEGOOGLE/123456')).toBe('YOUTUBE GOOGLE');
      expect(canonicalizeMerchantName('ZE PTO INDIA')).toBe('ZEPTO');
      expect(canonicalizeMerchantName('SWIGGY BANGALORE')).toBe('SWIGGY');
      expect(canonicalizeMerchantName('BLINKIT COMMERCE')).toBe('BLINKIT');
      expect(canonicalizeMerchantName('AMAZON PAY')).toBe('AMAZON');
      expect(canonicalizeMerchantName('FLIPKART INDIA')).toBe('FLIPKART');
      expect(canonicalizeMerchantName('AIRTEL BILLPAY')).toBe('AIRTEL');
    });
  });

  describe('Email Alert Extractor Helpers', () => {
    it('extracts amounts accurately ignoring limits noise', () => {
      const text1 = 'Transaction Amount: INR 1611.00 at Zomato. Available Limit: INR 50,000.00.';
      expect(extractAlertAmount(text1)).toBe(1611);

      const text2 = 'Rs. 204.00 spent on Card XX1234. Total Due: Rs. 15,000.00.';
      expect(extractAlertAmount(text2)).toBe(204);

      const text3 = 'noticed a transaction of Rs. 608.28 on your account.';
      expect(extractAlertAmount(text3)).toBe(608.28);
    });

    it('extracts account last 4 digits from card / account patterns', () => {
      expect(extractAlertAccountLast4('spent on ICICI Bank Credit Card ending with 1004')).toBe('1004');
      expect(extractAlertAccountLast4('Card 4000XXXXXXXX0005 used for transaction')).toBe('0005');
      expect(extractAlertAccountLast4('A/C XX7890 credited')).toBe('7890');
    });

    it('extracts reference numbers and UPI UTR IDs', () => {
      expect(extractAlertReferenceNumber('Ref: 100000000103 on 14-08-26')).toBe('100000000103');
      expect(extractAlertReferenceNumber('UPI/P2M/100000000005/SWIGGY')).toBe('100000000005');
    });

    it('extracts merchant strings from various bank alert formats', () => {
      expect(extractAlertRawMerchant('Merchant Name: STARBUCKS COFFEE. Ref: 123')).toBe('STARBUCKS COFFEE');
      expect(extractAlertRawMerchant('debited to VPA swiggy@okhdfcbank on 14-Aug-26')).toBe('swiggy@okhdfcbank');
      expect(extractAlertRawMerchant('towards SWIGGY BANGALORE on 14-Aug-26')).toBe('SWIGGY BANGALORE');
      expect(extractAlertRawMerchant('spent at FLIPKART INDIA on 14-Aug-26')).toBe('FLIPKART INDIA');
    });

    it('extracts date and time information', () => {
      const dt = extractAlertDateTime('spent on 14-Aug-2026 at 15:30:20 at SWIGGY');
      expect(dt.dateStr).toBe('14-Aug-2026');
      expect(dt.timeStr).toBe('15:30:20');
    });
  });

  describe('Centralized Normalization & Money Helpers', () => {
    it('normalizes header keys consistently', () => {
      expect(normalizeHeaderKey('Transaction Date')).toBe('transaction date');
      expect(normalizeHeaderKey('Chq./Ref.No.')).toBe('chq ref no');
      expect(normalizeHeaderKey('  Unrealized P&L  ')).toBe('unrealized p l');
      expect(normalizeHeaderKey('EQUITY')).toBe('equity');
    });

    it('parses various money representations into minor units', () => {
      expect(parseMoneyToMinor('₹ 1,500.50')).toBe(150050);
      expect(parseMoneyToMinor('1234')).toBe(123400);
      expect(parseMoneyToMinor('(250.00)')).toBe(-25000);
      expect(parseMoneyToMinor('-45.20')).toBe(-4520);
      expect(parseMoneyToMinor('50.5%')).toBe(5050);
      expect(parseMoneyToMinor('')).toBeNull();
      expect(parseMoneyToMinor(null)).toBeNull();
      expect(parseMoneyToMinor(undefined)).toBeNull();
    });

    it('identifies debit and credit indicators correctly', () => {
      expect(isCreditIndicator('CR')).toBe(true);
      expect(isCreditIndicator('Credit')).toBe(true);
      expect(isCreditIndicator('deposit')).toBe(true);
      expect(isCreditIndicator('C')).toBe(true);
      expect(isCreditIndicator('DR')).toBe(false);

      expect(isDebitIndicator('DR')).toBe(true);
      expect(isDebitIndicator('Debit')).toBe(true);
      expect(isDebitIndicator('withdrawal')).toBe(true);
      expect(isDebitIndicator('D')).toBe(true);
      expect(isDebitIndicator('CR')).toBe(false);
    });
  });

  describe('Date Mappings & Common Patterns', () => {
    it('maps all standard 3-letter and full month names', () => {
      expect(MONTH_NAME_TO_INDEX.jan).toBe(0);
      expect(MONTH_NAME_TO_INDEX.august).toBe(7);
      expect(MONTH_NAME_TO_INDEX.dec).toBe(11);
    });

    it('matches date formats with centralized patterns', () => {
      expect(COMMON_DATE_PATTERNS.DD_MON_YY_REGEX.test("14 Aug '26")).toBe(true);
      expect(COMMON_DATE_PATTERNS.DD_MMM_YYYY_REGEX.test('14 Aug 2026, 12:30')).toBe(true);
      expect(COMMON_DATE_PATTERNS.DD_MM_YYYY_SLASH_OR_DASH_REGEX.test('14/08/2026')).toBe(true);
      expect(COMMON_DATE_PATTERNS.MON_YYYY_REGEX.test('Aug-2026')).toBe(true);
    });
  });

  describe('Investments and EPFO Regex Configurations', () => {
    it('classifies investment asset types accurately', () => {
      expect(classifyInvestmentAssetType('equity', 'IT', 'Equity')).toBe('STOCK');
      expect(classifyInvestmentAssetType('mutual funds', 'Debt', 'Mutual Fund')).toBe('MUTUAL_FUND');
      expect(classifyInvestmentAssetType('equity', 'ETF', 'Nifty ETF')).toBe('ETF');
      expect(classifyInvestmentAssetType(undefined, undefined, 'Gold ETF')).toBe('ETF');
    });

    it('provides investment column aliases', () => {
      expect(INVESTMENT_COLUMN_ALIASES.schemeOrSymbol).toContain('symbol');
      expect(INVESTMENT_COLUMN_ALIASES.isin).toContain('isin');
      expect(INVESTMENT_COLUMN_ALIASES.units).toContain('quantity');
    });

    it('provides valid EPFO passbook regex patterns', () => {
      expect(EPFO_PASSBOOK_PATTERNS.PASSBOOK_LAYOUT_REGEX.test('EPF Passbook for Member')).toBe(true);
      expect(EPFO_PASSBOOK_PATTERNS.CLOSING_BALANCE_REGEX.test('Closing Balance as on 31/03/2026 1000 2000 3000')).toBe(true);
    });
  });
});
