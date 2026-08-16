import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ImportsService } from '../imports/imports.service';
import { UpdateStagedDto } from '../imports/imports.dto';
import { bankInstitutionMatchesSource, bankSourceForInstitution, loadPdfStatementDocument } from '../imports/pdf-statement-registry';
import { InvestmentsService } from '../investments/investments.service';
import { SalaryService } from '../salary/salary.service';
import { UnifiedImportUploadDto } from './unified-imports.dto';
import { ImportSourceType, AccountType } from '../common/constants/enums';

export const UNIFIED_IMPORT_KINDS = ['BANK_STATEMENT', 'SALARY_PAYSLIP', 'BROKER_HOLDINGS', 'UPI_STATEMENT'] as const;
export type UnifiedImportKind = (typeof UNIFIED_IMPORT_KINDS)[number];
export type BankImportSource = 'SBI' | 'PNB' | 'AXIS' | 'EPFO';
export type UPIImportSource = 'GPAY' | 'PHONEPE' | 'PAYTM';
export type UnifiedImportSource = BankImportSource | UPIImportSource | 'STANDARD_PAYSLIP' | 'ZERODHA_KITE' | 'GROWW';

/** Prefix used in the unified options catalog for per-organisation salary sources */
const ORG_SOURCE_PREFIX = 'ORG_';
function orgSource(orgId: string) { return `${ORG_SOURCE_PREFIX}${orgId}`; }
function isOrgSource(source: string) { return source.startsWith(ORG_SOURCE_PREFIX); }
function orgIdFromSource(source: string) { return source.slice(ORG_SOURCE_PREFIX.length); }

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
  { kind: 'SALARY_PAYSLIP', source: 'STANDARD_PAYSLIP', label: 'Employer Payslip',
    description: 'Employer payslip PDF.', extensions: ['.pdf'], maxBytes: 8 * MIB,
    accountRequired: false, commitMode: 'REVIEW_REQUIRED' },
  { kind: 'BROKER_HOLDINGS', source: 'ZERODHA_KITE', label: 'Zerodha / Kite',
    description: 'Zerodha Console holdings XLSX report.', extensions: ['.xlsx'], maxBytes: 5 * MIB,
    accountRequired: true, commitMode: 'IMMEDIATE_ATOMIC_REPLACEMENT' },
  { kind: 'BROKER_HOLDINGS', source: 'GROWW', label: 'Groww',
    description: 'Groww mutual funds XLSX report.', extensions: ['.xlsx'], maxBytes: 5 * MIB,
    accountRequired: true, commitMode: 'IMMEDIATE_ATOMIC_REPLACEMENT' },
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
    const [accounts, orgs] = await Promise.all([
      this.prisma.account.findMany({ where: { userId, archived: false },
        select: { id: true, name: true, type: true, institution: true, currency: true,
          statementCredential: { select: { accountId: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.organization.findMany({ where: { userId }, orderBy: [{ isCurrent: 'desc' }, { name: 'asc' }] }),
    ]);
    const safeAccounts = accounts.map(({ statementCredential, ...account }) => ({ ...account,
      hasStatementPassword: Boolean(statementCredential) }));

    // Build per-org source specs for SALARY_PAYSLIP so each employer appears as
    // its own dropdown option. Fall back to the generic STANDARD_PAYSLIP entry
    // when the user has no organisations yet.
    const payslipSpec = SOURCE_SPECS.find((s) => s.source === 'STANDARD_PAYSLIP')!;
    const salarySources = orgs.length > 0
      ? orgs.map((org) => ({
          source: orgSource(org.id),
          label: org.name,
          description: `Payslip from ${org.name}.`,
          extensions: payslipSpec.extensions,
          maxBytes: payslipSpec.maxBytes,
          accountRequired: false,
          commitMode: payslipSpec.commitMode,
          pdfPasswordSupported: true,
          rememberPasswordSupported: false,
          eligibleAccountIds: [] as string[],
          isCurrent: org.isCurrent,
        }))
      : [{
          source: payslipSpec.source,
          label: payslipSpec.label,
          description: payslipSpec.description,
          extensions: payslipSpec.extensions,
          maxBytes: payslipSpec.maxBytes,
          accountRequired: payslipSpec.accountRequired,
          commitMode: payslipSpec.commitMode,
          pdfPasswordSupported: true,
          rememberPasswordSupported: false,
          eligibleAccountIds: [] as string[],
          isCurrent: false,
        }];

    return {
      accounts: safeAccounts,
      organizations: orgs.map((o) => ({ id: o.id, name: o.name, code: o.code, isCurrent: o.isCurrent })),
      options: UNIFIED_IMPORT_KINDS.map((kind) => {
        if (kind === 'SALARY_PAYSLIP') {
          return { kind, ...KIND_LABELS[kind], sources: salarySources };
        }
        return { kind, ...KIND_LABELS[kind],
          sources: SOURCE_SPECS.filter((spec) => spec.kind === kind).map((spec) => ({
            source: spec.source, label: spec.label, description: spec.description,
            extensions: spec.extensions, maxBytes: spec.maxBytes, accountRequired: spec.accountRequired,
            commitMode: spec.commitMode,
            pdfPasswordSupported: spec.kind === 'BANK_STATEMENT',
            rememberPasswordSupported: spec.kind === 'BANK_STATEMENT' && spec.source === 'SBI',
            eligibleAccountIds: safeAccounts.filter((account) => this.accountIsEligible(account, spec)).map((account) => account.id),
          })),
        };
      }),
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
        return {
          kind: 'BANK_STATEMENT' as const,
          source: (bankSourceForInstitution(account?.institution ?? undefined) ?? 'UNKNOWN'),
          mode: 'REVIEW_REQUIRED' as const,
          createdAt: review.createdAt,
          review: this.safeBankReview(review),
          actions: this.bankActions(review.id),
        };
      }),
      ...salaryReviews.map((review) => ({
        kind: 'SALARY_PAYSLIP' as const,
        source: 'STANDARD_PAYSLIP' as const,
        mode: 'REVIEW_REQUIRED' as const,
        createdAt: review.createdAt,
        review: this.safeSalaryReview(review as SalaryReview),
        actions: this.salaryActions(review.id),
      })),
    ];
    return pending.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  async upload(userId: string, file: Express.Multer.File, dto: UnifiedImportUploadDto) {
    // Per-org salary sources arrive as ORG_<uuid>. Resolve to the base STANDARD_PAYSLIP spec.
    const resolvedSource = isOrgSource(dto.source) ? 'STANDARD_PAYSLIP' : dto.source;
    const resolvedOrgId = isOrgSource(dto.source) ? orgIdFromSource(dto.source) : undefined;

    if (resolvedOrgId) {
      // Validate that the organisation belongs to this user.
      const orgExists = await this.prisma.organization.findFirst({ where: { id: resolvedOrgId, userId }, select: { id: true } });
      if (!orgExists) throw new BadRequestException('The selected employer was not found.');
    }

    const spec = SOURCE_SPECS.find((candidate) => candidate.kind === dto.kind && candidate.source === resolvedSource);
    if (!spec) throw new BadRequestException('Choose a supported import type and source combination.');
    this.validateFile(file, spec);

    const extension = this.extension(file.originalname);
    const passwordWasSent = dto.pdfPassword !== undefined;
    const rememberWasSent = dto.rememberPassword !== undefined;
    if (spec.kind !== 'BANK_STATEMENT' && spec.kind !== 'SALARY_PAYSLIP' || extension !== '.pdf') {
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
    if (spec.kind === 'BANK_STATEMENT' || spec.kind === 'UPI_STATEMENT') {
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
    if (spec.kind === 'SALARY_PAYSLIP') {
      // Pass the org ID (if an employer was explicitly selected) so the dynamic
      // payslip parser uses that employer's config.
      const payslipSource = resolvedOrgId ?? spec.source;
      const review = await this.salary.upload(userId, file, payslipSource, dto.pdfPassword, dto.salaryType);
      return { kind: spec.kind, source: dto.source, mode: spec.commitMode,
        review: this.safeSalaryReview(review as SalaryReview), actions: this.salaryActions(review.id) };
    }
    if (spec.kind === 'UPI_STATEMENT') {
      const review = await this.imports.create(userId, account!.id, file,
        { pdfPassword: dto.pdfPassword }, spec.source as any);
      return { kind: spec.kind, source: spec.source, mode: spec.commitMode,
        review: this.safeBankReview(review), actions: this.bankActions(review.id) };
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
    if (spec.kind === 'UPI_STATEMENT') {
      return ['BANK', 'SAVINGS', 'UPI_LITE'].includes(account.type);
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
      lineItems: review.lineItems.map((item: any) => ({ id: item.id, type: item.type, description: item.description,
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

    if (spec.kind === 'UPI_STATEMENT') {
      const upiAccount = await this.prisma.account.findFirst({
        where: { userId, archived: false, type: { in: ['UPI_LITE', 'BANK', 'SAVINGS'] } },
        select: { id: true, name: true, type: true, institution: true, currency: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!upiAccount) {
        throw new BadRequestException('No eligible account found for UPI statement import. Please add a bank account first.');
      }
      return upiAccount;
    }

    const targetType: 'SAVINGS' = 'SAVINGS';
    const accounts = await this.prisma.account.findMany({
      where: { userId, archived: false, type: targetType },
      include: { vaultEntry: { select: { last4: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let extractedDigits: string | undefined;

    if (file.originalname.toLowerCase().endsWith('.pdf')) {
      const candidates: (string | undefined)[] = [];
      if (pdfPassword) {
        candidates.push(pdfPassword);
      } else {
        candidates.push(undefined);
      }
      if (!pdfPassword && (!spec.source || spec.source === 'AXIS')) {
        try {
          const auto = await this.imports.getAxisPasswordCandidates(userId, 'temp', file.originalname);
          for (const c of auto) {
            if (!candidates.includes(c)) candidates.push(c);
          }
        } catch {
          // ignore
        }
      }

      for (const pwd of candidates) {
        try {
          const doc = await loadPdfStatementDocument(file.buffer, pwd);
          const fullText = doc.textPages.map((p) => p.text).join('\n');
          const last4Match = fullText.match(/(?:account|a\/c)\s*(?:no\.?|number|#)?\s*[:\s]*[xX*\s]*(\d{4,18})/i)
            || fullText.match(/\b[xX*]{4,12}[-\s]*(\d{4})\b/)
            || fullText.match(/Card Number:[^\n\r]*?(\d{4})\b/i);
          if (last4Match) {
            extractedDigits = last4Match[1].slice(-4);
            break;
          }
        } catch {
          // try next password candidate
        }
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

    if (accounts.length > 0) {
      return accounts[0];
    }

    throw new BadRequestException(`No matching account found for ${spec.label}. Please add your ${spec.label} account in YAFT before uploading.`);
  }

  async getHistory(userId: string) {
    const [batches, salaryStatements, documents] = await Promise.all([
      this.prisma.importBatch.findMany({
        where: { userId },
        include: {
          account: { select: { id: true, name: true, type: true, institution: true } },
          transactions: {
            select: {
              amount: true,
              category: { select: { name: true, color: true } },
            },
          },
          staged: {
            select: {
              amount: true,
              category: { select: { name: true, color: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salaryStatement.findMany({
        where: { userId },
        include: {
          lineItems: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.accountDocument.findMany({
        where: { account: { userId } },
        include: {
          account: { select: { id: true, name: true, type: true, institution: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items: Array<{
      id: string;
      sourceType: ImportSourceType;
      filename: string;
      status: string;
      rowCount: number;
      createdAt: string;
      committedAt: string | null;
      accountName: string;
      accountType: string;
      accountInstitution: string | null;
      totalSpent: number;
      totalReceived: number;
      categories: Array<{
        name: string;
        color: string;
        amount: number;
        count: number;
      }>;
    }> = [];

    for (const b of batches) {
      let spentSum = 0n;
      let receivedSum = 0n;
      const catMap = new Map<string, { name: string; color: string; amount: bigint; count: number }>();

      const rows = (b.transactions && b.transactions.length > 0) ? b.transactions : (b.staged || []);
      for (const r of rows) {
        if (!r || r.amount === undefined || r.amount === null) continue;
        const amt = typeof r.amount === 'bigint' ? r.amount : BigInt(r.amount);
        if (amt < 0n) spentSum += -amt;
        else receivedSum += amt;

        const catName = r.category?.name || 'Uncategorised';
        const catColor = r.category?.color || '#94a3b8';
        const existing = catMap.get(catName) || { name: catName, color: catColor, amount: 0n, count: 0 };
        existing.amount += amt < 0n ? -amt : amt;
        existing.count += 1;
        catMap.set(catName, existing);
      }

      const categories = Array.from(catMap.values())
        .map((c) => ({
          name: c.name,
          color: c.color,
          amount: Number(c.amount) / 100,
          count: c.count,
        }))
        .sort((a, b) => b.amount - a.amount);

      const accType = b.account?.type ?? AccountType.SAVINGS;
      const accName = b.account?.name ?? 'Statement Account';
      const accInst = b.account?.institution ?? null;

      items.push({
        id: b.id,
        sourceType: accType === AccountType.CREDIT_CARD ? ImportSourceType.CREDIT_CARD : ImportSourceType.BANK_STATEMENT,
        filename: b.filename || 'statement.pdf',
        status: b.status || 'COMMITTED',
        rowCount: b.rowCount || rows.length,
        createdAt: b.createdAt ? b.createdAt.toISOString() : new Date().toISOString(),
        committedAt: b.committedAt ? b.committedAt.toISOString() : null,
        accountName: accName,
        accountType: accType,
        accountInstitution: accInst,
        totalSpent: Number(spentSum) / 100,
        totalReceived: Number(receivedSum) / 100,
        categories,
      });
    }

    for (const s of salaryStatements) {
      const grossE = s.grossEarnings ? BigInt(s.grossEarnings) : 0n;
      const grossD = s.grossDeductions ? BigInt(s.grossDeductions) : 0n;
      const netP = s.netPay ? BigInt(s.netPay) : 0n;

      items.push({
        id: s.id,
        sourceType: ImportSourceType.SALARY_PAYSLIP,
        filename: s.filename || 'payslip.pdf',
        status: s.status || 'COMMITTED',
        rowCount: s.lineItems ? s.lineItems.length : 0,
        createdAt: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
        committedAt: s.committedAt ? s.committedAt.toISOString() : null,
        accountName: s.employer || 'Salary Statement',
        accountType: 'SALARY',
        accountInstitution: s.employer || null,
        totalSpent: Number(grossD) / 100,
        totalReceived: Number(netP) / 100,
        categories: [
          { name: 'Gross Earnings', color: '#10b981', amount: Number(grossE) / 100, count: 1 },
          { name: 'Deductions', color: '#ef4444', amount: Number(grossD) / 100, count: 1 },
        ],
      });
    }

    for (const d of documents) {
      items.push({
        id: d.id,
        sourceType: ImportSourceType.DOCUMENT,
        filename: d.name || 'document.pdf',
        status: 'COMMITTED',
        rowCount: 1,
        createdAt: d.createdAt ? d.createdAt.toISOString() : new Date().toISOString(),
        committedAt: d.createdAt ? d.createdAt.toISOString() : new Date().toISOString(),
        accountName: d.account?.name ?? 'Document Account',
        accountType: d.account?.type ?? 'DOCUMENT',
        accountInstitution: d.account?.institution ?? null,
        totalSpent: 0,
        totalReceived: 0,
        categories: [],
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }
}
