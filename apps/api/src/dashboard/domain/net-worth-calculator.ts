import { AccountType } from '@prisma/client';
import { getAccountAssetCategory } from './transaction-classifier';

export interface HoldingValuationSnapshot {
  currentValue: bigint | number | null;
  averagePrice?: bigint | number | null;
  quantity?: { toString(): string } | number | null;
}

export interface InstallmentSnapshot {
  dueDate: Date | string;
  amount?: bigint | number;
  balance?: bigint | number;
  status: string;
}

export interface LoanSnapshot {
  startDate: Date | string;
  principal: bigint | number;
  installments?: InstallmentSnapshot[];
}

export interface RecurringDepositSnapshot {
  autoIncrease?: boolean;
  installments?: InstallmentSnapshot[];
}

export interface AssetHistoryAccountInput {
  id: string;
  name: string;
  type: AccountType | string;
  institution?: string | null;
  openingBalance: bigint | number;
  transactions?: readonly { amount: bigint | number; transactionDate?: Date | string }[];
  holdings?: HoldingValuationSnapshot[];
  loans?: LoanSnapshot[];
  recurringDeposits?: RecurringDepositSnapshot[];
}

export interface HistoricalMonthWindow {
  label: string;
  year: number;
  month: number;
  start: Date;
  end: Date;
}

/**
 * Builds the trailing 12-month UTC windows used for historical net worth charts.
 */
export function buildTrailing12MonthWindows(now: Date = new Date()): HistoricalMonthWindow[] {
  const months: HistoricalMonthWindow[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const monthLabel =
      d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) +
      ' ' +
      String(year).slice(2);
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
    months.push({ label: monthLabel, year, month, start, end });
  }
  return months;
}

/**
 * Computes current account valuations, asset allocation percentages, and 12-month
 * net worth trajectory from pre-aggregated transaction sums and account snapshots.
 */
