import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Flame,
  Calendar,
  DollarSign,
  PieChart,
  BarChart3,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Sparkles,
  Layers,
  Activity,
  Zap,
  ChevronRight,
  Info,
  Percent,
  Wallet
} from 'lucide-react';
import { Transaction, AccountSummary, FinancialAnomaly, PeriodInfo } from '../types/finance';
import { formatCurrency, isBalanceAdjustment } from '../utils/analytics';

interface AnalyticalInsightsOverviewProps {
  transactions: Transaction[];
  accountSummaries: AccountSummary[];
  anomalies: FinancialAnomaly[];
  period?: PeriodInfo;
  periodLabel?: string;
  currency: string;
  isDark: boolean;
  onNavigateTab: (tab: 'overview' | 'budget' | 'charts' | 'anomalies' | 'ledger') => void;
}

type InsightFilter = 'all' | 'spending' | 'outliers' | 'cashflow';

interface InsightItem {
  id: string;
  type: 'spending' | 'outliers' | 'cashflow';
  title: string;
  headline: string;
  description: string;
  status: 'positive' | 'warning' | 'alert' | 'info';
  metricLabel?: string;
  metricValue?: string;
  metricBadge?: string;
  actionText?: string;
  actionTab?: 'overview' | 'budget' | 'charts' | 'anomalies' | 'ledger';
  icon: React.ElementType;
}

