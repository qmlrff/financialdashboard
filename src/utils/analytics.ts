import {
  Transaction,
  CategoryBudget,
  AccountSummary,
  AccountSummaryWithTrend,
  MonthlyCashflow,
  BalancePoint,
  PeriodInfo,
} from '../types/finance';

/**
 * Checks whether a category represents a Balance Adjustment.
 * Balance Adjustments adjust account balances, but must NOT add up to income, expense, and cashflow.
 */
export function isBalanceAdjustment(category?: string | null): boolean {
  if (!category) return false;
  const clean = category.trim().toLowerCase();
  return clean === 'balance adjustment' || clean === 'balance adjustments';
}

/**
 * Computes category budgets, actual spent, and variances.
 * If user has customized limits, those are preserved; otherwise an intelligent baseline is calculated.
 */
export function calculateCategoryBudgets(
  transactions: Transaction[],
  customLimits: Record<string, number> = {},
  scaleFactor: number = 1.0,
  fullTransactions?: Transaction[]
): CategoryBudget[] {
  const allTx = fullTransactions || transactions;
  const allExpenseTx = allTx.filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category));

  // Find unique months across full dataset to calculate baseline monthly averages
  const monthSet = new Set<string>();
  allTx.forEach(t => {
    const key = `${t.date.getFullYear()}-${(t.date.getMonth() + 1).toString().padStart(2, '0')}`;
    monthSet.add(key);
  });
  const monthCount = Math.max(1, monthSet.size);

  // Group all categories to ensure all categories exist in budget list
  const fullCategoryMap = new Map<string, { totalHistoricalSpent: number }>();
  allExpenseTx.forEach(t => {
    const cat = t.category || 'Uncategorized';
    if (!fullCategoryMap.has(cat)) {
      fullCategoryMap.set(cat, { totalHistoricalSpent: 0 });
    }
    fullCategoryMap.get(cat)!.totalHistoricalSpent += t.amount;
  });

  // Group period expenses (excluding balance adjustments)
  const periodExpenseTx = transactions.filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category));
  const periodMap = new Map<string, {
    totalSpent: number;
    count: number;
    subcategories: Map<string, number>;
  }>();

  periodExpenseTx.forEach(t => {
    const cat = t.category || 'Uncategorized';
    if (!periodMap.has(cat)) {
      periodMap.set(cat, { totalSpent: 0, count: 0, subcategories: new Map() });
    }
    const data = periodMap.get(cat)!;
    data.totalSpent += t.amount;
    data.count += 1;

    const sub = t.subcategory || 'General';
    data.subcategories.set(sub, (data.subcategories.get(sub) || 0) + t.amount);
  });

  const budgets: CategoryBudget[] = [];

  fullCategoryMap.forEach((histData, category) => {
    const monthlyAverage = histData.totalHistoricalSpent / monthCount;

    // Monthly base limit
    let monthlyLimit: number;
    if (customLimits[category] !== undefined) {
      monthlyLimit = customLimits[category];
    } else {
      const target = monthlyAverage * 1.05;
      monthlyLimit = target < 100 ? Math.ceil(target / 10) * 10 : Math.ceil(target / 50) * 50;
      if (monthlyLimit === 0) monthlyLimit = 100;
    }

    // Proportionally scaled limit for current timeframe
    const scaledLimit = Math.max(1, monthlyLimit * scaleFactor);

    const periodData = periodMap.get(category) || {
      totalSpent: 0,
      count: 0,
      subcategories: new Map(),
    };

    const variance = scaledLimit - periodData.totalSpent;
    const percentUsed = scaledLimit > 0 ? (periodData.totalSpent / scaledLimit) * 100 : 0;

    const subcategories = Array.from(periodData.subcategories.entries()).map(([name, amount]) => ({
      name,
      amount,
    })).sort((a, b) => b.amount - a.amount);

    budgets.push({
      category,
      monthlyLimit,
      scaledLimit,
      actualSpent: periodData.totalSpent,
      variance,
      percentUsed,
      transactionCount: periodData.count,
      subcategories,
    });
  });

  // Sort by highest spent in current period, or by monthly limit
  return budgets.sort((a, b) => {
    if (b.actualSpent !== a.actualSpent) return b.actualSpent - a.actualSpent;
    return b.monthlyLimit - a.monthlyLimit;
  });
}

/**
 * Computes per-account latest balance and metrics
 */
