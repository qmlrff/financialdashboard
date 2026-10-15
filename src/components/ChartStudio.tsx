import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  LineChart as LineIcon,
  PieChart,
  TrendingUp,
  Layers,
  Filter,
  Scale,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Calendar,
  CalendarDays,
  Flame,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Sparkles,
  GitCompare,
  ArrowUpRight,
  ArrowDownRight,
  Grid
} from 'lucide-react';
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

type ChartDimension = 'category_expense' | 'spending_stats' | 'spending_heatmap' | 'budget_variance' | 'cashflow' | 'balance_timeline' | 'top_merchants';
type ChartType = 'bar' | 'donut' | 'line' | 'heatmap';

function computeMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

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

  // Spending Stats (Median & Average) state
  const [statsGrouping, setStatsGrouping] = useState<'category' | 'account' | 'cross'>('category');
  const [statsSort, setStatsSort] = useState<'average' | 'median' | 'disparity' | 'count'>('average');
  const [statsAccountFilter, setStatsAccountFilter] = useState<string>('all');
  const [statsCategoryFilter, setStatsCategoryFilter] = useState<string>('all');
  const [statsInspectedId, setStatsInspectedId] = useState<string | null>(null);

  // Spending Intensity Heatmap state
  const [heatmapMetric, setHeatmapMetric] = useState<'amount' | 'count'>('amount');
  const [heatmapViewMode, setHeatmapViewMode] = useState<
    'calendar' | 'matrix' | 'multi_month' | 'month_category' | 'month_compare_dual' | 'day_of_month'
  >('calendar');
  const [heatmapSelectedMonthKey, setHeatmapSelectedMonthKey] = useState<string>('');
  const [heatmapCompareMonthKey, setHeatmapCompareMonthKey] = useState<string>('');
  const [multiMonthDisplayType, setMultiMonthDisplayType] = useState<'weekly' | 'daily_strip'>('weekly');
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<string | null>(null);
  const [categoryHeatmapSort, setCategoryHeatmapSort] = useState<'total' | 'name' | 'volatility'>('total');

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

  // Unique categories list for filtering
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.type === 'Expense' && !isBalanceAdjustment(t.category)) {
        set.add(t.category || 'Uncategorized');
      }
    });
    return ['all', ...Array.from(set).sort()];
  }, [transactions]);

  // Median & Average Spending Analysis Engine
  const spendingStatsData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category));

    const buildStat = (
      id: string,
      title: string,
      groupType: 'category' | 'account' | 'cross',
      txs: Transaction[],
      accountName?: string,
      categoryName?: string
    ) => {
      const amounts = txs.map(t => t.amount);
      const total = amounts.reduce((sum, v) => sum + v, 0);
      const count = amounts.length;
      const average = count > 0 ? total / count : 0;
      const median = computeMedian(amounts);
      const min = count > 0 ? Math.min(...amounts) : 0;
      const max = count > 0 ? Math.max(...amounts) : 0;
      const diff = average - median;
      const ratio = median > 0 ? average / median : 1;

      return {
        id,
        title,
        groupType,
        accountName,
        categoryName,
        count,
        total,
        average,
        median,
        min,
        max,
        diff,
        ratio,
        amounts,
      };
    };

    // 1. Group by Category
    const catMap = new Map<string, Transaction[]>();
    expenses.forEach(t => {
      if (statsAccountFilter !== 'all' && t.account !== statsAccountFilter) return;
      const cat = t.category || 'Uncategorized';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(t);
    });
    const categoryStats = Array.from(catMap.entries()).map(([cat, txs]) =>
      buildStat(
        `cat_${cat}`,
        cat,
        'category',
        txs,
        statsAccountFilter !== 'all' ? statsAccountFilter : undefined,
        cat
      )
    );

    // 2. Group by Account
    const accMap = new Map<string, Transaction[]>();
    expenses.forEach(t => {
      if (statsCategoryFilter !== 'all' && t.category !== statsCategoryFilter) return;
      const acc = t.account || 'Unknown Account';
      if (!accMap.has(acc)) accMap.set(acc, []);
      accMap.get(acc)!.push(t);
    });
    const accountStats = Array.from(accMap.entries()).map(([acc, txs]) =>
      buildStat(
        `acc_${acc}`,
        acc,
        'account',
        txs,
        acc,
        statsCategoryFilter !== 'all' ? statsCategoryFilter : undefined
      )
    );

    // 3. Cross Breakdown (Account x Category pair)
    const crossMap = new Map<string, { account: string; category: string; txs: Transaction[] }>();
    expenses.forEach(t => {
      if (statsAccountFilter !== 'all' && t.account !== statsAccountFilter) return;
      if (statsCategoryFilter !== 'all' && t.category !== statsCategoryFilter) return;
      const acc = t.account || 'Unknown Account';
      const cat = t.category || 'Uncategorized';
      const key = `${acc}:::${cat}`;
      if (!crossMap.has(key)) crossMap.set(key, { account: acc, category: cat, txs: [] });
      crossMap.get(key)!.txs.push(t);
    });
    const crossStats = Array.from(crossMap.values()).map(({ account, category, txs }) =>
      buildStat(
        `cross_${account}_${category}`,
        `${account} › ${category}`,
        'cross',
        txs,
        account,
        category
      )
    );

    const activePool = expenses.filter(t => {
      if (statsAccountFilter !== 'all' && t.account !== statsAccountFilter) return false;
      if (statsCategoryFilter !== 'all' && t.category !== statsCategoryFilter) return false;
      return true;
    });
    const poolAmounts = activePool.map(t => t.amount);
    const overallTotal = poolAmounts.reduce((a, b) => a + b, 0);
    const overallAverage = poolAmounts.length > 0 ? overallTotal / poolAmounts.length : 0;
    const overallMedian = computeMedian(poolAmounts);

    return {
      categoryStats,
      accountStats,
      crossStats,
      overallTotal,
      overallAverage,
      overallMedian,
      overallCount: activePool.length,
    };
  }, [transactions, statsAccountFilter, statsCategoryFilter]);

  const activeStatsItems = useMemo(() => {
    let items = [];
    if (statsGrouping === 'category') {
      items = [...spendingStatsData.categoryStats];
    } else if (statsGrouping === 'account') {
      items = [...spendingStatsData.accountStats];
    } else {
      items = [...spendingStatsData.crossStats];
    }

    return items.sort((a, b) => {
      if (statsSort === 'average') return b.average - a.average;
      if (statsSort === 'median') return b.median - a.median;
      if (statsSort === 'disparity') return Math.abs(b.diff) - Math.abs(a.diff);
      if (statsSort === 'count') return b.count - a.count;
      return b.average - a.average;
    });
  }, [spendingStatsData, statsGrouping, statsSort]);

  // Spending Intensity Heatmap Engine
  const heatmapData = useMemo(() => {
    const expenses = filteredTx.filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category));

    // Group expenses by YYYY-MM
    const monthsMap = new Map<string, {
      key: string;
      label: string;
      year: number;
      month: number;
      txs: Transaction[];
      totalAmount: number;
      count: number;
    }>();

    expenses.forEach(t => {
      if (isNaN(t.date.getTime())) return;
      const y = t.date.getFullYear();
      const m = t.date.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = t.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!monthsMap.has(key)) {
        monthsMap.set(key, { key, label, year: y, month: m, txs: [], totalAmount: 0, count: 0 });
      }
      const item = monthsMap.get(key)!;
      item.txs.push(t);
      item.totalAmount += t.amount;
      item.count += 1;
    });

    const availableMonths = Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));
    const activeMonthObj = availableMonths.find(m => m.key === heatmapSelectedMonthKey) || availableMonths[0] || null;

    // Day of Month recurring profile (Days 1 to 31 across all expenses)
    const dayOfMonthProfile: Array<{
      dayNum: number;
      amount: number;
      count: number;
      txs: Transaction[];
    }> = Array.from({ length: 31 }, (_, i) => ({
      dayNum: i + 1,
      amount: 0,
      count: 0,
      txs: [],
    }));

    expenses.forEach(t => {
      const dayNum = t.date.getDate();
      if (dayNum >= 1 && dayNum <= 31) {
        dayOfMonthProfile[dayNum - 1].amount += t.amount;
        dayOfMonthProfile[dayNum - 1].count += 1;
        dayOfMonthProfile[dayNum - 1].txs.push(t);
      }
    });

    // Week of Month × Day of Week Matrix for active month (or all if none)
    const targetTxs = activeMonthObj ? activeMonthObj.txs : expenses;

    // 5 Weeks x 7 Weekdays (0=Sun, 1=Mon, ..., 6=Sat)
    const matrixWeeks = [
      { weekIndex: 0, label: 'Week 1', dayRange: 'Days 1–7', days: Array.from({ length: 7 }, () => ({ amount: 0, count: 0, txs: [] as Transaction[] })) },
      { weekIndex: 1, label: 'Week 2', dayRange: 'Days 8–14', days: Array.from({ length: 7 }, () => ({ amount: 0, count: 0, txs: [] as Transaction[] })) },
      { weekIndex: 2, label: 'Week 3', dayRange: 'Days 15–21', days: Array.from({ length: 7 }, () => ({ amount: 0, count: 0, txs: [] as Transaction[] })) },
      { weekIndex: 3, label: 'Week 4', dayRange: 'Days 22–28', days: Array.from({ length: 7 }, () => ({ amount: 0, count: 0, txs: [] as Transaction[] })) },
      { weekIndex: 4, label: 'Week 5', dayRange: 'Days 29–31', days: Array.from({ length: 7 }, () => ({ amount: 0, count: 0, txs: [] as Transaction[] })) },
    ];

    targetTxs.forEach(t => {
      const d = t.date.getDate();
      const dow = t.date.getDay();
      let weekIdx = 0;
      if (d <= 7) weekIdx = 0;
      else if (d <= 14) weekIdx = 1;
      else if (d <= 21) weekIdx = 2;
      else if (d <= 28) weekIdx = 3;
      else weekIdx = 4;

      const cell = matrixWeeks[weekIdx].days[dow];
      cell.amount += t.amount;
      cell.count += 1;
      cell.txs.push(t);
    });

    // Week row totals
    const weekTotals = matrixWeeks.map(w => {
      const totalAmt = w.days.reduce((sum, d) => sum + d.amount, 0);
      const totalCount = w.days.reduce((sum, d) => sum + d.count, 0);
      return {
        ...w,
        totalAmount: totalAmt,
        totalCount: totalCount,
      };
    });

    // Day of week column totals
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdayTotals = weekdayNames.map((name, dow) => {
      let dowAmt = 0;
      let dowCount = 0;
      matrixWeeks.forEach(w => {
        dowAmt += w.days[dow].amount;
        dowCount += w.days[dow].count;
      });
      return {
        name,
        dow,
        totalAmount: dowAmt,
        totalCount: dowCount,
      };
    });

    // Calendar grid for active month
    let calendarDays: Array<{
      dayNum: number;
      dateKey: string;
      amount: number;
      count: number;
      txs: Transaction[];
    }> = [];
    let paddingBefore = 0;
    let daysInMonth = 30;

    if (activeMonthObj) {
      daysInMonth = new Date(activeMonthObj.year, activeMonthObj.month + 1, 0).getDate();
      paddingBefore = new Date(activeMonthObj.year, activeMonthObj.month, 1).getDay();

      const dailyMap = new Map<number, Transaction[]>();
      activeMonthObj.txs.forEach(t => {
        const d = t.date.getDate();
        if (!dailyMap.has(d)) dailyMap.set(d, []);
        dailyMap.get(d)!.push(t);
      });

      calendarDays = Array.from({ length: daysInMonth }, (_, idx) => {
        const dayNum = idx + 1;
        const dayTxs = dailyMap.get(dayNum) || [];
        const amt = dayTxs.reduce((sum, t) => sum + t.amount, 0);
        const dateKey = `${activeMonthObj.year}-${String(activeMonthObj.month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        return {
          dayNum,
          dateKey,
          amount: amt,
          count: dayTxs.length,
          txs: dayTxs,
        };
      });
    }

    // Benchmark summary
    let peakDay = { dayNum: 0, dateKey: '', amount: 0, count: 0 };
    calendarDays.forEach(d => {
      if (heatmapMetric === 'amount' ? d.amount > peakDay.amount : d.count > peakDay.count) {
        peakDay = { dayNum: d.dayNum, dateKey: d.dateKey, amount: d.amount, count: d.count };
      }
    });

    const sortedWeeks = [...weekTotals].sort((a, b) => b.totalAmount - a.totalAmount);
    const peakWeek = sortedWeeks[0] || null;

    const sortedWeekdays = [...weekdayTotals].sort((a, b) => b.totalAmount - a.totalAmount);
    const peakWeekday = sortedWeekdays[0] || null;

    const totalMonthSpent = activeMonthObj ? activeMonthObj.totalAmount : expenses.reduce((s, t) => s + t.amount, 0);
    const daysWithSpend = calendarDays.filter(d => d.amount > 0).length;

    // Multi-month comparison calculations
    const availableMonthsChronological = [...availableMonths].sort((a, b) => a.key.localeCompare(b.key));
    const multiMonthStats = availableMonthsChronological.map((m, idx) => {
      const weeks = [
        { weekIndex: 0, label: 'W1 (1–7)', amount: 0, count: 0 },
        { weekIndex: 1, label: 'W2 (8–14)', amount: 0, count: 0 },
        { weekIndex: 2, label: 'W3 (15–21)', amount: 0, count: 0 },
        { weekIndex: 3, label: 'W4 (22–28)', amount: 0, count: 0 },
        { weekIndex: 4, label: 'W5 (29–31)', amount: 0, count: 0 },
      ];

      const days = Array.from({ length: 31 }, (_, i) => ({
        dayNum: i + 1,
        dateKey: `${m.year}-${String(m.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
        amount: 0,
        count: 0,
        txs: [] as Transaction[],
      }));

      m.txs.forEach(t => {
        const d = t.date.getDate();
        if (d >= 1 && d <= 31) {
          days[d - 1].amount += t.amount;
          days[d - 1].count += 1;
          days[d - 1].txs.push(t);
        }
        let wIdx = 0;
        if (d <= 7) wIdx = 0;
        else if (d <= 14) wIdx = 1;
        else if (d <= 21) wIdx = 2;
        else if (d <= 28) wIdx = 3;
        else wIdx = 4;
        weeks[wIdx].amount += t.amount;
        weeks[wIdx].count += 1;
      });

      let peakDayInMonth = { dayNum: 1, amount: 0, count: 0 };
      days.forEach(d => {
        if (d.amount > peakDayInMonth.amount) {
          peakDayInMonth = { dayNum: d.dayNum, amount: d.amount, count: d.count };
        }
      });

      let momDiff = 0;
      let momPct = 0;
      if (idx > 0) {
        const prev = availableMonthsChronological[idx - 1];
        momDiff = m.totalAmount - prev.totalAmount;
        momPct = prev.totalAmount > 0 ? (momDiff / prev.totalAmount) * 100 : 0;
      }

      return {
        key: m.key,
        label: m.label,
        year: m.year,
        month: m.month,
        totalAmount: m.totalAmount,
        count: m.count,
        weeks,
        days,
        peakDay: peakDayInMonth,
        momDiff,
        momPct,
        hasPrev: idx > 0,
        txs: m.txs,
      };
    });

    const highestMonth = [...multiMonthStats].sort((a, b) => b.totalAmount - a.totalAmount)[0] || null;
    const lowestMonth = [...multiMonthStats].sort((a, b) => a.totalAmount - b.totalAmount)[0] || null;
    const allMonthsTotal = multiMonthStats.reduce((s, m) => s + m.totalAmount, 0);
    const avgMonthTotal = multiMonthStats.length > 0 ? allMonthsTotal / multiMonthStats.length : 0;

    let maxMultiMonthWeekVal = 1;
    let maxMultiMonthDayVal = 1;
    multiMonthStats.forEach(m => {
      m.weeks.forEach(w => {
        const v = heatmapMetric === 'amount' ? w.amount : w.count;
        if (v > maxMultiMonthWeekVal) maxMultiMonthWeekVal = v;
      });
      m.days.forEach(d => {
        const v = heatmapMetric === 'amount' ? d.amount : d.count;
        if (v > maxMultiMonthDayVal) maxMultiMonthDayVal = v;
      });
    });

    // Month × Category Matrix
    const allCategoriesSet = new Set<string>();
    expenses.forEach(t => allCategoriesSet.add(t.category || 'Uncategorized'));
    const uniqueCategories = Array.from(allCategoriesSet);

    let maxCatMonthCellVal = 1;
    const categoryMonthRows = uniqueCategories.map(cat => {
      let catTotal = 0;
      let catCount = 0;
      const monthSpends = availableMonthsChronological.map(m => {
        const matching = m.txs.filter(t => (t.category || 'Uncategorized') === cat);
        const amt = matching.reduce((s, t) => s + t.amount, 0);
        const cnt = matching.length;
        catTotal += amt;
        catCount += cnt;
        const val = heatmapMetric === 'amount' ? amt : cnt;
        if (val > maxCatMonthCellVal) maxCatMonthCellVal = val;
        return {
          monthKey: m.key,
          monthLabel: m.label,
          amount: amt,
          count: cnt,
          txs: matching,
        };
      });

      const amounts = monthSpends.map(ms => ms.amount);
      const minAmt = Math.min(...amounts);
      const maxAmt = Math.max(...amounts);
      const peakM = monthSpends.find(ms => ms.amount === maxAmt) || monthSpends[0];

      return {
        category: cat,
        monthSpends,
        totalAmount: catTotal,
        count: catCount,
        avgAmount: availableMonthsChronological.length > 0 ? catTotal / availableMonthsChronological.length : 0,
        peakMonth: peakM,
        volatility: maxAmt - minAmt,
      };
    });

    if (categoryHeatmapSort === 'total') {
      categoryMonthRows.sort((a, b) => b.totalAmount - a.totalAmount);
    } else if (categoryHeatmapSort === 'name') {
      categoryMonthRows.sort((a, b) => a.category.localeCompare(b.category));
    } else {
      categoryMonthRows.sort((a, b) => b.volatility - a.volatility);
    }

    // Month A vs Month B Dual Comparison Engine
    const monthA = activeMonthObj;
    const defaultCompareKey = heatmapCompareMonthKey && heatmapCompareMonthKey !== monthA?.key
      ? heatmapCompareMonthKey
      : availableMonths.find(m => m.key !== monthA?.key)?.key || (availableMonths[1]?.key || '');
    const monthB = availableMonths.find(m => m.key === defaultCompareKey) || null;

    let monthCompareDual = null;
    if (monthA && monthB) {
      const diffAmount = monthA.totalAmount - monthB.totalAmount;
      const pctChange = monthB.totalAmount > 0 ? (diffAmount / monthB.totalAmount) * 100 : 0;
      const diffCount = monthA.count - monthB.count;
      const daysInA = new Date(monthA.year, monthA.month + 1, 0).getDate();
      const daysInB = new Date(monthB.year, monthB.month + 1, 0).getDate();
      const dailyAvgA = daysInA > 0 ? monthA.totalAmount / daysInA : 0;
      const dailyAvgB = daysInB > 0 ? monthB.totalAmount / daysInB : 0;
      const dailyAvgDiff = dailyAvgA - dailyAvgB;

      const statsA = multiMonthStats.find(m => m.key === monthA.key);
      const statsB = multiMonthStats.find(m => m.key === monthB.key);

      const weeksComparison = [
        { weekIndex: 0, label: 'Week 1', dayRange: 'Days 1–7' },
        { weekIndex: 1, label: 'Week 2', dayRange: 'Days 8–14' },
        { weekIndex: 2, label: 'Week 3', dayRange: 'Days 15–21' },
        { weekIndex: 3, label: 'Week 4', dayRange: 'Days 22–28' },
        { weekIndex: 4, label: 'Week 5', dayRange: 'Days 29–31' },
      ].map(w => {
        const wA = statsA ? statsA.weeks[w.weekIndex] : { amount: 0, count: 0 };
        const wB = statsB ? statsB.weeks[w.weekIndex] : { amount: 0, count: 0 };
        const amtA = wA.amount;
        const amtB = wB.amount;
        const cntA = wA.count;
        const cntB = wB.count;
        const diff = amtA - amtB;
        const pct = amtB > 0 ? (diff / amtB) * 100 : 0;
        return {
          ...w,
          amtA,
          amtB,
          cntA,
          cntB,
          diff,
          pct,
        };
      });

      const categoryDeltas = uniqueCategories.map(cat => {
        const catA = monthA.txs.filter(t => (t.category || 'Uncategorized') === cat).reduce((s, t) => s + t.amount, 0);
        const catB = monthB.txs.filter(t => (t.category || 'Uncategorized') === cat).reduce((s, t) => s + t.amount, 0);
        const diff = catA - catB;
        const pct = catB > 0 ? (diff / catB) * 100 : 0;
        return {
          category: cat,
          catA,
          catB,
          diff,
          pct,
        };
      }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

      const maxDualWeekVal = Math.max(...weeksComparison.map(w => Math.max(w.amtA, w.amtB)), 1);

      monthCompareDual = {
        monthA,
        monthB,
        diffAmount,
        pctChange,
        diffCount,
        dailyAvgA,
        dailyAvgB,
        dailyAvgDiff,
        weeksComparison,
        categoryDeltas,
        maxDualWeekVal,
      };
    }

    return {
      availableMonths,
      availableMonthsChronological,
      activeMonthObj,
      calendarDays,
      paddingBefore,
      daysInMonth,
      matrixWeeks: weekTotals,
      weekdayTotals,
      dayOfMonthProfile,
      peakDay,
      peakWeek,
      peakWeekday,
      totalMonthSpent,
      daysWithSpend,
      multiMonthStats,
      highestMonth,
      lowestMonth,
      allMonthsTotal,
      avgMonthTotal,
      maxMultiMonthWeekVal,
      maxMultiMonthDayVal,
      categoryMonthRows,
      maxCatMonthCellVal,
      monthCompareDual,
    };
  }, [filteredTx, heatmapSelectedMonthKey, heatmapCompareMonthKey, heatmapMetric, categoryHeatmapSort]);

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

    if (spendingStatsData.categoryStats.length > 0) {
      const sortedByDisparity = [...spendingStatsData.categoryStats].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
      if (sortedByDisparity.length > 0 && Math.abs(sortedByDisparity[0].diff) > 2) {
        const topSkew = sortedByDisparity[0];
        const dir = topSkew.diff > 0 ? 'higher than' : 'lower than';
        insights.push(`Outlier Disparity: In "${topSkew.title}", average spending is ${formatCurrency(topSkew.average, currency)} vs a median of ${formatCurrency(topSkew.median, currency)} (${formatCurrency(Math.abs(topSkew.diff), currency)} ${dir} median), indicating large occasional purchases.`);
      }
    }

    if (heatmapData.peakWeek && heatmapData.totalMonthSpent > 0) {
      const pct = Math.round((heatmapData.peakWeek.totalAmount / heatmapData.totalMonthSpent) * 100);
      insights.push(`Peak Spending Week: ${heatmapData.peakWeek.label} (${heatmapData.peakWeek.dayRange}) had the heaviest outlays at ${formatCurrency(heatmapData.peakWeek.totalAmount, currency)} (${pct}% of monthly total).`);
    }

    if (heatmapData.peakWeekday && heatmapData.peakWeekday.totalAmount > 0) {
      insights.push(`Heaviest Weekday: ${heatmapData.peakWeekday.name} recorded the most spending at ${formatCurrency(heatmapData.peakWeekday.totalAmount, currency)} across ${heatmapData.peakWeekday.totalCount} transactions.`);
    }

    if (heatmapData.multiMonthStats && heatmapData.multiMonthStats.length > 1 && heatmapData.highestMonth && heatmapData.lowestMonth) {
      insights.push(`Multi-Month Span: Across ${heatmapData.multiMonthStats.length} analyzed months, highest spend was in ${heatmapData.highestMonth.label} (${formatCurrency(heatmapData.highestMonth.totalAmount, currency)}), while ${heatmapData.lowestMonth.label} had the lowest spend (${formatCurrency(heatmapData.lowestMonth.totalAmount, currency)}).`);
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
  }, [filteredTx, categoryData, budgets, monthlyCashflow, currency, spendingStatsData, heatmapData]);

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
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Multi-dimensional financial visualizations with dynamic projection views.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Account filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`} />
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
              <button
                onClick={() => {
                  setChartType('heatmap');
                  setDimension('spending_heatmap');
                }}
                title="Calendar Heat Map View"
                className={`p-1.5 rounded-md transition-colors ${
                  chartType === 'heatmap' || dimension === 'spending_heatmap'
                    ? isDark ? 'bg-zinc-800 text-indigo-400' : 'bg-white text-indigo-600 shadow-xs'
                    : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Dimension Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-4">
          <button
            onClick={() => setDimension('category_expense')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              dimension === 'category_expense' && chartType !== 'heatmap'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            Expenses by Category
          </button>
          <button
            onClick={() => {
              setDimension('spending_heatmap');
              setChartType('heatmap');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              dimension === 'spending_heatmap' || chartType === 'heatmap'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Spending Heat Map</span>
          </button>
          <button
            onClick={() => {
              setDimension('spending_stats');
              if (chartType === 'heatmap') setChartType('bar');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              dimension === 'spending_stats' && chartType !== 'heatmap'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Median & Average Spending</span>
          </button>
          <button
            onClick={() => {
              setDimension('budget_variance');
              if (chartType === 'heatmap') setChartType('bar');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              dimension === 'budget_variance'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            Budget vs Actual Variance
          </button>
          <button
            onClick={() => setDimension('cashflow')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              dimension === 'cashflow'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            Monthly Cashflow (Income vs Expense)
          </button>
          <button
            onClick={() => setDimension('balance_timeline')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              dimension === 'balance_timeline'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            Account Balance Trajectory
          </button>
          <button
            onClick={() => setDimension('top_merchants')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              dimension === 'top_merchants'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isDark ? 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
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
        <div className={`py-16 text-center text-xs ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
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

    // DIMENSION: SPENDING INTENSITY HEAT MAP CALENDAR
    if (dimension === 'spending_heatmap' || chartType === 'heatmap') {
      return renderSpendingHeatmapChart();
    }

    // DIMENSION 2: MEDIAN & AVERAGE SPENDING (ACCOUNT & CATEGORY)
    if (dimension === 'spending_stats') {
      return renderMedianAverageSpendingChart();
    }

    // DIMENSION 3: BUDGET VS ACTUAL VARIANCE
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
                    <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
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
          <span className="font-semibold text-slate-900 dark:text-zinc-100">Category Benchmark</span>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-indigo-500 font-semibold">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Actual Spent
            </span>
            <span className={`flex items-center gap-1.5 ${isDark ? 'text-zinc-400' : 'text-slate-600 font-semibold'}`}>
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

                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-700 dark:text-zinc-300 font-semibold">
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
            <span className={`text-[11px] uppercase tracking-wider font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Total Spent
            </span>
            <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-zinc-100">
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
                    className={`text-[9px] font-mono font-medium ${isDark ? 'fill-zinc-400' : 'fill-slate-600'}`}
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
                    className={`text-[10px] font-semibold ${isDark ? 'fill-zinc-400' : 'fill-slate-700'}`}
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
                    className={`text-[9px] font-mono font-medium ${isDark ? 'fill-zinc-400' : 'fill-slate-600'}`}
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
                      className={`text-[9px] font-mono font-medium ${isDark ? 'fill-zinc-400' : 'fill-slate-700'}`}
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
                <text x={x} y={height - 10} textAnchor="middle" className={`text-[9px] font-medium ${isDark ? 'fill-zinc-400' : 'fill-slate-700'}`}>
                  {d.label.slice(0, 8)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  function renderSpendingStatsLineChart(items: typeof activeStatsItems) {
    if (items.length === 0) return null;
    const maxVal = Math.max(...items.map(i => Math.max(i.average, i.median)), 1);
    const width = 640;
    const height = 240;
    const padding = 40;

    const getX = (index: number) => padding + (index / Math.max(1, items.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => height - padding - (val / maxVal) * (height - 2 * padding);

    const avgPoints = items.map((d, i) => `${getX(i)},${getY(d.average)}`).join(' ');
    const medPoints = items.map((d, i) => `${getX(i)},${getY(d.median)}`).join(' ');

    return (
      <div className="pt-2">
        <div className="w-full overflow-x-auto">
          <svg className="w-full min-w-[550px]" viewBox={`0 0 ${width} ${height}`}>
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
                    className={`text-[9px] font-mono font-medium ${isDark ? 'fill-zinc-400' : 'fill-slate-600'}`}
                  >
                    {Math.round(pct * maxVal)}
                  </text>
                </g>
              );
            })}

            {/* Average Line (Indigo) */}
            <polyline fill="none" stroke="#6366F1" strokeWidth="2.5" points={avgPoints} />
            {/* Median Line (Amber) */}
            <polyline fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeDasharray="4 4" points={medPoints} />

            {/* Points & Labels */}
            {items.map((d, i) => {
              const x = getX(i);
              const yAvg = getY(d.average);
              const yMed = getY(d.median);
              const isHovered = hoveredIndex === i;

              return (
                <g
                  key={d.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <circle cx={x} cy={yAvg} r={isHovered ? '6' : '4'} fill="#6366F1" />
                  <circle cx={x} cy={yMed} r={isHovered ? '6' : '3.5'} fill="#F59E0B" />
                  <text
                    x={x}
                    y={height - 12}
                    textAnchor="middle"
                    className={`text-[9px] font-semibold ${isDark ? 'fill-zinc-300' : 'fill-slate-700'}`}
                  >
                    {d.title.length > 10 ? d.title.slice(0, 8) + '…' : d.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover details */}
        {hoveredIndex !== null && items[hoveredIndex] && (
          <div className={`mt-3 p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between font-mono tabular-nums gap-2 ${
            isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}>
            <span className="font-sans font-bold">{items[hoveredIndex].title}</span>
            <div className="flex items-center gap-4">
              <span className="text-indigo-400 font-bold">Average: {formatCurrency(items[hoveredIndex].average, currency)}</span>
              <span className="text-amber-400 font-bold">Median: {formatCurrency(items[hoveredIndex].median, currency)}</span>
              <span className={items[hoveredIndex].diff >= 0 ? 'text-amber-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                Gap: {items[hoveredIndex].diff >= 0 ? '+' : ''}{formatCurrency(items[hoveredIndex].diff, currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderSpendingStatsDonutChart(items: typeof activeStatsItems) {
    const donutData = items.map(i => ({
      label: i.title,
      value: i.total,
      percent: spendingStatsData.overallTotal > 0 ? (i.total / spendingStatsData.overallTotal) * 100 : 0,
    }));
    return (
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-inherit">
          <span className="font-semibold text-slate-900 dark:text-zinc-100">
            Total Outlay Distribution with Average & Median Comparison
          </span>
          <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            {items.length} segments
          </span>
        </div>
        {renderDonutChart(donutData)}
      </div>
    );
  }

  function renderMedianAverageSpendingChart() {
    const items = activeStatsItems;
    if (items.length === 0) {
      return (
        <div className={`py-16 text-center text-xs ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
          No expense transactions found for the selected account and category criteria.
        </div>
      );
    }

    const maxVal = Math.max(...items.map(i => Math.max(i.average, i.median)), 1);

    return (
      <div className="space-y-6 pt-1">
        {/* Sub-header & Controls for Median vs Average Analysis */}
        <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isDark ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
        }`}>
          {/* Left: Dimension Aggregation Grouping */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-xs font-semibold mr-1 flex items-center gap-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Group by:
            </span>
            <button
              type="button"
              onClick={() => setStatsGrouping('category')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                statsGrouping === 'category'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              By Category
            </button>
            <button
              type="button"
              onClick={() => setStatsGrouping('account')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                statsGrouping === 'account'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              By Account
            </button>
            <button
              type="button"
              onClick={() => setStatsGrouping('cross')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                statsGrouping === 'cross'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Account × Category
            </button>
          </div>

          {/* Right: Filters & Sort Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Account filter inside stats */}
            <div className="flex items-center gap-1">
              <span className={isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}>Account:</span>
              <select
                value={statsAccountFilter}
                onChange={e => setStatsAccountFilter(e.target.value)}
                className={`text-xs px-2 py-1 rounded-md border outline-none font-medium ${
                  isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <option value="all">All Accounts</option>
                {accountOptions.filter(a => a !== 'all').map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Category filter inside stats */}
            <div className="flex items-center gap-1">
              <span className={isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}>Category:</span>
              <select
                value={statsCategoryFilter}
                onChange={e => setStatsCategoryFilter(e.target.value)}
                className={`text-xs px-2 py-1 rounded-md border outline-none font-medium max-w-[130px] truncate ${
                  isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <option value="all">All Categories</option>
                {categoryOptions.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Sort order */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-indigo-400" />
              <select
                value={statsSort}
                onChange={e => setStatsSort(e.target.value as any)}
                className={`text-xs px-2 py-1 rounded-md border outline-none font-medium ${
                  isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <option value="average">Highest Average</option>
                <option value="median">Highest Median</option>
                <option value="disparity">Largest Outlier Skew</option>
                <option value="count">Most Transactions</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4 Macro Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Mean / Average Outlay */}
          <div className={`p-4 rounded-xl border ${
            isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Overall Average Spend
              </span>
              <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                {formatCurrency(spendingStatsData.overallAverage, currency)}
              </div>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Mean ticket across all {spendingStatsData.overallCount} expenses
              </p>
            </div>
          </div>

          {/* Card 2: Median Outlay */}
          <div className={`p-4 rounded-xl border ${
            isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Overall Median Spend
              </span>
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {formatCurrency(spendingStatsData.overallMedian, currency)}
              </div>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                50th percentile typical purchase size
              </p>
            </div>
          </div>

          {/* Card 3: Outlier Skewness */}
          <div className={`p-4 rounded-xl border ${
            isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Skewness Disparity
              </span>
              <Scale className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="mt-2">
              <div className={`text-xl font-bold font-mono tabular-nums ${
                spendingStatsData.overallAverage > spendingStatsData.overallMedian * 1.15
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {spendingStatsData.overallMedian > 0
                  ? (spendingStatsData.overallAverage / spendingStatsData.overallMedian).toFixed(2) + 'x'
                  : '1.00x'}
              </div>
              <p className={`text-[11px] mt-0.5 truncate ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {spendingStatsData.overallAverage >= spendingStatsData.overallMedian
                  ? `Average is +${Math.round(((spendingStatsData.overallAverage - spendingStatsData.overallMedian) / Math.max(1, spendingStatsData.overallMedian)) * 100)}% higher than median`
                  : `Median is higher than average`}
              </p>
            </div>
          </div>

          {/* Card 4: Analyzed Volume */}
          <div className={`p-4 rounded-xl border ${
            isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Total Analyzed Outlays
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                {formatCurrency(spendingStatsData.overallTotal, currency)}
              </div>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {spendingStatsData.overallCount} transactions across {items.length} groups
              </p>
            </div>
          </div>
        </div>

        {/* Legend & Guide Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-inherit text-xs">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100">
              <span className="w-3 h-3 rounded-xs bg-indigo-600 dark:bg-indigo-500 inline-block" />
              <span>Average Spending (Mean)</span>
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100">
              <span className="w-3 h-3 rounded-xs bg-amber-500 dark:bg-amber-400 inline-block" />
              <span>Median Spending (50th %ile)</span>
            </span>
          </div>
          <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
            Tip: When Average &gt; Median, occasional high-dollar purchases pull up the average.
          </span>
        </div>

        {/* Chart View Content (Bar, Line, or Donut) */}
        {chartType === 'line' ? (
          renderSpendingStatsLineChart(items)
        ) : chartType === 'donut' ? (
          renderSpendingStatsDonutChart(items)
        ) : (
          /* Grouped Dual Bar Chart (Default) */
          <div className="space-y-4">
            {items.map((item, idx) => {
              const avgWidth = (item.average / maxVal) * 100;
              const medWidth = (item.median / maxVal) * 100;
              const isHovered = hoveredIndex === idx;
              const isInspected = statsInspectedId === item.id;
              const isHighSkew = item.average > item.median * 1.15;
              const isLowSkew = item.median > item.average * 1.15;

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => setStatsInspectedId(isInspected ? null : item.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isInspected
                      ? isDark
                        ? 'bg-zinc-800/80 border-indigo-500 ring-1 ring-indigo-500/40'
                        : 'bg-indigo-50/40 border-indigo-400 ring-1 ring-indigo-500/20'
                      : isHovered
                      ? isDark ? 'bg-zinc-800/40 border-zinc-700' : 'bg-slate-50 border-slate-300'
                      : isDark ? 'bg-zinc-900/50 border-zinc-800/80' : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Row Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                        {item.title}
                      </span>
                      {item.accountName && item.groupType === 'cross' && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.accountName}
                        </span>
                      )}
                      <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
                        · {item.count} {item.count === 1 ? 'txn' : 'txns'} · Total: {formatCurrency(item.total, currency)}
                      </span>
                    </div>

                    {/* Skew Tag */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isHighSkew
                          ? isDark ? 'bg-amber-950/60 border border-amber-800/60 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-800'
                          : isLowSkew
                          ? isDark ? 'bg-cyan-950/60 border border-cyan-800/60 text-cyan-300' : 'bg-cyan-50 border border-cyan-200 text-cyan-800'
                          : isDark ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      }`}>
                        {isHighSkew
                          ? `+${Math.round(((item.average - item.median) / Math.max(1, item.median)) * 100)}% outlier skew`
                          : isLowSkew
                          ? `-${Math.round(((item.median - item.average) / Math.max(1, item.average)) * 100)}% bottom cluster`
                          : 'Uniform spend'}
                      </span>
                      <span className={`text-[11px] font-mono tabular-nums ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
                        Range: {formatCurrency(item.min, currency)} – {formatCurrency(item.max, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Dual Grouped Bars */}
                  <div className="space-y-1.5">
                    {/* Average Bar */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-14 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                        Average:
                      </span>
                      <div className={`flex-1 h-3 rounded-full overflow-hidden ${
                        isDark ? 'bg-zinc-800' : 'bg-slate-100'
                      }`}>
                        <div
                          className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                          style={{ width: `${Math.max(2, avgWidth)}%` }}
                        />
                      </div>
                      <span className="w-20 font-mono tabular-nums text-right text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        {formatCurrency(item.average, currency)}
                      </span>
                    </div>

                    {/* Median Bar */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-14 text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                        Median:
                      </span>
                      <div className={`flex-1 h-3 rounded-full overflow-hidden ${
                        isDark ? 'bg-zinc-800' : 'bg-slate-100'
                      }`}>
                        <div
                          className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-300"
                          style={{ width: `${Math.max(2, medWidth)}%` }}
                        />
                      </div>
                      <span className="w-20 font-mono tabular-nums text-right text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0">
                        {formatCurrency(item.median, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Inspected Details Drawer */}
                  {isInspected && (
                    <div className={`mt-3 pt-3 border-t text-xs ${
                      isDark ? 'border-zinc-800 text-zinc-300' : 'border-slate-200 text-slate-700'
                    }`}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
                        <div>
                          <span className={`block text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500 font-medium'}`}>Absolute Gap</span>
                          <span className="font-semibold">{formatCurrency(Math.abs(item.diff), currency)} {item.diff >= 0 ? '(Avg higher)' : '(Med higher)'}</span>
                        </div>
                        <div>
                          <span className={`block text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500 font-medium'}`}>Ratio (Avg/Med)</span>
                          <span className="font-semibold">{item.ratio.toFixed(2)}x</span>
                        </div>
                        <div>
                          <span className={`block text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500 font-medium'}`}>Min Single Outlay</span>
                          <span className="font-semibold">{formatCurrency(item.min, currency)}</span>
                        </div>
                        <div>
                          <span className={`block text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500 font-medium'}`}>Max Outlier Outlay</span>
                          <span className="font-semibold text-rose-500 font-bold">{formatCurrency(item.max, currency)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Detailed Comparison Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
              Statistical Ledger: Median vs Average Summary
            </h4>
            <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
              Showing {items.length} segments sorted by {statsSort}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-inherit">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                  isDark ? 'bg-zinc-950/70 border-zinc-800 text-zinc-400' : 'bg-slate-100/90 border-slate-200 text-slate-700'
                }`}>
                  <th className="py-2.5 px-3">Segment</th>
                  <th className="py-2.5 px-3 text-center">Txns (N)</th>
                  <th className="py-2.5 px-3 text-right">Average (Mean)</th>
                  <th className="py-2.5 px-3 text-right">Median (50th %)</th>
                  <th className="py-2.5 px-3 text-right">Disparity Gap</th>
                  <th className="py-2.5 px-3 text-right">Spread (Min–Max)</th>
                  <th className="py-2.5 px-3 text-right">Total Outlays</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit font-mono tabular-nums">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 px-3 font-sans font-semibold text-slate-900 dark:text-zinc-100">
                      {item.title}
                    </td>
                    <td className="py-2 px-3 text-center text-slate-700 dark:text-zinc-300">
                      {item.count}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(item.average, currency)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(item.median, currency)}
                    </td>
                    <td className={`py-2 px-3 text-right font-semibold ${
                      item.diff > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-zinc-400'
                    }`}>
                      {item.diff >= 0 ? '+' : ''}{formatCurrency(item.diff, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-zinc-300">
                      {formatCurrency(item.min, currency)} – {formatCurrency(item.max, currency)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-zinc-100">
                      {formatCurrency(item.total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- SPENDING INTENSITY HEAT MAP CALENDAR ---
  function renderSpendingHeatmapChart() {
    const {
      availableMonths,
      availableMonthsChronological,
      activeMonthObj,
      calendarDays,
      paddingBefore,
      matrixWeeks,
      weekdayTotals,
      dayOfMonthProfile,
      peakDay,
      peakWeek,
      peakWeekday,
      totalMonthSpent,
      daysWithSpend,
      multiMonthStats,
      highestMonth,
      lowestMonth,
      allMonthsTotal,
      avgMonthTotal,
      maxMultiMonthWeekVal,
      maxMultiMonthDayVal,
      categoryMonthRows,
      maxCatMonthCellVal,
      monthCompareDual,
    } = heatmapData;

    if (!activeMonthObj || availableMonths.length === 0) {
      return (
        <div className={`py-16 text-center text-xs ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
          No expense transactions recorded to generate a heatmap calendar.
        </div>
      );
    }

    // Determine current month index for navigation
    const currentMonthIdx = availableMonths.findIndex(m => m.key === activeMonthObj.key);
    const hasNextMonth = currentMonthIdx > 0;
    const hasPrevMonth = currentMonthIdx < availableMonths.length - 1;

    const handlePrevMonth = () => {
      if (hasPrevMonth) {
        setHeatmapSelectedMonthKey(availableMonths[currentMonthIdx + 1].key);
        setSelectedHeatmapDay(null);
      }
    };

    const handleNextMonth = () => {
      if (hasNextMonth) {
        setHeatmapSelectedMonthKey(availableMonths[currentMonthIdx - 1].key);
        setSelectedHeatmapDay(null);
      }
    };

    // Calculate maximum metric value in active month calendar for color scaling
    const maxDayVal = Math.max(
      ...calendarDays.map(d => (heatmapMetric === 'amount' ? d.amount : d.count)),
      1
    );

    // Calculate maximum metric value in matrix
    let maxMatrixVal = 1;
    matrixWeeks.forEach(w => {
      w.days.forEach(d => {
        const v = heatmapMetric === 'amount' ? d.amount : d.count;
        if (v > maxMatrixVal) maxMatrixVal = v;
      });
    });

    // Calculate maximum in Day of Month profile
    const maxDomVal = Math.max(
      ...dayOfMonthProfile.map(d => (heatmapMetric === 'amount' ? d.amount : d.count)),
      1
    );

    // Intensity color mapper
    const getIntensityClasses = (val: number, max: number) => {
      if (val <= 0) {
        return isDark
          ? 'bg-zinc-900/50 border-zinc-800/80 text-zinc-500'
          : 'bg-slate-50 border-slate-200 text-slate-500';
      }
      const ratio = val / max;
      if (ratio < 0.25) {
        return isDark
          ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300 hover:border-indigo-600'
          : 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:border-indigo-400';
      }
      if (ratio < 0.55) {
        return isDark
          ? 'bg-indigo-900/60 border-indigo-700/80 text-indigo-100 hover:border-indigo-500'
          : 'bg-indigo-100 border-indigo-300 text-indigo-950 font-semibold hover:border-indigo-500';
      }
      if (ratio < 0.82) {
        return isDark
          ? 'bg-indigo-800/80 border-indigo-500 text-white font-bold hover:border-indigo-400'
          : 'bg-indigo-300 border-indigo-400 text-indigo-950 font-bold hover:border-indigo-600';
      }
      return isDark
        ? 'bg-gradient-to-br from-indigo-600 to-rose-600 border-rose-500 text-white font-extrabold shadow-sm hover:border-rose-400'
        : 'bg-gradient-to-br from-indigo-600 to-rose-600 border-rose-600 text-white font-extrabold shadow-sm hover:border-rose-700';
    };

    // Filter transactions for inspected day
    const inspectedDayObj = selectedHeatmapDay
      ? calendarDays.find(d => d.dateKey === selectedHeatmapDay) ||
        dayOfMonthProfile.find(d => String(d.dayNum) === selectedHeatmapDay)
      : null;

    const inspectedTxs = inspectedDayObj ? inspectedDayObj.txs : [];

    return (
      <div className="space-y-6 pt-1">
        {/* Controls Bar */}
        <div
          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isDark ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* View Mode Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`text-xs font-semibold mr-1 flex items-center gap-1 ${
                isDark ? 'text-zinc-300' : 'text-slate-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-400" /> View:
            </span>
            <button
              type="button"
              onClick={() => setHeatmapViewMode('calendar')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                heatmapViewMode === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Monthly Calendar
            </button>
            <button
              type="button"
              onClick={() => setHeatmapViewMode('multi_month')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                heatmapViewMode === 'multi_month'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Compare All Months</span>
            </button>
            <button
              type="button"
              onClick={() => setHeatmapViewMode('month_category')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                heatmapViewMode === 'month_category'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Month × Category</span>
            </button>
            <button
              type="button"
              onClick={() => setHeatmapViewMode('month_compare_dual')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                heatmapViewMode === 'month_compare_dual'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Month A vs B Delta</span>
            </button>
            <button
              type="button"
              onClick={() => setHeatmapViewMode('matrix')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                heatmapViewMode === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Week × Day Matrix
            </button>
            <button
              type="button"
              onClick={() => setHeatmapViewMode('day_of_month')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                heatmapViewMode === 'day_of_month'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Day 1–31 Cycle
            </button>
          </div>

          {/* Metric Selector & Month Stepper */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Metric Toggle */}
            <div className="flex items-center gap-1">
              <span className={isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}>
                Intensity by:
              </span>
              <div
                className={`inline-flex rounded-md p-0.5 border ${
                  isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setHeatmapMetric('amount')}
                  className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                    heatmapMetric === 'amount'
                      ? 'bg-indigo-600 text-white'
                      : isDark
                      ? 'text-zinc-300 hover:text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Amount ($)
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapMetric('count')}
                  className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                    heatmapMetric === 'count'
                      ? 'bg-indigo-600 text-white'
                      : isDark
                      ? 'text-zinc-300 hover:text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Frequency
                </button>
              </div>
            </div>

            {/* Month Navigator (for Single Calendar & Matrix modes) */}
            {(heatmapViewMode === 'calendar' || heatmapViewMode === 'matrix') && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  disabled={!hasPrevMonth}
                  title="Previous Month"
                  className={`p-1 rounded-md border ${
                    hasPrevMonth
                      ? isDark
                        ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                      : 'opacity-40 cursor-not-allowed border-transparent'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <select
                  value={activeMonthObj.key}
                  onChange={e => {
                    setHeatmapSelectedMonthKey(e.target.value);
                    setSelectedHeatmapDay(null);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-md border outline-none font-semibold ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  {availableMonths.map(m => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.count} txns)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  disabled={!hasNextMonth}
                  title="Next Month"
                  className={`p-1 rounded-md border ${
                    hasNextMonth
                      ? isDark
                        ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                      : 'opacity-40 cursor-not-allowed border-transparent'
                  }`}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4 Macro Key Metric Heatmap Cards (Adaptive to Active View) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {heatmapViewMode === 'multi_month' || heatmapViewMode === 'month_category' ? (
            <>
              {/* Card 1: Peak Month */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Peak Spending Month
                  </span>
                  <Flame className="w-4 h-4 text-rose-500" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 truncate">
                    {highestMonth ? formatCurrency(highestMonth.totalAmount, currency) : '—'}
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    {highestMonth ? `${highestMonth.label} · ${highestMonth.count} purchases` : 'No outlays recorded'}
                  </p>
                </div>
              </div>

              {/* Card 2: Lowest Month */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Lowest Spending Month
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 truncate">
                    {lowestMonth ? formatCurrency(lowestMonth.totalAmount, currency) : '—'}
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    {lowestMonth ? `${lowestMonth.label} · ${lowestMonth.count} purchases` : 'No outlays recorded'}
                  </p>
                </div>
              </div>

              {/* Card 3: Monthly Average Run-Rate */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Monthly Average Run-Rate
                  </span>
                  <Clock className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(avgMonthTotal, currency)}
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Mean expenditure across {multiMonthStats.length} recorded months
                  </p>
                </div>
              </div>

              {/* Card 4: Total Tracked Across All Months */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Total Outlays Across All Months
                  </span>
                  <Grid className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                    {formatCurrency(allMonthsTotal, currency)}
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    {multiMonthStats.reduce((s, m) => s + m.count, 0)} transactions in scope
                  </p>
                </div>
              </div>
            </>
          ) : heatmapViewMode === 'month_compare_dual' && monthCompareDual ? (
            <>
              {/* Dual Card 1: Net Delta */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Net Spending Delta (A vs B)
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-xl font-bold font-mono tabular-nums ${
                    monthCompareDual.diffAmount > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : monthCompareDual.diffAmount < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-900 dark:text-zinc-100'
                  }`}>
                    {monthCompareDual.diffAmount >= 0 ? '+' : ''}{formatCurrency(monthCompareDual.diffAmount, currency)}
                  </span>
                  <span className={`text-xs font-bold ${
                    monthCompareDual.diffAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    ({monthCompareDual.pctChange >= 0 ? '+' : ''}{monthCompareDual.pctChange.toFixed(1)}%)
                  </span>
                </div>
                <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  {monthCompareDual.diffAmount > 0 ? 'Month A spent more than Month B' : monthCompareDual.diffAmount < 0 ? 'Month A achieved savings' : 'Equal total expenditures'}
                </p>
              </div>

              {/* Dual Card 2: Daily Burn Rate Shift */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Daily Burn Rate Shift
                </span>
                <div className="mt-2">
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                    {formatCurrency(monthCompareDual.dailyAvgA, currency)}/day
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    vs {formatCurrency(monthCompareDual.dailyAvgB, currency)}/day in Month B ({monthCompareDual.dailyAvgDiff >= 0 ? '+' : ''}{formatCurrency(monthCompareDual.dailyAvgDiff, currency)}/day)
                  </p>
                </div>
              </div>

              {/* Dual Card 3: Volume Shift */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Purchase Volume Shift
                </span>
                <div className="mt-2">
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                    {monthCompareDual.monthA.count} vs {monthCompareDual.monthB.count} txns
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    {monthCompareDual.diffCount >= 0 ? '+' : ''}{monthCompareDual.diffCount} transaction frequency delta
                  </p>
                </div>
              </div>

              {/* Dual Card 4: Top Category Driver */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Primary Category Shift
                </span>
                <div className="mt-2 truncate">
                  <div className="text-xl font-bold truncate text-slate-900 dark:text-zinc-100">
                    {monthCompareDual.categoryDeltas[0]?.category || 'None'}
                  </div>
                  <p className={`text-[11px] mt-0.5 font-mono ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
                    {monthCompareDual.categoryDeltas[0]
                      ? `${monthCompareDual.categoryDeltas[0].diff >= 0 ? '+' : ''}${formatCurrency(monthCompareDual.categoryDeltas[0].diff, currency)} shift`
                      : 'No deltas recorded'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Standard Single Month Card 1: Peak Day */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Peak Spending Day
                  </span>
                  <Flame className="w-4 h-4 text-rose-500" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                    {peakDay.amount > 0 ? formatCurrency(peakDay.amount, currency) : '—'}
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    {peakDay.dateKey ? `Day ${peakDay.dayNum} · ${peakDay.count} transactions recorded` : 'No outlays recorded'}
                  </p>
                </div>
              </div>

              {/* Standard Single Month Card 2: Most Expensive Week */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Most Expensive Week
                  </span>
                  <CalendarDays className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                    {peakWeek ? formatCurrency(peakWeek.totalAmount, currency) : '—'}
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    {peakWeek
                      ? `${peakWeek.label} (${peakWeek.dayRange}) · ${totalMonthSpent > 0 ? Math.round((peakWeek.totalAmount / totalMonthSpent) * 100) : 0}% of month`
                      : 'No weekly outlays'}
                  </p>
                </div>
              </div>

              {/* Standard Single Month Card 3: Heaviest Weekday */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Heaviest Weekday
                  </span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    {peakWeekday ? peakWeekday.name : '—'}
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    {peakWeekday ? `${formatCurrency(peakWeekday.totalAmount, currency)} across ${peakWeekday.totalCount} purchases` : 'No weekday patterns'}
                  </p>
                </div>
              </div>

              {/* Standard Single Month Card 4: Active Days */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Month Total & Cadence
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-zinc-100">
                    {formatCurrency(totalMonthSpent, currency)}
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    {daysWithSpend} of {calendarDays.length} days had spending activity
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Color Scale Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-inherit text-xs">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              Heatmap Intensity Scale:
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="flex items-center gap-1">
                <span
                  className={`w-3.5 h-3.5 rounded border inline-block ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'
                  }`}
                />
                <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>$0</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-800 inline-block" />
                <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>Low</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-indigo-300 dark:bg-indigo-900/80 border border-indigo-400 dark:border-indigo-700 inline-block" />
                <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>Medium</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-indigo-500 dark:bg-indigo-700 border border-indigo-600 dark:border-indigo-500 inline-block" />
                <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>High</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-gradient-to-br from-indigo-600 to-rose-600 border border-rose-500 inline-block" />
                <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>Peak Outlay</span>
              </span>
            </div>
          </div>
          <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            Click any cell to view day transactions
          </span>
        </div>

        {/* VIEW 1: MONTHLY CALENDAR GRID */}
        {heatmapViewMode === 'calendar' && (
          <div className="space-y-3">
            {/* Calendar header: Weekdays */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                <div
                  key={day}
                  className={`py-2 rounded-lg ${
                    i === 0 || i === 6
                      ? isDark
                        ? 'bg-zinc-950/60 text-indigo-400'
                        : 'bg-indigo-50/70 text-indigo-700'
                      : isDark
                      ? 'bg-zinc-900/40'
                      : 'bg-slate-100/70'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: paddingBefore }).map((_, idx) => (
                <div
                  key={`pad-${idx}`}
                  className={`min-h-[75px] rounded-xl border border-dashed opacity-30 ${
                    isDark ? 'border-zinc-800 bg-zinc-950/20' : 'border-slate-200 bg-slate-50/30'
                  }`}
                />
              ))}

              {calendarDays.map(d => {
                const isSelected = selectedHeatmapDay === d.dateKey;
                const isPeak = peakDay.dayNum === d.dayNum && peakDay.amount > 0;
                const displayVal = heatmapMetric === 'amount' ? d.amount : d.count;
                const cellClasses = getIntensityClasses(displayVal, maxDayVal);

                return (
                  <button
                    key={d.dateKey}
                    type="button"
                    onClick={() =>
                      setSelectedHeatmapDay(isSelected ? null : d.dateKey)
                    }
                    className={`min-h-[78px] p-2 rounded-xl border text-left transition-all relative flex flex-col justify-between group ${cellClasses} ${
                      isSelected
                        ? isDark
                          ? 'ring-2 ring-indigo-400 border-indigo-400 shadow-md'
                          : 'ring-2 ring-indigo-600 border-indigo-600 shadow-md'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold font-mono">
                        {d.dayNum}
                      </span>
                      {isPeak && (
                        <span title="Peak Spending Day">
                          <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                        </span>
                      )}
                    </div>

                    <div className="mt-1">
                      {d.amount > 0 ? (
                        <>
                          <div className="text-[11px] font-bold font-mono tabular-nums truncate">
                            {formatCurrency(d.amount, currency)}
                          </div>
                          <div className="text-[9px] font-medium opacity-85 truncate">
                            {d.count} {d.count === 1 ? 'txn' : 'txns'}
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] opacity-40 font-mono">—</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: COMPARE ALL MONTHS (MULTI-MONTH MATRIX / TIMELINE) */}
        {heatmapViewMode === 'multi_month' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>Multi-Month Spending Intensity Comparison</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {multiMonthStats.length} months analyzed
                  </span>
                </h4>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
                  Compare spending intensity, weekly rhythm, and Month-over-Month shifts across all periods
                </p>
              </div>

              <div className="flex items-center gap-1 self-start sm:self-auto">
                <span className={isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}>Layout:</span>
                <div className={`inline-flex rounded-md p-0.5 border ${
                  isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => setMultiMonthDisplayType('weekly')}
                    className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                      multiMonthDisplayType === 'weekly'
                        ? 'bg-indigo-600 text-white'
                        : isDark ? 'text-zinc-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    5-Week Matrix
                  </button>
                  <button
                    type="button"
                    onClick={() => setMultiMonthDisplayType('daily_strip')}
                    className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                      multiMonthDisplayType === 'daily_strip'
                        ? 'bg-indigo-600 text-white'
                        : isDark ? 'text-zinc-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    31-Day Timeline Strip
                  </button>
                </div>
              </div>
            </div>

            {multiMonthDisplayType === 'weekly' ? (
              <div className="overflow-x-auto rounded-xl border border-inherit">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                      isDark ? 'bg-zinc-950/70 border-zinc-800 text-zinc-400' : 'bg-slate-100/90 border-slate-200 text-slate-700'
                    }`}>
                      <th className="py-2.5 px-3">Month</th>
                      <th className="py-2.5 px-2 text-center">Week 1 (1–7)</th>
                      <th className="py-2.5 px-2 text-center">Week 2 (8–14)</th>
                      <th className="py-2.5 px-2 text-center">Week 3 (15–21)</th>
                      <th className="py-2.5 px-2 text-center">Week 4 (22–28)</th>
                      <th className="py-2.5 px-2 text-center">Week 5 (29–31)</th>
                      <th className="py-2.5 px-3 text-right">Total Outlay</th>
                      <th className="py-2.5 px-3 text-right">MoM Shift</th>
                      <th className="py-2.5 px-3 text-right">Peak Day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-inherit font-mono tabular-nums">
                    {multiMonthStats.map((m) => {
                      const isHighest = highestMonth?.key === m.key;
                      const isLowest = lowestMonth?.key === m.key && multiMonthStats.length > 1;

                      return (
                        <tr
                          key={m.key}
                          className={`transition-colors ${
                            isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-sans">
                            <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                              <span>{m.label}</span>
                              {isHighest && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/30">
                                  Highest
                                </span>
                              )}
                              {isLowest && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  Lowest
                                </span>
                              )}
                            </div>
                            <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
                              {m.count} transactions recorded
                            </div>
                          </td>

                          {/* 5 Weeks Cells */}
                          {m.weeks.map((w) => {
                            const val = heatmapMetric === 'amount' ? w.amount : w.count;
                            const cellClasses = getIntensityClasses(val, maxMultiMonthWeekVal);

                            return (
                              <td key={w.weekIndex} className="p-1 text-center">
                                <div className={`py-2 px-1.5 rounded-lg border text-xs transition-colors flex flex-col items-center justify-center ${cellClasses}`}>
                                  {w.amount > 0 ? (
                                    <>
                                      <span className="font-bold">
                                        {formatCurrency(w.amount, currency)}
                                      </span>
                                      <span className="text-[9px] opacity-80">
                                        {w.count} {w.count === 1 ? 'txn' : 'txns'}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="opacity-40">—</span>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-zinc-100">
                            {formatCurrency(m.totalAmount, currency)}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            {m.hasPrev ? (
                              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                                m.momDiff > 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : m.momDiff < 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isDark ? 'text-zinc-400' : 'text-slate-600'
                              }`}>
                                {m.momDiff > 0 ? (
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                ) : m.momDiff < 0 ? (
                                  <ArrowDownRight className="w-3.5 h-3.5" />
                                ) : null}
                                <span>{m.momDiff > 0 ? '+' : ''}{m.momPct.toFixed(1)}%</span>
                              </span>
                            ) : (
                              <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-slate-400 font-medium'}`}>
                                Baseline
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right text-slate-700 dark:text-zinc-300">
                            {m.peakDay.amount > 0 ? (
                              <span className="font-semibold">
                                Day {m.peakDay.dayNum} ({formatCurrency(m.peakDay.amount, currency)})
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={`border-t font-semibold ${
                      isDark ? 'bg-zinc-950/60 text-zinc-300' : 'bg-slate-100/80 text-slate-900'
                    }`}>
                      <td className="py-2.5 px-3 font-sans text-xs">Monthly Average</td>
                      {Array.from({ length: 5 }).map((_, wIdx) => {
                        const totalW = multiMonthStats.reduce((s, m) => s + m.weeks[wIdx].amount, 0);
                        const avgW = multiMonthStats.length > 0 ? totalW / multiMonthStats.length : 0;
                        return (
                          <td key={wIdx} className="py-2.5 px-2 text-center">
                            <span className="font-mono text-xs">{formatCurrency(avgW, currency)}</span>
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(avgMonthTotal, currency)}
                      </td>
                      <td colSpan={2} className={`py-2.5 px-3 text-right text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
                        Total Outlays: {formatCurrency(allMonthsTotal, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              /* 31-Day Timeline Strip Grid */
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-inherit p-4">
                  <div className="min-w-[750px] space-y-3">
                    {/* Days header 1..31 */}
                    <div className="flex items-center gap-1 pl-32 pr-24">
                      {Array.from({ length: 31 }, (_, i) => (
                        <div key={i} className="flex-1 text-center font-mono text-[9px] font-semibold text-slate-500 dark:text-zinc-400">
                          {i + 1}
                        </div>
                      ))}
                    </div>

                    {/* Rows for each month */}
                    {multiMonthStats.map((m) => (
                      <div key={m.key} className="flex items-center gap-1">
                        <div className="w-32 shrink-0 text-xs font-bold text-slate-900 dark:text-zinc-100 truncate pr-2" title={m.label}>
                          {m.label}
                        </div>
                        <div className="flex-1 flex items-center gap-1">
                          {m.days.map((d) => {
                            const val = heatmapMetric === 'amount' ? d.amount : d.count;
                            const cellClasses = getIntensityClasses(val, maxMultiMonthDayVal);
                            const isSelected = selectedHeatmapDay === d.dateKey;

                            return (
                              <button
                                key={d.dayNum}
                                type="button"
                                onClick={() => setSelectedHeatmapDay(isSelected ? null : d.dateKey)}
                                title={`${m.label} Day ${d.dayNum}: ${formatCurrency(d.amount, currency)} (${d.count} txns)`}
                                className={`flex-1 h-7 rounded border transition-all flex items-center justify-center text-[8px] font-mono ${cellClasses} ${
                                  isSelected ? 'ring-2 ring-indigo-500 shadow-xs' : ''
                                }`}
                              >
                                {d.amount > 0 ? '' : ''}
                              </button>
                            );
                          })}
                        </div>
                        <div className="w-24 shrink-0 text-right font-mono text-xs font-bold text-slate-900 dark:text-zinc-100 pl-2">
                          {formatCurrency(m.totalAmount, currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: MONTH × CATEGORY HEATMAP MATRIX */}
        {heatmapViewMode === 'month_category' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>Month × Category Spending Heatmap</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {categoryMonthRows.length} categories across {availableMonthsChronological.length} months
                  </span>
                </h4>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
                  Compare how each spending category escalates or contracts across different months
                </p>
              </div>

              <div className="flex items-center gap-1 self-start sm:self-auto">
                <span className={isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}>Sort by:</span>
                <select
                  value={categoryHeatmapSort}
                  onChange={(e) => setCategoryHeatmapSort(e.target.value as any)}
                  className={`text-xs px-2.5 py-1 rounded-md border outline-none font-semibold ${
                    isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <option value="total">Highest Total Spend</option>
                  <option value="volatility">Largest Month Fluctuation</option>
                  <option value="name">Category Name (A-Z)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-inherit">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                    isDark ? 'bg-zinc-950/70 border-zinc-800 text-zinc-400' : 'bg-slate-100/90 border-slate-200 text-slate-700'
                  }`}>
                    <th className="py-2.5 px-3">Category</th>
                    {availableMonthsChronological.map((m) => (
                      <th key={m.key} className="py-2.5 px-2 text-center">
                        {m.label}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right">Category Total</th>
                    <th className="py-2.5 px-3 text-right">Monthly Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit font-mono tabular-nums">
                  {categoryMonthRows.map((catRow) => (
                    <tr
                      key={catRow.category}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-sans">
                        <span className="font-bold text-slate-900 dark:text-zinc-100">
                          {catRow.category}
                        </span>
                        <span className={`block text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
                          {catRow.count} txns recorded
                        </span>
                      </td>

                      {catRow.monthSpends.map((ms) => {
                        const val = heatmapMetric === 'amount' ? ms.amount : ms.count;
                        const cellClasses = getIntensityClasses(val, maxCatMonthCellVal);
                        const isPeakMonth = catRow.peakMonth.monthKey === ms.monthKey && ms.amount > 0;

                        return (
                          <td key={ms.monthKey} className="p-1 text-center">
                            <div className={`py-2 px-1.5 rounded-lg border text-xs transition-colors flex flex-col items-center justify-center relative ${cellClasses}`}>
                              {ms.amount > 0 ? (
                                <>
                                  <span className="font-bold">
                                    {formatCurrency(ms.amount, currency)}
                                  </span>
                                  <span className="text-[9px] opacity-80">
                                    {ms.count} {ms.count === 1 ? 'txn' : 'txns'}
                                  </span>
                                  {isPeakMonth && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-1 ring-white" title="Peak Month for this Category" />
                                  )}
                                </>
                              ) : (
                                <span className="opacity-40">—</span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-zinc-100">
                        {formatCurrency(catRow.totalAmount, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(catRow.avgAmount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={`border-t font-semibold ${
                    isDark ? 'bg-zinc-950/60 text-zinc-300' : 'bg-slate-100/80 text-slate-900'
                  }`}>
                    <td className="py-2.5 px-3 font-sans text-xs">Total Monthly Outlays</td>
                    {availableMonthsChronological.map((m) => (
                      <td key={m.key} className="py-2.5 px-2 text-center">
                        <div className="font-bold font-mono">
                          {formatCurrency(m.totalAmount, currency)}
                        </div>
                        <div className={`text-[9px] font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                          {m.count} txns
                        </div>
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(allMonthsTotal, currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(avgMonthTotal, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 4: MONTH A VS MONTH B DUAL DELTA COMPARISON */}
        {heatmapViewMode === 'month_compare_dual' && (
          <div className="space-y-5">
            {/* Month Selection Bar */}
            <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
              isDark ? 'bg-zinc-950/70 border-zinc-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Base Month (A):</span>
                  <select
                    value={activeMonthObj.key}
                    onChange={(e) => {
                      setHeatmapSelectedMonthKey(e.target.value);
                      setSelectedHeatmapDay(null);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-md border outline-none font-semibold ${
                      isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {availableMonths.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className={`text-xs font-bold px-2 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600'}`}>
                  VS
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Compare Month (B):</span>
                  <select
                    value={monthCompareDual?.monthB?.key || ''}
                    onChange={(e) => {
                      setHeatmapCompareMonthKey(e.target.value);
                      setSelectedHeatmapDay(null);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-md border outline-none font-semibold ${
                      isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {availableMonths.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Side-by-side week rhythm and category variance analysis
              </div>
            </div>

            {monthCompareDual ? (
              <div className="space-y-5">
                {/* 5-Week Comparative Side-by-Side Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
                    Week-by-Week Side-by-Side Comparison
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-inherit">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                          isDark ? 'bg-zinc-950/70 border-zinc-800 text-zinc-400' : 'bg-slate-100/90 border-slate-200 text-slate-700'
                        }`}>
                          <th className="py-2.5 px-3">Week of Month</th>
                          <th className="py-2.5 px-3 text-right">{monthCompareDual.monthA.label} (A)</th>
                          <th className="py-2.5 px-3 text-right">{monthCompareDual.monthB.label} (B)</th>
                          <th className="py-2.5 px-3 text-right">Variance ($)</th>
                          <th className="py-2.5 px-3 text-right">Shift (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-inherit font-mono tabular-nums">
                        {monthCompareDual.weeksComparison.map((w) => (
                          <tr key={w.weekIndex} className={`transition-colors ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-slate-50'}`}>
                            <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-zinc-100">
                              {w.label} ({w.dayRange})
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                              {formatCurrency(w.amtA, currency)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                              {formatCurrency(w.amtB, currency)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              w.diff > 0 ? 'text-rose-600 dark:text-rose-400' : w.diff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-zinc-400'
                            }`}>
                              {w.diff >= 0 ? '+' : ''}{formatCurrency(w.diff, currency)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              w.diff > 0 ? 'text-rose-600 dark:text-rose-400' : w.diff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-zinc-400'
                            }`}>
                              {w.amtB > 0 ? `${w.pct >= 0 ? '+' : ''}${w.pct.toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Category Variance Shift Breakdown */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
                    Category Variance Shift ({monthCompareDual.monthA.label} vs {monthCompareDual.monthB.label})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-inherit">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                          isDark ? 'bg-zinc-950/70 border-zinc-800 text-zinc-400' : 'bg-slate-100/90 border-slate-200 text-slate-700'
                        }`}>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3 text-right">{monthCompareDual.monthA.label}</th>
                          <th className="py-2.5 px-3 text-right">{monthCompareDual.monthB.label}</th>
                          <th className="py-2.5 px-3 text-right">Net Dollar Gap</th>
                          <th className="py-2.5 px-3 text-right">Relative Shift</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-inherit font-mono tabular-nums">
                        {monthCompareDual.categoryDeltas.map((cat) => (
                          <tr key={cat.category} className={`transition-colors ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-slate-50'}`}>
                            <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-zinc-100">
                              {cat.category}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-800 dark:text-zinc-200">
                              {formatCurrency(cat.catA, currency)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-800 dark:text-zinc-200">
                              {formatCurrency(cat.catB, currency)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              cat.diff > 0 ? 'text-rose-600 dark:text-rose-400' : cat.diff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-zinc-400'
                            }`}>
                              {cat.diff >= 0 ? '+' : ''}{formatCurrency(cat.diff, currency)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              cat.diff > 0 ? 'text-rose-600 dark:text-rose-400' : cat.diff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-zinc-400'
                            }`}>
                              {cat.catB > 0 ? `${cat.pct >= 0 ? '+' : ''}${cat.pct.toFixed(1)}%` : cat.catA > 0 ? '+100% (New)' : '0%'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`py-12 text-center text-xs ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Need at least two recorded months in this filtered timeframe to perform a comparative analysis.
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: WEEK OF MONTH × DAY OF WEEK MATRIX */}
        {heatmapViewMode === 'matrix' && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-inherit">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr
                    className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                      isDark
                        ? 'bg-zinc-950/70 border-zinc-800 text-zinc-400'
                        : 'bg-slate-100/90 border-slate-200 text-slate-700'
                    }`}
                  >
                    <th className="py-2.5 px-3">Week of Month</th>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(name => (
                      <th key={name} className="py-2.5 px-2 text-center">
                        {name}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right">Week Outlays</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit font-mono tabular-nums">
                  {matrixWeeks.map((week) => {
                    const isPeakThisWeek = peakWeek && peakWeek.weekIndex === week.weekIndex;
                    return (
                      <tr
                        key={week.weekIndex}
                        className={`transition-colors ${
                          isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans">
                          <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <span>{week.label}</span>
                            {isPeakThisWeek && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                Peak
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-[10px] ${
                              isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'
                            }`}
                          >
                            {week.dayRange}
                          </div>
                        </td>

                        {week.days.map((dayCell, dow) => {
                          const val = heatmapMetric === 'amount' ? dayCell.amount : dayCell.count;
                          const cellClasses = getIntensityClasses(val, maxMatrixVal);

                          return (
                            <td key={dow} className="p-1 text-center">
                              <div
                                className={`py-2 px-1.5 rounded-lg border text-xs transition-colors flex flex-col items-center justify-center ${cellClasses}`}
                              >
                                {dayCell.amount > 0 ? (
                                  <>
                                    <span className="font-bold">
                                      {formatCurrency(dayCell.amount, currency)}
                                    </span>
                                    <span className="text-[9px] opacity-80">
                                      {dayCell.count} txn{dayCell.count === 1 ? '' : 's'}
                                    </span>
                                  </>
                                ) : (
                                  <span className="opacity-40">—</span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-zinc-100">
                          {formatCurrency(week.totalAmount, currency)}
                          <div
                            className={`text-[10px] font-normal ${
                              isDark ? 'text-zinc-400' : 'text-slate-600'
                            }`}
                          >
                            {week.totalCount} txns ·{' '}
                            {totalMonthSpent > 0
                              ? Math.round((week.totalAmount / totalMonthSpent) * 100)
                              : 0}
                            %
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Column Totals by Day of Week */}
                <tfoot>
                  <tr
                    className={`border-t font-semibold ${
                      isDark ? 'bg-zinc-950/60 text-zinc-300' : 'bg-slate-100/80 text-slate-900'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-sans text-xs">Total by Weekday</td>
                    {weekdayTotals.map(wt => (
                      <td key={wt.name} className="py-2.5 px-2 text-center">
                        <div className="font-bold font-mono">
                          {formatCurrency(wt.totalAmount, currency)}
                        </div>
                        <div
                          className={`text-[9px] font-medium ${
                            isDark ? 'text-zinc-400' : 'text-slate-600'
                          }`}
                        >
                          {wt.totalCount} txns
                        </div>
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(totalMonthSpent, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 6: DAY OF MONTH 1–31 RECURRING CYCLE */}
        {heatmapViewMode === 'day_of_month' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span
                className={`font-semibold ${
                  isDark ? 'text-zinc-300' : 'text-slate-700'
                }`}
              >
                Recurring Spending Cycle Across All Recorded Months (Days 1–31)
              </span>
              <span
                className={`text-[11px] font-medium ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}
              >
                Identifies recurring bill days, paydays, and mid-month surges
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-8 gap-2">
              {dayOfMonthProfile.map(dom => {
                const val = heatmapMetric === 'amount' ? dom.amount : dom.count;
                const cellClasses = getIntensityClasses(val, maxDomVal);
                const isSelected = selectedHeatmapDay === String(dom.dayNum);

                return (
                  <button
                    key={dom.dayNum}
                    type="button"
                    onClick={() =>
                      setSelectedHeatmapDay(isSelected ? null : String(dom.dayNum))
                    }
                    className={`p-2 rounded-xl border text-left transition-all ${cellClasses} ${
                      isSelected
                        ? isDark
                          ? 'ring-2 ring-indigo-400 border-indigo-400'
                          : 'ring-2 ring-indigo-600 border-indigo-600'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono">
                        Day {dom.dayNum}
                      </span>
                      {dom.amount === maxDomVal && dom.amount > 0 && (
                        <span title="Overall Peak Cycle Day">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <div className="text-[11px] font-bold font-mono tabular-nums truncate">
                        {dom.amount > 0 ? formatCurrency(dom.amount, currency) : '—'}
                      </div>
                      <div className="text-[9px] opacity-80">
                        {dom.count} {dom.count === 1 ? 'txn' : 'txns'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Day Transaction Drill-Down Drawer */}
        {selectedHeatmapDay && (
          <div
            className={`p-4 rounded-xl border ${
              isDark ? 'bg-zinc-950/80 border-indigo-500/40' : 'bg-indigo-50/40 border-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  {heatmapViewMode === 'day_of_month'
                    ? `Expenses Occurring on Day ${selectedHeatmapDay} of Month`
                    : `Expense Outlays for ${selectedHeatmapDay}`}
                </h4>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {inspectedTxs.length} {inspectedTxs.length === 1 ? 'transaction' : 'transactions'}
                </span>
                <span className="text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400">
                  Total: {formatCurrency(
                    inspectedTxs.reduce((s, t) => s + t.amount, 0),
                    currency
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHeatmapDay(null)}
                className={`p-1 rounded-lg transition-colors ${
                  isDark
                    ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="Close Day Inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inspectedTxs.length === 0 ? (
              <div
                className={`py-6 text-center text-xs ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}
              >
                No expense transactions recorded on this day.
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isDark ? 'text-zinc-400' : 'text-slate-600'
                      }`}
                    >
                      <th className="py-1.5 px-2">Account</th>
                      <th className="py-1.5 px-2">Category</th>
                      <th className="py-1.5 px-2">Description</th>
                      <th className="py-1.5 px-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-inherit">
                    {inspectedTxs.map(t => (
                      <tr
                        key={t.id}
                        className={`transition-colors ${
                          isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-white/80'
                        }`}
                      >
                        <td className="py-2 px-2 font-medium text-slate-800 dark:text-zinc-200">
                          {t.account}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-200/80 text-slate-800'
                            }`}
                          >
                            {t.category}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-900 dark:text-zinc-100 font-medium truncate max-w-[200px]">
                          {t.description}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(t.amount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
};
