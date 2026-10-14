import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Sparkles, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseFinancialFile, generateSampleDataset, exportTransactionsToCsv } from '../utils/fileParser';
import { Transaction } from '../types/finance';

interface FileUploadZoneProps {
  onDataLoaded: (transactions: Transaction[], filename: string) => void;
  isDark: boolean;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ onDataLoaded, isDark }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await parseFinancialFile(file);
      if (result.transactions.length === 0) {
        throw new Error('No valid financial transactions were found in the uploaded file.');
      }
      onDataLoaded(result.transactions, file.name);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse file. Please verify the format matches the 10-column schema.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleLoadSample = () => {
    setIsLoading(true);
    setTimeout(() => {
      const sample = generateSampleDataset();
      onDataLoaded(sample, 'sample_financial_ledger.xlsx');
      setIsLoading(false);
    }, 250);
  };

  const handleDownloadTemplate = () => {
    const sample = generateSampleDataset().slice(0, 5);
    exportTransactionsToCsv(sample, 'financial_ledger_template.csv');
  };

  const columnsSpec = [
    { col: 'A', name: 'Date', example: '14/10/2026 09:14:32' },
    { col: 'B', name: 'Account', example: 'Chase Premier Checking (Money from)' },
    { col: 'C', name: 'Category', example: 'Food & Dining / Balance Adjustment / Money to' },
    { col: 'D', name: 'Subcategory', example: 'Coffee & Breakfast / Reconciliation' },
    { col: 'E', name: 'Notes', example: 'Team sync meeting' },
    { col: 'G', name: 'Type of transaction', example: 'Expense / Income / Transfer' },
    { col: 'H', name: 'Description', example: 'Blue Bottle Coffee San Francisco' },
    { col: 'I', name: 'Amount (transaction value)', example: '18.50' },
    { col: 'J', name: 'Currency', example: 'USD' },
  ];

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      {/* Hero Intro */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Financial Ledger & Budget Analyzer
        </h1>
        <p className={`mt-3 text-sm sm:text-base max-w-2xl mx-auto ${
          isDark ? 'text-zinc-400' : 'text-slate-600'
        }`}>
          Upload your financial spreadsheet (.xlsx, .xls) or CSV export matching the updated A1–J1 extraction schema to instantly analyze category spending, budget limits, variances, and multi-account balance trends.
        </p>
      </div>

      {/* Dropzone Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? isDark ? 'border-indigo-500 bg-indigo-950/20' : 'border-indigo-500 bg-indigo-50/50'
            : isDark ? 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900' : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center justify-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform ${
            isDark ? 'bg-indigo-950/60 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
          }`}>
            <Upload className="w-7 h-7" />
          </div>

          <h3 className="text-base font-semibold">
            {isLoading ? 'Processing financial ledger...' : 'Drop your Excel or CSV file here'}
          </h3>
          <p className={`mt-1 text-xs sm:text-sm ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
            Supports .xlsx, .xls, and .csv files · 100% client-side & private
          </p>

          <button
            type="button"
            className="mt-5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm"
          >
            Browse Local File
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 text-sm ${
          isDark ? 'bg-rose-950/40 border border-rose-800/60 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-semibold">Import Issue</p>
            <p className="text-xs mt-0.5 opacity-90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Quick Launch & Template Action */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={handleLoadSample}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
            isDark
              ? 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Load Realistic Demo Dataset (30+ Txns)</span>
        </button>

        <button
          onClick={handleDownloadTemplate}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
            isDark
              ? 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-xs'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          <span>Download Sample CSV Template</span>
        </button>
      </div>

      {/* Schema Reference Blueprint */}
      <div className={`mt-10 p-6 rounded-2xl border transition-colors ${
        isDark ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-inherit">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider">
              Updated Extraction Source Schema (A1–J1)
            </h4>
          </div>
          <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
            A1–E1 & G1–J1 · Transfers: Money from (B1) ➔ Money to (C1) · Ending balance calculated dynamically per account
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {columnsSpec.map(item => (
            <div
              key={item.col}
              className={`p-3 rounded-lg border text-left ${
                isDark ? 'bg-zinc-900/90 border-zinc-800/60' : 'bg-slate-50/80 border-slate-200/60'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-indigo-400 font-mono">{item.col}1</span>
                <span className={isDark ? 'text-zinc-200' : 'text-slate-800'}>{item.name}</span>
              </div>
              <p className={`text-[11px] truncate font-mono tabular-nums ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} title={item.example}>
                {item.example}
              </p>
            </div>
          ))}

          {/* Dynamic Balance indicator box */}
          <div className={`p-3 rounded-lg border text-left ${
            isDark ? 'bg-indigo-950/30 border-indigo-800/60' : 'bg-indigo-50/60 border-indigo-200'
          }`}>
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="text-indigo-400 font-mono">Dynamic</span>
              <span className="text-indigo-600 dark:text-indigo-300">Ending Balance</span>
            </div>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
              Calculated automatically per individual account in processing
            </p>
          </div>
        </div>

        {/* Balance Adjustment Notice */}
        <div className={`mt-4 p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
          isDark ? 'bg-amber-950/20 border-amber-800/40 text-amber-300/90' : 'bg-amber-50/80 border-amber-200 text-amber-800'
        }`}>
          <span>
            <strong>Balance Adjustments:</strong> If Category is set to <span className="font-mono font-semibold">Balance Adjustment</span>, the transaction updates the account ending balance, but is automatically filtered out from Income, Expense, and Cashflow calculations.
          </span>
        </div>
      </div>
    </div>
  );
};
