/**
 * Centralized Institution & Brand Registry.
 * Provides canonical metadata, domains, logos, aliases, and detection helpers.
 */

export interface InstitutionDefinition {
  id: string;
  name: string;
  domain: string;
  aliases: string[];
  localLogo?: string;
  defaultType?: 'BANK' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'STOCKS' | 'EPFO' | 'LOAN';
  senderDomains?: string[];
}

export const INSTITUTIONS: InstitutionDefinition[] = [
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    domain: 'hdfcbank.com',
    aliases: ['hdfc', 'hdfc bank', 'hdfcbank', 'pixel play'],
    localLogo: '/logos/hdfc.png',
    defaultType: 'BANK',
    senderDomains: ['hdfcbank.net', 'hdfcbank.com'],
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    domain: 'icicibank.com',
    aliases: ['icici', 'icici bank', 'icicibank', 'amazon pay icici'],
    localLogo: '/logos/icici.png',
    defaultType: 'BANK',
    senderDomains: ['icicibank.com', 'icici.bank.in'],
  },
  {
    id: 'sbi',
    name: 'State Bank of India',
    domain: 'onlinesbi.sbi',
    aliases: ['sbi', 'state bank of india', 'state bank', 'sbicard', 'sbi card'],
    localLogo: '/logos/sbi.png',
    defaultType: 'SAVINGS',
    senderDomains: ['sbi.co.in', 'sbicard.com'],
  },
  {
    id: 'axis',
    name: 'Axis Bank',
    domain: 'axisbank.com',
    aliases: ['axis', 'axis bank', 'axisbank'],
    localLogo: '/logos/axis.png',
    defaultType: 'BANK',
    senderDomains: ['axisbank.com'],
  },
  {
    id: 'pnb',
    name: 'Punjab National Bank',
    domain: 'pnbindia.in',
    aliases: ['pnb', 'punjab national bank', 'punjab national'],
    localLogo: '/logos/pnb.jpeg',
    defaultType: 'SAVINGS',
    senderDomains: ['pnb.co.in', 'pnbindia.in'],
  },
  {
    id: 'kotak',
    name: 'Kotak Mahindra Bank',
    domain: 'kotak.com',
    aliases: ['kotak', 'kotak mahindra', 'kotak bank'],
    defaultType: 'BANK',
    senderDomains: ['kotak.com'],
  },
  {
    id: 'idfc',
    name: 'IDFC First Bank',
    domain: 'idfcfirstbank.com',
    aliases: ['idfc', 'idfc first', 'idfc first bank'],
    defaultType: 'BANK',
    senderDomains: ['idfcfirstbank.com'],
  },
  {
    id: 'indusind',
    name: 'IndusInd Bank',
    domain: 'indusind.com',
    aliases: ['indusind', 'indusind bank'],
    defaultType: 'BANK',
    senderDomains: ['indusind.com'],
  },
  {
    id: 'rbl',
    name: 'RBL Bank',
    domain: 'rblbank.com',
    aliases: ['rbl', 'rbl bank', 'ratnakar'],
    defaultType: 'BANK',
    senderDomains: ['rblbank.com'],
  },
  {
    id: 'yesbank',
    name: 'Yes Bank',
    domain: 'yesbank.in',
    aliases: ['yes bank', 'yesbank'],
    defaultType: 'BANK',
    senderDomains: ['yesbank.in'],
  },
  {
    id: 'amex',
    name: 'American Express',
    domain: 'americanexpress.com',
    aliases: ['amex', 'american express'],
    defaultType: 'CREDIT_CARD',
    senderDomains: ['americanexpress.com', 'aexp.com'],
  },
  {
    id: 'scb',
    name: 'Standard Chartered',
    domain: 'sc.com',
    aliases: ['standard chartered', 'scb', 'stan chart'],
    defaultType: 'BANK',
    senderDomains: ['sc.com'],
  },
  {
    id: 'citi',
    name: 'Citi',
    domain: 'citibank.com',
    aliases: ['citi', 'citibank'],
    defaultType: 'BANK',
    senderDomains: ['citi.com', 'citibank.com'],
  },
  {
    id: 'canara',
    name: 'Canara Bank',
    domain: 'canarabank.com',
    aliases: ['canara', 'canara bank'],
    defaultType: 'SAVINGS',
    senderDomains: ['canarabank.com'],
  },
  {
    id: 'bob',
    name: 'Bank of Baroda',
    domain: 'bankofbaroda.in',
    aliases: ['bob', 'bank of baroda', 'baroda'],
    defaultType: 'SAVINGS',
    senderDomains: ['bankofbaroda.com', 'bankofbaroda.in'],
  },
  {
    id: 'federal',
    name: 'Federal Bank',
    domain: 'federalbank.co.in',
    aliases: ['federal', 'federal bank'],
    defaultType: 'BANK',
    senderDomains: ['federalbank.co.in'],
  },
  {
    id: 'zerodha',
    name: 'Zerodha',
    domain: 'zerodha.com',
    aliases: ['zerodha', 'kite', 'coin'],
    localLogo: '/logos/zerodha.png',
    defaultType: 'STOCKS',
    senderDomains: ['zerodha.com'],
  },
  {
    id: 'groww',
    name: 'Groww',
    domain: 'groww.in',
    aliases: ['groww'],
    localLogo: '/logos/groww.jpeg',
    defaultType: 'INVESTMENT',
    senderDomains: ['groww.in'],
  },
  {
    id: 'upstox',
    name: 'Upstox',
    domain: 'upstox.com',
    aliases: ['upstox', 'rksv'],
    defaultType: 'STOCKS',
    senderDomains: ['upstox.com'],
  },
  {
    id: 'epfo',
    name: 'Employees Provident Fund',
    domain: 'epfindia.gov.in',
    aliases: ['epfo', 'provident fund', 'epf', 'pf'],
    localLogo: '/logos/epfo.png',
    defaultType: 'EPFO',
    senderDomains: ['epfindia.gov.in'],
  },
  {
    id: 'cred',
    name: 'CRED',
    domain: 'cred.club',
    aliases: ['cred', 'cred club'],
    defaultType: 'CREDIT_CARD',
    senderDomains: ['cred.club'],
  },
  {
    id: 'amazon',
    name: 'Amazon Pay',
    domain: 'amazon.in',
    aliases: ['amazon', 'amazon pay', 'aplus'],
    defaultType: 'CREDIT_CARD',
    senderDomains: ['amazon.in', 'amazon.com'],
  },
];

export function findInstitution(query?: string | null): InstitutionDefinition | null {
  if (!query || typeof query !== 'string') return null;
  const q = query.toLowerCase().trim();

  // 1. Direct ID / Exact name match
  for (const inst of INSTITUTIONS) {
    if (inst.id === q || inst.name.toLowerCase() === q) return inst;
  }

  // 2. Alias match
  for (const inst of INSTITUTIONS) {
    if (inst.aliases.some((alias) => q.includes(alias.toLowerCase()))) {
      return inst;
    }
  }

  // 3. Domain match
  for (const inst of INSTITUTIONS) {
    if (q.includes(inst.domain.toLowerCase())) return inst;
    if (inst.senderDomains?.some((sDomain) => q.includes(sDomain.toLowerCase()))) {
      return inst;
    }
  }

  return null;
}

export function getInstitutionDomain(query?: string | null): string {
  const inst = findInstitution(query);
  return inst ? inst.domain : 'bank.com';
}

export function getInstitutionLocalLogo(query?: string | null): string | null {
  const inst = findInstitution(query);
  return inst?.localLogo ?? null;
}

export function getInstitutionName(query?: string | null): string {
  const inst = findInstitution(query);
  return inst ? inst.name : (query || 'Bank');
}