export const AnalyticalInsightsOverview: React.FC<AnalyticalInsightsOverviewProps> = ({
  transactions,
  accountSummaries,
  anomalies,
  period,
  periodLabel = 'Active Period',
  currency,
  isDark,
  onNavigateTab,
}) => {
  const [activeFilter, setActiveFilter] = useState<InsightFilter>('all');
  const [selectedCategorySkew, setSelectedCategorySkew] = useState<string | null>(null);

  // Filter valid transactions (excluding balance adjustments from cashflow/spending)
  const validTx = useMemo(() => {
    return transactions.filter(t => !isBalanceAdjustment(t.category));
  }, [transactions]);

  const expenseTx = useMemo(() => {
    return validTx.filter(t => t.type === 'Expense');
  }, [validTx]);

  const incomeTx = useMemo(() => {
    return validTx.filter(t => t.type === 'Income');
  }, [validTx]);

  // Financial aggregates
  const totalExpense = useMemo(() => expenseTx.reduce((sum, t) => sum + t.amount, 0), [expenseTx]);
  const totalIncome = useMemo(() => incomeTx.reduce((sum, t) => sum + t.amount, 0), [incomeTx]);
  const netCashflow = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netCashflow / totalIncome) * 100 : 0;

  // Period duration in days
  const periodDays = useMemo(() => {
    if (period?.start && period?.end) {
      const diffMs = Math.abs(period.end.getTime() - period.start.getTime());
      return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }
    const dates = validTx.map(t => t.date.getTime()).filter(d => !isNaN(d));
    if (dates.length >= 2) {
      const min = Math.min(...dates);
      const max = Math.max(...dates);
      return Math.max(1, Math.round((max - min) / (1000 * 60 * 60 * 24)) + 1);
    }
    return 30;
  }, [period, validTx]);

  const dailyBurnRate = totalExpense / Math.max(1, periodDays);

  // Total available liquid balances across all accounts
  const totalLiquidAssets = useMemo(() => {
    return accountSummaries.reduce((sum, acc) => sum + acc.latestBalance, 0);
  }, [accountSummaries]);

  // Runway estimation (in months, assuming 30.4 days/month)
  const estimatedRunwayMonths = dailyBurnRate > 0 ? totalLiquidAssets / (dailyBurnRate * 30.4) : null;

  // Category concentration & ranking
  const categorySpendingRank = useMemo(() => {
    const map = new Map<string, { total: number; count: number; amounts: number[] }>();
    expenseTx.forEach(t => {
      const cat = t.category || 'Uncategorized';
      if (!map.has(cat)) {
        map.set(cat, { total: 0, count: 0, amounts: [] });
      }
      const data = map.get(cat)!;
      data.total += t.amount;
      data.count += 1;
      data.amounts.push(t.amount);
    });

    return Array.from(map.entries())
      .map(([cat, data]) => {
        const sorted = [...data.amounts].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median =
          sorted.length === 0
            ? 0
            : sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
        const avg = data.count > 0 ? data.total / data.count : 0;
        const diff = avg - median;
        const percentOfTotal = totalExpense > 0 ? (data.total / totalExpense) * 100 : 0;

        return {
          category: cat,
          total: data.total,
          count: data.count,
          average: avg,
          median,
          diff,
          percentOfTotal,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [expenseTx, totalExpense]);

  // Top 3 category concentration percentage
  const top3Concentration = useMemo(() => {
    const top3Sum = categorySpendingRank.slice(0, 3).reduce((sum, c) => sum + c.total, 0);
    return totalExpense > 0 ? (top3Sum / totalExpense) * 100 : 0;
  }, [categorySpendingRank, totalExpense]);

  // Weekday intensity breakdown (0 = Sunday, 6 = Saturday)
  const weekdayStats = useMemo(() => {
    const days = [
      { name: 'Sun', short: 'Su', total: 0, count: 0 },
      { name: 'Mon', short: 'Mo', total: 0, count: 0 },
      { name: 'Tue', short: 'Tu', total: 0, count: 0 },
      { name: 'Wed', short: 'We', total: 0, count: 0 },
      { name: 'Thu', short: 'Th', total: 0, count: 0 },
      { name: 'Fri', short: 'Fr', total: 0, count: 0 },
      { name: 'Sat', short: 'Sa', total: 0, count: 0 },
    ];

    expenseTx.forEach(t => {
      const dayIndex = t.date.getDay();
      if (days[dayIndex]) {
        days[dayIndex].total += t.amount;
        days[dayIndex].count += 1;
      }
    });

    const maxDayAmount = Math.max(...days.map(d => d.total), 1);
    const sorted = [...days].sort((a, b) => b.total - a.total);

    return {
      days,
      peakDay: sorted[0],
      maxDayAmount,
    };
  }, [expenseTx]);

  // Statistical Outliers (highest disparity between average & median)
  const outlierDisparities = useMemo(() => {
    return [...categorySpendingRank]
      .filter(c => c.count >= 2)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [categorySpendingRank]);

  // Generate Curated Analytical Insights List
  const insightsList = useMemo<InsightItem[]>(() => {
    const list: InsightItem[] = [];

    // 1. Spending Velocity & Burn Rate
    if (totalExpense > 0) {
      list.push({
        id: 'spending-burn',
        type: 'spending',
        title: 'Spending Velocity & Burn Rate',
        headline: `${formatCurrency(dailyBurnRate, currency)} per day across ${periodDays} days`,
        description: `Your average daily outflow rate indicates total period expenses of ${formatCurrency(
          totalExpense,
          currency
        )} across ${expenseTx.length} expense transactions. Average purchase ticket is ${formatCurrency(
          expenseTx.length > 0 ? totalExpense / expenseTx.length : 0,
          currency
        )}.`,
        status: dailyBurnRate > 200 ? 'warning' : 'info',
        metricLabel: 'Daily Outflow',
        metricValue: formatCurrency(dailyBurnRate, currency),
        metricBadge: `${expenseTx.length} purchases`,
        actionText: 'View Custom Charts',
        actionTab: 'charts',
        icon: Flame,
      });
    }

    // 2. Cash Flow Margin & Retention
    if (totalIncome > 0) {
      const isPositive = netCashflow >= 0;
      list.push({
        id: 'cashflow-margin',
        type: 'cashflow',
        title: 'Net Cash Flow & Savings Margin',
        headline: `${isPositive ? '+' : ''}${savingsRate.toFixed(1)}% savings retention margin`,
        description: isPositive
          ? `You have preserved ${formatCurrency(netCashflow, currency)} of your ${formatCurrency(
              totalIncome,
              currency
            )} income this period, strengthening your financial safety cushion.`
          : `Expenses exceeded income by ${formatCurrency(
              Math.abs(netCashflow),
              currency
            )} during this timeframe. Review discretionary spending drivers to regain surplus.`,
        status: isPositive ? 'positive' : 'alert',
        metricLabel: 'Net Cashflow',
        metricValue: `${isPositive ? '+' : '-'}${formatCurrency(Math.abs(netCashflow), currency)}`,
        metricBadge: isPositive ? `${savingsRate.toFixed(0)}% Saved` : 'Deficit',
        actionText: 'Inspect in Ledger',
        actionTab: 'ledger',
        icon: isPositive ? TrendingUp : TrendingDown,
      });
    }

    // 3. Dominant Category Concentration
    if (categorySpendingRank.length > 0) {
      const top = categorySpendingRank[0];
      const isConcentrated = top.percentOfTotal >= 35;
      list.push({
        id: 'category-concentration',
        type: 'spending',
        title: 'Category Concentration & Driver',
        headline: `"${top.category}" accounts for ${top.percentOfTotal.toFixed(1)}% of all outlays`,
        description: `The single largest cost contributor is ${top.category} at ${formatCurrency(
          top.total,
          currency
        )}. Furthermore, your top 3 categories constitute ${top3Concentration.toFixed(
          1
        )}% of all period spending.`,
        status: isConcentrated ? 'warning' : 'info',
        metricLabel: 'Top Category Share',
        metricValue: `${top.percentOfTotal.toFixed(1)}%`,
        metricBadge: formatCurrency(top.total, currency),
        actionText: 'Explore in Custom Charts',
        actionTab: 'charts',
        icon: PieChart,
      });
    }

    // 4. Statistical Median vs. Average Disparity (Outlier purchases)
    if (outlierDisparities.length > 0) {
      const topSkew = outlierDisparities[0];
      if (Math.abs(topSkew.diff) > 5) {
        const isHigher = topSkew.diff > 0;
        list.push({
          id: 'outlier-skew',
          type: 'outliers',
          title: 'Mean vs. Median Outlier Disparity',
          headline: `"${topSkew.category}" average is ${formatCurrency(
            Math.abs(topSkew.diff),
            currency
          )} ${isHigher ? 'above' : 'below'} typical median`,
          description: `In "${topSkew.category}", average spend per transaction is ${formatCurrency(
            topSkew.average,
            currency
          )} while the typical median spend is only ${formatCurrency(
            topSkew.median,
            currency
          )}. This significant disparity reveals high-value occasional or one-off transactions skewing the arithmetic mean.`,
          status: 'warning',
          metricLabel: 'Disparity Gap',
          metricValue: `+${formatCurrency(Math.abs(topSkew.diff), currency)}`,
          metricBadge: `${topSkew.count} txns`,
          actionText: 'View in Custom Charts',
          actionTab: 'charts',
          icon: Scale,
        });
      }
    }

    // 5. Day-of-Week Rhythm & Peak Intensity
    if (weekdayStats.peakDay && weekdayStats.peakDay.total > 0) {
      const peak = weekdayStats.peakDay;
      const pctOfWeek = totalExpense > 0 ? (peak.total / totalExpense) * 100 : 0;
      list.push({
        id: 'weekday-rhythm',
        type: 'spending',
        title: 'Spending Rhythm & Peak Day',
        headline: `${peak.name}s have the highest outlay (${pctOfWeek.toFixed(0)}% of expenses)`,
        description: `Your spending rhythm shows that ${peak.name} generates the highest cumulative spend at ${formatCurrency(
          peak.total,
          currency
        )} across ${peak.count} transactions. Scheduling larger purchases mindfully can help smooth weekly liquidity.`,
        status: 'info',
        metricLabel: 'Peak Day Outlay',
        metricValue: formatCurrency(peak.total, currency),
        metricBadge: `${peak.name} (${peak.count} txns)`,
        actionText: 'View Heat Map Calendar',
        actionTab: 'charts',
        icon: Calendar,
      });
    }

    // 6. Financial Anomalies Flagged
    if (anomalies.length > 0) {
      const highSeverity = anomalies.filter(a => a.severity === 'high');
      const totalAnomalyAmount = anomalies.reduce((sum, a) => sum + a.amount, 0);
      list.push({
        id: 'anomalies-intel',
        type: 'outliers',
        title: 'Automated Anomaly Sentinel',
        headline: `${anomalies.length} statistical ${
          anomalies.length === 1 ? 'anomaly' : 'anomalies'
        } flagged (${formatCurrency(totalAnomalyAmount, currency)})`,
        description: `The anomaly detection engine flagged ${anomalies.length} irregular transactions (${
          highSeverity.length
        } high severity). Flagged patterns include unusual category surges, amount outliers, or potential duplicates.`,
        status: highSeverity.length > 0 ? 'alert' : 'warning',
        metricLabel: 'Flagged Volume',
        metricValue: formatCurrency(totalAnomalyAmount, currency),
        metricBadge: `${anomalies.length} Flagged`,
        actionText: 'Review in Anomalies',
        actionTab: 'anomalies',
        icon: ShieldAlert,
      });
    }

    // 7. Capital Runway & Liquidity
    if (estimatedRunwayMonths !== null && estimatedRunwayMonths > 0) {
      const isStrong = estimatedRunwayMonths >= 6;
      list.push({
        id: 'liquidity-runway',
        type: 'cashflow',
        title: 'Capital Runway & Account Liquidity',
        headline: `${estimatedRunwayMonths.toFixed(1)} months of operational liquidity`,
        description: `With total account balances of ${formatCurrency(
          totalLiquidAssets,
          currency
        )} and an average daily burn rate of ${formatCurrency(
          dailyBurnRate,
          currency
        )}, your liquid cash reserves provide approximately ${estimatedRunwayMonths.toFixed(
          1
        )} months of coverage without additional deposits.`,
        status: isStrong ? 'positive' : 'info',
        metricLabel: 'Total Balance',
        metricValue: formatCurrency(totalLiquidAssets, currency),
        metricBadge: `${estimatedRunwayMonths.toFixed(1)} mo runway`,
        actionText: 'Inspect in Ledger',
        actionTab: 'ledger',
        icon: Wallet,
      });
    }

    return list;
  }, [
    totalExpense,
    totalIncome,
    netCashflow,
    savingsRate,
    dailyBurnRate,
    periodDays,
    expenseTx.length,
    currency,
    categorySpendingRank,
    top3Concentration,
    outlierDisparities,
    weekdayStats,
    anomalies,
    estimatedRunwayMonths,
    totalLiquidAssets,
  ]);

  // Filtered insights based on active tag
  const filteredInsights = useMemo(() => {
    if (activeFilter === 'all') return insightsList;
    return insightsList.filter(item => item.type === activeFilter);
  }, [insightsList, activeFilter]);

  return (
    <div className="space-y-6 pt-2">
      {/* SECTION HEADER */}
      <div
        className={`p-5 rounded-2xl border transition-colors ${
          isDark
            ? 'bg-zinc-900/90 border-zinc-800 text-zinc-100'
            : 'bg-white border-slate-200 text-slate-900 shadow-xs'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold tracking-tight">Executive Analytical Insights</h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {periodLabel}
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Algorithmic intelligence on cash velocity, category concentration, statistical outliers, and budget discipline.
            </p>
          </div>

          {/* Deep link button to Custom Charts */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateTab('charts')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Full Custom Charts</span>
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        {/* HERO KPI STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-inherit">
          {/* Card 1: Daily Burn Rate */}
          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-zinc-950/50 border-zinc-800/80' : 'bg-slate-50 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-medium">
              <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>Daily Burn Rate</span>
              <Flame className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-base sm:text-lg font-mono font-bold tabular-nums mt-1">
              {formatCurrency(dailyBurnRate, currency)}
              <span className={`text-[10px] font-normal ml-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>/ day</span>
            </div>
            <div className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {expenseTx.length} purchases across {periodDays} days
            </div>
          </div>

          {/* Card 2: Savings Retention Rate */}
          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-zinc-950/50 border-zinc-800/80' : 'bg-slate-50 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-medium">
              <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>Savings Margin</span>
              {netCashflow >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              )}
            </div>
            <div
              className={`text-base sm:text-lg font-mono font-bold tabular-nums mt-1 ${
                netCashflow >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {netCashflow >= 0 ? '+' : ''}
              {savingsRate.toFixed(1)}%
            </div>
            <div className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Net: {formatCurrency(netCashflow, currency)}
            </div>
          </div>

          {/* Card 3: Top Category Driver */}
          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-zinc-950/50 border-zinc-800/80' : 'bg-slate-50 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-medium">
              <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>Top Outlay Driver</span>
              <PieChart className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-base sm:text-lg font-bold truncate mt-1" title={categorySpendingRank[0]?.category}>
              {categorySpendingRank[0]?.category || 'N/A'}
            </div>
            <div className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {categorySpendingRank[0]
                ? `${categorySpendingRank[0].percentOfTotal.toFixed(1)}% of spend (${formatCurrency(
                    categorySpendingRank[0].total,
                    currency
                  )})`
                : 'No expense recorded'}
            </div>
          </div>

          {/* Card 4: Average Purchase Ticket */}
          <div
            className={`p-3 rounded-xl border ${
              isDark ? 'bg-zinc-950/50 border-zinc-800/80' : 'bg-slate-50 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-medium">
              <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>Avg Purchase Ticket</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-base sm:text-lg font-mono font-bold tabular-nums mt-1">
              {formatCurrency(expenseTx.length > 0 ? totalExpense / expenseTx.length : 0, currency)}
            </div>
            <div className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Across {expenseTx.length} expense transactions
            </div>
          </div>
        </div>

        {/* FILTER CHIPS */}
        <div className="flex flex-wrap items-center gap-1.5 mt-5 pt-4 border-t border-inherit">
          <span className={`text-[11px] font-semibold mr-1.5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            Filter:
          </span>
          {(
            [
              { key: 'all', label: 'All Insights', count: insightsList.length },
              {
                key: 'spending',
                label: 'Spending & Rhythm',
                count: insightsList.filter(i => i.type === 'spending').length,
              },
              {
                key: 'outliers',
                label: 'Outliers & Disparities',
                count: insightsList.filter(i => i.type === 'outliers').length,
              },
              {
                key: 'cashflow',
                label: 'Cash Flow & Runway',
                count: insightsList.filter(i => i.type === 'cashflow').length,
              },
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                activeFilter === tab.key
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : isDark
                  ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeFilter === tab.key
                    ? 'bg-white/20 text-white'
                    : isDark
                    ? 'bg-zinc-900 text-zinc-400'
                    : 'bg-white text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* INSIGHTS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredInsights.map(insight => {
          const Icon = insight.icon;
          const statusColors = {
            positive: {
              border: isDark ? 'border-emerald-500/30' : 'border-emerald-200',
              bgBadge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
              iconBg: 'bg-emerald-500/20 text-emerald-500',
            },
            warning: {
              border: isDark ? 'border-amber-500/30' : 'border-amber-200',
              bgBadge: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
              iconBg: 'bg-amber-500/20 text-amber-500',
            },
            alert: {
              border: isDark ? 'border-rose-500/30' : 'border-rose-200',
              bgBadge: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
              iconBg: 'bg-rose-500/20 text-rose-500',
            },
            info: {
              border: isDark ? 'border-zinc-800' : 'border-slate-200',
              bgBadge: isDark
                ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                : 'bg-slate-100 text-slate-700 border border-slate-200',
              iconBg: isDark ? 'bg-zinc-800 text-indigo-400' : 'bg-slate-100 text-indigo-600',
            },
          }[insight.status];

          return (
            <div
              key={insight.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all hover:shadow-md ${statusColors.border} ${
                isDark ? 'bg-zinc-900/80' : 'bg-white'
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusColors.iconBg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      {insight.title}
                    </span>
                  </div>

                  {insight.metricBadge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColors.bgBadge}`}>
                      {insight.metricBadge}
                    </span>
                  )}
                </div>

                {/* Headline */}
                <h3 className="text-sm font-bold tracking-tight mb-2 text-slate-900 dark:text-zinc-100">
                  {insight.headline}
                </h3>

                {/* Detailed Description */}
                <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  {insight.description}
                </p>
              </div>

              {/* Bottom Metric & Action Bar */}
              <div className="mt-4 pt-3 border-t border-inherit flex items-center justify-between gap-2">
                {insight.metricLabel && insight.metricValue ? (
                  <div>
                    <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                      {insight.metricLabel}:
                    </span>{' '}
                    <span className="text-xs font-mono font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                      {insight.metricValue}
                    </span>
                  </div>
                ) : (
                  <div />
                )}

                {insight.actionTab && insight.actionText && (
                  <button
                    onClick={() => onNavigateTab(insight.actionTab!)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-400 transition-colors"
                  >
                    <span>{insight.actionText}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DUAL DEEP DIVE PANELS: Spending Concentration & Weekday Rhythm */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 1: Category Concentration Bar */}
        <div
          className={`p-5 rounded-2xl border ${
            isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Expense Distribution Breakdown
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('charts')}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Custom Charts</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <p className={`text-xs mb-3 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            Top 3 categories represent <strong className="font-semibold text-slate-900 dark:text-zinc-100">{top3Concentration.toFixed(0)}%</strong> of your total expenditures.
          </p>

          {/* Stacked Concentration Bar */}
          <div className="h-3 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden flex mb-4">
            {categorySpendingRank.slice(0, 5).map((cat, idx) => {
              const colors = [
                'bg-indigo-500',
                'bg-cyan-500',
                'bg-emerald-500',
                'bg-amber-500',
                'bg-rose-500',
              ];
              return (
                <div
                  key={cat.category}
                  className={`h-full ${colors[idx % colors.length]}`}
                  style={{ width: `${Math.max(2, cat.percentOfTotal)}%` }}
                  title={`${cat.category}: ${cat.percentOfTotal.toFixed(1)}% (${formatCurrency(cat.total, currency)})`}
                />
              );
            })}
          </div>

          {/* Top 4 Legend Items */}
          <div className="space-y-2">
            {categorySpendingRank.slice(0, 4).map((cat, idx) => {
              const dots = [
                'bg-indigo-500',
                'bg-cyan-500',
                'bg-emerald-500',
                'bg-amber-500',
              ];
              return (
                <div key={cat.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dots[idx % dots.length]}`} />
                    <span className="truncate font-medium">{cat.category}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                    <span className="font-semibold">{formatCurrency(cat.total, currency)}</span>
                    <span className={`w-12 text-right ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                      {cat.percentOfTotal.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel 2: Weekday Spending Intensity Profile */}
        <div
          className={`p-5 rounded-2xl border ${
            isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Weekday Outflow Rhythm
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('charts')}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Heat Map Calendar</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <p className={`text-xs mb-3 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            Peak spending day is <strong className="font-semibold text-slate-900 dark:text-zinc-100">{weekdayStats.peakDay?.name || 'N/A'}</strong> with {formatCurrency(weekdayStats.peakDay?.total || 0, currency)} across {weekdayStats.peakDay?.count || 0} purchases.
          </p>

          {/* Mini 7-Day Histogram Bars */}
          <div className="grid grid-cols-7 gap-2 pt-2 items-end h-24">
            {weekdayStats.days.map(d => {
              const heightPercent = weekdayStats.maxDayAmount > 0 ? (d.total / weekdayStats.maxDayAmount) * 100 : 0;
              const isPeak = d.name === weekdayStats.peakDay?.name && d.total > 0;
              return (
                <div key={d.name} className="flex flex-col items-center h-full justify-end group">
                  <div
                    className={`text-[9px] font-mono tabular-nums mb-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      isDark ? 'text-zinc-400' : 'text-slate-600'
                    }`}
                  >
                    {d.total > 0 ? formatCurrency(d.total, currency).split('.')[0] : '$0'}
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-t-md h-16 flex items-end overflow-hidden p-0.5">
                    <div
                      className={`w-full rounded-t-xs transition-all duration-300 ${
                        isPeak
                          ? 'bg-amber-500 shadow-xs'
                          : d.total > 0
                          ? 'bg-indigo-500/80 hover:bg-indigo-500'
                          : 'bg-transparent'
                      }`}
                      style={{ height: `${Math.max(4, heightPercent)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-center">
                    <span className={`text-[10px] font-semibold ${isPeak ? 'text-amber-500' : isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                      {d.short}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
