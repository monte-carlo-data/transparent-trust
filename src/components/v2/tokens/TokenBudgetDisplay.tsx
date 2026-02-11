'use client';

import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTokenCount, getTokenUsageStatus } from '@/lib/tokenUtils';

export interface TokenBudgetBreakdown {
  fileContextTokens: number;
  skillsTokens: number;
  questionsTokens: number;
  totalTokens: number;
  maxTokens: number;
}

interface TokenBudgetDisplayProps {
  breakdown: TokenBudgetBreakdown;
  compact?: boolean;
  className?: string;
  /** Optional label for the cluster/context */
  label?: string;
}

/**
 * Reusable token budget display showing breakdown and progress bar.
 * Uses color coding: green (safe), yellow (high), red (critical).
 */
export function TokenBudgetDisplay({
  breakdown,
  compact = false,
  className,
  label,
}: TokenBudgetDisplayProps) {
  const { fileContextTokens, skillsTokens, questionsTokens, totalTokens, maxTokens } = breakdown;
  const { usagePercent, isHigh, isCritical } = getTokenUsageStatus(totalTokens, maxTokens);

  const barColor = isCritical
    ? 'bg-red-500'
    : isHigh
      ? 'bg-yellow-500'
      : 'bg-green-500';

  const textColor = isCritical
    ? 'text-red-600 dark:text-red-400'
    : isHigh
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-green-600 dark:text-green-400';

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all', barColor)}
            style={{ width: `${Math.min(100, usagePercent)}%` }}
          />
        </div>
        <span className={cn('text-xs font-medium whitespace-nowrap', textColor)}>
          {formatTokenCount(totalTokens)} / {formatTokenCount(maxTokens)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </div>
      )}

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">File Context</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatTokenCount(fileContextTokens)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">Skills</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatTokenCount(skillsTokens)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">Questions</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatTokenCount(questionsTokens)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all', barColor)}
            style={{ width: `${Math.min(100, usagePercent)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={cn('font-medium', textColor)}>
            {formatTokenCount(totalTokens)} / {formatTokenCount(maxTokens)}
          </span>
          <span className={textColor}>{usagePercent}%</span>
        </div>
      </div>

      {/* Warning if approaching limit */}
      {isCritical && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Approaching token limit - consider reducing skills</span>
        </div>
      )}
    </div>
  );
}
