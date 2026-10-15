/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUploadZone } from './components/FileUploadZone';
import { TimeframeBar } from './components/TimeframeBar';
import { SummaryCards } from './components/SummaryCards';
import { BudgetVariancePanel } from './components/BudgetVariancePanel';
import { ChartStudio } from './components/ChartStudio';
import { TransactionLedger } from './components/TransactionLedger';
import { FinancialAnomaliesView } from './components/FinancialAnomaliesView';
import { Transaction, TimeframeUnit } from './types/finance';
import { calculateCategoryBudgets, calculateAccountSummaries, formatCurrency } from './utils/analytics';
import { generateSampleDataset, exportTransactionsToCsv, calculateRunningBalancesForAccounts } from './utils/fileParser';
import { getPeriodsForTimeframe, filterTransactionsByPeriod, createCustomPeriod } from './utils/timeframe';
import { detectFinancialAnomalies, SensitivityLevel } from './utils/anomalyDetection';
import { AlertTriangle, ArrowRight, CheckCircle, ShieldAlert, Sliders, X, RotateCcw, Edit3, Search } from 'lucide-react';

export default function App() {
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]);
  const [initialBalances, setInitialBalances] = useState<Record<string, number>>({});
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [tempInitialBalances, setTempInitialBalances] = useState<Record<string, number>>({});
  const [filename, setFilename] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'charts' | 'anomalies' | 'ledger'>('budget');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({});
  const [anomalySensitivity, setAnomalySensitivity] = useState<SensitivityLevel>('medium');
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState<string>('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  // Dynamically calculate ending balance for each transaction of an individual account
  const transactions = useMemo(() => {
    return calculateRunningBalancesForAccounts(rawTransactions, initialBalances);
  }, [rawTransactions, initialBalances]);

  // Global Timeframe State
  const [timeframe, setTimeframe] = useState<TimeframeUnit>('monthly');
  const [periodIndex, setPeriodIndex] = useState<number>(0);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Sync dark class on html root element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Compute available periods for active timeframe
  const periods = useMemo(() => {
    if (timeframe === 'custom') {
      const timestamps = transactions.map(t => t.date.getTime()).filter(t => !isNaN(t));
      const minDate = timestamps.length ? new Date(Math.min(...timestamps)) : undefined;
      const maxDate = timestamps.length ? new Date(Math.max(...timestamps)) : undefined;
      return [createCustomPeriod(customStartDate, customEndDate, minDate, maxDate)];
    }
    return getPeriodsForTimeframe(transactions, timeframe);
  }, [transactions, timeframe, customStartDate, customEndDate]);

  // Ensure safe period index
  const safePeriodIndex = useMemo(() => {
    if (periods.length === 0) return 0;
    if (periodIndex >= periods.length) return Math.max(0, periods.length - 1);
    if (periodIndex < 0) return 0;
    return periodIndex;
  }, [periodIndex, periods.length]);

  const activePeriod = periods[safePeriodIndex] || periods[0];

  // Filter transactions for active period
  const periodTransactions = useMemo(() => {
    if (!activePeriod || transactions.length === 0) return transactions;
    return filterTransactionsByPeriod(transactions, activePeriod);
  }, [transactions, activePeriod]);

  // Check if a transaction matches the global search query across description, notes, or subcategory
  const matchesGlobalSearch = (t: Transaction, query: string): boolean => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const desc = (t.description || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    const subcat = (t.subcategory || '').toLowerCase();

    // Check single phrase in description, notes, or subcategory
    if (desc.includes(q) || notes.includes(q) || subcat.includes(q)) {
      return true;
    }
    // Check all space-separated tokens
    const terms = q.split(/\s+/).filter(Boolean);
    if (terms.length > 1) {
      return terms.every(term => desc.includes(term) || notes.includes(term) || subcat.includes(term));
    }
    return false;
  };

  // Search filtered transactions across all time
  const searchFilteredTransactions = useMemo(() => {
    if (!globalSearchQuery.trim()) return transactions;
    return transactions.filter(t => matchesGlobalSearch(t, globalSearchQuery));
  }, [transactions, globalSearchQuery]);

  // Search filtered transactions within the active timeframe period
  const searchFilteredPeriodTransactions = useMemo(() => {
    if (!globalSearchQuery.trim()) return periodTransactions;
    return periodTransactions.filter(t => matchesGlobalSearch(t, globalSearchQuery));
  }, [periodTransactions, globalSearchQuery]);

  // Handle switching timeframe: default to latest available period
  const handleSelectTimeframe = (unit: TimeframeUnit) => {
    setTimeframe(unit);
    if (unit === 'custom') {
      if (!customStartDate || !customEndDate) {
        const timestamps = transactions.map(t => t.date.getTime()).filter(t => !isNaN(t));
        if (timestamps.length > 0) {
          const pad = (n: number) => n.toString().padStart(2, '0');
          const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const min = new Date(Math.min(...timestamps));
          const max = new Date(Math.max(...timestamps));
          setCustomStartDate(toIso(min));
          setCustomEndDate(toIso(max));
        }
      }
      setPeriodIndex(0);
    } else {
      const newPeriods = getPeriodsForTimeframe(transactions, unit);
      setPeriodIndex(Math.max(0, newPeriods.length - 1));
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setPeriodIndex(0);
  };

  const handleQuickPreset = (preset: '7d' | '30d' | '90d' | 'ytd' | 'all') => {
    if (transactions.length === 0) return;
    const timestamps = transactions.map(t => t.date.getTime()).filter(t => !isNaN(t));
    const maxDate = new Date(Math.max(...timestamps));
    const minDate = new Date(Math.min(...timestamps));

    let start = new Date(maxDate);

    if (preset === '7d') {
      start.setDate(maxDate.getDate() - 7);
    } else if (preset === '30d') {
      start.setDate(maxDate.getDate() - 30);
    } else if (preset === '90d') {
      start.setDate(maxDate.getDate() - 90);
    } else if (preset === 'ytd') {
      start = new Date(maxDate.getFullYear(), 0, 1);
    } else if (preset === 'all') {
      start = minDate;
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    setCustomStartDate(toIso(start));
    setCustomEndDate(toIso(maxDate));
    setPeriodIndex(0);
  };

  // Handle data load from file or sample
  const handleDataLoaded = (
    loadedTx: Transaction[],
    sourceName: string,
    initialBals: Record<string, number> = {}
  ) => {
    setRawTransactions(loadedTx);
    setInitialBalances(initialBals);
    setFilename(sourceName);
    setCustomLimits({}); // Reset any custom overrides on new file
    setActiveTab('budget'); // Primary view focus confirmed by user

    // Initialize custom dates with min and max
    if (loadedTx.length > 0) {
      const timestamps = loadedTx.map(t => t.date.getTime()).filter(t => !isNaN(t));
      const pad = (n: number) => n.toString().padStart(2, '0');
      const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const min = new Date(Math.min(...timestamps));
      const max = new Date(Math.max(...timestamps));
      setCustomStartDate(toIso(min));
      setCustomEndDate(toIso(max));
    }

    // Default to latest month
    const newPeriods = getPeriodsForTimeframe(loadedTx, 'monthly');
    setTimeframe('monthly');
    setPeriodIndex(Math.max(0, newPeriods.length - 1));
  };

  const handleResetUpload = () => {
    setRawTransactions([]);
    setInitialBalances({});
    setFilename('');
    setGlobalSearchQuery('');
  };

  const handleLoadSample = () => {
    const sample = generateSampleDataset();
    handleDataLoaded(sample, 'sample_financial_ledger.xlsx', {
      'Chase Premier Checking': 10000,
      'Marcus High-Yield Savings': 65000,
      'Business Operating': 20000,
      'Amex Platinum Card': 0,
    });
  };

  const handleOpenBalanceModal = () => {
    const current: Record<string, number> = {};
    accountSummaries.forEach(acc => {
      current[acc.name] = initialBalances[acc.name] ?? 0;
    });
    setTempInitialBalances(current);
    setIsBalanceModalOpen(true);
  };

  const handleSaveInitialBalances = () => {
    setInitialBalances(tempInitialBalances);
    setIsBalanceModalOpen(false);
  };

  const handleExportCsv = () => {
    const txToExport = searchFilteredPeriodTransactions;
    if (txToExport.length > 0) {
      const cleanBase = (filename || 'ledger').replace(/\.[^/.]+$/, '');
      const periodTag = activePeriod?.key || 'all';
      const searchTag = globalSearchQuery.trim()
        ? `_search-${encodeURIComponent(globalSearchQuery.trim().slice(0, 16))}`
        : '';
      exportTransactionsToCsv(txToExport, `${cleanBase}_${timeframe}_${periodTag}${searchTag}.csv`);
    }
  };

  const handleUpdateLimit = (category: string, newLimit: number) => {
    setCustomLimits(prev => ({ ...prev, [category]: newLimit }));
  };

  const handleResetLimits = () => {
    setCustomLimits({});
  };

  // Proportionally scaled budgets for active period (respecting global search filter)
  const budgets = useMemo(() => {
    return calculateCategoryBudgets(
      searchFilteredPeriodTransactions,
      customLimits,
      activePeriod?.scaleFactor || 1.0,
      searchFilteredTransactions
    );
  }, [searchFilteredPeriodTransactions, customLimits, activePeriod, searchFilteredTransactions]);

  const accountSummaries = useMemo(() => {
    return calculateAccountSummaries(transactions);
  }, [transactions]);

  // Detected financial anomalies (respecting global search filter)
  const anomalies = useMemo(() => {
    return detectFinancialAnomalies(searchFilteredPeriodTransactions, searchFilteredTransactions, anomalySensitivity);
  }, [searchFilteredPeriodTransactions, searchFilteredTransactions, anomalySensitivity]);

  const handleViewInLedger = (query: string) => {
    setLedgerSearchQuery(query);
    setActiveTab('ledger');
  };

  const primaryCurrency = transactions[0]?.currency || 'USD';
  const overBudgetCategories = budgets.filter(b => b.variance < 0);

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Navigation Bar with Global Search */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDark={isDark}
        setIsDark={setIsDark}
        hasData={transactions.length > 0}
        onResetUpload={handleResetUpload}
        onExportCsv={handleExportCsv}
        onLoadSample={handleLoadSample}
        anomalyCount={anomalies.length}
        searchQuery={globalSearchQuery}
        onSearchChange={setGlobalSearchQuery}
        searchMatchCount={searchFilteredPeriodTransactions.length}
        totalPeriodCount={periodTransactions.length}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Zero State: Clean Drag-and-Drop Ingestion */}
        {transactions.length === 0 ? (
          <FileUploadZone onDataLoaded={handleDataLoaded} isDark={isDark} />
        ) : (
          <div className="space-y-6">
            {/* Global Timeframe Selector & Period Stepper */}
            <TimeframeBar
              timeframe={timeframe}
              onSelectTimeframe={handleSelectTimeframe}
              periods={periods}
              currentPeriodIndex={safePeriodIndex}
              onSelectPeriodIndex={setPeriodIndex}
              periodTxCount={searchFilteredPeriodTransactions.length}
              totalTxCount={searchFilteredTransactions.length}
              isDark={isDark}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomDateChange={handleCustomDateChange}
              onQuickPreset={handleQuickPreset}
              transactions={transactions}
            />

            {/* Global Search Active Banner */}
            {globalSearchQuery.trim() && (
              <div className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs transition-all ${
                isDark
                  ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-200'
                  : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
              }`}>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span>Global search active: </span>
                    <span className="font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                      "{globalSearchQuery}"
                    </span>
                    <span className="opacity-75 ml-1.5 hidden sm:inline">
                      (filtering across all tabs by description, notes, or subcategory)
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                    searchFilteredPeriodTransactions.length > 0
                      ? isDark ? 'bg-emerald-950/80 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                      : isDark ? 'bg-rose-950/80 text-rose-400' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {searchFilteredPeriodTransactions.length} of {periodTransactions.length} in period
                    {searchFilteredPeriodTransactions.length !== searchFilteredTransactions.length && ` (${searchFilteredTransactions.length} total)`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setGlobalSearchQuery('')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    isDark
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-xs'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear filter</span>
                </button>
              </div>
            )}

            {/* Zero results helper when search query has no matches */}
            {globalSearchQuery.trim() && searchFilteredPeriodTransactions.length === 0 && (
              <div className={`p-6 rounded-2xl border text-center ${
                isDark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
              }`}>
                <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2 ${
                  isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600'
                }`}>
                  <Search className="w-5 h-5" />
                </div>
                <h4 className={`font-semibold text-sm ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                  No transactions match "{globalSearchQuery}"
                </h4>
                <p className={`text-xs mt-1 max-w-md mx-auto ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  No records found in {activePeriod?.label} matching your query in description, notes, or subcategory.
                </p>
                <button
                  type="button"
                  onClick={() => setGlobalSearchQuery('')}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Search Filter</span>
                </button>
              </div>
            )}

            {/* KPI Summary Cards (Period-aware & Global search filtered) */}
            <SummaryCards
              transactions={searchFilteredPeriodTransactions}
              accountSummaries={accountSummaries}
              isDark={isDark}
              filename={filename}
            />

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Budget Attention Callout */}
                {overBudgetCategories.length > 0 ? (
                  <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                    isDark ? 'bg-rose-950/30 border-rose-800/60 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold">
                          {overBudgetCategories.length} categories exceeded {timeframe} target limits
                        </div>
                        <div className="text-xs opacity-80">
                          Period deficit: {formatCurrency(
                            overBudgetCategories.reduce((sum, b) => sum + Math.abs(b.variance), 0),
                            primaryCurrency
                          )} ({activePeriod?.label})
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('budget')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-500 shrink-0"
                    >
                      <span>Inspect Variances</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                    isDark ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold">All category budgets on track for {activePeriod?.label}</div>
                        <div className="text-xs opacity-80">Zero overruns recorded in this period.</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('budget')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shrink-0"
                    >
                      <span>View Budget Cockpit</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Anomaly Attention Callout */}
                {anomalies.length > 0 && (
                  <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                    isDark ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold">
                          {anomalies.length} financial {anomalies.length === 1 ? 'anomaly' : 'anomalies'} flagged in {activePeriod?.label}
                        </div>
                        <div className="text-xs opacity-80">
                          Unusual transaction outlays or frequency spikes deviating from category medians.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('anomalies')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-500 shrink-0"
                    >
                      <span>Review Anomalies</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Split Overview: Top Categories & Account Balances */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Account Balances List */}
                  <div className={`p-5 rounded-2xl border ${
                    isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold">Accounts & Balances</h3>
                      <button
                        onClick={handleOpenBalanceModal}
                        className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 font-medium"
                        title="Configure initial starting balances for accounts"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Starting Balances</span>
                      </button>
                    </div>
                    <div className="space-y-3">
                      {accountSummaries.map(acc => (
                        <div
                          key={acc.name}
                          className={`p-3 rounded-xl border flex items-center justify-between ${
                            isDark ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-semibold truncate max-w-[160px]">{acc.name}</div>
                            <div className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                              {acc.transactionCount} transactions
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono font-bold tabular-nums">
                              {formatCurrency(acc.latestBalance, acc.currency)}
                            </div>
                            <div className={`text-[10px] uppercase font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                              {acc.currency}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Spending Categories Preview */}
                  <div className={`lg:col-span-2 p-5 rounded-2xl border ${
                    isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold">Top Budget Variances</h3>
                        <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                          Period: {activePeriod?.label}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('budget')}
                        className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <span>View all categories</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {budgets.slice(0, 4).map(b => (
                        <div
                          key={b.category}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-4 ${
                            isDark ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-semibold truncate">{b.category}</span>
                              <span className={`font-mono tabular-nums font-bold ${
                                b.variance < 0 ? 'text-rose-500' : 'text-emerald-500'
                              }`}>
                                {b.percentUsed.toFixed(0)}% used
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  b.variance < 0 ? 'bg-rose-500' : b.percentUsed >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, b.percentUsed)}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-mono tabular-nums text-xs">
                            <div className="font-bold">{formatCurrency(b.actualSpent, primaryCurrency)}</div>
                            <div className={`text-[10px] font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                              Target: {formatCurrency(b.scaledLimit, primaryCurrency)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Chart Teaser */}
                <div className="pt-2">
                  <ChartStudio
                    transactions={searchFilteredPeriodTransactions}
                    budgets={budgets}
                    accountSummaries={accountSummaries}
                    isDark={isDark}
                    currency={primaryCurrency}
                    periodLabel={activePeriod?.label}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: BUDGET TRACKER (Primary focus requested by user) */}
            {activeTab === 'budget' && (
              <BudgetVariancePanel
                budgets={budgets}
                customLimits={customLimits}
                onUpdateLimit={handleUpdateLimit}
                onResetLimits={handleResetLimits}
                currency={primaryCurrency}
                isDark={isDark}
                periodLabel={activePeriod?.label}
                timeframe={timeframe}
              />
            )}

            {/* TAB 3: CUSTOM CHARTS */}
            {activeTab === 'charts' && (
              <ChartStudio
                transactions={searchFilteredPeriodTransactions}
                budgets={budgets}
                accountSummaries={accountSummaries}
                isDark={isDark}
                currency={primaryCurrency}
                periodLabel={activePeriod?.label}
              />
            )}

            {/* TAB 4: FINANCIAL ANOMALIES */}
            {activeTab === 'anomalies' && (
              <FinancialAnomaliesView
                anomalies={anomalies}
                sensitivity={anomalySensitivity}
                onSensitivityChange={setAnomalySensitivity}
                currency={primaryCurrency}
                isDark={isDark}
                periodLabel={activePeriod?.label}
                onViewInLedger={handleViewInLedger}
              />
            )}

            {/* TAB 5: TRANSACTIONS 10-COL LEDGER */}
            {activeTab === 'ledger' && (
              <TransactionLedger
                transactions={searchFilteredPeriodTransactions}
                isDark={isDark}
                currency={primaryCurrency}
                periodLabel={activePeriod?.label}
                initialSearchQuery={ledgerSearchQuery}
                globalSearchQuery={globalSearchQuery}
                onClearGlobalSearch={() => setGlobalSearchQuery('')}
              />
            )}
          </div>
        )}
      </main>

      {/* Modal for Adjusting Initial Account Balances */}
      {isBalanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-xl ${
            isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold">Configure Initial Account Balances</h3>
              </div>
              <button
                onClick={() => setIsBalanceModalOpen(false)}
                className={`p-1 rounded-lg ${isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs mt-3 mb-4 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Ending balance for each transaction is automatically calculated by accumulating chronological income, expense, and transfer flows starting from these baseline balances.
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {accountSummaries.map(acc => (
                <div key={acc.name} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium truncate max-w-[180px]" title={acc.name}>
                    {acc.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`font-mono text-[11px] font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>{acc.currency}</span>
                    <input
                      type="number"
                      step="any"
                      value={tempInitialBalances[acc.name] ?? 0}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setTempInitialBalances(prev => ({ ...prev, [acc.name]: val }));
                      }}
                      className={`w-32 px-2.5 py-1 text-xs font-mono tabular-nums rounded-lg border outline-none text-right ${
                        isDark
                          ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-indigo-500'
                          : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-xs'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-inherit flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsBalanceModalOpen(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                  isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInitialBalances}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm"
              >
                Apply & Recalculate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
