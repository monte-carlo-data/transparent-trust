/**
 * Token estimation utilities for LLM context management.
 * Uses rough approximations suitable for UI display - not exact tokenization.
 */

import type { ModelSpeed } from './config';

/**
 * Estimate token count from text.
 * Uses ~4 characters per token as a rough approximation for English text.
 * This is intentionally conservative to avoid underestimating.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Format token count for display.
 * Shows "12.5k" for large numbers, raw number for small.
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Calculate token usage percentage and status.
 */
export function getTokenUsageStatus(
  usedTokens: number,
  maxTokens: number
): {
  usagePercent: number;
  isHigh: boolean;
  isCritical: boolean;
} {
  const usagePercent = Math.min(100, Math.round((usedTokens / maxTokens) * 100));
  return {
    usagePercent,
    isHigh: usagePercent > 70,
    isCritical: usagePercent > 90,
  };
}

/**
 * Model-specific token limits.
 * Context window is 200k for both models, we use 180k with safety margin.
 * Output is capped at 16k to avoid long-running operations (see config.ts).
 *
 * Safety margin accounts for:
 * - Token estimation inaccuracies (~4 chars/token is approximate)
 * - System overhead and hidden tokens
 * - Response formatting overhead
 */
export const MODEL_LIMITS = {
  quality: {
    inputContext: 180000,
    outputMax: 16384,
  },
  fast: {
    inputContext: 180000,
    outputMax: 16384,
  },
} as const;

/** Maximum file context tokens to prevent blowing the budget */
export const MAX_FILE_CONTEXT_TOKENS = 50000;

/**
 * Get token limits for a given model speed.
 */
export function getModelLimits(speed: ModelSpeed = 'quality') {
  return MODEL_LIMITS[speed];
}

/**
 * Estimation constants for output tokens.
 * These are estimates since we can't know exact output size ahead of time.
 */
export const OUTPUT_ESTIMATES = {
  /** Estimated tokens per RFP answer (response + confidence + sources + reasoning) */
  TOKENS_PER_ANSWER: 400,
} as const;

/**
 * Legacy token limits for backward compatibility.
 * @deprecated Use MODEL_LIMITS and getModelLimits() instead
 */
export const TOKEN_LIMITS = {
  /** Practical limit for chat conversations */
  CHAT_MAX: 100000,
  /** Threshold for showing compact button (history tokens) */
  COMPACT_THRESHOLD: 5000,
  /** Estimate per document when content not loaded */
  DOC_ESTIMATE: 2000,
  /** Estimate per customer profile */
  CUSTOMER_ESTIMATE: 500,
  /** Base system prompt estimate */
  SYSTEM_PROMPT_BASE: 500,
  /** @deprecated Use MODEL_LIMITS.quality.inputContext instead */
  QUALITY_MODEL_MAX: 200000,
  /** @deprecated Use MODEL_LIMITS.fast.inputContext instead */
  FAST_MODEL_MAX: 80000,
} as const;
