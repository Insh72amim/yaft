import { BadRequestException } from '@nestjs/common';
import { SalaryItemType } from '@prisma/client';
import 'pdf-parse/worker';
import { PasswordException, PDFParse } from 'pdf-parse';

export type ParsedSalaryItem = {
  type: SalaryItemType;
  description: string;
  currentAmount: number;
  ytdAmount?: number;
};

export type ParsedPayslip = {
  payPeriod: Date;
  employer: string;
  employeeName?: string;
  employeeNumberLast4?: string;
  department?: string;
  designation?: string;
  bankName?: string;
  bankAccountLast4?: string;
  uanLast4?: string;
  currency: string;
  grossEarnings: number;
  grossDeductions: number;
  directPayment: number;
  netPay: number;
  lineItems: ParsedSalaryItem[];
};

export const PAYSLIP_SCHEMAS = [
  { id: 'STANDARD_PAYSLIP', employer: 'Standard Payslip' },
] as const;

export type PayslipSchema = (typeof PAYSLIP_SCHEMAS)[number]['id'];

export function isPayslipSchema(value: string | undefined): boolean {
  if (!value) return true;
  return typeof value === 'string' && value.length > 0;
}

const money = (value: string) => Math.round(Number(value.replace(/,/g, '')) * 100);
const amounts = (line: string) => [...line.matchAll(/-?\d[\d,]*\.\d{2}/g)].map((match) => ({ raw: match[0], index: match.index ?? 0 }));

function nextUseful(lines: string[], index: number, predicate: (line: string) => boolean, window = 5) {
  return lines.slice(index + 1, index + 1 + window).find(predicate);
}

function parseSection(lines: string[], heading: string, endHeading?: string): ParsedSalaryItem[] {
  const start = lines.findIndex((line) => line.toLowerCase() === heading.toLowerCase());
  if (start < 0) return [];
  const end = endHeading ? lines.findIndex((line, index) => index > start && line.toLowerCase() === endHeading.toLowerCase()) : lines.length;
  const type = heading === 'Earnings and Allowances' ? SalaryItemType.EARNING : heading === 'Deductions' ? SalaryItemType.DEDUCTION : SalaryItemType.EMPLOYER_CONTRIBUTION;
  return lines.slice(start + 1, end < 0 ? lines.length : end).flatMap((line) => {
    if (/^description\s+current\s+year to date$/i.test(line)) return [];
    const values = amounts(line);
    if (values.length < 2) return [];
    const description = line.slice(0, values[0].index).trim();
    if (!description) return [];
    return [{ type, description: description.slice(0, 120), currentAmount: money(values.at(-2)!.raw), ytdAmount: money(values.at(-1)!.raw) }];
  });
}

export async function parsePayslipPdf(buffer: Buffer, schema: PayslipSchema, pdfPassword?: string): Promise<ParsedPayslip> {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== '%PDF-') throw new BadRequestException('The selected file is not a valid PDF.');
  const parser = new PDFParse({ data: new Uint8Array(buffer), password: pdfPassword || undefined });
  let text = '';
  try {
    const info = await parser.getInfo();
    if (info.total > 3) throw new BadRequestException('A payslip PDF can contain at most three pages.');
    text = (await parser.getText()).text;
  }
  catch (error) {
    if (error instanceof BadRequestException) throw error;
    const isPasswordError = error instanceof PasswordException ||
      (error as any)?.name === 'PasswordException' ||
      (error as any)?.message?.toLowerCase().includes('password');
    if (isPasswordError) {
      throw new BadRequestException(pdfPassword
        ? 'The PDF password is incorrect. No payslip data was imported.'
        : 'This PDF is password-protected. Enter its document-opening password and try again.');
    }
    throw new BadRequestException('This PDF could not be read. Password-protected or scanned payslips are not supported yet.');
  }
  finally { await parser.destroy().catch(() => undefined); }

  return parsePayslipText(text, schema);
}

export function parsePayslipText(text: string, schema: PayslipSchema): ParsedPayslip {
  switch (schema) {
    case 'STANDARD_PAYSLIP':
    default:
      return parseStandardPayslipText(text);
  }
}

