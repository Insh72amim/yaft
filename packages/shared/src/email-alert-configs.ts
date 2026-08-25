/**
 * Centralized, Declarative Institution Email Alert Configurations Registry.
 *
 * Provides typed, institution-specific email senders, subject patterns, query keywords,
 * extraction overrides, and category routing intelligence for automated Gmail sync.
 */

import { AccountType } from './enums';
import { EMAIL_ALERT_PATTERNS } from './parser-config';

export interface InstitutionEmailConfig {
  /** Unique configuration ID (e.g. 'axis-bank', 'sbi-card', 'icici-card') */
  id: string;
  /** Reference to canonical institution ID in INSTITUTIONS registry (e.g. 'axis', 'sbi', 'icici', 'hdfc') */
  institutionId: string;
  /** Human-readable display label matching canonical institution name */
  displayName: string;
  /** The target account type for alerts from this provider */
  accountType: AccountType;
  /**
   * Senders: Exact email addresses (e.g. 'alerts@axis.bank.in', 'onlinesbicard@sbicard.com')
   * or domain suffixes for filtering incoming emails and formulating Gmail search queries.
   */
  senders: string[];
  /** Optional subject matching regular expressions */
  subjectPatterns?: RegExp[];
  /** Specific search query keywords for Gmail API search optimization */
  queryKeywords?: string[];
  /** Optional suggested default category name for this provider's alerts */
  defaultCategoryName?: string;
  /** Optional custom regexes for amount extraction when bank layout is non-standard */
  amountRegexes?: RegExp[];
  /** Optional custom regexes for merchant / beneficiary extraction */
  merchantRegexes?: RegExp[];
  /** Optional custom regexes for reference / UTR / transaction ID extraction */
  referenceRegexes?: RegExp[];
  /** Optional custom regexes for account / card last 4 digits */
  last4Regexes?: RegExp[];
}

