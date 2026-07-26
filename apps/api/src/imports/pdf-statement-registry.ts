import { BadRequestException } from '@nestjs/common';
import 'pdf-parse/worker';
import { PasswordException, PDFParse, VerbosityLevel } from 'pdf-parse';
import { axisPdfParser } from './axis-pdf-parser';
import type { BankPdfParser, ParseStatementOptions, PdfStatementDocument } from './bank-pdf-parser';
import { normalizeInstitution } from './bank-pdf-parser';
import { pnbPdfParser } from './pnb-pdf-parser';
import { sbiPdfParser } from './sbi-pdf-parser';
import { epfoPdfParser } from './epfo-pdf-parser';
import { iciciPdfParser } from './icici-pdf-parser';

export const bankPdfParsers: readonly BankPdfParser[] = [pnbPdfParser, axisPdfParser, sbiPdfParser, epfoPdfParser, iciciPdfParser];

function institutionMatches(parser: BankPdfParser, institution: string) {
  return parser.institutionAliases.some((alias) => {
    const normalizedAlias = normalizeInstitution(alias);
    return institution === normalizedAlias || institution.startsWith(`${normalizedAlias} `) || institution.endsWith(` ${normalizedAlias}`);
  });
}

export function bankSourceForInstitution(institution?: string,
  parsers: readonly BankPdfParser[] = bankPdfParsers) {
  const normalizedInstitution = normalizeInstitution(institution);
  return normalizedInstitution
    ? parsers.find((parser) => institutionMatches(parser, normalizedInstitution))?.id
    : undefined;
}

export function bankInstitutionMatchesSource(institution: string | null | undefined, source: BankPdfParser['id'],
  parsers: readonly BankPdfParser[] = bankPdfParsers) {
  return bankSourceForInstitution(institution ?? undefined, parsers) === source;
}

export function selectBankPdfParser(document: PdfStatementDocument, institution?: string,
  parsers: readonly BankPdfParser[] = bankPdfParsers) {
  const normalizedInstitution = normalizeInstitution(institution);
  const selected = normalizedInstitution ? parsers.find((parser) => institutionMatches(parser, normalizedInstitution)) : undefined;
  if (selected) {
    if (!selected.matches(document)) {
      throw new BadRequestException(`The uploaded PDF does not match the selected ${selected.id} account statement layout.`);
    }
    return selected;
  }

  const matches = parsers.filter((parser) => parser.matches(document));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new BadRequestException('This PDF matches more than one supported bank layout. Set the account institution and try again.');
  }
  throw new BadRequestException('This PDF does not match a supported Axis, ICICI, Punjab National Bank, or SBI statement layout. Scanned and changed layouts are not imported.');
}

export async function loadPdfStatementDocument(buffer: Buffer, pdfPassword?: string): Promise<PdfStatementDocument> {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new BadRequestException('The selected file is not a valid PDF.');
  }
  const parser = new PDFParse({ data: Uint8Array.from(buffer), password: pdfPassword || undefined,
    stopAtErrors: true, verbosity: VerbosityLevel.ERRORS });
  try {
    const info = await parser.getInfo();
    if (info.total > 100) throw new BadRequestException('Bank statement PDFs are limited to 100 pages.');
    const text = await parser.getText();
    const tables = await parser.getTable();
    return { total: info.total, textPages: text.pages, tablePages: tables.pages };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    if (error instanceof PasswordException) {
      throw new BadRequestException(pdfPassword
        ? 'The PDF password is incorrect. No statement data was imported.'
        : 'This PDF is password-protected. Enter its document-opening password and try again.');
    }
    throw new BadRequestException('This bank-statement PDF could not be read safely.');
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export function extractAccountDigitsFromDocument(document: PdfStatementDocument): string | undefined {
  const fullText = document.textPages.map((p) => p.text).join(' ');
  const match = fullText.match(/card\s*(?:no\.?|number|ending|#)?\s*[:\s]*[xX*\s\d-]{4,20}(\d{4})/i)
    || fullText.match(/(?:account|a\/c)\s*(?:no\.?|number|#)?\s*[:\s]*[xX*\s]*(\d{4,18})/i)
    || fullText.match(/\b[xX*]{4,12}[-\s]*(\d{4})\b/);
  return match ? match[1] : undefined;
}

export async function parseBankPdf(buffer: Buffer, options: ParseStatementOptions = {}) {
  const document = await loadPdfStatementDocument(buffer, options.pdfPassword);
  const parser = selectBankPdfParser(document, options.institution);
  const { rows, closingBalanceMinor } = parser.parse(document);
  const extractedAccountDigits = extractAccountDigitsFromDocument(document);
  return { rows, closingBalanceMinor, parserId: parser.id, extractedAccountDigits };
}
