'use client';

import { useEffect, useMemo } from 'react';
import { useTokenRegistry } from './TokenRegistryContext';
import { estimateTokens } from '@/lib/tokenUtils';
import type { TokenCostEntry } from './types';

interface UseTokenCostOptions {
  /** Item ID (must be stable) */
  id: string;
  /** Display label */
  label: string;
  /** Item type */
  type: TokenCostEntry['type'];
  /** Content to estimate tokens from */
  content?: string;
  /** Character count (if content not available) */
  charCount?: number;
  /** Explicit token count (bypasses estimation) */
  tokens?: number;
  /** Whether to register (allows conditional registration) */
  enabled?: boolean;
}

/**
 * Register a token cost entry in the nearest TokenRegistryProvider.
 * Automatically registers on mount, updates on change, and unregisters on unmount.
 */
export function useTokenCost(options: UseTokenCostOptions) {
  const { register, unregister, update } = useTokenRegistry();
  const { id, label, type, content, charCount, tokens: explicitTokens, enabled = true } = options;

  const estimatedTokens = useMemo(() => {
    if (explicitTokens !== undefined) return Math.max(0, explicitTokens);
    if (content) return estimateTokens(content);
    if (charCount) return estimateTokens('a'.repeat(charCount));
    return 0;
  }, [content, charCount, explicitTokens]);

  useEffect(() => {
    if (!enabled) return;

    const entry: TokenCostEntry = {
      id,
      label,
      type,
      tokens: estimatedTokens,
      metadata: {
        charCount: content?.length ?? charCount,
        estimationMethod: explicitTokens !== undefined ? 'exact' : 'charCount',
      },
    };

    register(entry);

    return () => {
      unregister(id);
    };
  }, [id, label, type, estimatedTokens, enabled, register, unregister, content, charCount, explicitTokens]);

  // Update tokens if they change (without re-registering)
  useEffect(() => {
    if (enabled) {
      update(id, estimatedTokens);
    }
  }, [estimatedTokens, id, enabled, update]);

  return { tokens: estimatedTokens };
}