function parseStandardPayslipText(text: string): ParsedPayslip {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
    .filter((line) => !/^-- \d+ of \d+ --$/.test(line));
  const periodMatch = text.match(/Payslip\s+for\s+the\s+month\s+of\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!periodMatch) throw new BadRequestException('The salary month and year could not be detected.');
  const monthIndex = new Date(`${periodMatch[1]} 1, 2000`).getMonth();
  if (Number.isNaN(monthIndex)) throw new BadRequestException('The salary month is invalid.');
  const payPeriod = new Date(Date.UTC(Number(periodMatch[2]), monthIndex, 1));
  const employerLine = lines.find((line) => /\b(Limited|Inc|Corporation|Corp|Pvt|Private|Services|LLC|Technologies)\b/i.test(line)) || lines[0];
  const employer = employerLine ? employerLine.replace(/^\d+-/, '').trim().slice(0, 160) : 'Employer';

  const employeeHeader = lines.findIndex((line) => /Employee Name.*Person Number.*Date of Joining/i.test(line));
  const employeeLine = employeeHeader >= 0 ? nextUseful(lines, employeeHeader, (line) => /\d{6,}.*\d{2}[-/]\d{2}[-/]\d{4}/.test(line)) : undefined;
  const employeeMatch = employeeLine?.match(/^(.*?)\s+(\d{6,})\s+\d{2}[-/]\d{2}[-/]\d{4}$/);

  const departmentHeader = lines.findIndex((line) => /Department.*Designation.*PF Number/i.test(line));
  const departmentLine = departmentHeader >= 0 ? nextUseful(lines, departmentHeader, (line) => /\b(Associate|Analyst|Vice President|Director|Manager|Engineer)\b/i.test(line)) : undefined;
  const departmentMatch = departmentLine?.match(/^(.*?)\s+(Associate|Analyst|Vice President|Director|Manager|Engineer)\s+[A-Z0-9]{10,}$/i);

  const uanHeader = lines.findIndex((line) => /PAN.*UAN Number.*Currency/i.test(line));
  const uanLine = uanHeader >= 0 ? nextUseful(lines, uanHeader, (line) => /\b\d{12}\b/.test(line)) : undefined;
  const uan = uanLine?.match(/\b(\d{12})\b/)?.[1];
  const currency = uanLine?.match(/\b([A-Z]{3})$/)?.[1] ?? 'INR';

  const paymentHeader = lines.findIndex((line) => /Payment Type.*Bank Name.*Account Number/i.test(line));
  const paymentLine = paymentHeader >= 0 ? nextUseful(lines, paymentHeader, (line) => /\d{8,}$/.test(line)) : undefined;
  const accountNumber = paymentLine?.match(/(\d{8,})$/)?.[1];
  const bankName = paymentLine?.replace(/^(Direct Deposit|Cheque|Bank Transfer)\s+/i, '').replace(/\s+\d{8,}$/, '').trim();

  const netHeader = lines.findIndex((line) => /Gross Earning.*Gross Deduction.*Direct Payment.*Net Pay/i.test(line));
  const netLine = netHeader >= 0 ? nextUseful(lines, netHeader, (line) => amounts(line).length >= 4) : undefined;
  const totals = netLine ? amounts(netLine).map((value) => money(value.raw)) : [];
  if (totals.length < 4) throw new BadRequestException('Gross earnings, deductions, and net pay could not be detected.');

  const lineItems = [
    ...parseSection(lines, 'Earnings and Allowances', 'Deductions'),
    ...parseSection(lines, 'Deductions', 'Employer Charges'),
    ...parseSection(lines, 'Employer Charges'),
  ];
  if (!lineItems.some((item) => item.type === SalaryItemType.EARNING) || !lineItems.some((item) => item.type === SalaryItemType.DEDUCTION)) {
    throw new BadRequestException('The earnings and deduction tables could not be detected.');
  }
  const earningTotal = lineItems.filter((item) => item.type === SalaryItemType.EARNING).reduce((sum, item) => sum + item.currentAmount, 0);
  const deductionTotal = lineItems.filter((item) => item.type === SalaryItemType.DEDUCTION).reduce((sum, item) => sum + item.currentAmount, 0);
  if (Math.abs(earningTotal - totals[0]) > 1 || Math.abs(deductionTotal - totals[1]) > 1) {
    throw new BadRequestException('The payslip totals did not reconcile. Please review the PDF layout.');
  }

  return {
    payPeriod, employer, employeeName: employeeMatch?.[1]?.trim(), employeeNumberLast4: employeeMatch?.[2]?.slice(-4),
    department: departmentMatch?.[1]?.trim(), designation: departmentMatch?.[2], bankName: bankName?.slice(0, 100),
    bankAccountLast4: accountNumber?.slice(-4), uanLast4: uan?.slice(-4), currency,
    grossEarnings: totals[0], grossDeductions: totals[1], directPayment: totals[2], netPay: totals[3], lineItems,
  };
}
