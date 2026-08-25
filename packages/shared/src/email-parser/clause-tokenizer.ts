/**
 * Stage 3: Structured Context Tokenization & Grammar
 *
 * Extracts semantic tokens (Amount, Instrument, Beneficiary, Reference, Date)
 * specifically anchored to the core notification payload.
 */

import { PreprocessedEmailDocument } from './email-preprocessor';
import { TransactionalIntent } from './intent-classifier';
import { AccountType } from '../enums';
import { INSTITUTIONS } from '../institutions';
import {
  extractAlertAmount,
  extractAlertAccountLast4,
  extractAlertReferenceNumber,
  extractAlertRawMerchant,
  extractAlertDateTime,
  canonicalizeMerchantName,
  EMAIL_ALERT_PATTERNS,
} from '../parser-config';
import { findEmailConfigForSender } from '../email-alert-configs';

export interface SemanticTokens {
  amountNumber: number | null;
  amountMinor: bigint | null;
  accountType: AccountType;
  bankName: string;
  accountLast4?: string;
  merchantRaw?: string;
  merchantCanonical: string;
  referenceNumber?: string;
  dateStr?: string;
  timeStr?: string;
}

export function extractSemanticTokens(
  doc: PreprocessedEmailDocument,
  intent: TransactionalIntent
): SemanticTokens {
  const { corePayload, fullContext, sender } = doc;
  const config = findEmailConfigForSender(sender, fullContext);

  // 1. Extract Financial Amount Token
  let rawAmount: number | null = null;
  if (config?.amountRegexes) {
    for (const rx of config.amountRegexes) {
      const m = corePayload.match(rx) || fullContext.match(rx);
      if (m && m[1]) {
        const parsed = parseFloat(m[1].replace(/,/g, ''));
        if (Number.isFinite(parsed) && parsed > 0) {
          rawAmount = parsed;
          break;
        }
      }
    }
  }
  if (rawAmount === null) {
    rawAmount = extractAlertAmount(corePayload);
  }
  if (rawAmount === null && corePayload !== fullContext) {
    rawAmount = extractAlertAmount(fullContext);
  }

  const amountMinor = rawAmount !== null ? BigInt(Math.round(rawAmount * 100)) : null;

  // 2. Extract Bank & Institution Token
  let matchedInst = config ? INSTITUTIONS.find((i) => i.id === config.institutionId) : null;
  if (!matchedInst && sender) {
    const senderLower = sender.toLowerCase();
    matchedInst = INSTITUTIONS.find((i) =>
      i.aliases.some((alias) => senderLower.includes(alias.toLowerCase()))
    ) || null;
  }
  if (!matchedInst) {
    const bodyLower = fullContext.toLowerCase();
    matchedInst = INSTITUTIONS.find((i) =>
      i.aliases.some((alias) => bodyLower.includes(alias.toLowerCase()))
    ) || null;
  }

  let bankName = matchedInst ? matchedInst.name : (config?.displayName || 'Bank Alert');
  if (!matchedInst && intent === 'INVESTMENT_DEBIT') {
    bankName = 'Mutual Fund';
  }

  // 3. Extract Account Instrument Token
  let accountType = AccountType.BANK;
  if (intent === 'INVESTMENT_DEBIT' || EMAIL_ALERT_PATTERNS.EXPLICIT_INVESTMENT_REGEX.test(fullContext)) {
    accountType = AccountType.MUTUAL_FUND;
  } else if (
    intent === 'CARD_SPEND' ||
    intent === 'CARD_BILL_PAYMENT' ||
    EMAIL_ALERT_PATTERNS.EXPLICIT_CREDIT_CARD_REGEX.test(fullContext) ||
    config?.accountType === AccountType.CREDIT_CARD
  ) {
    accountType = AccountType.CREDIT_CARD;
  } else if (config?.accountType) {
    accountType = config.accountType;
  }

  // 4. Extract Account / Card Last 4 Digits
  let accountLast4: string | undefined = undefined;
  if (config?.last4Regexes) {
    for (const rx of config.last4Regexes) {
      const m = corePayload.match(rx) || fullContext.match(rx);
      if (m && m[1]) {
        accountLast4 = m[1].length >= 4 ? m[1].slice(-4) : m[1];
        break;
      }
    }
  }
  if (!accountLast4) {
    accountLast4 = extractAlertAccountLast4(corePayload) || extractAlertAccountLast4(fullContext);
  }

  // 5. Extract Reference / UTR Token
  let referenceNumber: string | undefined = undefined;
  if (config?.referenceRegexes) {
    for (const rx of config.referenceRegexes) {
      const m = corePayload.match(rx) || fullContext.match(rx);
      if (m && m[1]) {
        referenceNumber = m[1].trim();
        break;
      }
    }
  }
  if (!referenceNumber) {
    referenceNumber = extractAlertReferenceNumber(corePayload) || extractAlertReferenceNumber(fullContext);
  }

  // 6. Extract Beneficiary / Merchant Token
  let merchantRaw: string | undefined = undefined;
  if (config?.merchantRegexes) {
    for (const rx of config.merchantRegexes) {
      const m = corePayload.match(rx) || fullContext.match(rx);
      if (m && m[1] && !/^(vpa|account|a\/c|your|debited|credited|ref|bank|savings|primary)$/i.test(m[1].trim())) {
        merchantRaw = m[1].replace(/[.,\s\-_]+$/, '').trim();
        break;
      }
    }
  }
  if (!merchantRaw) {
    merchantRaw = extractAlertRawMerchant(corePayload, sender);
  }
  if (!merchantRaw && corePayload !== fullContext) {
    merchantRaw = extractAlertRawMerchant(fullContext, sender);
  }
  if (intent === 'CARD_BILL_PAYMENT' && (!merchantRaw || merchantRaw === 'General Merchant')) {
    merchantRaw = 'Payment Received';
  }

  const merchantCanonical = canonicalizeMerchantName(merchantRaw || 'General Merchant');

  // 7. Extract Temporal Token (Date & Time)
  const { dateStr, timeStr } = extractAlertDateTime(corePayload);

  return {
    amountNumber: rawAmount,
    amountMinor,
    accountType,
    bankName,
    accountLast4,
    merchantRaw,
    merchantCanonical,
    referenceNumber,
    dateStr,
    timeStr,
  };
}
