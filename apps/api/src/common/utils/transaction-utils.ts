/**
 * Shared transaction utilities for beneficiary extraction, refund pattern matching,
 * timezone-aware date range construction, and multi-channel merchant normalization.
 */

export function extractBeneficiaryName(description: string): string | null {
  if (!description) return null;

  // 1. UPI Slash Tokens e.g. "UPI/12345/SWIGGY/PAYMENT", "UPI/REV/67890/ZOMATO"
  const upiParts = description.split('/');
  if (upiParts[0]?.toUpperCase().includes('UPI') && upiParts.length >= 3) {
    for (let i = 1; i < upiParts.length; i++) {
      const token = upiParts[i].trim();
      if (
        token &&
        !/^[0-9]+$/.test(token) &&
        !/^(PAYMENT|PAY|REV|UPI|OKAXIS|YBL|ICICI|HDFC|PAYTM|AXIS|SBI|YES)$/i.test(token)
      ) {
        return cleanBeneficiaryToken(token);
      }
    }
  }

  // 2. UPI VPA format e.g. "paytm-swiggy@ptybl", "zomato@hdfcbank"
  if (description.includes('@')) {
    const vpaMatch = description.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+)/);
    if (vpaMatch) {
      const handle = vpaMatch[1].split('@')[0];
      const cleaned = handle
        .replace(/^(?:paytm|pay|upi|ibkpos\.[a-z0-9]+)[-.]?/i, '')
        .replace(/[-._]/g, ' ')
        .trim();
      if (cleaned.length >= 2) return cleanBeneficiaryToken(cleaned);
    }
  }

  // 3. Card POS Terminal e.g. "POS 4000XXXXXXXX0001 MAKEMYTRIP INDIA PVT LT"
  const posMatch = description.match(/\bPOS\s+(?:[\dX*]+\s+)?([A-Z0-9\s&.,'-]+?)(?:\s+(?:BANGALORE|MUMBAI|DELHI|HYDERABAD|CHENNAI|PUNE|KOLKATA|IN|IND))?$/i);
  if (posMatch && posMatch[1].trim().length >= 2) {
    const name = posMatch[1].replace(/\[.*?\]/g, '').replace(/[\dX*]{4,}/g, '').trim();
    if (name.length >= 2 && !/^(PAYMENT|TRANSACTION|PURCHASE)$/i.test(name)) {
      return cleanBeneficiaryToken(name);
    }
  }

  // 4. NEFT e.g. "NEFT-CR-ZERODHA BROKING", "NEFT-AXISP0001-MAKEMYTRIP"
  const neftMatch = description.match(/NEFT-(?:CR|DR)?-?[^-]+-([A-Z\s&.,]+)/i) || description.match(/NEFT-[^-]+-([A-Z\s&.,]+)/i);
  if (neftMatch && neftMatch[1] && !/^[0-9]+$/.test(neftMatch[1].trim())) {
    return cleanBeneficiaryToken(neftMatch[1]);
  }

  // 5. IMPS e.g. "IMPS/P2A/1234567890/MAKEMYTRIP", "IMPS-123456-SWIGGY"
  const impsMatch = description.match(/IMPS[/-](?:P2A|P2P|CR|DR)?[/-]?\d+[/-]([A-Z0-9\s&.,]+)/i);
  if (impsMatch && impsMatch[1] && !/^[0-9]+$/.test(impsMatch[1].trim())) {
    return cleanBeneficiaryToken(impsMatch[1]);
  }

  // 6. NACH / Mandate e.g. "ACH/SIP-ZERODHA/12345", "NACH-HDFC-LOAN-EMI/123"
  const nachMatch = description.match(/(?:ACH|NACH|MANDATE)[/-]([A-Z0-9\s&.,-]+?)(?:\/|$)/i);
  if (nachMatch && nachMatch[1].trim().length >= 2) {
    return cleanBeneficiaryToken(nachMatch[1]);
  }

  return null;
}

import { cleanBeneficiaryToken, isRefundOrReversal } from '@yaft/shared';
export { cleanBeneficiaryToken, isRefundOrReversal };


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
