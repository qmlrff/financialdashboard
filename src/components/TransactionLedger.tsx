import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowRight,
  ArrowRightLeft,
  X,
  Table as TableIcon,
  LayoutList,
  Copy,
  Check,
  FileText,
  Calendar,
  Wallet,
  Tag,
  Info,
} from 'lucide-react';
import { Transaction, TransactionType } from '../types/finance';
import { formatCurrency, isBalanceAdjustment } from '../utils/analytics';
import { exportTransactionsToCsv } from '../utils/fileParser';

interface TransactionLedgerProps {
  transactions: Transaction[];
  isDark: boolean;
  currency: string;
  periodLabel?: string;
  initialSearchQuery?: string;
  globalSearchQuery?: string;
  onClearGlobalSearch?: () => void;
}

type SortField = 'date' | 'account' | 'category' | 'type' | 'amount' | 'accountBalance';

export function formatDateTimeParts(date: Date, rawStr?: string): { datePart: string; timePart: string } {
  const raw = (rawStr || '').trim();

  // Pattern 1: e.g. "14/10/2026 09:14:32" or "2026-10-14 09:14"
  if (raw.includes(' ')) {
    const parts = raw.split(/\s+/);
    if (parts.length >= 2) {
      return { datePart: parts[0], timePart: parts.slice(1).join(' ') };
    }
  }

  // Pattern 2: ISO string e.g. "2026-10-14T09:14:32"
  if (raw.includes('T')) {
    const parts = raw.split('T');
    if (parts.length === 2) {
      return { datePart: parts[0], timePart: parts[1].replace(/Z|([+-]\d{2}:\d{2})$/, '') };
    }
  }

  // Pattern 3: Extract from Date object
  if (date instanceof Date && !isNaN(date.getTime())) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
    return {
      datePart: raw || `${day}/${month}/${year}`,
      timePart: hasTime ? `${hours}:${minutes}:${seconds}` : '',
    };
  }

  return { datePart: raw || '—', timePart: '' };
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  transactions,
  isDark,
  currency,
  periodLabel,
  initialSearchQuery = '',
  globalSearchQuery = '',
  onClearGlobalSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);

  React.useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedType, setSelectedType] = useState<'All' | TransactionType>('All');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(15);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleRowExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandedIds.size === paginatedTransactions.length && paginatedTransactions.length > 0) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(paginatedTransactions.map(t => t.id)));
    }
  };

  const copyTransactionDetails = (tx: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    const summary = [
      `Transaction ID: ${tx.id}`,
      `Date: ${tx.rawDateStr}`,
      `Account: ${tx.account}`,
      tx.fromAccount && tx.toAccount ? `Transfer: ${tx.fromAccount} ➔ ${tx.toAccount}` : '',
      `Category: ${tx.category}`,
      tx.subcategory ? `Subcategory: ${tx.subcategory}` : '',
      `Type: ${tx.type}`,
      `Amount: ${tx.amount} ${tx.currency}`,
      `Ending Balance: ${tx.accountBalance} ${tx.currency}`,
      `Description: ${tx.description}`,
      tx.notes ? `Notes: ${tx.notes}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(summary);
    setCopiedId(tx.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const renderExpandedDetails = (tx: Transaction) => {
    const isTransfer = tx.type === 'Transfer';
    const isTransferIn = isTransfer && tx.transferDirection === 'inflow';
    const isTransferOut = isTransfer && tx.transferDirection === 'outflow';
    const isIncome = tx.type === 'Income';
    const isExpense = tx.type === 'Expense';

    return (
      <div
        onClick={e => e.stopPropagation()}
        className={`rounded-xl border p-4 sm:p-5 select-text text-left transition-all ${
          isDark
            ? 'bg-zinc-950/80 border-zinc-800 text-zinc-100 shadow-lg'
            : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}
      >
        {/* Top Header: Badge + Full Unclipped Description + Amount */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-inherit">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                isIncome
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                  : isExpense
                  ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                  : isTransferIn
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
              }`}>
                {isTransferIn ? 'Transfer (Inflow)' : isTransferOut ? 'Transfer (Outflow)' : tx.type}
              </span>

              {isBalanceAdjustment(tx.category) && (
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Balance Adjustment (Excluded from Cashflow totals)
                </span>
              )}

              <span className="text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                Ref: {tx.id}
              </span>
            </div>

            {/* Complete, unclipped Description */}
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 break-words whitespace-pre-wrap leading-snug">
              {tx.description || 'No description provided'}
            </h3>
          </div>

          {/* Amount & Balance */}
          <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-1">
            <div className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              isIncome || isTransferIn
                ? 'text-emerald-600 dark:text-emerald-400'
                : isExpense || isTransferOut
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              {isIncome || isTransferIn ? '+' : isExpense || isTransferOut ? '-' : ''}
              {formatCurrency(tx.amount, tx.currency)}
            </div>
            <div className="text-xs font-mono text-slate-600 dark:text-zinc-400">
              Ending Account Balance: <strong className="font-semibold text-slate-900 dark:text-zinc-200">{formatCurrency(tx.accountBalance, tx.currency)}</strong>
            </div>
          </div>
        </div>

        {/* 4-Column Structured Attributes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
          {/* 1. Account Details */}
          <div className={`p-3 rounded-lg border ${
            isDark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 font-semibold mb-1">
              <Wallet className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Account</span>
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 break-words">
              {tx.account}
            </div>
            {isTransfer && tx.fromAccount && tx.toAccount && (
              <div className="mt-1.5 pt-1.5 border-t border-inherit text-[11px] space-y-0.5">
                <div className="flex items-center gap-1 text-slate-700 dark:text-zinc-300">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">From:</span>
                  <span className="font-semibold">{tx.fromAccount}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700 dark:text-zinc-300">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">To:</span>
                  <span className="font-semibold">{tx.toAccount}</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Category & Subcategory */}
          <div className={`p-3 rounded-lg border ${
            isDark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 font-semibold mb-1">
              <Tag className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Category & Subcategory</span>
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 break-words">
              {tx.category}
            </div>
            {tx.subcategory ? (
              <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1 break-words">
                Subcategory: <span className="font-semibold text-slate-900 dark:text-zinc-200">{tx.subcategory}</span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 italic">
                No subcategory assigned
              </div>
            )}
          </div>

          {/* 3. Date & Timestamp */}
          <div className={`p-3 rounded-lg border ${
            isDark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 font-semibold mb-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Date & Timestamp</span>
            </div>
            <div className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">
              {tx.rawDateStr}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
              {tx.date.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>

          {/* 4. Type & Cashflow Impact */}
          <div className={`p-3 rounded-lg border ${
            isDark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 font-semibold mb-1">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Currency & Cashflow Flow</span>
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">
              {tx.currency} · {tx.type}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
              {isBalanceAdjustment(tx.category)
                ? 'Updates balance only; neutral to income/expense'
                : isTransfer
                ? 'Inter-account liquidity movement'
                : isIncome
                ? 'Increases total cash inflow'
                : 'Decreases total cash outflow'}
            </div>
          </div>
        </div>

        {/* Complete, Unclipped Notes Section */}
        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-slate-50/70 border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-200">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Full Notes & Remarks</span>
            </div>
            {tx.notes && (
              <span className="text-[10px] text-slate-600 dark:text-zinc-400 font-mono">
                {tx.notes.length} characters
              </span>
            )}
          </div>
          {tx.notes ? (
            <p className="text-xs leading-relaxed text-slate-900 dark:text-zinc-200 whitespace-pre-wrap break-words">
              {tx.notes}
            </p>
          ) : (
            <p className="text-xs italic text-slate-500 dark:text-zinc-400">
              No additional notes or remarks recorded for this transaction.
            </p>
          )}
        </div>

        {/* Footer Quick Action Bar */}
        <div className="mt-4 pt-3 border-t border-inherit flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-[11px] text-slate-600 dark:text-zinc-400">
            Click row again to collapse details
          </span>
          <button
            type="button"
            onClick={(e) => copyTransactionDetails(tx, e)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              copiedId === tx.id
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs'
            }`}
          >
            {copiedId === tx.id ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied Details!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Full Details</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Extract unique accounts and categories
  const accounts = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.account))).sort();
  }, [transactions]);

  const categories = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.category))).sort();
  }, [transactions]);

  // Filtering
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (selectedAccount !== 'all' && t.account !== selectedAccount) return false;
      if (selectedType !== 'All' && t.type !== selectedType) return false;
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchDesc = t.description.toLowerCase().includes(query);
        const matchNotes = t.notes.toLowerCase().includes(query);
        const matchCat = t.category.toLowerCase().includes(query);
        const matchSub = t.subcategory.toLowerCase().includes(query);
        const matchAcc = t.account.toLowerCase().includes(query);
        return matchDesc || matchNotes || matchCat || matchSub || matchAcc;
      }
      return true;
    });
  }, [transactions, selectedAccount, selectedType, selectedCategory, searchQuery]);

  // Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = a.date.getTime() - b.date.getTime();
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortField === 'accountBalance') {
        comparison = a.accountBalance - b.accountBalance;
      } else if (sortField === 'account') {
        comparison = a.account.localeCompare(b.account);
      } else if (sortField === 'category') {
        comparison = a.category.localeCompare(b.category);
      } else if (sortField === 'type') {
        comparison = a.type.localeCompare(b.type);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [filtered, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, currentPage, rowsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending (e.g. newest date or highest amount)
    }
    setCurrentPage(1);
  };

  const handleExportFiltered = () => {
    exportTransactionsToCsv(sorted, 'filtered_financial_ledger.csv');
  };

  return (
    <div className={`rounded-2xl border transition-colors ${
      isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
    }`}>
      {/* Top Filter and Search Bar */}
      <div className="p-5 border-b border-inherit space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Financial Ledger Explorer</h2>
              {periodLabel && (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
                  isDark ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                }`}>
                  {periodLabel}
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Click any transaction row to expand full unclipped description, complete notes, and audit details.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Expand All / Collapse All */}
            <button
              type="button"
              onClick={handleExpandAll}
              title={expandedIds.size === paginatedTransactions.length && paginatedTransactions.length > 0 ? "Collapse all visible rows" : "Expand all visible rows"}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                isDark
                  ? 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
              }`}
            >
              {expandedIds.size === paginatedTransactions.length && paginatedTransactions.length > 0 ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Expand All</span>
                </>
              )}
            </button>

            {/* View Mode Switcher: Full Table vs Card List */}
            <div className={`inline-flex items-center rounded-lg p-0.5 border ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Full-Width Table View"
                className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'table'
                    ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                    : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Card List View"
                className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'cards'
                    ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                    : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleExportFiltered}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                isDark
                  ? 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Filtered ({sorted.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
              isDark ? 'text-zinc-500' : 'text-slate-500'
            }`} />
            <input
              type="text"
              placeholder="Refine search within results..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors ${
                isDark
                  ? 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-500 focus:border-indigo-500'
              }`}
            />
          </div>

          {/* Global Search Active Filter Tag */}
          {globalSearchQuery && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
              isDark ? 'bg-indigo-950/60 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}>
              <span>Header filter: <strong className="font-semibold">"{globalSearchQuery}"</strong></span>
              {onClearGlobalSearch && (
                <button
                  type="button"
                  onClick={onClearGlobalSearch}
                  title="Clear global search"
                  className="p-0.5 hover:opacity-75 rounded transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Type Segmented Control */}
          <div className={`inline-flex rounded-lg p-0.5 border ${
            isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
          }`}>
            {(['All', 'Expense', 'Income', 'Transfer'] as const).map(type => (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedType === type
                    ? isDark ? 'bg-zinc-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                    : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Account Filter */}
          <select
            value={selectedAccount}
            onChange={e => {
              setSelectedAccount(e.target.value);
              setCurrentPage(1);
            }}
            className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none font-medium ${
              isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <option value="all">All Accounts ({accounts.length})</option>
            {accounts.map(acc => (
              <option key={acc} value={acc}>
                {acc}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none font-medium ${
              isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Responsive View Mode: Full-Width Fixed Table & Mobile Card List */}
      {/* 1. Full-Width Fixed Table (Zero horizontal scroll on desktop/laptop/tablets) */}
      <div className={viewMode === 'cards' ? 'hidden' : 'hidden md:block w-full overflow-hidden'}>
        <table className="w-full table-fixed text-left border-collapse text-xs">
          <colgroup>
            <col className="w-[11%]" />  {/* Date */}
            <col className="w-[15%]" />  {/* Account */}
            <col className="w-[15%]" />  {/* Category / Sub */}
            <col className="w-[26%]" />  {/* Description & Notes */}
            <col className="w-[9%]" />   {/* Type */}
            <col className="w-[12%]" />  {/* Amount */}
            <col className="w-[12%]" />  {/* Ending Balance */}
          </colgroup>
          <thead>
            <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
              isDark ? 'bg-zinc-950/60 border-zinc-800 text-zinc-400' : 'bg-slate-100/90 border-slate-200 text-slate-700'
            }`}>
              {/* Col 1: Date */}
              <th
                onClick={() => handleSort('date')}
                className="py-2.5 px-3 cursor-pointer hover:text-indigo-400 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Date</span>
                  <ArrowUpDown className="w-3 h-3 shrink-0 opacity-70" />
                </div>
              </th>

              {/* Col 2: Account */}
              <th
                onClick={() => handleSort('account')}
                className="py-2.5 px-3 cursor-pointer hover:text-indigo-400 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Account</span>
                  <ArrowUpDown className="w-3 h-3 shrink-0 opacity-70" />
                </div>
              </th>

              {/* Col 3 & 4: Category / Subcategory */}
              <th
                onClick={() => handleSort('category')}
                className="py-2.5 px-3 cursor-pointer hover:text-indigo-400 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Category</span>
                  <ArrowUpDown className="w-3 h-3 shrink-0 opacity-70" />
                </div>
              </th>

              {/* Col 5 & 6 & 7: Description & Notes */}
              <th className="py-2.5 px-3 select-none">
                <span>Description & Notes</span>
              </th>

              {/* Col 8: Type */}
              <th
                onClick={() => handleSort('type')}
                className="py-2.5 px-2 cursor-pointer hover:text-indigo-400 transition-colors text-center select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Type</span>
                  <ArrowUpDown className="w-3 h-3 shrink-0 opacity-70" />
                </div>
              </th>

              {/* Col 9: Amount & Currency */}
              <th
                onClick={() => handleSort('amount')}
                className="py-2.5 px-3 cursor-pointer hover:text-indigo-400 transition-colors text-right select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Amount</span>
                  <ArrowUpDown className="w-3 h-3 shrink-0 opacity-70" />
                </div>
              </th>

              {/* Col 10: Account Balance */}
              <th
                onClick={() => handleSort('accountBalance')}
                className="py-2.5 px-3 cursor-pointer hover:text-indigo-400 transition-colors text-right select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Balance</span>
                  <ArrowUpDown className="w-3 h-3 shrink-0 opacity-70" />
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-inherit">
            {paginatedTransactions.map((tx) => {
              const isIncome = tx.type === 'Income';
              const isExpense = tx.type === 'Expense';
              const isTransfer = tx.type === 'Transfer';
              const isTransferIn = isTransfer && tx.transferDirection === 'inflow';
              const isTransferOut = isTransfer && tx.transferDirection === 'outflow';
              const { datePart, timePart } = formatDateTimeParts(tx.date, tx.rawDateStr);
              const isExpanded = expandedIds.has(tx.id);

              return (
                <React.Fragment key={tx.id}>
                  <tr
                    onClick={() => toggleRowExpand(tx.id)}
                    className={`transition-colors cursor-pointer select-none ${
                      isExpanded
                        ? isDark
                          ? 'bg-zinc-800/40 border-l-2 border-l-indigo-500'
                          : 'bg-indigo-50/50 border-l-2 border-l-indigo-500'
                        : isDark
                        ? 'hover:bg-zinc-800/30'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Col 1: Date & Time (Double lines + Chevron Expand Indicator) */}
                    <td className="py-2.5 px-3 min-w-0 font-mono tabular-nums">
                      <div className="flex items-start gap-1.5">
                        <div
                          className={`mt-0.5 transition-transform duration-200 ${
                            isDark ? 'text-zinc-500' : 'text-slate-600'
                          } ${
                            isExpanded ? 'rotate-180 text-indigo-500' : ''
                          }`}
                        >
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-semibold truncate ${isDark ? 'text-zinc-200' : 'text-slate-900'}`} title={datePart}>
                            {datePart}
                          </div>
                          {timePart ? (
                            <div className={`text-[10px] truncate mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`} title={timePart}>
                              {timePart}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Col 2: Account */}
                    <td className="py-2.5 px-3 min-w-0">
                      {isTransfer && tx.fromAccount && tx.toAccount ? (
                        <div className="truncate" title={`${tx.fromAccount} ➔ ${tx.toAccount} (${isTransferOut ? 'Money from' : 'Money to'})`}>
                          <div className={`flex items-center gap-1 text-xs font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                            <span className={`truncate ${isTransferOut ? 'text-amber-600 font-bold' : ''}`}>
                              {tx.fromAccount}
                            </span>
                            <ArrowRight className={`w-2.5 h-2.5 shrink-0 ${isDark ? 'text-zinc-500' : 'text-slate-600'}`} />
                            <span className={`truncate ${isTransferIn ? 'text-emerald-600 font-bold' : ''}`}>
                              {tx.toAccount}
                            </span>
                          </div>
                          <div className={`text-[10px] truncate font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                            {isTransferOut ? 'Outflow' : 'Inflow'} · {tx.account}
                          </div>
                        </div>
                      ) : (
                        <span className={`font-semibold truncate block text-xs ${isDark ? 'text-zinc-100' : 'text-slate-900'}`} title={tx.account}>
                          {tx.account}
                        </span>
                      )}
                    </td>

                    {/* Col 3 & 4: Category / Subcategory */}
                    <td className="py-2.5 px-3 min-w-0">
                      <div className={`font-semibold flex items-center gap-1 min-w-0 text-xs ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                        {isTransfer ? (
                          <>
                            <ArrowRightLeft className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">Transfer</span>
                          </>
                        ) : (
                          <>
                            <span className="truncate" title={tx.category}>{tx.category}</span>
                            {isBalanceAdjustment(tx.category) && (
                              <span
                                className="text-[9px] px-1 py-0.2 rounded font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0"
                                title="Balance Adjustment: excluded from Cashflow"
                              >
                                Adj
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {tx.subcategory && (
                        <div className={`text-[11px] truncate font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`} title={tx.subcategory}>
                          {tx.subcategory}
                        </div>
                      )}
                    </td>

                    {/* Col 5 & 6 & 7: Description & Notes */}
                    <td className="py-2.5 px-3 min-w-0">
                      <div className={`font-semibold truncate text-xs ${isDark ? 'text-zinc-100' : 'text-slate-900'}`} title={tx.description}>
                        {tx.description || '—'}
                      </div>
                      {tx.notes && (
                        <div className={`text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-slate-600'}`} title={tx.notes}>
                          {tx.notes}
                        </div>
                      )}
                    </td>

                    {/* Col 8: Type */}
                    <td className="py-2.5 px-2 text-center min-w-0">
                      <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full truncate max-w-full ${
                        isIncome
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : isExpense
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : isTransferIn
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {isTransferIn ? 'Transfer In' : isTransferOut ? 'Transfer Out' : tx.type}
                      </span>
                    </td>

                    {/* Col 9: Amount & Currency */}
                    <td className="py-2.5 px-3 font-mono tabular-nums text-right text-xs truncate">
                      <span className={`font-bold ${
                        isIncome || isTransferIn
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isExpense || isTransferOut
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {isIncome || isTransferIn ? '+' : isExpense || isTransferOut ? '-' : ''}
                        {formatCurrency(tx.amount, tx.currency)}
                      </span>
                    </td>

                    {/* Col 10: Account Balance */}
                    <td className={`py-2.5 px-3 font-mono tabular-nums text-right text-xs truncate font-medium ${isDark ? 'text-zinc-200' : 'text-slate-900'}`}>
                      {formatCurrency(tx.accountBalance, tx.currency)}
                    </td>
                  </tr>

                  {/* Expanded Row Detail Drawer (Zero Loss of Text) */}
                  {isExpanded && (
                    <tr className={isDark ? 'bg-zinc-950/40' : 'bg-slate-50/60'}>
                      <td colSpan={7} className="p-3 sm:p-4 border-b border-inherit">
                        {renderExpandedDetails(tx)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. Responsive Card View (Shows on mobile by default or when Cards view is selected) */}
      <div className={viewMode === 'cards' ? 'divide-y divide-inherit' : 'block md:hidden divide-y divide-inherit'}>
        {paginatedTransactions.map((tx) => {
          const isIncome = tx.type === 'Income';
          const isExpense = tx.type === 'Expense';
          const isTransfer = tx.type === 'Transfer';
          const isTransferIn = isTransfer && tx.transferDirection === 'inflow';
          const isTransferOut = isTransfer && tx.transferDirection === 'outflow';
          const { datePart, timePart } = formatDateTimeParts(tx.date, tx.rawDateStr);
          const isExpanded = expandedIds.has(tx.id);

          return (
            <div
              key={tx.id}
              onClick={() => toggleRowExpand(tx.id)}
              className={`p-3.5 transition-colors cursor-pointer ${
                isExpanded
                  ? isDark
                    ? 'bg-zinc-900/90 ring-1 ring-indigo-500/30'
                    : 'bg-indigo-50/40 ring-1 ring-indigo-500/20'
                  : isDark
                  ? 'hover:bg-zinc-800/40'
                  : 'hover:bg-slate-50'
              }`}
            >
              {/* Card Row 1: Date + Type badge on left, Amount on right */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-mono tabular-nums">
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200">
                      {datePart}
                    </div>
                    {timePart ? (
                      <div className="text-[10px] text-slate-600 dark:text-zinc-400 font-medium">
                        {timePart}
                      </div>
                    ) : null}
                  </div>
                  <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isIncome
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : isExpense
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : isTransferIn
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {isTransferIn ? 'Transfer In' : isTransferOut ? 'Transfer Out' : tx.type}
                  </span>
                  {isBalanceAdjustment(tx.category) && (
                    <span
                      className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                      title="Balance Adjustment: excluded from Cashflow"
                    >
                      Adj
                    </span>
                  )}
                </div>

                <div className="text-right flex items-center gap-2">
                  <span className={`text-sm font-bold font-mono tabular-nums ${
                    isIncome || isTransferIn
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isExpense || isTransferOut
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {isIncome || isTransferIn ? '+' : isExpense || isTransferOut ? '-' : ''}
                    {formatCurrency(tx.amount, tx.currency)}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDark ? 'text-zinc-400' : 'text-slate-600'} ${isExpanded ? 'rotate-180 text-indigo-400' : ''}`} />
                </div>
              </div>

              {/* Card Row 2: Description & Notes */}
              <div className="mt-2 flex items-start justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className={`font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-slate-900'}`} title={tx.description}>
                    {tx.description || '—'}
                  </div>
                  {tx.notes && !isExpanded && (
                    <div className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`} title={tx.notes}>
                      {tx.notes}
                    </div>
                  )}
                </div>
                <div className={`text-right font-mono text-[11px] font-semibold shrink-0 ${isDark ? 'text-zinc-300' : 'text-slate-900'}`}>
                  Bal: {formatCurrency(tx.accountBalance, tx.currency)}
                </div>
              </div>

              {/* Card Expanded Content OR Compact Footer */}
              {isExpanded ? (
                <div className="mt-3 pt-3 border-t border-inherit">
                  {renderExpandedDetails(tx)}
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-inherit flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-400">
                  <div className="truncate flex items-center gap-1.5">
                    {isTransfer && tx.fromAccount && tx.toAccount ? (
                      <span className={`font-semibold flex items-center gap-1 truncate ${isDark ? 'text-zinc-300' : 'text-slate-900'}`}>
                        <span>{tx.fromAccount}</span>
                        <ArrowRight className={`w-2.5 h-2.5 shrink-0 ${isDark ? 'text-zinc-500' : 'text-slate-600'}`} />
                        <span>{tx.toAccount}</span>
                      </span>
                    ) : (
                      <span className={`font-semibold ${isDark ? 'text-zinc-300' : 'text-slate-900'}`}>{tx.account}</span>
                    )}
                    <span>•</span>
                    <span className="truncate">{tx.category}{tx.subcategory ? ` › ${tx.subcategory}` : ''}</span>
                  </div>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
                    Click to inspect full text
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className={`py-12 text-center text-xs ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
          No transactions match your current search or filters.
        </div>
      )}

      {/* Pagination Strip */}
      <div className="p-4 border-t border-inherit flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className={isDark ? 'text-zinc-400' : 'text-slate-700 font-medium'}>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={e => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className={`px-2 py-1 rounded-md border outline-none font-medium ${
              isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className={`ml-2 ${isDark ? 'text-zinc-400' : 'text-slate-700 font-medium'}`}>
            Showing {sorted.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, sorted.length)} of {sorted.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono tabular-nums px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
