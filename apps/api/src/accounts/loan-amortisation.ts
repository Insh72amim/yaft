export interface Installment {
  dueDate: Date;
  principalAmount: number; // in paise
  interestAmount: number;  // in paise
  emiAmount: number;       // in paise
  balance: number;         // in paise
}

function getDueDate(startDate: Date, emiDay: number, installmentIndex: number): Date {
  const date = new Date(startDate);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + installmentIndex;
  
  const tempDate = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(tempDate.getUTCFullYear(), tempDate.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(emiDay, lastDay);
  return new Date(Date.UTC(tempDate.getUTCFullYear(), tempDate.getUTCMonth(), day));
}

export function generateAmortisationSchedule(
  principal: number,      // in paise (positive)
  annualRate: number,     // e.g. 9.99
  emiAmount: number,      // in paise
  emiDay: number,         // 1-31
  startDate: Date,
  termMonths: number,
): Installment[] {
  const schedule: Installment[] = [];
  let outstanding = principal;
  const monthlyRate = annualRate / 12 / 100;

  for (let i = 1; i <= termMonths; i++) {
    if (outstanding <= 0) break;

    const dueDate = getDueDate(startDate, emiDay, i);
    const interest = Math.round(outstanding * monthlyRate);
    
    let principalPaid = emiAmount - interest;
    let actualEmi = emiAmount;

    // Last installment or if principal exceeds remaining outstanding
    if (i === termMonths || principalPaid >= outstanding) {
      principalPaid = outstanding;
      actualEmi = principalPaid + interest;
    }

    const balance = outstanding - principalPaid;

    schedule.push({
      dueDate,
      principalAmount: principalPaid,
      interestAmount: interest,
      emiAmount: actualEmi,
      balance,
    });

    outstanding = balance;
  }

  return schedule;
}
