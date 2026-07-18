import { parsePayslipText } from './payslip-parser';

const validPayslip = `123-Goldman Sachs Services Private Limited
Payslip for the month of March 2026
Employee Name Person Number Date of Joining
Test Employee 12345678 01-01-2024
Department Designation PF Number
Engineering Associate ABCDE123456789
PAN UAN Number Currency
AAAAA0000A 123456789012 INR
Payment Type Bank Name Account Number
Direct Deposit Example Bank 123456789012
Net Pay
Gross Earning Gross Deduction Direct Payment Net Pay
100,000.00 10,000.00 0.00 90,000.00
Earnings and Allowances
Description Current Year to Date
Basic 60,000.00 180,000.00
House Rent Allowance 40,000.00 120,000.00
Deductions
Description Current Year to Date
Employee PF Contribution 5,000.00 15,000.00
Income Tax Deduction 5,000.00 15,000.00
Employer Charges
Description Current Year to Date
Employer PF Contribution 5,000.00 15,000.00`;

describe('payslip parser', () => {
  it('extracts reconciled payroll facts and masks identifiers', () => {
    const result = parsePayslipText(validPayslip, 'GOLDMAN_SACHS');
    expect(result.payPeriod.toISOString().slice(0, 7)).toBe('2026-03');
    expect(result.employer).toBe('Goldman Sachs Services Private Limited');
    expect(result.grossEarnings).toBe(10_000_000);
    expect(result.grossDeductions).toBe(1_000_000);
    expect(result.netPay).toBe(9_000_000);
    expect(result.lineItems).toHaveLength(5);
    expect(result.uanLast4).toBe('9012');
    expect(result.bankAccountLast4).toBe('9012');
    expect(result.employeeNumberLast4).toBe('5678');
  });

  it('rejects line items that do not match the stated totals', () => {
    expect(() => parsePayslipText(validPayslip.replace('40,000.00 120,000.00', '30,000.00 120,000.00'), 'GOLDMAN_SACHS')).toThrow('did not reconcile');
  });

  it('rejects a payslip that does not match the selected employer', () => {
    expect(() => parsePayslipText(validPayslip.replace('Goldman Sachs', 'Example Employer'), 'GOLDMAN_SACHS')).toThrow('does not match the selected Goldman Sachs employer');
  });

  it('recognises the employer when PDF metadata is extracted before the company name', () => {
    const result = parsePayslipText(`Private payroll document\n${validPayslip}`, 'GOLDMAN_SACHS');
    expect(result.employer).toBe('Goldman Sachs Services Private Limited');
  });
});