export function calculateAccountSummaries(transactions: Transaction[]): AccountSummary[] {
  const accountMap = new Map<string, {
    latestBalance: number;
    latestDate: number;
    currency: string;
    count: number;
    totalIncome: number;
    totalExpense: number;
  }>();

  transactions.forEach(t => {
    const acc = t.account || 'Default Account';
    if (!accountMap.has(acc)) {
      accountMap.set(acc, {
        latestBalance: t.accountBalance,
        latestDate: t.date.getTime(),
        currency: t.currency || 'USD',
        count: 0,
        totalIncome: 0,
        totalExpense: 0,
      });
    }

    const item = accountMap.get(acc)!;
    item.count += 1;
    // Balance Adjustments adjust account balance, but do not add up to income, expense and cashflow
    if (t.type === 'Income' && !isBalanceAdjustment(t.category)) item.totalIncome += t.amount;
    if (t.type === 'Expense' && !isBalanceAdjustment(t.category)) item.totalExpense += t.amount;

    // Track the latest balance by date (balance adjustments DO properly reflect in running and ending balance)
    if (t.date.getTime() >= item.latestDate) {
      item.latestDate = t.date.getTime();
      item.latestBalance = t.accountBalance;
      item.currency = t.currency || item.currency;
    }
  });

  return Array.from(accountMap.entries()).map(([name, val]) => ({
    name,
    latestBalance: val.latestBalance,
    currency: val.currency,
    transactionCount: val.count,
    totalIncome: val.totalIncome,
    totalExpense: val.totalExpense,
  })).sort((a, b) => b.latestBalance - a.latestBalance);
}

/**
 * Computes per-account balances and metrics, enriched with period trend indicators
 * comparing period ending balance to the previous period's ending balance (or baseline starting balance).
 */
export function calculateAccountSummariesWithTrends(
  allTransactions: Transaction[],
  initialBalances: Record<string, number> = {},
  activePeriod?: PeriodInfo,
  previousPeriod?: PeriodInfo
): AccountSummaryWithTrend[] {
  // Group all transactions by account name
  const accountTxMap = new Map<string, Transaction[]>();

  allTransactions.forEach(t => {
    const acc = t.account || 'Default Account';
    if (!accountTxMap.has(acc)) {
      accountTxMap.set(acc, []);
    }
    accountTxMap.get(acc)!.push(t);
  });

  // Also include any accounts that only exist in initialBalances
  Object.keys(initialBalances).forEach(acc => {
    if (!accountTxMap.has(acc)) {
      accountTxMap.set(acc, []);
    }
  });

  const results: AccountSummaryWithTrend[] = [];

  accountTxMap.forEach((txList, accountName) => {
    // Sort transactions chronologically ascending
    const sorted = [...txList].sort((a, b) => a.date.getTime() - b.date.getTime());

    let totalIncome = 0;
    let totalExpense = 0;
    let currency = 'USD';

    sorted.forEach(t => {
      currency = t.currency || currency;
      if (t.type === 'Income' && !isBalanceAdjustment(t.category)) {
        totalIncome += t.amount;
      } else if (t.type === 'Expense' && !isBalanceAdjustment(t.category)) {
        totalExpense += t.amount;
      }
    });

    const initBal = initialBalances[accountName] ?? 0;
    const latestBalance = sorted.length > 0 ? sorted[sorted.length - 1].accountBalance : initBal;

    // 1. Balance at the end of the active period
    let currentBalance: number;
    let periodTxCount = 0;

    if (activePeriod && activePeriod.unit !== 'all') {
      const activeEndMs = activePeriod.end.getTime();
      const activeStartMs = activePeriod.start.getTime();
      const txUpToActiveEnd = sorted.filter(t => t.date.getTime() <= activeEndMs);

      currentBalance = txUpToActiveEnd.length > 0 ? txUpToActiveEnd[txUpToActiveEnd.length - 1].accountBalance : initBal;
      periodTxCount = sorted.filter(t => t.date.getTime() >= activeStartMs && t.date.getTime() <= activeEndMs).length;
    } else {
      currentBalance = latestBalance;
      periodTxCount = sorted.length;
    }

    // 2. Balance at the end of the previous period (or before active period start)
    let previousBalance: number;
    let comparisonLabel: string;

    if (previousPeriod) {
      const prevEndMs = previousPeriod.end.getTime();
      const txUpToPrevEnd = sorted.filter(t => t.date.getTime() <= prevEndMs);
      previousBalance = txUpToPrevEnd.length > 0 ? txUpToPrevEnd[txUpToPrevEnd.length - 1].accountBalance : initBal;
      comparisonLabel = previousPeriod.label;
    } else if (activePeriod && activePeriod.unit !== 'all') {
      const activeStartMs = activePeriod.start.getTime();
      const txBeforeActiveStart = sorted.filter(t => t.date.getTime() < activeStartMs);
      previousBalance = txBeforeActiveStart.length > 0 ? txBeforeActiveStart[txBeforeActiveStart.length - 1].accountBalance : initBal;
      comparisonLabel = txBeforeActiveStart.length > 0 ? 'prior period' : 'initial starting balance';
    } else {
      previousBalance = initBal;
      comparisonLabel = 'initial starting balance';
    }

    // 3. Difference and percentage change
    const changeAmount = Math.round((currentBalance - previousBalance) * 100) / 100;
    let percentChange = 0;
    let percentStr = '0.0%';
    let direction: 'up' | 'down' | 'neutral' = 'neutral';

    if (Math.abs(changeAmount) < 0.005) {
      direction = 'neutral';
      percentChange = 0;
      percentStr = '0.0%';
    } else if (previousBalance === 0) {
      if (changeAmount > 0) {
        direction = 'up';
        percentChange = 100;
        percentStr = '+100%';
      } else {
        direction = 'down';
        percentChange = -100;
        percentStr = '-100%';
      }
    } else {
      const rawPct = (changeAmount / Math.abs(previousBalance)) * 100;
      percentChange = Math.round(rawPct * 10) / 10;
      if (changeAmount > 0) {
        direction = 'up';
        percentStr = `+${Math.abs(percentChange).toFixed(1)}%`;
      } else {
        direction = 'down';
        percentStr = `-${Math.abs(percentChange).toFixed(1)}%`;
      }
    }

    // 4. Clear explanatory tooltip
    let tooltip: string;
    if (direction === 'up') {
      tooltip = `Balance increased by ${formatCurrency(changeAmount, currency)} (${percentStr}) from ${formatCurrency(previousBalance, currency)} to ${formatCurrency(currentBalance, currency)} vs ${comparisonLabel}`;
    } else if (direction === 'down') {
      tooltip = `Balance decreased by ${formatCurrency(Math.abs(changeAmount), currency)} (${percentStr}) from ${formatCurrency(previousBalance, currency)} to ${formatCurrency(currentBalance, currency)} vs ${comparisonLabel}`;
    } else {
      tooltip = `Balance remained unchanged at ${formatCurrency(currentBalance, currency)} (0.0% change vs ${comparisonLabel})`;
    }

    results.push({
      name: accountName,
      latestBalance,
      currentBalance,
      currency,
      transactionCount: sorted.length,
      periodTxCount,
      totalIncome,
      totalExpense,
      trend: {
        currentBalance,
        previousBalance,
        changeAmount,
        percentChange,
        percentStr,
        direction,
        tooltip,
        comparisonLabel,
        periodTxCount,
        totalTxCount: sorted.length,
      },
    });
  });

  return results.sort((a, b) => b.currentBalance - a.currentBalance);
}

