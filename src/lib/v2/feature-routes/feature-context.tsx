'use client';

/**
 * Generic Feature Context Factory
 *
 * Creates context providers and hooks for feature pages with route-based tabs.
 * Model after library-context.tsx pattern but generalized for any feature.
 *
 * Used by RFPs, Contracts, and other feature pages to share data across tabs.
 */

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Base context value interface
 * Feature-specific contexts should extend this
 */
export interface FeatureContextValue {
  userId: string;
  userEmail: string | null;
}

/**
 * Factory function to create a typed context + provider + hook
 *
 * Usage:
 * ```typescript
 * interface RFPContextValue extends FeatureContextValue {
 *   // Add RFP-specific fields
 * }
 *
 * const { Provider: RFPProvider, useContext: useRFPContext } =
 *   createFeatureContext<RFPContextValue>('RFP');
 * ```
 */
export function createFeatureContext<T extends FeatureContextValue>(featureName: string) {
  const Context = createContext<T | null>(null);

  function Provider({
    value,
    children,
  }: {
    value: T;
    children: ReactNode;
  }) {
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useFeatureContext(): T {
    const context = useContext(Context);
    if (!context) {
      throw new Error(
        `use${featureName}Context must be used within ${featureName}Provider`
      );
    }
    return context;
  }

  return {
    Provider,
    useContext: useFeatureContext,
  };
}
