/**
 * Token Registry Types
 *
 * Core types for the bottom-up token counting architecture.
 * Components register their token costs, parents aggregate them.
 */

/**
 * Token cost entry for a single item (source, skill, prompt block, etc.)
 */
export interface TokenCostEntry {
  /** Unique ID for this entry (source ID, skill ID, block ID, etc.) */
  id: string;
  /** Display label */
  label: string;
  /** Estimated token count */
  tokens: number;
  /** Item type for categorization */
  type: 'source' | 'skill' | 'prompt' | 'system' | 'output' | 'custom';
  /** Optional metadata for display/debugging */
  metadata?: {
    charCount?: number;
    estimationMethod?: 'charCount' | 'exact' | 'preset';
    [key: string]: unknown;
  };
}

/**
 * Aggregated token summary
 */
export interface TokenSummary {
  /** Total tokens across all entries */
  total: number;
  /** Breakdown by type */
  byType: Record<TokenCostEntry['type'], number>;
  /** Individual entries */
  entries: TokenCostEntry[];
  /** Number of registered entries */
  count: number;
}

/**
 * Token budget context (optional, for budget tracking)
 */
export interface TokenBudget {
  /** Maximum allowed tokens */
  max: number;
  /** Reserved tokens (system prompt, output, etc.) */
  reserved: number;
  /** Available tokens for user-selected items */
  available: number;
}

/**
 * Budget status derived from summary and budget
 */
export interface TokenBudgetStatus {
  /** Tokens used */
  used: number;
  /** Available budget */
  available: number;
  /** Usage percentage (0-100+) */
  percent: number;
  /** Whether budget is exceeded */
  isOverBudget: boolean;
  /** Remaining tokens (negative if over budget) */
  remaining: number;
}
