import * as XLSX from 'xlsx';
import { Transaction, TransactionType } from '../types/finance';

/**
 * Parses date string in various formats:
 * - "14/10/2026 09:14:32" (DD/MM/YYYY HH:mm:ss)
 * - "14/10/2026" (DD/MM/YYYY)
 * - "2026-10-14 09:14:32" (ISO-like)
 * - Excel serial date numbers (e.g. 46310.38)
 */
export function parseFinancialDate(val: any): { date: Date; rawStr: string } {
  if (!val) {
    const now = new Date();
    return { date: now, rawStr: formatDateDisplay(now) };
  }

  // Handle Excel numeric serial dates
  if (typeof val === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const msPerDay = 86400 * 1000;
    const date = new Date(excelEpoch.getTime() + val * msPerDay);
    return { date, rawStr: formatDateDisplay(date) };
  }

  const str = String(val).trim();

  // Pattern: DD/MM/YYYY HH:mm:ss or DD-MM-YYYY HH:mm:ss
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    const d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) {
      return { date: d, rawStr: str };
    }
  }

  // Native parse fallback
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return { date: fallback, rawStr: str };
  }

  const defaultDate = new Date();
  return { date: defaultDate, rawStr: str || formatDateDisplay(defaultDate) };
}

export function formatDateDisplay(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function parseNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;

  // Handle accounting format (1,234.56) -> -1234.56
  const isParenNegative = /^\(.*\)$/.test(str);
  const cleanStr = str.replace(/[$,€£¥A-Za-z()]/g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0;
  return isParenNegative ? -Math.abs(num) : num;
}

export function normalizeTransactionType(raw: any, amount?: number): TransactionType {
  if (!raw) {
    if (typeof amount === 'number') {
      return amount >= 0 ? 'Income' : 'Expense';
    }
    return 'Expense';
  }
  const clean = String(raw).trim().toLowerCase();
  if (clean.includes('inc') || clean.includes('credit') || clean.includes('deposit') || clean.includes('revenue')) {
    return 'Income';
  }
  if (clean.includes('trans') || clean.includes('xfer') || clean.includes('between')) {
    return 'Transfer';
  }
  return 'Expense';
}

/**
 * Parses raw ArrayBuffer / binary string from uploaded Excel or CSV file.
 */
export async function parseFinancialFile(file: File): Promise<{
  transactions: Transaction[];
  headers: string[];
  warning?: string;
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded file does not contain any worksheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  // Parse as raw 2D array: row 0 is headers, row 1+ are data rows
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The spreadsheet appears to be empty.');
  }

  // Find header row (usually row 0, but check first 3 rows in case of blank lines)
  let headerIndex = 0;
  for (let r = 0; r < Math.min(5, rawRows.length); r++) {
    const row = rawRows[r];
    if (row && row.some(cell => typeof cell === 'string' && /date|account|category|amount|balance/i.test(cell))) {
      headerIndex = r;
      break;
    }
  }

  const rawHeaders = (rawRows[headerIndex] || []).map(h => String(h || '').trim());
  const dataRows = rawRows.slice(headerIndex + 1).filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== ''));

  // Determine column mapping:
  // Updated Schema requirement:
  // A1 (0) - Date
  // B1 (1) - Account (Money from for transfers)
  // C1 (2) - Category (Money to for transfers)
  // D1 (3) - Subcategory
  // E1 (4) - Notes
  // F1 (5) - Skipped / Optional reference
  // G1 (6) - Type of transaction
  // H1 (7) - Description
  // I1 (8) - Amount (transaction value)
  // J1 (9) - Currency
  // Ending Balance: calculated dynamically for each transaction of an individual account in processing
  const colIndex = {
    date: findColIndex(rawHeaders, [/^date\b/i, /time/i], 0),
    account: findColIndex(rawHeaders, [/^account\b/i, /money\s*from/i, /^from\b/i, /source/i, /bank/i, /wallet/i], 1),
    category: findColIndex(rawHeaders, [/^category\b/i, /money\s*to/i, /^to\b/i, /destination/i, /main\s*category/i], 2),
    subcategory: findColIndex(rawHeaders, [/sub\s*category/i, /subcategory/i], 3),
    notes: findColIndex(rawHeaders, [/^notes?\b/i, /memo/i, /remark/i, /comment/i], 4),
    type: findColIndex(rawHeaders, [/type\s*(?:of\s*)?trans/i, /txn\s*type/i, /trans.*type/i, /^type\b/i], 6),
    description: findColIndex(rawHeaders, [/^desc/i, /payee/i, /merchant/i, /details/i, /particulars/i], 7),
    amount: findColIndex(rawHeaders, [/amount/i, /trans.*val/i, /transaction\s*value/i, /^value/i, /price/i], 8),
    currency: findColIndex(rawHeaders, [/^curr/i, /ccy/i, /iso/i], 9),
  };

  const rawTransactions: Transaction[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rawDateVal = row[colIndex.date];
    const { date, rawStr: rawDateStr } = parseFinancialDate(rawDateVal);

    const rawColB = String(row[colIndex.account] || '').trim();
    const rawColC = String(row[colIndex.category] || '').trim();
    const subcategory = String(row[colIndex.subcategory] || '').trim();
    const notes = String(row[colIndex.notes] || '').trim();
    const rawType = row[colIndex.type];
    const description = String(row[colIndex.description] || '').trim();
    const amountVal = parseNumber(row[colIndex.amount]);
    const currency = String(row[colIndex.currency] || 'USD').trim().toUpperCase() || 'USD';

    const type = normalizeTransactionType(rawType, amountVal);

    if (type === 'Transfer') {
      // Transaction type: transfer. Money from account extracted from B1; money to extracted from C1
      const fromAccount = rawColB || 'Default Account';
      const toAccount = rawColC || 'Destination Account';
      const cleanAmount = Math.abs(amountVal);

      // 1. Outflow transaction for the "Money from" account (B1)
      rawTransactions.push({
        id: `tx-${i + 1}-out-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        date,
        rawDateStr,
        account: fromAccount,
        fromAccount,
        toAccount,
        category: 'Transfer',
        subcategory: subcategory || `Transfer to ${toAccount}`,
        notes,
        type: 'Transfer',
        transferDirection: 'outflow',
        description: description || `Transfer to ${toAccount}`,
        amount: cleanAmount,
        currency,
        accountBalance: 0,
      });

      // 2. Inflow transaction for the "Money to" account (C1)
      if (toAccount && toAccount !== fromAccount) {
        rawTransactions.push({
          id: `tx-${i + 1}-in-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          date,
          rawDateStr,
          account: toAccount,
          fromAccount,
          toAccount,
          category: 'Transfer',
          subcategory: subcategory || `Transfer from ${fromAccount}`,
          notes,
          type: 'Transfer',
          transferDirection: 'inflow',
          description: description || `Transfer from ${fromAccount}`,
          amount: cleanAmount,
          currency,
          accountBalance: 0,
        });
      }
    } else {
      rawTransactions.push({
        id: `tx-${i + 1}-${Date.now().toString(36)}`,
        date,
        rawDateStr,
        account: rawColB || 'Default Account',
        category: rawColC || 'Uncategorized',
        subcategory,
        notes,
        type,
        description,
        amount: Math.abs(amountVal),
        currency,
        accountBalance: 0,
      });
    }
  }

  // Calculate ending balance for each transaction of an individual account
  const transactions = calculateRunningBalancesForAccounts(rawTransactions);

  return {
    transactions,
    headers: rawHeaders,
  };
}

