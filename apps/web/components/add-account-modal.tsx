import { PiggyBank, Landmark, TrendingUp, ChartPie, CreditCard, BadgeIndianRupee, Building2, Repeat } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, errorMessage, money } from '@/lib/api';

export const accountChoices = [
  { group: 'BANK', type: 'SAVINGS', label: 'Savings account', detail: 'Salary or everyday banking', icon: PiggyBank },
  { group: 'INVESTMENTS', type: 'MUTUAL_FUND', label: 'Mutual Funds', detail: 'Groww, Zerodha Coin, AMC or folio holdings', icon: ChartPie },
  { group: 'INVESTMENTS', type: 'STOCKS', label: 'Stocks', detail: 'Groww, Zerodha Kite, Angel One broker account', icon: TrendingUp },
  { group: 'INVESTMENTS', type: 'FIXED_DEPOSIT', label: 'Fixed deposit', detail: 'Bank FD and term deposits', icon: Landmark },
  { group: 'INVESTMENTS', type: 'RECURRING_DEPOSIT', label: 'Recurring deposit', detail: 'Monthly recurring bank savings deposit', icon: Repeat },
  { group: 'OTHER', type: 'CREDIT_CARD', label: 'Credit card', detail: 'Limit, outstanding and due day', icon: CreditCard },
  { group: 'OTHER', type: 'LOAN', label: 'Loan account', detail: 'Home, vehicle or personal loan', icon: BadgeIndianRupee },
  { group: 'INVESTMENTS', type: 'EPFO', label: 'EPFO account', detail: 'Provident-fund balance', icon: Building2 },
  { group: 'INVESTMENTS', type: 'CASH', label: 'Cash & Tangible Assets', detail: 'Physical gold, real estate, vault cash & custom holdings', icon: PiggyBank },
] as const;

export const accountChoiceGroups = [
  { label: 'Bank accounts', group: 'BANK' },
  { label: 'Investments', group: 'INVESTMENTS' },
  { label: 'Debt Accounts', group: 'OTHER' },
] as const;

export const savingsInstitutions = ['Axis Bank', 'Punjab National Bank', 'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Kotak Mahindra Bank', 'Bank of Baroda', 'Canara Bank', 'Federal Bank', 'IndusInd Bank', 'IDFC First Bank', 'Union Bank of India'];
export const stockBrokers = [
  'Groww',
  'Zerodha',
  'Angel One',
  'Upstox',
  'INDmoney',
  'HDFC Sky',
  'ICICI Direct',
  'Kotak Securities',
  'Paytm Money',
  'Dhan',
  '5paisa',
  'Motilal Oswal',
  'Sharekhan'
];
export const mutualFundPlatforms = [
  'Groww',
  'Zerodha',
  'Angel One',
  'Upstox',
  'INDmoney',
  'Kuvera',
  'CAMS / KFintech',
  'Paytm Money',
  'MF Central',
  'ET Money',
  'HDFC Mutual Fund',
  'SBI Mutual Fund',
  'ICICI Prudential Mutual Fund',
  'Nippon India Mutual Fund',
  'Axis Mutual Fund',
  'Parag Parikh Mutual Fund',
  'Mirae Asset Mutual Fund',
  'UTI Mutual Fund',
  'Tata Mutual Fund',
  'Bandhan Mutual Fund',
  'DSP Mutual Fund',
  'Motilal Oswal Mutual Fund',
  'Quant Mutual Fund'
];
export const creditCardInstitutions = [
  'American Express',
  'Axis Bank',
  'Citibank',
  'Federal Bank',
  'HDFC Bank',
  'HSBC',
  'ICICI Bank',
  'IDFC First Bank',
  'IndusInd Bank',
  'Kotak Mahindra Bank',
  'OneCard',
  'Punjab National Bank',
  'RBL Bank',
  'State Bank of India',
  'Yes Bank'
];

export const typeLabel: Record<string, string> = { BANK: 'Bank account', SAVINGS: 'Savings account', FIXED_DEPOSIT: 'Fixed deposit', RECURRING_DEPOSIT: 'Recurring deposit',
  CREDIT_CARD: 'Credit card', LOAN: 'Loan account', STOCKS: 'Stocks account', MUTUAL_FUND: 'Mutual Funds account', INVESTMENT: 'Mutual Funds account', EPFO: 'EPFO account', CASH: 'Cash' };

