/**
 * Shared transaction utilities for beneficiary extraction, refund pattern matching,
 * and timezone-aware date range construction.
 */

export function extractBeneficiaryName(description: string): string | null {
  if (!description) return null;
  const upiParts = description.split('/');
  if (upiParts[0]?.toUpperCase().includes('UPI') && upiParts.length >= 3) {
    for (let i = 1; i < upiParts.length; i++) {
      const token = upiParts[i].trim();
      if (token && !/^[0-9]+$/.test(token) && !/^(PAYMENT|PAY|REV|UPI|OKAXIS|YBL|ICICI|HDFC|PAYTM|AXIS)$/i.test(token)) {
        return token;
      }
    }
  }
  const neftMatch = description.match(/NEFT-[^-]+-([A-Z\s]+)/i);
  if (neftMatch && neftMatch[1] && !/^[0-9]+$/.test(neftMatch[1].trim())) {
    return neftMatch[1].trim();
  }
  return null;
}

export function isRefundOrReversal(description: string): boolean {
  if (!description) return false;
  const desc = description.toLowerCase();
  return /refund|reversal|returned|cashback|cb\s|credit\s*adj|cancelled/i.test(desc);
}

export function getMonthDateRange(
  startDateStr?: string,
  endDateStr?: string,
  monthStr?: string,
): { start: Date; end: Date; labelMonth: string } {
  const now = new Date();
  let start: Date;
  let end: Date;
  let labelMonth = '';

  if (startDateStr && endDateStr) {
    start = new Date(`${startDateStr}T00:00:00.000Z`);
    end = new Date(`${endDateStr}T23:59:59.999Z`);
    labelMonth = `${startDateStr} to ${endDateStr}`;
  } else {
    const match = monthStr?.match(/^(\d{4})-(\d{2})$/);
    const year = match ? Number(match[1]) : now.getFullYear();
    const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
    start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
    labelMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }

  return { start, end, labelMonth };
}

export function computeCreditCardCurrentBalance(
  card: { openingBalance?: bigint | number; statementDay?: number | null },
  cardTransactions: { amount: bigint | number; transactionDate?: Date | string }[],
): { currentBalance: number; outstanding: number } {
  const positivePayments = cardTransactions.filter((t) => Number(t.amount) > 0 && t.transactionDate);

  if (positivePayments.length > 0) {
    const sortedPayments = [...positivePayments].sort(
      (a, b) => new Date(b.transactionDate!).getTime() - new Date(a.transactionDate!).getTime(),
    );
    const latestPayment = sortedPayments[0];
    const latestPaymentTime = new Date(latestPayment.transactionDate!).getTime();

    const activeCycleTxns = cardTransactions.filter(
      (t) => t.transactionDate && new Date(t.transactionDate).getTime() > latestPaymentTime,
    );

    const activeCycleNet = activeCycleTxns.reduce((sum, t) => sum + Number(t.amount), 0);
    const currentBalance = activeCycleNet;
    const outstanding = currentBalance < 0 ? Math.abs(currentBalance) : 0;
    return { currentBalance, outstanding };
  }

  const openingBal = Number(card.openingBalance ?? 0);
  const netAll = cardTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const ledgerBalance = openingBal + netAll;
  const outstanding = ledgerBalance < 0 ? Math.abs(ledgerBalance) : 0;

  return { currentBalance: ledgerBalance, outstanding };
}
