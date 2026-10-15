import React from 'react';
import { ArrowUpRight, ArrowDownRight, Wallet, DollarSign, Calendar, Landmark } from 'lucide-react';
import { Transaction, AccountSummary } from '../types/finance';
import { formatCurrency, isBalanceAdjustment } from '../utils/analytics';

interface SummaryCardsProps {
  transactions: Transaction[];
  accountSummaries: AccountSummary[];
  isDark: boolean;
  filename: string;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  transactions,
  accountSummaries,
  isDark,
  filename,
}) => {
  // If category = Balance Adjustment, do not add up to income, expense and cashflow
  const totalIncome = transactions
    .filter(t => t.type === 'Income' && !isBalanceAdjustment(t.category))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category))
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashflow = totalIncome - totalExpense;

  const balanceAdjustmentCount = transactions.filter(t => isBalanceAdjustment(t.category)).length;

  const totalBalance = accountSummaries.reduce((sum, acc) => sum + acc.latestBalance, 0);
  const primaryCurrency = transactions[0]?.currency || 'USD';

  // Find min/max dates
  const timestamps = transactions.map(t => t.date.getTime()).filter(t => !isNaN(t));
  const minDate = timestamps.length ? new Date(Math.min(...timestamps)) : null;
  const maxDate = timestamps.length ? new Date(Math.max(...timestamps)) : null;

  const formatDateRange = () => {
    if (!minDate || !maxDate) return 'All Recorded Dates';
    const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${minDate.toLocaleDateString('en-US', opt)} - ${maxDate.toLocaleDateString('en-US', opt)}`;
  };

  const savingsRate = totalIncome > 0 ? ((netCashflow / totalIncome) * 100).toFixed(1) : null;

  return (
    <div className="space-y-4">
      {/* File metadata strip */}
      <div className={`flex flex-wrap items-center justify-between text-xs py-2 px-4 rounded-xl border ${
        isDark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          <span>{formatDateRange()}</span>
          <span aria-hidden="true">·</span>
          <span>{transactions.length} transactions</span>
          <span aria-hidden="true">·</span>
          <span>{accountSummaries.length} active accounts</span>
          {balanceAdjustmentCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-500 font-medium">
                {balanceAdjustmentCount} Balance Adjustment{balanceAdjustmentCount > 1 ? 's' : ''} (excluded from cashflow)
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] truncate max-w-xs">
          <span>Source: {filename}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className={`p-5 rounded-2xl border transition-colors ${
          isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs uppercase tracking-wider ${
              isDark ? 'text-zinc-400 font-medium' : 'text-slate-600 font-semibold'
            }`}>
              Total Income
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalIncome, primaryCurrency)}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {transactions.filter(t => t.type === 'Income' && !isBalanceAdjustment(t.category)).length} credited inflows
            </p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className={`p-5 rounded-2xl border transition-colors ${
          isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs uppercase tracking-wider ${
              isDark ? 'text-zinc-400 font-medium' : 'text-slate-600 font-semibold'
            }`}>
              Total Expenses
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {formatCurrency(totalExpense, primaryCurrency)}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {transactions.filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category)).length} recorded outlays
            </p>
          </div>
        </div>

        {/* Net Cashflow */}
        <div className={`p-5 rounded-2xl border transition-colors ${
          isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs uppercase tracking-wider ${
              isDark ? 'text-zinc-400 font-medium' : 'text-slate-600 font-semibold'
            }`}>
              Net Cashflow
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              netCashflow >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
            }`}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold font-mono tabular-nums ${
              netCashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {formatCurrency(netCashflow, primaryCurrency)}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {savingsRate !== null ? `Net Margin / Savings: ${savingsRate}%` : 'Net period change'}
            </p>
          </div>
        </div>

        {/* Total Account Balances */}
        <div className={`p-5 rounded-2xl border transition-colors ${
          isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs uppercase tracking-wider ${
              isDark ? 'text-zinc-400 font-medium' : 'text-slate-600 font-semibold'
            }`}>
              Latest Net Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold font-mono tabular-nums ${
              isDark ? 'text-zinc-100' : 'text-slate-900'
            }`}>
              {formatCurrency(totalBalance, primaryCurrency)}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
              Sum of latest balances across {accountSummaries.length} accounts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
