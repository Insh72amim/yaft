import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ImportsService } from '../imports/imports.service';
import { UpdateStagedDto } from '../imports/imports.dto';
import { bankInstitutionMatchesSource, bankSourceForInstitution, loadPdfStatementDocument } from '../imports/pdf-statement-registry';
import { InvestmentsService } from '../investments/investments.service';
import { SalaryService } from '../salary/salary.service';
import { UnifiedImportUploadDto } from './unified-imports.dto';

export const UNIFIED_IMPORT_KINDS = ['BANK_STATEMENT', 'CREDIT_CARD_STATEMENT', 'SALARY_PAYSLIP', 'BROKER_HOLDINGS', 'UPI_STATEMENT'] as const;
export type UnifiedImportKind = (typeof UNIFIED_IMPORT_KINDS)[number];
export type BankImportSource = 'SBI' | 'PNB' | 'AXIS' | 'EPFO';
export type CreditCardImportSource = 'HDFC_CC' | 'ICICI_CC' | 'SBI_CC' | 'AXIS_CC';
export type UPIImportSource = 'GPAY' | 'PHONEPE' | 'PAYTM';
export type UnifiedImportSource = BankImportSource | CreditCardImportSource | UPIImportSource | 'GOLDMAN_SACHS' | 'ZERODHA_KITE' | 'GROWW';

type SourceSpec = {
  kind: UnifiedImportKind;
  source: UnifiedImportSource;
  label: string;
  description: string;
  extensions: readonly string[];
  maxBytes: number;
  accountRequired: boolean;
  commitMode: 'REVIEW_REQUIRED' | 'IMMEDIATE_ATOMIC_REPLACEMENT';
};

