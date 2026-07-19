import { PiggyBank, Landmark, TrendingUp, ChartPie, CreditCard, BadgeIndianRupee, Building2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, errorMessage } from '@/lib/api';

export const accountChoices = [
  { group: 'BANK', type: 'SAVINGS', label: 'Savings account', detail: 'Salary or everyday banking', icon: PiggyBank },
  { group: 'INVESTMENTS', type: 'FIXED_DEPOSIT', label: 'Fixed & recurring deposit', detail: 'Bank FD, RD and term deposits', icon: Landmark },
  { group: 'INVESTMENTS', type: 'STOCKS', label: 'Stock account', detail: 'Broker and demat portfolio', icon: TrendingUp },
  { group: 'INVESTMENTS', type: 'INVESTMENT', label: 'Mutual funds', detail: 'AMC, platform or folio holdings', icon: ChartPie },
  { group: 'OTHER', type: 'CREDIT_CARD', label: 'Credit card', detail: 'Limit, outstanding and due day', icon: CreditCard },
  { group: 'OTHER', type: 'LOAN', label: 'Loan account', detail: 'Home, vehicle or personal loan', icon: BadgeIndianRupee },
  { group: 'INVESTMENTS', type: 'EPFO', label: 'EPFO account', detail: 'Provident-fund balance', icon: Building2 },
] as const;

export const accountChoiceGroups = [
  { label: 'Bank accounts', group: 'BANK' },
  { label: 'Investments', group: 'INVESTMENTS' },
  { label: 'Debt Accounts', group: 'OTHER' },
] as const;

export const savingsInstitutions = ['Axis Bank', 'Punjab National Bank', 'State Bank of India'];
export const stockBrokers = ['Zerodha', 'Groww'];
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

export const typeLabel: Record<string, string> = { BANK: 'Bank account', SAVINGS: 'Savings account', FIXED_DEPOSIT: 'Fixed & recurring deposit',
  CREDIT_CARD: 'Credit card', LOAN: 'Loan account', STOCKS: 'Stock account', INVESTMENT: 'Mutual fund account', EPFO: 'EPFO account', CASH: 'Cash' };

export function AddAccountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [adding, setAdding] = useState(false); 
  const [accountError, setAccountError] = useState(''); 
  const [newType, setNewType] = useState('SAVINGS');

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); 
    const form = new FormData(event.currentTarget); 
    const type = String(form.get('type'));
    
    setAdding(true); setAccountError('');
    try {
      const payload: any = {
        name: form.get('name'),
        type,
        institution: form.get('institution') || undefined,
      };

      if (type === 'LOAN') {
        payload.loanStartDate = form.get('loanStartDate');
        payload.loanPrincipal = Math.round(Number(form.get('loanPrincipal')) * 100);
        payload.loanInterestRate = Number(form.get('loanInterestRate'));
        payload.loanEmiAmount = Math.round(Number(form.get('loanEmiAmount')) * 100);
        payload.loanEmiDay = Number(form.get('loanEmiDay'));
        payload.loanTermMonths = Number(form.get('loanTermMonths'));
      } else {
        payload.openingBalance = form.get('openingBalance') ? Math.round(Number(form.get('openingBalance')) * 100) : 0;
        payload.creditLimit = form.get('creditLimit') ? Math.round(Number(form.get('creditLimit')) * 100) : undefined;
        payload.dueDay = form.get('dueDay') ? Number(form.get('dueDay')) : undefined;
      }

      await api('/accounts', { method: 'POST', body: JSON.stringify(payload) });
      onSuccess();
      onClose();
    } catch (reason) {
      setAccountError(errorMessage(reason, 'Could not add account.'));
      setAdding(false);
    }
  }

  const accountPlaceholder = (type: string) => {
    if (type === 'CREDIT_CARD') return 'e.g. Millennia Card';
    if (type === 'SAVINGS') return 'e.g. Salary account';
    return 'Account name';
  };
  const institutionPlaceholder = (type: string) => {
    if (type === 'CREDIT_CARD') return 'Bank or issuer name';
    if (type === 'LOAN') return 'Lender name';
    return 'Institution name';
  };

  return (
    <div className="modal-wrap">
      <button className="backdrop" onClick={onClose} aria-label="Close"/>
      <form className="modal account-modal" onSubmit={addAccount}>
        <div><span className="eyebrow">New account</span><h2>What kind of account?</h2><p>Choose a clear financial category. You’ll only see fields relevant to it.</p></div>
        <input type="hidden" name="type" value={newType}/>
        <div className="account-choice-groups">
          {accountChoiceGroups.map((choiceGroup) => (
            <div className="account-choice-section" key={choiceGroup.group}>
              <span>{choiceGroup.label}</span>
              <div className="account-choice-grid">
                {accountChoices.filter((choice) => choice.group === choiceGroup.group).map((choice) => (
                  <AccountChoice key={choice.type} choice={choice} selected={newType === choice.type} onSelect={setNewType}/>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="account-fields">
          <label>Account name<input name="name" required placeholder={accountPlaceholder(newType)} /></label>
          {newType === 'SAVINGS' || newType === 'FIXED_DEPOSIT' ? (
            <label>Institution<select name="institution" required defaultValue=""><option value="" disabled>Choose a supported bank</option>{savingsInstitutions.map((bank) => <option value={bank} key={bank}>{bank}</option>)}</select></label>
          ) : newType === 'STOCKS' ? (
            <label>Broker<select name="institution" required defaultValue=""><option value="" disabled>Choose a supported broker</option>{stockBrokers.map((broker) => <option value={broker} key={broker}>{broker}</option>)}</select></label>
          ) : newType === 'CREDIT_CARD' ? (
            <label>Institution<select name="institution" required defaultValue=""><option value="" disabled>Choose a supported bank</option>{creditCardInstitutions.map((bank) => <option value={bank} key={bank}>{bank}</option>)}</select></label>
          ) : (
            <label>{newType === 'INVESTMENT' ? 'Platform / AMC' : newType === 'EPFO' ? 'Organisation / employer' : 'Institution'}<input name="institution" placeholder={institutionPlaceholder(newType)} /></label>
          )}
          {newType === 'FIXED_DEPOSIT' && (
            <label>Opening balance (₹)<input name="openingBalance" type="number" step="0.01" defaultValue="0" /></label>
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
