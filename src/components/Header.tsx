import React, { useRef, useEffect } from 'react';
import { Sun, Moon, UploadCloud, Download, Sparkles, Search, X } from 'lucide-react';

interface HeaderProps {
  activeTab: 'overview' | 'budget' | 'charts' | 'anomalies' | 'ledger';
  setActiveTab: (tab: 'overview' | 'budget' | 'charts' | 'anomalies' | 'ledger') => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  hasData: boolean;
  onResetUpload: () => void;
  onExportCsv: () => void;
  onLoadSample: () => void;
  anomalyCount?: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchMatchCount?: number;
  totalPeriodCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isDark,
  setIsDark,
  hasData,
  onResetUpload,
  onExportCsv,
  onLoadSample,
  anomalyCount = 0,
  searchQuery = '',
  onSearchChange,
  searchMatchCount,
  totalPeriodCount,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Cmd+K / Ctrl+K / '/' to focus global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasData || !onSearchChange) return;

      const target = e.target as HTMLElement;
      const isInputActive =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === '/' && !isInputActive) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          onSearchChange('');
        } else {
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasData, onSearchChange, searchQuery]);

  return (
    <header className={`border-b transition-colors ${
      isDark ? 'bg-zinc-950/90 border-zinc-800/80 text-zinc-100' : 'bg-white/95 border-slate-200 text-slate-900'
    } backdrop-blur-md sticky top-0 z-40 shadow-xs`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4 md:gap-6">
        {/* Zone 1: Brand title wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm">
            FD
          </div>
          <span className="hidden sm:inline text-lg font-bold tracking-tight whitespace-nowrap">
            Financial Dashboard
          </span>
        </div>

        {/* Zone 2: Navigation links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-5 text-sm font-medium shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
              activeTab === 'overview'
                ? isDark ? 'text-white border-indigo-400 font-semibold' : 'text-slate-900 border-indigo-600 font-semibold'
                : isDark ? 'text-zinc-400 border-transparent hover:text-zinc-200' : 'text-slate-600 font-semibold border-transparent hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
              activeTab === 'budget'
                ? isDark ? 'text-white border-indigo-400 font-semibold' : 'text-slate-900 border-indigo-600 font-semibold'
                : isDark ? 'text-zinc-400 border-transparent hover:text-zinc-200' : 'text-slate-600 font-semibold border-transparent hover:text-slate-900'
            }`}
          >
            Budget Variance
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
              activeTab === 'charts'
                ? isDark ? 'text-white border-indigo-400 font-semibold' : 'text-slate-900 border-indigo-600 font-semibold'
                : isDark ? 'text-zinc-400 border-transparent hover:text-zinc-200' : 'text-slate-600 font-semibold border-transparent hover:text-slate-900'
            }`}
          >
            Custom Charts
          </button>
          <button
            onClick={() => setActiveTab('anomalies')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 flex items-center gap-1.5 ${
              activeTab === 'anomalies'
                ? isDark ? 'text-white border-indigo-400 font-semibold' : 'text-slate-900 border-indigo-600 font-semibold'
                : isDark ? 'text-zinc-400 border-transparent hover:text-zinc-200' : 'text-slate-600 font-semibold border-transparent hover:text-slate-900'
            }`}
          >
            <span>Anomalies</span>
            {anomalyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-500">
                {anomalyCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
              activeTab === 'ledger'
                ? isDark ? 'text-white border-indigo-400 font-semibold' : 'text-slate-900 border-indigo-600 font-semibold'
                : isDark ? 'text-zinc-400 border-transparent hover:text-zinc-200' : 'text-slate-600 font-semibold border-transparent hover:text-slate-900'
            }`}
          >
            Transactions
          </button>
        </nav>

        {/* Zone 3: Global Search Bar */}
        {hasData && onSearchChange ? (
          <div className="flex-1 min-w-[140px] max-w-md relative group">
            <div className="relative flex items-center">
              <Search className={`w-4 h-4 pointer-events-none absolute left-3 transition-colors ${
                searchQuery ? 'text-indigo-400' : isDark ? 'text-zinc-400 group-focus-within:text-indigo-500' : 'text-slate-600 group-focus-within:text-indigo-600'
              }`} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search description, notes, subcategory..."
                title="Filter transactions across all tabs by description, notes, or subcategory"
                className={`w-full pl-9 pr-16 sm:pr-20 py-1.5 text-xs rounded-xl border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                  isDark
                    ? searchQuery
                      ? 'bg-zinc-900 border-indigo-500/80 text-white placeholder-zinc-400 ring-1 ring-indigo-500/30'
                      : 'bg-zinc-900/90 border-zinc-700/80 text-zinc-100 placeholder-zinc-500 hover:border-zinc-600 focus:border-indigo-500'
                    : searchQuery
                      ? 'bg-white border-indigo-500 text-slate-900 placeholder-slate-600 ring-1 ring-indigo-500/30 shadow-xs'
                      : 'bg-slate-100/90 border-slate-300 text-slate-900 placeholder-slate-600 hover:border-slate-400 focus:bg-white focus:border-indigo-500'
                }`}
              />

              {/* Right side adornment: match counter / clear button / shortcut */}
              <div className="absolute right-2 flex items-center gap-1.5">
                {searchQuery ? (
                  <>
                    {typeof searchMatchCount === 'number' && (
                      <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                        searchMatchCount > 0
                          ? isDark ? 'bg-indigo-950/80 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                          : isDark ? 'bg-rose-950/80 text-rose-300' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {searchMatchCount}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onSearchChange('');
                        searchInputRef.current?.focus();
                      }}
                      title="Clear search filter (Esc)"
                      className={`p-1 rounded-md transition-colors ${
                        isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <kbd className={`hidden xl:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded border select-none ${
                    isDark ? 'bg-zinc-800/80 border-zinc-700 text-zinc-400' : 'bg-slate-200/80 border-slate-300 text-slate-600 font-semibold'
                  }`}>
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Zone 4: Actions & Theme Switch */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Quick load sample if no data or anytime */}
          {!hasData ? (
            <button
              onClick={onLoadSample}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Load Sample</span>
            </button>
          ) : (
            <>
              <button
                onClick={onExportCsv}
                title="Export current transactions as CSV"
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={onResetUpload}
                title="Upload another spreadsheet"
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New File</span>
              </button>
            </>
          )}

          {/* Dark / Light Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            aria-label="Toggle theme mode"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-zinc-400 hover:text-amber-300 hover:bg-zinc-800' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Sub-Navigation strip (visible on <lg when data is loaded) */}
      {hasData && (
        <div className={`lg:hidden border-t px-4 py-1.5 flex items-center gap-2 overflow-x-auto text-xs font-medium scrollbar-none ${
          isDark ? 'border-zinc-800/80 bg-zinc-950/80' : 'border-slate-200 bg-slate-50/80'
        }`}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'overview'
                ? isDark ? 'bg-indigo-600 text-white font-semibold' : 'bg-indigo-600 text-white font-semibold'
                : isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'budget'
                ? isDark ? 'bg-indigo-600 text-white font-semibold' : 'bg-indigo-600 text-white font-semibold'
                : isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Budget Variance
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'charts'
                ? isDark ? 'bg-indigo-600 text-white font-semibold' : 'bg-indigo-600 text-white font-semibold'
                : isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Custom Charts
          </button>
          <button
            onClick={() => setActiveTab('anomalies')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
              activeTab === 'anomalies'
                ? isDark ? 'bg-indigo-600 text-white font-semibold' : 'bg-indigo-600 text-white font-semibold'
                : isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Anomalies</span>
            {anomalyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-500">
                {anomalyCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'ledger'
                ? isDark ? 'bg-indigo-600 text-white font-semibold' : 'bg-indigo-600 text-white font-semibold'
                : isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Transactions
          </button>
        </div>
      )}
    </header>
  );
};
