import { SalaryItemType } from '@prisma/client';
import { MONTH_NAME_TO_INDEX, parseMoneyToMinor } from '@yaft/shared';

export type DynamicFieldConfig = {
  anchor?: string;
  type?: 'REGEX' | 'RIGHT_OF_ANCHOR' | 'BELOW_ANCHOR';
  pattern?: string;
};

export type DynamicTableConfig = {
  startAnchor: string;
  endAnchor?: string;
  type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';
};

export type PayslipParsingConfig = {
  documentAnchors?: string[];
  datePattern?: string;
  fields?: {
    payPeriod?: DynamicFieldConfig;
    grossEarnings?: DynamicFieldConfig;
    grossDeductions?: DynamicFieldConfig;
    netPay?: DynamicFieldConfig;
    employeeName?: DynamicFieldConfig;
    employeeNumberLast4?: DynamicFieldConfig;
  };
  tables?: DynamicTableConfig[];
};

export type ExtractedSalaryLineItem = {
  type: SalaryItemType;
  description: string;
  currentAmount: number;
  ytdAmount?: number;
};

export type DynamicParseResult = {
  matchedOrganizationId?: string;
  payPeriod: Date;
  employer: string;
  employeeName?: string;
  employeeNumberLast4?: string;
  grossEarnings: number;
  grossDeductions: number;
  netPay: number;
  lineItems: ExtractedSalaryLineItem[];
  confidence: number;
  mathValidated: boolean;
};

function parseDateFromText(text: string, customPattern?: string): Date {
  if (customPattern) {
    try {
      const match = text.match(new RegExp(customPattern, 'i'));
      if (match) {
        const parts = match[0].split(/\s+/);
        if (parts.length >= 2) {
          const monStr = parts[0].toLowerCase();
          const yrStr = parts[parts.length - 1];
          const m = MONTH_NAME_TO_INDEX[monStr];
          const y = Number(yrStr.length === 2 ? `20${yrStr}` : yrStr);
          if (m !== undefined && !isNaN(y)) {
            return new Date(Date.UTC(y, m, 1));
          }
        }
      }
    } catch {
      // fallback to default matcher
    }
  }

  const defaultMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i);
  if (defaultMatch) {
    const m = MONTH_NAME_TO_INDEX[defaultMatch[1].toLowerCase()];
    const y = Number(defaultMatch[2]);
    return new Date(Date.UTC(y, m, 1));
  }

  const dateMatch = text.match(/\b(\d{2})[-/](\d{2})[-/](\d{4})\b/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
}

function extractNumber(str: string): number | undefined {
  const match = str.match(/[\d,]+(?:\.\d{1,2})?/);
  if (!match) return undefined;
  const minor = parseMoneyToMinor(match[0]);
  return minor === null || minor === undefined ? undefined : Math.abs(minor);
}

function extractFieldValue(textLines: string[], fullText: string, config?: DynamicFieldConfig): string | number | undefined {
  if (!config) return undefined;

  if (config.type === 'REGEX' && config.pattern) {
    try {
      const re = new RegExp(config.pattern, 'i');
      const m = fullText.match(re);
      if (m) return m[1] || m[0];
    } catch {
      // ignore regex error
    }
  }

  if (config.anchor) {
    const anchorLower = config.anchor.toLowerCase();
    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];
      const idx = line.toLowerCase().indexOf(anchorLower);
      if (idx !== -1) {
        const afterAnchor = line.slice(idx + config.anchor.length).trim();
        if (afterAnchor) {
          const num = extractNumber(afterAnchor);
          return num !== undefined ? num : afterAnchor;
        }
        if (i + 1 < textLines.length) {
          const nextLine = textLines[i + 1].trim();
          const num = extractNumber(nextLine);
          return num !== undefined ? num : nextLine;
        }
      }
    }
  }

  return undefined;
}

