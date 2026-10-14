import { Transaction, TimeframeUnit, PeriodInfo } from '../types/finance';

/**
 * Generates an ascending list of selectable period buckets for a given timeframe unit
 * based on the transactions present in the ledger.
 */
export function getPeriodsForTimeframe(
  transactions: Transaction[],
  unit: TimeframeUnit
): PeriodInfo[] {
  if (transactions.length === 0) {
    const now = new Date();
    return [{
      unit,
      key: 'empty',
      label: 'No Data',
      start: now,
      end: now,
      scaleFactor: 1.0,
    }];
  }

  // Find overall min and max dates
  const timestamps = transactions.map(t => t.date.getTime()).filter(t => !isNaN(t));
  const minDate = new Date(Math.min(...timestamps));
  const maxDate = new Date(Math.max(...timestamps));

  if (unit === 'all') {
    // Span in months
    const startYear = minDate.getFullYear();
    const startMonth = minDate.getMonth();
    const endYear = maxDate.getFullYear();
    const endMonth = maxDate.getMonth();
    const monthsSpan = Math.max(1, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);

    const start = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0, 0);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59, 999);

    const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const label = `All Recorded Data (${minDate.toLocaleDateString('en-US', opt)} - ${maxDate.toLocaleDateString('en-US', opt)})`;

    return [{
      unit: 'all',
      key: 'all',
      label,
      start,
      end,
      scaleFactor: monthsSpan,
    }];
  }

  if (unit === 'yearly') {
    const years = Array.from(new Set(transactions.map(t => t.date.getFullYear()))).sort((a, b) => a - b);
    return years.map(y => {
      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      return {
        unit: 'yearly',
        key: String(y),
        label: `Year ${y}`,
        start,
        end,
        scaleFactor: 12.0,
      };
    });
  }

  if (unit === 'monthly') {
    const monthKeys = new Set<string>();
    transactions.forEach(t => {
      const y = t.date.getFullYear();
      const m = (t.date.getMonth() + 1).toString().padStart(2, '0');
      monthKeys.add(`${y}-${m}`);
    });

    const sortedMonthKeys = Array.from(monthKeys).sort();
    return sortedMonthKeys.map(key => {
      const [yStr, mStr] = key.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;

      const start = new Date(y, m, 1, 0, 0, 0, 0);
      // Last day of month
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      return {
        unit: 'monthly',
        key,
        label,
        start,
        end,
        scaleFactor: 1.0,
      };
    });
  }

  if (unit === 'weekly') {
    const weekMap = new Map<string, { start: Date; end: Date; label: string }>();

    transactions.forEach(t => {
      // Find Monday of the transaction's week
      const d = new Date(t.date);
      const day = d.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day; // day 0 is Sunday
      const monday = new Date(d);
      monday.setDate(d.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const key = `${monday.getFullYear()}-${(monday.getMonth() + 1).toString().padStart(2, '0')}-${monday.getDate().toString().padStart(2, '0')}`;

      if (!weekMap.has(key)) {
        const monStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const sunStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        weekMap.set(key, {
          start: monday,
          end: sunday,
          label: `${monStr} – ${sunStr}`,
        });
      }
    });

    const sortedKeys = Array.from(weekMap.keys()).sort();
    return sortedKeys.map(key => {
      const w = weekMap.get(key)!;
      return {
        unit: 'weekly',
        key,
        label: w.label,
        start: w.start,
        end: w.end,
        scaleFactor: 7 / 30.416, // Proportional weekly limit
      };
    });
  }

  if (unit === 'daily') {
    const dayKeys = new Set<string>();
    transactions.forEach(t => {
      const y = t.date.getFullYear();
      const m = (t.date.getMonth() + 1).toString().padStart(2, '0');
      const d = t.date.getDate().toString().padStart(2, '0');
      dayKeys.add(`${y}-${m}-${d}`);
    });

    const sortedDayKeys = Array.from(dayKeys).sort();
    return sortedDayKeys.map(key => {
      const [y, m, d] = key.split('-').map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0, 0);
      const end = new Date(y, m - 1, d, 23, 59, 59, 999);
      const label = start.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      return {
        unit: 'daily',
        key,
        label,
        start,
        end,
        scaleFactor: 1 / 30.416, // Proportional daily limit
      };
    });
  }

  if (unit === 'custom') {
    return [createCustomPeriod('', '', minDate, maxDate)];
  }

  return [];
}

/**
 * Creates a PeriodInfo for an arbitrary custom date range [startDateStr, endDateStr].
 */
export function createCustomPeriod(
  startDateStr: string,
  endDateStr: string,
  fallbackMinDate?: Date,
  fallbackMaxDate?: Date
): PeriodInfo {
  let start: Date;
  let end: Date;

  if (startDateStr) {
    const [y, m, d] = startDateStr.split('-').map(Number);
    start = new Date(y, m - 1, d, 0, 0, 0, 0);
  } else if (fallbackMinDate) {
    start = new Date(fallbackMinDate.getFullYear(), fallbackMinDate.getMonth(), fallbackMinDate.getDate(), 0, 0, 0, 0);
  } else {
    start = new Date();
    start.setDate(start.getDate() - 30);
  }

  if (endDateStr) {
    const [y, m, d] = endDateStr.split('-').map(Number);
    end = new Date(y, m - 1, d, 23, 59, 59, 999);
  } else if (fallbackMaxDate) {
    end = new Date(fallbackMaxDate.getFullYear(), fallbackMaxDate.getMonth(), fallbackMaxDate.getDate(), 23, 59, 59, 999);
  } else {
    end = new Date();
  }

  // Ensure start <= end
  if (start.getTime() > end.getTime()) {
    const temp = start;
    start = new Date(end.getTime());
    start.setHours(0, 0, 0, 0);
    end = new Date(temp.getTime());
    end.setHours(23, 59, 59, 999);
  }

  const durationMs = end.getTime() - start.getTime();
  const durationDays = Math.max(1, Math.round(durationMs / (86400 * 1000)));
  const scaleFactor = durationDays / 30.416;

  const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const label = `Custom: ${start.toLocaleDateString('en-US', opt)} – ${end.toLocaleDateString('en-US', opt)} (${durationDays}d)`;

  return {
    unit: 'custom',
    key: `custom_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}`,
    label,
    start,
    end,
    scaleFactor,
  };
}

/**
 * Filters a transaction list to only include rows falling within the specified period.
 */
export function filterTransactionsByPeriod(
  transactions: Transaction[],
  period: PeriodInfo
): Transaction[] {
  if (period.unit === 'all') return transactions;
  const startTs = period.start.getTime();
  const endTs = period.end.getTime();

  return transactions.filter(t => {
    const ts = t.date.getTime();
    return ts >= startTs && ts <= endTs;
  });
}
