import { parseEmailAlertSnippet, parseMultipleEmailAlerts, parseIndianDate } from './email-alert-parser';

describe('EmailAlertParser', () => {
  it('should parse HDFC Bank UPI debit alert', () => {
    const text = 'Dear Customer, Rs. 2,450.00 has been debited from HDFC Bank account **1234 to VPA zomato@upi on 14-08-26. Ref: 100000000103.';
    const result = parseEmailAlertSnippet(text, 'alerts@hdfcbank.net');

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('HDFC Bank');
    expect(result?.accountLast4).toBe('1234');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(2450);
    expect(result?.amountMinor).toBe(-245000n);
    expect(result?.merchant).toContain('ZOMATO');
    expect(result?.referenceNumber).toBe('100000000103');
  });

  it('should parse ICICI Credit Card spend alert', () => {
    const text = 'INR 1,299.00 spent on ICICI Bank Credit Card XX4321 on 14-Aug-26 at FLIPKART. Ref: 1000000014.';
    const result = parseEmailAlertSnippet(text);

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('ICICI Bank');
    expect(result?.accountLast4).toBe('4321');
    expect(result?.type).toBe('DEBIT');
    expect(result?.amountDisplay).toBe(1299);
    expect(result?.merchant).toContain('FLIPKART');
  });

  it('should parse SBI UPI credit alert', () => {
    const text = 'Dear SBI User, your A/C XX7890 credited by Rs 5,000.00 on 14Aug26 thru UPI ref no 100000000104.';
    const result = parseEmailAlertSnippet(text);

    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('State Bank of India');
    expect(result?.accountLast4).toBe('7890');
    expect(result?.type).toBe('CREDIT');
    expect(result?.amountDisplay).toBe(5000);
    expect(result?.amountMinor).toBe(500000n);
  });

  it('should parse multiple alert blocks in single text', () => {
    const multiText = `
      Dear Customer, Rs. 2,450.00 has been debited from HDFC Bank account **1234 to VPA zomato@upi on 14-08-26. Ref: 100000000103.
      
      Dear Customer, INR 1,299.00 spent on ICICI Bank Credit Card XX4321 on 14-Aug-26 at FLIPKART. Ref: 1000000014.
    `;
    const list = parseMultipleEmailAlerts(multiText);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].amountDisplay).toBe(2450);
    expect(list[1].amountDisplay).toBe(1299);
  });

  it('should correctly parse Indian date formats', () => {
    const d1 = parseIndianDate('14-08-26');
    expect(d1.getUTCFullYear()).toBe(2026);
    expect(d1.getUTCMonth()).toBe(7); // 0-indexed August
    expect(d1.getUTCDate()).toBe(14);

    const d2 = parseIndianDate('14-Aug-26');
    expect(d2.getUTCFullYear()).toBe(2026);
    expect(d2.getUTCMonth()).toBe(7);
  });
});
