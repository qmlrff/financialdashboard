import React, { useState } from 'react';
import { Sliders, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Edit3, X, RotateCcw } from 'lucide-react';
import { CategoryBudget } from '../types/finance';
import { formatCurrency } from '../utils/analytics';

interface BudgetVariancePanelProps {
  budgets: CategoryBudget[];
  customLimits: Record<string, number>;
  onUpdateLimit: (category: string, newLimit: number) => void;
  onResetLimits: () => void;
  currency: string;
  isDark: boolean;
  periodLabel?: string;
  timeframe?: string;
}

export const BudgetVariancePanel: React.FC<BudgetVariancePanelProps> = ({
  budgets,
  customLimits,
  onUpdateLimit,
  onResetLimits,
  currency,
  isDark,
  periodLabel,
  timeframe = 'monthly',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [sortOption, setSortOption] = useState<'spent' | 'variance' | 'percent'>('variance');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Editable temporary limits inside modal
  const [tempLimits, setTempLimits] = useState<Record<string, number>>({});

  const handleOpenModal = () => {
    const initial: Record<string, number> = {};
    budgets.forEach(b => {
      initial[b.category] = b.monthlyLimit;
    });
    setTempLimits(initial);
    setIsModalOpen(true);
  };

  const handleSaveModal = () => {
    Object.entries(tempLimits).forEach(([cat, limit]) => {
      onUpdateLimit(cat, limit);
    });
    setIsModalOpen(false);
  };

  const toggleExpand = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Aggregated totals
  const totalBudget = budgets.reduce((sum, b) => sum + (b.scaledLimit || b.monthlyLimit), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.actualSpent, 0);
  const totalVariance = totalBudget - totalSpent;
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const overBudgetCategories = budgets.filter(b => b.variance < 0);
  const warningCategories = budgets.filter(b => b.variance >= 0 && b.percentUsed >= 80);
  const onTrackCategories = budgets.filter(b => b.percentUsed < 80);

  // Sorting
  const sortedBudgets = [...budgets]
    .filter(b => b.category.toLowerCase().includes(categoryFilter.toLowerCase()))
    .sort((a, b) => {
      if (sortOption === 'spent') return b.actualSpent - a.actualSpent;
      if (sortOption === 'percent') return b.percentUsed - a.percentUsed;
      // 'variance': lowest variance (most overspent) first
      return a.variance - b.variance;
    });

  return (
    <div className="space-y-6">
      {/* Executive Budget Overview Banner */}
      <div className={`p-6 rounded-2xl border transition-colors ${
        isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-inherit">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Category Spending Limits & Variance</h2>
              {periodLabel && (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
                  isDark ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                }`}>
                  {periodLabel}
                </span>
              )}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Benchmark actual period outlays against proportionally scaled budget targets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Configure Monthly Limits</span>
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-zinc-100">Aggregate Budget Utilization</span>
              <span className={`text-[11px] font-mono tabular-nums ${
                totalVariance < 0 ? 'text-rose-500 font-semibold' : isDark ? 'text-zinc-400' : 'text-slate-700 font-semibold'
              }`}>
                {overallPercent.toFixed(1)}% used
              </span>
            </div>
            <div className="font-mono tabular-nums text-xs">
              <span className="font-bold text-slate-900 dark:text-zinc-100">{formatCurrency(totalSpent, currency)}</span>
              <span className={`mx-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>/</span>
              <span className={isDark ? 'text-zinc-400' : 'text-slate-700 font-medium'}>{formatCurrency(totalBudget, currency)}</span>
            </div>
          </div>

          <div className={`h-2.5 w-full rounded-full overflow-hidden ${
            isDark ? 'bg-zinc-800' : 'bg-slate-100'
          }`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallPercent > 100
                  ? 'bg-rose-500'
                  : overallPercent >= 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, overallPercent)}%` }}
            />
          </div>

          {/* Status Breakdown Bar */}
          <div className="flex flex-wrap items-center justify-between pt-1 text-xs">
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" />
                {onTrackCategories.length} on track
              </span>
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {warningCategories.length} warning (&gt;80%)
              </span>
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {overBudgetCategories.length} over budget
              </span>
            </div>

            <div className="font-mono tabular-nums text-xs">
              <span className={`font-semibold ${totalVariance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {totalVariance >= 0 ? 'Surplus: ' : 'Net Deficit: '}
                {formatCurrency(Math.abs(totalVariance), currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Sorting Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Filter categories..."
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none transition-colors ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-500 focus:border-indigo-500 shadow-xs'
            }`}
          />
        </div>

        <div className="flex items-center gap-1 text-xs">
          <span className={`mr-1 ${isDark ? 'text-zinc-400' : 'text-slate-700 font-semibold'}`}>Sort by:</span>
          <div className={`inline-flex rounded-lg p-0.5 border ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setSortOption('variance')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                sortOption === 'variance'
                  ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overrun First
            </button>
            <button
              onClick={() => setSortOption('spent')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                sortOption === 'spent'
                  ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Highest Spent
            </button>
            <button
              onClick={() => setSortOption('percent')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                sortOption === 'percent'
                  ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Utilization %
            </button>
          </div>
        </div>
      </div>

      {/* Category Budget Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedBudgets.map(item => {
          const isOverrun = item.variance < 0;
          const isWarning = !isOverrun && item.percentUsed >= 80;
          const isExpanded = !!expandedCategories[item.category];

          const progressColor = isOverrun
            ? 'bg-rose-500'
            : isWarning
            ? 'bg-amber-500'
            : 'bg-emerald-500';

          return (
            <div
              key={item.category}
              className={`p-5 rounded-2xl border transition-all ${
                isDark
                  ? 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700'
                  : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
              }`}
            >
              {/* Category Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                    {item.category}
                  </h3>
                  <div className={`flex items-center gap-1.5 text-xs mt-0.5 ${
                    isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'
                  }`}>
                    <span>{item.transactionCount} transactions</span>
                    {item.subcategories.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{item.subcategories.length} subcategories</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status tag */}
                <div className="text-right">
                  <div className={`text-xs font-mono font-semibold tabular-nums ${
                    isOverrun ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                    {item.percentUsed.toFixed(0)}%
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-700 dark:text-zinc-300 font-semibold">
                    {isOverrun
                      ? `Over by ${formatCurrency(Math.abs(item.variance), currency)}`
                      : `${formatCurrency(item.variance, currency)} left`}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 space-y-1.5">
                <div className={`h-2 w-full rounded-full overflow-hidden ${
                  isDark ? 'bg-zinc-800' : 'bg-slate-100'
                }`}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                    style={{ width: `${Math.min(100, item.percentUsed)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="font-semibold text-slate-900 dark:text-zinc-100">
                    {formatCurrency(item.actualSpent, currency)}
                  </span>
                  <div className={`text-right text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-700 font-medium'}`}>
                    <span>Target: {formatCurrency(item.scaledLimit, currency)}</span>
                    {timeframe !== 'monthly' && (
                      <span className="opacity-75 block text-[10px]">
                        Base: {formatCurrency(item.monthlyLimit, currency)}/mo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Subcategories toggle */}
              {item.subcategories.length > 0 && (
                <div className="mt-4 pt-3 border-t border-inherit">
                  <button
                    onClick={() => toggleExpand(item.category)}
                    className={`w-full flex items-center justify-between text-xs font-semibold py-1 transition-colors ${
                      isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <span>Subcategory Outlays</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1.5 pl-1">
                      {item.subcategories.map(sub => (
                        <div
                          key={sub.name}
                          className={`flex items-center justify-between text-xs py-1 px-2 rounded-md ${
                            isDark ? 'bg-zinc-800/40 text-zinc-300' : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="truncate mr-2">{sub.name || 'General'}</span>
                          <span className="font-mono tabular-nums font-medium shrink-0">
                            {formatCurrency(sub.amount, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sortedBudgets.length === 0 && (
        <div className={`p-8 rounded-2xl text-center border ${
          isDark ? 'bg-zinc-900/40 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          No categories match your search filter.
        </div>
      )}

      {/* Configure Limits Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-xl max-h-[85vh] rounded-2xl border shadow-xl flex flex-col ${
            isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-5 border-b border-inherit flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Configure Monthly Category Budgets</h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Adjust target spending thresholds per category.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onResetLimits();
                    const reset: Record<string, number> = {};
                    budgets.forEach(b => {
                      reset[b.category] = b.monthlyLimit;
                    });
                    setTempLimits(reset);
                  }}
                  className={`inline-flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-md border ${
                    isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Calculated Averages</span>
                </button>
              </div>

              <div className="space-y-3">
                {budgets.map(b => (
                  <div
                    key={b.category}
                    className={`flex items-center justify-between gap-4 p-3 rounded-xl border ${
                      isDark ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{b.category}</div>
                      <div className={`text-[11px] font-mono tabular-nums ${isDark ? 'text-zinc-400' : 'text-slate-600 font-medium'}`}>
                        Actual Spent: {formatCurrency(b.actualSpent, currency)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-mono font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>{currency}</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={tempLimits[b.category] !== undefined ? tempLimits[b.category] : b.monthlyLimit}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setTempLimits(prev => ({ ...prev, [b.category]: val }));
                        }}
                        className={`w-28 px-2.5 py-1 text-xs rounded-lg border font-mono tabular-nums text-right outline-none focus:border-indigo-500 ${
                          isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-inherit flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                  isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-slate-200 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs"
              >
                Save Limits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