export function computeAssetsHistoryReport(
  accounts: readonly AssetHistoryAccountInput[],
  currentTxSum: ReadonlyMap<string, number>,
  months: readonly HistoricalMonthWindow[],
  monthlyTxSums: ReadonlyMap<string, ReadonlyMap<string, number>>,
  now: Date = new Date(),
) {
  let savingsTotal = 0;
  let depositsTotal = 0;
  let stocksTotal = 0;
  let mutualFundsTotal = 0;
  let epfoTotal = 0;
  let debtTotal = 0;

  const todayYMD = now.toISOString().slice(0, 10);

  const accountBreakdown = accounts.map((account) => {
    let balance = 0;
    const isLoan = account.type === 'LOAN';
    const isPortfolio = account.type === 'MUTUAL_FUND' || account.type === 'STOCKS';
    const holdingsList = account.holdings || [];

    if (isLoan) {
      const loan = (account.loans || [])[0];
      if (loan) {
        const paidInsts = (loan.installments || []).filter((i) => i.status === 'PAID');
        let loanOutstanding = Number(loan.principal);
        if (paidInsts.length > 0) {
          const lastPaid = paidInsts[paidInsts.length - 1];
          loanOutstanding = Number(lastPaid.balance ?? 0);
        }
        balance = -loanOutstanding;
      } else {
        const inlineTxSum = (account.transactions || []).reduce(
          (sum, t) => sum + Number(t.amount),
          0,
        );
        const ledgerBalance =
          Number(account.openingBalance) +
          (currentTxSum.get(account.id) ?? inlineTxSum);
        balance = ledgerBalance < 0 ? ledgerBalance : -ledgerBalance;
      }
    } else if (account.type === 'RECURRING_DEPOSIT' && (account.recurringDeposits || [])[0]) {
      const rd = account.recurringDeposits![0];
      const paidInsts = (rd.installments || []).filter((i) => {
        if (i.status === 'PAID') return true;
        const due = new Date(i.dueDate);
        if (rd.autoIncrease && (due <= now || due.toISOString().slice(0, 10) <= todayYMD)) {
          return true;
        }
        return false;
      });
      const totalDeposited = paidInsts.reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
      const inlineTxSum = (account.transactions || []).reduce(
        (sum, t) => sum + Number(t.amount),
        0,
      );
      const txSum = currentTxSum.get(account.id) ?? inlineTxSum;
      balance = totalDeposited + Number(account.openingBalance) + txSum;
    } else {
      const inlineTxSum = (account.transactions || []).reduce(
        (sum, t) => sum + Number(t.amount),
        0,
      );
      const ledgerBalance =
        Number(account.openingBalance) +
        (currentTxSum.get(account.id) ?? inlineTxSum);
      const hasCompleteValuation =
        holdingsList.length > 0 && holdingsList.every((holding) => holding.currentValue !== null);
      balance =
        isPortfolio && hasCompleteValuation
          ? holdingsList.reduce((sum, holding) => sum + Number(holding.currentValue), 0)
          : ledgerBalance;
    }

    const category = getAccountAssetCategory(account);
    if (category === 'DEBT') {
      if (balance < 0) debtTotal += Math.abs(balance);
    } else if (category === 'DEPOSITS') {
      if (balance > 0) depositsTotal += balance;
    } else if (category === 'EPFO') {
      if (balance > 0) epfoTotal += balance;
    } else if (category === 'MUTUAL_FUNDS') {
      if (balance > 0) mutualFundsTotal += balance;
    } else if (category === 'STOCKS') {
      if (balance > 0) stocksTotal += balance;
    } else {
      if (balance > 0) savingsTotal += balance;
    }

    const investedValue = holdingsList.reduce((sum, h) => {
      if (h.averagePrice && h.quantity) {
        return sum + Number(h.averagePrice) * Number(h.quantity);
      }
      return sum;
    }, 0);

    const currentValue = holdingsList.reduce((sum, h) => {
      if (h.currentValue !== null) {
        return sum + Number(h.currentValue);
      }
      return sum;
    }, 0);

    const unrealizedPnl = currentValue - investedValue;

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      institution: account.institution,
      category,
      balance,
      investedValue: isPortfolio ? investedValue : undefined,
      currentValue: isPortfolio ? currentValue : undefined,
      unrealizedPnl: isPortfolio ? unrealizedPnl : undefined,
    };
  });

  const totalAssets =
    savingsTotal + depositsTotal + stocksTotal + mutualFundsTotal + epfoTotal;
  const netWorth = totalAssets - debtTotal;

  const history = months.map((m) => {
    let savings = 0;
    let deposits = 0;
    let stocks = 0;
    let mutualFunds = 0;
    let epfo = 0;
    let debt = 0;

    accounts.forEach((account) => {
      const isLoan = account.type === 'LOAN';
      if (isLoan) {
        const loan = (account.loans || [])[0];
        if (loan) {
          const instsUpToMonth = (loan.installments || []).filter(
            (i) => new Date(i.dueDate) <= m.end,
          );
          const paidUpToMonth = instsUpToMonth.filter((i) => i.status === 'PAID');
          if (paidUpToMonth.length > 0) {
            const lastPaid = paidUpToMonth[paidUpToMonth.length - 1];
            debt += Math.abs(Number(lastPaid.balance ?? 0));
          } else if (new Date(loan.startDate) <= m.end) {
            debt += Math.abs(Number(loan.principal));
          }
        } else {
          const cumLedger =
            Number(account.openingBalance) +
            (monthlyTxSums.get(m.label)?.get(account.id) || 0);
          debt += Math.abs(cumLedger);
        }
        return;
      }

      const cumLedger =
        Number(account.openingBalance) +
        (monthlyTxSums.get(m.label)?.get(account.id) || 0);
      const isPortfolio = account.type === 'MUTUAL_FUND' || account.type === 'STOCKS';
      const holdingsList = account.holdings || [];
      const hasCompleteValuation =
        holdingsList.length > 0 && holdingsList.every((holding) => holding.currentValue !== null);

      let bal =
        isPortfolio && hasCompleteValuation
          ? holdingsList.reduce((sum, holding) => sum + Number(holding.currentValue), 0)
          : cumLedger;

      if (account.type === 'RECURRING_DEPOSIT' && (account.recurringDeposits || [])[0]) {
        const rd = account.recurringDeposits![0];
        const instsUpToMonth = (rd.installments || []).filter(
          (i) => new Date(i.dueDate) <= m.end,
        );
        const paidUpToMonth = instsUpToMonth.filter(
          (i) => i.status === 'PAID' || (rd.autoIncrease && new Date(i.dueDate) <= m.end),
        );
        const depositedUpToMonth = paidUpToMonth.reduce(
          (sum, i) => sum + Number(i.amount ?? 0),
          0,
        );
        bal = depositedUpToMonth + cumLedger;
      }

      if (bal <= 0) return;

      const category = getAccountAssetCategory(account);
      if (category === 'DEPOSITS') {
        deposits += bal;
      } else if (category === 'EPFO') {
        epfo += bal;
      } else if (category === 'MUTUAL_FUNDS') {
        mutualFunds += bal;
      } else if (category === 'STOCKS') {
        stocks += bal;
      } else if (category === 'DEBT') {
        // debt already handled above
      } else {
        savings += bal;
      }
    });

    const monthAssets = savings + deposits + stocks + mutualFunds + epfo;
    const monthNetWorth = monthAssets - debt;

    return {
      month: m.label,
      year: m.year,
      monthIndex: m.month,
      netWorth: monthNetWorth,
      totalAssets: monthAssets,
      debtTotal: debt,
      savingsTotal: savings,
      depositsTotal: deposits,
      stocksTotal: stocks,
      mutualFundsTotal: mutualFunds,
      epfoTotal: epfo,
    };
  });

  const totalPositiveAssets = Math.max(1, totalAssets);
  const allocation = {
    savings: {
      amount: savingsTotal,
      percentage: Math.round((savingsTotal / totalPositiveAssets) * 100),
    },
    deposits: {
      amount: depositsTotal,
      percentage: Math.round((depositsTotal / totalPositiveAssets) * 100),
    },
    stocks: {
      amount: stocksTotal,
      percentage: Math.round((stocksTotal / totalPositiveAssets) * 100),
    },
    mutualFunds: {
      amount: mutualFundsTotal,
      percentage: Math.round((mutualFundsTotal / totalPositiveAssets) * 100),
    },
    epfo: {
      amount: epfoTotal,
      percentage: Math.round((epfoTotal / totalPositiveAssets) * 100),
    },
  };

  return {
    netWorth,
    totalAssets,
    debtTotal,
    savingsTotal,
    depositsTotal,
    stocksTotal,
    mutualFundsTotal,
    epfoTotal,
    allocation,
    accounts: accountBreakdown,
    history,
  };
}
