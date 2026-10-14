import { Transaction, FinancialAnomaly, AnomalySeverity } from '../types/finance';
import { formatCurrency, isBalanceAdjustment } from './analytics';

export type SensitivityLevel = 'low' | 'medium' | 'high';

/**
 * Detects financial anomalies including individual transaction outliers,
 * category spending velocity surges, duplicate charges, and balance drains.
 */
export function detectFinancialAnomalies(
  periodTransactions: Transaction[],
  fullTransactions: Transaction[],
  sensitivity: SensitivityLevel = 'medium'
): FinancialAnomaly[] {
  if (fullTransactions.length === 0) return [];

  const anomalies: FinancialAnomaly[] = [];

  // Multiplier thresholds based on sensitivity
  const multiplierThresholds = {
    low: 3.5,     // Only extreme outliers
    medium: 2.2,  // Standard balanced
    high: 1.6,    // Sensitive detection
  };

  const minMultiplier = multiplierThresholds[sensitivity];

  // 1. COMPUTE HISTORICAL STATS PER CATEGORY (from full transactions, excluding balance adjustments)
  const categoryStats = new Map<string, {
    count: number;
    amounts: number[];
    mean: number;
    median: number;
    stdDev: number;
  }>();

  fullTransactions
    .filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category))
    .forEach(t => {
      const cat = t.category || 'Uncategorized';
      if (!categoryStats.has(cat)) {
        categoryStats.set(cat, { count: 0, amounts: [], mean: 0, median: 0, stdDev: 0 });
      }
      categoryStats.get(cat)!.amounts.push(t.amount);
    });

  categoryStats.forEach((stats) => {
    stats.count = stats.amounts.length;
    stats.amounts.sort((a, b) => a - b);

    const sum = stats.amounts.reduce((a, b) => a + b, 0);
    stats.mean = sum / stats.count;

    const mid = Math.floor(stats.count / 2);
    stats.median = stats.count % 2 !== 0 ? stats.amounts[mid] : (stats.amounts[mid - 1] + stats.amounts[mid]) / 2;

    const variance = stats.amounts.reduce((acc, val) => acc + Math.pow(val - stats.mean, 2), 0) / Math.max(1, stats.count);
    stats.stdDev = Math.sqrt(variance);
  });

  // 2. DETECT OUTLIER AMOUNTS IN PERIOD TRANSACTIONS (excluding balance adjustments)
  periodTransactions
    .filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category))
    .forEach(t => {
      const cat = t.category || 'Uncategorized';
      const stats = categoryStats.get(cat);
      if (!stats || stats.count < 2) return;

      const baseline = stats.median > 0 ? stats.median : stats.mean;
      if (baseline <= 0) return;

      const multiplier = t.amount / baseline;

      if (multiplier >= minMultiplier) {
        const deviationPercent = ((t.amount - baseline) / baseline) * 100;
        let severity: AnomalySeverity = 'low';
        if (multiplier >= 3.5) severity = 'high';
        else if (multiplier >= 2.2) severity = 'medium';

        anomalies.push({
          id: `anomaly-outlier-${t.id}`,
          transactionId: t.id,
          transaction: t,
          type: 'outlier_amount',
          severity,
          title: `Unusual Spike in ${t.category}`,
          category: t.category,
          account: t.account,
          date: t.date,
          rawDateStr: t.rawDateStr,
          amount: t.amount,
          expectedAmount: baseline,
          deviationPercent,
          deviationMultiplier: multiplier,
          reason: `Amount of ${formatCurrency(t.amount, t.currency)} is ${multiplier.toFixed(1)}x higher than typical ${t.category} spending (historical median: ${formatCurrency(baseline, t.currency)}).`,
          currency: t.currency,
        });
      }
    });

  // 3. DETECT POTENTIAL DUPLICATE / REPEAT CHARGES (within 48 hours with identical amount & account)
  const sortedTx = [...periodTransactions]
    .filter(t => !isBalanceAdjustment(t.category))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  for (let i = 0; i < sortedTx.length; i++) {
    for (let j = i + 1; j < sortedTx.length; j++) {
      const t1 = sortedTx[i];
      const t2 = sortedTx[j];
      const timeDiffHours = Math.abs(t2.date.getTime() - t1.date.getTime()) / (1000 * 60 * 60);

      if (timeDiffHours > 48) break; // Beyond 48 hours window

      if (
        t1.type === 'Expense' &&
        t2.type === 'Expense' &&
        t1.account === t2.account &&
        Math.abs(t1.amount - t2.amount) < 0.01 &&
        (t1.description.toLowerCase() === t2.description.toLowerCase() || t1.category === t2.category)
      ) {
        anomalies.push({
          id: `anomaly-dup-${t1.id}-${t2.id}`,
          transactionId: t2.id,
          transaction: t2,
          type: 'potential_duplicate',
          severity: 'medium',
          title: `Potential Duplicate Charge: ${t2.description || t2.category}`,
          category: t2.category,
          account: t2.account,
          date: t2.date,
          rawDateStr: t2.rawDateStr,
          amount: t2.amount,
          expectedAmount: 0,
          deviationPercent: 100,
          deviationMultiplier: 2.0,
          reason: `Identical charge of ${formatCurrency(t2.amount, t2.currency)} detected twice within ${timeDiffHours.toFixed(0)} hours on "${t1.account}". Check for unintentional recurring billings.`,
          currency: t2.currency,
        });
      }
    }
  }

  // 4. DETECT HEAVY BALANCE DRAINS (single outlay exceeding 25% of account balance, excluding balance adjustments)
  periodTransactions
    .filter(t => t.type === 'Expense' && !isBalanceAdjustment(t.category))
    .forEach(t => {
      if (t.accountBalance > 0 && t.amount > t.accountBalance * 0.3) {
        // Only add if not already flagged as outlier
        const alreadyFlagged = anomalies.some(a => a.transactionId === t.id && a.type === 'balance_drain');
        if (!alreadyFlagged) {
          const drainPercent = (t.amount / (t.accountBalance + t.amount)) * 100;
          anomalies.push({
            id: `anomaly-drain-${t.id}`,
            transactionId: t.id,
            transaction: t,
            type: 'balance_drain',
            severity: 'high',
            title: `Significant Account Liquidity Drain`,
            category: t.category,
            account: t.account,
            date: t.date,
            rawDateStr: t.rawDateStr,
            amount: t.amount,
            expectedAmount: t.accountBalance * 0.1,
            deviationPercent: drainPercent,
            deviationMultiplier: t.amount / (t.accountBalance * 0.1),
            reason: `Outlay of ${formatCurrency(t.amount, t.currency)} consumed ${drainPercent.toFixed(0)}% of "${t.account}" funds in a single transaction.`,
            currency: t.currency,
          });
        }
      }
    });

  // Sort anomalies: High severity first, then by largest dollar amount
  return anomalies.sort((a, b) => {
    const severityWeight = { high: 3, medium: 2, low: 1 };
    if (severityWeight[b.severity] !== severityWeight[a.severity]) {
      return severityWeight[b.severity] - severityWeight[a.severity];
    }
    return b.amount - a.amount;
  });
}
