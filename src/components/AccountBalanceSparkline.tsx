import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, YAxis } from 'recharts';
import { Transaction, PeriodInfo } from '../types/finance';
import { formatCurrency } from '../utils/analytics';
import { ArrowUpRight, ArrowDownRight, Minus, ExternalLink, X } from 'lucide-react';

export interface AccountBalanceSparklineProps {
  accountName: string;
  currency: string;
  allTransactions: Transaction[];
  initialBalance?: number;
  period?: PeriodInfo;
  isDark: boolean;
  onViewInLedger?: (accountName: string) => void;
  onClose?: () => void;
}

interface SparklineDataPoint {
  index: number;
  dateStr: string;
  fullDate: string;
  balance: number;
  description: string;
  change: number;
  type?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  currency: string;
  isDark: boolean;
}

const CustomSparklineTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  currency,
  isDark,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const data: SparklineDataPoint = payload[0].payload;

  return (
    <div
      className={`p-2 rounded-lg border shadow-lg text-[11px] font-mono pointer-events-none z-50 max-w-[200px] ${
        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-inherit pb-1 mb-1">
        <span className="font-semibold text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
          {data.dateStr}
        </span>
        {data.change !== 0 && (
          <span
            className={`text-[10px] font-bold ${
              data.change > 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {data.change > 0 ? '+' : ''}
            {formatCurrency(data.change, currency)}
          </span>
        )}
      </div>

      <div className="text-xs font-bold tabular-nums">
        {formatCurrency(data.balance, currency)}
      </div>

      {data.description && (
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
          {data.description}
        </div>
      )}
    </div>
  );
};

export const AccountBalanceSparkline: React.FC<AccountBalanceSparklineProps> = ({
  accountName,
  currency,
  allTransactions,
  initialBalance = 0,
  period,
  isDark,
  onViewInLedger,
  onClose,
}) => {
  // Extract chronological balance progression
  const { data, minBal, maxBal, startBal, endBal, netChange, isUp } = useMemo(() => {
    const accTx = allTransactions
      .filter(t => (t.account || 'Default Account') === accountName)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const points: SparklineDataPoint[] = [];

    if (period && period.unit !== 'all') {
      const startMs = period.start.getTime();
      const endMs = period.end.getTime();

      // Find opening balance before period start
      const txBeforePeriod = accTx.filter(t => t.date.getTime() < startMs);
      const openingBalance =
        txBeforePeriod.length > 0
          ? txBeforePeriod[txBeforePeriod.length - 1].accountBalance
          : initialBalance;

      // Opening baseline point
      points.push({
        index: 0,
        dateStr: period.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: period.start.toLocaleDateString('en-US'),
        balance: openingBalance,
        description: 'Opening Balance',
        change: 0,
      });

      // Transactions within the period
      const periodTx = accTx.filter(t => t.date.getTime() >= startMs && t.date.getTime() <= endMs);

      periodTx.forEach((t, i) => {
        const changeAmount = t.type === 'Income' ? t.amount : t.type === 'Expense' ? -t.amount : 0;
        points.push({
          index: i + 1,
          dateStr: t.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: t.rawDateStr || t.date.toLocaleString(),
          balance: t.accountBalance,
          description: t.description || t.category,
          change: changeAmount,
          type: t.type,
        });
      });

      // If no transactions in period, add ending point at opening balance to show flat trajectory
      if (periodTx.length === 0) {
        points.push({
          index: 1,
          dateStr: period.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: period.end.toLocaleDateString('en-US'),
          balance: openingBalance,
          description: 'Closing Balance (Steady)',
          change: 0,
        });
      }
    } else {
      // All-time span
      points.push({
        index: 0,
        dateStr: 'Start',
        fullDate: 'Initial Starting Balance',
        balance: initialBalance,
        description: 'Initial Starting Balance',
        change: 0,
      });

      accTx.forEach((t, i) => {
        const changeAmount = t.type === 'Income' ? t.amount : t.type === 'Expense' ? -t.amount : 0;
        points.push({
          index: i + 1,
          dateStr: t.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: t.rawDateStr || t.date.toLocaleString(),
          balance: t.accountBalance,
          description: t.description || t.category,
          change: changeAmount,
          type: t.type,
        });
      });
    }

    const balances = points.map(p => p.balance);
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const start = points[0]?.balance ?? 0;
    const end = points[points.length - 1]?.balance ?? 0;
    const diff = end - start;

    return {
      data: points,
      minBal: min,
      maxBal: max,
      startBal: start,
      endBal: end,
      netChange: diff,
      isUp: diff >= 0,
    };
  }, [allTransactions, accountName, initialBalance, period]);

  // Color selection
  const strokeColor = isUp ? '#10b981' : '#f43f5e';
  const gradId = `sparkGrad-${accountName.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // Y domain padding
  const range = maxBal - minBal;
  const padding = range === 0 ? Math.max(10, Math.abs(maxBal) * 0.1) : range * 0.1;
  const yDomain = [minBal - padding, maxBal + padding];

  return (
    <div className="pt-2 border-t border-inherit space-y-2 select-none">
      {/* Sparkline Header / Status bar */}
      <div className="flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-1 font-semibold">
          <span className="text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Trend:
          </span>
          <span
            className={`inline-flex items-center gap-0.5 ${
              isUp ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {isUp ? (
              <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
            ) : (
              <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
            )}
            <span>
              {isUp ? '+' : ''}
              {formatCurrency(netChange, currency)}
            </span>
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onClose();
            }}
            className="p-0.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Collapse sparkline"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Recharts Responsive Sparkline Chart */}
      <div className="w-full h-16 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
                <stop offset="90%" stopColor={strokeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis domain={yDomain} hide />
            <Tooltip
              content={<CustomSparklineTooltip currency={currency} isDark={isDark} />}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              isAnimationActive={true}
              animationDuration={400}
              dot={
                data.length <= 12
                  ? { r: 2, fill: strokeColor, strokeWidth: 0 }
                  : false
              }
              activeDot={{
                r: 4,
                strokeWidth: 1.5,
                stroke: isDark ? '#18181b' : '#ffffff',
                fill: strokeColor,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Min / Max / Count Range Strip */}
      <div className="flex items-center justify-between text-[9.5px] font-mono text-zinc-400 dark:text-zinc-500 pt-1 border-t border-inherit">
        <span>Low: {formatCurrency(minBal, currency)}</span>
        <span>High: {formatCurrency(maxBal, currency)}</span>
        {onViewInLedger && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onViewInLedger(accountName);
            }}
            className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-0.5"
            title="Inspect all transactions for this account in the ledger"
          >
            <span>Ledger</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
};