/**
 * Calculates the ending balance for each transaction of an individual account in chronological processing.
 */
export function calculateRunningBalancesForAccounts(
  transactions: Transaction[],
  initialBalances: Record<string, number> = {}
): Transaction[] {
  // Group transactions by individual account
  const accountMap = new Map<string, Transaction[]>();

  transactions.forEach(t => {
    const acc = t.account || 'Default Account';
    if (!accountMap.has(acc)) {
      accountMap.set(acc, []);
    }
    accountMap.get(acc)!.push({ ...t });
  });

  const allProcessed: Transaction[] = [];

  accountMap.forEach((txList, account) => {
    // Sort chronologically ascending (oldest first) to accumulate running balance correctly
    txList.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = initialBalances[account] !== undefined ? initialBalances[account] : 0;

    txList.forEach(t => {
      if (t.type === 'Income') {
        runningBalance += t.amount;
      } else if (t.type === 'Expense') {
        runningBalance -= t.amount;
      } else if (t.type === 'Transfer') {
        if (t.transferDirection === 'inflow') {
          runningBalance += t.amount;
        } else if (t.transferDirection === 'outflow') {
          runningBalance -= t.amount;
        } else {
          // Fallback inbound/outbound detection
          const isInbound = /received|from\s+|deposit|inbound|credit|refund/i.test(
            `${t.description} ${t.notes} ${t.subcategory}`
          );
          if (isInbound) {
            runningBalance += t.amount;
          } else {
            runningBalance -= t.amount;
          }
        }
      }

      t.accountBalance = Math.round(runningBalance * 100) / 100;
      allProcessed.push(t);
    });
  });

  // Sort chronological descending (newest first) for standard ledger presentation
  return allProcessed.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function findColIndex(headers: string[], regexList: RegExp[], fallbackIndex: number): number {
  // First priority: check if designated schema column position header matches
  if (fallbackIndex < headers.length && headers[fallbackIndex]) {
    for (const r of regexList) {
      if (r.test(headers[fallbackIndex])) return fallbackIndex;
    }
  }

  // Second priority: find by header name across all headers
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (const r of regexList) {
      if (r.test(h)) return i;
    }
  }

  // Default to the schema's defined column index
  return fallbackIndex;
}

