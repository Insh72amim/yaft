import { PdfStatementDocument } from '../../src/imports/bank-pdf-parser';
import { gpayPdfParser, parseGpayDocument } from '../../src/imports/gpay-pdf-parser';

const sampleGPayText = `
Transaction statement
Note: This statement reflects payments made by you on the Google Pay app.
Page 14 of 18
Date & time Transaction details Amount
22 Jun, 2026
05:53 PM
Paid to office dining services llp
UPI Transaction ID: 100000000006
Paid by UPI Lite | Axis Bank 6785
₹70
22 Jun, 2026
09:32 PM
Paid to Apollo Pharmacy
UPI Transaction ID: 100000000102
Paid by HDFC Bank XX01 | RuPay credit card
₹500.00
28 Jun, 2026
09:29 PM
Paid to Merchant Two
UPI Transaction ID: 100000000007
Paid by Punjab National Bank 2707
₹12,000
29 Jun, 2026
12:37 AM
Top-up to UPI Lite
UPI Transaction ID: 100000000008
Paid by Axis Bank 6785
₹3,000
`;

function createMockDoc(text: string): PdfStatementDocument {
  return {
    total: 1,
    textPages: [{ pageNumber: 1, text } as any],
    tablePages: [],
  };
}

describe('GPay PDF Parser', () => {
  it('identifies valid Google Pay statement format', () => {
    const doc = createMockDoc(sampleGPayText);
    expect(gpayPdfParser.matches(doc)).toBe(true);
  });

  it('parses transaction entries accurately including UPI Lite flag and amounts', () => {
    const doc = createMockDoc(sampleGPayText);
    const { rows } = parseGpayDocument(doc);

    expect(rows).toHaveLength(4);

    // Row 1: UPI Lite payment
    expect(rows[0].description).toBe('Paid to office dining services llp');
    expect(rows[0].reference).toBe('100000000006');
    expect(rows[0].amountMinor).toBe(-7000);
    expect(rows[0].paymentMethod).toBe('Paid by UPI Lite | Axis Bank 6785');
    expect(rows[0].isUpiLite).toBe(true);

    // Row 2: Credit Card payment (Non-UPI-Lite)
    expect(rows[1].description).toBe('Paid to Apollo Pharmacy');
    expect(rows[1].reference).toBe('100000000102');
    expect(rows[1].amountMinor).toBe(-50000);
    expect(rows[1].paymentMethod).toBe('Paid by HDFC Bank XX01 | RuPay credit card');
    expect(rows[1].isUpiLite).toBe(false);

    // Row 3: Bank payment (Non-UPI-Lite)
    expect(rows[2].description).toBe('Paid to Merchant Two');
    expect(rows[2].reference).toBe('100000000007');
    expect(rows[2].amountMinor).toBe(-1200000);
    expect(rows[2].paymentMethod).toBe('Paid by Punjab National Bank 2707');
    expect(rows[2].isUpiLite).toBe(false);
  });

  it('skips failed, declined, or cancelled Google Pay transactions', () => {
    const textWithFailed = `
Transaction statement
Note: This statement reflects payments made by you on the Google Pay app.
Date & time Transaction details Amount
22 Jun, 2026
05:53 PM
Paid to office dining services llp
UPI Transaction ID: 100000000006
Paid by UPI Lite | Axis Bank 6785
₹70
23 Jun, 2026
11:20 AM
Payment failed to Swiggy
UPI Transaction ID: 999123456789
Failed
₹550
24 Jun, 2026
02:15 PM
Payment declined
UPI Transaction ID: 888123456789
Paid by Axis Bank 6785
₹1,200
25 Jun, 2026
09:32 PM
Paid to Apollo Pharmacy
UPI Transaction ID: 100000000102
Paid by HDFC Bank XX01 | RuPay credit card
₹500.00
`;
    const doc = createMockDoc(textWithFailed);
    const { rows } = parseGpayDocument(doc);

    expect(rows).toHaveLength(2);
    expect(rows[0].description).toBe('Paid to office dining services llp');
    expect(rows[1].description).toBe('Paid to Apollo Pharmacy');
  });
});
