import { AccountType } from '@prisma/client';
import { isRefundOrReversal } from '../../common/utils/transaction-utils';

export type TransactionFlowKind =
  | 'TRANSFER'
  | 'CC_PAYMENT'
  | 'UPI_LITE'
  | 'INVESTMENT'
  | 'OTHER'
  | 'EXPENSE';

export type AssetAllocationCategory =
  | 'SAVINGS'
  | 'DEPOSITS'
  | 'STOCKS'
  | 'MUTUAL_FUNDS'
  | 'EPFO'
  | 'DEBT';

export interface ClassifiableCategory {
  id?: string;
  name?: string | null;
  type?: string | null;
  color?: string | null;
  superCategoryId?: string | null;
  superCategory?: {
    name?: string | null;
    kind?: string | null;
    color?: string | null;
  } | null;
}

export interface ClassifiableAccountRef {
  id: string;
  name: string;
  type: AccountType | string;
  institution?: string | null;
}

export interface ClassifiableVaultRef {
  accountId: string;
  last4?: string | null;
}

export interface ClassifiableSipRef {
  sourceAccountId?: string | null;
  billerKeyword?: string | null;
  name?: string | null;
  destinationAccount?: string | null;
}

export interface ClassifiableTransaction {
  id?: string;
  accountId?: string;
  amount: bigint | number;
  descriptionRaw?: string | null;
  merchant?: string | null;
  transferGroupId?: string | null;
  categoryId?: string | null;
  category?: ClassifiableCategory | null;
  account?: ClassifiableAccountRef | null;
}

const CC_PAYMENT_CATEGORY_PATTERN =
  /^\s*(?:cc\s*transfer|credit\s*card\s*payment|cc\s*payment)\s*$/i;
const CC_PAYMENT_DESC_PATTERN =
  /cred\.club|cred\s+rent|cred\s+pay|credit\s*card\s*payment|cc\s*bill|billdesk.*card|payment\s*to\s*card/i;
const UPI_LITE_PATTERN = /upi\s*lite/i;
const TRANSFER_CATEGORY_PATTERN =
  /^\s*(?:self\s*transfer|internal\s*transfer|transfer|trf)\s*$/i;
const TRANSFER_DESC_PATTERN =
  /self\s*tra|tcd\s*no|firdftfr|own\s*acc|self\s*transfer|trf\s*to/i;
const INVESTMENT_CATEGORY_PATTERN =
  /invest|mutual|sip|stock|broker|equity|zerodha|groww|etmoney/i;
const INVESTMENT_DESC_PATTERN =
  /mutual|fund|zerodha|groww|bse|nse|sgb|nps|indiabulls|icici\s*prudential|mf\s*central|razorpay\s*mf|cams|kfintech/i;
const OTHER_OBLIGATION_CATEGORY_PATTERN =
  /loan|emi|tax|penalty|bank\s*charge|annual\s*fee/i;
const CC_BILL_PAYMENT_CREDIT_PATTERN =
  /payment\s*received|autopay|mobile\s*banking|imps|neft|upi\s*pay|bill\s*pay|thank\s*you|credit\s*card\s*payment/i;
const INTERNAL_SETTLEMENT_CATEGORY_FILTER_PATTERN =
  /^\s*(?:cc transfer|upi lite|internal transfer|transfer|self transfer|credit card payment|credit card|card payment|wallet top-up|wallet transfer)\s*$/i;

/**
 * Exhaustiveness helper for compile-time switch validation.
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unhandled discriminated union member: ${String(value)}`);
}

/**
 * Resolves the destination internal account ID for a transaction using either
 * explicit transfer group links or vault last-4 digit matching.
 */
export function resolveInternalDestinationAccountId(
  tx: ClassifiableTransaction,
  monthTransactions: readonly ClassifiableTransaction[],
  activeVaults: readonly ClassifiableVaultRef[],
): string | undefined {
  if (tx.transferGroupId && tx.id) {
    const opposite = monthTransactions.find(
      (other) => other.transferGroupId === tx.transferGroupId && other.id !== tx.id,
    );
    if (opposite?.accountId) return opposite.accountId;
  }

  const rawDesc = tx.descriptionRaw ?? '';
  for (const vault of activeVaults) {
    if (vault.last4 && vault.accountId !== tx.accountId && rawDesc.includes(vault.last4)) {
      return vault.accountId;
    }
  }
  return undefined;
}

/**
 * Classifies a ledger transaction into one of the canonical cash-flow kinds:
 * TRANSFER, CC_PAYMENT, UPI_LITE, INVESTMENT, OTHER, or EXPENSE.
 */