/**
 * Exports transaction list to standard A1-J1 CSV matching the user's specification:
 * A1 - Date, B1 - Account, C1 - Category, D1 - Subcategory, E1 - Notes,
 * F1 - Reference (optional), G1 - Type of transaction, H1 - Description,
 * I1 - Amount (transaction value), J1 - Currency.
 */
export function exportTransactionsToCsv(transactions: Transaction[], filename: string = 'financial_ledger.csv') {
  const headers = [
    'Date',
    'Account',
    'Category',
    'Subcategory',
    'Notes',
    'Reference',
    'Type of transaction',
    'Description',
    'Amount',
    'Currency',
  ];

  const rows = transactions.map(t => [
    `"${t.rawDateStr}"`,
    `"${(t.fromAccount || t.account).replace(/"/g, '""')}"`,
    `"${(t.type === 'Transfer' && t.toAccount ? t.toAccount : t.category).replace(/"/g, '""')}"`,
    `"${t.subcategory.replace(/"/g, '""')}"`,
    `"${t.notes.replace(/"/g, '""')}"`,
    '""', // Column F (Reference / Unused)
    `"${t.type}"`,
    `"${t.description.replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    `"${t.currency}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Realistic multi-month sample dataset matching the exact 10-column schema
 */
export function generateSampleDataset(): Transaction[] {
  const sampleRows: Array<{
    dateStr: string;
    account: string;
    category: string;
    subcategory: string;
    notes: string;
    type: TransactionType;
    description: string;
    amount: number;
    currency: string;
    accountBalance: number;
    fromAccount?: string;
    toAccount?: string;
    transferDirection?: 'outflow' | 'inflow';
  }> = [
    {
      dateStr: '14/10/2026 09:14:32',
      account: 'Chase Premier Checking',
      category: 'Food & Dining',
      subcategory: 'Coffee & Breakfast',
      notes: 'Morning team standup meeting',
      type: 'Expense',
      description: 'Blue Bottle Coffee San Francisco #104',
      amount: 18.50,
      currency: 'USD',
      accountBalance: 14820.75,
    },
    {
      dateStr: '13/10/2026 18:45:10',
      account: 'Chase Premier Checking',
      category: 'Groceries',
      subcategory: 'Supermarket',
      notes: 'Weekly pantry & fresh produce restocking',
      type: 'Expense',
      description: 'Whole Foods Market Organic Groceries',
      amount: 142.80,
      currency: 'USD',
      accountBalance: 14839.25,
    },
    {
      dateStr: '12/10/2026 14:20:00',
      account: 'Business Operating',
      category: 'Software & Tech',
      subcategory: 'Cloud Hosting',
      notes: 'Monthly infrastructure tier',
      type: 'Expense',
      description: 'Amazon Web Services Cloud Compute & S3',
      amount: 320.00,
      currency: 'USD',
      accountBalance: 32450.00,
    },
    {
      dateStr: '10/10/2026 11:30:15',
      account: 'Chase Premier Checking',
      category: 'Income',
      subcategory: 'Consulting',
      notes: 'Q3 Enterprise Architecture Deliverable',
      type: 'Income',
      description: 'Direct Deposit Acme Corp Enterprise Advisory',
      amount: 4850.00,
      currency: 'USD',
      accountBalance: 14982.05,
    },
    {
      dateStr: '09/10/2026 16:10:45',
      account: 'Business Operating',
      category: 'Software & Tech',
      subcategory: 'Productivity Tools',
      notes: 'Annual developer licenses',
      type: 'Expense',
      description: 'GitHub Enterprise & Copilot seats',
      amount: 180.00,
      currency: 'USD',
      accountBalance: 32770.00,
    },
    {
      dateStr: '08/10/2026 13:00:00',
      account: 'Chase Premier Checking',
      category: 'Transfer',
      subcategory: 'Savings Transfer',
      notes: 'Automatic monthly high-yield sweep',
      type: 'Transfer',
      description: 'Internal Transfer to Marcus High-Yield Savings',
      amount: 1500.00,
      currency: 'USD',
      accountBalance: 10132.05,
    },
    {
      dateStr: '08/10/2026 13:00:00',
      account: 'Marcus High-Yield Savings',
      category: 'Transfer',
      subcategory: 'Savings Transfer',
      notes: 'Received from Chase Premier Checking',
      type: 'Transfer',
      description: 'Internal Transfer from Chase Checking',
      amount: 1500.00,
      currency: 'USD',
      accountBalance: 68500.00,
    },
    {
      dateStr: '05/10/2026 19:22:18',
      account: 'Amex Platinum Card',
      category: 'Food & Dining',
      subcategory: 'Restaurants',
      notes: 'Client celebration dinner',
      type: 'Expense',
      description: 'The French Laundry Tasting Menu & Wine',
      amount: 485.50,
      currency: 'USD',
      accountBalance: -2140.80,
    },
    {
      dateStr: '04/10/2026 10:05:00',
      account: 'Chase Premier Checking',
      category: 'Housing & Utilities',
      subcategory: 'Electric & Gas',
      notes: 'September utility statement',
      type: 'Expense',
      description: 'Pacific Gas & Electric Utility Bill',
      amount: 165.40,
      currency: 'USD',
      accountBalance: 11632.05,
    },
    {
      dateStr: '01/10/2026 08:00:00',
      account: 'Chase Premier Checking',
      category: 'Housing & Utilities',
      subcategory: 'Rent / Mortgage',
      notes: 'October residential lease installment',
      type: 'Expense',
      description: 'Bay Area Residences Monthly Rent Transfer',
      amount: 2850.00,
      currency: 'USD',
      accountBalance: 11797.45,
    },
    {
      dateStr: '01/10/2026 00:00:01',
      account: 'Chase Premier Checking',
      category: 'Balance Adjustment',
      subcategory: 'Reconciliation',
      notes: 'Quarterly account reconciliation adjustment (excluded from income/expense/cashflow)',
      type: 'Income',
      description: 'Chase Bank Balance Adjustment',
      amount: 150.00,
      currency: 'USD',
      accountBalance: 14647.45,
    },
    {
      dateStr: '30/09/2026 15:30:00',
      account: 'Marcus High-Yield Savings',
      category: 'Income',
      subcategory: 'Interest',
      notes: 'Monthly APY 4.65% yield payout',
      type: 'Income',
      description: 'Marcus by Goldman Sachs Monthly Interest',
      amount: 258.40,
      currency: 'USD',
      accountBalance: 67000.00,
    },
    {
      dateStr: '28/09/2026 17:15:20',
      account: 'Chase Premier Checking',
      category: 'Health & Fitness',
      subcategory: 'Gym Membership',
      notes: 'Monthly premium club dues',
      type: 'Expense',
      description: 'Equinox Fitness Club Membership',
      amount: 280.00,
      currency: 'USD',
      accountBalance: 14647.45,
    },
    {
      dateStr: '26/09/2026 14:00:10',
      account: 'Business Operating',
      category: 'Income',
      subcategory: 'SaaS Subscriptions',
      notes: 'Monthly enterprise customer billings',
      type: 'Income',
      description: 'Stripe Payout: SaaS Monthly Recurring Revenue',
      amount: 8420.00,
      currency: 'USD',
      accountBalance: 32950.00,
    },
    {
      dateStr: '24/09/2026 20:10:00',
      account: 'Chase Premier Checking',
      category: 'Entertainment',
      subcategory: 'Concerts & Events',
      notes: 'Symphony orchestra tickets',
      type: 'Expense',
      description: 'Davies Symphony Hall Box Office',
      amount: 220.00,
      currency: 'USD',
      accountBalance: 14927.45,
    },
    {
      dateStr: '22/09/2026 11:45:00',
      account: 'Amex Platinum Card',
      category: 'Travel & Transport',
      subcategory: 'Rideshare & Taxis',
      notes: 'Airport terminal transit',
      type: 'Expense',
      description: 'Uber Technologies Airport Express ride',
      amount: 54.20,
      currency: 'USD',
      accountBalance: -1655.30,
    },
    {
      dateStr: '20/09/2026 09:30:00',
      account: 'Chase Premier Checking',
      category: 'Groceries',
      subcategory: 'Farmers Market',
      notes: 'Local organic produce & honey',
      type: 'Expense',
      description: 'Ferry Building Farmers Market stall',
      amount: 68.00,
      currency: 'USD',
      accountBalance: 15147.45,
    },
    {
      dateStr: '18/09/2026 15:00:00',
      account: 'Business Operating',
      category: 'Professional Services',
      subcategory: 'Accounting & Legal',
      notes: 'Quarterly tax prep consultation',
      type: 'Expense',
      description: 'KPMG Advisory & Corporate Tax Prep',
      amount: 750.00,
      currency: 'USD',
      accountBalance: 24530.00,
    },
    {
      dateStr: '15/09/2026 10:00:00',
      account: 'Chase Premier Checking',
      category: 'Income',
      subcategory: 'Salary / W2',
      notes: 'Mid-month payroll distribution',
      type: 'Income',
      description: 'Gusto Payroll TechCorp Staff Engineer',
      amount: 5200.00,
      currency: 'USD',
      accountBalance: 15215.45,
    },
    {
      dateStr: '12/09/2026 18:30:00',
      account: 'Amex Platinum Card',
      category: 'Shopping',
      subcategory: 'Electronics',
      notes: 'Noise-canceling headphones for remote work',
      type: 'Expense',
      description: 'Apple Store San Francisco Fifth Ave',
      amount: 549.00,
      currency: 'USD',
      accountBalance: -1601.10,
    },
    {
      dateStr: '10/09/2026 12:15:00',
      account: 'Chase Premier Checking',
      category: 'Food & Dining',
      subcategory: 'Restaurants',
      notes: 'Weekend brunch with family',
      type: 'Expense',
      description: 'Tartine Manufactory Mission District',
      amount: 86.40,
      currency: 'USD',
      accountBalance: 10015.45,
    },
    {
      dateStr: '08/09/2026 14:00:00',
      account: 'Chase Premier Checking',
      fromAccount: 'Chase Premier Checking',
      toAccount: 'Marcus High-Yield Savings',
      category: 'Transfer',
      subcategory: 'Savings Sweep',
      notes: 'Transfer to high yield savings',
      type: 'Transfer',
      transferDirection: 'outflow',
      description: 'Monthly savings sweep to Marcus HYSA',
      amount: 2000.00,
      currency: 'USD',
      accountBalance: 0,
    },
    {
      dateStr: '08/09/2026 14:00:00',
      account: 'Marcus High-Yield Savings',
      fromAccount: 'Chase Premier Checking',
      toAccount: 'Marcus High-Yield Savings',
      category: 'Transfer',
      subcategory: 'Savings Sweep',
      notes: 'Transfer from checking',
      type: 'Transfer',
      transferDirection: 'inflow',
      description: 'Monthly savings sweep from Chase Checking',
      amount: 2000.00,
      currency: 'USD',
      accountBalance: 0,
    },
    {
      dateStr: '05/09/2026 16:40:00',
      account: 'Chase Premier Checking',
      category: 'Housing & Utilities',
      subcategory: 'Internet & Telecom',
      notes: 'Gigabit fiber internet service',
      type: 'Expense',
      description: 'Sonic Fiber Broadband High-Speed ISP',
      amount: 75.00,
      currency: 'USD',
      accountBalance: 12101.85,
    },
    {
      dateStr: '01/09/2026 08:00:00',
      account: 'Chase Premier Checking',
      category: 'Housing & Utilities',
      subcategory: 'Rent / Mortgage',
      notes: 'September residential lease payment',
      type: 'Expense',
      description: 'Bay Area Residences Monthly Rent Transfer',
      amount: 2850.00,
      currency: 'USD',
      accountBalance: 12176.85,
    },
    {
      dateStr: '28/08/2026 19:10:00',
      account: 'Chase Premier Checking',
      category: 'Travel & Transport',
      subcategory: 'Airlines',
      notes: 'Flight tickets for tech conference',
      type: 'Expense',
      description: 'United Airlines SFO to JFK Nonstop Roundtrip',
      amount: 412.60,
      currency: 'USD',
      accountBalance: 15026.85,
    },
    {
      dateStr: '25/08/2026 13:20:00',
      account: 'Chase Premier Checking',
      category: 'Groceries',
      subcategory: 'Supermarket',
      notes: 'Trader Joe weekly restock',
      type: 'Expense',
      description: 'Trader Joes Store #102 Market St',
      amount: 118.30,
      currency: 'USD',
      accountBalance: 15439.45,
    },
    {
      dateStr: '20/08/2026 11:00:00',
      account: 'Business Operating',
      category: 'Software & Tech',
      subcategory: 'AI Infrastructure',
      notes: 'API token batch inference',
      type: 'Expense',
      description: 'Google Cloud Platform Compute & Vertex AI',
      amount: 245.00,
      currency: 'USD',
      accountBalance: 25280.00,
    },
    {
      dateStr: '15/08/2026 10:00:00',
      account: 'Chase Premier Checking',
      category: 'Income',
      subcategory: 'Salary / W2',
      notes: 'August mid-month payroll distribution',
      type: 'Income',
      description: 'Gusto Payroll TechCorp Staff Engineer',
      amount: 5200.00,
      currency: 'USD',
      accountBalance: 15557.75,
    },
    {
      dateStr: '10/08/2026 14:15:00',
      account: 'Chase Premier Checking',
      category: 'Health & Fitness',
      subcategory: 'Pharmacy',
      notes: 'Supplements & prescription refill',
      type: 'Expense',
      description: 'Walgreens Pharmacy #4829',
      amount: 42.15,
      currency: 'USD',
      accountBalance: 10357.75,
    },
    {
      dateStr: '05/08/2026 21:00:00',
      account: 'Amex Platinum Card',
      category: 'Entertainment',
      subcategory: 'Streaming Services',
      notes: 'Monthly 4K family plan bundle',
      type: 'Expense',
      description: 'Netflix & Spotify Premium Family Bundle',
      amount: 38.98,
      currency: 'USD',
      accountBalance: -1052.10,
    },
    {
      dateStr: '01/08/2026 08:00:00',
      account: 'Chase Premier Checking',
      category: 'Housing & Utilities',
      subcategory: 'Rent / Mortgage',
      notes: 'August residential lease installment',
      type: 'Expense',
      description: 'Bay Area Residences Monthly Rent Transfer',
      amount: 2850.00,
      currency: 'USD',
      accountBalance: 10399.90,
    },
  ];

  const rawSampleTx: Transaction[] = sampleRows.map((r, i) => {
    const { date } = parseFinancialDate(r.dateStr);
    return {
      id: `sample-${i + 1}`,
      date,
      rawDateStr: r.dateStr,
      account: r.account,
      category: r.category,
      subcategory: r.subcategory,
      notes: r.notes,
      type: r.type,
      description: r.description,
      amount: r.amount,
      currency: r.currency,
      accountBalance: 0, // Computed below
      fromAccount: r.fromAccount,
      toAccount: r.toAccount,
      transferDirection: r.transferDirection,
    };
  });

  // Calculate the ending balance for each transaction of an individual account dynamically
  return calculateRunningBalancesForAccounts(rawSampleTx, {
    'Chase Premier Checking': 10000,
    'Marcus High-Yield Savings': 65000,
    'Business Operating': 20000,
    'Amex Platinum Card': 0,
  });
}
