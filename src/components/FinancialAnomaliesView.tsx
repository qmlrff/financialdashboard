import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Sliders,
  CheckCircle,
  Copy,
  TrendingUp,
  ArrowUpRight,
  Filter,
  Check,
  Eye,
  Info,
  DollarSign,
  RotateCcw,
  Activity,
  Calendar,
  Zap,
  BarChart3,
  X,
  Tag,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  LabelList,
} from 'recharts';
import { FinancialAnomaly, AnomalySeverity, AnomalyType, PeriodInfo } from '../types/finance';
import { SensitivityLevel } from '../utils/anomalyDetection';
import { formatCurrency } from '../utils/analytics';

type AnomalyThresholdFilterMode = 'monetary' | 'multiplier';

export interface AnomalyTimelinePoint {
  key: string;
  label: string;
  shortLabel: string;
  date: Date;
  count: number;
  totalAmount: number;
  anomalies: FinancialAnomaly[];
  hasHighSeverity: boolean;
}

/**
 * Builds chronological timeline data points across the active period for anomaly frequency analysis.
 */
function generateAnomalyTimeline(
  anomalies: FinancialAnomaly[],
  period?: PeriodInfo
): AnomalyTimelinePoint[] {
  // If period has start and end dates
  if (period && period.start && period.end) {
    const startMs = period.start.getTime();
    const endMs = period.end.getTime();
    const diffDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

    // 1. Daily breakdown if span is <= 35 days (Monthly, Weekly, or short Custom period)
    if (diffDays <= 35) {
      const points: AnomalyTimelinePoint[] = [];
      const current = new Date(period.start);
      current.setHours(0, 0, 0, 0);

      while (current.getTime() <= endMs) {
        const y = current.getFullYear();
        const m = current.getMonth();
        const d = current.getDate();

        const matches = anomalies.filter(a => {
          const ad = a.date;
          return ad.getFullYear() === y && ad.getMonth() === m && ad.getDate() === d;
        });

        const totalAmount = matches.reduce((sum, a) => sum + a.amount, 0);
        const hasHighSeverity = matches.some(a => a.severity === 'high');

        points.push({
          key: `${y}-${m + 1}-${d}`,
          label: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }),
          shortLabel: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          date: new Date(current),
          count: matches.length,
          totalAmount,
          anomalies: matches,
          hasHighSeverity,
        });

        current.setDate(current.getDate() + 1);
      }

      return points;
    }

    // 2. Monthly breakdown if span > 35 days (Yearly or multi-month range)
    if (diffDays > 35) {
      const points: AnomalyTimelinePoint[] = [];
      const current = new Date(period.start.getFullYear(), period.start.getMonth(), 1);

      while (current.getTime() <= endMs) {
        const y = current.getFullYear();
        const m = current.getMonth();

        const matches = anomalies.filter(a => {
          const ad = a.date;
          return ad.getFullYear() === y && ad.getMonth() === m;
        });

        const totalAmount = matches.reduce((sum, a) => sum + a.amount, 0);
        const hasHighSeverity = matches.some(a => a.severity === 'high');

        points.push({
          key: `${y}-${m + 1}`,
          label: current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          shortLabel: current.toLocaleDateString('en-US', { month: 'short' }),
          date: new Date(current),
          count: matches.length,
          totalAmount,
          anomalies: matches,
          hasHighSeverity,
        });

        current.setMonth(current.getMonth() + 1);
      }

      return points;
    }
  }

  // 3. Fallback: group by distinct dates present in anomalies
  const dateMap = new Map<string, { date: Date; matches: FinancialAnomaly[] }>();
  anomalies.forEach(a => {
    const y = a.date.getFullYear();
    const m = (a.date.getMonth() + 1).toString().padStart(2, '0');
    const d = a.date.getDate().toString().padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    if (!dateMap.has(key)) {
      dateMap.set(key, { date: new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate()), matches: [] });
    }
    dateMap.get(key)!.matches.push(a);
  });

  const sortedKeys = Array.from(dateMap.keys()).sort();
  if (sortedKeys.length === 0) return [];

  return sortedKeys.map(k => {
    const item = dateMap.get(k)!;
    return {
      key: k,
      label: item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }),
      shortLabel: item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      date: item.date,
      count: item.matches.length,
      totalAmount: item.matches.reduce((sum, a) => sum + a.amount, 0),
      anomalies: item.matches,
      hasHighSeverity: item.matches.some(a => a.severity === 'high'),
    };
  });
}

/**
 * Interactive SVG line chart and frequency trend indicator for anomalies over the selected period.
 */
interface AnomalyFrequencyTimelineChartProps {
  timelineData: AnomalyTimelinePoint[];
  isDark: boolean;
  currency: string;
  periodLabel?: string;
  totalCount: number;
  onViewInLedger: (query: string) => void;
}

