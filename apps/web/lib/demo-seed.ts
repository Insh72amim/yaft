import { AccountType, CategoryType } from '@yaft/shared';

export enum TransactionKind {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  INVESTMENT = 'INVESTMENT',
  TRANSFER = 'TRANSFER',
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface DemoSuperCategory {
  id: string;
  name: string;
  type: CategoryType | string;
  icon: string;
  color: string;
  isSystem: boolean;
}

export interface DemoCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  superCategoryId: string;
  isSystem: boolean;
}

export interface DemoCategoryRule {
  id: string;
  name?: string | null;
  pattern: string;
  isRegex: boolean;
  categoryId: string;
  priority: number;
}

export interface DemoTag {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string | null;
  budgetLimit: number | null; // In Rupees (Major units)
  keywords: string[];
}

export interface DemoEmailReference {
  id: string;
  subject: string;
  fromAddress: string;
  receivedAt: string;
  snippet: string;
  rawBody: string | null;
}

export interface DemoTransaction {
  id: string;
  accountId: string;
  postedAt: string;
  description: string;
  merchant: string | null;
  category: string;
  categoryId: string | null;
  categoryVerified: boolean;
  amount: number; // Minor units (paise), negative = debit, positive = credit
  balance?: number | null; // Minor units (paise)
  kind: TransactionKind;
  notes?: string | null;
  transferPairId?: string | null;
  transferAccountId?: string | null;
  tagIds: string[];
  emailReference?: DemoEmailReference | null;
}

export interface DemoHolding {
  id: string;
  accountId: string;
  symbol: string;
  isin: string;
  name: string;
  assetClass: string;
  sector: string | null;
  marketCap: string | null;
  quantity: string;
  averagePrice: number; // Minor units (paise)
  previousClosingPrice: number; // Minor units (paise)
  currentValue: number; // Minor units (paise)
  unrealizedPnl: number; // Minor units (paise)
  unrealizedPnlPct: string;
}

export interface DemoSip {
  id: string;
  accountId: string;
  schemeName: string;
  isin: string | null;
  folioNumber: string | null;
  amount: number; // Minor units (paise)
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  sipDay: number | null;
  startDate: string;
  nextInstallmentDate: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  autoPayAccount: string | null;
  notes: string | null;
}

export interface DemoInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  principalAmount?: number; // Minor units
  interestAmount?: number; // Minor units
  totalAmount?: number; // Minor units (for loan)
  amount?: number; // Minor units (for RD)
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  paidAt: string | null;
  transactionId: string | null;
}

export interface DemoLoanData {
  id: string;
  principalAmount: number;
  interestRate: string;
  tenureMonths: number;
  emiAmount: number;
  emiDueDay: number;
  startDate: string;
  sourceAccountId: string | null;
  installments: DemoInstallment[];
}

export interface DemoRdData {
  id: string;
  installmentAmount: number;
  interestRate: string | null;
  tenureMonths: number;
  installmentDay: number;
  startDate: string;
  maturityDate: string | null;
  maturityAmount: number | null;
  sourceAccountId: string | null;
  autoConfirm: boolean;
  installments: DemoInstallment[];
}

export interface DemoAccountDocument {
  id: string;
  accountId: string;
  name: string;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';
  byteSize: number;
  createdAt: string;
  dataUrl?: string;
}

export interface DemoAccount {
  id: string;
  name: string;
  institution: string | null;
  type: AccountType;
  currency: string;
  balance: number; // Minor units (paise)
  openingBalance: number; // Minor units (paise)
  creditLimit: number | null; // Minor units (paise)
  statementDay: number | null;
  dueDay: number | null;
  parentAccountId: string | null;
  cardLast4: string | null;
  cardNetwork: string | null;
  hasSavedStatementPassword: boolean;
  emailSyncEnabled: boolean;
  vaultLast4?: string | null;
  vaultIfsc?: string | null;
  vaultUpiId?: string | null;
}

export interface DemoVaultEntry {
  accountId: string;
  accountNumber: string;
  customerId: string;
  ifsc: string;
  upiId: string;
  branch: string;
  nominee: string;
  registeredMobile: string;
  registeredEmail: string;
  statementPassword: string;
  notes: string;
  customFields: { label: string; value: string; secret?: boolean }[];
  updatedAt: string;
}

export interface DemoBudgetItem {
  id: string;
  categoryId: string;
  month: number;
  year: number;
  amount: number; // Major units (Rupees)
}

export interface DemoOrganization {
  id: string;
  name: string;
  employeeId: string | null;
  pfNumber: string | null;
  uan: string | null;
  pan: string | null;
  bankAccount: string | null;
  designation: string | null;
  department: string | null;
  location: string | null;
  dateOfJoining: string | null;
  parsingConfig: any;
}

export interface DemoSalaryLineItem {
  id: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  currentAmount: number; // Minor units (paise)
  ytdAmount: number | null; // Minor units (paise)
}

export interface DemoSalaryStatement {
  id: string;
  organizationId: string;
  organizationName: string;
  payPeriod: string;
  grossEarnings: number; // Minor units (paise)
  grossDeductions: number; // Minor units (paise)
  netPay: number; // Minor units (paise)
  paidDays: number | null;
  lopDays: number | null;
  regime: string | null;
  sourceFileName: string | null;
  hasFile: boolean;
  status: string;
  createdAt: string;
  lineItems: DemoSalaryLineItem[];
  transactionId: string | null;
}

export interface DemoImportReviewRow {
  id: string;
  postedAt: string;
  description: string;
  amount: number; // Minor units (paise)
  balance: number | null;
  kind: TransactionKind;
  category: string;
  status: 'NEW' | 'DUPLICATE' | 'CONFLICT' | 'EXCLUDED';
  duplicateReason?: string | null;
  existingTransaction?: {
    id: string;
    postedAt: string;
    description: string;
    amount: number;
    category: string;
    balance?: number | null;
  } | null;
}

export interface DemoPendingImport {
  id: string;
  kind: 'STATEMENT' | 'SALARY';
  status: string;
  fileName: string;
  institution: string;
  createdAt: string;
  accountId: string | null;
  accountName: string | null;
  accountType: string | null;
  organizationId: string | null;
  organizationName: string | null;
  payPeriod: string | null;
  netPay: number | null;
  grossEarnings: number | null;
  grossDeductions: number | null;
  paidDays: number | null;
  lopDays: number | null;
  lineItems: DemoSalaryLineItem[];
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  conflictRows: number;
  openingBalance?: number | null;
  closingBalance?: number | null;
  statementStart?: string | null;
  statementEnd?: string | null;
  rows?: DemoImportReviewRow[];
}

export interface DemoImportHistoryItem {
  id: string;
  kind: 'STATEMENT' | 'SALARY';
  status: 'COMMITTED' | 'DISCARDED';
  fileName: string;
  institution: string;
  createdAt: string;
  committedAt: string | null;
  accountId: string | null;
  accountName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  payPeriod: string | null;
  netPay: number | null;
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  conflictRows: number;
}