export const INSTITUTION_EMAIL_CONFIGS: InstitutionEmailConfig[] = [
  // ---------------------------------------------------------------------------
  // Axis Bank Cards & Accounts
  // ---------------------------------------------------------------------------
  {
    id: 'axis-card',
    institutionId: 'axis',
    displayName: 'Axis Bank',
    accountType: AccountType.CREDIT_CARD,
    senders: ['creditcards@axisbank.com', 'alerts@axis.bank.in', 'alerts@axisbank.com', 'axis.bank.in', 'axisbank.com'],
    subjectPatterns: [
      /transaction\s+alert.*(?:credit\s*card|axis\s*card|flipkart|neo|rewards|ace|magnus)/i,
      /alert:\s*transaction.*card/i,
    ],
    queryKeywords: ['spent on Axis Bank Card', 'credit card ending', 'card no', 'card xx', 'flipkart', 'neo', 'rewards'],
    merchantRegexes: [
      /\bat\s+([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:on\s+\d|at\s+\d|\.|\binfo\b|\bavail|\btotal|\bref|\bcard|\breport|$))/i,
      /Merchant\s*Name:\s*([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:Axis|Date|Avail|Total|Ref|\.|$))/i,
    ],
  },
  {
    id: 'axis-bank',
    institutionId: 'axis',
    displayName: 'Axis Bank',
    accountType: AccountType.BANK,
    senders: ['alerts@axis.bank.in', 'alerts@axisbank.com', 'axis.bank.in', 'axisbank.com'],
    subjectPatterns: [
      /transaction\s+alert.*axis\s+bank/i,
      /debit\s+alert.*a\/c/i,
      /credit\s+alert.*a\/c/i,
      /axis\s+bank\s+alert/i,
    ],
    queryKeywords: ['debited', 'credited', 'from A/c', 'towards', 'UPI', 'NEFT', 'IMPS'],
    merchantRegexes: [
      /(?:towards|to)\s+([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:at\s+\d|on\s+\d|\.|Bal|Avail|Ref|via|$))/i,
    ],
  },

  // ---------------------------------------------------------------------------
  // ICICI Bank Cards & Accounts
  // ---------------------------------------------------------------------------
  {
    id: 'icici-card',
    institutionId: 'icici',
    displayName: 'ICICI Bank',
    accountType: AccountType.CREDIT_CARD,
    senders: ['credit_cards@icici.bank.in', 'credit_cards@icicibank.com', 'alerts@icicibank.com', 'icici.bank.in', 'icicibank.com'],
    subjectPatterns: [
      /transaction\s+alert.*icici\s+bank\s+credit\s+card/i,
      /icici\s+bank\s+credit\s+card.*used/i,
      /amazon\s+pay\s+icici/i,
    ],
    queryKeywords: ['spent on your ICICI Bank Credit Card', 'Credit Card ending', 'Amazon Pay', 'credit card'],
    merchantRegexes: [
      /\bat\s+([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:on\s+\d|at\s+\d|\.|\bAvail\b|\bTotal\b|\bRef\b|$))/i,
      /Info:\s*([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:The\s+Avail|Avail|Total|\.|$))/i,
    ],
  },
  {
    id: 'icici-bank',
    institutionId: 'icici',
    displayName: 'ICICI Bank',
    accountType: AccountType.BANK,
    senders: ['alerts@icicibank.com', 'customercare@icicibank.com', 'icici.bank.in', 'icicibank.com', 'icicibank.co.in'],
    subjectPatterns: [
      /transaction\s+alert.*icici\s+bank/i,
      /account\s+debited.*inr/i,
      /account\s+credited.*inr/i,
    ],
    queryKeywords: ['debited with INR', 'credited with INR', 'Account ending', 'UPI', 'NEFT', 'IMPS'],
    merchantRegexes: [
      /(?:towards|to|at)\s+([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:on\s+\d|at\s+\d|\.|\bUTR\b|\bRef\b|\bAvail\b|$))/i,
    ],
  },

  // ---------------------------------------------------------------------------
  // State Bank of India (SBI) & SBI Card
  // ---------------------------------------------------------------------------
  {
    id: 'sbi-card',
    institutionId: 'sbi',
    displayName: 'State Bank of India',
    accountType: AccountType.CREDIT_CARD,
    senders: ['onlinesbicard@sbicard.com', 'feedback@sbicard.com', 'sbicard.com'],
    subjectPatterns: [
      /sbi\s*card\s*transaction\s*alert/i,
      /transaction\s*alert.*sbi\s*card/i,
      /sbi\s*card/i,
    ],
    queryKeywords: ['spent on your SBI Card', 'SBI Card ending', 'Available Credit Limit', 'sbicard'],
    amountRegexes: [
      /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+spent\s+on\s+your\s+sbi\s*card/i,
      /spent\s+on\s+your\s+sbi\s*card.*?(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    ],
    merchantRegexes: [
      /\bat\s+([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:on\s+\d|at\s+\d|\.|\bTotal\b|\bAvailable\b|\bIf\b|$))/i,
    ],
  },
  {
    id: 'sbi-bank',
    institutionId: 'sbi',
    displayName: 'State Bank of India',
    accountType: AccountType.BANK,
    senders: ['alerts@sbi.co.in', 'sbi.co.in', 'sbi.bank.in', 'alerts.sbi.bank.in'],
    subjectPatterns: [
      /sbi\s*debit\s*alert/i,
      /sbi\s*credit\s*alert/i,
      /transaction\s*alert.*a\/c/i,
    ],
    queryKeywords: ['debited by INR', 'credited by INR', 'ending with', 'transfer to UPI', 'Ref No'],
    merchantRegexes: [
      /(?:transfer\s+to|towards|to)\s+([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:on\s+\d|at\s+\d|\.|\bRef\b|\bBal\b|$))/i,
    ],
  },

  // ---------------------------------------------------------------------------
  // HDFC Bank & HDFC Cards
  // ---------------------------------------------------------------------------
  {
    id: 'hdfc-card',
    institutionId: 'hdfc',
    displayName: 'HDFC Bank',
    accountType: AccountType.CREDIT_CARD,
    senders: ['alerts@hdfcbank.net', 'alerts@hdfcbank.com', 'hdfcbank.net', 'hdfcbank.com', 'hdfc.bank.in'],
    subjectPatterns: [
      /alert:\s*update\s+on\s+your\s+hdfc\s+bank\s+credit\s+card/i,
      /transaction\s+alert.*hdfc\s+bank\s+credit\s+card/i,
      /pixel\s*card\s*transaction\s*alert/i,
      /pixel\s*play/i,
    ],
    queryKeywords: ['spent on your HDFC Bank Credit Card', 'spent on your Card', 'Credit Card ending', 'Pixel', 'Available Limit'],
    merchantRegexes: [
      /\bat\s+([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:on\s+\d|at\s+\d|\.|\bAvailable\b|\bTotal\b|\bRef\b|$))/i,
      /Info:\s*([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:Avail|Bal|\.|$))/i,
    ],
  },
  {
    id: 'hdfc-bank',
    institutionId: 'hdfc',
    displayName: 'HDFC Bank',
    accountType: AccountType.BANK,
    senders: ['alerts@hdfcbank.net', 'alerts@hdfcbank.com', 'hdfcbank.net', 'hdfcbank.com', 'hdfc.bank.in'],
    subjectPatterns: [
      /alert:\s*update\s+on\s+your\s+hdfc\s+bank\s+account/i,
      /debit\s+alert.*hdfc\s+bank\s+a\/c/i,
      /credit\s+alert.*hdfc\s+bank\s+a\/c/i,
    ],
    queryKeywords: ['debited from HDFC Bank A/c', 'credited to HDFC Bank A/c', 'Info:', 'UPI', 'NEFT', 'IMPS'],
    merchantRegexes: [
      /Info:\s*([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:Avail|Bal|\.|$))/i,
      /(?:towards|to)\s+([a-zA-Z0-9\s._\-&@\/]{2,45}?)(?=\s+(?:on\s+\d|at\s+\d|\.|\bRef\b|$))/i,
    ],
  },

  // ---------------------------------------------------------------------------
  // Kotak Mahindra Bank
  // ---------------------------------------------------------------------------
  {
    id: 'kotak-bank',
    institutionId: 'kotak',
    displayName: 'Kotak Mahindra Bank',
    accountType: AccountType.BANK,
    senders: ['alerts@kotak.com', 'kotak.com', 'kotak.bank.in'],
    subjectPatterns: [
      /kotak\s*bank\s*alert/i,
      /transaction\s*alert.*kotak/i,
    ],
    queryKeywords: ['debited from Kotak', 'spent on Kotak Card', 'Account', 'UPI', 'NEFT'],
  },

  // ---------------------------------------------------------------------------
  // IDFC First Bank
  // ---------------------------------------------------------------------------
  {
    id: 'idfc-bank',
    institutionId: 'idfc',
    displayName: 'IDFC First Bank',
    accountType: AccountType.BANK,
    senders: ['alerts@idfcfirstbank.com', 'idfcfirstbank.com'],
    subjectPatterns: [
      /idfc\s*first\s*bank/i,
      /transaction\s*alert.*idfc/i,
    ],
    queryKeywords: ['IDFC First Bank', 'debited', 'credited'],
  },

  // ---------------------------------------------------------------------------
  // Punjab National Bank (PNB)
  // ---------------------------------------------------------------------------
  {
    id: 'pnb-bank',
    institutionId: 'pnb',
    displayName: 'Punjab National Bank',
    accountType: AccountType.BANK,
    senders: ['alerts@pnb.co.in', 'pnb.co.in', 'pnbindia.in', 'pnb.bank.in'],
    subjectPatterns: [
      /pnb\s*debit\s*alert/i,
      /pnb\s*transaction\s*alert/i,
    ],
    queryKeywords: ['PNB A/C', 'debited', 'credited', 'UPI', 'NEFT'],
  },

  // ---------------------------------------------------------------------------
  // American Express
  // ---------------------------------------------------------------------------
  {
    id: 'amex-card',
    institutionId: 'amex',
    displayName: 'American Express',
    accountType: AccountType.CREDIT_CARD,
    senders: ['AmericanExpress@welcome.aexp.com', 'americanexpress.com', 'aexp.com'],
    subjectPatterns: [
      /transaction\s*alert.*american\s*express/i,
      /amex\s*card\s*alert/i,
    ],
    queryKeywords: ['spent on your American Express Card', 'Card ending', 'Membership Rewards'],
  },

  // ---------------------------------------------------------------------------
  // Investment Platforms & AMCs (Groww, Zerodha, CAMS, KFintech, MF Central)
  // ---------------------------------------------------------------------------
  {
    id: 'cams-kfin-sip',
    institutionId: 'groww',
    displayName: 'Mutual Fund',
    accountType: AccountType.MUTUAL_FUND,
    senders: [
      'donotreply@camsonline.com',
      'corporateservices@kfintech.com',
      'alerts@groww.in',
      'donotreply@zerodha.com',
      'camsonline.com',
      'kfintech.com',
      'mfcentral.com',
      'groww.in',
      'zerodha.com',
      'sbimf.com',
      'hdfcfund.com',
      'icicipruamc.com',
      'axismf.com',
      'miraeasset.com',
      'nipponindiamf.com',
      'ppfas.com',
    ],
    subjectPatterns: [
      /sip\s*(?:installment|debit|processed|transaction)/i,
      /mutual\s*fund\s*(?:purchase|allotment|confirmation)/i,
      /units\s*allotted/i,
      /groww.*order/i,
      /zerodha\s*coin/i,
    ],
    queryKeywords: ['SIP', 'Mutual Fund', 'Folio', 'allotted', 'NAV', 'units', 'Groww', 'Zerodha', 'Coin'],
    defaultCategoryName: 'Mutual Fund SIP',
  },
];

/**
 * Finds matching institution email configuration by sender address, subject, or context.
 * Resolves disambiguation between card and bank accounts for shared sender domains.
 */
export function findEmailConfigForSender(fromOrContext?: string | null, fullContext?: string | null): InstitutionEmailConfig | null {
  if (!fromOrContext && !fullContext) return null;
  const targetStr = `${fromOrContext || ''} ${fullContext || ''}`.toLowerCase().trim();

  // Check whether context suggests a Credit Card vs Bank Account vs Investment
  const isCreditCard = EMAIL_ALERT_PATTERNS.EXPLICIT_CREDIT_CARD_REGEX.test(targetStr);
  const isBankAccount = EMAIL_ALERT_PATTERNS.EXPLICIT_BANK_ACCOUNT_REGEX.test(targetStr);
  const isInvestment = EMAIL_ALERT_PATTERNS.EXPLICIT_INVESTMENT_REGEX.test(targetStr);

  // 1. Exact sender match with account-type affinity
  for (const config of INSTITUTION_EMAIL_CONFIGS) {
    const senderMatched = config.senders.some((s) => targetStr.includes(s.toLowerCase()));
    if (senderMatched) {
      if (isInvestment && config.accountType === AccountType.MUTUAL_FUND) return config;
      if (isCreditCard && !isBankAccount && config.accountType === AccountType.CREDIT_CARD) return config;
      if (isBankAccount && config.accountType === AccountType.BANK) return config;
      if (!isCreditCard && !isInvestment && config.accountType === AccountType.BANK) return config;
      if (isCreditCard && config.accountType === AccountType.CREDIT_CARD) return config;
    }
  }

  // 2. Sender match fallback
  for (const config of INSTITUTION_EMAIL_CONFIGS) {
    if (config.senders.some((s) => targetStr.includes(s.toLowerCase()))) {
      return config;
    }
  }

  // 3. Subject pattern match
  for (const config of INSTITUTION_EMAIL_CONFIGS) {
    if (config.subjectPatterns?.some((p) => p.test(targetStr))) {
      return config;
    }
  }

  return null;
}

/**
 * Resolves all applicable email configurations for a list of candidate user accounts.
 */
export function getEmailConfigsForAccounts(accounts: Array<{ institution?: string | null; name?: string | null; type?: string }>): InstitutionEmailConfig[] {
  if (!accounts || accounts.length === 0) return INSTITUTION_EMAIL_CONFIGS;

  const matchedConfigIds = new Set<string>();

  for (const acc of accounts) {
    const instStr = (acc.institution || '').toLowerCase();
    const nameStr = (acc.name || '').toLowerCase();
    const isCard = acc.type === AccountType.CREDIT_CARD;
    const isBank = [AccountType.BANK, AccountType.SAVINGS, AccountType.CASH].includes(acc.type as any);
    const isInvest = acc.type === AccountType.MUTUAL_FUND || acc.type === AccountType.STOCKS || nameStr.includes('groww') || nameStr.includes('zerodha') || nameStr.includes('sip');

    for (const config of INSTITUTION_EMAIL_CONFIGS) {
      const instMatches = instStr.includes(config.institutionId) || nameStr.includes(config.institutionId);

      if (config.id === 'axis-card' && (instStr.includes('axis') || nameStr.includes('axis') || nameStr.includes('flipkart') || nameStr.includes('neo') || nameStr.includes('rewards')) && isCard) {
        matchedConfigIds.add(config.id);
      } else if (config.id === 'axis-bank' && (instStr.includes('axis') || nameStr.includes('axis')) && isBank) {
        matchedConfigIds.add(config.id);
      } else if (config.id === 'icici-card' && (instStr.includes('icici') || nameStr.includes('icici') || nameStr.includes('amazon')) && isCard) {
        matchedConfigIds.add(config.id);
      } else if (config.id === 'icici-bank' && (instStr.includes('icici') || nameStr.includes('icici')) && isBank) {
        matchedConfigIds.add(config.id);
      } else if (config.id === 'sbi-card' && (instStr.includes('sbi') || nameStr.includes('sbi') || instStr.includes('state bank') || nameStr.includes('state bank')) && isCard) {
        matchedConfigIds.add(config.id);
      } else if (config.id === 'sbi-bank' && (instStr.includes('sbi') || nameStr.includes('sbi') || instStr.includes('state bank') || nameStr.includes('state bank')) && isBank) {
        matchedConfigIds.add(config.id);
      } else if (config.id === 'hdfc-card' && (instStr.includes('hdfc') || nameStr.includes('hdfc') || nameStr.includes('pixel')) && isCard) {
        matchedConfigIds.add(config.id);
      } else if (config.id === 'hdfc-bank' && (instStr.includes('hdfc') || nameStr.includes('hdfc')) && isBank) {
        matchedConfigIds.add(config.id);
      } else if (config.id === 'cams-kfin-sip' && isInvest) {
        matchedConfigIds.add(config.id);
      } else if (instMatches && config.accountType === (acc.type as any)) {
        matchedConfigIds.add(config.id);
      }
    }
  }

  const result = INSTITUTION_EMAIL_CONFIGS.filter((c) => matchedConfigIds.has(c.id));
  return result.length > 0 ? result : INSTITUTION_EMAIL_CONFIGS;
}
