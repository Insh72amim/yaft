import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { parseMoneyToMinor } from '@yaft/shared';
import { loadPdfStatementDocument } from '../imports/pdf-statement-registry';
import type { PdfStatementDocument } from '../imports/bank-pdf-parser';

export interface ParsedCasHolding {
  assetName: string;
  assetType: 'MUTUAL_FUND';
  folio: string;
  isin?: string;
  amcName?: string;
  quantity: number;
  averagePriceMinor: number;
  currentValueMinor: number;
  costValueMinor: number;
  unrealizedPnlMinor: number;
  navMinor?: number;
  navDate?: Date;
  advisor?: string;
  broker?: string;
}

export function isCamsCasDocument(document: PdfStatementDocument): boolean {
  const fullText = document.textPages.map((p) => p.text).join('\n');
  return /Consolidated Account Statement|CAMS|Computer Age Management Services|KFin Technologies|KFintech|Karvy|Folio No|Unit Balance/i.test(fullText);
}

/**
 * Normalizes broker name from advisor / ARN string
 */
export function normalizeBrokerName(advisor?: string): string {
  if (!advisor) return 'Direct';
  const clean = advisor.trim();
  if (/direct/i.test(clean)) return 'Direct';
  if (/nextbillion|groww/i.test(clean)) return 'Groww';
  if (/zerodha/i.test(clean)) return 'Zerodha';
  if (/kuvera/i.test(clean)) return 'Kuvera';
  if (/etmoney|et money/i.test(clean)) return 'ET Money';
  if (/paytm/i.test(clean)) return 'Paytm Money';
  if (/angel/i.test(clean)) return 'Angel One';
  if (/upstox/i.test(clean)) return 'Upstox';
  if (/coin/i.test(clean)) return 'Zerodha Coin';
  return clean;
}

/**
 * Parses a CAMS or KFintech Consolidated Account Statement (CAS) PDF.
 */