export interface DemoState {
  version: number;
  seedId: string;
  generatedAt: string;
  user: DemoUser;
  superCategories: DemoSuperCategory[];
  categories: DemoCategory[];
  categoryRules: DemoCategoryRule[];
  tags: DemoTag[];
  accounts: DemoAccount[];
  vaults: Record<string, DemoVaultEntry>;
  holdings: DemoHolding[];
  sips: DemoSip[];
  loans: Record<string, DemoLoanData>;
  rds: Record<string, DemoRdData>;
  documents: Record<string, DemoAccountDocument[]>;
  transactions: DemoTransaction[];
  budgets: DemoBudgetItem[];
  organizations: DemoOrganization[];
  salaryStatements: DemoSalaryStatement[];
  pendingImports: DemoPendingImport[];
  importHistory: DemoImportHistoryItem[];
  emailAccounts: {
    id: string;
    email: string;
    lastSyncedAt: string | null;
    createdAt: string;
  }[];
  emailLogs: {
    id: string;
    messageId: string;
    subject: string | null;
    fromAddress: string | null;
    receivedAt: string | null;
    status: string;
    reason: string | null;
    processedAt: string;
  }[];
  driveConfig: {
    configured: boolean;
    connected: boolean;
    email: string | null;
    backupFrequency: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    lastBackupAt: string | null;
  };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function roundTo100Paise(paise: number): number {
  return Math.round(paise / 100) * 100;
}

export function generateRandomDemoState(): DemoState {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const personas = [
    { name: 'Aarav Sharma', email: 'aarav.demo@yaft.local' },
    { name: 'Diya Nair', email: 'diya.demo@yaft.local' },
    { name: 'Rohan Verma', email: 'rohan.demo@yaft.local' },
    { name: 'Ananya Iyer', email: 'ananya.demo@yaft.local' },
    { name: 'Vikram Malhotra', email: 'vikram.demo@yaft.local' },
    { name: 'Kabir Kulkarni', email: 'kabir.demo@yaft.local' },
  ];
  const chosenPersona = pick(personas);

  // 1. Super Categories & Categories
  const superCategories: DemoSuperCategory[] = [
    { id: 'sc-expense', name: 'Expense', type: CategoryType.EXPENSE, icon: 'Receipt', color: '#ef4444', isSystem: true },
    { id: 'sc-income', name: 'Income', type: CategoryType.INCOME, icon: 'TrendingUp', color: '#16a34a', isSystem: true },
    { id: 'sc-investment', name: 'Investment', type: CategoryType.INVESTMENT, icon: 'PiggyBank', color: '#6366f1', isSystem: true },
    { id: 'sc-transfer', name: 'Internal Transfer', type: CategoryType.TRANSFER, icon: 'ArrowLeftRight', color: '#64748b', isSystem: true },
    { id: 'sc-others', name: 'Others', type: CategoryType.OTHER, icon: 'Folder', color: '#d97706', isSystem: true },
  ];

  const categories: DemoCategory[] = [
    { id: 'cat-food', name: 'Food & Dining', icon: 'Utensils', color: '#f97316', superCategoryId: 'sc-expense', isSystem: true },
    { id: 'cat-groceries', name: 'Groceries', icon: 'ShoppingBasket', color: '#10b981', superCategoryId: 'sc-expense', isSystem: true },
    { id: 'cat-shopping', name: 'Shopping & Lifestyle', icon: 'ShoppingBag', color: '#ec4899', superCategoryId: 'sc-expense', isSystem: true },
    { id: 'cat-transport', name: 'Transport & Fuel', icon: 'Car', color: '#3b82f6', superCategoryId: 'sc-expense', isSystem: true },
    { id: 'cat-bills', name: 'Bills & Utilities', icon: 'Zap', color: '#8b5cf6', superCategoryId: 'sc-expense', isSystem: true },
    { id: 'cat-housing', name: 'Housing & Rent', icon: 'Home', color: '#f59e0b', superCategoryId: 'sc-expense', isSystem: true },
    { id: 'cat-entertainment', name: 'Entertainment & OTT', icon: 'Film', color: '#06b6d4', superCategoryId: 'sc-expense', isSystem: true },
    { id: 'cat-health', name: 'Medical & Fitness', icon: 'HeartPulse', color: '#ef4444', superCategoryId: 'sc-expense', isSystem: true },
    { id: 'cat-travel', name: 'Travel & Vacations', icon: 'Plane', color: '#14b8a6', superCategoryId: 'sc-expense', isSystem: true },
    { id: 'cat-salary', name: 'Salary', icon: 'Briefcase', color: '#16a34a', superCategoryId: 'sc-income', isSystem: true },
    { id: 'cat-interest', name: 'Interest & Dividends', icon: 'Coins', color: '#22c55e', superCategoryId: 'sc-income', isSystem: true },
    { id: 'cat-cashback', name: 'Cashback & Refunds', icon: 'Sparkles', color: '#84cc16', superCategoryId: 'sc-income', isSystem: true },
    { id: 'cat-sip', name: 'Mutual Fund SIP', icon: 'LineChart', color: '#6366f1', superCategoryId: 'sc-investment', isSystem: true },
    { id: 'cat-stocks', name: 'Stock Investments', icon: 'CandlestickChart', color: '#4f46e5', superCategoryId: 'sc-investment', isSystem: true },
    { id: 'cat-epfo', name: 'EPFO Contribution', icon: 'Landmark', color: '#0ea5e9', superCategoryId: 'sc-investment', isSystem: true },
    { id: 'cat-deposits', name: 'Fixed & Recurring Deposits', icon: 'Vault', color: '#0284c7', superCategoryId: 'sc-investment', isSystem: true },
    { id: 'cat-cc-transfer', name: 'CC Bill Payment', icon: 'CreditCard', color: '#64748b', superCategoryId: 'sc-transfer', isSystem: true },
    { id: 'cat-self-transfer', name: 'Self Transfer', icon: 'ArrowLeftRight', color: '#94a3b8', superCategoryId: 'sc-transfer', isSystem: true },
    { id: 'cat-emi', name: 'Loan EMI', icon: 'CalendarClock', color: '#d97706', superCategoryId: 'sc-others', isSystem: true },
  ];

  const categoryRules: DemoCategoryRule[] = [
    { id: 'rule-1', name: 'Food Delivery', pattern: 'SWIGGY|ZOMATO|STARBUCKS|THIRD WAVE|BLUE TOKAI', isRegex: true, categoryId: 'cat-food', priority: 10 },
    { id: 'rule-2', name: 'Quick Commerce & Groceries', pattern: 'BLINKIT|ZEPTO|INSTAMART|BIGBASKET|DMART', isRegex: true, categoryId: 'cat-groceries', priority: 10 },
    { id: 'rule-3', name: 'Cabs & Fuel', pattern: 'UBER|OLA|RAPIDO|SHELL|INDIAN OIL|HPCL|BPCL', isRegex: true, categoryId: 'cat-transport', priority: 9 },
    { id: 'rule-4', name: 'Online Shopping', pattern: 'AMAZON|FLIPKART|MYNTRA|AJIO|NYKAA|DECATHLON', isRegex: true, categoryId: 'cat-shopping', priority: 8 },
    { id: 'rule-5', name: 'Utilities & Broadband', pattern: 'BESCOM|AIRTEL|JIOFIBER|ACT FIBERNET|TATA PLAY', isRegex: true, categoryId: 'cat-bills', priority: 8 },
    { id: 'rule-6', name: 'Streaming & Cloud', pattern: 'NETFLIX|SPOTIFY|APPLE\\.COM|YOUTUBE|PRIME VIDEO', isRegex: true, categoryId: 'cat-entertainment', priority: 7 },
    { id: 'rule-7', name: 'Investments & Clearing', pattern: 'INDIAN CLEARING CORP|GROWW|ZERODHA BROKING', isRegex: true, categoryId: 'cat-sip', priority: 10 },
    { id: 'rule-8', name: 'Credit Card Settlements', pattern: 'CRED CLUB|BILLDESK.*CARD|CC BILL PAYMENT', isRegex: true, categoryId: 'cat-cc-transfer', priority: 10 },
    { id: 'rule-9', name: 'Employer Salary', pattern: 'ACME TECHNOLOGIES.*SALARY', isRegex: true, categoryId: 'cat-salary', priority: 15 },
  ];

  // 2. Tags
  const tags: DemoTag[] = [
    {
      id: 'tag-goa',
      name: 'Goa Getaway',
      color: '#0ea5e9',
      icon: 'Palmtree',
      description: 'Flights, beach resort stay, and coastal dining in North Goa',
      budgetLimit: 45000,
      keywords: ['INDIGO', 'TAJ FORT AGUADA', 'THALASSA', 'GOA'],
    },
    {
      id: 'tag-festive',
      name: 'Festive Shopping',
      color: '#f59e0b',
      icon: 'Sparkles',
      description: 'Family gifts, festive ethnic wear, and home decor',
      budgetLimit: 35000,
      keywords: ['MANYAVAR', 'FABINDIA', 'TANISHQ', 'GIFT'],
    },
    {
      id: 'tag-setup',
      name: 'Home Office Upgrade',
      color: '#8b5cf6',
      icon: 'Laptop',
      description: 'Ergonomic chair, 4K monitor, and desk accessories',
      budgetLimit: 60000,
      keywords: ['LG MONITOR', 'KEYCHRON', 'FEATHERLITE', 'LOGITECH'],
    },
  ];

  // 3. Holdings & SIPs (Randomized prices & quantities)
  const mfHoldings: DemoHolding[] = [
    {
      id: 'hold-mf-1',
      accountId: 'acc-mf-groww',
      symbol: 'PPFAS-FLEXI',
      isin: 'INF879O01027',
      name: 'Parag Parikh Flexi Cap Fund Direct Growth',
      assetClass: 'EQUITY',
      sector: 'Diversified',
      marketCap: 'Flexi Cap',
      quantity: (randInt(420, 680) + 0.452).toFixed(3),
      averagePrice: randInt(5800, 6600),
      previousClosingPrice: randInt(8200, 9100),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
    {
      id: 'hold-mf-2',
      accountId: 'acc-mf-groww',
      symbol: 'MO-MIDCAP',
      isin: 'INF247L01445',
      name: 'Motilal Oswal Midcap Fund Direct Growth',
      assetClass: 'EQUITY',
      sector: 'Diversified',
      marketCap: 'Mid Cap',
      quantity: (randInt(280, 460) + 0.819).toFixed(3),
      averagePrice: randInt(7200, 8100),
      previousClosingPrice: randInt(9800, 11200),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
    {
      id: 'hold-mf-3',
      accountId: 'acc-mf-groww',
      symbol: 'SBI-SMALLCAP',
      isin: 'INF200K01T51',
      name: 'SBI Small Cap Fund Direct Growth',
      assetClass: 'EQUITY',
      sector: 'Diversified',
      marketCap: 'Small Cap',
      quantity: (randInt(160, 290) + 0.125).toFixed(3),
      averagePrice: randInt(13500, 15200),
      previousClosingPrice: randInt(17800, 19600),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
    {
      id: 'hold-mf-4',
      accountId: 'acc-mf-groww',
      symbol: 'NIPPON-LARGECAP',
      isin: 'INF204K01XI3',
      name: 'Nippon India Large Cap Fund Direct Growth',
      assetClass: 'EQUITY',
      sector: 'Diversified',
      marketCap: 'Large Cap',
      quantity: (randInt(350, 550) + 0.634).toFixed(3),
      averagePrice: randInt(6900, 7600),
      previousClosingPrice: randInt(8900, 9700),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
    {
      id: 'hold-mf-5',
      accountId: 'acc-mf-groww',
      symbol: 'HDFC-BALANCED',
      isin: 'INF179K01WA6',
      name: 'HDFC Balanced Advantage Fund Direct Growth',
      assetClass: 'HYBRID',
      sector: 'Hybrid',
      marketCap: 'Large Cap',
      quantity: (randInt(220, 380) + 0.308).toFixed(3),
      averagePrice: randInt(4100, 4600),
      previousClosingPrice: randInt(5100, 5600),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
  ];

  const stockHoldings: DemoHolding[] = [
    {
      id: 'hold-stk-1',
      accountId: 'acc-stocks-zerodha',
      symbol: 'RELIANCE',
      isin: 'INE002A01018',
      name: 'Reliance Industries Ltd',
      assetClass: 'EQUITY',
      sector: 'Energy & Telecom',
      marketCap: 'Large Cap',
      quantity: String(randInt(45, 95)),
      averagePrice: randInt(118000, 129000),
      previousClosingPrice: randInt(136000, 148000),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
    {
      id: 'hold-stk-2',
      accountId: 'acc-stocks-zerodha',
      symbol: 'TCS',
      isin: 'INE467B01029',
      name: 'Tata Consultancy Services Ltd',
      assetClass: 'EQUITY',
      sector: 'Information Technology',
      marketCap: 'Large Cap',
      quantity: String(randInt(25, 55)),
      averagePrice: randInt(345000, 372000),
      previousClosingPrice: randInt(398000, 426000),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
    {
      id: 'hold-stk-3',
      accountId: 'acc-stocks-zerodha',
      symbol: 'HDFCBANK',
      isin: 'INE040A01034',
      name: 'HDFC Bank Ltd',
      assetClass: 'EQUITY',
      sector: 'Financial Services',
      marketCap: 'Large Cap',
      quantity: String(randInt(60, 130)),
      averagePrice: randInt(149000, 161000),
      previousClosingPrice: randInt(174000, 186000),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
    {
      id: 'hold-stk-4',
      accountId: 'acc-stocks-zerodha',
      symbol: 'INFY',
      isin: 'INE009A01021',
      name: 'Infosys Ltd',
      assetClass: 'EQUITY',
      sector: 'Information Technology',
      marketCap: 'Large Cap',
      quantity: String(randInt(40, 85)),
      averagePrice: randInt(148000, 162000),
      previousClosingPrice: randInt(179000, 194000),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
    {
      id: 'hold-stk-5',
      accountId: 'acc-stocks-zerodha',
      symbol: 'ICICIBANK',
      isin: 'INE090A01021',
      name: 'ICICI Bank Ltd',
      assetClass: 'EQUITY',
      sector: 'Financial Services',
      marketCap: 'Large Cap',
      quantity: String(randInt(50, 110)),
      averagePrice: randInt(98000, 112000),
      previousClosingPrice: randInt(126000, 138000),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
    {
      id: 'hold-stk-6',
      accountId: 'acc-stocks-zerodha',
      symbol: 'TATAMOTORS',
      isin: 'INE155A01022',
      name: 'Tata Motors Ltd',
      assetClass: 'EQUITY',
      sector: 'Automobile',
      marketCap: 'Large Cap',
      quantity: String(randInt(55, 120)),
      averagePrice: randInt(69000, 78000),
      previousClosingPrice: randInt(84000, 96000),
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: '0',
    },
  ];

  const allHoldings = [...mfHoldings, ...stockHoldings].map((h) => {
    const qty = parseFloat(h.quantity);
    const invested = Math.round(qty * h.averagePrice);
    const current = Math.round(qty * h.previousClosingPrice);
    const pnl = current - invested;
    const pct = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : '0.00';
    return {
      ...h,
      currentValue: current,
      unrealizedPnl: pnl,
      unrealizedPnlPct: pct,
    };
  });

  const mfTotalBalance = allHoldings
    .filter((h) => h.accountId === 'acc-mf-groww')
    .reduce((acc, h) => acc + h.currentValue, 0);
  const stocksTotalBalance = allHoldings
    .filter((h) => h.accountId === 'acc-stocks-zerodha')
    .reduce((acc, h) => acc + h.currentValue, 0);

  const nextMonthDate = new Date(Date.UTC(currentYear, currentMonth + 1, 5)).toISOString();
  const sips: DemoSip[] = [
    {
      id: 'sip-1',
      accountId: 'acc-mf-groww',
      schemeName: 'Parag Parikh Flexi Cap Fund Direct Growth',
      isin: 'INF879O01027',
      folioNumber: '10000001/01',
      amount: 2500000, // ₹25,000
      frequency: 'MONTHLY',
      sipDay: 5,
      startDate: new Date(Date.UTC(currentYear - 1, 3, 5)).toISOString(),
      nextInstallmentDate: nextMonthDate,
      status: 'ACTIVE',
      autoPayAccount: 'HDFC Bank Salary Account',
      notes: 'Core long-term equity SIP via NACH mandate',
    },
    {
      id: 'sip-2',
      accountId: 'acc-mf-groww',
      schemeName: 'Motilal Oswal Midcap Fund Direct Growth',
      isin: 'INF247L01445',
      folioNumber: '10000002/02',
      amount: 1500000, // ₹15,000
      frequency: 'MONTHLY',
      sipDay: 10,
      startDate: new Date(Date.UTC(currentYear - 1, 5, 10)).toISOString(),
      nextInstallmentDate: new Date(Date.UTC(currentYear, currentMonth + 1, 10)).toISOString(),
      status: 'ACTIVE',
      autoPayAccount: 'HDFC Bank Salary Account',
      notes: 'Midcap growth allocation',
    },
    {
      id: 'sip-3',
      accountId: 'acc-mf-groww',
      schemeName: 'SBI Small Cap Fund Direct Growth',
      isin: 'INF200K01T51',
      folioNumber: '10000003/03',
      amount: 1000000, // ₹10,000
      frequency: 'MONTHLY',
      sipDay: 15,
      startDate: new Date(Date.UTC(currentYear - 1, 7, 15)).toISOString(),
      nextInstallmentDate: new Date(Date.UTC(currentYear, currentMonth + 1, 15)).toISOString(),
      status: 'ACTIVE',
      autoPayAccount: 'Axis Bank Priority Savings',
      notes: 'Satellite small-cap allocation',
    },
  ];

  // 4. Recurring Deposit & Loan Schedules
  const rdInstallmentAmount = 1500000; // ₹15,000/month
  const rdInstallments: DemoInstallment[] = [];
  let rdPaidCount = 0;
  for (let i = 0; i < 12; i++) {
    const due = new Date(Date.UTC(currentYear, currentMonth - 8 + i, 12));
    const isPast = i < 8;
    const isCurrentPending = i === 8;
    if (isPast) rdPaidCount++;
    rdInstallments.push({
      id: `rd-inst-${i + 1}`,
      installmentNumber: i + 1,
      dueDate: due.toISOString(),
      amount: rdInstallmentAmount,
      status: isPast ? 'PAID' : isCurrentPending ? 'OVERDUE' : 'PENDING',
      paidAt: isPast ? due.toISOString() : null,
      transactionId: null,
    });
  }

  const rds: Record<string, DemoRdData> = {
    'acc-rd-axis': {
      id: 'rd-axis-1',
      installmentAmount: rdInstallmentAmount,
      interestRate: '7.10',
      tenureMonths: 12,
      installmentDay: 12,
      startDate: new Date(Date.UTC(currentYear, currentMonth - 8, 12)).toISOString(),
      maturityDate: new Date(Date.UTC(currentYear, currentMonth + 4, 12)).toISOString(),
      maturityAmount: 18685000,
      sourceAccountId: 'acc-axis-savings',
      autoConfirm: true,
      installments: rdInstallments,
    },
  };

  const loanPrincipal = 90000000; // ₹9,00,000
  const loanEmi = 2851500; // ₹28,515
  const loanInstallments: DemoInstallment[] = [];
  for (let i = 0; i < 24; i++) {
    const due = new Date(Date.UTC(currentYear, currentMonth - 7 + i, 7));
    const isPaid = i < 7;
    const interestPart = Math.max(400000, Math.round(650000 - i * 18000));
    const principalPart = loanEmi - interestPart;
    loanInstallments.push({
      id: `loan-inst-${i + 1}`,
      installmentNumber: i + 1,
      dueDate: due.toISOString(),
      principalAmount: principalPart,
      interestAmount: interestPart,
      totalAmount: loanEmi,
      status: isPaid ? 'PAID' : 'PENDING',
      paidAt: isPaid ? due.toISOString() : null,
      transactionId: null,
    });
  }

  const loans: Record<string, DemoLoanData> = {
    'acc-loan-hdfc': {
      id: 'loan-hdfc-1',
      principalAmount: loanPrincipal,
      interestRate: '8.75',
      tenureMonths: 36,
      emiAmount: loanEmi,
      emiDueDay: 7,
      startDate: new Date(Date.UTC(currentYear, currentMonth - 7, 7)).toISOString(),
      sourceAccountId: 'acc-hdfc-salary',
      installments: loanInstallments,
    },
  };

  // 5. Accounts
  const hdfcOpening = randInt(210000, 340000) * 100;
  const axisOpening = randInt(140000, 220000) * 100;
  const sbiOpening = randInt(85000, 150000) * 100;
  const epfoOpening = randInt(780000, 1150000) * 100;
  const fdBalance = randInt(35, 55) * 10000 * 100; // ₹3.5L - ₹5.5L

  const accounts: DemoAccount[] = [
    {
      id: 'acc-hdfc-salary',
      name: 'HDFC Bank Salary Account',
      institution: 'HDFC Bank',
      type: AccountType.BANK,
      currency: 'INR',
      balance: hdfcOpening,
      openingBalance: hdfcOpening,
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      parentAccountId: null,
      cardLast4: null,
      cardNetwork: null,
      hasSavedStatementPassword: true,
      emailSyncEnabled: true,
      vaultLast4: '0001',
      vaultIfsc: 'HDFC0000001',
      vaultUpiId: 'aarav.hdfc@okhdfcbank',
    },
    {
      id: 'acc-axis-savings',
      name: 'Axis Bank Priority Savings',
      institution: 'Axis Bank',
      type: AccountType.SAVINGS,
      currency: 'INR',
      balance: axisOpening,
      openingBalance: axisOpening,
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      parentAccountId: null,
      cardLast4: null,
      cardNetwork: null,
      hasSavedStatementPassword: true,
      emailSyncEnabled: true,
      vaultLast4: '0002',
      vaultIfsc: 'UTIB0000001',
      vaultUpiId: 'aarav.axis@okaxis',
    },
    {
      id: 'acc-sbi-savings',
      name: 'State Bank of India Savings',
      institution: 'State Bank of India',
      type: AccountType.SAVINGS,
      currency: 'INR',
      balance: sbiOpening,
      openingBalance: sbiOpening,
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      parentAccountId: null,
      cardLast4: null,
      cardNetwork: null,
      hasSavedStatementPassword: false,
      emailSyncEnabled: false,
      vaultLast4: '0003',
      vaultIfsc: 'SBIN0000001',
      vaultUpiId: 'aarav.sbi@oksbi',
    },
    {
      id: 'acc-cc-infinia',
      name: 'HDFC Regalia Gold Credit Card',
      institution: 'HDFC Bank',
      type: AccountType.CREDIT_CARD,
      currency: 'INR',
      balance: 0,
      openingBalance: 0,
      creditLimit: 60000000, // ₹6,00,000
      statementDay: 18,
      dueDay: 5,
      parentAccountId: null,
      cardLast4: '0001',
      cardNetwork: 'VISA',
      hasSavedStatementPassword: true,
      emailSyncEnabled: true,
      vaultLast4: '0001',
    },
    {
      id: 'acc-cc-tata',
      name: 'HDFC Tata Neu Infinity RuPay',
      institution: 'HDFC Bank',
      type: AccountType.CREDIT_CARD,
      currency: 'INR',
      balance: 0,
      openingBalance: 0,
      creditLimit: 60000000,
      statementDay: 18,
      dueDay: 5,
      parentAccountId: 'acc-cc-infinia',
      cardLast4: '0002',
      cardNetwork: 'RUPAY',
      hasSavedStatementPassword: false,
      emailSyncEnabled: true,
      vaultLast4: '0002',
    },
    {
      id: 'acc-cc-axis',
      name: 'Axis Atlas Credit Card',
      institution: 'Axis Bank',
      type: AccountType.CREDIT_CARD,
      currency: 'INR',
      balance: 0,
      openingBalance: 0,
      creditLimit: 45000000, // ₹4,50,000
      statementDay: 12,
      dueDay: 2,
      parentAccountId: null,
      cardLast4: '0003',
      cardNetwork: 'VISA',
      hasSavedStatementPassword: true,
      emailSyncEnabled: true,
      vaultLast4: '0003',
    },
    {
      id: 'acc-cc-icici',
      name: 'ICICI Amazon Pay Credit Card',
      institution: 'ICICI Bank',
      type: AccountType.CREDIT_CARD,
      currency: 'INR',
      balance: 0,
      openingBalance: 0,
      creditLimit: 30000000, // ₹3,00,000
      statementDay: 25,
      dueDay: 12,
      parentAccountId: null,
      cardLast4: '0004',
      cardNetwork: 'VISA',
      hasSavedStatementPassword: false,
      emailSyncEnabled: true,
      vaultLast4: '0004',
    },
    {
      id: 'acc-mf-groww',
      name: 'Groww Direct Mutual Funds',
      institution: 'Groww',
      type: AccountType.MUTUAL_FUND,
      currency: 'INR',
      balance: mfTotalBalance,
      openingBalance: mfTotalBalance,
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      parentAccountId: null,
      cardLast4: null,
      cardNetwork: null,
      hasSavedStatementPassword: false,
      emailSyncEnabled: true,
      vaultLast4: '2201',
    },
    {
      id: 'acc-stocks-zerodha',
      name: 'Zerodha Kite Equity Demat',
      institution: 'Zerodha',
      type: AccountType.STOCKS,
      currency: 'INR',
      balance: stocksTotalBalance,
      openingBalance: stocksTotalBalance,
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      parentAccountId: null,
      cardLast4: null,
      cardNetwork: null,
      hasSavedStatementPassword: false,
      emailSyncEnabled: true,
      vaultLast4: '8904',
    },
    {
      id: 'acc-epfo',
      name: 'EPFO Member Passbook',
      institution: 'Employees Provident Fund',
      type: AccountType.EPFO,
      currency: 'INR',
      balance: epfoOpening,
      openingBalance: epfoOpening,
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      parentAccountId: null,
      cardLast4: null,
      cardNetwork: null,
      hasSavedStatementPassword: false,
      emailSyncEnabled: false,
      vaultLast4: '1049',
    },
    {
      id: 'acc-fd-sbi',
      name: 'SBI Term Deposit (7.25% p.a.)',
      institution: 'State Bank of India',
      type: AccountType.FIXED_DEPOSIT,
      currency: 'INR',
      balance: fdBalance,
      openingBalance: fdBalance,
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      parentAccountId: null,
      cardLast4: null,
      cardNetwork: null,
      hasSavedStatementPassword: false,
      emailSyncEnabled: false,
      vaultLast4: '3910',
    },
    {
      id: 'acc-rd-axis',
      name: 'Axis 12M Recurring Deposit',
      institution: 'Axis Bank',
      type: AccountType.RECURRING_DEPOSIT,
      currency: 'INR',
      balance: rdPaidCount * rdInstallmentAmount,
      openingBalance: 0,
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      parentAccountId: null,
      cardLast4: null,
      cardNetwork: null,
      hasSavedStatementPassword: false,
      emailSyncEnabled: false,
      vaultLast4: '0005',
    },
    {
      id: 'acc-loan-hdfc',
      name: 'HDFC Car Loan (8.75%)',
      institution: 'HDFC Bank',
      type: AccountType.LOAN,
      currency: 'INR',
      balance: -74500000, // -₹7,45,000 remaining principal
      openingBalance: -loanPrincipal,
      creditLimit: null,
      statementDay: null,
      dueDay: 7,
      parentAccountId: null,
      cardLast4: null,
      cardNetwork: null,
      hasSavedStatementPassword: false,
      emailSyncEnabled: false,
      vaultLast4: '0006',
    },
  ];

  // 6. Generate 6 Months of Salary Statements & Transactions
  const organizations: DemoOrganization[] = [
    {
      id: 'org-acme',
      name: 'Acme Technologies India Pvt Ltd',
      employeeId: 'EMP-IN-4092',
      pfNumber: 'DL/CPM/0000000/000/0000001',
      uan: '100000000000',
      pan: 'ABCDE1234F',
      bankAccount: 'HDFC0000001 / XXXX0001',
      designation: 'Senior Staff Engineer',
      department: 'Platform Engineering',
      location: 'Bengaluru, KA',
      dateOfJoining: '2023-04-10T00:00:00.000Z',
      parsingConfig: {
        institutionName: 'Acme Technologies India Pvt Ltd',
        anchors: ['PAYSLIP FOR THE MONTH OF', 'EMP-IN-4092'],
        earningsKeywords: ['Basic Salary', 'House Rent Allowance', 'Special Allowance', 'Performance Bonus'],
        deductionsKeywords: ['Provident Fund', 'Income Tax (TDS)', 'Professional Tax'],
      },
    },
  ];

  const baseBasic = randInt(115, 145) * 1000 * 100; // ₹1.15L - ₹1.45L
  const baseHra = Math.round(baseBasic * 0.5);
  const baseSpecial = randInt(55, 85) * 1000 * 100;
  const pfDeduction = 2160000; // ₹21,600
  const profTax = 20000; // ₹200
  const tdsDeduction = randInt(32, 46) * 1000 * 100;

  const salaryStatements: DemoSalaryStatement[] = [];
  const transactions: DemoTransaction[] = [];
  let txCounter = 1;
  const nextTxId = () => `tx-demo-${txCounter++}`;

  const makeMonthDate = (
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    isCurrentMonth: boolean,
  ): Date => {
    if (!isCurrentMonth) {
      return new Date(Date.UTC(year, month, day, hour, minute, 0));
    }
    const maxDay = Math.max(1, now.getUTCDate());
    const scaledDay = maxDay >= 28 ? day : Math.max(1, Math.min(maxDay, Math.ceil((day / 28) * maxDay)));
    const candidate = new Date(Date.UTC(year, month, scaledDay, hour, minute, 0));
    if (candidate > now) {
      return new Date(now.getTime() - randInt(1, 18) * 3600 * 1000);
    }
    return candidate;
  };

  for (let mOffset = 5; mOffset >= 0; mOffset--) {
    const isCurrentMonth = mOffset === 0;
    const year = currentYear;
    const month = currentMonth - mOffset;
    const payDate = makeMonthDate(year, month, 1, 9, 30, isCurrentMonth);
    const payPeriodDate = new Date(Date.UTC(year, month, 1));
    const bonus = mOffset === 2 ? 4500000 : 0; // Festive bonus 2 months ago
    const grossEarnings = baseBasic + baseHra + baseSpecial + bonus;
    const grossDeductions = pfDeduction + profTax + tdsDeduction;
    const netPay = grossEarnings - grossDeductions;

    const salTxId = nextTxId();
    const stmtId = `sal-stmt-${6 - mOffset}`;
    const monthLabel = payPeriodDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

    const lineItems: DemoSalaryLineItem[] = [
      { id: `${stmtId}-li-1`, name: 'Basic Salary', type: 'EARNING', currentAmount: baseBasic, ytdAmount: baseBasic * (6 - mOffset) },
      { id: `${stmtId}-li-2`, name: 'House Rent Allowance (HRA)', type: 'EARNING', currentAmount: baseHra, ytdAmount: baseHra * (6 - mOffset) },
      { id: `${stmtId}-li-3`, name: 'Special Allowance', type: 'EARNING', currentAmount: baseSpecial, ytdAmount: baseSpecial * (6 - mOffset) },
      ...(bonus > 0
        ? [{ id: `${stmtId}-li-bonus`, name: 'Quarterly Performance Bonus', type: 'EARNING' as const, currentAmount: bonus, ytdAmount: bonus }]
        : []),
      { id: `${stmtId}-li-4`, name: 'Provident Fund (EPF)', type: 'DEDUCTION', currentAmount: pfDeduction, ytdAmount: pfDeduction * (6 - mOffset) },
      { id: `${stmtId}-li-5`, name: 'Income Tax (TDS)', type: 'DEDUCTION', currentAmount: tdsDeduction, ytdAmount: tdsDeduction * (6 - mOffset) },
      { id: `${stmtId}-li-6`, name: 'Professional Tax', type: 'DEDUCTION', currentAmount: profTax, ytdAmount: profTax * (6 - mOffset) },
    ];

    salaryStatements.push({
      id: stmtId,
      organizationId: 'org-acme',
      organizationName: 'Acme Technologies India Pvt Ltd',
      payPeriod: payPeriodDate.toISOString(),
      grossEarnings,
      grossDeductions,
      netPay,
      paidDays: 30,
      lopDays: 0,
      regime: 'NEW_REGIME',
      sourceFileName: `Acme_Payslip_${monthLabel.replace(/\s+/g, '_')}.pdf`,
      hasFile: true,
      status: 'COMMITTED',
      createdAt: payDate.toISOString(),
      lineItems,
      transactionId: salTxId,
    });

    // 1. External Inflows across all 3 Banks
    // 1a. Salary Credit Transaction in HDFC
    transactions.push({
      id: salTxId,
      accountId: 'acc-hdfc-salary',
      postedAt: payDate.toISOString(),
      description: `NEFT CR-ACME TECHNOLOGIES INDIA PVT LTD-SALARY ${monthLabel.toUpperCase()}`,
      merchant: 'Acme Technologies',
      category: 'Salary',
      categoryId: 'cat-salary',
      categoryVerified: true,
      amount: netPay,
      kind: TransactionKind.INCOME,
      tagIds: [],
      emailReference: {
        id: `email-${salTxId}`,
        subject: `Salary Credited: INR ${(netPay / 100).toLocaleString('en-IN')} in HDFC Bank A/c XX0001`,
        fromAddress: 'alerts@hdfcbank.net',
        receivedAt: payDate.toISOString(),
        snippet: `Dear Customer, INR ${(netPay / 100).toLocaleString('en-IN')} has been credited to your HDFC Bank A/c XX0001 via NEFT from ACME TECHNOLOGIES INDIA PVT LTD.`,
        rawBody: `<div style="font-family:sans-serif;padding:16px;border:1px solid #e2e8f0;border-radius:8px;">
          <h3 style="color:#004c8f;margin-top:0;">HDFC Bank InstaAlert</h3>
          <p>Dear Customer,</p>
          <p>Your A/c <strong>XX0001</strong> is credited with <strong>INR ${(netPay / 100).toLocaleString('en-IN')}</strong> on ${payDate.toISOString().slice(0, 10)} by NEFT from <strong>ACME TECHNOLOGIES INDIA PVT LTD (SALARY)</strong>.</p>
          <p style="color:#64748b;font-size:12px;">Ref No: HDFC${randInt(10000000, 99999999)}</p>
        </div>`,
      },
    });

    // 1b. Axis Bank External Inbound (Advisory / Dividend / Interest Credit)
    const axisInflowDate = makeMonthDate(year, month, 3, 10, 15, isCurrentMonth);
    const axisInflowAmt = roundTo100Paise(randInt(1850000, 2650000)); // ₹18,500 - ₹26,500
    transactions.push({
      id: nextTxId(),
      accountId: 'acc-axis-savings',
      postedAt: axisInflowDate.toISOString(),
      description: 'NEFT CR-NSDL DIVIDEND & ADVISORY PAYOUT-AXIS PRIORITY',
      merchant: 'Equity Dividend & Retainer',
      category: 'Interest & Dividends',
      categoryId: 'cat-interest',
      categoryVerified: true,
      amount: axisInflowAmt,
      kind: TransactionKind.INCOME,
      tagIds: [],
    });

    // 1c. SBI Savings External Inbound (FD Interest Payout & Rewards)
    const sbiInflowDate = makeMonthDate(year, month, 4, 11, 0, isCurrentMonth);
    const sbiInflowAmt = roundTo100Paise(randInt(680000, 1120000)); // ₹6,800 - ₹11,200
    transactions.push({
      id: nextTxId(),
      accountId: 'acc-sbi-savings',
      postedAt: sbiInflowDate.toISOString(),
      description: 'BULK CR-SBI TERM DEPOSIT INTEREST & TREASURY PAYOUT',
      merchant: 'SBI Treasury Interest',
      category: 'Interest & Dividends',
      categoryId: 'cat-interest',
      categoryVerified: true,
      amount: sbiInflowAmt,
      kind: TransactionKind.INCOME,
      tagIds: [],
    });

    // 2. Inter-Bank Self Transfers (HDFC Salary -> Axis Savings & HDFC Salary -> SBI Savings)
    const hdfcToAxisDate = makeMonthDate(year, month, 2, 10, 0, isCurrentMonth);
    const hdfcToAxisAmt = 4500000; // ₹45,000
    const hdfcToAxisPairId = `pair-ib-axis-${mOffset}`;
    transactions.push(
      {
        id: nextTxId(),
        accountId: 'acc-hdfc-salary',
        postedAt: hdfcToAxisDate.toISOString(),
        description: 'IMPS/DR/AXIS PRIORITY SAVINGS ALLOCATION/XX0002',
        merchant: 'Axis Bank Priority Savings',
        category: 'Self Transfer',
        categoryId: 'cat-self-transfer',
        categoryVerified: true,
        amount: -hdfcToAxisAmt,
        kind: TransactionKind.TRANSFER,
        transferPairId: hdfcToAxisPairId,
        transferAccountId: 'acc-axis-savings',
        tagIds: [],
      },
      {
        id: nextTxId(),
        accountId: 'acc-axis-savings',
        postedAt: hdfcToAxisDate.toISOString(),
        description: 'IMPS/CR/FROM HDFC SALARY A/C XX0001/SELF TRANSFER',
        merchant: 'HDFC Bank Salary Account',
        category: 'Self Transfer',
        categoryId: 'cat-self-transfer',
        categoryVerified: true,
        amount: hdfcToAxisAmt,
        kind: TransactionKind.TRANSFER,
        transferPairId: hdfcToAxisPairId,
        transferAccountId: 'acc-hdfc-salary',
        tagIds: [],
      },
    );

    const hdfcToSbiDate = makeMonthDate(year, month, 2, 10, 30, isCurrentMonth);
    const hdfcToSbiAmt = 2500000; // ₹25,000
    const hdfcToSbiPairId = `pair-ib-sbi-${mOffset}`;
    transactions.push(
      {
        id: nextTxId(),
        accountId: 'acc-hdfc-salary',
        postedAt: hdfcToSbiDate.toISOString(),
        description: 'NEFT/DR/SBI SAVINGS HOUSEHOLD & EQUITY POOL/XX0003',
        merchant: 'State Bank of India Savings',
        category: 'Self Transfer',
        categoryId: 'cat-self-transfer',
        categoryVerified: true,
        amount: -hdfcToSbiAmt,
        kind: TransactionKind.TRANSFER,
        transferPairId: hdfcToSbiPairId,
        transferAccountId: 'acc-sbi-savings',
        tagIds: [],
      },
      {
        id: nextTxId(),
        accountId: 'acc-sbi-savings',
        postedAt: hdfcToSbiDate.toISOString(),
        description: 'NEFT/CR/FROM HDFC SALARY A/C XX0001/SELF TRANSFER',
        merchant: 'HDFC Bank Salary Account',
        category: 'Self Transfer',
        categoryId: 'cat-self-transfer',
        categoryVerified: true,
        amount: hdfcToSbiAmt,
        kind: TransactionKind.TRANSFER,
        transferPairId: hdfcToSbiPairId,
        transferAccountId: 'acc-hdfc-salary',
        tagIds: [],
      },
    );

    // 3. EPFO Monthly Contribution
    const epfoDate = makeMonthDate(year, month, 15, 10, 0, isCurrentMonth);
    transactions.push({
      id: nextTxId(),
      accountId: 'acc-epfo',
      postedAt: epfoDate.toISOString(),
      description: `EPFO Monthly Contribution (Employee + Employer) - ${monthLabel}`,
      merchant: 'EPFO India',
      category: 'EPFO Contribution',
      categoryId: 'cat-epfo',
      categoryVerified: true,
      amount: pfDeduction * 2,
      kind: TransactionKind.INVESTMENT,
      tagIds: [],
    });

    // 4. House Rent (3rd of month from HDFC)
    const rentDate = makeMonthDate(year, month, 3, 11, 15, isCurrentMonth);
    transactions.push({
      id: nextTxId(),
      accountId: 'acc-hdfc-salary',
      postedAt: rentDate.toISOString(),
      description: 'UPI/DR/0000000000/LANDLORD LANDLORD APARTMENT/RENT',
      merchant: 'Apartment Rent',
      category: 'Housing & Rent',
      categoryId: 'cat-housing',
      categoryVerified: true,
      amount: -3800000, // -₹38,000
      kind: TransactionKind.EXPENSE,
      tagIds: [],
    });

    // 5. Investments across HDFC, Axis, and SBI
    const sip1Date = makeMonthDate(year, month, 5, 8, 30, isCurrentMonth);
    transactions.push({
      id: nextTxId(),
      accountId: 'acc-hdfc-salary',
      postedAt: sip1Date.toISOString(),
      description: 'ACH DR-INDIAN CLEARING CORP-GROWW PPFAS FLEXI CAP SIP',
      merchant: 'Groww Mutual Funds',
      category: 'Mutual Fund SIP',
      categoryId: 'cat-sip',
      categoryVerified: true,
      amount: -2500000,
      kind: TransactionKind.INVESTMENT,
      tagIds: [],
    });

    const sip2Date = makeMonthDate(year, month, 10, 8, 30, isCurrentMonth);
    transactions.push({
      id: nextTxId(),
      accountId: 'acc-hdfc-salary',
      postedAt: sip2Date.toISOString(),
      description: 'ACH DR-INDIAN CLEARING CORP-GROWW MOTILAL MIDCAP SIP',
      merchant: 'Groww Mutual Funds',
      category: 'Mutual Fund SIP',
      categoryId: 'cat-sip',
      categoryVerified: true,
      amount: -1500000,
      kind: TransactionKind.INVESTMENT,
      tagIds: [],
    });

    const sip3Date = makeMonthDate(year, month, 15, 8, 30, isCurrentMonth);
    transactions.push({
      id: nextTxId(),
      accountId: 'acc-axis-savings',
      postedAt: sip3Date.toISOString(),
      description: 'NACH-DR-ICCL GROWW SBI SMALL CAP SIP',
      merchant: 'Groww Mutual Funds',
      category: 'Mutual Fund SIP',
      categoryId: 'cat-sip',
      categoryVerified: true,
      amount: -1000000,
      kind: TransactionKind.INVESTMENT,
      tagIds: [],
    });

    // SBI Equity Investment via Zerodha
    const sbiStockDate = makeMonthDate(year, month, 11, 9, 45, isCurrentMonth);
    const sbiStockAmt = roundTo100Paise(randInt(1200000, 1650000)); // ₹12,000 - ₹16,500
    transactions.push({
      id: nextTxId(),
      accountId: 'acc-sbi-savings',
      postedAt: sbiStockDate.toISOString(),
      description: 'UPI/DR/ZERODHA BROKING LTD/EQUITY DEMAT TOPUP',
      merchant: 'Zerodha Broking',
      category: 'Stock Investments',
      categoryId: 'cat-stocks',
      categoryVerified: true,
      amount: -sbiStockAmt,
      kind: TransactionKind.INVESTMENT,
      tagIds: [],
    });

    // 6. Car Loan EMI (7th of month from HDFC)
    const emiDate = makeMonthDate(year, month, 7, 9, 0, isCurrentMonth);
    const emiTxId = nextTxId();
    transactions.push({
      id: emiTxId,
      accountId: 'acc-hdfc-salary',
      postedAt: emiDate.toISOString(),
      description: 'ACH DR-HDFC BANK AUTO LOAN EMI #0006',
      merchant: 'HDFC Car Loan',
      category: 'Loan EMI',
      categoryId: 'cat-emi',
      categoryVerified: true,
      amount: -loanEmi,
      kind: TransactionKind.EXPENSE,
      tagIds: [],
    });

    // 7. Recurring Deposit Installment (12th of month from Axis, except current month so it stays pending to test)
    const rdDate = makeMonthDate(year, month, 12, 9, 0, isCurrentMonth);
    if (mOffset > 0) {
      transactions.push({
        id: nextTxId(),
        accountId: 'acc-axis-savings',
        postedAt: rdDate.toISOString(),
        description: 'STANDING INSTRUCTION DR TO AXIS RD A/C XX0005',
        merchant: 'Axis Recurring Deposit',
        category: 'Fixed & Recurring Deposits',
        categoryId: 'cat-deposits',
        categoryVerified: true,
        amount: -rdInstallmentAmount,
        kind: TransactionKind.INVESTMENT,
        tagIds: [],
      });
    }

    // 8. Monthly Expenses across all 3 Banks & 4 Credit Cards
    const monthlyExpenseTemplates = [
      { day: 2, acc: 'acc-cc-infinia', desc: 'SWIGGY INSTAMART BENGALURU', merchant: 'Swiggy Instamart', cat: 'Groceries', catId: 'cat-groceries', min: 1150, max: 2600, tags: [] },
      { day: 4, acc: 'acc-cc-infinia', desc: 'ZOMATO LIMITED GURUGRAM', merchant: 'Zomato', cat: 'Food & Dining', catId: 'cat-food', min: 720, max: 1850, tags: [] },
      { day: 6, acc: 'acc-axis-savings', desc: 'UPI/DR/BLINKIT GROCERIES/gurgaon@axis', merchant: 'Blinkit', cat: 'Groceries', catId: 'cat-groceries', min: 1100, max: 2250, tags: [] },
      { day: 8, acc: 'acc-cc-icici', desc: 'AMAZON PAY INDIA PVT LTD BENGALURU', merchant: 'Amazon India', cat: 'Shopping & Lifestyle', catId: 'cat-shopping', min: 2199, max: 6999, tags: mOffset === 1 ? ['tag-setup'] : [] },
      { day: 9, acc: 'acc-hdfc-salary', desc: 'BBPS/BESCOM ELECTRICITY BILL BLR', merchant: 'BESCOM Electricity', cat: 'Bills & Utilities', catId: 'cat-bills', min: 2350, max: 3950, tags: [] },
      { day: 10, acc: 'acc-sbi-savings', desc: 'UPI/DR/DMART READY SUPERMARKET/dmart@sbi', merchant: 'DMart Ready', cat: 'Groceries', catId: 'cat-groceries', min: 2450, max: 3850, tags: [] },
      { day: 11, acc: 'acc-cc-tata', desc: 'BIGBASKET AVENUE SUPERMARTS BLR', merchant: 'BigBasket', cat: 'Groceries', catId: 'cat-groceries', min: 1800, max: 3600, tags: [] },
      { day: 13, acc: 'acc-cc-axis', desc: 'SHELL INDIA MARKETS FUEL STATION', merchant: 'Shell Fuel', cat: 'Transport & Fuel', catId: 'cat-transport', min: 2400, max: 4100, tags: [] },
      { day: 14, acc: 'acc-cc-infinia', desc: 'NETFLIX.COM MUMBAI SUBSCRIPTION', merchant: 'Netflix', cat: 'Entertainment & OTT', catId: 'cat-entertainment', min: 649, max: 649, tags: [] },
      { day: 15, acc: 'acc-hdfc-salary', desc: 'UPI/DR/THIRD WAVE COFFEE ROASTERS/twc@hdfcbank', merchant: 'Third Wave Coffee', cat: 'Food & Dining', catId: 'cat-food', min: 680, max: 1380, tags: [] },
      { day: 16, acc: 'acc-cc-axis', desc: 'MAKEMYTRIP INDIA PVT LTD GURUGRAM', merchant: 'MakeMyTrip', cat: 'Travel & Vacations', catId: 'cat-travel', min: 3200, max: 6800, tags: [] },
      { day: 17, acc: 'acc-axis-savings', desc: 'UPI/DR/AIRTEL BLACK FIBER/airtel@axis', merchant: 'Airtel Broadband', cat: 'Bills & Utilities', catId: 'cat-bills', min: 1768, max: 1768, tags: [] },
      { day: 18, acc: 'acc-axis-savings', desc: 'UPI/DR/NAMMA YATRI AUTO & CAB/ny@axis', merchant: 'Namma Yatri', cat: 'Transport & Fuel', catId: 'cat-transport', min: 780, max: 1490, tags: [] },
      { day: 19, acc: 'acc-cc-axis', desc: 'UBER INDIA SYSTEMS PVT LTD', merchant: 'Uber', cat: 'Transport & Fuel', catId: 'cat-transport', min: 880, max: 1750, tags: [] },
      { day: 20, acc: 'acc-sbi-savings', desc: 'UPI/DR/BOOKMYSHOW CINEMA & EVENTS/bms@sbi', merchant: 'BookMyShow', cat: 'Entertainment & OTT', catId: 'cat-entertainment', min: 850, max: 1650, tags: [] },
      { day: 21, acc: 'acc-cc-icici', desc: 'APOLLO PHARMACY & DIAGNOSTICS BLR', merchant: 'Apollo Pharmacy', cat: 'Medical & Fitness', catId: 'cat-health', min: 950, max: 2800, tags: [] },
      { day: 22, acc: 'acc-cc-infinia', desc: 'MYNTRA DESIGNS PVT LTD BENGALURU', merchant: 'Myntra', cat: 'Shopping & Lifestyle', catId: 'cat-shopping', min: 2250, max: 5400, tags: mOffset === 2 ? ['tag-festive'] : [] },
      { day: 24, acc: 'acc-cc-tata', desc: 'CROMA INFINITI RETAIL ELECTRONICS', merchant: 'Croma', cat: 'Shopping & Lifestyle', catId: 'cat-shopping', min: 2800, max: 8900, tags: mOffset === 0 ? ['tag-setup'] : [] },
      { day: 26, acc: 'acc-sbi-savings', desc: 'UPI/DR/CULT FIT GYM & WELLNESS', merchant: 'Cult.fit', cat: 'Medical & Fitness', catId: 'cat-health', min: 1850, max: 2450, tags: [] },
    ];

    for (const item of monthlyExpenseTemplates) {
      const txDate = makeMonthDate(year, month, item.day, 14, randInt(10, 55), isCurrentMonth);
      const amtPaise = -roundTo100Paise(randInt(item.min * 100, item.max * 100));
      const id = nextTxId();
      const hasEmail = mOffset <= 1 && (item.acc.startsWith('acc-cc') || item.acc === 'acc-hdfc-salary');
      transactions.push({
        id,
        accountId: item.acc,
        postedAt: txDate.toISOString(),
        description: item.desc,
        merchant: item.merchant,
        category: item.cat,
        categoryId: item.catId,
        categoryVerified: mOffset > 0 || item.day < 15,
        amount: amtPaise,
        kind: TransactionKind.EXPENSE,
        tagIds: item.tags,
        emailReference: hasEmail
          ? {
              id: `email-${id}`,
              subject: `Transaction Alert: INR ${(Math.abs(amtPaise) / 100).toFixed(2)} spent at ${item.merchant}`,
              fromAddress: item.acc.includes('axis') ? 'alerts@axisbank.com' : item.acc.includes('icici') ? 'care@icicibank.com' : 'alerts@hdfcbank.net',
              receivedAt: txDate.toISOString(),
              snippet: `INR ${(Math.abs(amtPaise) / 100).toFixed(2)} was spent on your card/account at ${item.merchant} on ${txDate.toISOString().slice(0, 10)}.`,
              rawBody: `<div style="font-family:sans-serif;padding:16px;border:1px solid #e2e8f0;border-radius:8px;">
                <h4 style="margin-top:0;">Instant Transaction Alert</h4>
                <p>Thank you for using your card/account for <strong>INR ${(Math.abs(amtPaise) / 100).toFixed(2)}</strong> at <strong>${item.merchant}</strong> on ${txDate.toUTCString()}.</p>
              </div>`,
            }
          : null,
      });
    }

    // Add Goa Trip tagged expenses 1 month ago
    if (mOffset === 1) {
      const goaDate1 = new Date(Date.UTC(year, month, 18, 10, 20, 0));
      const goaDate2 = new Date(Date.UTC(year, month, 19, 16, 40, 0));
      transactions.push(
        {
          id: nextTxId(),
          accountId: 'acc-cc-axis',
          postedAt: goaDate1.toISOString(),
          description: 'INDIGO AIRLINES BLR-GOI ROUNDTRIP',
          merchant: 'IndiGo Airlines',
          category: 'Travel & Vacations',
          categoryId: 'cat-travel',
          categoryVerified: true,
          amount: -1480000,
          kind: TransactionKind.EXPENSE,
          tagIds: ['tag-goa'],
        },
        {
          id: nextTxId(),
          accountId: 'acc-cc-infinia',
          postedAt: goaDate2.toISOString(),
          description: 'TAJ FORT AGUADA RESORT GOA STAY',
          merchant: 'Taj Fort Aguada Goa',
          category: 'Travel & Vacations',
          categoryId: 'cat-travel',
          categoryVerified: true,
          amount: -2450000,
          kind: TransactionKind.EXPENSE,
          tagIds: ['tag-goa'],
        },
      );
    }

    // 9. Credit Card Bill Settlements across HDFC, Axis, and SBI
    // 9a. HDFC Bank -> HDFC Regalia Gold Credit Card (Linked transfer)
    const hdfcCcBillDate = makeMonthDate(year, month, 5, 12, 0, isCurrentMonth);
    const hdfcBillAmt = roundTo100Paise(randInt(2600000, 3600000));
    const hdfcCcPairId = `pair-cc-hdfc-${mOffset}`;
    transactions.push(
      {
        id: nextTxId(),
        accountId: 'acc-hdfc-salary',
        postedAt: hdfcCcBillDate.toISOString(),
        description: 'CRED CLUB CC BILL PAYMENT HDFC REGALIA XX0001',
        merchant: 'CRED Club (HDFC Regalia)',
        category: 'CC Bill Payment',
        categoryId: 'cat-cc-transfer',
        categoryVerified: true,
        amount: -hdfcBillAmt,
        kind: TransactionKind.TRANSFER,
        transferPairId: hdfcCcPairId,
        transferAccountId: 'acc-cc-infinia',
        tagIds: [],
      },
      {
        id: nextTxId(),
        accountId: 'acc-cc-infinia',
        postedAt: hdfcCcBillDate.toISOString(),
        description: 'NEFT PAYMENT RECEIVED VIA CRED THANK YOU',
        merchant: 'CRED Payment',
        category: 'CC Bill Payment',
        categoryId: 'cat-cc-transfer',
        categoryVerified: true,
        amount: hdfcBillAmt,
        kind: TransactionKind.TRANSFER,
        transferPairId: hdfcCcPairId,
        transferAccountId: 'acc-hdfc-salary',
        tagIds: [],
      },
    );

    // 9b. Axis Bank -> Axis Atlas Credit Card (Linked transfer)
    const axisCcBillDate = makeMonthDate(year, month, 6, 15, 0, isCurrentMonth);
    const axisBillAmt = roundTo100Paise(randInt(1650000, 2350000));
    const axisCcPairId = `pair-cc-axis-${mOffset}`;
    transactions.push(
      {
        id: nextTxId(),
        accountId: 'acc-axis-savings',
        postedAt: axisCcBillDate.toISOString(),
        description: 'BILLDESK PG AXIS ATLAS CC BILL SETTLEMENT XX0003',
        merchant: 'Axis Atlas Card Bill',
        category: 'CC Bill Payment',
        categoryId: 'cat-cc-transfer',
        categoryVerified: true,
        amount: -axisBillAmt,
        kind: TransactionKind.TRANSFER,
        transferPairId: axisCcPairId,
        transferAccountId: 'acc-cc-axis',
        tagIds: [],
      },
      {
        id: nextTxId(),
        accountId: 'acc-cc-axis',
        postedAt: axisCcBillDate.toISOString(),
        description: 'ONLINE PAYMENT RECEIVED AXIS ATLAS CARD THANK YOU',
        merchant: 'Axis Card Payment',
        category: 'CC Bill Payment',
        categoryId: 'cat-cc-transfer',
        categoryVerified: true,
        amount: axisBillAmt,
        kind: TransactionKind.TRANSFER,
        transferPairId: axisCcPairId,
        transferAccountId: 'acc-axis-savings',
        tagIds: [],
      },
    );

    // 9c. SBI Savings -> ICICI Amazon Pay Credit Card (Linked in past months, unlinked in current month so user can test /transfers/suggestions!)
    const sbiCcBillDate = makeMonthDate(year, month, 8, 16, 30, isCurrentMonth);
    const sbiBillAmt = roundTo100Paise(randInt(780000, 1180000));
    const isSbiCcLinked = mOffset > 0;
    const sbiCcPairId = isSbiCcLinked ? `pair-cc-icici-${mOffset}` : null;
    transactions.push(
      {
        id: nextTxId(),
        accountId: 'acc-sbi-savings',
        postedAt: sbiCcBillDate.toISOString(),
        description: 'BBPS CC BILL PAYMENT ICICI AMAZON PAY XX0004',
        merchant: 'ICICI Amazon Pay Card Bill',
        category: 'CC Bill Payment',
        categoryId: 'cat-cc-transfer',
        categoryVerified: isSbiCcLinked,
        amount: -sbiBillAmt,
        kind: isSbiCcLinked ? TransactionKind.TRANSFER : TransactionKind.EXPENSE,
        transferPairId: sbiCcPairId,
        transferAccountId: isSbiCcLinked ? 'acc-cc-icici' : null,
        tagIds: [],
      },
      {
        id: nextTxId(),
        accountId: 'acc-cc-icici',
        postedAt: sbiCcBillDate.toISOString(),
        description: 'BBPS PAYMENT RECEIVED ICICI AMAZON PAY CARD',
        merchant: 'BBPS Card Payment',
        category: 'CC Bill Payment',
        categoryId: 'cat-cc-transfer',
        categoryVerified: isSbiCcLinked,
        amount: sbiBillAmt,
        kind: isSbiCcLinked ? TransactionKind.TRANSFER : TransactionKind.INCOME,
        transferPairId: sbiCcPairId,
        transferAccountId: isSbiCcLinked ? 'acc-sbi-savings' : null,
        tagIds: [],
      },
    );
  }

  // Sort transactions chronologically to compute running balances per account
  transactions.sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const runningBalances = new Map<string, number>();
  for (const acc of accounts) {
    runningBalances.set(acc.id, acc.openingBalance || 0);
  }
  for (const tx of transactions) {
    const prev = runningBalances.get(tx.accountId) ?? 0;
    const next = prev + tx.amount;
    tx.balance = next;
    runningBalances.set(tx.accountId, next);
  }
  for (const acc of accounts) {
    if (
      acc.type === AccountType.BANK ||
      acc.type === AccountType.SAVINGS ||
      acc.type === AccountType.CREDIT_CARD ||
      acc.type === AccountType.EPFO
    ) {
      acc.balance = runningBalances.get(acc.id) ?? acc.balance;
    }
  }

  // Sort transactions newest first for default display
  transactions.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

  // 7. Monthly Category Budgets (in Rupees / Major units)
  const currentMonth1Based = currentMonth + 1;
  const budgets: DemoBudgetItem[] = [
    { id: 'b-1', categoryId: 'cat-housing', month: currentMonth1Based, year: currentYear, amount: 40000 },
    { id: 'b-2', categoryId: 'cat-food', month: currentMonth1Based, year: currentYear, amount: 12000 },
    { id: 'b-3', categoryId: 'cat-groceries', month: currentMonth1Based, year: currentYear, amount: 15000 },
    { id: 'b-4', categoryId: 'cat-shopping', month: currentMonth1Based, year: currentYear, amount: 20000 },
    { id: 'b-5', categoryId: 'cat-transport', month: currentMonth1Based, year: currentYear, amount: 8000 },
    { id: 'b-6', categoryId: 'cat-bills', month: currentMonth1Based, year: currentYear, amount: 7500 },
    { id: 'b-7', categoryId: 'cat-entertainment', month: currentMonth1Based, year: currentYear, amount: 3000 },
    { id: 'b-8', categoryId: 'cat-health', month: currentMonth1Based, year: currentYear, amount: 6000 },
  ];

  // 8. Vault Entries
  const vaults: Record<string, DemoVaultEntry> = {
    'acc-hdfc-salary': {
      accountId: 'acc-hdfc-salary',
      accountNumber: '50100000000001',
      customerId: '10000001',
      ifsc: 'HDFC0000001',
      upiId: 'aarav.hdfc@okhdfcbank',
      branch: 'Main Branch, Mumbai',
      nominee: 'Sample Nominee',
      registeredMobile: '+91 98000 00000',
      registeredEmail: chosenPersona.email,
      statementPassword: 'PASS1234',
      notes: 'Primary salary account with Imperia banking privileges and zero forex markup debit card.',
      customFields: [
        { label: 'Relationship Manager', value: 'Bank Officer (+91 22 0000 0000)', secret: false },
        { label: 'NetBanking TPIN', value: '123456', secret: true },
      ],
      updatedAt: now.toISOString(),
    },
    'acc-axis-savings': {
      accountId: 'acc-axis-savings',
      accountNumber: '91000000000002',
      customerId: '10000002',
      ifsc: 'UTIB0000001',
      upiId: 'aarav.axis@okaxis',
      branch: 'Central Branch, Delhi',
      nominee: 'Sample Nominee',
      registeredMobile: '+91 98000 00000',
      registeredEmail: chosenPersona.email,
      statementPassword: 'pass1234',
      notes: 'Priority savings account linked to Axis Atlas card and 12M Recurring Deposit.',
      customFields: [{ label: 'Debit Card PIN', value: '8821', secret: true }],
      updatedAt: now.toISOString(),
    },
  };

  // 9. Account Documents
  const documents: Record<string, DemoAccountDocument[]> = {
    'acc-hdfc-salary': [
      {
        id: 'doc-hdfc-1',
        accountId: 'acc-hdfc-salary',
        name: 'HDFC_Imperia_Welcome_Schedule.pdf',
        mimeType: 'application/pdf',
        byteSize: 284120,
        createdAt: new Date(Date.UTC(currentYear, Math.max(0, currentMonth - 2), 10)).toISOString(),
      },
      {
        id: 'doc-hdfc-2',
        accountId: 'acc-hdfc-salary',
        name: 'Cancelled_Cheque_Leaf_XX0001.png',
        mimeType: 'image/png',
        byteSize: 142800,
        createdAt: new Date(Date.UTC(currentYear, Math.max(0, currentMonth - 1), 4)).toISOString(),
      },
    ],
    'acc-axis-savings': [
      {
        id: 'doc-axis-1',
        accountId: 'acc-axis-savings',
        name: 'Axis_Priority_Statement_Summary.pdf',
        mimeType: 'application/pdf',
        byteSize: 319400,
        createdAt: new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString(),
      },
    ],
  };

  // 10. Pending Staged Imports (so user can test /import Review & Commit!)
  const pendingImports: DemoPendingImport[] = [
    {
      id: 'imp-pending-stmt-1',
      kind: 'STATEMENT',
      status: 'PENDING',
      fileName: 'Axis_Priority_Savings_Recent.pdf',
      institution: 'Axis Bank',
      createdAt: new Date(now.getTime() - 1000 * 60 * 35).toISOString(),
      accountId: 'acc-axis-savings',
      accountName: 'Axis Bank Priority Savings',
      accountType: AccountType.SAVINGS,
      organizationId: null,
      organizationName: null,
      payPeriod: null,
      netPay: null,
      grossEarnings: null,
      grossDeductions: null,
      paidDays: null,
      lopDays: null,
      lineItems: [],
      totalRows: 5,
      newRows: 4,
      duplicateRows: 1,
      conflictRows: 0,
      openingBalance: accountMap.get('acc-axis-savings')?.balance ?? 18500000,
      closingBalance: (accountMap.get('acc-axis-savings')?.balance ?? 18500000) - 412000,
      statementStart: new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString(),
      statementEnd: now.toISOString(),
      rows: [
        {
          id: 'imp-row-1',
          postedAt: now.toISOString(),
          description: 'UPI/DR/BLUE TOKAI COFFEE ROASTERS/bluetokai@okaxis',
          amount: -54000,
          balance: (accountMap.get('acc-axis-savings')?.balance ?? 18500000) - 54000,
          kind: TransactionKind.EXPENSE,
          category: 'Food & Dining',
          status: 'NEW',
        },
        {
          id: 'imp-row-2',
          postedAt: new Date(now.getTime() - 86400000).toISOString(),
          description: 'UPI/DR/DECATHLON SPORTS INDIA/decathlon@axis',
          amount: -249900,
          balance: (accountMap.get('acc-axis-savings')?.balance ?? 18500000) - 303900,
          kind: TransactionKind.EXPENSE,
          category: 'Shopping & Lifestyle',
          status: 'NEW',
        },
        {
          id: 'imp-row-3',
          postedAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
          description: 'UPI/DR/ZEPTO NOW GROCERIES/zepto@icici',
          amount: -108100,
          balance: (accountMap.get('acc-axis-savings')?.balance ?? 18500000) - 412000,
          kind: TransactionKind.EXPENSE,
          category: 'Groceries',
          status: 'NEW',
        },
        {
          id: 'imp-row-4',
          postedAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
          description: 'CASHBACK CREDIT AXIS PRIORITY REWARDS',
          amount: 35000,
          balance: (accountMap.get('acc-axis-savings')?.balance ?? 18500000) - 377000,
          kind: TransactionKind.INCOME,
          category: 'Cashback & Refunds',
          status: 'NEW',
        },
        {
          id: 'imp-row-5',
          postedAt: new Date(Date.UTC(currentYear, currentMonth, 6, 14, 20, 0)).toISOString(),
          description: 'UPI/DR/BLINKIT GROCERIES/gurgaon@axis',
          amount: -112000,
          balance: null,
          kind: TransactionKind.EXPENSE,
          category: 'Groceries',
          status: 'DUPLICATE',
          duplicateReason: 'Exact date, amount, and merchant match in ledger',
        },
      ],
    },
  ];

  const importHistory: DemoImportHistoryItem[] = [
    {
      id: 'imp-hist-1',
      kind: 'STATEMENT',
      status: 'COMMITTED',
      fileName: 'HDFC_Salary_Account_Statement.pdf',
      institution: 'HDFC Bank',
      createdAt: new Date(now.getTime() - 86400000 * 5).toISOString(),
      committedAt: new Date(now.getTime() - 86400000 * 5 + 120000).toISOString(),
      accountId: 'acc-hdfc-salary',
      accountName: 'HDFC Bank Salary Account',
      organizationId: null,
      organizationName: null,
      payPeriod: null,
      netPay: null,
      totalRows: 24,
      newRows: 22,
      duplicateRows: 2,
      conflictRows: 0,
    },
    {
      id: 'imp-hist-2',
      kind: 'SALARY',
      status: 'COMMITTED',
      fileName: salaryStatements[salaryStatements.length - 1]?.sourceFileName || 'Acme_Payslip.pdf',
      institution: 'Acme Technologies India Pvt Ltd',
      createdAt: new Date(now.getTime() - 86400000 * 10).toISOString(),
      committedAt: new Date(now.getTime() - 86400000 * 10 + 60000).toISOString(),
      accountId: null,
      accountName: null,
      organizationId: 'org-acme',
      organizationName: 'Acme Technologies India Pvt Ltd',
      payPeriod: salaryStatements[salaryStatements.length - 1]?.payPeriod || now.toISOString(),
      netPay: salaryStatements[salaryStatements.length - 1]?.netPay || 18500000,
      totalRows: 7,
      newRows: 7,
      duplicateRows: 0,
      conflictRows: 0,
    },
  ];

  return {
    version: 2,
    seedId: `seed-${Math.random().toString(36).slice(2, 9)}`,
    generatedAt: now.toISOString(),
    user: {
      id: 'user-guest-demo',
      name: `${chosenPersona.name} (Guest Sandbox)`,
      email: chosenPersona.email,
      createdAt: new Date(Date.UTC(currentYear - 1, 0, 1)).toISOString(),
    },
    superCategories,
    categories,
    categoryRules,
    tags,
    accounts,
    vaults,
    holdings: allHoldings,
    sips,
    loans,
    rds,
    documents,
    transactions,
    budgets,
    organizations,
    salaryStatements: salaryStatements.slice().reverse(),
    pendingImports,
    importHistory,
    emailAccounts: [
      {
        id: 'gmail-demo-1',
        email: chosenPersona.email,
        lastSyncedAt: new Date(now.getTime() - 1000 * 60 * 18).toISOString(),
        createdAt: new Date(Date.UTC(currentYear, 0, 15)).toISOString(),
      },
    ],
    emailLogs: [
      {
        id: 'elog-1',
        messageId: 'msg-hdfc-99281',
        subject: 'Alert: INR 1,420.00 spent on HDFC Bank Credit Card XX0001',
        fromAddress: 'alerts@hdfcbank.net',
        receivedAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
        status: 'IMPORTED',
        reason: 'Matched HDFC Regalia Gold Credit Card (XX0001)',
        processedAt: new Date(now.getTime() - 1000 * 60 * 18).toISOString(),
      },
      {
        id: 'elog-2',
        messageId: 'msg-axis-88120',
        subject: 'Debit Alert: INR 680.00 via UPI on Axis A/c XX0002',
        fromAddress: 'alerts@axisbank.com',
        receivedAt: new Date(now.getTime() - 1000 * 60 * 190).toISOString(),
        status: 'IMPORTED',
        reason: 'Matched Axis Bank Priority Savings (XX0002)',
        processedAt: new Date(now.getTime() - 1000 * 60 * 18).toISOString(),
      },
      {
        id: 'elog-3',
        messageId: 'msg-promo-44102',
        subject: 'Pre-approved Personal Loan offer on your HDFC Card',
        fromAddress: 'offers@hdfcbank.net',
        receivedAt: new Date(now.getTime() - 1000 * 60 * 420).toISOString(),
        status: 'SKIPPED',
        reason: 'Promotional / non-transactional email filtered out',
        processedAt: new Date(now.getTime() - 1000 * 60 * 18).toISOString(),
      },
    ],
    driveConfig: {
      configured: true,
      connected: true,
      email: chosenPersona.email,
      backupFrequency: 'WEEKLY',
      lastBackupAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
    },
  };
}
