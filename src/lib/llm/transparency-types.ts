/**
 * Unified types for LLM transparency throughout the application.
 * Provides consistent structures for both Chat and RFP transparency needs.
 */

/**
 * Input Transparency: What we sent to the LLM
 * Shows the prompt composition, context, and resources used
 */
export interface InputTransparencyData {
  // Composition and structure
  compositionId: string;
  blockIds: string[];
  runtimeBlockIds: string[];
  runtimeContext?: {
    callMode?: boolean;
    userInstructions?: string;
  };

  // The assembled system prompt
  systemPrompt: string;

  // Context and resource metrics
  contextLoad?: ContextLoadMetrics;

  // Metadata
  assembledAt: string;
  model?: string;
  traceId?: string;
}

/**
 * Output Transparency: What the LLM showed us about its reasoning
 * Only present for structured outputs (RFP/questionnaires)
 * Chat responses are typically unstructured and don't have this data
 */
export interface OutputTransparencyData {
  confidence?: string; // "High", "Medium", "Low"
  reasoning?: string;
  inference?: string;
  remarks?: string;
  sources?: string[] | string;
}

/**
 * Context Load Metrics: Resource utilization and efficiency
 * Shown in UI to help users understand token usage and cache effectiveness
 */
export interface ContextLoadMetrics {
  skillCount: number;
  tokenCount?: number;
  utilizationPercent: number;
  suggestedBatchSize?: number;
  cacheStatus?: "hit" | "miss" | "partial";
}

/**
 * Complete Transparency Package: Both input and output together
 * Used when both dimensions are available (RFP structured responses)
 */
export interface TransparencyPackage {
  input: InputTransparencyData;
  output?: OutputTransparencyData;
}

/**
 * Legacy compatibility type from use-chat-session.ts
 * Being phased out in favor of InputTransparencyData
 */
export interface LegacyTransparency {
  systemPrompt: string;
  model: string;
  blocksUsed?: Array<{
    id: string;
    title: string;
    content: string;
    libraryId: string;
    blockType: string;
    entryType: string;
  }>;
}