export async function parseCamsCasPdf(buffer: Buffer, password?: string): Promise<ParsedCasHolding[]> {
  const document = await loadPdfStatementDocument(buffer, password);

  if (!isCamsCasDocument(document)) {
    throw new BadRequestException('The PDF does not appear to be a valid CAMS or KFintech Consolidated Account Statement (CAS).');
  }

  const holdings: ParsedCasHolding[] = [];
  const fullText = document.textPages.map((p) => p.text).join('\n');
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);

  let currentAmc = '';
  let currentFolio = '';
  let currentScheme = '';
  let currentIsin: string | undefined;
  let currentAdvisor: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect AMC Header (e.g. "HDFC Mutual Fund", "Parag Parikh Mutual Fund", "SBI Mutual Fund")
    const amcMatch = line.match(/^([A-Za-z\s&.]+Mutual Fund(?:\s+Ltd\.?)?)/i);
    if (amcMatch) {
      currentAmc = amcMatch[1].trim();
    }

    // Detect Folio Line (e.g. "Folio No: 14919414 / 0" or "Folio No. : 12345678")
    const folioMatch = line.match(/Folio\s*(?:No\.?|Number)\s*[:\-]?\s*([A-Za-z0-9\/\s\-]+?)(?=\s+PAN|\s+KYC|\s*$)/i);
    if (folioMatch) {
      currentFolio = folioMatch[1].trim();
    }

    // Detect ISIN and Advisor line
    const isinMatch = line.match(/ISIN\s*[:\-]?\s*(INF[A-Za-z0-9]{9})/i);
    if (isinMatch) {
      currentIsin = isinMatch[1].trim();
    }

    const advisorMatch = line.match(/(?:Advisor|ARN|Broker)\s*[:\-]?\s*([A-Za-z0-9\s\-._]+?)(?=\s+Registrar|\s+ISIN|\s*$)/i);
    if (advisorMatch) {
      currentAdvisor = advisorMatch[1].trim();
    }

    // Detect Scheme Name (lines ending with Plan / Growth / IDCW / Option)
    if (
      /(?:Direct|Regular)\s+(?:Plan|Growth|IDCW|Option|Dividend)/i.test(line) &&
      !/Closing Unit Balance|Total Cost|Market Value|NAV on/i.test(line)
    ) {
      currentScheme = line.replace(/^(?:Scheme\s*[:\-]?\s*)/i, '').trim();
    }

    // Detect Valuation / Balance Row:
    // Format A: "Closing Unit Balance: 154.238  Total Cost: 10,000.00  Market Value: 12,100.00"
    // Format B: "Valuation as on 22-Aug-2026: NAV INR 78.45  Cost: 10,000.00  Value: 12,100.00  Units: 154.238"
    const balanceMatch = line.match(/(?:Closing Unit Balance|Total Units|Balance Units)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i);
    const costMatch = line.match(/(?:Total Cost|Cost Value|Invested Value|Investment Amount)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)/i);
    const marketValMatch = line.match(/(?:Market Value|Current Value|Valuation)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)/i);
    const navMatch = line.match(/NAV(?:\s+as\s+on\s+[\w\-]+)?\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)/i);

    if (balanceMatch || (marketValMatch && (costMatch || navMatch))) {
      const units = balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : undefined;
      const costMinor = costMatch ? parseMoneyToMinor(costMatch[1]) : undefined;
      const marketValMinor = marketValMatch ? parseMoneyToMinor(marketValMatch[1]) : undefined;
      const navMinor = navMatch ? parseMoneyToMinor(navMatch[1]) : undefined;

      if (units !== undefined && units > 0 && marketValMinor !== null && marketValMinor !== undefined) {
        const cost = costMinor ?? (navMinor ? Math.round(units * navMinor) : marketValMinor);
        const avgPriceMinor = Math.round(cost / units);
        const pnl = marketValMinor - cost;

        const schemeName = currentScheme || (currentAmc ? `${currentAmc} Scheme` : 'Mutual Fund Scheme');

        holdings.push({
          assetName: schemeName,
          assetType: 'MUTUAL_FUND',
          folio: currentFolio || 'DEFAULT_FOLIO',
          isin: currentIsin,
          amcName: currentAmc || undefined,
          quantity: units,
          averagePriceMinor: avgPriceMinor,
          costValueMinor: cost,
          currentValueMinor: marketValMinor,
          unrealizedPnlMinor: pnl,
          navMinor: navMinor ?? undefined,
          advisor: currentAdvisor,
          broker: normalizeBrokerName(currentAdvisor),
        });

        // Reset scheme-scoped state
        currentScheme = '';
        currentIsin = undefined;
        currentAdvisor = undefined;
      }
    }
  }

  // Fallback: If structured block parsing didn't find lines, check tabular layout
  if (holdings.length === 0) {
    for (const page of document.textPages) {
      const pageLines = page.text.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const pline of pageLines) {
        // Tabular row pattern: SchemeName | Folio | Units | NAV | Cost | MarketValue
        const tableMatch = pline.match(/^([A-Za-z0-9\s&.\-()]+?)\s+([A-Za-z0-9\/]+)\s+([\d,]+\.\d{2,4})\s+([\d,]+\.\d{2,4})\s+([\d,]+(?:\.\d{2})?)\s+([\d,]+(?:\.\d{2})?)$/);
        if (tableMatch) {
          const schemeName = tableMatch[1].trim();
          const folio = tableMatch[2].trim();
          const units = parseFloat(tableMatch[3].replace(/,/g, ''));
          const costMinor = parseMoneyToMinor(tableMatch[5]);
          const marketValMinor = parseMoneyToMinor(tableMatch[6]);

          if (units > 0 && costMinor !== null && marketValMinor !== null) {
            const avgPriceMinor = Math.round(costMinor / units);
            holdings.push({
              assetName: schemeName,
              assetType: 'MUTUAL_FUND',
              folio,
              quantity: units,
              averagePriceMinor: avgPriceMinor,
              costValueMinor: costMinor,
              currentValueMinor: marketValMinor,
              unrealizedPnlMinor: marketValMinor - costMinor,
              broker: 'Direct',
            });
          }
        }
      }
    }
  }

  if (holdings.length === 0) {
    throw new BadRequestException('Could not detect mutual fund holdings in this CAS document. Ensure the PDF is a valid CAMS or KFintech statement.');
  }

  return holdings;
}

/**
 * Parses a CAMS or KFintech Excel (XLSX) export.
 */