/**
 * Computes monthly aggregated cashflow (Income vs Expense vs Net)
 * Balance Adjustments are filtered out so they do not add up to income, expense or net cashflow.
 */
export function calculateMonthlyCashflow(transactions: Transaction[]): MonthlyCashflow[] {
  const monthMap = new Map<string, { income: number; expense: number; date: Date }>();

  transactions.forEach(t => {
    const y = t.date.getFullYear();
    const m = (t.date.getMonth() + 1).toString().padStart(2, '0');
    const key = `${y}-${m}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, { income: 0, expense: 0, date: new Date(y, t.date.getMonth(), 1) });
    }

    const data = monthMap.get(key)!;
    // Exclude Balance Adjustment from cashflow totals
    if (t.type === 'Income' && !isBalanceAdjustment(t.category)) data.income += t.amount;
    if (t.type === 'Expense' && !isBalanceAdjustment(t.category)) data.expense += t.amount;
  });

  const sortedKeys = Array.from(monthMap.keys()).sort();

  return sortedKeys.map(key => {
    const data = monthMap.get(key)!;
    const monthLabel = data.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return {
      monthKey: key,
      monthLabel,
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
    };
  });
}

/**
 * Extracts chronological balance data points for account balance timelines
 */
export function calculateBalancePoints(
  transactions: Transaction[],
  selectedAccount: string = 'all'
): BalancePoint[] {
  const filtered = selectedAccount === 'all'
    ? transactions
    : transactions.filter(t => t.account === selectedAccount);

  // Sort chronological ascending (oldest first)
  const sorted = [...filtered].sort((a, b) => a.date.getTime() - b.date.getTime());

  return sorted.map(t => ({
    date: t.date,
    dateStr: t.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    account: t.account,
    balance: t.accountBalance,
    currency: t.currency,
  }));
}

/**
 * Formats monetary amounts with commas, fixed 2 decimals, and currency symbol
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'AU$',
    MYR: 'RM',
    SGD: 'S$',
    CHF: 'CHF ',
  };

  const sym = symbols[currency.toUpperCase()] || `${currency} `;
  return `${sign}${sym}${abs}`;
}