export function classifyTransaction(
  tx: ClassifiableTransaction,
  accounts: readonly ClassifiableAccountRef[],
  activeVaults: readonly ClassifiableVaultRef[],
  activeSips: readonly ClassifiableSipRef[] = [],
): TransactionFlowKind {
  const desc = (tx.descriptionRaw || '').toLowerCase();
  const catName = tx.category?.name || '';
  const catType = tx.category?.type || '';
  const superKind = tx.category?.superCategory?.kind || '';

  let destAccountId: string | undefined;
  const rawDesc = tx.descriptionRaw || '';
  for (const v of activeVaults) {
    if (v.last4 && v.accountId !== tx.accountId && rawDesc.includes(v.last4)) {
      destAccountId = v.accountId;
      break;
    }
  }
  const destAcc = destAccountId ? accounts.find((a) => a.id === destAccountId) : undefined;

  if (
    destAcc?.type === 'CREDIT_CARD' ||
    CC_PAYMENT_CATEGORY_PATTERN.test(catName) ||
    CC_PAYMENT_DESC_PATTERN.test(desc)
  ) {
    return 'CC_PAYMENT';
  }

  if (
    destAcc?.type === 'UPI_LITE' ||
    UPI_LITE_PATTERN.test(catName) ||
    UPI_LITE_PATTERN.test(desc)
  ) {
    return 'UPI_LITE';
  }

  if (
    tx.transferGroupId ||
    catType === 'TRANSFER' ||
    superKind === 'TRANSFER' ||
    TRANSFER_CATEGORY_PATTERN.test(catName) ||
    TRANSFER_DESC_PATTERN.test(desc) ||
    Boolean(destAccountId)
  ) {
    return 'TRANSFER';
  }

  if (
    catType === 'INVESTMENT' ||
    superKind === 'INVESTMENT' ||
    INVESTMENT_CATEGORY_PATTERN.test(catName) ||
    INVESTMENT_DESC_PATTERN.test(desc)
  ) {
    return 'INVESTMENT';
  }

  const matchesSip = activeSips.some((sip) => {
    const accountMatch = !sip.sourceAccountId || sip.sourceAccountId === tx.accountId;
    const merchantLower = (tx.merchant || '').toLowerCase();
    const keywordMatch = Boolean(
      (sip.billerKeyword && desc.includes(sip.billerKeyword.toLowerCase())) ||
        (sip.name && desc.includes(sip.name.toLowerCase())) ||
        (sip.destinationAccount && desc.includes(sip.destinationAccount.toLowerCase())) ||
        (sip.name && merchantLower.includes(sip.name.toLowerCase())),
    );
    return accountMatch && keywordMatch;
  });
  if (matchesSip) return 'INVESTMENT';

  if (
    catType === 'OTHER' ||
    superKind === 'OTHER' ||
    OTHER_OBLIGATION_CATEGORY_PATTERN.test(catName)
  ) {
    return 'OTHER';
  }

  return 'EXPENSE';
}

/**
 * Determines whether a positive (inbound) transaction is a merchant refund/reversal
 * rather than genuine income or an internal/bill-payment settlement.
 */
export function isTransactionRefundOrReversal(
  tx: ClassifiableTransaction,
  accounts: readonly ClassifiableAccountRef[],
  activeVaults: readonly ClassifiableVaultRef[],
  activeSips: readonly ClassifiableSipRef[] = [],
): boolean {
  if (Number(tx.amount) <= 0) return false;
  const txKind = classifyTransaction(tx, accounts, activeVaults, activeSips);
  if (txKind === 'TRANSFER' || txKind === 'CC_PAYMENT' || txKind === 'UPI_LITE') {
    return false;
  }

  const rawDesc = tx.descriptionRaw || '';
  const desc = rawDesc.toLowerCase();
  if (tx.account?.type === 'CREDIT_CARD') {
    if (CC_BILL_PAYMENT_CREDIT_PATTERN.test(desc)) return false;
    return true;
  }

  return isRefundOrReversal(rawDesc);
}

/**
 * Checks whether a category name represents an internal payment rail or settlement
 * category that should be excluded from final end-spend breakdowns.
 */
export function isInternalSettlementCategoryName(name: string): boolean {
  return INTERNAL_SETTLEMENT_CATEGORY_FILTER_PATTERN.test(name);
}

/**
 * Maps an account to its canonical asset allocation bucket with exhaustive
 * AccountType handling plus institution/name keyword fallbacks.
 */
export function getAccountAssetCategory(account: {
  type: AccountType | string;
  name: string;
  institution?: string | null;
}): AssetAllocationCategory {
  const nameLower = `${account.name} ${account.institution || ''}`.toLowerCase();
  const knownType = Object.values(AccountType).includes(account.type as AccountType)
    ? (account.type as AccountType)
    : undefined;

  if (knownType !== undefined) {
    switch (knownType) {
      case AccountType.LOAN:
        return 'DEBT';
      case AccountType.FIXED_DEPOSIT:
      case AccountType.RECURRING_DEPOSIT:
        return 'DEPOSITS';
      case AccountType.EPFO:
        return 'EPFO';
      case AccountType.MUTUAL_FUND:
        return 'MUTUAL_FUNDS';
      case AccountType.STOCKS:
        return 'STOCKS';
      case AccountType.BANK:
      case AccountType.SAVINGS:
      case AccountType.CASH:
      case AccountType.CREDIT_CARD:
      case AccountType.UPI_LITE:
        break;
      default:
        assertNever(knownType);
    }
  }

  if (
    nameLower.includes('fixed deposit') ||
    nameLower.includes('recurring deposit') ||
    nameLower.includes('rd-') ||
    nameLower.includes('-rd') ||
    nameLower.includes('fd-') ||
    nameLower.includes('-fd')
  ) {
    return 'DEPOSITS';
  }
  if (nameLower.includes('epfo') || nameLower.includes('provident')) {
    return 'EPFO';
  }
  if (
    nameLower.includes('mutual') ||
    nameLower.includes('fund') ||
    nameLower.includes('sip') ||
    nameLower.includes('groww')
  ) {
    return 'MUTUAL_FUNDS';
  }
  if (
    nameLower.includes('zerodha') ||
    nameLower.includes('demat') ||
    nameLower.includes('stocks')
  ) {
    return 'STOCKS';
  }
  return 'SAVINGS';
}
