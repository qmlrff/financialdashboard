import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, CalendarDays, ArrowRight } from 'lucide-react';
import { TimeframeUnit, PeriodInfo, Transaction } from '../types/finance';
import { VisualDatePicker } from './VisualDatePicker';

interface TimeframeBarProps {
  timeframe: TimeframeUnit;
  onSelectTimeframe: (unit: TimeframeUnit) => void;
  periods: PeriodInfo[];
  currentPeriodIndex: number;
  onSelectPeriodIndex: (index: number) => void;
  periodTxCount: number;
  totalTxCount: number;
  isDark: boolean;
  customStartDate: string;
  customEndDate: string;
  onCustomDateChange: (start: string, end: string) => void;
  onQuickPreset: (preset: '7d' | '30d' | '90d' | 'ytd' | 'all') => void;
  transactions?: Transaction[];
}

export const TimeframeBar: React.FC<TimeframeBarProps> = ({
  timeframe,
  onSelectTimeframe,
  periods,
  currentPeriodIndex,
  onSelectPeriodIndex,
  periodTxCount,
  totalTxCount,
  isDark,
  customStartDate,
  customEndDate,
  onCustomDateChange,
  onQuickPreset,
  transactions,
}) => {
  const currentPeriod = periods[currentPeriodIndex] || periods[0];
  const hasPrev = currentPeriodIndex > 0;
  const hasNext = currentPeriodIndex < periods.length - 1;

  const timeframeOptions: Array<{ id: TimeframeUnit; label: string }> = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
    { id: 'custom', label: 'Custom' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className={`p-3.5 sm:p-4 rounded-2xl border transition-colors space-y-3 ${
      isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
    }`}>
      {/* Primary Bar Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Timeframe Granularity Segmented Control */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs mr-1 hidden sm:flex">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-slate-700 dark:text-zinc-400">Timeframe:</span>
          </div>

          <div className={`inline-flex rounded-xl p-1 border flex-wrap ${
            isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
          }`}>
            {timeframeOptions.map(opt => {
              const isActive = timeframe === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onSelectTimeframe(opt.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    isActive
                      ? isDark
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-indigo-600 shadow-xs'
                      : isDark
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Period Stepper & Dropdown Navigator (when not in custom mode) */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5">
          {timeframe !== 'all' && timeframe !== 'custom' && periods.length > 0 ? (
            <div className="flex items-center gap-1.5">
              {/* Stepper controls */}
              <button
                onClick={() => onSelectPeriodIndex(currentPeriodIndex - 1)}
                disabled={!hasPrev}
                title="Previous period"
                className={`p-1.5 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark
                    ? 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Period Dropdown Selector */}
              <div className="relative">
                <select
                  value={currentPeriodIndex}
                  onChange={e => onSelectPeriodIndex(Number(e.target.value))}
                  className={`text-xs px-3 py-1.5 rounded-lg border outline-none font-semibold cursor-pointer max-w-[200px] sm:max-w-[260px] truncate ${
                    isDark
                      ? 'bg-zinc-950 border-zinc-800 text-zinc-100 hover:border-zinc-700'
                      : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {periods.map((p, idx) => (
                    <option key={p.key} value={idx}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => onSelectPeriodIndex(currentPeriodIndex + 1)}
                disabled={!hasNext}
                title="Next period"
                className={`p-1.5 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark
                    ? 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : timeframe === 'all' ? (
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
              isDark ? 'bg-zinc-950/60 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-medium truncate max-w-xs">{currentPeriod?.label || 'All Historical Records'}</span>
            </div>
          ) : null}

          {/* Period Transaction Count Badge */}
          <div className={`text-xs font-mono tabular-nums px-2.5 py-1 rounded-md border ${
            isDark ? 'bg-zinc-950/40 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-700 font-medium'
          }`}>
            <span>{periodTxCount}</span>
            <span className={isDark ? 'text-zinc-500' : 'text-slate-500'}> / {totalTxCount} txns</span>
          </div>
        </div>
      </div>

      {/* Secondary Bar Row: Custom Date Range with Visual Calendar Picker & Presets */}
      {timeframe === 'custom' && (
        <div className={`pt-3 border-t flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
          isDark ? 'border-zinc-800' : 'border-slate-200'
        }`}>
          {/* Visual Date Range Picker Component */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 shrink-0">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
              <span>Select Date Range:</span>
            </span>

            <VisualDatePicker
              startDate={customStartDate}
              endDate={customEndDate}
              onChange={onCustomDateChange}
              transactions={transactions}
              isDark={isDark}
              onQuickPreset={onQuickPreset}
            />

            <span className="text-slate-600 dark:text-zinc-400 text-[11px] hidden lg:inline">
              Click to open interactive dual-month calendar
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-700 dark:text-zinc-400 text-[11px] font-semibold">Quick:</span>
            <button
              onClick={() => onQuickPreset('7d')}
              className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Last 7D
            </button>
            <button
              onClick={() => onQuickPreset('30d')}
              className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Last 30D
            </button>
            <button
              onClick={() => onQuickPreset('90d')}
              className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Last 90D
            </button>
            <button
              onClick={() => onQuickPreset('ytd')}
              className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              YTD
            </button>
            <button
              onClick={() => onQuickPreset('all')}
              className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Full Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
