'use client';

import { createContext, useContext, useCallback, useMemo, useState, ReactNode } from 'react';
import type { TokenCostEntry, TokenSummary, TokenBudget } from './types';

interface TokenRegistryContextValue {
  /** Register a token cost entry */
  register: (entry: TokenCostEntry) => void;
  /** Unregister a token cost entry */
  unregister: (id: string) => void;
  /** Update an existing entry */
  update: (id: string, tokens: number) => void;
  /** Get current summary */
  summary: TokenSummary;
  /** Optional budget tracking */
  budget?: TokenBudget;
}

const TokenRegistryContext = createContext<TokenRegistryContextValue | null>(null);

interface TokenRegistryProviderProps {
  children: ReactNode;
  /** Optional budget configuration */
  budget?: TokenBudget;
}

export function TokenRegistryProvider({ children, budget }: TokenRegistryProviderProps) {
  const [entries, setEntries] = useState<Map<string, TokenCostEntry>>(new Map());

  const register = useCallback((entry: TokenCostEntry) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(entry.id, entry);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const update = useCallback((id: string, tokens: number) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) {
        next.set(id, { ...existing, tokens: Math.max(0, tokens) });
      }
      return next;
    });
  }, []);

  const summary = useMemo((): TokenSummary => {
    const entriesArray = Array.from(entries.values());
    const total = entriesArray.reduce((sum, e) => sum + Math.max(0, e.tokens), 0);
    const byType: Record<TokenCostEntry['type'], number> = {
      source: 0,
      skill: 0,
      prompt: 0,
      system: 0,
      output: 0,
      custom: 0,
    };

    entriesArray.forEach((entry) => {
      byType[entry.type] += Math.max(0, entry.tokens);
    });

    return { total, byType, entries: entriesArray, count: entriesArray.length };
  }, [entries]);

  const value = useMemo(
    () => ({ register, unregister, update, summary, budget }),
    [register, unregister, update, summary, budget]
  );

  return (
    <TokenRegistryContext.Provider value={value}>
      {children}
    </TokenRegistryContext.Provider>
  );
}

export function useTokenRegistry() {
  const context = useContext(TokenRegistryContext);
  if (!context) {
    throw new Error('useTokenRegistry must be used within TokenRegistryProvider');
  }
  return context;
}
