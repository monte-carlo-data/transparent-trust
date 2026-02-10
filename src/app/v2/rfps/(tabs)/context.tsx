'use client';

/**
 * RFP Context
 *
 * Provides shared data across all RFP tabs (ask, projects, history, dashboard).
 * Uses the generic feature-context factory pattern.
 */

import { createFeatureContext, type FeatureContextValue } from '@/lib/v2/feature-routes';

// RFP context currently uses base FeatureContextValue
// Add RFP-specific fields here when needed
export type RFPContextValue = FeatureContextValue;

const { Provider, useContext: useRFPContext } = createFeatureContext<RFPContextValue>('RFP');

export { Provider as RFPProvider, useRFPContext };
