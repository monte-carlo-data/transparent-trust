/**
 * Anthropic Prompt Caching Utilities
 *
 * Implements prompt caching for Anthropic API calls to reduce costs.
 * - Cache writes cost 1.25x base input price
 * - Cache reads cost 0.1x base input price (90% savings!)
 * - Cache lasts ~5 minutes between requests
 *
 * Minimum cacheable tokens:
 * - Sonnet/Opus: 1,024 tokens
 * - Haiku: 2,048 tokens
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */

/**
 * A text block that can optionally have cache control.
 */
export type CacheableTextBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

/**
 * System content can be a string (no caching) or array of blocks (with caching).
 */
export type SystemContent = string | CacheableTextBlock[];

/**
 * Minimum token thresholds for caching to be effective.
 */
export const CACHE_TOKEN_THRESHOLDS = {
  /** Minimum tokens for Sonnet and Opus models */
  SONNET_OPUS: 1024,
  /** Minimum tokens for Haiku model */
  HAIKU: 2048,
} as const;

/**
 * Estimate token count from text.
 * Uses ~4 characters per token as a rough approximation for English text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Check if a model is Haiku (requires higher token threshold for caching).
 */
export function isHaikuModel(model: string): boolean {
  return model.toLowerCase().includes("haiku");
}

/**
 * Get the minimum token threshold for caching based on model.
 */
export function getCacheThreshold(model: string): number {
  return isHaikuModel(model)
    ? CACHE_TOKEN_THRESHOLDS.HAIKU
    : CACHE_TOKEN_THRESHOLDS.SONNET_OPUS;
}

/**
 * Options for building cacheable system content.
 */
export type CacheableSystemOptions = {
  /**
   * Stable content that should be cached.
   * This typically includes: base system prompt, knowledge context (skills, documents),
   * customer profiles, and other reference data that doesn't change between requests.
   */
  cachedContent: string;

  /**
   * Dynamic content that should NOT be cached.
   * This typically includes: user-specific instructions, conversation history references,
   * call mode overrides, and other per-request customizations.
   * If empty/undefined, only the cached block is returned.
   */
  dynamicContent?: string;

  /**
   * The model being used (affects caching threshold).
   * Defaults to assuming Sonnet/Opus threshold (1024 tokens).
   */
  model?: string;

  /**
   * Force caching even if below token threshold.
   * Use with caution - caching small content wastes the 1.25x write cost.
   */
  forceCaching?: boolean;
};

/**
 * Build system content with caching support.
 *
 * If the cached content exceeds the minimum token threshold, returns an array
 * of text blocks with cache_control on the stable content. Otherwise, returns
 * a plain string (no caching overhead for small prompts).
 *
 * @example
 * ```typescript
 * const system = buildCacheableSystem({
 *   cachedContent: basePrompt + skillsContext + customerContext,
 *   dynamicContent: userInstructions + callModeOverride,
 *   model: "claude-sonnet-4-20250514",
 * });
 *
 * const response = await anthropic.messages.create({
 *   model,
 *   system, // TypeScript knows this is string | CacheableTextBlock[]
 *   messages: [...],
 * });
 * ```
 */
export function buildCacheableSystem(options: CacheableSystemOptions): SystemContent {
  const { cachedContent, dynamicContent, model = "", forceCaching = false } = options;

  // If no cached content, just return dynamic content as string
  if (!cachedContent?.trim()) {
    return dynamicContent?.trim() || "";
  }

  // Check if cached content meets minimum threshold
  const estimatedTokens = estimateTokens(cachedContent);
  const threshold = getCacheThreshold(model);

  // If below threshold and not forcing, return as plain string (no caching)
  if (!forceCaching && estimatedTokens < threshold) {
    const combined = dynamicContent?.trim()
      ? `${cachedContent}\n\n${dynamicContent}`
      : cachedContent;
    return combined;
  }

  // Build array of text blocks with caching
  const blocks: CacheableTextBlock[] = [
    {
      type: "text",
      text: cachedContent,
      cache_control: { type: "ephemeral" },
    },
  ];

  // Add dynamic content block if present (without cache_control)
  if (dynamicContent?.trim()) {
    blocks.push({
      type: "text",
      text: dynamicContent,
    });
  }

  return blocks;
}

/**
 * Extract cache metrics from Anthropic API response usage.
 * Returns null values if cache metrics aren't present (caching not used or not available).
 */
export function extractCacheMetrics(usage: {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
} | undefined): {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  cacheHitRate: number | null;
} {
  if (!usage) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: null,
      cacheReadTokens: null,
      cacheHitRate: null,
    };
  }

  const cacheCreation = usage.cache_creation_input_tokens ?? null;
  const cacheRead = usage.cache_read_input_tokens ?? null;

  // Calculate cache hit rate if we have cache metrics
  let cacheHitRate: number | null = null;
  if (cacheCreation !== null || cacheRead !== null) {
    const totalCached = (cacheCreation ?? 0) + (cacheRead ?? 0);
    if (totalCached > 0) {
      cacheHitRate = ((cacheRead ?? 0) / totalCached) * 100;
    }
  }

  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheCreationTokens: cacheCreation,
    cacheReadTokens: cacheRead,
    cacheHitRate,
  };
}

/**
 * Format cache metrics for logging.
 */
export function formatCacheMetrics(metrics: ReturnType<typeof extractCacheMetrics>): string {
  const parts = [
    `input: ${metrics.inputTokens}`,
    `output: ${metrics.outputTokens}`,
  ];

  if (metrics.cacheCreationTokens !== null) {
    parts.push(`cache_write: ${metrics.cacheCreationTokens}`);
  }
  if (metrics.cacheReadTokens !== null) {
    parts.push(`cache_read: ${metrics.cacheReadTokens}`);
  }
  if (metrics.cacheHitRate !== null) {
    parts.push(`hit_rate: ${metrics.cacheHitRate.toFixed(1)}%`);
  }

  return parts.join(", ");
}
