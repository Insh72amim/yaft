import { parseEmailAlertSnippet, parseMultipleEmailAlerts, parseIndianDate } from '../../src/email-ingestion/email-alert-parser';

describe('EmailAlertParser', () => {
  it('should parse HDFC Bank UPI debit alert', () => {
    const text = 'Dear Customer, Rs. 2,450.00 has been debited from HDFC Bank account **1234 to VPA zomato@upi on 14-08-26. Ref: 100000000001.';
    const result = parseEmailAlertSnippet(text, 'alerts@hdfcbank.net');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('HDFC Bank');
    expect(result?.accountLast4).toBe('1234');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(2450);
    expect(result?.amountMinor).toBe(-245000n);
    expect(result?.merchant).toContain('ZOMATO');
    expect(result?.referenceNumber).toBe('100000000001');
  });

  it('should parse ICICI Credit Card spend alert', () => {
    const text = 'INR 1,299.00 spent on ICICI Bank Credit Card XX0002 on 14-Aug-26 at FLIPKART. Ref: 100000000002.';
    const result = parseEmailAlertSnippet(text);

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountLast4).toBe('0002');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(1299);
    expect(result?.merchant).toContain('FLIPKART');
  });

  it('should parse SBI UPI credit alert', () => {
    const text = 'Dear SBI User, your A/C XX0003 credited by Rs 5,000.00 on 14Aug26 thru UPI ref no 100000000003.';
    const result = parseEmailAlertSnippet(text);

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('State Bank of India');
    expect(result?.accountLast4).toBe('0003');
    expect(result?.type).toBe('CREDIT');
    expect(result?.amountDisplay).toBe(5000);
    expect(result?.amountMinor).toBe(500000n);
  });

  it('should parse multiple alert blocks in single text', () => {
    const multiText = `
      Dear Customer, Rs. 2,450.00 has been debited from HDFC Bank account **1234 to VPA zomato@upi on 14-08-26. Ref: 100000000001.
      
      Dear Customer, INR 1,299.00 spent on ICICI Bank Credit Card XX0002 on 14-Aug-26 at FLIPKART. Ref: 100000000002.
    `;
    const list = parseMultipleEmailAlerts(multiText);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].amountDisplay).toBe(2450);
    expect(list[1].amountDisplay).toBe(1299);
  });

  it('should parse ICICI Credit Card with Available Limit and ending with syntax', () => {
    const text = 'Dear Customer, INR 2,450.00 has been spent on your ICICI Bank Credit Card ending with 0006 on 12-Aug-26 at AMAZON INDIA. Available Limit: INR 1,50,000.00.';
    const result = parseEmailAlertSnippet(text, 'credit_cards@icicibank.com');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('0006');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(2450);
    expect(result?.amountMinor).toBe(-245000n);
    expect(result?.merchant).toContain('AMAZON');
  });

  it('should parse ICICI Credit Card with Merchant Name label and 16-digit masked card number', () => {
    const text = 'Dear Customer, Transaction on ICICI Bank Credit Card 4000XXXXXXXX0005 for INR 500.00 on 10-Aug-2026. Merchant Name: STARBUCKS COFFEE. Ref: TXN12345678. Available Credit Limit: INR 1,00,000.00.';
    const result = parseEmailAlertSnippet(text, 'alerts@icicibank.com');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('0005');
    expect(result?.amountDisplay).toBe(500);
    expect(result?.merchant).toContain('STARBUCKS');
    expect(result?.referenceNumber).toBe('TXN12345678');
  });

  it('should parse ICICI Credit Card spend alert with timestamp before merchant', () => {
    const text = 'Dear Customer, Your ICICI Bank Credit Card XX0005 has been used for a transaction of INR 3,000.00 on 12-Aug-2026 at 15:30:20 at SWIGGY BANGALORE. Total Due: INR 10,000.00.';
    const result = parseEmailAlertSnippet(text);

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('0005');
    expect(result?.amountDisplay).toBe(3000);
    expect(result?.merchant).toContain('SWIGGY');
  });

  it('should parse ICICI Amazon Pay Card with 4XXX format', () => {
    const text = 'Dear Customer, INR 899.00 was spent on your ICICI Bank Amazon Pay Card 4XXX1234 on 11-Aug-26 at ZOMATO. Total Credit Limit is INR 2,00,000.00.';
    const result = parseEmailAlertSnippet(text);

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('1234');
    expect(result?.amountDisplay).toBe(899);
    expect(result?.merchant).toContain('ZOMATO');
  });

  it('should parse user exact ICICI Credit Card snippet with Month DD, YYYY and Info: label', () => {
    const text = `Dear Customer,

Your ICICI Bank Credit Card XX0001 has been used for a transaction of INR 500.00 on Aug 09, 2026 at 07:34:01. Info: MAKEMYTRIP INDIA PVT LT.

The Available Credit Limit on your card is INR 90,000.00 and Total Credit Limit is INR 1,00,000.00. The above limits are a total of the limits of all the Credit Cards issued to the primary card holder, including any supplementary cards.`;
    const result = parseEmailAlertSnippet(text, 'credit_cards@icicibank.com');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('0001');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(500);
    expect(result?.amountMinor).toBe(-50000n);
    expect(result?.transactionDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })).toBe('9/8/2026');
    expect(result?.transactionDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })).toBe('07:34:01');
  });

  it('should parse HDFC Pixel Play Credit Card with VPA and time', () => {
    const text = 'Dear Customer, Greetings from HDFC Bank! Thank you for using your HDFC Bank Pixel Play Credit Card ending with 1234. We noticed a transaction of Rs. 200.00 at paytm-urbancompany@ptybl on 15/08/26 at 20:00. You can view more details of this transaction on the PIXEL Homepage inside your PayZapp App. Important Note: If this transaction was not done by you, please act quickly.';
    const result = parseEmailAlertSnippet(text, 'alerts@hdfcbank.net');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('HDFC Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('1234');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(200);
    expect(result?.amountMinor).toBe(-20000n);
    expect(result?.merchant).toBe('URBAN COMPANY');
    expect(result?.transactionDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })).toBe('15/8/2026');
    expect(result?.transactionDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })).toBe('20:00:00');
  });

  it('should parse Axis Bank Credit Card transaction with Merchant Name and IST time', () => {
    const text = "15-08-2026 Dear Test Customer, Here's the summary of your Axis Bank Credit Card Transaction: Transaction Amount: INR 1500 Merchant Name: SWIGGY PVT Axis Bank Credit Card No. XX5678 Date & Time: 15-08-2026, 19:04:27 IST Available Limit*: INR 50000.00 Total Credit Limit*: INR 100000 *The information above includes the available and total credit limit across all of your Axis Bank credit cards. If this transaction was not initiated by you: Call us at: 18001800181";
    const result = parseEmailAlertSnippet(text, 'alerts@axis.bank.in');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Axis Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('5678');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(1500);
    expect(result?.amountMinor).toBe(-150000n);
    expect(result?.merchant).toBe('SWIGGY');
    expect(result?.transactionDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })).toBe('15/8/2026');
    expect(result?.transactionDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })).toBe('19:04:27');
  });

  it('should parse Axis Bank A/c debit with UPI transaction info without mistaking account as credit card', () => {
    const text = "14-08-2026 Dear Test Customer, Here's the summary of your transaction: Amount Debited: INR 200.00 Account Number: XX1234 Date & Time: 14-08-26, 12:46:28 IST Transaction Info: UPI/P2A/100000000001/SAMPLE MERCHANT If this transaction was not initiated by you: To block UPI: SMS BLOCKUPI to +911800180018";
    const result = parseEmailAlertSnippet(text, 'alerts@axis.bank.in');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Axis Bank');
    expect(result?.accountType).toBe('BANK');
    expect(result?.accountLast4).toBe('1234');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(200);
    expect(result?.amountMinor).toBe(-20000n);
    expect(result?.merchant).toBe('SAMPLE MERCHANT');
    expect(result?.referenceNumber).toBe('100000000001');
  });

  it('should parse Axis Bank A/c debit for online purchases with POS/PUR info', () => {
    const text = '14-08-2026 Dear Customer, Thank you for banking with us. We wish to inform you that INR 59.00 has been debited from your A/c no. XX321234 on 14-08-2026 21:37:07 at PUR/YOUTUBEGOOGLE/YOUTUBEGOOGLE/123456. Available balance: INR 10000.00. Please SMS BLOCKCARD 9012';
    const result = parseEmailAlertSnippet(text, 'alerts@axis.bank.in');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Axis Bank');
    expect(result?.accountType).toBe('BANK');
    expect(result?.accountLast4).toBe('1234');
    expect(result?.amountDisplay).toBe(59);
    expect(result?.merchant).toBe('YOUTUBE GOOGLE');
  });

  it('should parse Axis Bank A/c credit alert as BANK account type and never CREDIT_CARD', () => {
    const text = "09-05-2026 Dear Test Customer, Here's the summary of your transaction: Amount Credited: INR 100.00 Account Number: XX1234 Date & Time: 09-05-26, 14:15:00 IST Transaction Info: UPI/P2A/1234567890/VENDOR XYZ. If this transaction was not initiated by you: Call us at: 18001800181";
    const result = parseEmailAlertSnippet(text, 'alerts@axis.bank.in');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Axis Bank');
    expect(result?.accountType).toBe('BANK');
    expect(result?.accountLast4).toBe('1234');
    expect(result?.type).toBe('CREDIT');
    expect(result?.amountDisplay).toBe(100);
    expect(result?.amountMinor).toBe(10000n);
    expect(result?.merchant).toBe('VENDOR XYZ');
  });

  it('should parse ICICI Credit Card with spaced merchant ZE PTO', () => {
    const text = 'Dear Customer, Your ICICI Bank Credit Card XX0001 has been used for a transaction of INR 50.00 on Aug 02, 2026 at 20:30:00. Info: ZE PTO. The Available Credit Limit on your card is INR 95,000.00 and Total Credit Limit is INR 1,00,000.00.';
    const result = parseEmailAlertSnippet(text, 'credit_cards@icici.bank.in');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('0001');
    expect(result?.amountDisplay).toBe(50);
    expect(result?.merchant).toBe('ZEPTO');
  });

  it('should parse Credit Card refunds and reversals', () => {
    const text = 'Dear Customer, INR 1,299.00 has been credited to your ICICI Bank Credit Card ending 0004 on 04-Aug-26 towards REFUND FROM SWIGGY. Total Avail Limit: INR 2,00,000.00. Ref: 100000000010.';
    const result = parseEmailAlertSnippet(text, 'alerts@icicibank.com');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('0004');
    expect(result?.type).toBe('CREDIT');
    expect(result?.amountDisplay).toBe(1299);
    expect(result?.amountMinor).toBe(129900n);
    expect(result?.merchant).toBe('SWIGGY');
    expect(result?.referenceNumber).toBe('100000000010');
  });

  it('should correctly parse Indian date formats including Month DD, YYYY and times in IST', () => {
    const d1 = parseIndianDate('14-08-26');
    expect(d1.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })).toBe('14/8/2026');

    const d2 = parseIndianDate('14-Aug-26');
    expect(d2.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })).toBe('14/8/2026');

    const d3 = parseIndianDate('Aug 09, 2026', '07:34:01');
    // 07:34:01 IST is 02:04:01 UTC
    expect(d3.getUTCHours()).toBe(2);
    expect(d3.getUTCMinutes()).toBe(4);
    expect(d3.getUTCSeconds()).toBe(1);
    expect(d3.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })).toBe('07:34:01');
  });

  it('should strictly fallback to email receipt date/time when alert text lacks inline date', () => {
    const fallbackDate = new Date('2026-08-08T16:10:34.000Z'); // 8 August 2026 9:40:34 pm IST
    const hdfcPixelText = 'Dear Customer, Greetings from HDFC Bank! Thank you for using your HDFC Bank Pixel Play Credit Card ending with 1234. We noticed a transaction of Rs. 1255.00 at instantpay@sbipay';

    const parsed = parseEmailAlertSnippet(hdfcPixelText, 'alerts@hdfcbank.net', fallbackDate);
    expect(parsed).not.toBeNull();
    expect(parsed?.amountMinor).toBe(-125500n);
    expect(parsed?.transactionDate.toISOString()).toBe('2026-08-08T16:10:34.000Z');
    expect(parsed?.transactionDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })).toBe('9:40:34 pm');
  });

  it('should ignore and reject declined, failed, unsuccessful, or rejected transaction alerts', () => {
    // 1. Explicitly declined credit card alert
    const declinedCc = 'Dear Customer, your transaction of INR 1,500.00 on ICICI Bank Credit Card XX0005 was declined due to insufficient limit on 14-Aug-2026 at SWIGGY.';
    expect(parseEmailAlertSnippet(declinedCc)).toBeNull();

    // 2. Failed UPI alert
    const failedUpi = 'Dear Customer, UPI transaction of Rs. 450.00 to merchant@upi from HDFC Bank A/c **1234 failed on 12-Aug-26.';
    expect(parseEmailAlertSnippet(failedUpi, 'alerts@hdfcbank.net')).toBeNull();

    // 3. Unsuccessful transaction alert
    const unsuccessfulTxn = 'We noticed an unsuccessful transaction of INR 2,999.00 on your Axis Bank Credit Card ending 0007 on 10-Aug-26.';
    expect(parseEmailAlertSnippet(unsuccessfulTxn, 'alerts@axisbank.com')).toBeNull();

    // 4. Rejected transaction alert
    const rejectedTxn = 'Your transaction of INR 850.00 on Card XX8899 was rejected by the bank security checks.';
    expect(parseEmailAlertSnippet(rejectedTxn)).toBeNull();

    // 5. Payment could not be processed
    const couldNotProcess = 'Your payment of INR 3,200.00 at AMAZON could not be processed.';
    expect(parseEmailAlertSnippet(couldNotProcess)).toBeNull();

    // 6. Multiple alerts containing a mix of successful and declined
    const multiWithDeclined =
      'Dear Customer, Rs. 2,450.00 has been debited from HDFC Bank account **1234 to VPA zomato@upi on 14-08-26. Ref: 100000000103.\n\n' +
      'Dear Customer, your transaction of INR 1,500.00 on ICICI Bank Credit Card XX0005 was declined.\n\n' +
      'Dear Customer, INR 1,299.00 spent on ICICI Bank Credit Card XX4321 on 14-Aug-26 at FLIPKART. Ref: 1000000014.';
    const list = parseMultipleEmailAlerts(multiWithDeclined);
    expect(list.length).toBe(2);
    expect(list[0].amountDisplay).toBe(2450);
    expect(list[1].amountDisplay).toBe(1299);
  });

  it('should reject promotional, marketing, EMI conversion, OTP, and monthly statement emails', () => {
    // 1. Axis Bank Flexi EMI marketing offer
    const axisEmi = 'Available on Axis Bank Credit Cards Turn your eligible spends into FLEXI EMI instantly! Dear Test Customer , Managing your expenses has never been easier. Convert transactions worth INR 2000 on your Axis Bank';
    expect(parseEmailAlertSnippet(axisEmi, 'Axis Bank Cards <info@digital.axisbankmail.bank.in>')).toBeNull();

    // 2. SBI Flexipay EMI conversion promo
    const sbiEmi = 'Having trouble viewing this e-mail? View this message in your browser SBI Card - App SBI Card Book Flexipay Enjoy ZERO Processing Fee* on converting your transaction of ₹3284.72 done on 20 AUG 2026';
    expect(parseEmailAlertSnippet(sbiEmi, 'SBI Card <offers@offers.sbicard.com>')).toBeNull();

    // 3. Rewards / vouchers marketing
    const rewards = 'Unlock exciting rewards on your Axis Bank Credit Card with vouchers from top brands worth INR 1,000.';
    expect(parseEmailAlertSnippet(rewards, 'Axis Bank Cards <info@digital.axisbankmail.bank.in>')).toBeNull();

    // 4. Monthly statement summary
    const statement = 'Dear Customer, We trust that your experience of using your HDFC Bank Pixel Cards has been enjoyable. Total Amount Due ₹9288.87 Minimum Amount Due ₹464.44 Payment Due Date 03-09-2026';
    expect(parseEmailAlertSnippet(statement, 'HDFC Bank <alerts@hdfcbank.net>')).toBeNull();

    // 5. OTP verification email
    const otp = 'One Time Password (OTP) for your online transaction of Rs. 1,450.00 at MYNTRA DES is 482910. Do not share your OTP with anyone.';
    expect(parseEmailAlertSnippet(otp, 'onlinesbicard@sbicard.com')).toBeNull();

    // 6. Discount & promotional marketing offer emails (e.g. Google Pixel ₹10,000 off)
    const promoDiscount = 'Up to &#8377;10,000 off on Google Pixel 11 with ICICI Bank Credit Card EMI & non-EMI transactions Avail Now Bring home Google Pixel 11 with an exciting offer on ICICI Bank Credit Card EMI & non-EMI transactions.';
    expect(parseEmailAlertSnippet(promoDiscount, 'ICICI Bank <services@customer.icici.bank.in>')).toBeNull();

    // 7. Balance enquiry
    const balEnquiry = 'Dear Customer, Your A/C XX1234 balance is Rs. 45,231.50 as on 20-Aug-2026. Thank you for banking with State Bank of India.';
    expect(parseEmailAlertSnippet(balEnquiry, 'alerts@sbi.co.in')).toBeNull();

    // 8. Mini-statement
    const miniStatement = 'Dear Customer, Mini statement for your A/C XX9876: Last 5 transactions details...';
    expect(parseEmailAlertSnippet(miniStatement, 'alerts@hdfcbank.net')).toBeNull();

    // 9. Card activation
    const cardActivated = 'Congratulations! Your HDFC Bank Credit Card ending 9876 has been activated successfully. Enjoy exclusive benefits.';
    expect(parseEmailAlertSnippet(cardActivated, 'alerts@hdfcbank.net')).toBeNull();

    // 10. Reward points summary
    const rewardPoints = 'Dear Customer, You have earned 500 reward points on your recent transaction. Total reward points earned: 2,450.';
    expect(parseEmailAlertSnippet(rewardPoints, 'alerts@icicibank.com')).toBeNull();

    // 11. Debit / Credit card benefits and informational announcements
    const debitCardBenefits = "31-07-2026 Dear Test Customer, We hope that you are enjoying the hand-picked benefits that come with your Online Rewards Debit Card no. XX0008, linked to your A/c no. XX1234. Here's a quick glance at the benefits on your card: • Earn accelerated EDGE REWARD Points on eligible categories • Avail voucher worth Rs. 500";
    expect(parseEmailAlertSnippet(debitCardBenefits, 'Axis Bank Alerts <alerts@axis.bank.in> Important information regarding your Axis Bank Online Rewards Debit Card')).toBeNull();
  });

  it('should parse SBI Credit Card spend alert', () => {
    const text = 'Your SBI Card ending 5678 has been used for a transaction of Rs. 1,299.00 at MYNTRA on 20-Aug-2026. Ref: TXN98765432. Available Credit Limit: Rs. 85,000.00.';
    const result = parseEmailAlertSnippet(text, 'alerts@sbicard.com');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('State Bank of India');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('5678');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(1299);
    expect(result?.amountMinor).toBe(-129900n);
    expect(result?.merchant).toBe('MYNTRA');
    expect(result?.referenceNumber).toBe('TXN98765432');
  });

  it('should parse Kotak Mahindra Bank debit alert', () => {
    const text = 'Dear Customer, INR 850.00 debited from your Kotak Bank A/c XX4567 on 20/08/26 towards SWIGGY. Available Bal: INR 24,500.00. Ref: 100000000004.';
    const result = parseEmailAlertSnippet(text, 'alerts@kotak.com');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Kotak Mahindra Bank');
    expect(result?.accountType).toBe('BANK');
    expect(result?.accountLast4).toBe('4567');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(850);
    expect(result?.amountMinor).toBe(-85000n);
    expect(result?.merchant).toBe('SWIGGY');
    expect(result?.referenceNumber).toBe('100000000004');
  });

  it('should parse IDFC First Bank transaction alert with BigBasket merchant', () => {
    const text = 'Transaction alert: INR 2,100.00 debited from IDFC First Bank A/C ending 3456 at BIGBASKET on 18-08-2026. Ref: 100000000005.';
    const result = parseEmailAlertSnippet(text, 'alerts@idfcfirstbank.com');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('IDFC First Bank');
    expect(result?.accountType).toBe('BANK');
    expect(result?.accountLast4).toBe('3456');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(2100);
    expect(result?.amountMinor).toBe(-210000n);
    expect(result?.merchant).toBe('BIGBASKET');
    expect(result?.referenceNumber).toBe('100000000005');
  });

  it('should parse Punjab National Bank debit alert', () => {
    const text = 'Dear Customer, Rs. 500.00 has been debited from your PNB A/C XX2345 to VPA paytm-urbancompany@ptybl on 19-08-2026. Ref: 100000000006.';
    const result = parseEmailAlertSnippet(text, 'alerts@pnb.co.in');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Punjab National Bank');
    expect(result?.accountType).toBe('BANK');
    expect(result?.accountLast4).toBe('2345');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(500);
    expect(result?.amountMinor).toBe(-50000n);
    expect(result?.merchant).toBe('URBAN COMPANY');
    expect(result?.referenceNumber).toBe('100000000006');
  });

  it('should parse NEFT/IMPS credit transaction with sender name', () => {
    const text = 'NEFT CR: INR 50,000.00 credited to your HDFC Bank A/c **1234 from JOHN DOE. NEFT Ref: HDFC123456789 on 19-08-2026.';
    const result = parseEmailAlertSnippet(text, 'alerts@hdfcbank.net');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('HDFC Bank');
    expect(result?.accountType).toBe('BANK');
    expect(result?.accountLast4).toBe('1234');
    expect(result?.type).toBe('CREDIT');
    expect(result?.amountDisplay).toBe(50000);
    expect(result?.amountMinor).toBe(5000000n);
    expect(result?.merchant).toBe('JOHN DOE');
    expect(result?.referenceNumber).toBe('HDFC123456789');
  });

  it('should parse recurring auto-debit / mandate alert', () => {
    const text = 'Auto debit of INR 499.00 processed on your ICICI Bank Credit Card XX0001 towards NETFLIX on 20-Aug-2026. Available Limit: INR 90,000.00.';
    const result = parseEmailAlertSnippet(text, 'credit_cards@icicibank.com');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('0001');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(499);
    expect(result?.amountMinor).toBe(-49900n);
    expect(result?.merchant).toBe('NETFLIX');
  });

  it('should parse HTML entity &#8377; in amount string gracefully', () => {
    const text = 'Dear Customer, &#8377;1,500.00 has been debited from your HDFC Bank account **1234 to VPA paytm-swiggy@ptybl on 18-08-2026. Ref: 100000000007.';
    const result = parseEmailAlertSnippet(text, 'alerts@hdfcbank.net');

    expect(result).not.toBeNull();
    expect(result?.amountDisplay).toBe(1500);
    expect(result?.amountMinor).toBe(-150000n);
    expect(result?.merchant).toBe('SWIGGY');
  });

  it('should canonicalize extended merchant brands correctly', () => {
    const brands = [
      { raw: 'at OLA CABS BANGALORE on 15-08-2026', expected: 'OLA' },
      { raw: 'at RAPIDO TRANSPORT on 15-08-2026', expected: 'RAPIDO' },
      { raw: 'towards DUNZO SERVICES on 15-08-2026', expected: 'DUNZO' },
      { raw: 'at LENSKART PLUS on 15-08-2026', expected: 'LENSKART' },
      { raw: 'at AJIO FASHIONS on 15-08-2026', expected: 'AJIO' },
      { raw: 'at MEESHO ONLINE on 15-08-2026', expected: 'MEESHO' },
      { raw: 'at SWIGGY INSTAMART on 15-08-2026', expected: 'SWIGGY INSTAMART' },
      { raw: 'to VPA phonepe@icici on 15-08-2026', expected: 'PHONEPE' },
      { raw: 'to VPA googlepay@axis on 15-08-2026', expected: 'GOOGLE PAY' },
    ];

    for (const b of brands) {
      const text = `Dear Customer, INR 250.00 debited from A/c XX1234 ${b.raw}. Ref: 1234567890.`;
      const parsed = parseEmailAlertSnippet(text);
      expect(parsed?.merchant).toBe(b.expected);
    }
  });

  it('should parse CAMS / AMC Mutual Fund SIP installment alert', () => {
    const text = 'Dear Investor, SIP installment of Rs. 5,000.00 has been processed for Folio No. 12345678 in Parag Parikh Flexi Cap Fund on 10-Aug-2026. Ref: CAMS987654.';
    const result = parseEmailAlertSnippet(text, 'donotreply@camsonline.com');

    expect(result).not.toBeNull();
    expect(result?.accountType).toBe('MUTUAL_FUND');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(5000);
    expect(result?.amountMinor).toBe(-500000n);
    expect(result?.referenceNumber).toBe('CAMS987654');
  });

  it('should parse Zerodha Coin / Groww Mutual Fund SIP debit alert', () => {
    const text = 'Dear User, Your SIP debit of INR 2,500.00 for UTI Nifty 50 Index Fund was successful on 12-Aug-2026. Units will be allotted shortly. Ref: TXN55443322.';
    const result = parseEmailAlertSnippet(text, 'notifications@zerodha.com');

    expect(result).not.toBeNull();
    expect(result?.accountType).toBe('MUTUAL_FUND');
    expect(result?.amountDisplay).toBe(2500);
    expect(result?.amountMinor).toBe(-250000n);
    expect(result?.referenceNumber).toBe('TXN55443322');
    expect(result?.suggestedCategoryName).toBe('Mutual Fund SIP');
  });

  it('should parse SBI Card alert from onlinesbicard@sbicard.com with exact merchant and limit extraction', () => {
    const text = 'Dear Cardholder, Rs.1,499.00 spent on your SBI Card ending 0004 at BLINKIT on 22/08/26. Total Available Credit Limit is Rs.95,000.00.';
    const result = parseEmailAlertSnippet(text, 'SBI Card Transaction Alert <onlinesbicard@sbicard.com>');

    expect(result).not.toBeNull();
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('0004');
    expect(result?.amountDisplay).toBe(1499);
    expect(result?.amountMinor).toBe(-149900n);
    expect(result?.merchant).toBe('BLINKIT');
  });

  it('should parse Axis Bank credit card alert from alerts@axis.bank.in', () => {
    const text = 'Transaction Amount: INR 450.00 spent on Axis Bank Card no. XX5678 at STARBUCKS on 22-08-2026. Ref: 987654. Total Credit Limit: INR 1,50,000.00';
    const result = parseEmailAlertSnippet(text, 'alerts@axis.bank.in');

    expect(result).not.toBeNull();
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('5678');
    expect(result?.amountDisplay).toBe(450);
    expect(result?.merchant).toBe('STARBUCKS');
  });

  it('should parse Axis Bank credit alert containing counterparty /SBIN/ in UPI txn info without misidentifying as SBI', () => {
    const text = "03-06-2026 Dear Test Customer, Here's the summary of your transaction: Amount Credited: INR 1000.00 Account Number: XX1234 Date & Time: 03-06-26, 23:13:43 IST Transaction Info: UPI/P2A/100000000002/SampleSender /SBIN/pres Feel free to connect with us for any clarification.";
    const result = parseEmailAlertSnippet(text, 'Axis Bank Alerts <alerts@axis.bank.in>');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Axis Bank');
    expect(result?.accountType).toBe('BANK');
    expect(result?.accountLast4).toBe('1234');
    expect(result?.type).toBe('CREDIT');
    expect(result?.amountDisplay).toBe(1000);
    expect(result?.amountMinor).toBe(100000n);
    expect(result?.merchant).toBe('SAMPLESENDER');
    expect(result?.referenceNumber).toBe('100000000002');
  });

  it('should parse SBI Credit Card refund alert as positive CREDIT transaction', () => {
    const text = 'Dear Cardholder, INR 3,285.00 has been credited to your SBI Card ending 8888 towards REFUND FROM MYNTRA on 20-Aug-2026. Ref: TXN987654. Total Available Credit Limit is INR 1,45,200.00.';
    const result = parseEmailAlertSnippet(text, 'onlinesbicard@sbicard.com');

    expect(result).not.toBeNull();
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('8888');
    expect(result?.type).toBe('CREDIT');
    expect(result?.amountDisplay).toBe(3285);
    expect(result?.amountMinor).toBe(328500n);
    expect(result?.merchant).toBe('MYNTRA');
    expect(result?.referenceNumber).toBe('TXN987654');
  });

  it('should parse SBI Credit Card cashback alert as positive CREDIT transaction', () => {
    const text = 'Dear Cardholder, Rs. 500.00 has been credited to your SBI Card ending 8888 on 15-Aug-2026 towards CASHBACK. Ref: CB100001.';
    const result = parseEmailAlertSnippet(text, 'onlinesbicard@sbicard.com');

    expect(result).not.toBeNull();
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('8888');
    expect(result?.type).toBe('CREDIT');
    expect(result?.amountDisplay).toBe(500);
    expect(result?.amountMinor).toBe(50000n);
  });

  it('should parse merchant/gateway refund confirmation email to credit card', () => {
    const text = 'Hi Test Customer, We have successfully processed your refund of Rs. 1,000.00 for order #100001 to your SBI Card ending with 8888 on 23-Jul-2026. Ref: PAYU100001.';
    const result = parseEmailAlertSnippet(text, 'Myntra Updates <updates@myntra.com>');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('State Bank of India');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('8888');
    expect(result?.type).toBe('CREDIT');
    expect(result?.amountDisplay).toBe(1000);
    expect(result?.amountMinor).toBe(100000n);
    expect(result?.merchant).toBe('MYNTRA');
  });

  it('should parse ICICI Credit Card payment received confirmation as positive CREDIT transaction', () => {
    const text = 'Dear Customer, Jun 16,2026 Greetings from ICICI Bank! We have received payment of INR 25,000.00 on your ICICI Bank Credit Card account 5000 XXXX XXXX 0009 on 16-Jun-2026. Looking forward to more opportunities to be of service to you. Thank you. Sincerely, ICICI Bank Credit Cards Team. This is a syst';
    const result = parseEmailAlertSnippet(text, 'credit_cards@icici.bank.in Payment received on your ICICI Bank Credit Card.');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('0009');
    expect(result?.type).toBe('CREDIT');
    expect(result?.amountDisplay).toBe(25000);
    expect(result?.amountMinor).toBe(2500000n);
    expect(result?.merchant).toBe('PAYMENT RECEIVED');
    expect(result?.suggestedCategoryName).toBe('Credit Card Payment');
  });

  it('should use fallbackDate when email has no inline date and extract merchant from AutoPay structure', () => {
    const text = "Dear Customer, Here's the summary of your successful AutoPay transaction: Transaction Amount: INR 500.00 Merchant Name: STREAMING SERVICE AutoPay ID: AUTOPAY123456 Axis Bank Credit Card No. XX0010 Max Limit: INR 500.00 To manage your AutoPay facility, click here";
    const emailDate = new Date('2026-05-25T11:42:49.000Z');
    const result = parseEmailAlertSnippet(text, 'Axis Bank Alerts <alerts@axis.bank.in> AutoPay for Streaming Service: ACTIVATED', emailDate);

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Axis Bank');
    expect(result?.accountType).toBe('CREDIT_CARD');
    expect(result?.accountLast4).toBe('0010');
    expect(result?.amountDisplay).toBe(500);
    expect(result?.amountMinor).toBe(-50000n);
    expect(result?.merchant).toBe('STREAMING SERVICE');
    expect(result?.transactionDate.toISOString()).toBe(emailDate.toISOString());
  });

  it('should reject upcoming AutoPay reminders as non-transactions', () => {
    const text = "Dear Customer, Here's the summary of your upcoming AutoPay transaction: Transaction Amount: INR 500.00 Merchant Name: STREAMING SERVICE To be debited by: 08-06-2026 Max Limit: INR 500.00 Axis Bank Credit card No. XX0010 AutoPay ID: AUTOPAY123456 Please keep sufficient limit on the card to process the auto debit";
    const result = parseEmailAlertSnippet(text, 'Axis Bank Alerts <alerts@axis.bank.in> Upcoming AutoPay txn. reminder');
    expect(result).toBeNull();
  });
});