export function parseDynamicPayslip(
  fullText: string,
  config?: PayslipParsingConfig,
  organizationName = 'Employer',
): DynamicParseResult {
  const textLines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);

  const payPeriodVal = extractFieldValue(textLines, fullText, config?.fields?.payPeriod);
  const payPeriod = typeof payPeriodVal === 'string'
    ? parseDateFromText(payPeriodVal, config?.datePattern)
    : parseDateFromText(fullText, config?.datePattern);

  const employeeName = typeof extractFieldValue(textLines, fullText, config?.fields?.employeeName) === 'string'
    ? (extractFieldValue(textLines, fullText, config?.fields?.employeeName) as string)
    : undefined;

  const rawEmpNo = extractFieldValue(textLines, fullText, config?.fields?.employeeNumberLast4);
  const employeeNumberLast4 = rawEmpNo ? String(rawEmpNo).slice(-4) : undefined;

  let grossEarnings = typeof extractFieldValue(textLines, fullText, config?.fields?.grossEarnings) === 'number'
    ? (extractFieldValue(textLines, fullText, config?.fields?.grossEarnings) as number)
    : 0;

  let grossDeductions = typeof extractFieldValue(textLines, fullText, config?.fields?.grossDeductions) === 'number'
    ? (extractFieldValue(textLines, fullText, config?.fields?.grossDeductions) as number)
    : 0;

  let netPay = typeof extractFieldValue(textLines, fullText, config?.fields?.netPay) === 'number'
    ? (extractFieldValue(textLines, fullText, config?.fields?.netPay) as number)
    : 0;

  const lineItems: ExtractedSalaryLineItem[] = [];

  if (config?.tables && config.tables.length > 0) {
    for (const tableRule of config.tables) {
      const startIdx = textLines.findIndex((l) => l.toLowerCase().includes(tableRule.startAnchor.toLowerCase()));
      if (startIdx !== -1) {
        let endIdx = textLines.length;
        if (tableRule.endAnchor) {
          const foundEnd = textLines.findIndex((l, idx) => idx > startIdx && l.toLowerCase().includes(tableRule.endAnchor!.toLowerCase()));
          if (foundEnd !== -1) endIdx = foundEnd;
        }

        for (let i = startIdx + 1; i < endIdx; i++) {
          const line = textLines[i];
          const amount = extractNumber(line);
          if (amount !== undefined && amount > 0) {
            const desc = line.replace(/[\d,]+(?:\.\d{1,2})?/g, '').replace(/[:|\t]/g, ' ').trim();
            if (desc.length >= 2) {
              const itemType = tableRule.type === 'DEDUCTION'
                ? SalaryItemType.DEDUCTION
                : tableRule.type === 'EMPLOYER_CONTRIBUTION'
                  ? SalaryItemType.EMPLOYER_CONTRIBUTION
                  : SalaryItemType.EARNING;

              lineItems.push({
                type: itemType,
                description: desc,
                currentAmount: amount,
              });
            }
          }
        }
      }
    }
  }

  if (lineItems.length === 0) {
    for (const line of textLines) {
      if (/basic|hra|allowance|bonus|special/i.test(line)) {
        const amt = extractNumber(line);
        if (amt && amt > 0) {
          const desc = line.replace(/[\d,]+(?:\.\d{1,2})?/g, '').trim();
          if (desc && !/total|gross|net/i.test(desc)) {
            lineItems.push({ type: SalaryItemType.EARNING, description: desc, currentAmount: amt });
          }
        }
      } else if (/tax|pf|provident|deduction|insurance|pt/i.test(line)) {
        const amt = extractNumber(line);
        if (amt && amt > 0) {
          const desc = line.replace(/[\d,]+(?:\.\d{1,2})?/g, '').trim();
          if (desc && !desc.toLowerCase().includes('total')) {
            lineItems.push({ type: SalaryItemType.DEDUCTION, description: desc, currentAmount: amt });
          }
        }
      }
    }
  }

  if (!grossEarnings) {
    grossEarnings = lineItems
      .filter((i) => i.type === SalaryItemType.EARNING)
      .reduce((sum, i) => sum + i.currentAmount, 0);
  }
  if (!grossDeductions) {
    grossDeductions = lineItems
      .filter((i) => i.type === SalaryItemType.DEDUCTION)
      .reduce((sum, i) => sum + i.currentAmount, 0);
  }
  if (!netPay) {
    netPay = Math.max(0, grossEarnings - grossDeductions);
  }

  const mathValidated = (grossEarnings - grossDeductions) === netPay;
  const confidence = mathValidated && lineItems.length > 0 ? 0.95 : 0.70;

  return {
    payPeriod,
    employer: organizationName,
    employeeName,
    employeeNumberLast4,
    grossEarnings,
    grossDeductions,
    netPay,
    lineItems,
    confidence,
    mathValidated,
  };
}