export async function parseCamsCasXlsx(buffer: Buffer): Promise<ParsedCasHolding[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException('Invalid XLSX file.');
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestException('The workbook has no sheets.');
  }

  let headerRowIndex = -1;
  sheet.eachRow((row, rowNumber) => {
    if (headerRowIndex === -1) {
      row.eachCell((cell) => {
        const text = String(cell.value || '').toLowerCase();
        if (text.includes('scheme') || text.includes('folio') || text.includes('units')) {
          headerRowIndex = rowNumber;
        }
      });
    }
  });

  if (headerRowIndex === -1) {
    throw new BadRequestException('Could not identify header row in CAMS Excel sheet.');
  }

  const colIndexes = {
    schemeName: -1,
    folio: -1,
    isin: -1,
    amc: -1,
    units: -1,
    costValue: -1,
    currentValue: -1,
    nav: -1,
    advisor: -1,
  };

  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.eachCell((cell, colNumber) => {
    const text = String(cell.value || '').toLowerCase().trim();
    if (text.includes('scheme') || text.includes('fund name')) colIndexes.schemeName = colNumber;
    if (text.includes('folio')) colIndexes.folio = colNumber;
    if (text.includes('isin')) colIndexes.isin = colNumber;
    if (text.includes('amc') || text.includes('mutual fund')) colIndexes.amc = colNumber;
    if (text.includes('unit') || text.includes('balance') || text.includes('qty')) colIndexes.units = colNumber;
    if (text.includes('cost') || text.includes('invested')) colIndexes.costValue = colNumber;
    if (text.includes('market') || text.includes('current value') || text.includes('valuation')) colIndexes.currentValue = colNumber;
    if (text.includes('nav')) colIndexes.nav = colNumber;
    if (text.includes('advisor') || text.includes('broker') || text.includes('arn')) colIndexes.advisor = colNumber;
  });

  if (colIndexes.schemeName === -1 || colIndexes.units === -1) {
    throw new BadRequestException('Missing required columns (Scheme Name, Units) in CAMS Excel export.');
  }

  const holdings: ParsedCasHolding[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const schemeName = String(row.getCell(colIndexes.schemeName).value || '').trim();
    if (!schemeName) return;

    const units = parseFloat(String(row.getCell(colIndexes.units).value || '0').replace(/,/g, ''));
    if (!units || units <= 0) return;

    const folio = colIndexes.folio !== -1 ? String(row.getCell(colIndexes.folio).value || '').trim() : 'DEFAULT_FOLIO';
    const isin = colIndexes.isin !== -1 ? String(row.getCell(colIndexes.isin).value || '').trim() : undefined;
    const amcName = colIndexes.amc !== -1 ? String(row.getCell(colIndexes.amc).value || '').trim() : undefined;
    const advisor = colIndexes.advisor !== -1 ? String(row.getCell(colIndexes.advisor).value || '').trim() : undefined;

    const costValueMinor = colIndexes.costValue !== -1 ? parseMoneyToMinor(row.getCell(colIndexes.costValue).value) ?? 0 : 0;
    const currentValueMinor = colIndexes.currentValue !== -1 ? parseMoneyToMinor(row.getCell(colIndexes.currentValue).value) ?? costValueMinor : costValueMinor;
    const averagePriceMinor = units > 0 ? Math.round(costValueMinor / units) : 0;
    const unrealizedPnlMinor = currentValueMinor - costValueMinor;

    holdings.push({
      assetName: schemeName,
      assetType: 'MUTUAL_FUND',
      folio: folio || 'DEFAULT_FOLIO',
      isin: isin || undefined,
      amcName: amcName || undefined,
      quantity: units,
      averagePriceMinor,
      costValueMinor,
      currentValueMinor,
      unrealizedPnlMinor,
      advisor,
      broker: normalizeBrokerName(advisor),
    });
  });

  return holdings;
}

/**
 * Universal entry point for CAMS / KFintech CAS files (PDF or XLSX).
 */
export async function parseCamsCas(file: Express.Multer.File, password?: string): Promise<ParsedCasHolding[]> {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.pdf')) {
    return parseCamsCasPdf(file.buffer, password);
  }
  if (/\.xlsx?$/i.test(name)) {
    return parseCamsCasXlsx(file.buffer);
  }
  throw new BadRequestException('Unsupported file format. Please upload a CAMS / KFintech CAS PDF or Excel file.');
}
