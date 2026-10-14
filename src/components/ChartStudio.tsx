import React, { useState, useMemo } from 'react';
import { BarChart3, LineChart as LineIcon, PieChart, TrendingUp, Layers, Filter } from 'lucide-react';
import { Transaction, CategoryBudget, AccountSummary, MonthlyCashflow, BalancePoint } from '../types/finance';
import { formatCurrency, calculateMonthlyCashflow, calculateBalancePoints, isBalanceAdjustment } from '../utils/analytics';

interface ChartStudioProps {
  transactions: Transaction[];
  budgets: CategoryBudget[];
  accountSummaries: AccountSummary[];
  isDark: boolean;
  currency: string;
  periodLabel?: string;
}

type ChartDimension = 'category_expense' | 'budget_variance' | 'cashflow' | 'balance_timeline' | 'top_merchants';
type ChartType = 'bar' | 'donut' | 'line';

export const ChartStudio: React.FC<ChartStudioProps> = ({
  transactions,
  budgets,
  accountSummaries,
  isDark,
  currency,
  periodLabel,
}) => {
  const [dimension, setDimension] = useState<ChartDimension>('category_expense');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filtered transactions based on account
  const filteredTx = useMemo(() => {
    if (selectedAccount === 'all') return transactions;
    return transactions.filter(t => t.account === selectedAccount);
  }, [transactions, selectedAccount]);

  // Accounts list
  const accountOptions = useMemo(() => {
    return ['all', ...accountSummaries.map(a => a.name)];
  }, [accountSummaries]);

  // Compute dataset according to selected dimension (Balance Adjustments are excluded from monthlyCashflow in calculateMonthlyCashflow)
  const monthlyCashflow = useMemo(() => calculateMonthlyCashflow(filteredTx), [filteredTx]);
  const balancePoints = useMemo(() => calculateBalancePoints(transactions, selectedAccount), [transactions, selectedAccount]);

  // Category expenses (excludes Balance Adjustment)
  const categoryData = useMemo(() => {
    const expenses = filteredTx.filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category));
    const map = new Map<string, number>();
    expenses.forEach(t => {
      const c = t.category || 'Uncategorized';
      map.set(c, (map.get(c) || 0) + t.amount);
    });
    const totalExp = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([label, value]) => ({
        label,
        value,
        percent: totalExp > 0 ? (value / totalExp) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTx]);

  // Budget vs Actual data
  const varianceData = useMemo(() => {
    return budgets.map(b => ({
      label: b.category,
      budget: b.scaledLimit || b.monthlyLimit,
      actual: b.actualSpent,
      variance: b.variance,
      percentUsed: b.percentUsed,
    })).sort((a, b) => b.actual - a.actual);
  }, [budgets]);

  // Top Merchants / Payees (excludes Balance Adjustment)
  const topMerchantsData = useMemo(() => {
    const expenses = filteredTx.filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category));
    const map = new Map<string, number>();
    expenses.forEach(t => {
      const desc = t.description.slice(0, 32) || 'Unnamed Expense';
      map.set(desc, (map.get(desc) || 0) + t.amount);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredTx]);

  // Color palette for charts
  const palette = [
    '#6366F1', // Indigo
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#14B8A6', // Teal
    '#3B82F6', // Blue
    '#84CC16', // Lime
  ];

  // Deep Analytical Insights Engine
  const analyticalInsights = useMemo(() => {
    const totalExp = filteredTx.filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category)).reduce((s, t) => s + t.amount, 0);
    const totalInc = filteredTx.filter(t => t.type === 'Income' && !isBalanceAdjustment(t.category)).reduce((s, t) => s + t.amount, 0);
    const net = totalInc - totalExp;

    const insights: string[] = [];

    if (categoryData.length > 0) {
      const top = categoryData[0];
      insights.push(`Dominant spending driver is "${top.label}", accounting for ${top.percent.toFixed(1)}% of all recorded expenses (${formatCurrency(top.value, currency)}).`);
    }

    const overspentCount = budgets.filter(b => b.variance < 0).length;
    if (overspentCount > 0) {
      insights.push(`Budget Alert: ${overspentCount} categories currently exceed target limits. Immediate adjustment or expense trimming recommended.`);
    } else {
      insights.push(`Budget Discipline: All tracked categories are operating within planned limits.`);
    }

    if (monthlyCashflow.length >= 2) {
      const latest = monthlyCashflow[monthlyCashflow.length - 1];
      const prev = monthlyCashflow[monthlyCashflow.length - 2];
      const expenseChange = prev.expense > 0 ? ((latest.expense - prev.expense) / prev.expense) * 100 : 0;
      insights.push(`Month-over-month expenditure shifted by ${expenseChange >= 0 ? '+' : ''}${expenseChange.toFixed(1)}% in ${latest.monthLabel}.`);
    }

    if (totalInc > 0) {
      const rate = ((net / totalInc) * 100).toFixed(1);
      insights.push(`Current overall cash retention / savings margin is ${rate}%.`);
    }

    return insights;
  }, [filteredTx, categoryData, budgets, monthlyCashflow, currency]);

  return (
    <div className="space-y-6">
      {/* Studio Header & Controls */}
      <div className={`p-6 rounded-2xl border transition-colors ${
        isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-inherit">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Customizable Chart Studio</h2>
              {periodLabel && (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
                  isDark ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                }`}>
                  {periodLabel}
                </span>
              )}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Multi-dimensional financial visualizations with dynamic projection views.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Account filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none font-medium ${
                  isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="all">All Accounts ({accountSummaries.length})</option>
                {accountSummaries.map(a => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chart Type Selector */}
            <div className={`inline-flex rounded-lg p-0.5 border ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setChartType('bar')}
                title="Bar Chart"
                className={`p-1.5 rounded-md transition-colors ${
                  chartType === 'bar'
                    ? isDark ? 'bg-zinc-800 text-indigo-400' : 'bg-white text-indigo-600 shadow-xs'
                    : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('line')}
                title="Line / Trend Chart"
                className={`p-1.5 rounded-md transition-colors ${
                  chartType === 'line'
                    ? isDark ? 'bg-zinc-800 text-indigo-400' : 'bg-white text-indigo-600 shadow-xs'
                    : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LineIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('donut')}
                title="Donut / Distribution Chart"
                className={`p-1.5 rounded-md transition-colors ${
                  chartType === 'donut'
                    ? isDark ? 'bg-zinc-800 text-indigo-400' : 'bg-white text-indigo-600 shadow-xs'
                    : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PieChart className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Dimension Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-4">
          <button
            onClick={() => setDimension('category_expense')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              dimension === 'category_expense'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Expenses by Category
          </button>
          <button
            onClick={() => setDimension('budget_variance')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              dimension === 'budget_variance'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Budget vs Actual Variance
          </button>
          <button
            onClick={() => setDimension('cashflow')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              dimension === 'cashflow'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Monthly Cashflow (Income vs Expense)
          </button>
          <button
            onClick={() => setDimension('balance_timeline')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              dimension === 'balance_timeline'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Account Balance Trajectory
          </button>
          <button
            onClick={() => setDimension('top_merchants')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              dimension === 'top_merchants'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Top Payees & Outlays
          </button>
        </div>
      </div>

      {/* Main Chart Canvas Area */}
      <div className={`p-6 rounded-2xl border transition-colors ${
        isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        {/* Render chart based on active selection */}
        {renderActiveChart()}
      </div>

      {/* Deep Analytical Insights Panel */}
      <div className={`p-5 rounded-2xl border ${
        isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
            Deep Analytical Insights & Intelligence
          </h3>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {analyticalInsights.map((insight, idx) => (
            <li
              key={idx}
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                isDark ? 'bg-zinc-900/90 border-zinc-800/70 text-zinc-300' : 'bg-white border-slate-200/80 text-slate-700 shadow-xs'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span className="leading-relaxed">{insight}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  function renderActiveChart() {
    if (filteredTx.length === 0) {
      return (
        <div className="py-16 text-center text-xs text-zinc-400">
          No transactions found for the selected account filter.
        </div>
      );
    }

    // DIMENSION 1: EXPENSES BY CATEGORY
    if (dimension === 'category_expense') {
      if (chartType === 'donut') {
        return renderDonutChart(categoryData);
      }
      if (chartType === 'line') {
        return renderLineChart(categoryData.map(d => ({ label: d.label, val: d.value })));
      }
      return renderBarChart(categoryData.map((d, i) => ({
        label: d.label,
        value: d.value,
        subLabel: `${d.percent.toFixed(1)}%`,
        color: palette[i % palette.length],
      })));
    }

    // DIMENSION 2: BUDGET VS ACTUAL VARIANCE
    if (dimension === 'budget_variance') {
      return renderVarianceComparisonChart();
    }

    // DIMENSION 3: MONTHLY CASHFLOW
    if (dimension === 'cashflow') {
      if (chartType === 'line') {
        return renderCashflowLineChart();
      }
      return renderCashflowBarChart();
    }

    // DIMENSION 4: BALANCE TIMELINE
    if (dimension === 'balance_timeline') {
      return renderBalanceTimelineChart();
    }

    // DIMENSION 5: TOP MERCHANTS
    if (dimension === 'top_merchants') {
      return renderBarChart(topMerchantsData.map((d, i) => ({
        label: d.label,
        value: d.value,
        color: palette[(i + 3) % palette.length],
      })));
    }

    return null;
  }

  // --- CHART RENDERERS ---

  function renderBarChart(items: Array<{ label: string; value: number; subLabel?: string; color: string }>) {
    const maxValue = Math.max(...items.map(i => i.value), 1);

    return (
      <div className="space-y-3 pt-2">
        {items.map((item, idx) => {
          const widthPercent = (item.value / maxValue) * 100;
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={item.label}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`p-2.5 rounded-xl transition-colors ${
                isHovered
                  ? isDark ? 'bg-zinc-800/40' : 'bg-slate-50'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-xs sm:max-w-md">
                  {item.label}
                </span>
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <span className="font-bold">{formatCurrency(item.value, currency)}</span>
                  {item.subLabel && (
                    <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      ({item.subLabel})
                    </span>
                  )}
                </div>
              </div>

              <div className={`h-3 w-full rounded-full overflow-hidden ${
                isDark ? 'bg-zinc-800' : 'bg-slate-100'
              }`}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(2, widthPercent)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderVarianceComparisonChart() {
    return (
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-inherit">
          <span className="font-semibold">Category Benchmark</span>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Actual Spent
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-zinc-500 inline-block" /> Budget Cap
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {varianceData.map((d) => {
            const maxVal = Math.max(d.actual, d.budget, 1);
            const actualWidth = (d.actual / maxVal) * 100;
            const budgetWidth = (d.budget / maxVal) * 100;
            const isOverrun = d.variance < 0;

            return (
              <div key={d.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{d.label}</span>
                  <span className={`font-mono tabular-nums text-xs font-semibold ${
                    isOverrun ? 'text-rose-500' : 'text-emerald-500'
                  }`}>
                    {isOverrun ? `+${formatCurrency(Math.abs(d.variance), currency)} overrun` : `${formatCurrency(d.variance, currency)} under`}
                  </span>
                </div>

                {/* Actual bar */}
                <div className="space-y-1">
                  <div className={`h-2.5 w-full rounded-full overflow-hidden ${
                    isDark ? 'bg-zinc-800' : 'bg-slate-100'
                  }`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOverrun ? 'bg-rose-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${actualWidth}%` }}
                    />
                  </div>
                  {/* Budget guideline bar */}
                  <div className={`h-1.5 w-full rounded-full overflow-hidden ${
                    isDark ? 'bg-zinc-800' : 'bg-slate-100'
                  }`}>
                    <div
                      className="h-full rounded-full bg-slate-400 dark:bg-zinc-600 transition-all duration-300"
                      style={{ width: `${budgetWidth}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                  <span>Spent: {formatCurrency(d.actual, currency)}</span>
                  <span>Limit: {formatCurrency(d.budget, currency)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderCashflowBarChart() {
    const maxVal = Math.max(...monthlyCashflow.flatMap(m => [m.income, m.expense]), 1);

    return (
      <div className="pt-2">
        <div className="flex items-center justify-end gap-4 text-xs mb-6">
          <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Income
          </span>
          <span className="flex items-center gap-1.5 text-rose-500 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Expenses
          </span>
          <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Net Flow
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthlyCashflow.map(m => {
            const incomePercent = (m.income / maxVal) * 100;
            const expensePercent = (m.expense / maxVal) * 100;

            return (
              <div
                key={m.monthKey}
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-zinc-950/40 border-zinc-800' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-3">
                  <span>{m.monthLabel}</span>
                  <span className={`font-mono tabular-nums ${m.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Net: {formatCurrency(m.net, currency)}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-mono tabular-nums text-emerald-500">
                      <span>Income</span>
                      <span>{formatCurrency(m.income, currency)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${incomePercent}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-mono tabular-nums text-rose-500">
                      <span>Expenses</span>
                      <span>{formatCurrency(m.expense, currency)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${expensePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDonutChart(items: Array<{ label: string; value: number; percent: number }>) {
    const total = items.reduce((s, i) => s + i.value, 0);
    const radius = 64;
    const circumference = 2 * Math.PI * radius;
    let accumulatedAngle = 0;

    return (
      <div className="flex flex-col lg:flex-row items-center justify-around gap-8 py-4">
        {/* SVG Donut */}
        <div className="relative w-56 h-56 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r={radius}
              className={isDark ? 'stroke-zinc-800' : 'stroke-slate-100'}
              strokeWidth="22"
              fill="transparent"
            />
            {items.map((item, idx) => {
              const strokeDasharray = `${(item.value / total) * circumference} ${circumference}`;
              const strokeDashoffset = -accumulatedAngle;
              accumulatedAngle += (item.value / total) * circumference;

              return (
                <circle
                  key={item.label}
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke={palette[idx % palette.length]}
                  strokeWidth={hoveredIndex === idx ? '26' : '22'}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  fill="transparent"
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>

          {/* Center Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className={`text-[11px] uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Total Spent
            </span>
            <span className="text-sm font-bold font-mono tabular-nums">
              {formatCurrency(total, currency)}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 max-w-md grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((item, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <div
                key={item.label}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`p-2 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                  isHovered
                    ? isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-50 border-slate-300'
                    : isDark ? 'bg-zinc-900/60 border-zinc-800/60' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate mr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: palette[idx % palette.length] }}
                  />
                  <span className="truncate font-medium">{item.label}</span>
                </div>
                <div className="font-mono tabular-nums text-right shrink-0">
                  <span className="font-bold">{item.percent.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderCashflowLineChart() {
    const data = monthlyCashflow;
    if (data.length === 0) return null;

    const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);
    const minVal = 0;
    const width = 600;
    const height = 240;
    const padding = 35;

    const getX = (index: number) => padding + (index / Math.max(1, data.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => height - padding - ((val - minVal) / (maxVal - minVal)) * (height - 2 * padding);

    const incomePoints = data.map((d, i) => `${getX(i)},${getY(d.income)}`).join(' ');
    const expensePoints = data.map((d, i) => `${getX(i)},${getY(d.expense)}`).join(' ');

    return (
      <div className="pt-2">
        <div className="flex items-center justify-end gap-4 text-xs mb-3">
          <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
            <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" /> Inflows
          </span>
          <span className="flex items-center gap-1.5 text-rose-500 font-medium">
            <span className="w-2.5 h-0.5 bg-rose-500 inline-block" /> Outlays
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <svg className="w-full min-w-[500px]" viewBox={`0 0 ${width} ${height}`}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = height - padding - pct * (height - 2 * padding);
              return (
                <g key={i}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke={isDark ? '#27272a' : '#E2E8F0'}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[9px] fill-zinc-400 font-mono"
                  >
                    {Math.round(pct * maxVal)}
                  </text>
                </g>
              );
            })}

            {/* Inflows Polyline */}
            <polyline
              fill="none"
              stroke="#10B981"
              strokeWidth="2.5"
              points={incomePoints}
            />
            {/* Outlays Polyline */}
            <polyline
              fill="none"
              stroke="#EF4444"
              strokeWidth="2.5"
              points={expensePoints}
            />

            {/* Circles and x-axis labels */}
            {data.map((d, i) => {
              const x = getX(i);
              const yInc = getY(d.income);
              const yExp = getY(d.expense);

              return (
                <g key={d.monthKey}>
                  <circle cx={x} cy={yInc} r="4" fill="#10B981" />
                  <circle cx={x} cy={yExp} r="4" fill="#EF4444" />
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    className="text-[10px] fill-zinc-400 font-medium"
                  >
                    {d.monthLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }

  function renderBalanceTimelineChart() {
    const data = balancePoints;
    if (data.length === 0) return null;

    const balances = data.map(d => d.balance);
    const maxVal = Math.max(...balances);
    const minVal = Math.min(...balances);
    const range = Math.max(1, maxVal - minVal);

    const width = 640;
    const height = 240;
    const padding = 40;

    const getX = (index: number) => padding + (index / Math.max(1, data.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => height - padding - ((val - minVal) / range) * (height - 2 * padding);

    const points = data.map((d, i) => `${getX(i)},${getY(d.balance)}`).join(' ');

    return (
      <div className="pt-2">
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="font-semibold text-slate-800 dark:text-zinc-200">
            Chronological Account Balance Progression
          </span>
          <span className="font-mono tabular-nums text-xs text-indigo-400">
            {data.length} snapshots recorded
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <svg className="w-full min-w-[550px]" viewBox={`0 0 ${width} ${height}`}>
            {/* Horizontal guideline */}
            {[0, 0.5, 1].map((pct, i) => {
              const y = height - padding - pct * (height - 2 * padding);
              const val = minVal + pct * range;
              return (
                <g key={i}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke={isDark ? '#27272a' : '#E2E8F0'}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[9px] fill-zinc-400 font-mono"
                  >
                    {Math.round(val)}
                  </text>
                </g>
              );
            })}

            {/* Main Balance Line */}
            <polyline
              fill="none"
              stroke="#6366F1"
              strokeWidth="2.5"
              points={points}
            />

            {/* Individual points */}
            {data.map((d, i) => {
              const x = getX(i);
              const y = getY(d.balance);
              const isHovered = hoveredIndex === i;

              return (
                <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? '6' : '3.5'}
                    fill={isHovered ? '#818CF8' : '#6366F1'}
                    className="transition-all"
                  />
                  {i % Math.ceil(data.length / 6) === 0 && (
                    <text
                      x={x}
                      y={height - 12}
                      textAnchor="middle"
                      className="text-[9px] fill-zinc-400 font-mono"
                    >
                      {d.dateStr}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover Snapshot Detail */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div className={`mt-3 p-2.5 rounded-lg border text-xs flex items-center justify-between font-mono tabular-nums ${
            isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}>
            <span>Snapshot: {data[hoveredIndex].dateStr} · {data[hoveredIndex].account}</span>
            <span className="font-bold text-indigo-400">
              Balance: {formatCurrency(data[hoveredIndex].balance, data[hoveredIndex].currency)}
            </span>
          </div>
        )}
      </div>
    );
  }

  function renderLineChart(data: Array<{ label: string; val: number }>) {
    if (data.length === 0) return null;
    const maxVal = Math.max(...data.map(d => d.val), 1);
    const width = 600;
    const height = 220;
    const padding = 35;

    const getX = (index: number) => padding + (index / Math.max(1, data.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => height - padding - (val / maxVal) * (height - 2 * padding);

    const points = data.map((d, i) => `${getX(i)},${getY(d.val)}`).join(' ');

    return (
      <div className="w-full overflow-x-auto pt-2">
        <svg className="w-full min-w-[500px]" viewBox={`0 0 ${width} ${height}`}>
          <polyline fill="none" stroke="#6366F1" strokeWidth="2.5" points={points} />
          {data.map((d, i) => {
            const x = getX(i);
            const y = getY(d.val);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="4" fill="#6366F1" />
                <text x={x} y={height - 10} textAnchor="middle" className="text-[9px] fill-zinc-400">
                  {d.label.slice(0, 8)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }
};
