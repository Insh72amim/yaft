import { PdfStatementDocument } from '../../src/imports/bank-pdf-parser';
import { gpayPdfParser, parseGpayDocument } from '../../src/imports/gpay-pdf-parser';

const sampleGPayText = `
Transaction statement
Note: This statement reflects payments made by you on the Google Pay app.
Page 14 of 18
Date & time Transaction details Amount
22 Jun, 2026
05:53 PM
Paid to sample catering llp
UPI Transaction ID: 100000000101
Paid by UPI Lite | Axis Bank 1234
₹70
22 Jun, 2026
09:32 PM
Paid to Sample Pharmacy
UPI Transaction ID: 100000000102
Paid by HDFC Bank XX01 | RuPay credit card
₹500.00
28 Jun, 2026
09:29 PM
Paid to Sample Recipient
UPI Transaction ID: 100000000103
Paid by Punjab National Bank 5678
₹12,000
29 Jun, 2026
12:37 AM
Top-up to UPI Lite
UPI Transaction ID: 100000000104
Paid by Axis Bank 1234
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
    expect(rows[0].description).toBe('Paid to sample catering llp');
    expect(rows[0].reference).toBe('100000000101');
    expect(rows[0].amountMinor).toBe(-7000);
    expect(rows[0].paymentMethod).toBe('Paid by UPI Lite | Axis Bank 1234');
    expect(rows[0].isUpiLite).toBe(true);

    // Row 2: Credit Card payment (Non-UPI-Lite)
    expect(rows[1].description).toBe('Paid to Sample Pharmacy');
    expect(rows[1].reference).toBe('100000000102');
    expect(rows[1].amountMinor).toBe(-50000);
    expect(rows[1].paymentMethod).toBe('Paid by HDFC Bank XX01 | RuPay credit card');
    expect(rows[1].isUpiLite).toBe(false);

    // Row 3: Bank payment (Non-UPI-Lite)
    expect(rows[2].description).toBe('Paid to Sample Recipient');
    expect(rows[2].reference).toBe('100000000103');
    expect(rows[2].amountMinor).toBe(-1200000);
    expect(rows[2].paymentMethod).toBe('Paid by Punjab National Bank 5678');
    expect(rows[2].isUpiLite).toBe(false);

    // Row 4: Top-up to UPI Lite (isUpiLite: true)
    expect(rows[3].description).toBe('Top-up to UPI Lite');
    expect(rows[3].reference).toBe('100000000104');
    expect(rows[3].amountMinor).toBe(-300000);
    expect(rows[3].paymentMethod).toBe('Paid by Axis Bank 1234');
    expect(rows[3].isUpiLite).toBe(true);
  });

  it('skips failed, declined, or cancelled Google Pay transactions', () => {
    const textWithFailed = `
Transaction statement
Note: This statement reflects payments made by you on the Google Pay app.
Date & time Transaction details Amount
22 Jun, 2026
05:53 PM
Paid to sample catering llp
UPI Transaction ID: 100000000101
Paid by UPI Lite | Axis Bank 1234
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
Paid by Axis Bank 1234
₹1,200
25 Jun, 2026
09:32 PM
Paid to Sample Pharmacy
UPI Transaction ID: 100000000102
Paid by HDFC Bank XX01 | RuPay credit card
₹500.00
`;
    const doc = createMockDoc(textWithFailed);
    const { rows } = parseGpayDocument(doc);

    expect(rows).toHaveLength(2);
    expect(rows[0].description).toBe('Paid to sample catering llp');
    expect(rows[1].description).toBe('Paid to Sample Pharmacy');
  });
});
