/**
 * Centralized Institution & Brand Registry (Web).
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
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    domain: 'icicibank.com',
    aliases: ['icici', 'icici bank', 'icicibank', 'amazon pay icici'],
    localLogo: '/logos/icici.png',
    defaultType: 'BANK',
  },
  {
    id: 'sbi',
    name: 'State Bank of India',
    domain: 'onlinesbi.sbi',
    aliases: ['sbi', 'state bank of india', 'state bank', 'sbicard', 'sbi card'],
    localLogo: '/logos/sbi.png',
    defaultType: 'SAVINGS',
  },
  {
    id: 'axis',
    name: 'Axis Bank',
    domain: 'axisbank.com',
    aliases: ['axis', 'axis bank', 'axisbank'],
    localLogo: '/logos/axis.png',
    defaultType: 'BANK',
  },
  {
    id: 'pnb',
    name: 'Punjab National Bank',
    domain: 'pnbindia.in',
    aliases: ['pnb', 'punjab national bank', 'punjab national'],
    localLogo: '/logos/pnb.jpeg',
    defaultType: 'SAVINGS',
  },
  {
    id: 'kotak',
    name: 'Kotak Mahindra Bank',
    domain: 'kotak.com',
    aliases: ['kotak', 'kotak mahindra', 'kotak bank'],
    defaultType: 'BANK',
  },
  {
    id: 'idfc',
    name: 'IDFC First Bank',
    domain: 'idfcfirstbank.com',
    aliases: ['idfc', 'idfc first', 'idfc first bank'],
    defaultType: 'BANK',
  },
  {
    id: 'indusind',
    name: 'IndusInd Bank',
    domain: 'indusind.com',
    aliases: ['indusind', 'indusind bank'],
    defaultType: 'BANK',
  },
  {
    id: 'rbl',
    name: 'RBL Bank',
    domain: 'rblbank.com',
    aliases: ['rbl', 'rbl bank', 'ratnakar'],
    defaultType: 'BANK',
  },
  {
    id: 'yesbank',
    name: 'Yes Bank',
    domain: 'yesbank.in',
    aliases: ['yes bank', 'yesbank'],
    defaultType: 'BANK',
  },
  {
    id: 'amex',
    name: 'American Express',
    domain: 'americanexpress.com',
    aliases: ['amex', 'american express'],
    defaultType: 'CREDIT_CARD',
  },
  {
    id: 'scb',
    name: 'Standard Chartered',
    domain: 'sc.com',
    aliases: ['standard chartered', 'scb', 'stan chart'],
    defaultType: 'BANK',
  },
  {
    id: 'citi',
    name: 'Citi',
    domain: 'citibank.com',
    aliases: ['citi', 'citibank'],
    defaultType: 'BANK',
  },
  {
    id: 'canara',
    name: 'Canara Bank',
    domain: 'canarabank.com',
    aliases: ['canara', 'canara bank'],
    defaultType: 'SAVINGS',
  },
  {
    id: 'bob',
    name: 'Bank of Baroda',
    domain: 'bankofbaroda.in',
    aliases: ['bob', 'bank of baroda', 'baroda'],
    defaultType: 'SAVINGS',
  },
  {
    id: 'federal',
    name: 'Federal Bank',
    domain: 'federalbank.co.in',
    aliases: ['federal', 'federal bank'],
    defaultType: 'BANK',
  },
  {
    id: 'zerodha',
    name: 'Zerodha',
    domain: 'zerodha.com',
    aliases: ['zerodha', 'kite', 'coin'],
    localLogo: '/logos/zerodha.png',
    defaultType: 'STOCKS',
  },
  {
    id: 'groww',
    name: 'Groww',
    domain: 'groww.in',
    aliases: ['groww'],
    localLogo: '/logos/groww.jpeg',
    defaultType: 'INVESTMENT',
  },
  {
    id: 'upstox',
    name: 'Upstox',
    domain: 'upstox.com',
    aliases: ['upstox', 'rksv'],
    defaultType: 'STOCKS',
  },
  {
    id: 'epfo',
    name: 'Employees Provident Fund',
    domain: 'epfindia.gov.in',
    aliases: ['epfo', 'provident fund', 'epf', 'pf'],
    localLogo: '/logos/epfo.png',
    defaultType: 'EPFO',
  },
  {
    id: 'cred',
    name: 'CRED',
    domain: 'cred.club',
    aliases: ['cred', 'cred club'],
    defaultType: 'CREDIT_CARD',
  },
  {
    id: 'amazon',
    name: 'Amazon Pay',
    domain: 'amazon.in',
    aliases: ['amazon', 'amazon pay', 'aplus'],
    defaultType: 'CREDIT_CARD',
  },
];

export function findInstitution(query?: string | null): InstitutionDefinition | null {
  if (!query || typeof query !== 'string') return null;
  const q = query.toLowerCase().trim();

  for (const inst of INSTITUTIONS) {
    if (inst.id === q || inst.name.toLowerCase() === q) return inst;
  }

  for (const inst of INSTITUTIONS) {
    if (inst.aliases.some((alias) => q.includes(alias.toLowerCase()))) {
      return inst;
    }
  }

  for (const inst of INSTITUTIONS) {
    if (q.includes(inst.domain.toLowerCase())) return inst;
    if (inst.senderDomains?.some((sDomain) => q.includes(sDomain.toLowerCase()))) {
      return inst;
    }
  }

  return null;
}

export function getDomainForInstitution(name: string | null): string {
  const inst = findInstitution(name);
  return inst ? inst.domain : 'bank.com';
}

export function getLocalLogo(institution: string | null, name: string): string | null {
  const combined = `${institution || ''} ${name}`.trim();
  const inst = findInstitution(combined);
  return inst?.localLogo ?? null;
}

export function getInstitutionName(query?: string | null): string {
  const inst = findInstitution(query);
  return inst ? inst.name : (query || 'Bank');
}
