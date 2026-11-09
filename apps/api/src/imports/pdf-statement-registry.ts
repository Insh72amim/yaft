import { BadRequestException } from '@nestjs/common';
import 'pdf-parse/worker';
import { PasswordException, PDFParse, VerbosityLevel } from 'pdf-parse';
import { axisPdfParser } from './axis-pdf-parser';
import type { BankPdfParser, ParseStatementOptions, PdfStatementDocument } from './bank-pdf-parser';
import { normalizeInstitution } from './bank-pdf-parser';
import { pnbPdfParser } from './pnb-pdf-parser';
import { sbiPdfParser } from './sbi-pdf-parser';
import { epfoPdfParser } from './epfo-pdf-parser';
import { gpayPdfParser } from './gpay-pdf-parser';
import { genericBankPdfParser } from './generic-bank-pdf-parser';

/**
 * Specialized exception thrown ONLY when a PDF does not match any registered
 * specific bank layout (as opposed to a matched parser failing balance/total reconciliation).
 * This preserves the fail-closed guarantee for known institutions while allowing
 * truly unrecognised bank layouts to opt into generic tabular parsing when no institution
 * constraint is violated.
 */
export class UnsupportedPdfLayoutException extends BadRequestException {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedPdfLayoutException';
  }
}

export const bankPdfParsers: readonly BankPdfParser[] = [
  pnbPdfParser,
  axisPdfParser,
  sbiPdfParser,
  epfoPdfParser,
  gpayPdfParser,
  genericBankPdfParser,
];

function institutionMatches(parser: BankPdfParser, institution: string) {
  return parser.institutionAliases.some((alias) => {
    const normalizedAlias = normalizeInstitution(alias);
    return (
      institution === normalizedAlias ||
      institution.startsWith(`${normalizedAlias} `) ||
      institution.endsWith(` ${normalizedAlias}`)
    );
  });
}

export function bankSourceForInstitution(
  institution?: string,
  parsers: readonly BankPdfParser[] = bankPdfParsers,
) {
  const normalizedInstitution = normalizeInstitution(institution);
  return normalizedInstitution
    ? parsers.find((parser) => parser.id !== 'GENERIC' && institutionMatches(parser, normalizedInstitution))?.id
    : undefined;
}

export function bankInstitutionMatchesSource(
  institution: string | null | undefined,
  source: BankPdfParser['id'],
  parsers: readonly BankPdfParser[] = bankPdfParsers,
) {
  return bankSourceForInstitution(institution ?? undefined, parsers) === source;
}

export function selectBankPdfParser(
  document: PdfStatementDocument,
  institution?: string,
  parsers: readonly BankPdfParser[] = bankPdfParsers,
) {
  const normalizedInstitution = normalizeInstitution(institution);
  const selected = normalizedInstitution
    ? parsers.find((parser) => parser.id !== 'GENERIC' && institutionMatches(parser, normalizedInstitution))
    : undefined;
  if (selected) {
    if (!selected.matches(document)) {
      throw new BadRequestException(
        `The uploaded PDF does not match the selected ${selected.id} account statement layout.`,
      );
    }
    return selected;
  }

  const matches = parsers.filter((parser) => parser.id !== 'GENERIC' && parser.matches(document));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new BadRequestException(
      'This PDF matches more than one supported bank layout. Set the account institution and try again.',
    );
  }
  throw new UnsupportedPdfLayoutException(
    'This PDF does not match a supported Axis, HDFC, ICICI, Punjab National Bank, SBI, or SBI Credit Card statement layout. Scanned and changed layouts are not imported.',
  );
}

export async function loadPdfStatementDocument(
  buffer: Buffer,
  pdfPassword?: string,
): Promise<PdfStatementDocument> {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new BadRequestException('The selected file is not a valid PDF.');
  }
  const parser = new PDFParse({
    data: Uint8Array.from(buffer),
    password: pdfPassword || undefined,
    stopAtErrors: true,
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    const info = await parser.getInfo();
    if (info.total > 100) {
      throw new BadRequestException('Bank statement PDFs are limited to 100 pages.');
    }
    const text = await parser.getText();
    const tables = await parser.getTable();
    return { total: info.total, textPages: text.pages, tablePages: tables.pages };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    if (error instanceof PasswordException) {
      throw new BadRequestException(
        pdfPassword
          ? 'The PDF password is incorrect. No statement data was imported.'
          : 'This PDF is password-protected. Enter its document-opening password and try again.',
      );
    }
    throw new BadRequestException('This bank-statement PDF could not be read safely.');
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export function extractAccountDigitsFromDocument(
  document: PdfStatementDocument,
): string | undefined {
  const fullText = document.textPages.map((p) => p.text).join(' ');
  const match =
    fullText.match(/card\s*(?:no\.?|number|ending|#)?\s*[:\s]*[xX*\s\d-]{4,20}(\d{4})/i) ||
    fullText.match(/(?:account|a\/c)\s*(?:no\.?|number|#)?\s*[:\s]*[xX*\s]*(\d{4,18})/i) ||
    fullText.match(/\b[xX*]{4,12}[-\s]*(\d{4})\b/);
  return match ? match[1] : undefined;
}

/**
 * Parses a loaded PDF statement document with fail-closed semantics:
 * 1. If a specific bank parser matches (by institution or unique layout), its result
 *    or reconciliation/validation error is returned directly without fallback.
 * 2. Only when no specific bank parser matches (`UnsupportedPdfLayoutException`) does
 *    it attempt generic tabular extraction.
 */
export function parseLoadedBankPdfDocument(
  document: PdfStatementDocument,
  options: ParseStatementOptions = {},
  parsers: readonly BankPdfParser[] = bankPdfParsers,
) {
  let specificParser: BankPdfParser | undefined;
  try {
    specificParser = selectBankPdfParser(document, options.institution, parsers);
  } catch (err) {
    if (!(err instanceof UnsupportedPdfLayoutException)) {
      throw err;
    }
  }

  if (specificParser) {
    // Fail-closed: never swallow reconciliation or format errors from a matched bank parser
    const { rows, closingBalanceMinor } = specificParser.parse(document);
    const extractedAccountDigits = extractAccountDigitsFromDocument(document);
    return {
      rows,
      closingBalanceMinor,
      parserId: specificParser.id,
      extractedAccountDigits,
    };
  }

  const { rows, closingBalanceMinor } = genericBankPdfParser.parse(document);
  if (rows && rows.length > 0) {
    const extractedAccountDigits = extractAccountDigitsFromDocument(document);
    return {
      rows,
      closingBalanceMinor,
      parserId: 'GENERIC' as const,
      extractedAccountDigits,
    };
  }

  throw new BadRequestException(
    'No transaction rows could be extracted from this statement PDF. Ensure the PDF contains a standard Date, Description, Amount, and Balance table and is not a scanned image.',
  );
}

export async function parseBankPdf(buffer: Buffer, options: ParseStatementOptions = {}) {
  const document = await loadPdfStatementDocument(buffer, options.pdfPassword);
  return parseLoadedBankPdfDocument(document, options);
}
