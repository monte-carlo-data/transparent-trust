'use client';

import { cn } from '@/lib/utils';
import { formatTokenCount, getModelLimits, OUTPUT_ESTIMATES } from '@/lib/tokenUtils';
import type { ModelSpeed } from '@/lib/config';

interface TokenBudgetDisplayProps {
  /** Actual token count for system prompt (from prompt assembly) */
  systemPromptTokens: number;
  /** Total tokens for selected skills */
  skillsTokens: number;
  /** Number of skills selected */
  skillCount: number;
  /** Total tokens for questions in this batch */
  questionsTokens: number;
  /** Number of questions in this batch */
  questionCount: number;
  /** Model speed determines limits */
  modelSpeed?: ModelSpeed;
  /** Optional className for styling */
  className?: string;
}

/**
 * Displays token budget for both input and output constraints.
 * Shows actual calculated values - nothing hardcoded.
 */
export function TokenBudgetDisplay({
  systemPromptTokens,
  skillsTokens,
  skillCount,
  questionsTokens,
  questionCount,
  modelSpeed = 'quality',
  className,
}: TokenBudgetDisplayProps) {
  const limits = getModelLimits(modelSpeed);

  // Calculate input budget
  const totalInputTokens = systemPromptTokens + skillsTokens + questionsTokens;
  const inputPercentUsed = Math.round((totalInputTokens / limits.inputContext) * 100);
  const isInputOverBudget = totalInputTokens > limits.inputContext;

  // Estimate output budget
  const estimatedOutputTokens = questionCount * OUTPUT_ESTIMATES.TOKENS_PER_ANSWER;
  const outputPercentUsed = Math.round((estimatedOutputTokens / limits.outputMax) * 100);
  const isOutputOverBudget = estimatedOutputTokens > limits.outputMax;

  return (
    <div className={cn('space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg', className)}>
      {/* Input Budget */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Input Budget per Batch
          </span>
          <span className={cn(
            'text-sm font-medium',
            isInputOverBudget ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'
          )}>
            {formatTokenCount(totalInputTokens)} / {formatTokenCount(limits.inputContext)}
          </span>
        </div>

        {/* Input progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
          <div
            className={cn(
              'h-2 rounded-full transition-all',
              isInputOverBudget ? 'bg-red-500' : inputPercentUsed > 70 ? 'bg-yellow-500' : 'bg-blue-500'
            )}
            style={{ width: `${Math.min(inputPercentUsed, 100)}%` }}
          />
        </div>

        {/* Input breakdown */}
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>System prompt:</span>
            <span>{formatTokenCount(systemPromptTokens)}</span>
          </div>
          <div className="flex justify-between">
            <span>{skillCount} skill{skillCount !== 1 ? 's' : ''}:</span>
            <span>{formatTokenCount(skillsTokens)}</span>
          </div>
          <div className="flex justify-between">
            <span>{questionCount} question{questionCount !== 1 ? 's' : ''}:</span>
            <span>{formatTokenCount(questionsTokens)}</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700" />

      {/* Output Budget */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Output Budget per Batch
            <span className="text-xs text-gray-500 ml-1">(estimate)</span>
          </span>
          <span className={cn(
            'text-sm font-medium',
            isOutputOverBudget ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'
          )}>
            ~{formatTokenCount(estimatedOutputTokens)} / {formatTokenCount(limits.outputMax)}
          </span>
        </div>

        {/* Output progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
          <div
            className={cn(
              'h-2 rounded-full transition-all',
              isOutputOverBudget ? 'bg-red-500' : outputPercentUsed > 70 ? 'bg-yellow-500' : 'bg-green-500'
            )}
            style={{ width: `${Math.min(outputPercentUsed, 100)}%` }}
          />
        </div>

        {/* Output breakdown */}
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>{questionCount} answer{questionCount !== 1 ? 's' : ''} @ ~{OUTPUT_ESTIMATES.TOKENS_PER_ANSWER} tokens:</span>
            <span>~{formatTokenCount(estimatedOutputTokens)}</span>
          </div>
        </div>
      </div>

      {/* Warning if over budget */}
      {(isInputOverBudget || isOutputOverBudget) && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          {isInputOverBudget && <p>Input context exceeds limit. Reduce skills or batch size.</p>}
          {isOutputOverBudget && <p>Estimated output exceeds limit. Reduce batch size.</p>}
        </div>
      )}
    </div>
  );
}
