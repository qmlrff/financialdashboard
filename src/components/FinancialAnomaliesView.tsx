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
} from 'lucide-react';
import { FinancialAnomaly, AnomalySeverity, AnomalyType } from '../types/finance';
import { SensitivityLevel } from '../utils/anomalyDetection';
import { formatCurrency } from '../utils/analytics';

interface FinancialAnomaliesViewProps {
  anomalies: FinancialAnomaly[];
  sensitivity: SensitivityLevel;
  onSensitivityChange: (level: SensitivityLevel) => void;
  currency: string;
  isDark: boolean;
  periodLabel?: string;
  onViewInLedger: (searchQuery: string) => void;
}

export const FinancialAnomaliesView: React.FC<FinancialAnomaliesViewProps> = ({
  anomalies,
  sensitivity,
  onSensitivityChange,
  currency,
  isDark,
  periodLabel,
  onViewInLedger,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filter out dismissed anomalies
  const activeAnomalies = useMemo(() => {
    return anomalies.filter(a => !dismissedIds.has(a.id));
  }, [anomalies, dismissedIds]);

  // Secondary filtering
  const filteredAnomalies = useMemo(() => {
    return activeAnomalies.filter(a => {
      if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
      if (filterType !== 'all' && a.type !== filterType) return false;
      return true;
    });
  }, [activeAnomalies, filterSeverity, filterType]);

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
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            No Financial Anomalies Detected
          </h3>
          <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            All recorded transaction amounts in {periodLabel || 'this period'} conform within expected statistical parameters for their respective categories.
          </p>
        </div>
      )}
    </div>
  );
};
