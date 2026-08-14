import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { AccountType } from '@prisma/client';

function extractBeneficiaryName(description: string): string | null {
  if (!description) return null;
  const upiMatch = description.match(/UPI\/(?:[^\/]+\/){2,3}([^/]+)(?:\/|$)/i);
  if (upiMatch && upiMatch[1] && !/^[0-9]+$/.test(upiMatch[1].trim())) {
    return upiMatch[1].trim();
  }
  const neftMatch = description.match(/NEFT-[^-]+-([A-Z\s]+)/i);
  if (neftMatch && neftMatch[1] && !/^[0-9]+$/.test(neftMatch[1].trim())) {
    return neftMatch[1].trim();
  }
  return null;
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async overview(
    @CurrentUser() user: { id: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    let start: Date;
    let end: Date;
    let labelMonth = '';

    if (startDate && endDate) {
      start = new Date(`${startDate}T00:00:00.000Z`);
      end = new Date(`${endDate}T23:59:59.999Z`);
      labelMonth = `${startDate} to ${endDate}`;
    } else {
      const match = month?.match(/^(\d{4})-(\d{2})$/);
      const year = match ? Number(match[1]) : now.getUTCFullYear();
      const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
      start = new Date(Date.UTC(year, monthIndex, 1));
      end = new Date(Date.UTC(year, monthIndex + 1, 1));
      labelMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    }

    const accounts = await this.prisma.account.findMany({
      where: { userId: user.id, archived: false },
      include: {
        transactions: { select: { amount: true } },
        holdings: { select: { currentValue: true } },
      },
    });

    const activeVaults = await this.prisma.accountVaultEntry.findMany({
      where: { account: { userId: user.id } },
      select: { accountId: true, last4: true },
    });

    const activeSips = (this.prisma as any).activeSip
      ? await (this.prisma as any).activeSip.findMany({
          where: { userId: user.id, status: 'ACTIVE' },
        })
      : [];

    const monthTransactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId: user.id },
        transactionDate: { gte: start, lt: end },
      },
      include: {
        category: true,
        account: { select: { id: true, name: true, type: true, institution: true } },
      },
      orderBy: { transactionDate: 'desc' },
    });

    const isInternalTransfer = (tx: (typeof monthTransactions)[0]) => {
      if (tx.transferGroupId) return true;
      for (const v of activeVaults) {
        if (v.last4 && v.accountId !== tx.accountId && tx.descriptionRaw.includes(v.last4)) {
          return true;
        }
      }
      return false;
    };

    const isRefundOrReversal = (tx: (typeof monthTransactions)[0]) => {
      if (tx.amount <= 0) return false;
      if (isInternalTransfer(tx)) return false;

      const desc = tx.descriptionRaw.toLowerCase();
      if (tx.account.type === 'CREDIT_CARD') {
        const isCcBillPayment = /payment\s*received|autopay|mobile\s*banking|imps|neft|upi\s*pay|bill\s*pay|thank\s*you|credit\s*card\s*payment/i.test(desc);
        if (isCcBillPayment) return false;
        return true;
      }

      const isExplicitRefund = /refund|reversal|returned|cashback|cb\s|credit\s*adj|cancelled/i.test(desc);
      return isExplicitRefund;
    };

    // Calculate Savings Net Inbound and Net Outbound across all SAVINGS/BANK accounts (excluding internal transfers & refunds)
    const savingsTransactions = monthTransactions.filter((t) => ['SAVINGS', 'BANK'].includes(t.account.type));
    const savingsNonTransfers = savingsTransactions.filter((t) => !isInternalTransfer(t));

    const savingsNetInbound = savingsNonTransfers
      .filter((t) => t.amount > 0 && !isRefundOrReversal(t))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const savingsNetOutbound = Math.abs(
      savingsNonTransfers
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Number(t.amount), 0),
    );

    // Detailed Account-Level Cash Flow (external inbounds, internal transfers, external outbounds)
    const savingsAccountsList = accounts.filter((a) => ['SAVINGS', 'BANK'].includes(a.type));
    const savingsMap = new Map<
      string,
      {
        id: string;
        name: string;
        type: string;
        institution: string | null;
        externalInbound: number;
        externalOutbound: number;
        creditCardPayments: number;
        investments: number;
        internalInbound: number;
        internalOutbound: number;
      }
    >();

    savingsAccountsList.forEach((acc) => {
      savingsMap.set(acc.id, {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        institution: acc.institution,
        externalInbound: 0,
        externalOutbound: 0,
        creditCardPayments: 0,
        investments: 0,
        internalInbound: 0,
        internalOutbound: 0,
      });
    });

    const internalTransfersList: Array<{
      fromAccountId: string;
      fromAccountName: string;
      toAccountId: string;
      toAccountName: string;
      toAccountType?: string;
      amount: number;
    }> = [];

    monthTransactions.forEach((tx) => {
      const accFlow = savingsMap.get(tx.accountId);
      if (!accFlow) return;

      const amt = Math.abs(Number(tx.amount));
      const internal = isInternalTransfer(tx);

      if (tx.amount > 0) {
        if (internal) {
          accFlow.internalInbound += amt;
        } else {
          accFlow.externalInbound += amt;
        }
      } else {
        let destAccountId: string | undefined;
        if (tx.transferGroupId) {
          const opposite = monthTransactions.find(
            (other) => other.transferGroupId === tx.transferGroupId && other.id !== tx.id,
          );
          if (opposite) destAccountId = opposite.accountId;
        } else {
          for (const v of activeVaults) {
            if (v.last4 && v.accountId !== tx.accountId && tx.descriptionRaw.includes(v.last4)) {
              destAccountId = v.accountId;
              break;
            }
          }
        }

        const destAcc = destAccountId ? accounts.find((a) => a.id === destAccountId) : undefined;
        const isCCCategory = Boolean(tx.category?.name && /^\s*cc transfer\s*$/i.test(tx.category.name));

        if (isCCCategory) {
          accFlow.creditCardPayments += amt;
          if (destAcc) {
            internalTransfersList.push({
              fromAccountId: tx.accountId,
              fromAccountName: accFlow.name,
              toAccountId: destAcc.id,
              toAccountName: destAcc.name,
              toAccountType: destAcc.type,
              amount: amt,
            });
          }
        } else if (internal) {
          accFlow.internalOutbound += amt;
          if (destAcc) {
            internalTransfersList.push({
              fromAccountId: tx.accountId,
              fromAccountName: accFlow.name,
              toAccountId: destAcc.id,
              toAccountName: destAcc.name,
              toAccountType: destAcc.type,
              amount: amt,
            });
          }
        } else {
          const matchesSip = activeSips.some((sip: any) => {
            const accountMatch = !sip.sourceAccountId || sip.sourceAccountId === tx.accountId;
            const descLower = tx.descriptionRaw.toLowerCase();
            const merchantLower = (tx.merchant || '').toLowerCase();
            const keywordMatch =
              (sip.billerKeyword && descLower.includes(sip.billerKeyword.toLowerCase())) ||
              (sip.name && descLower.includes(sip.name.toLowerCase())) ||
              (sip.destinationAccount && descLower.includes(sip.destinationAccount.toLowerCase())) ||
              (sip.name && merchantLower.includes(sip.name.toLowerCase()));
            return accountMatch && keywordMatch;
          });

          const isInvestmentCategory = tx.category?.name && /INVEST|MUTUAL|SIP|STOCK|BROKER/i.test(tx.category.name);
          const isInvestmentKeyword = /MUTUAL|FUND|ZERODHA|GROWW|BSE|NSE|SGB|NPS|INDIABULLS|ICICI PRUDENTIAL|MF CENTRAL|RAZORPAY MF|SIP/i.test(tx.descriptionRaw);

          if (matchesSip || isInvestmentCategory || isInvestmentKeyword) {
            accFlow.investments += amt;
          } else {
            accFlow.externalOutbound += amt;
          }
        }
      }
    });

    const totalCreditCardPayments = [...savingsMap.values()].reduce((sum, acc) => sum + acc.creditCardPayments, 0);
    const totalInvestments = [...savingsMap.values()].reduce((sum, acc) => sum + acc.investments, 0);

    const accountDetailedFlows = [...savingsMap.values()].map((acc) => {
      const accountTxs = monthTransactions.filter((t) => t.accountId === acc.id && t.amount < 0);
      const totalOutboundAmt = acc.externalOutbound + acc.creditCardPayments + acc.investments + acc.internalOutbound;

      const categoryMapAcc = new Map<string, { name: string; color: string; amount: number }>();
      accountTxs.forEach((t) => {
        const name = t.category?.name ?? 'Uncategorised';
        const color = t.category?.color ?? '#94a3b8';
        const amt = Math.abs(Number(t.amount));
        const current = categoryMapAcc.get(name) || { name, color, amount: 0 };
        categoryMapAcc.set(name, { name, color, amount: current.amount + amt });
      });

      const categories = [...categoryMapAcc.values()]
        .map((c) => ({
          ...c,
          percentage: totalOutboundAmt > 0 ? Math.round((c.amount / totalOutboundAmt) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const externalRecipientsMap = new Map<string, { name: string; amount: number; count: number; isInternal: false }>();
      const internalRecipientsMap = new Map<string, { name: string; amount: number; count: number; isInternal: true }>();
      const allRecipientsMap = new Map<string, { name: string; amount: number; count: number; isInternal: boolean }>();

      accountTxs.forEach((t) => {
        const amt = Math.abs(Number(t.amount));
        let destAccountId: string | undefined;
        if (t.transferGroupId) {
          const opposite = monthTransactions.find(
            (other) => other.transferGroupId === t.transferGroupId && other.id !== t.id,
          );
          if (opposite) destAccountId = opposite.accountId;
        } else {
          for (const v of activeVaults) {
            if (v.last4 && v.accountId !== t.accountId && t.descriptionRaw.includes(v.last4)) {
              destAccountId = v.accountId;
              break;
            }
          }
        }

        const destAcc = destAccountId ? accounts.find((a) => a.id === destAccountId) : undefined;
        const isCCCategory = Boolean(t.category?.name && /^\s*cc transfer\s*$/i.test(t.category.name));
        const internal = isInternalTransfer(t);

        const isInternalFlow = destAcc !== undefined || isCCCategory || internal;

        let name = '';
        if (destAcc) {
          name = destAcc.name;
        } else if (isCCCategory) {
          name = t.category?.name || 'Credit Card Payment';
        } else {
          name = extractBeneficiaryName(t.descriptionRaw) || t.merchant || t.descriptionRaw;
        }

        const key = name;
        if (isInternalFlow) {
          const current = internalRecipientsMap.get(key) || { name, amount: 0, count: 0, isInternal: true };
          internalRecipientsMap.set(key, { name, amount: current.amount + amt, count: current.count + 1, isInternal: true });
        } else {
          const current = externalRecipientsMap.get(key) || { name, amount: 0, count: 0, isInternal: false };
          externalRecipientsMap.set(key, { name, amount: current.amount + amt, count: current.count + 1, isInternal: false });
        }

        const allKey = `${name}_${isInternalFlow}`;
        const currentAll = allRecipientsMap.get(allKey) || { name, amount: 0, count: 0, isInternal: isInternalFlow };
        allRecipientsMap.set(allKey, { name, amount: currentAll.amount + amt, count: currentAll.count + 1, isInternal: isInternalFlow });
      });

      const sortedExternal = [...externalRecipientsMap.values()].sort((a, b) => b.amount - a.amount);
      const topExternalRecipients = sortedExternal.slice(0, 5);
      const remainingExternal = sortedExternal.slice(5);
      const otherExternalOutbound = {
        amount: remainingExternal.reduce((sum, r) => sum + r.amount, 0),
        count: remainingExternal.reduce((sum, r) => sum + r.count, 0),
      };

      const sortedInternal = [...internalRecipientsMap.values()].sort((a, b) => b.amount - a.amount);
      const topInternalRecipients = sortedInternal.slice(0, 5);
      const remainingInternal = sortedInternal.slice(5);
      const otherInternalOutbound = {
        amount: remainingInternal.reduce((sum, r) => sum + r.amount, 0),
        count: remainingInternal.reduce((sum, r) => sum + r.count, 0),
      };

      const topRecipients = [...allRecipientsMap.values()]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return {
        ...acc,
        totalInbound: acc.externalInbound + acc.internalInbound,
        totalOutbound: totalOutboundAmt,
        categories,
        topRecipients,
        topExternalRecipients,
        otherExternalOutbound,
        topInternalRecipients,
        otherInternalOutbound,
      };
    });

    // Category Flows for Stage 4 Sankey Diagram (Outbound, Credit Card, and Investments breakdown by Category with Refund Netting)
    const outboundCategoryMap = new Map<string, { name: string; color: string; amount: number }>();
    const creditCardCategoryMap = new Map<string, { name: string; color: string; amount: number }>();
    const investmentCategoryMap = new Map<string, { name: string; color: string; amount: number }>();
    const overallCategoryMap = new Map<string, { name: string; color: string; amount: number }>();

    monthTransactions
      .filter((item) => !isInternalTransfer(item))
      .forEach((item) => {
        const name = item.category?.name ?? 'Uncategorised';
        const color = item.category?.color ?? '#94a3b8';
        const isCCCategory = Boolean(item.category?.name && /^\s*cc transfer\s*$/i.test(item.category.name));
        if (isCCCategory) return;

        const isRefund = isRefundOrReversal(item);
        if (item.amount < 0 || isRefund) {
          const val = isRefund ? -Math.abs(Number(item.amount)) : Math.abs(Number(item.amount));

          // Overall
          const currOverall = overallCategoryMap.get(name) || { name, color, amount: 0 };
          overallCategoryMap.set(name, { name, color: currOverall.color, amount: Math.max(0, currOverall.amount + val) });

          // By Channel
          if (['SAVINGS', 'BANK'].includes(item.account.type)) {
            const matchesSip = activeSips.some((sip: any) => {
              const accountMatch = !sip.sourceAccountId || sip.sourceAccountId === item.accountId;
              const descLower = item.descriptionRaw.toLowerCase();
              const merchantLower = (item.merchant || '').toLowerCase();
              const keywordMatch =
                (sip.billerKeyword && descLower.includes(sip.billerKeyword.toLowerCase())) ||
                (sip.name && descLower.includes(sip.name.toLowerCase())) ||
                (sip.destinationAccount && descLower.includes(sip.destinationAccount.toLowerCase())) ||
                (sip.name && merchantLower.includes(sip.name.toLowerCase()));
              return accountMatch && keywordMatch;
            });

            const isInvestmentCategory = item.category?.name && /INVEST|MUTUAL|SIP|STOCK|BROKER/i.test(item.category.name);
            const isInvestmentKeyword = /MUTUAL|FUND|ZERODHA|GROWW|BSE|NSE|SGB|NPS|INDIABULLS|ICICI PRUDENTIAL|MF CENTRAL|RAZORPAY MF|SIP/i.test(item.descriptionRaw);

            if (matchesSip || isInvestmentCategory || isInvestmentKeyword) {
              const invName = item.category?.name || 'Investment';
              const currInv = investmentCategoryMap.get(invName) || { name: invName, color: item.category?.color ?? '#8b5cf6', amount: 0 };
              investmentCategoryMap.set(invName, { name: invName, color: currInv.color, amount: Math.max(0, currInv.amount + val) });
            } else {
              const currOut = outboundCategoryMap.get(name) || { name, color, amount: 0 };
              outboundCategoryMap.set(name, { name, color: currOut.color, amount: Math.max(0, currOut.amount + val) });
            }
          } else if (['CREDIT_CARD'].includes(item.account.type)) {
            const currCc = creditCardCategoryMap.get(name) || { name, color, amount: 0 };
            creditCardCategoryMap.set(name, { name, color: currCc.color, amount: Math.max(0, currCc.amount + val) });
          }
        }
      });

    const outboundCategories = [...outboundCategoryMap.values()].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
    const creditCardCategories = [...creditCardCategoryMap.values()].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
    let investmentCategories = [...investmentCategoryMap.values()].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);

    if (investmentCategories.length === 0 && totalInvestments > 0) {
      investmentCategories = [{ name: 'Investment', color: '#8b5cf6', amount: totalInvestments }];
    }

    const accountFlowData = {
      accounts: accountDetailedFlows,
      internalTransfers: internalTransfersList,
      overall: {
        totalExternalInbound: savingsNetInbound,
        totalExternalOutbound: Math.max(0, savingsNetOutbound - totalInvestments - totalCreditCardPayments),
        totalCreditCardPayments,
        totalInvestments,
        totalInternalTransfers: internalTransfersList.reduce((sum, item) => sum + item.amount, 0),
        categoryFlow: {
          outboundCategories,
          creditCardCategories,
          investmentCategories,
          overallCategories: [...overallCategoryMap.values()].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount),
        },
      },
    };

    const nonTransfers = monthTransactions.filter((item) => !isInternalTransfer(item));
    const income = nonTransfers
      .filter((item) => item.amount > 0 && !isRefundOrReversal(item))
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const grossDebits = Math.abs(nonTransfers.filter((item) => item.amount < 0).reduce((sum, item) => sum + Number(item.amount), 0));
    const totalRefunds = nonTransfers.filter((item) => isRefundOrReversal(item)).reduce((sum, item) => sum + Number(item.amount), 0);
    const totalExpenses = Math.max(0, grossDebits - totalRefunds);

    // Spend Analysis Breakdown: Consumption vs Outbound Transfers vs Investments
    let outboundTotal = 0;
    let investmentTotal = 0;
    const recipientMap = new Map<string, { name: string; amount: number; count: number }>();

    nonTransfers
      .filter((item) => item.amount < 0)
      .forEach((item) => {
        const amt = Math.abs(Number(item.amount));
        const isInvestmentAccount = ['INVESTMENT', 'STOCKS', 'EPFO', 'FIXED_DEPOSIT'].includes(item.account.type);
        const isInvestmentKeyword = /MUTUAL|FUND|ZERODHA|GROWW|BSE|NSE|SGB|NPS|SIP/i.test(item.descriptionRaw);

        if (isInvestmentAccount || isInvestmentKeyword) {
          investmentTotal += amt;
        } else {
          const payee = extractBeneficiaryName(item.descriptionRaw) || item.merchant;
          if (payee) {
            outboundTotal += amt;
            const current = recipientMap.get(payee) || { name: payee, amount: 0, count: 0 };
            recipientMap.set(payee, { name: payee, amount: current.amount + amt, count: current.count + 1 });
          }
        }
      });

    const consumption = Math.max(0, totalExpenses - outboundTotal - investmentTotal);

    const balances = accounts.map((account) => {
      const ledgerBalance = Number(account.openingBalance) + account.transactions.reduce((sum, row) => sum + Number(row.amount), 0);
      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const hasCompleteValuation = account.holdings.length > 0 && account.holdings.every((holding) => holding.currentValue !== null);
      const balance = isPortfolio && hasCompleteValuation
        ? account.holdings.reduce((sum, holding) => sum + Number(holding.currentValue), 0)
        : ledgerBalance;
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        balance,
        creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
        dueDay: account.dueDay,
      };
    });

    const savingsMonthTransactions = monthTransactions.filter((item) =>
      ['SAVINGS', 'BANK'].includes(item.account.type),
    );

    const topOutboundRecipients = [...recipientMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      month: labelMonth,
      income,
      expenses: totalExpenses,
      savings: income - totalExpenses,
      savingsRate: income > 0 ? Math.round(((income - totalExpenses) / income) * 1000) / 10 : 0,
      savingsNetInbound,
      savingsNetOutbound,
      accountFlow: accountFlowData,
      netWorth: balances.reduce((sum, account) => sum + account.balance, 0),
      accounts: balances,
      spendAnalysis: {
        consumption,
        outboundTransfers: outboundTotal,
        investments: investmentTotal,
      },
      topOutboundRecipients,
      categories: [...overallCategoryMap.values()].sort((a, b) => b.amount - a.amount),
      recent: savingsMonthTransactions.slice(0, 8).map((item) => ({
        id: item.id,
        date: item.transactionDate,
        description: item.merchant || item.descriptionRaw,
        amount: Number(item.amount),
        category: item.category?.name ?? 'Uncategorised',
        account: item.account.name,
        isTransfer: Boolean(item.transferGroupId),
      })),
    };
  }

  @Get('assets-history')
  async getAssetsHistory(@CurrentUser() user: { id: string }) {
    // Include Asset accounts + LOAN accounts (Exclude UPI_LITE and CREDIT_CARD)
    const accounts = await this.prisma.account.findMany({
      where: {
        userId: user.id,
        archived: false,
        type: {
          in: [
            AccountType.SAVINGS,
            AccountType.BANK,
            AccountType.FIXED_DEPOSIT,
            AccountType.CASH,
            AccountType.INVESTMENT,
            AccountType.STOCKS,
            AccountType.EPFO,
            AccountType.LOAN,
          ],
        },
      },
      include: {
        transactions: {
          select: { id: true, amount: true, transactionDate: true },
          orderBy: { transactionDate: 'asc' },
        },
        holdings: {
          include: { asset: true },
        },
        loans: {
          include: {
            installments: {
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    });

    const now = new Date();
    const months: { label: string; year: number; month: number; start: Date; end: Date }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const monthLabel = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + ' ' + String(year).slice(2);
      const start = new Date(Date.UTC(year, month, 1));
      const end = new Date(Date.UTC(year, month + 1, 1));
      months.push({ label: monthLabel, year, month, start, end });
    }

    let savingsTotal = 0;
    let depositsTotal = 0;
    let stocksTotal = 0;
    let mutualFundsTotal = 0;
    let epfoTotal = 0;
    let debtTotal = 0;

    const accountBreakdown = accounts.map((account: any) => {
      let balance = 0;
      const isLoan = account.type === 'LOAN';
      const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
      const holdingsList = account.holdings || [];

      if (isLoan) {
        const loan = (account.loans || [])[0];
        if (loan) {
          const paidInsts = (loan.installments || []).filter((i: any) => i.status === 'PAID');
          let loanOutstanding = Number(loan.principal);
          if (paidInsts.length > 0) {
            const lastPaid = paidInsts[paidInsts.length - 1];
            loanOutstanding = Number(lastPaid.balance);
          }
          balance = -loanOutstanding;
        } else {
          const ledgerBalance = Number(account.openingBalance) + (account.transactions || []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
          balance = ledgerBalance < 0 ? ledgerBalance : -ledgerBalance;
        }
      } else {
        const ledgerBalance = Number(account.openingBalance) + (account.transactions || []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
        const hasCompleteValuation = holdingsList.length > 0 && holdingsList.every((holding: any) => holding.currentValue !== null);
        balance = isPortfolio && hasCompleteValuation
          ? holdingsList.reduce((sum: number, holding: any) => sum + Number(holding.currentValue), 0)
          : ledgerBalance;
      }

      // Classify asset category
      let category = 'SAVINGS';
      const nameLower = (account.name + ' ' + (account.institution || '')).toLowerCase();
      if (isLoan) {
        category = 'DEBT';
        debtTotal += Math.abs(balance);
      } else if (account.type === 'FIXED_DEPOSIT' || nameLower.includes('fixed deposit') || nameLower.includes('fd-') || nameLower.includes('-fd')) {
        category = 'DEPOSITS';
        if (balance > 0) depositsTotal += balance;
      } else if (account.type === 'EPFO' || nameLower.includes('epfo') || nameLower.includes('provident')) {
        category = 'EPFO';
        if (balance > 0) epfoTotal += balance;
      } else if (account.type === 'STOCKS' || nameLower.includes('zerodha') || nameLower.includes('demat') || nameLower.includes('stocks')) {
        if (nameLower.includes('mf') || nameLower.includes('mutual fund') || nameLower.includes('groww')) {
          category = 'MUTUAL_FUNDS';
          if (balance > 0) mutualFundsTotal += balance;
        } else {
          category = 'STOCKS';
          if (balance > 0) stocksTotal += balance;
        }
      } else if (account.type === 'INVESTMENT' || nameLower.includes('mutual') || nameLower.includes('fund') || nameLower.includes('sip')) {
        category = 'MUTUAL_FUNDS';
        if (balance > 0) mutualFundsTotal += balance;
      } else {
        category = 'SAVINGS';
        if (balance > 0) savingsTotal += balance;
      }

      const investedValue = holdingsList.reduce((sum: number, h: any) => {
        if (h.averagePrice && h.quantity) {
          return sum + Number(h.averagePrice) * Number(h.quantity);
        }
        return sum;
      }, 0);

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        category,
        institution: account.institution,
        balance,
        investedValue: investedValue > 0 ? Math.round(investedValue) : null,
        unrealizedPnl: investedValue > 0 ? balance - Math.round(investedValue) : null,
        holdingCount: holdingsList.length,
        holdings: holdingsList.map((h: any) => ({
          symbol: h.asset?.symbol ?? 'ASSET',
          name: h.asset?.name ?? 'Asset Position',
          category: h.asset?.sector ?? h.asset?.assetType ?? 'Equity',
          quantity: Number(h.quantity),
          averagePrice: h.averagePrice !== null ? Number(h.averagePrice) : null,
          currentValue: h.currentValue !== null ? Number(h.currentValue) : null,
          unrealizedPnl: h.unrealizedPnl !== null ? Number(h.unrealizedPnl) : null,
        })),
      };
    });

    const totalAssets = savingsTotal + depositsTotal + stocksTotal + mutualFundsTotal + epfoTotal;
    const netWorth = totalAssets - debtTotal;

    const history = months.map((m) => {
      let savings = 0;
      let deposits = 0;
      let stocks = 0;
      let mutualFunds = 0;
      let epfo = 0;
      let debt = 0;

      accounts.forEach((account: any) => {
        if (account.type === 'LOAN') {
          const loan = (account.loans || [])[0];
          if (loan) {
            const paidUpToMonth = (loan.installments || []).filter(
              (i: any) => i.status === 'PAID' && ((i.confirmedAt && new Date(i.confirmedAt) < m.end) || new Date(i.dueDate) < m.end)
            );
            let out = Number(loan.principal);
            if (paidUpToMonth.length > 0) {
              const lastPaid = paidUpToMonth[paidUpToMonth.length - 1];
              out = Number(lastPaid.balance);
            }
            debt += out;
          } else {
            const txsUpToMonth = (account.transactions || []).filter((tx: any) => new Date(tx.transactionDate) < m.end);
            const cumLedger = Number(account.openingBalance) + txsUpToMonth.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
            debt += Math.abs(cumLedger);
          }
          return;
        }

        const txsUpToMonth = (account.transactions || []).filter((tx: any) => new Date(tx.transactionDate) < m.end);
        const cumLedger = Number(account.openingBalance) + txsUpToMonth.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
        const isPortfolio = account.type === 'INVESTMENT' || account.type === 'STOCKS';
        const holdingsList = account.holdings || [];
        const hasCompleteValuation = holdingsList.length > 0 && holdingsList.every((holding: any) => holding.currentValue !== null);
        const bal = isPortfolio && hasCompleteValuation
          ? holdingsList.reduce((sum: number, holding: any) => sum + Number(holding.currentValue), 0)
          : cumLedger;

        if (bal <= 0) return;

        const nameLower = (account.name + ' ' + (account.institution || '')).toLowerCase();
        if (account.type === 'FIXED_DEPOSIT' || nameLower.includes('fixed deposit') || nameLower.includes('fd-') || nameLower.includes('-fd')) {
          deposits += bal;
        } else if (account.type === 'EPFO' || nameLower.includes('epfo') || nameLower.includes('provident')) {
          epfo += bal;
        } else if (account.type === 'STOCKS' || nameLower.includes('zerodha') || nameLower.includes('demat') || nameLower.includes('stocks')) {
          if (nameLower.includes('mf') || nameLower.includes('mutual fund') || nameLower.includes('groww')) {
            mutualFunds += bal;
          } else {
            stocks += bal;
          }
        } else if (account.type === 'INVESTMENT' || nameLower.includes('mutual') || nameLower.includes('fund') || nameLower.includes('sip')) {
          mutualFunds += bal;
        } else {
          savings += bal;
        }
      });

      const monthTotalAssets = savings + deposits + stocks + mutualFunds + epfo;

      return {
        month: m.label,
        savings,
        deposits,
        stocks,
        mutualFunds,
        epfo,
        debt,
        totalAssets: monthTotalAssets,
        netWorth: monthTotalAssets - debt,
      };
    });

    const allocation = {
      savings: { amount: savingsTotal, percentage: totalAssets > 0 ? Math.round((savingsTotal / totalAssets) * 1000) / 10 : 0 },
      deposits: { amount: depositsTotal, percentage: totalAssets > 0 ? Math.round((depositsTotal / totalAssets) * 1000) / 10 : 0 },
      stocks: { amount: stocksTotal, percentage: totalAssets > 0 ? Math.round((stocksTotal / totalAssets) * 1000) / 10 : 0 },
      mutualFunds: { amount: mutualFundsTotal, percentage: totalAssets > 0 ? Math.round((mutualFundsTotal / totalAssets) * 1000) / 10 : 0 },
      epfo: { amount: epfoTotal, percentage: totalAssets > 0 ? Math.round((epfoTotal / totalAssets) * 1000) / 10 : 0 },
      debt: { amount: debtTotal, percentage: totalAssets > 0 ? Math.round((debtTotal / totalAssets) * 1000) / 10 : 0 },
    };

    return {
      netWorth,
      totalAssets,
      savingsTotal,
      depositsTotal,
      stocksTotal,
      mutualFundsTotal,
      epfoTotal,
      debtTotal,
      allocation,
      accounts: accountBreakdown,
      history,
    };
  }
}