const MIB = 1024 * 1024;
const SOURCE_SPECS: readonly SourceSpec[] = [
  { kind: 'BANK_STATEMENT', source: 'SBI', label: 'State Bank of India',
    description: 'Machine-generated SBI statement PDF.', extensions: ['.pdf'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'BANK_STATEMENT', source: 'PNB', label: 'Punjab National Bank',
    description: 'Machine-generated PNB statement PDF.', extensions: ['.pdf'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'BANK_STATEMENT', source: 'AXIS', label: 'Axis Bank',
    description: 'Machine-generated Axis statement PDF.', extensions: ['.pdf'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'SALARY_PAYSLIP', source: 'GOLDMAN_SACHS', label: 'Goldman Sachs',
    description: 'Goldman Sachs payslip PDF.', extensions: ['.pdf'], maxBytes: 8 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'BROKER_HOLDINGS', source: 'ZERODHA_KITE', label: 'Zerodha / Kite',
    description: 'Zerodha Console holdings XLSX report.', extensions: ['.xlsx'], maxBytes: 5 * MIB,
    accountRequired: true, commitMode: 'IMMEDIATE_ATOMIC_REPLACEMENT' },
  { kind: 'BROKER_HOLDINGS', source: 'GROWW', label: 'Groww',
    description: 'Groww mutual funds XLSX report.', extensions: ['.xlsx'], maxBytes: 5 * MIB,
    accountRequired: true, commitMode: 'IMMEDIATE_ATOMIC_REPLACEMENT' },
  { kind: 'CREDIT_CARD_STATEMENT', source: 'HDFC_CC', label: 'HDFC Bank Credit Card',
    description: 'HDFC credit card PDF or CSV statement.', extensions: ['.pdf', '.csv', '.xlsx'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'CREDIT_CARD_STATEMENT', source: 'ICICI_CC', label: 'ICICI Bank Credit Card',
    description: 'ICICI credit card PDF or CSV statement.', extensions: ['.pdf', '.csv', '.xlsx'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'CREDIT_CARD_STATEMENT', source: 'SBI_CC', label: 'SBI Credit Card',
    description: 'SBI credit card PDF or CSV statement.', extensions: ['.pdf', '.csv', '.xlsx'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'CREDIT_CARD_STATEMENT', source: 'AXIS_CC', label: 'Axis Bank Credit Card',
    description: 'Axis credit card PDF, CSV or XLSX statement.', extensions: ['.pdf', '.csv', '.xlsx'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'IMMEDIATE_ATOMIC_REPLACEMENT' },
  { kind: 'BANK_STATEMENT', source: 'EPFO', label: 'EPFO India',
    description: 'EPFO member passbook PDF.', extensions: ['.pdf'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'UPI_STATEMENT', source: 'GPAY', label: 'GPay (Google Pay)',
    description: 'Exported PDF or CSV statement from Google Pay app.', extensions: ['.pdf', '.csv'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'UPI_STATEMENT', source: 'PHONEPE', label: 'PhonePe',
    description: 'Exported PDF or CSV statement from PhonePe app.', extensions: ['.pdf', '.csv'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'UPI_STATEMENT', source: 'PAYTM', label: 'Paytm',
    description: 'Exported PDF or CSV passbook statement from Paytm.', extensions: ['.pdf', '.csv'], maxBytes: 5 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
];

const KIND_LABELS: Record<UnifiedImportKind, { label: string; description: string }> = {
  BANK_STATEMENT: { label: 'Bank statement', description: 'Stage reconciled transactions for review before adding them to the ledger.' },
  CREDIT_CARD_STATEMENT: { label: 'Credit card statement', description: 'Stage credit card transactions for review before adding them to the ledger.' },
  SALARY_PAYSLIP: { label: 'Salary payslip', description: 'Review reconciled payroll facts before saving the salary month.' },
  BROKER_HOLDINGS: { label: 'Broker holdings', description: 'Replace a broker account snapshot atomically after full reconciliation.' },
  UPI_STATEMENT: { label: 'UPI App statement', description: 'Import payment history statements from GPay, PhonePe, or Paytm.' },
};

type BankReview = Awaited<ReturnType<ImportsService['get']>>;
type SalaryReview = Awaited<ReturnType<SalaryService['get']>>;

@Injectable()
export class UnifiedImportsService {
  constructor(private readonly prisma: PrismaService, private readonly imports: ImportsService,
    private readonly salary: SalaryService, private readonly investments: InvestmentsService) {}

  async options(userId: string) {
    const accounts = await this.prisma.account.findMany({ where: { userId, archived: false },
      select: { id: true, name: true, type: true, institution: true, currency: true,
        statementCredential: { select: { accountId: true } } }, orderBy: { createdAt: 'desc' } });
    const safeAccounts = accounts.map(({ statementCredential, ...account }) => ({ ...account,
      hasStatementPassword: Boolean(statementCredential) }));
    return {
      accounts: safeAccounts,
      options: UNIFIED_IMPORT_KINDS.map((kind) => ({ kind, ...KIND_LABELS[kind],
        sources: SOURCE_SPECS.filter((spec) => spec.kind === kind).map((spec) => ({
          source: spec.source, label: spec.label, description: spec.description,
          extensions: spec.extensions, maxBytes: spec.maxBytes, accountRequired: spec.accountRequired,
          commitMode: spec.commitMode,
          pdfPasswordSupported: spec.kind === 'BANK_STATEMENT' || spec.kind === 'CREDIT_CARD_STATEMENT' || spec.kind === 'SALARY_PAYSLIP',
          rememberPasswordSupported: spec.kind === 'BANK_STATEMENT' && spec.source === 'SBI',
          eligibleAccountIds: safeAccounts.filter((account) => this.accountIsEligible(account, spec)).map((account) => account.id),
        })),
      })),
    };
  }

  async pending(userId: string) {
    const [bankAndCcReviews, salaryReviews, accounts] = await Promise.all([
      this.imports.pendingAll(userId), this.salary.pendingAll(userId),
      this.prisma.account.findMany({ where: { userId }, select: { id: true, type: true, institution: true } }),
    ]);
    const accountByid = new Map(accounts.map((account) => [account.id, account]));
    const pending = [
      ...bankAndCcReviews.map((review) => {
        const account = accountByid.get(review.account.id);
        const isCreditCard = account?.type === 'CREDIT_CARD';
        return {
          kind: (isCreditCard ? 'CREDIT_CARD_STATEMENT' : 'BANK_STATEMENT') as 'CREDIT_CARD_STATEMENT' | 'BANK_STATEMENT',
          source: isCreditCard ? 'UNKNOWN' : (bankSourceForInstitution(account?.institution ?? undefined) ?? 'UNKNOWN'),
          mode: 'REVIEW_REQUIRED' as const,
          createdAt: review.createdAt,
          review: this.safeBankReview(review),
          actions: this.bankActions(review.id),
        };
      }),
      ...salaryReviews.map((review) => ({
        kind: 'SALARY_PAYSLIP' as const,
        source: 'GOLDMAN_SACHS' as const,
        mode: 'REVIEW_REQUIRED' as const,
        createdAt: review.createdAt,
        review: this.safeSalaryReview(review as SalaryReview),
        actions: this.salaryActions(review.id),
      })),
    ];
    return pending.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  async upload(userId: string, file: Express.Multer.File, dto: UnifiedImportUploadDto) {
    const spec = SOURCE_SPECS.find((candidate) => candidate.kind === dto.kind && candidate.source === dto.source);
    if (!spec) throw new BadRequestException('Choose a supported import type and source combination.');
    this.validateFile(file, spec);

    const extension = this.extension(file.originalname);
    const passwordWasSent = dto.pdfPassword !== undefined;
    const rememberWasSent = dto.rememberPassword !== undefined;
    if (spec.kind !== 'BANK_STATEMENT' && spec.kind !== 'CREDIT_CARD_STATEMENT' && spec.kind !== 'SALARY_PAYSLIP' || extension !== '.pdf') {
      if (passwordWasSent || rememberWasSent) throw new BadRequestException('Password fields do not apply to this import file.');
    } else {
      if (dto.pdfPassword !== undefined && dto.pdfPassword.length > 128) throw new BadRequestException('The PDF password is too long.');
      if (rememberWasSent && spec.source !== 'SBI') {
        throw new BadRequestException('Remembering a statement password is supported only for SBI PDFs.');
      }
      if (dto.rememberPassword && !dto.pdfPassword) {
        throw new BadRequestException('Enter the SBI PDF password before choosing to remember it.');
      }
    }

    let account: Awaited<ReturnType<UnifiedImportsService['ownedAccount']>> | undefined;
    if (spec.kind === 'BANK_STATEMENT' || spec.kind === 'CREDIT_CARD_STATEMENT' || spec.kind === 'UPI_STATEMENT') {
      account = await this.resolveOrProvisionAccount(userId, spec, dto.accountId, file, dto.pdfPassword);
    } else if (spec.accountRequired) {
      if (!dto.accountId) throw new BadRequestException('Choose an eligible destination account.');
      account = await this.ownedAccount(userId, dto.accountId);
      if (!this.accountIsEligible(account, spec)) {
        throw new BadRequestException('The selected account type or institution does not match this import source.');
      }
    } else if (dto.accountId !== undefined) {
      throw new BadRequestException('This import type does not use a destination account.');
    }

    if (spec.kind === 'BANK_STATEMENT') {
      const review = await this.imports.create(userId, account!.id, file,
        { pdfPassword: dto.pdfPassword, rememberPassword: dto.rememberPassword }, spec.source as BankImportSource);
      return { kind: spec.kind, source: spec.source, mode: spec.commitMode,
        review: this.safeBankReview(review), actions: this.bankActions(review.id) };
    }
    if (spec.kind === 'CREDIT_CARD_STATEMENT') {
      const review = await this.imports.createForCreditCard(userId, account!.id, file,
        { pdfPassword: dto.pdfPassword });
      return { kind: spec.kind, source: spec.source, mode: spec.commitMode,
        review: this.safeBankReview(review), actions: this.bankActions(review.id) };
    }
    if (spec.kind === 'SALARY_PAYSLIP') {
      const review = await this.salary.upload(userId, file, spec.source, dto.pdfPassword, dto.salaryType);
      return { kind: spec.kind, source: spec.source, mode: spec.commitMode,
        review: this.safeSalaryReview(review as SalaryReview), actions: this.salaryActions(review.id) };
    }
    if (spec.kind === 'UPI_STATEMENT') {
      throw new BadRequestException(`UPI statement parser for ${spec.label} is in preview mode. Statement parsing support will be enabled soon.`);
    }


    const result = spec.source === 'GROWW'
      ? await this.investments.importGrowwHoldings(userId, account!.id, file)
      : await this.investments.importZerodhaHoldings(userId, account!.id, file);
    return { kind: spec.kind, source: spec.source, mode: spec.commitMode,
      message: 'The fully reconciled report replaced this account’s previous holdings snapshot atomically.',
      result };
  }

  async updateBankReview(userId: string, batchId: string, rowId: string, dto: UpdateStagedDto) {
    const review = await this.imports.update(userId, batchId, rowId, dto);
    return { kind: 'BANK_STATEMENT' as const, mode: 'REVIEW_REQUIRED' as const, review: this.safeBankReview(review),
      actions: this.bankActions(review.id) };
  }

  async commitBankReview(userId: string, batchId: string) {
    const result = await this.imports.commit(userId, batchId);
    return { kind: 'BANK_STATEMENT' as const, mode: 'COMMITTED' as const, result };
  }

  async discardBankReview(userId: string, batchId: string) {
    await this.imports.discard(userId, batchId);
  }

  async commitSalaryReview(userId: string, statementId: string) {
    await this.salary.commit(userId, statementId);
    return { kind: 'SALARY_PAYSLIP' as const, mode: 'COMMITTED' as const, result: { statementId } };
  }

  async discardSalaryReview(userId: string, statementId: string) {
    await this.salary.discard(userId, statementId);
  }

  private async ownedAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId, archived: false },
      select: { id: true, name: true, type: true, institution: true, currency: true } });
    if (!account) throw new ForbiddenException('Destination account not found.');
    return account;
  }

  private accountIsEligible(account: { type: string; institution: string | null; name?: string }, spec: SourceSpec) {
    if (spec.kind === 'BANK_STATEMENT') {
      if (spec.source === 'EPFO') return account.type === 'EPFO';
      return ['BANK', 'SAVINGS'].includes(account.type)
        && bankInstitutionMatchesSource(account.institution, spec.source as BankImportSource);
    }
    if (spec.kind === 'CREDIT_CARD_STATEMENT') {
      return account.type === 'CREDIT_CARD';
    }
    if (spec.kind === 'UPI_STATEMENT') {
      return ['BANK', 'SAVINGS'].includes(account.type);
    }
    if (spec.kind === 'BROKER_HOLDINGS') {
      const matchInstitution = (account.institution ?? '');
      const matchName = (account.name ?? '');
      if (spec.source === 'GROWW') {
        return ['INVESTMENT', 'STOCKS'].includes(account.type) && (/\bgroww\b/i.test(matchInstitution) || /\bgroww\b/i.test(matchName));
      }
      return ['INVESTMENT', 'STOCKS'].includes(account.type) && (/\b(?:zerodha|kite)\b/i.test(matchInstitution) || /\b(?:zerodha|kite)\b/i.test(matchName));
    }
    return false;
  }

  private validateFile(file: Express.Multer.File, spec: SourceSpec) {
    const extension = this.extension(file.originalname);
    if (!spec.extensions.includes(extension)) {
      throw new BadRequestException(`${spec.label} accepts only ${spec.extensions.map((item) => item.slice(1).toUpperCase()).join(', ')} files.`);
    }
    if (file.buffer.length > spec.maxBytes) {
      throw new BadRequestException(`${spec.label} files are limited to ${spec.maxBytes / MIB} MB.`);
    }
    if (!file.buffer.length) throw new BadRequestException('The selected import file is empty.');
  }

  private extension(filename: string) {
    const match = filename.toLowerCase().match(/(\.[a-z0-9]+)$/);
    return match?.[1] ?? '';
  }

  private safeBankReview(review: BankReview) {
    return {
      id: review.id, filename: review.filename, status: review.status, rowCount: review.rowCount,
      createdAt: review.createdAt, committedAt: review.committedAt,
      account: { id: review.account.id, name: review.account.name, institution: (review.account as any).institution ?? null, last4: (review.account as any).last4 ?? null },
      categories: review.categories.map((category) => ({ id: category.id, name: category.name, color: category.color })),
      staged: review.staged.map((row) => ({
        id: row.id, rowNumber: row.rowNumber, transactionDate: row.transactionDate, postedDate: row.postedDate,
        descriptionRaw: row.descriptionRaw, merchant: row.merchant, amount: row.amount, reference: row.reference,
        categoryId: row.categoryId, isDuplicate: row.isDuplicate, include: row.include, confidence: row.confidence,
      })),
    };
  }

  private safeSalaryReview(review: SalaryReview) {
    return {
      id: review.id, payPeriod: review.payPeriod, employer: review.employer, employeeName: review.employeeName,
      employeeNumberLast4: review.employeeNumberLast4, department: review.department, designation: review.designation,
      bankName: review.bankName, bankAccountLast4: review.bankAccountLast4, uanLast4: review.uanLast4,
      currency: review.currency, grossEarnings: review.grossEarnings, grossDeductions: review.grossDeductions,
      directPayment: review.directPayment, netPay: review.netPay, filename: review.filename,
      status: review.status, createdAt: review.createdAt, committedAt: review.committedAt,
      lineItems: review.lineItems.map((item) => ({ id: item.id, type: item.type, description: item.description,
        currentAmount: item.currentAmount, ytdAmount: item.ytdAmount })),
    };
  }

  private bankActions(batchId: string) {
    return { commit: `/imports/unified/bank-reviews/${batchId}/commit`, discard: `/imports/unified/bank-reviews/${batchId}`,
      updateRow: `/imports/unified/bank-reviews/${batchId}/rows/{rowId}` };
  }

  private salaryActions(statementId: string) {
    return { commit: `/imports/unified/salary-reviews/${statementId}/commit`,
      discard: `/imports/unified/salary-reviews/${statementId}` };
  }

  private async resolveOrProvisionAccount(
    userId: string,
    spec: SourceSpec,
    dtoAccountId: string | undefined,
    file: Express.Multer.File,
    pdfPassword?: string,
  ) {
    if (dtoAccountId) {
      const explicit = await this.ownedAccount(userId, dtoAccountId);
      if (!this.accountIsEligible(explicit, spec)) {
        throw new BadRequestException('The selected account type or institution does not match this import source.');
      }
      return explicit;
    }

    const targetType: 'CREDIT_CARD' | 'SAVINGS' = spec.kind === 'CREDIT_CARD_STATEMENT' ? 'CREDIT_CARD' : 'SAVINGS';
    const accounts = await this.prisma.account.findMany({
      where: { userId, archived: false, type: targetType },
      include: { vaultEntry: { select: { last4: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let extractedDigits: string | undefined;

    if (file.originalname.toLowerCase().endsWith('.pdf')) {
      try {
        const doc = await loadPdfStatementDocument(file.buffer, pdfPassword);
        const fullText = doc.textPages.map((p) => p.text).join('\n');
        const last4Match = fullText.match(/Credit Card Number:[^\n\r]*?(\d{4})\b/i)
          || fullText.match(/Card Number:[^\n\r]*?(\d{4})\b/i)
          || fullText.match(/\b\d{4}X+(\d{4})\b/i);
        if (last4Match) {
          extractedDigits = last4Match[1];
        }
      } catch {
        // password fallback handled downstream
      }
    }

    if (!extractedDigits) {
      const fileDigitsMatch = file.originalname.match(/\b\d{4}\b/) || file.originalname.match(/\d{4}/);
      const rawDigits = fileDigitsMatch ? fileDigitsMatch[0] : undefined;
      const isYear = rawDigits && Number(rawDigits) >= 2020 && Number(rawDigits) <= 2035;
      extractedDigits = rawDigits && !isYear ? rawDigits : undefined;
    }

    if (extractedDigits) {
      const matched = accounts.find(
        (a) =>
          a.name.includes(extractedDigits!) ||
          (a.institution && a.institution.includes(extractedDigits!)) ||
          a.vaultEntry?.last4 === extractedDigits,
      );
      if (matched) return matched;
    }

    const instAlias = spec.label.split(' ')[0].toUpperCase();
    const instMatched = accounts.find(
      (a) => (a.institution && a.institution.toUpperCase().includes(instAlias)) || a.name.toUpperCase().includes(instAlias),
    );
    if (instMatched) return instMatched;

    if (accounts.length === 1) {
      return accounts[0];
    }

    const digitsLabel = extractedDigits ? ` ${extractedDigits}` : '';
    const accountName = `${spec.label}${digitsLabel}`;

    const newAccount = this.prisma.account?.create
      ? await this.prisma.account.create({
          data: {
            userId,
            name: accountName,
            type: targetType,
            institution: spec.label,
          },
        })
      : { id: 'auto-account-1', name: accountName, type: targetType, institution: spec.label, currency: 'INR' };

    return newAccount;
  }
}