export function AddAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [adding, setAdding] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [newType, setNewType] = useState('SAVINGS');
  const [existingCards, setExistingCards] = useState<any[]>([]);
  const [isSharedLimit, setIsSharedLimit] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState('');

  // RD Form State for live preview calculation
  const [rdMonthly, setRdMonthly] = useState('5000');
  const [rdRate, setRdRate] = useState('7.0');
  const [rdTerm, setRdTerm] = useState('12');
  const [rdAutoIncrease, setRdAutoIncrease] = useState(true);

  useState(() => {
    api<any[]>('/accounts')
      .then((accs) => {
        const cards = accs.filter((a) => a.type === 'CREDIT_CARD' && !a.parentAccountId);
        setExistingCards(cards);
        if (cards.length > 0) setSelectedParentId(cards[0].id);
      })
      .catch(() => {});
  });

  // Calculate live RD preview
  const monthlyPaise = Math.round((Number(rdMonthly) || 0) * 100);
  const rateNum = Number(rdRate) || 0;
  const termNum = Math.max(1, Math.min(600, Number(rdTerm) || 12));

  let calculatedMaturityPaise = 0;
  if (monthlyPaise > 0 && rateNum >= 0) {
    const quarterlyRate = rateNum / 400;
    for (let k = 1; k <= termNum; k++) {
      const remainingMonths = termNum - k + 1;
      const quarters = remainingMonths / 3;
      calculatedMaturityPaise += monthlyPaise * Math.pow(1 + quarterlyRate, quarters);
    }
  }
  const totalInvestmentPaise = monthlyPaise * termNum;
  const maturityPaise = Math.round(calculatedMaturityPaise);
  const interestGainPaise = Math.max(0, maturityPaise - totalInvestmentPaise);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAdding(true);
    setAccountError('');
    const form = new FormData(e.currentTarget);
    const body: Record<string, any> = {
      name: form.get('name'),
      type: newType,
      institution: form.get('institution') || null,
      openingBalance: Number(form.get('openingBalance') || 0),
    };
    if (newType === 'CREDIT_CARD') {
      const limit = form.get('creditLimit');
      body.creditLimit = limit ? Number(limit) : null;
      const stmtDay = form.get('statementDay');
      body.statementDay = stmtDay ? Number(stmtDay) : null;
      const due = form.get('dueDay');
      body.dueDay = due ? Number(due) : null;

      if (isSharedLimit && selectedParentId) {
        body.parentAccountId = selectedParentId;
      }
    }
    if (newType === 'LOAN') {
      const principal = form.get('loanPrincipal');
      body.loanPrincipal = principal ? Number(principal) : undefined;
      const rate = form.get('loanInterestRate');
      body.loanInterestRate = rate ? Number(rate) : undefined;
      const emi = form.get('loanEmiAmount');
      body.loanEmiAmount = emi ? Number(emi) : undefined;
      const emiDay = form.get('loanEmiDay');
      body.loanEmiDay = emiDay ? Number(emiDay) : undefined;
      const term = form.get('loanTermMonths');
      body.loanTermMonths = term ? Number(term) : undefined;
      const startDate = form.get('loanStartDate');
      body.loanStartDate = startDate ? String(startDate) : undefined;
    }
    if (newType === 'RECURRING_DEPOSIT') {
      const monthly = form.get('rdMonthlyAmount');
      body.rdMonthlyAmount = monthly ? Math.round(Number(monthly) * 100) : undefined;
      const rate = form.get('rdInterestRate');
      body.rdInterestRate = rate ? Number(rate) : undefined;
      const depositDay = form.get('rdDepositDay');
      body.rdDepositDay = depositDay ? Number(depositDay) : undefined;
      const term = form.get('rdTermMonths');
      body.rdTermMonths = term ? Number(term) : undefined;
      const startDate = form.get('rdStartDate');
      body.rdStartDate = startDate ? String(startDate) : undefined;
      body.rdAutoIncrease = rdAutoIncrease;
    }
    try {
      await api('/accounts', { method: 'POST', body: JSON.stringify(body) });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setAccountError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  const accountPlaceholder = (type: string) => {
    if (type === 'CREDIT_CARD') return 'e.g. Amazon Pay / Coral RuPay';
    if (type === 'SAVINGS') return 'e.g. Salary account';
    if (type === 'FIXED_DEPOSIT') return 'e.g. 1-Year SBI FD';
    if (type === 'RECURRING_DEPOSIT') return 'e.g. 12-Month RD';
    return 'Account name';
  };
  const institutionPlaceholder = (type: string) => {
    if (type === 'CREDIT_CARD') return 'Bank or issuer name';
    if (type === 'LOAN') return 'Lender name';
    return 'Institution name';
  };

  const selectedParentCard = existingCards.find((c) => c.id === selectedParentId);
  const todayYMD = new Date().toISOString().slice(0, 10);

  return (
    <div className="modal-wrap">
      <button className="backdrop" onClick={onClose} aria-label="Close" />
      <form className="modal account-modal" onSubmit={handleCreate}>
        <div>
          <span className="eyebrow">New account</span>
          <h2>What kind of account?</h2>
          <p>Choose a clear financial category. You’ll only see fields relevant to it.</p>
        </div>
        <input type="hidden" name="type" value={newType} />
        <div className="account-choice-groups">
          {accountChoiceGroups.map((grp) => (
            <div key={grp.group} className="account-choice-section">
              <span>{grp.label}</span>
              <div className="account-choice-grid">
                {accountChoices.filter((c) => c.group === grp.group).map((choice) => (
                  <AccountChoice key={choice.type} choice={choice} selected={newType === choice.type} onSelect={setNewType} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="account-fields">
          <label>Account name<input name="name" required placeholder={accountPlaceholder(newType)} /></label>
          {newType === 'SAVINGS' || newType === 'FIXED_DEPOSIT' || newType === 'RECURRING_DEPOSIT' ? (
            <label>Institution<select name="institution" required defaultValue=""><option value="" disabled>Choose a supported bank</option>{savingsInstitutions.map((bank) => <option value={bank} key={bank}>{bank}</option>)}</select></label>
          ) : newType === 'STOCKS' ? (
            <label>Broker<select name="institution" required defaultValue=""><option value="" disabled>Choose a supported broker</option>{stockBrokers.map((broker) => <option value={broker} key={broker}>{broker}</option>)}</select></label>
          ) : newType === 'MUTUAL_FUND' || newType === 'INVESTMENT' ? (
            <label>Platform / Broker / AMC<select name="institution" required defaultValue=""><option value="" disabled>Choose platform, broker or AMC</option>{mutualFundPlatforms.map((platform) => <option value={platform} key={platform}>{platform}</option>)}</select></label>
          ) : newType === 'CREDIT_CARD' ? (
            <label>Institution<select name="institution" required defaultValue=""><option value="" disabled>Choose a supported bank</option>{creditCardInstitutions.map((bank) => <option value={bank} key={bank}>{bank}</option>)}</select></label>
          ) : (
            <label>{newType === 'EPFO' ? 'Organisation / employer' : 'Institution'}<input name="institution" placeholder={institutionPlaceholder(newType)} /></label>
          )}

          {newType === 'CREDIT_CARD' && existingCards.length > 0 && (
            <div style={{ background: 'var(--background-alt)', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: '8px' }}>Credit Limit &amp; Billing Arrangement:</span>
              <div style={{ display: 'flex', gap: '16px', marginBottom: isSharedLimit ? '12px' : '0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="limitStructure"
                    checked={!isSharedLimit}
                    onChange={() => setIsSharedLimit(false)}
                  />
                  Standalone Limit
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="limitStructure"
                    checked={isSharedLimit}
                    onChange={() => setIsSharedLimit(true)}
                  />
                  Shares Limit &amp; Bill with existing card
                </label>
              </div>

              {isSharedLimit && (
                <div>
                  <label style={{ marginTop: '8px' }}>
                    Primary Card (Shares Limit Pool)
                    <select
                      value={selectedParentId}
                      onChange={(e) => setSelectedParentId(e.target.value)}
                      required>
                      {existingCards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.name} ({card.institution || 'Credit Card'}) {card.creditLimit ? `— ₹${(card.creditLimit / 100).toLocaleString('en-IN')} Limit` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedParentCard && (
                    <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', marginTop: '6px' }}>
                      ℹ️ This card will draw from <strong>{selectedParentCard.name}</strong>'s credit limit pool and share billing due dates.
                    </small>
                  )}
                </div>
              )}
            </div>
          )}

          {newType === 'CREDIT_CARD' && !isSharedLimit && (
            <div className="form-row">
              <label>Credit limit (₹)<input name="creditLimit" type="number" min="0" step="0.01" placeholder="e.g. 500000" /></label>
              <label>Payment due day (1-31)<input name="dueDay" type="number" min="1" max="31" placeholder="e.g. 5" /></label>
            </div>
          )}

          {newType === 'FIXED_DEPOSIT' && (
            <label>Opening balance (₹)<input name="openingBalance" type="number" step="0.01" defaultValue="0" /></label>
          )}

          {newType === 'RECURRING_DEPOSIT' && (
            <>
              <div className="form-row">
                <label>RD start date<input name="rdStartDate" type="date" required defaultValue={todayYMD} /></label>
                <label>Monthly deposit (₹)<input name="rdMonthlyAmount" type="number" min="1" step="0.01" required value={rdMonthly} onChange={(e) => setRdMonthly(e.target.value)} placeholder="e.g. 5000" /></label>
              </div>
              <div className="form-row">
                <label>Interest rate (% p.a.)<input name="rdInterestRate" type="number" min="0.01" max="100" step="0.01" required value={rdRate} onChange={(e) => setRdRate(e.target.value)} placeholder="e.g. 7.1" /></label>
                <label>Deposit day of month (1-31)<input name="rdDepositDay" type="number" min="1" max="31" required defaultValue="5" placeholder="e.g. 5" /></label>
              </div>
              <div className="form-row">
                <label>Tenure (months)<input name="rdTermMonths" type="number" min="1" max="600" required value={rdTerm} onChange={(e) => setRdTerm(e.target.value)} placeholder="e.g. 12" /></label>
              </div>

              {/* Auto-Increase Balance Switch */}
              <div className="rd-auto-increase-toggle-card">
                <label className="rd-toggle-control">
                  <input
                    type="checkbox"
                    checked={rdAutoIncrease}
                    onChange={(e) => setRdAutoIncrease(e.target.checked)}
                  />
                  <div>
                    <strong>Auto-increase balance after deposit day</strong>
                    <small>
                      {rdAutoIncrease
                        ? 'Active: Deposits will automatically mark as paid and increase the RD balance on each monthly due day.'
                        : 'Manual: You will manually confirm each deposit before it reflects in the account balance.'}
                    </small>
                  </div>
                </label>
              </div>

              {/* Live Maturity Preview Card */}
              {monthlyPaise > 0 && (
                <div className="rd-preview-card">
                  <div className="rd-preview-title">
                    <span>Maturity Preview (Quarterly Compounding)</span>
                  </div>
                  <div className="rd-preview-grid">
                    <div>
                      <small>Total Investment</small>
                      <strong>{money(totalInvestmentPaise)}</strong>
                    </div>
                    <div>
                      <small>Interest Earned</small>
                      <strong className="gain">+{money(interestGainPaise)}</strong>
                    </div>
                    <div>
                      <small>Estimated Maturity</small>
                      <strong className="highlight">{money(maturityPaise)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {newType === 'LOAN' && (
            <>
              <div className="form-row">
                <label>Loan start date<input name="loanStartDate" type="date" required /></label>
                <label>Principal amount (₹)<input name="loanPrincipal" type="number" min="1" step="0.01" required /></label>
              </div>
              <div className="form-row">
                <label>Interest rate (% p.a.)<input name="loanInterestRate" type="number" min="0.01" max="100" step="0.01" required /></label>
                <label>Monthly EMI (₹)<input name="loanEmiAmount" type="number" min="1" step="0.01" required /></label>
              </div>
              <div className="form-row">
                <label>EMI due day (1-31)<input name="loanEmiDay" type="number" min="1" max="31" required /></label>
                <label>Tenure (months)<input name="loanTermMonths" type="number" min="1" max="600" required /></label>
              </div>
            </>
          )}
        </div>
        {accountError && <p className="error">{accountError}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={adding}>Add {typeLabel[newType]?.toLowerCase() || 'account'}</button>
        </div>
      </form>
    </div>
  );
}

function AccountChoice({ choice, selected, onSelect }: { choice: typeof accountChoices[number]; selected: boolean; onSelect: (type: string) => void }) {
  const Icon = choice.icon;
  return (
    <button type="button" className={`account-choice ${selected ? 'selected' : ''}`} onClick={() => onSelect(choice.type)}>
      <Icon/><span><strong>{choice.label}</strong><small>{choice.detail}</small></span>
    </button>
  );
}
