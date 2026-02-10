'use client';

import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTokenCount } from '@/lib/tokenUtils';
import { useTokenRegistry } from '@/lib/v2/tokens/TokenRegistryContext';

interface TokenSummaryProps {
  /** Show detailed breakdown */
  showBreakdown?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Display aggregated token summary from TokenRegistryProvider.
 * Shows total, budget status (if configured), and optional breakdown.
 */
export default function TokenSummary({ showBreakdown = false, className }: TokenSummaryProps) {
  const { summary, budget } = useTokenRegistry();

  const budgetStatus = budget
    ? {
        used: summary.total,
        available: budget.available,
        percent: Math.min(100, Math.round((summary.total / budget.available) * 100)),
        isOverBudget: summary.total > budget.available,
      }
    : null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Total Summary */}
      <div
        className={cn(
          'p-4 rounded-lg border',
          budgetStatus?.isOverBudget
            ? 'bg-red-50 border-red-200'
            : budgetStatus && budgetStatus.percent > 80
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200'
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <h4
            className={cn(
              'font-medium',
              budgetStatus?.isOverBudget
                ? 'text-red-900'
                : budgetStatus && budgetStatus.percent > 80
                  ? 'text-amber-900'
                  : 'text-green-900'
            )}
          >
            {budgetStatus ? 'Token Budget' : 'Total Tokens'}
          </h4>
          {budgetStatus?.isOverBudget ? (
            <AlertCircle className="w-5 h-5 text-red-600" />
          ) : budgetStatus && budgetStatus.percent > 80 ? (
            <Info className="w-5 h-5 text-amber-600" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-600" />
          )}
        </div>

        {budgetStatus ? (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span
                className={
                  budgetStatus.isOverBudget
                    ? 'text-red-800'
                    : budgetStatus.percent > 80
                      ? 'text-amber-800'
                      : 'text-green-800'
                }
              >
                Used: ~{formatTokenCount(budgetStatus.used)} tokens
              </span>
              <span
                className={
                  budgetStatus.isOverBudget
                    ? 'text-red-700'
                    : budgetStatus.percent > 80
                      ? 'text-amber-700'
                      : 'text-green-700'
                }
              >
                of {formatTokenCount(budgetStatus.available)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={cn(
                  'h-2 rounded-full transition-all',
                  budgetStatus.isOverBudget
                    ? 'bg-red-500'
                    : budgetStatus.percent > 80
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                )}
                style={{ width: `${Math.min(budgetStatus.percent, 100)}%` }}
              />
            </div>
            {budgetStatus.isOverBudget && (
              <p className="text-xs text-red-700 mt-2 font-medium">
                ⚠️ Exceeds budget by {formatTokenCount(budgetStatus.used - budgetStatus.available)}{' '}
                tokens
              </p>
            )}
            {!budgetStatus.isOverBudget && (
              <p className="text-xs text-green-700 mt-2">
                ✓ {formatTokenCount(budgetStatus.available - budgetStatus.used)} tokens remaining
              </p>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-700">~{formatTokenCount(summary.total)} tokens total</div>
        )}
      </div>

      {/* Breakdown (optional) */}
      {showBreakdown && summary.entries.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h5 className="text-sm font-medium text-gray-700">Token Breakdown</h5>
          </div>
          <div className="divide-y divide-gray-200">
            {summary.entries.map((entry) => (
              <div key={entry.id} className="px-4 py-2 flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate" title={entry.label}>
                  {entry.label}
                </span>
                <span className="text-gray-600 ml-2">~{formatTokenCount(entry.tokens)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
