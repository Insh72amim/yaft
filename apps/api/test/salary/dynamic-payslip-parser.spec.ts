import { parseDynamicPayslip } from '../../src/salary/dynamic-payslip-parser';
import { SalaryItemType } from '@prisma/client';

const SAMPLE_PAYSLIP = `
GLOBEX CORP PRIVATE LIMITED
PAYSLIP FOR THE MONTH OF May 2026
Employee Name: TEST USER
Employee ID: EMP0001
Pay Period: May 2026

EARNINGS
Basic Salary: 100,000.00
House Rent Allowance: 50,000.00
Special Allowance: 30,000.00

DEDUCTIONS
Provident Fund: 12,000.00
Income Tax: 25,000.00
Professional Tax: 200.00

Gross Earnings: 180,000.00
Total Deductions: 37,200.00
Net Pay: 142,800.00
`;

describe('parseDynamicPayslip', () => {
  it('parses fields using default matchers when config is empty', () => {
    const res = parseDynamicPayslip(SAMPLE_PAYSLIP, undefined, 'Acme Corp');

    expect(res.employer).toBe('Acme Corp');
    expect(res.payPeriod).toEqual(new Date(Date.UTC(2026, 4, 1)));
    expect(res.grossEarnings).toBe(18000000); // minor units
    expect(res.grossDeductions).toBe(3720000);
    expect(res.netPay).toBe(14280000);
    expect(res.mathValidated).toBe(true);
  });

  it('uses dynamic field anchors when provided', () => {
    const config = {
      fields: {
        employeeName: { anchor: 'Employee Name:' },
        grossEarnings: { anchor: 'Gross Earnings:' },
        grossDeductions: { anchor: 'Total Deductions:' },
        netPay: { anchor: 'Net Pay:' },
      },
    };

    const res = parseDynamicPayslip(SAMPLE_PAYSLIP, config, 'Acme Corp');

    expect(res.employeeName).toBe('TEST USER');
    expect(res.grossEarnings).toBe(18000000);
    expect(res.grossDeductions).toBe(3720000);
    expect(res.netPay).toBe(14280000);
    expect(res.mathValidated).toBe(true);
  });

  it('extracts table sections when table anchors are specified', () => {
    const config = {
      tables: [
        { startAnchor: 'EARNINGS', endAnchor: 'DEDUCTIONS', type: 'EARNING' as const },
        { startAnchor: 'DEDUCTIONS', endAnchor: 'Gross Earnings', type: 'DEDUCTION' as const },
      ],
    };

    const res = parseDynamicPayslip(SAMPLE_PAYSLIP, config, 'Acme Corp');

    const earnings = res.lineItems.filter((i) => i.type === SalaryItemType.EARNING);
    const deductions = res.lineItems.filter((i) => i.type === SalaryItemType.DEDUCTION);

    expect(earnings.length).toBeGreaterThanOrEqual(3);
    expect(deductions.length).toBeGreaterThanOrEqual(3);
  });
});
