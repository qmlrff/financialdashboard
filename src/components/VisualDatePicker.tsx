import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Transaction } from '../types/finance';

interface VisualDatePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  transactions?: Transaction[];
  isDark: boolean;
  minAllowedDate?: string;
  maxAllowedDate?: string;
  onQuickPreset?: (preset: '7d' | '30d' | '90d' | 'ytd' | 'all') => void;
}

const pad = (n: number) => n.toString().padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const VisualDatePicker: React.FC<VisualDatePickerProps> = ({
  startDate,
  endDate,
  onChange,
  transactions = [],
  isDark,
  minAllowedDate,
  maxAllowedDate,
  onQuickPreset,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [horizontalShift, setHorizontalShift] = useState<number>(0);

  // Parse initial view month from startDate or today
  const initialDate = useMemo(() => {
    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      return new Date(y, m - 1, d || 1);
    }
    return new Date();
  }, [startDate]);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // Internal draft state during selection
  const [selectedStart, setSelectedStart] = useState<string>(startDate);
  const [selectedEnd, setSelectedEnd] = useState<string>(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState<boolean>(false);

  // Automatically adjust horizontal position so popover never overflows viewport left or right
  useEffect(() => {
    if (!isOpen) {
      setHorizontalShift(0);
      return;
    }

    const adjustPosition = () => {
      if (!popoverRef.current) return;
      const rect = popoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const margin = 12;

      let shift = 0;
      // If overflowing right edge of viewport
      if (rect.right > viewportWidth - margin) {
        shift = (viewportWidth - margin) - rect.right;
      }
      // If shifted or natural left edge overflows left edge of viewport
      if (rect.left + shift < margin) {
        shift = margin - rect.left;
      }

      setHorizontalShift(shift);
    };

    const frameId = requestAnimationFrame(adjustPosition);
    window.addEventListener('resize', adjustPosition);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', adjustPosition);
    };
  }, [isOpen]);

  // Keep internal selection synced when prop changes while closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedStart(startDate);
      setSelectedEnd(endDate);
    }
  }, [startDate, endDate, isOpen]);

  // When opening, reset view month to the selected start date
  const handleOpen = () => {
    if (startDate) {
      const [y, m] = startDate.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
    setSelectedStart(startDate);
    setSelectedEnd(endDate);
    setIsSelectingRange(false);
    setHoverDate(null);
    setIsOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsSelectingRange(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsSelectingRange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Set of dates that have transactions to render activity indicators
  const activityDates = useMemo(() => {
    const dates = new Set<string>();
    transactions.forEach(t => {
      if (!isNaN(t.date.getTime())) {
        dates.add(toIso(t.date));
      }
    });
    return dates;
  }, [transactions]);

  // Overall min and max transaction dates for reference
  const { minTxIso, maxTxIso } = useMemo(() => {
    if (transactions.length === 0) return { minTxIso: minAllowedDate, maxTxIso: maxAllowedDate };
    const timestamps = transactions.map(t => t.date.getTime()).filter(t => !isNaN(t));
    if (timestamps.length === 0) return { minTxIso: minAllowedDate, maxTxIso: maxAllowedDate };
    return {
      minTxIso: toIso(new Date(Math.min(...timestamps))),
      maxTxIso: toIso(new Date(Math.max(...timestamps))),
    };
  }, [transactions, minAllowedDate, maxAllowedDate]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleYearChange = (year: number) => {
    setViewYear(year);
  };

  const handleMonthChange = (month: number) => {
    setViewMonth(month);
  };

  // Click on a date cell in calendar
  const handleDateClick = (isoString: string) => {
    if (!isSelectingRange) {
      // First click: sets start date, waiting for second click
      setSelectedStart(isoString);
      setSelectedEnd(isoString);
      setIsSelectingRange(true);
    } else {
      // Second click: completes range
      let finalStart = selectedStart;
      let finalEnd = isoString;

      if (isoString < selectedStart) {
        finalStart = isoString;
        finalEnd = selectedStart;
      }

      setSelectedStart(finalStart);
      setSelectedEnd(finalEnd);
      setIsSelectingRange(false);
      setHoverDate(null);
    }
  };

  const handleDateMouseEnter = (isoString: string) => {
    if (isSelectingRange) {
      setHoverDate(isoString);
    }
  };

  // Quick preset within modal
  const applyPreset = (preset: 'today' | '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'ytd' | 'all') => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'today') {
      start = today;
      end = today;
    } else if (preset === '7d') {
      if (maxTxIso) {
        const [y, m, d] = maxTxIso.split('-').map(Number);
        end = new Date(y, m - 1, d);
      }
      start = new Date(end);
      start.setDate(end.getDate() - 7);
    } else if (preset === '30d') {
      if (maxTxIso) {
        const [y, m, d] = maxTxIso.split('-').map(Number);
        end = new Date(y, m - 1, d);
      }
      start = new Date(end);
      start.setDate(end.getDate() - 30);
    } else if (preset === '90d') {
      if (maxTxIso) {
        const [y, m, d] = maxTxIso.split('-').map(Number);
        end = new Date(y, m - 1, d);
      }
      start = new Date(end);
      start.setDate(end.getDate() - 90);
    } else if (preset === 'this_month') {
      const target = maxTxIso ? new Date(maxTxIso) : today;
      start = new Date(target.getFullYear(), target.getMonth(), 1);
      end = new Date(target.getFullYear(), target.getMonth() + 1, 0);
    } else if (preset === 'last_month') {
      const target = maxTxIso ? new Date(maxTxIso) : today;
      start = new Date(target.getFullYear(), target.getMonth() - 1, 1);
      end = new Date(target.getFullYear(), target.getMonth(), 0);
    } else if (preset === 'ytd') {
      const target = maxTxIso ? new Date(maxTxIso) : today;
      start = new Date(target.getFullYear(), 0, 1);
      end = target;
    } else if (preset === 'all') {
      if (minTxIso && maxTxIso) {
        setSelectedStart(minTxIso);
        setSelectedEnd(maxTxIso);
        const [y, m] = minTxIso.split('-').map(Number);
        setViewYear(y);
        setViewMonth(m - 1);
        setIsSelectingRange(false);
        return;
      }
    }

    const startIso = toIso(start);
    const endIso = toIso(end);
    setSelectedStart(startIso);
    setSelectedEnd(endIso);
    setIsSelectingRange(false);

    // Jump view month to start date
    setViewYear(start.getFullYear());
    setViewMonth(start.getMonth());
  };

  const handleApply = () => {
    onChange(selectedStart, selectedEnd);
    setIsOpen(false);
  };

  const handleResetToAll = () => {
    if (minTxIso && maxTxIso) {
      setSelectedStart(minTxIso);
      setSelectedEnd(maxTxIso);
      onChange(minTxIso, maxTxIso);
      setIsOpen(false);
    } else if (onQuickPreset) {
      onQuickPreset('all');
      setIsOpen(false);
    }
  };

  // Format label for display
  const formatNiceDate = (isoStr: string) => {
    if (!isoStr) return '--';
    const [y, m, d] = isoStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt.getTime())) return isoStr;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Calculate day count
  const dayCount = useMemo(() => {
    if (!selectedStart || !selectedEnd) return 0;
    const [y1, m1, d1] = selectedStart.split('-').map(Number);
    const [y2, m2, d2] = selectedEnd.split('-').map(Number);
    const dt1 = new Date(y1, m1 - 1, d1);
    const dt2 = new Date(y2, m2 - 1, d2);
    const diff = Math.abs(dt2.getTime() - dt1.getTime());
    return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [selectedStart, selectedEnd]);

  // Current effective hover boundary during dragging
  const effectiveEnd = useMemo(() => {
    if (!isSelectingRange || !hoverDate) return selectedEnd;
    return hoverDate;
  }, [isSelectingRange, hoverDate, selectedEnd]);

  const sortedRange = useMemo(() => {
    let s = selectedStart;
    let e = effectiveEnd;
    if (s && e && s > e) {
      return { start: e, end: s };
    }
    return { start: s, end: e };
  }, [selectedStart, effectiveEnd]);

  // Render a single month calendar grid
  const renderMonthCalendar = (year: number, month: number, isRightMonth = false) => {
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const calendarCells: Array<{
      dayNum: number;
      isoString: string;
      isCurrentMonth: boolean;
      hasActivity: boolean;
      isToday: boolean;
    }> = [];

    const todayIso = toIso(new Date());

    // Previous month padding days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      const iso = toIso(prevDate);
      calendarCells.push({
        dayNum: d,
        isoString: iso,
        isCurrentMonth: false,
        hasActivity: activityDates.has(iso),
        isToday: iso === todayIso,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const iso = toIso(curDate);
      calendarCells.push({
        dayNum: d,
        isoString: iso,
        isCurrentMonth: true,
        hasActivity: activityDates.has(iso),
        isToday: iso === todayIso,
      });
    }

    // Trailing padding days to fill 35 or 42 cells (5 or 6 weeks)
    const remaining = (7 - (calendarCells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const iso = toIso(nextDate);
      calendarCells.push({
        dayNum: d,
        isoString: iso,
        isCurrentMonth: false,
        hasActivity: activityDates.has(iso),
        isToday: iso === todayIso,
      });
    }

    return (
      <div className="flex-1 min-w-[270px] select-none">
        {/* Month & Year Header with Navigation */}
        <div className="flex items-center justify-between mb-3 px-1">
          {!isRightMonth ? (
            <button
              onClick={handlePrevMonth}
              title="Previous month"
              className={`p-1.5 rounded-lg border transition-colors ${
                isDark
                  ? 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-7" />
          )}

          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-zinc-100">
            <span>{MONTH_NAMES[month]}</span>
            <span>{year}</span>
          </div>

          {isRightMonth || (!isRightMonth && false) ? (
            <button
              onClick={handleNextMonth}
              title="Next month"
              className={`p-1.5 rounded-lg border transition-colors ${
                isDark
                  ? 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNextMonth}
              title="Next month"
              className={`p-1.5 rounded-lg border transition-colors sm:hidden ${
                isDark
                  ? 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 shadow-2xs'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 mb-1 text-center">
          {WEEKDAY_NAMES.map(day => (
            <span
              key={day}
              className="text-[11px] font-semibold text-slate-700 dark:text-zinc-400 py-1"
            >
              {day}
            </span>
          ))}
        </div>

        {/* Calendar Day Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {calendarCells.map(cell => {
            const isStart = cell.isoString === sortedRange.start;
            const isEnd = cell.isoString === sortedRange.end;
            const isInRange =
              sortedRange.start &&
              sortedRange.end &&
              cell.isoString >= sortedRange.start &&
              cell.isoString <= sortedRange.end;
            const isSingleSelected = isStart && isEnd;

            // Connected range styling
            let rangeClasses = '';
            if (isInRange) {
              if (isSingleSelected) {
                rangeClasses = 'rounded-lg';
              } else if (isStart) {
                rangeClasses = 'rounded-l-lg';
              } else if (isEnd) {
                rangeClasses = 'rounded-r-lg';
              } else {
                rangeClasses = 'rounded-none';
              }
            }

            return (
              <div
                key={cell.isoString}
                className={`relative flex items-center justify-center p-0.5 ${
                  isInRange && !isSingleSelected
                    ? isDark
                      ? 'bg-indigo-950/50'
                      : 'bg-indigo-50'
                    : ''
                } ${rangeClasses}`}
                onMouseEnter={() => handleDateMouseEnter(cell.isoString)}
              >
                <button
                  type="button"
                  onClick={() => handleDateClick(cell.isoString)}
                  className={`w-8 h-8 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all relative ${
                    isStart || isEnd
                      ? 'bg-indigo-600 text-white font-bold shadow-xs scale-105 z-10'
                      : isInRange
                      ? isDark
                        ? 'text-indigo-200 hover:bg-indigo-900/60'
                        : 'text-indigo-800 hover:bg-indigo-100'
                      : cell.isCurrentMonth
                      ? isDark
                        ? 'text-zinc-200 hover:bg-zinc-800'
                        : 'text-slate-800 hover:bg-slate-100 font-semibold'
                      : isDark
                      ? 'text-zinc-600 hover:bg-zinc-800/50'
                      : 'text-slate-400 hover:bg-slate-100'
                  } ${
                    cell.isToday && !isStart && !isEnd
                      ? 'ring-1.5 ring-indigo-400 dark:ring-indigo-500'
                      : ''
                  }`}
                >
                  <span className="leading-none">{cell.dayNum}</span>

                  {/* Financial Activity Indicator Dot */}
                  {cell.hasActivity && (
                    <span
                      title="Transactions recorded on this date"
                      className={`w-1 h-1 rounded-full mt-0.5 ${
                        isStart || isEnd
                          ? 'bg-white'
                          : isInRange
                          ? 'bg-indigo-500 dark:bg-indigo-400'
                          : 'bg-emerald-500'
                      }`}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Next month calculation for dual month view
  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button with Visual Range Summary */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
            isOpen
              ? isDark
                ? 'bg-indigo-950/60 border-indigo-500/80 text-indigo-300 shadow-xs ring-2 ring-indigo-500/20'
                : 'bg-indigo-50/80 border-indigo-400 text-indigo-800 shadow-xs ring-2 ring-indigo-200'
              : isDark
              ? 'bg-zinc-950 border-zinc-800 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900'
              : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-1.5 text-indigo-500">
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-1.5 font-medium tabular-nums">
            <span className="font-semibold text-slate-900 dark:text-zinc-100">
              {formatNiceDate(startDate)}
            </span>
            <ArrowRight className={`w-3 h-3 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`} />
            <span className="font-semibold text-slate-900 dark:text-zinc-100">
              {formatNiceDate(endDate)}
            </span>
          </div>

          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums ${
            isDark ? 'bg-indigo-950 border border-indigo-800/70 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
          }`}>
            {dayCount} {dayCount === 1 ? 'day' : 'days'}
          </span>

          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isDark ? 'text-zinc-400' : 'text-slate-600'
            } ${
              isOpen ? 'rotate-180 text-indigo-500' : ''
            }`}
          />
        </button>

        {/* Helper text informing range picking step */}
        {isOpen && isSelectingRange && (
          <span className="text-[11px] text-amber-500 dark:text-amber-400 animate-pulse font-medium">
            Click end date to complete range
          </span>
        )}
      </div>

      {/* Floating Visual Calendar Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          style={horizontalShift !== 0 ? { transform: `translateX(${horizontalShift}px)` } : undefined}
          className={`absolute z-50 mt-2 left-0 max-w-[calc(100vw-1.5rem)] w-[min(640px,calc(100vw-1.5rem))] p-4 rounded-2xl border shadow-2xl transition-all ${
            isDark
              ? 'bg-zinc-900/98 border-zinc-800 text-zinc-100 shadow-black/60 backdrop-blur-md'
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/60 backdrop-blur-md'
          }`}
        >
          {/* Top Bar: Range Summary & Header Action */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b gap-2 ${
            isDark ? 'border-zinc-800' : 'border-slate-100'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                  Visual Date Range Picker
                </span>
                {activityDates.size > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Ledger activity dots active
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-zinc-300 flex items-center gap-1 mt-0.5">
                <span>{formatNiceDate(sortedRange.start)}</span>
                <span className="text-slate-500 dark:text-zinc-400">➔</span>
                <span>{formatNiceDate(sortedRange.end)}</span>
                <span className="text-slate-600 dark:text-zinc-400 font-normal">
                  ({dayCount} {dayCount === 1 ? 'day' : 'days'})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors ${
                  isDark ? 'hover:bg-zinc-800' : 'hover:bg-slate-100'
                }`}
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons Ribbon */}
          <div className="mb-3.5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-400 shrink-0">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyPreset('7d')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Last 7D
            </button>
            <button
              type="button"
              onClick={() => applyPreset('30d')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Last 30D
            </button>
            <button
              type="button"
              onClick={() => applyPreset('90d')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Last 90D
            </button>
            <button
              type="button"
              onClick={() => applyPreset('this_month')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last_month')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => applyPreset('ytd')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border transition-colors ${
                isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              YTD
            </button>
            <button
              type="button"
              onClick={() => applyPreset('all')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border transition-colors ${
                isDark ? 'border-indigo-800 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50' : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              All Recorded Data
            </button>
          </div>

          {/* Quick Jump Bar: Year and Month direct jump selectors */}
          <div className="mb-3 flex items-center justify-between text-xs px-1">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-400">Jump calendar to:</span>
            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={e => handleMonthChange(Number(e.target.value))}
                className={`text-[11px] px-2 py-1 rounded-md border font-medium outline-none ${
                  isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={e => handleYearChange(Number(e.target.value))}
                className={`text-[11px] px-2 py-1 rounded-md border font-medium outline-none ${
                  isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {Array.from({ length: 15 }, (_, i) => viewYear - 7 + i).map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Calendar Months Display (1 month on small, 2 months side-by-side on sm+) */}
          <div className="flex flex-col sm:flex-row gap-6 p-2 rounded-xl bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80">
            {renderMonthCalendar(viewYear, viewMonth, false)}
            <div className="hidden sm:block">
              {renderMonthCalendar(nextMonthYear, nextMonth, true)}
            </div>
          </div>

          {/* Manual Input Fallback & Footer Actions */}
          <div className={`mt-4 pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            isDark ? 'border-zinc-800' : 'border-slate-100'
          }`}>
            {/* Direct date inputs */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-400">Manual:</span>
              <input
                type="date"
                value={selectedStart}
                onChange={e => {
                  setSelectedStart(e.target.value);
                  setIsSelectingRange(false);
                }}
                className={`px-2 py-1 text-[11px] rounded-md border font-mono outline-none ${
                  isDark
                    ? 'bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-indigo-500'
                    : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'
                }`}
              />
              <span className="text-slate-500 dark:text-zinc-400">➔</span>
              <input
                type="date"
                value={selectedEnd}
                onChange={e => {
                  setSelectedEnd(e.target.value);
                  setIsSelectingRange(false);
                }}
                className={`px-2 py-1 text-[11px] rounded-md border font-mono outline-none ${
                  isDark
                    ? 'bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-indigo-500'
                    : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'
                }`}
              />
            </div>

            {/* Confirmation Buttons */}
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={handleResetToAll}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  isDark
                    ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Reset to Full Range
              </button>

              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Selection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
