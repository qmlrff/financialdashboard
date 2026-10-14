export type TransactionType = 'Income' | 'Expense' | 'Transfer';

export interface Transaction {
  id: string;
  date: Date;
  rawDateStr: string;
  account: string;
  category: string;
  subcategory: string;
  notes: string;
  type: TransactionType;
  description: string;
  amount: number;
  currency: string;
  accountBalance: number;
  fromAccount?: string; // Money from (extracted from Column B / B1)
  toAccount?: string;   // Money to (extracted from Column C / C1)
  transferDirection?: 'outflow' | 'inflow';
}

export interface CategoryBudget {
  category: string;
  monthlyLimit: number;
  scaledLimit: number;
  actualSpent: number;
  variance: number; // positive = under budget, negative = overrun
  percentUsed: number;
  transactionCount: number;
  subcategories: { name: string; amount: number }[];
}

export interface FilterState {
  dateRange: { start: string; end: string };
  selectedAccount: string;
  selectedCategory: string;
  selectedType: 'All' | TransactionType;
  searchQuery: string;
}

export interface AccountSummary {
  name: string;
  latestBalance: number;
  currency: string;
  transactionCount: number;
  totalIncome: number;
  totalExpense: number;
}

export interface MonthlyCashflow {
  monthKey: string; // '2026-10'
  monthLabel: string; // 'Oct 2026'
  income: number;
  expense: number;
  net: number;
}

export interface BalancePoint {
  date: Date;
  dateStr: string;
  account: string;
  balance: number;
  currency: string;
}

export type TimeframeUnit = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'all';

export interface PeriodInfo {
  unit: TimeframeUnit;
  key: string;
  label: string;
  start: Date;
  end: Date;
  scaleFactor: number;
}

export type AnomalyType = 'outlier_amount' | 'category_surge' | 'potential_duplicate' | 'balance_drain';
export type AnomalySeverity = 'high' | 'medium' | 'low';

export interface FinancialAnomaly {
  id: string;
  transactionId?: string;
  transaction?: Transaction;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  category: string;
  account: string;
  date: Date;
  rawDateStr: string;
  amount: number;
  expectedAmount: number;
  deviationPercent: number;
  deviationMultiplier: number;
  reason: string;
  currency: string;
}