const AnomalyFrequencyTimelineChart: React.FC<AnomalyFrequencyTimelineChartProps> = ({
  timelineData,
  isDark,
  currency,
  periodLabel,
  totalCount,
  onViewInLedger,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const peakPoint = useMemo<AnomalyTimelinePoint | null>(() => {
    let max = 0;
    let peak: AnomalyTimelinePoint | null = null;
    timelineData.forEach(p => {
      if (p.count > max) {
        max = p.count;
        peak = p;
      }
    });
    return peak;
  }, [timelineData]);

  const activeDaysCount = useMemo(() => {
    return timelineData.filter(p => p.count > 0).length;
  }, [timelineData]);

  // SVG chart dimensions
  const width = 680;
  const height = 135;
  const padding = { top: 18, bottom: 26, left: 36, right: 18 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxCount = useMemo(() => {
    const maxVal = Math.max(0, ...timelineData.map(p => p.count));
    return Math.max(2, maxVal);
  }, [timelineData]);

  const getX = (index: number) => {
    if (timelineData.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (timelineData.length - 1)) * chartWidth;
  };

  const getY = (count: number) => {
    return padding.top + chartHeight - (count / maxCount) * chartHeight;
  };

  // Build line path and area path
  const linePath = useMemo(() => {
    if (timelineData.length === 0) return '';
    return timelineData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.count).toFixed(1)}`).join(' ');
  }, [timelineData, maxCount]);

  const areaPath = useMemo(() => {
    if (timelineData.length === 0) return '';
    const firstX = getX(0).toFixed(1);
    const lastX = getX(timelineData.length - 1).toFixed(1);
    const bottomY = (padding.top + chartHeight).toFixed(1);

    const body = timelineData.map((p, i) => `L ${getX(i).toFixed(1)} ${getY(p.count).toFixed(1)}`).join(' ');
    return `M ${firstX} ${bottomY} ${body} L ${lastX} ${bottomY} Z`;
  }, [timelineData, maxCount]);

  // Select evenly spaced x-axis tick indices
  const tickIndices = useMemo(() => {
    const len = timelineData.length;
    if (len <= 6) return timelineData.map((_, i) => i);
    const step = (len - 1) / 5;
    return [0, Math.round(step), Math.round(step * 2), Math.round(step * 3), Math.round(step * 4), len - 1];
  }, [timelineData]);

  const activePoint = hoveredIdx !== null ? timelineData[hoveredIdx] : null;

  return (
    <div className="space-y-3">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Anomaly Frequency Timeline
              </h4>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {periodLabel || 'Active Period'}
              </span>
            </div>
            <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Daily anomaly frequency trend across the active timeframe
            </p>
          </div>
        </div>

        {/* Intelligence stats strip */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className={`px-2.5 py-1 rounded-lg border font-mono font-semibold text-[11px] ${
            isDark ? 'bg-zinc-950/60 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <span>Pace: </span>
            <span className="text-indigo-500 font-bold">
              {(totalCount / Math.max(1, timelineData.length)).toFixed(2)}/day
            </span>
          </div>

          {peakPoint && peakPoint.count > 0 && (
            <div className={`px-2.5 py-1 rounded-lg border font-mono font-semibold text-[11px] ${
              isDark ? 'bg-rose-950/40 border-rose-800/60 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <span>Peak: </span>
              <span className="font-bold">{peakPoint.shortLabel}</span>
              <span className="opacity-75 ml-1">({peakPoint.count}x)</span>
            </div>
          )}

          <div className={`px-2.5 py-1 rounded-lg border font-mono font-semibold text-[11px] ${
            isDark ? 'bg-zinc-950/60 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span>{activeDaysCount}</span>
            <span className="opacity-75">/{timelineData.length} active days</span>
          </div>
        </div>
      </div>

      {/* SVG Line Chart Canvas */}
      <div className={`p-3 rounded-xl border relative overflow-hidden ${
        isDark ? 'bg-zinc-950/50 border-zinc-800/90' : 'bg-slate-50/80 border-slate-200'
      }`}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-28 sm:h-32 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="anomalyFreqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.32" />
              <stop offset="60%" stopColor="#f43f5e" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={width - padding.right}
            y2={padding.top}
            strokeDasharray="2 3"
            className="stroke-slate-200 dark:stroke-zinc-800"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top + chartHeight / 2}
            x2={width - padding.right}
            y2={padding.top + chartHeight / 2}
            strokeDasharray="2 3"
            className="stroke-slate-200 dark:stroke-zinc-800"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            className="stroke-slate-300 dark:stroke-zinc-700"
            strokeWidth="1.2"
          />

          {/* Y-axis tick labels */}
          <text
            x={padding.left - 8}
            y={padding.top + 4}
            textAnchor="end"
            className="text-[9.5px] font-mono font-semibold fill-slate-400 dark:fill-zinc-500"
          >
            {maxCount}
          </text>
          <text
            x={padding.left - 8}
            y={padding.top + chartHeight / 2 + 3}
            textAnchor="end"
            className="text-[9.5px] font-mono font-semibold fill-slate-400 dark:fill-zinc-500"
          >
            {Math.round(maxCount / 2)}
          </text>
          <text
            x={padding.left - 8}
            y={padding.top + chartHeight}
            textAnchor="end"
            className="text-[9.5px] font-mono font-semibold fill-slate-400 dark:fill-zinc-500"
          >
            0
          </text>

          {/* Filled Area Gradient */}
          {areaPath && (
            <path d={areaPath} fill="url(#anomalyFreqGrad)" />
          )}

          {/* Main Trend Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover guideline */}
          {activePoint && hoveredIdx !== null && (
            <line
              x1={getX(hoveredIdx)}
              y1={padding.top}
              x2={getX(hoveredIdx)}
              y2={padding.top + chartHeight}
              strokeDasharray="3 3"
              className="stroke-indigo-400/90 dark:stroke-indigo-400"
              strokeWidth="1.5"
            />
          )}

          {/* Data Points */}
          {timelineData.map((p, i) => {
            const cx = getX(i);
            const cy = getY(p.count);
            const isHovered = hoveredIdx === i;
            const isPeak = peakPoint?.key === p.key && p.count > 0;

            return (
              <g key={p.key}>
                {/* Peak pulse glow ring */}
                {isPeak && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={8}
                    className="fill-rose-500/25 animate-ping"
                  />
                )}

                {/* Visible node for non-zero points or hovered point */}
                {(p.count > 0 || isHovered) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 5.5 : p.hasHighSeverity ? 4.5 : 3.5}
                    className={`transition-all duration-150 ${
                      p.hasHighSeverity
                        ? 'fill-rose-500 stroke-rose-200 dark:stroke-rose-950 stroke-2'
                        : isHovered
                        ? 'fill-indigo-500 stroke-white dark:stroke-zinc-900 stroke-2'
                        : 'fill-rose-500 stroke-white dark:stroke-zinc-900 stroke-1.5'
                    }`}
                  />
                )}

                {/* Invisible hover capture rect spanning the column */}
                <rect
                  x={Math.max(padding.left, cx - chartWidth / (timelineData.length * 2))}
                  y={padding.top}
                  width={chartWidth / timelineData.length}
                  height={chartHeight + 10}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onTouchStart={() => setHoveredIdx(i)}
                />
              </g>
            );
          })}

          {/* X-axis tick labels */}
          {tickIndices.map(idx => {
            const p = timelineData[idx];
            if (!p) return null;
            return (
              <text
                key={p.key}
                x={getX(idx)}
                y={padding.top + chartHeight + 18}
                textAnchor="middle"
                className="text-[9.5px] font-mono fill-slate-500 dark:fill-zinc-400 font-medium"
              >
                {p.shortLabel}
              </text>
            );
          })}
        </svg>

        {/* Hover / Detail Status Bar */}
        <div className={`mt-2 pt-2 border-t border-inherit flex flex-wrap items-center justify-between gap-2 text-xs transition-all ${
          activePoint ? 'opacity-100' : 'opacity-85'
        }`}>
          {activePoint ? (
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 dark:text-zinc-100 font-mono">
                  📅 {activePoint.label}:
                </span>
                <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                  activePoint.count > 0
                    ? isDark ? 'bg-rose-950/80 text-rose-300' : 'bg-rose-100 text-rose-800'
                    : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-700'
                }`}>
                  {activePoint.count} {activePoint.count === 1 ? 'anomaly' : 'anomalies'} flagged
                  {activePoint.count > 0 && ` (${formatCurrency(activePoint.totalAmount, currency)})`}
                </span>
                {activePoint.anomalies.length > 0 && (
                  <span className={`text-[11px] truncate max-w-sm hidden sm:inline ${
                    isDark ? 'text-zinc-400' : 'text-slate-600'
                  }`}>
                    {activePoint.anomalies.map(a => `${a.category} (${formatCurrency(a.amount, currency)})`).join(' · ')}
                  </span>
                )}
              </div>

              {activePoint.anomalies.length > 0 && (
                <button
                  type="button"
                  onClick={() => onViewInLedger(activePoint.anomalies[0].category)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium shrink-0 hover:underline"
                >
                  Inspect in Ledger →
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 w-full text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
              <span>Hover over timeline points to inspect anomaly occurrences by date</span>
              <span>{timelineData.length} timeline buckets ({periodLabel || 'Period'})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export interface CategoryAnomalyStat {
  category: string;
  count: number;
  totalAmount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  avgMultiplier: number;
  percentage: number;
}

interface CustomCategoryTooltipProps {
  active?: boolean;
  payload?: any[];
  isDark: boolean;
  currency: string;
}

const CustomCategoryTooltip: React.FC<CustomCategoryTooltipProps> = ({
  active,
  payload,
  isDark,
  currency,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const data: CategoryAnomalyStat = payload[0].payload;

  return (
    <div
      className={`p-2.5 rounded-xl border shadow-xl text-xs font-mono pointer-events-none z-50 min-w-[210px] ${
        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-inherit pb-1.5 mb-1.5">
        <span className="font-bold text-xs truncate max-w-[130px]">{data.category}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
          isDark ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
        }`}>
          {data.percentage}% of flags
        </span>
      </div>

      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400 dark:text-zinc-500">Anomaly Count:</span>
          <span className="font-bold text-rose-500">{data.count} {data.count === 1 ? 'flag' : 'flags'}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400 dark:text-zinc-500">Outlay Total:</span>
          <span className="font-bold tabular-nums">{formatCurrency(data.totalAmount, currency)}</span>
        </div>
        {data.highSeverityCount > 0 && (
          <div className="flex items-center justify-between gap-2 text-rose-400 font-semibold">
            <span>High Severity:</span>
            <span>{data.highSeverityCount}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400 dark:text-zinc-500">Avg Deviation:</span>
          <span className="font-semibold text-amber-500 tabular-nums">{data.avgMultiplier.toFixed(1)}× median</span>
        </div>
      </div>
      <div className="mt-2 pt-1 border-t border-inherit text-[10px] text-indigo-400 flex items-center justify-between">
        <span>Click bar to filter list</span>
        <span>⇲ Filter</span>
      </div>
    </div>
  );
};

interface AnomalyCategoryBarChartProps {
  anomalies: FinancialAnomaly[];
  isDark: boolean;
  currency: string;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onViewInLedger: (query: string) => void;
}

const AnomalyCategoryBarChart: React.FC<AnomalyCategoryBarChartProps> = ({
  anomalies,
  isDark,
  currency,
  selectedCategory,
  onSelectCategory,
  onViewInLedger,
}) => {
  const categoryStats = useMemo<CategoryAnomalyStat[]>(() => {
    const map = new Map<string, {
      count: number;
      totalAmount: number;
      high: number;
      medium: number;
      low: number;
      totalMultiplier: number;
    }>();

    anomalies.forEach(a => {
      const cat = a.category?.trim() || 'Uncategorized';
      if (!map.has(cat)) {
        map.set(cat, { count: 0, totalAmount: 0, high: 0, medium: 0, low: 0, totalMultiplier: 0 });
      }
      const item = map.get(cat)!;
      item.count += 1;
      item.totalAmount += a.amount;
      item.totalMultiplier += (a.deviationMultiplier || 1);
      if (a.severity === 'high') item.high += 1;
      else if (a.severity === 'medium') item.medium += 1;
      else item.low += 1;
    });

    const total = anomalies.length;

    const list: CategoryAnomalyStat[] = Array.from(map.entries()).map(([cat, val]) => ({
      category: cat,
      count: val.count,
      totalAmount: val.totalAmount,
      highSeverityCount: val.high,
      mediumSeverityCount: val.medium,
      lowSeverityCount: val.low,
      avgMultiplier: val.count > 0 ? val.totalMultiplier / val.count : 1,
      percentage: total > 0 ? Math.round((val.count / total) * 100) : 0,
    }));

    // Sort descending by count, then by totalAmount
    list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.totalAmount - a.totalAmount;
    });

    return list;
  }, [anomalies]);

  const topCategory = categoryStats.length > 0 ? categoryStats[0] : null;

  // Dynamic height based on number of categories
  const chartHeight = useMemo(() => {
    if (categoryStats.length === 0) return 130;
    return Math.min(220, Math.max(130, categoryStats.length * 28 + 36));
  }, [categoryStats.length]);

  return (
    <div className="space-y-3">
      {/* Header and Summary stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Anomalies by Category
              </h4>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {categoryStats.length} {categoryStats.length === 1 ? 'category' : 'categories'}
              </span>
            </div>
            <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Count of detected anomalies grouped by spending category
            </p>
          </div>
        </div>

        {/* Intelligence stats strip */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {topCategory && (
            <div className={`px-2.5 py-1 rounded-lg border font-mono font-semibold text-[11px] ${
              isDark ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}>
              <span>Top: </span>
              <span className="font-bold">{topCategory.category}</span>
              <span className="opacity-75 ml-1">({topCategory.count}x)</span>
            </div>
          )}

          {selectedCategory && (
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className={`px-2 py-1 rounded-lg border font-mono text-[10px] font-bold flex items-center gap-1 transition-colors ${
                isDark ? 'bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/60' : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
              title="Clear category filter"
            >
              <span>{selectedCategory}</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Canvas Card */}
      <div className={`p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between ${
        isDark ? 'bg-zinc-950/50 border-zinc-800/90' : 'bg-slate-50/80 border-slate-200'
      }`}>
        {categoryStats.length === 0 ? (
          <div className="py-8 text-center space-y-1">
            <p className="text-xs font-semibold text-zinc-400">No categorized anomalies detected</p>
            <p className="text-[11px] text-zinc-500">Lower the threshold filter to inspect more transactions</p>
          </div>
        ) : (
          <div className="w-full relative" style={{ height: `${chartHeight}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={categoryStats}
                margin={{ top: 6, right: 32, left: 4, bottom: 2 }}
              >
                <XAxis
                  type="number"
                  domain={[0, (dataMax: number) => Math.max(dataMax + 1, 2)]}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={{ stroke: isDark ? '#27272a' : '#e2e8f0' }}
                  tick={{
                    fontSize: 9.5,
                    fontFamily: 'monospace',
                    fill: isDark ? '#71717a' : '#94a3b8',
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={110}
                  tickLine={false}
                  axisLine={{ stroke: isDark ? '#27272a' : '#e2e8f0' }}
                  tick={props => {
                    const { x, y, payload } = props;
                    const isSelected = selectedCategory === payload.value;
                    const fullText = String(payload.value || '');
                    const truncated = fullText.length > 14 ? `${fullText.slice(0, 13)}…` : fullText;
                    return (
                      <text
                        x={x}
                        y={y}
                        dy={4}
                        textAnchor="end"
                        fontSize={10.5}
                        fontFamily="monospace"
                        fontWeight={isSelected ? 700 : 500}
                        fill={
                          isSelected
                            ? (isDark ? '#818cf8' : '#4f46e5')
                            : (isDark ? '#d4d4d8' : '#334155')
                        }
                        className="cursor-pointer transition-colors hover:fill-indigo-400"
                        onClick={() => onSelectCategory(isSelected ? null : payload.value)}
                      >
                        <title>{fullText}</title>
                        {truncated}
                      </text>
                    );
                  }}
                />
                <RechartsTooltip
                  content={
                    <CustomCategoryTooltip
                      isDark={isDark}
                      currency={currency}
                    />
                  }
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                  isAnimationActive={true}
                  animationDuration={450}
                  onClick={(entry: any) => {
                    if (entry && entry.category) {
                      onSelectCategory(selectedCategory === entry.category ? null : entry.category);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <LabelList
                    dataKey="count"
                    position="right"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      fill: isDark ? '#e4e4e7' : '#1e293b',
                    }}
                    formatter={(val: any) => `${val}`}
                  />
                  {categoryStats.map(entry => {
                    const isSelected = selectedCategory === entry.category;
                    const isDimmed = selectedCategory !== null && !isSelected;
                    const hasHigh = entry.highSeverityCount > 0;

                    let fill = hasHigh ? '#f43f5e' : '#6366f1';
                    if (isSelected) fill = '#4f46e5';

                    return (
                      <Cell
                        key={`cell-${entry.category}`}
                        fill={fill}
                        opacity={isDimmed ? 0.35 : 1}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Footer / Interaction Hint */}
        <div className="mt-2 pt-2 border-t border-inherit flex items-center justify-between gap-2 text-[10.5px] font-mono text-zinc-500 dark:text-zinc-400">
          <span className="truncate">
            {selectedCategory ? (
              <span className="text-indigo-400 font-medium">
                Active filter: {selectedCategory} (Click bar to clear)
              </span>
            ) : (
              <span>Click any bar or category name to filter list below</span>
            )}
          </span>
          {topCategory && (
            <button
              type="button"
              onClick={() => onViewInLedger(selectedCategory || topCategory.category)}
              className="text-indigo-400 hover:text-indigo-300 font-medium shrink-0 hover:underline inline-flex items-center gap-1"
            >
              <span>Ledger →</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface FinancialAnomaliesViewProps {
  anomalies: FinancialAnomaly[];
  sensitivity: SensitivityLevel;
  onSensitivityChange: (level: SensitivityLevel) => void;
  currency: string;
  isDark: boolean;
  period?: PeriodInfo;
  periodLabel?: string;
  onViewInLedger: (searchQuery: string) => void;
}

export const FinancialAnomaliesView: React.FC<FinancialAnomaliesViewProps> = ({
  anomalies,
  sensitivity,
  onSensitivityChange,
  currency,
  isDark,
  period,
  periodLabel,
  onViewInLedger,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Interchangeable threshold sliders: Monetary value (default: 100, step: 10) vs Multiplier (default: 2, step: 1)
  const [filterMode, setFilterMode] = useState<AnomalyThresholdFilterMode>('monetary');
  const [monetaryFilterValue, setMonetaryFilterValue] = useState<number>(100);
  const [multiplierFilterValue, setMultiplierFilterValue] = useState<number>(2);

  // Category filter selection from the horizontal bar chart
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  // Filter out dismissed anomalies
  const activeAnomalies = useMemo(() => {
    return anomalies.filter(a => !dismissedIds.has(a.id));
  }, [anomalies, dismissedIds]);

  // Dynamic maximum range available in this period/time
  const { maxMonetaryValue, maxMultiplierValue } = useMemo(() => {
    if (activeAnomalies.length === 0) {
      return { maxMonetaryValue: 500, maxMultiplierValue: 5 };
    }
    const maxAmount = Math.max(...activeAnomalies.map(a => a.amount));
    const maxMult = Math.max(...activeAnomalies.map(a => a.deviationMultiplier || 1));

    return {
      maxMonetaryValue: Math.max(100, Math.ceil(maxAmount / 10) * 10),
      maxMultiplierValue: Math.max(2, Math.ceil(maxMult)),
    };
  }, [activeAnomalies]);

  // Handle switching between monetary and multiplier filter
  const handleSwitchFilterMode = (mode: AnomalyThresholdFilterMode) => {
    setFilterMode(mode);
    if (mode === 'multiplier') {
      // When changing to the multiply filter, use 2 times as the default value
      setMultiplierFilterValue(2);
    } else {
      // Make the value the default filter, with 100 as the default value with 10 resolution
      setMonetaryFilterValue(100);
    }
  };

  // Base threshold & severity/type filtering (before category selection)
  const baseFilteredAnomalies = useMemo(() => {
    return activeAnomalies.filter(a => {
      if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
      if (filterType !== 'all' && a.type !== filterType) return false;

      // Filter by active slider threshold
      if (filterMode === 'monetary') {
        if (a.amount < monetaryFilterValue) return false;
      } else {
        if (a.deviationMultiplier < multiplierFilterValue) return false;
      }

      return true;
    });
  }, [activeAnomalies, filterSeverity, filterType, filterMode, monetaryFilterValue, multiplierFilterValue]);

  // Secondary filtering - including category filter when selected from horizontal bar chart
  const filteredAnomalies = useMemo(() => {
    if (!selectedCategoryFilter) return baseFilteredAnomalies;
    return baseFilteredAnomalies.filter(
      a => (a.category?.trim() || 'Uncategorized') === selectedCategoryFilter
    );
  }, [baseFilteredAnomalies, selectedCategoryFilter]);

  // Chronological anomaly frequency timeline points for the active period
  const timelineData = useMemo(() => {
    return generateAnomalyTimeline(filteredAnomalies, period);
  }, [filteredAnomalies, period]);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleResetDismissed = () => {
    setDismissedIds(new Set());
  };

  // Metrics
  const totalVolume = activeAnomalies.reduce((sum, a) => sum + a.amount, 0);
  const highSeverityCount = activeAnomalies.filter(a => a.severity === 'high').length;
  const outlierAmountCount = activeAnomalies.filter(a => a.type === 'outlier_amount').length;
  const duplicateCount = activeAnomalies.filter(a => a.type === 'potential_duplicate').length;

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className={`p-6 rounded-2xl border transition-colors ${
        isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-inherit">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <h2 className="text-xl font-bold tracking-tight">Financial Anomalies & Outlier Intelligence</h2>
              {periodLabel && (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
                  isDark ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                }`}>
                  {periodLabel}
                </span>
              )}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Statistical outlier detection identifying transaction amounts and outlays deviating significantly from historical medians.
            </p>
          </div>

          {/* Sensitivity Setting */}
          <div className="flex items-center gap-2">
            <span className={`text-xs flex items-center gap-1 ${isDark ? 'text-zinc-400' : 'text-slate-700 font-semibold'}`}>
              <Sliders className="w-3.5 h-3.5" />
              <span>Sensitivity:</span>
            </span>
            <div className={`inline-flex rounded-lg p-0.5 border ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
            }`}>
              {(['low', 'medium', 'high'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => onSensitivityChange(lvl)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    sensitivity === lvl
                      ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                      : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Anomaly KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div className={`p-4 rounded-xl border ${
            isDark ? 'bg-zinc-950/40 border-zinc-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-xs text-slate-700 dark:text-zinc-300 uppercase tracking-wider font-semibold">Flagged Anomalies</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-rose-500 mt-1">
              {activeAnomalies.length}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
              {highSeverityCount} high severity alerts
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${
            isDark ? 'bg-zinc-950/40 border-zinc-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-xs text-slate-700 dark:text-zinc-300 uppercase tracking-wider font-semibold">Anomaly Outlay Total</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-zinc-100 mt-1">
              {formatCurrency(totalVolume, currency)}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
              Cumulative value of flagged transactions
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${
            isDark ? 'bg-zinc-950/40 border-zinc-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-xs text-slate-700 dark:text-zinc-300 uppercase tracking-wider font-semibold">Amount Outliers</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-500 mt-1">
              {outlierAmountCount}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
              Deviations &gt; {sensitivity === 'low' ? '3.5x' : sensitivity === 'high' ? '1.6x' : '2.2x'} category median
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${
            isDark ? 'bg-zinc-950/40 border-zinc-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-xs text-slate-700 dark:text-zinc-300 uppercase tracking-wider font-semibold">Potential Duplicates</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-indigo-400 mt-1">
              {duplicateCount}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
              Identical charges within 48-hour window
            </p>
          </div>
        </div>

        {/* Visual Intelligence Section: Frequency Line Chart & Category Horizontal Bar Chart */}
        <div className="mt-5 pt-5 border-t border-inherit grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Anomaly Frequency Timeline (Line chart over time) */}
          <AnomalyFrequencyTimelineChart
            timelineData={timelineData}
            isDark={isDark}
            currency={currency}
            periodLabel={periodLabel}
            totalCount={filteredAnomalies.length}
            onViewInLedger={onViewInLedger}
          />

          {/* Anomaly Category Distribution (Small Horizontal Bar Chart) */}
          <AnomalyCategoryBarChart
            anomalies={baseFilteredAnomalies}
            isDark={isDark}
            currency={currency}
            selectedCategory={selectedCategoryFilter}
            onSelectCategory={setSelectedCategoryFilter}
            onViewInLedger={onViewInLedger}
          />
        </div>
      </div>

      {/* Interchangeable Threshold Filter Card */}
      <div className={`p-5 rounded-2xl border transition-colors ${
        isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        {/* Header: Title, Mode Switcher, and Current Active Threshold Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-inherit">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Anomaly Threshold Filter
                </h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border font-mono ${
                  isDark ? 'bg-indigo-950/60 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                }`}>
                  {filterMode === 'monetary'
                    ? `Min Amount: ≥ ${formatCurrency(monetaryFilterValue, currency)}`
                    : `Min Multiplier: ≥ ${multiplierFilterValue}×`}
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                Showing only anomalies higher than the selected {filterMode === 'monetary' ? 'monetary value' : 'multiplier'}
              </p>
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className={`text-xs font-medium hidden md:inline ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Filter by:
            </span>
            <div className={`inline-flex rounded-xl p-1 border ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => handleSwitchFilterMode('monetary')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filterMode === 'monetary'
                    ? isDark ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold'
                    : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Monetary Value</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchFilterMode('multiplier')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filterMode === 'multiplier'
                    ? isDark ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold'
                    : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Multiplier (×)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Slider & Small Custom Value Box */}
        <div className="mt-4 space-y-3">
          {filterMode === 'monetary' ? (
            /* Monetary Value Slider & Custom Value Box */
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className={`font-semibold flex items-center gap-1.5 flex-wrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                  <span>Minimum Transaction Value:</span>
                  <span className="font-mono text-indigo-500 dark:text-indigo-400 font-bold">
                    {formatCurrency(monetaryFilterValue, currency)}
                  </span>
                  <span className="text-[11px] opacity-75 font-normal">
                    (Resolution: 10)
                  </span>
                </span>

                {/* Small Value Box for Custom Value from User */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Custom Value:
                  </span>
                  <div className={`flex items-center rounded-lg border px-2 py-1 shadow-xs transition-colors ${
                    isDark ? 'bg-zinc-950 border-zinc-800 focus-within:border-indigo-500' : 'bg-white border-slate-300 focus-within:border-indigo-500'
                  }`}>
                    <span className={`font-mono text-xs font-bold mr-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      {currency === 'USD' ? '$' : `${currency} `}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={monetaryFilterValue}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setMonetaryFilterValue(isNaN(val) ? 0 : Math.max(0, Math.round(val)));
                      }}
                      className="w-20 bg-transparent text-xs font-mono font-bold text-right outline-none tabular-nums"
                      aria-label="Custom monetary threshold value"
                    />
                  </div>
                  {monetaryFilterValue !== 100 && (
                    <button
                      type="button"
                      onClick={() => setMonetaryFilterValue(100)}
                      className={`text-[11px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                        isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                      }`}
                      title="Reset to default 100"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Default</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Slider Input Row */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono font-semibold opacity-70 shrink-0">
                  $0
                </span>
                <input
                  type="range"
                  min={0}
                  max={maxMonetaryValue}
                  step={10}
                  value={Math.min(monetaryFilterValue, maxMonetaryValue)}
                  onChange={e => setMonetaryFilterValue(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500 bg-slate-200 dark:bg-zinc-800"
                  aria-label="Monetary threshold slider"
                />
                <span className="text-[11px] font-mono font-semibold opacity-70 shrink-0">
                  {formatCurrency(maxMonetaryValue, currency)}
                </span>
              </div>

              {/* Quick Presets & Match Counter */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Presets:
                  </span>
                  {[
                    { label: 'All ($0)', val: 0 },
                    { label: '$50', val: 50 },
                    { label: '$100 (Default)', val: 100 },
                    { label: '$250', val: 250 },
                    { label: '$500', val: 500 },
                  ]
                    .filter(p => p.val <= maxMonetaryValue || p.val === 100)
                    .map(p => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setMonetaryFilterValue(p.val)}
                        className={`px-2 py-0.5 rounded-md font-mono text-[10.5px] transition-colors border ${
                          monetaryFilterValue === p.val
                            ? isDark ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300 font-bold' : 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold'
                            : isDark ? 'border-zinc-800 hover:bg-zinc-800/80 text-zinc-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                </div>
                <div className={`font-mono text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  {filteredAnomalies.length} of {activeAnomalies.length} anomalies match (≥ {formatCurrency(monetaryFilterValue, currency)})
                </div>
              </div>
            </div>
          ) : (
            /* Multiplier Slider & Custom Value Box */
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className={`font-semibold flex items-center gap-1.5 flex-wrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                  <span>Minimum Outlier Multiplier:</span>
                  <span className="font-mono text-indigo-500 dark:text-indigo-400 font-bold">
                    {multiplierFilterValue}×
                  </span>
                  <span className="text-[11px] opacity-75 font-normal">
                    (Resolution: 1, relative to category median)
                  </span>
                </span>

                {/* Small Value Box for Custom Multiplier from User */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Custom Multiplier:
                  </span>
                  <div className={`flex items-center rounded-lg border px-2 py-1 shadow-xs transition-colors ${
                    isDark ? 'bg-zinc-950 border-zinc-800 focus-within:border-indigo-500' : 'bg-white border-slate-300 focus-within:border-indigo-500'
                  }`}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={multiplierFilterValue}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setMultiplierFilterValue(isNaN(val) ? 1 : Math.max(1, Math.round(val)));
                      }}
                      className="w-16 bg-transparent text-xs font-mono font-bold text-right outline-none tabular-nums"
                      aria-label="Custom multiplier threshold value"
                    />
                    <span className={`font-mono text-xs font-bold ml-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      ×
                    </span>
                  </div>
                  {multiplierFilterValue !== 2 && (
                    <button
                      type="button"
                      onClick={() => setMultiplierFilterValue(2)}
                      className={`text-[11px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                        isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                      }`}
                      title="Reset to default 2x"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Default</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Slider Input Row */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono font-semibold opacity-70 shrink-0">
                  1×
                </span>
                <input
                  type="range"
                  min={1}
                  max={maxMultiplierValue}
                  step={1}
                  value={Math.min(multiplierFilterValue, maxMultiplierValue)}
                  onChange={e => setMultiplierFilterValue(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500 bg-slate-200 dark:bg-zinc-800"
                  aria-label="Multiplier threshold slider"
                />
                <span className="text-[11px] font-mono font-semibold opacity-70 shrink-0">
                  {maxMultiplierValue}×
                </span>
              </div>

              {/* Quick Presets & Match Counter */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    Presets:
                  </span>
                  {[
                    { label: '1× (All)', val: 1 },
                    { label: '2× (Default)', val: 2 },
                    { label: '3×', val: 3 },
                    { label: '4×', val: 4 },
                    { label: '5×', val: 5 },
                  ]
                    .filter(p => p.val <= maxMultiplierValue || p.val === 2)
                    .map(p => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setMultiplierFilterValue(p.val)}
                        className={`px-2 py-0.5 rounded-md font-mono text-[10.5px] transition-colors border ${
                          multiplierFilterValue === p.val
                            ? isDark ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300 font-bold' : 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold'
                            : isDark ? 'border-zinc-800 hover:bg-zinc-800/80 text-zinc-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                </div>
                <div className={`font-mono text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  {filteredAnomalies.length} of {activeAnomalies.length} anomalies match (≥ {multiplierFilterValue}×)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Severity & Type filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity selector */}
          <div className={`inline-flex rounded-lg p-0.5 border ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterSeverity === 'all'
                  ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Severities
            </button>
            <button
              onClick={() => setFilterSeverity('high')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterSeverity === 'high'
                  ? isDark ? 'bg-zinc-800 text-rose-400 shadow-xs' : 'bg-white text-rose-600 shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              High Only
            </button>
            <button
              onClick={() => setFilterSeverity('medium')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterSeverity === 'medium'
                  ? isDark ? 'bg-zinc-800 text-amber-400 shadow-xs' : 'bg-white text-amber-600 shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Medium
            </button>
          </div>

          {/* Type selector */}
          <div className={`inline-flex rounded-lg p-0.5 border ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterType === 'all'
                  ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Patterns
            </button>
            <button
              onClick={() => setFilterType('outlier_amount')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterType === 'outlier_amount'
                  ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Amount Spikes
            </button>
            <button
              onClick={() => setFilterType('potential_duplicate')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterType === 'potential_duplicate'
                  ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Duplicates
            </button>
            <button
              onClick={() => setFilterType('balance_drain')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterType === 'balance_drain'
                  ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Liquidity Drains
            </button>
          </div>
        </div>

        {/* Reset Dismissed */}
        {dismissedIds.size > 0 && (
          <button
            onClick={handleResetDismissed}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              isDark ? 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Restore {dismissedIds.size} dismissed
          </button>
        )}
      </div>

      {/* Category Filter Active Banner (When selected from horizontal bar chart) */}
      {selectedCategoryFilter && (
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-indigo-950/40 border-indigo-800/80 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-900'
        }`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              <span>Category Filter:</span>
            </span>
            <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
              isDark ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700' : 'bg-white text-indigo-700 border border-indigo-300 shadow-xs'
            }`}>
              {selectedCategoryFilter}
            </span>
            <span className="text-[11px] opacity-75">
              (Showing {filteredAnomalies.length} of {baseFilteredAnomalies.length} anomalies)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter(null)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              isDark ? 'border-indigo-800 hover:bg-indigo-900/50 text-indigo-300' : 'border-indigo-200 hover:bg-white text-indigo-700'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* Flagged Anomaly Cards List */}
      <div className="space-y-4">
        {filteredAnomalies.map(anomaly => {
          const isHigh = anomaly.severity === 'high';
          const isMedium = anomaly.severity === 'medium';

          const severityBadgeClass = isHigh
            ? isDark ? 'bg-rose-950/60 border-rose-800/80 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
            : isMedium
            ? isDark ? 'bg-amber-950/60 border-amber-800/80 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
            : isDark ? 'bg-indigo-950/60 border-indigo-800/80 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800';

          return (
            <div
              key={anomaly.id}
              className={`p-5 rounded-2xl border transition-all ${
                isDark
                  ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                  : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${severityBadgeClass}`}>
                      {anomaly.severity.toUpperCase()} SEVERITY
                    </span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200">
                      {anomaly.title}
                    </span>
                    <span aria-hidden="true" className="text-slate-500 dark:text-zinc-500">·</span>
                    <span className="text-xs text-slate-600 dark:text-zinc-400 font-mono font-medium">
                      {anomaly.rawDateStr}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    {anomaly.transaction?.description || anomaly.title}
                  </div>

                  <div className={`text-xs flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
                    <span>Account: {anomaly.account}</span>
                    <span aria-hidden="true">·</span>
                    <span>Category: {anomaly.category}</span>
                    {anomaly.transaction?.subcategory && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{anomaly.transaction.subcategory}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount and Ratio */}
                <div className="text-left sm:text-right shrink-0">
                  <div className="text-xl font-bold font-mono tabular-nums text-rose-500">
                    {formatCurrency(anomaly.amount, anomaly.currency)}
                  </div>
                  {anomaly.deviationMultiplier > 0 && (
                    <div className="text-xs font-mono font-semibold text-amber-500">
                      {anomaly.deviationMultiplier.toFixed(1)}x median outlay
                    </div>
                  )}
                </div>
              </div>

              {/* Statistical Benchmark Comparison Meter */}
              {anomaly.expectedAmount > 0 && (
                <div className={`mt-4 p-3 rounded-xl border text-xs space-y-2 ${
                  isDark ? 'bg-zinc-950/50 border-zinc-800/80' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                    <span className={isDark ? 'text-zinc-400' : 'text-slate-700 font-medium'}>
                      Typical {anomaly.category} Median: {formatCurrency(anomaly.expectedAmount, anomaly.currency)}
                    </span>
                    <span className="font-bold text-rose-500">
                      +{anomaly.deviationPercent.toFixed(0)}% deviation
                    </span>
                  </div>

                  {/* Relative Bar */}
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden flex">
                    <div
                      className="h-full bg-indigo-500 rounded-l-full"
                      style={{ width: `${Math.min(100, (1 / anomaly.deviationMultiplier) * 100)}%` }}
                      title="Typical median range"
                    />
                    <div
                      className="h-full bg-rose-500 rounded-r-full"
                      style={{ width: `${Math.min(100, ((anomaly.deviationMultiplier - 1) / anomaly.deviationMultiplier) * 100)}%` }}
                      title="Outlier surplus"
                    />
                  </div>
                </div>
              )}

              {/* Rationalization Reason */}
              <div className="mt-3 flex items-start gap-2 text-xs">
                <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <p className={`leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                  {anomaly.reason}
                </p>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-inherit flex items-center justify-between text-xs">
                <button
                  onClick={() => onViewInLedger(anomaly.transaction?.description || anomaly.category)}
                  className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect in Transaction Ledger</span>
                </button>

                <button
                  onClick={() => handleDismiss(anomaly.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border transition-colors ${
                    isDark
                      ? 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Check className="w-3 h-3" />
                  <span>Mark as Verified</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zero State if no anomalies */}
      {filteredAnomalies.length === 0 && (
        <div className={`p-12 rounded-2xl border text-center space-y-3 ${
          isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-500 mx-auto flex items-center justify-center">
            {activeAnomalies.length > 0 ? <Filter className="w-6 h-6" /> : <CheckCircle className="w-6 h-6 text-emerald-500" />}
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {activeAnomalies.length > 0
              ? 'No Anomalies Exceed Selected Threshold'
              : 'No Financial Anomalies Detected'}
          </h3>
          <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            {activeAnomalies.length > 0
              ? `There are ${activeAnomalies.length} flagged anomalies in this period, but none exceed the current ${
                  filterMode === 'monetary'
                    ? `monetary threshold of ${formatCurrency(monetaryFilterValue, currency)}`
                    : `multiplier threshold of ${multiplierFilterValue}×`
                }.`
              : `All recorded transaction amounts in ${periodLabel || 'this period'} conform within expected statistical parameters for their respective categories.`}
          </p>
          {activeAnomalies.length > 0 && (
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (filterMode === 'monetary') setMonetaryFilterValue(0);
                  else setMultiplierFilterValue(1);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs"
              >
                <span>Lower Threshold to Show All</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (filterMode === 'monetary') setMonetaryFilterValue(100);
                  else setMultiplierFilterValue(2);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default ({filterMode === 'monetary' ? '$100' : '2×'})</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
