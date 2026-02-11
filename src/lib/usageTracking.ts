/**
 * Usage Tracking Library (v2)
 *
 * Tracks LLM API usage for billing and analytics.
 * Uses LLMTrace model for storage (context JSON contains feature/user info).
 */

import prisma from "./prisma";
import { logger } from "@/lib/logger";

// Claude API pricing (per 1M tokens)
const PRICING = {
  "claude-sonnet-4-20250514": {
    input: 3.0,
    output: 15.0,
  },
  "claude-3-5-sonnet-20241022": {
    input: 3.0,
    output: 15.0,
  },
  "claude-3-opus-20240229": {
    input: 15.0,
    output: 75.0,
  },
  "claude-3-haiku-20240307": {
    input: 0.25,
    output: 1.25,
  },
  default: {
    input: 3.0,
    output: 15.0,
  },
} as const;

type ModelKey = keyof typeof PRICING;

export interface UsageData {
  userId?: string | null;
  userEmail?: string | null;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Calculate the estimated cost for a given usage.
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens?: number,
  cacheReadTokens?: number
): number {
  const pricing = PRICING[model as ModelKey] || PRICING.default;

  const nonCachedInputTokens = inputTokens - (cacheCreationTokens || 0) - (cacheReadTokens || 0);
  const baseCost = (Math.max(0, nonCachedInputTokens) / 1_000_000) * pricing.input;
  const cacheWriteCost = ((cacheCreationTokens || 0) / 1_000_000) * pricing.input * 1.25;
  const cacheReadCost = ((cacheReadTokens || 0) / 1_000_000) * pricing.input * 0.1;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return baseCost + cacheWriteCost + cacheReadCost + outputCost;
}

/**
 * Log API usage (records to LLMTrace)
 */
export async function logUsage(data: UsageData): Promise<void> {
  try {
    const estimatedCost = calculateCost(
      data.model,
      data.inputTokens,
      data.outputTokens,
      data.cacheCreationTokens,
      data.cacheReadTokens
    );

    await prisma.lLMTrace.create({
      data: {
        model: data.model,
        provider: "anthropic",
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.inputTokens + data.outputTokens,
        estimatedCost,
        status: "SUCCESS",
        context: {
          feature: data.feature,
          userId: data.userId,
          userEmail: data.userEmail,
          cacheCreationTokens: data.cacheCreationTokens,
          cacheReadTokens: data.cacheReadTokens,
          ...data.metadata,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to log usage", error, { feature: data.feature });
  }
}

/**
 * Get usage summary by feature
 */
export async function getUsageSummary(
  userId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: {
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  // Get all traces and group by feature from context
  const traces = await prisma.lLMTrace.findMany({
    where,
    select: {
      context: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      estimatedCost: true,
    },
  });

  // Group by feature
  const featureMap = new Map<string, {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCost: number;
    callCount: number;
  }>();

  for (const trace of traces) {
    const context = trace.context as Record<string, unknown> | null;
    const feature = (context?.feature as string) || "unknown";

    // If userId filter provided, check context
    if (userId && context?.userId !== userId) continue;

    const existing = featureMap.get(feature) || {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      callCount: 0,
    };

    existing.inputTokens += trace.inputTokens;
    existing.outputTokens += trace.outputTokens;
    existing.totalTokens += trace.totalTokens;
    existing.totalCost += trace.estimatedCost || 0;
    existing.callCount += 1;

    featureMap.set(feature, existing);
  }

  return Array.from(featureMap.entries()).map(([feature, data]) => ({
    feature,
    ...data,
  }));
}

/**
 * Extract usage info from an Anthropic API response
 */
export function extractUsageFromResponse(response: {
  usage?: { input_tokens?: number; output_tokens?: number };
}): { inputTokens: number; outputTokens: number } {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

/**
 * Get daily usage for charts
 */
export async function getDailyUsage(
  userId?: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const traces = await prisma.lLMTrace.findMany({
    where: {
      createdAt: { gte: startDate },
    },
    select: {
      createdAt: true,
      totalTokens: true,
      estimatedCost: true,
      context: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by date
  const dailyMap = new Map<string, { tokens: number; cost: number; calls: number }>();

  for (const trace of traces) {
    // Filter by userId if provided
    if (userId) {
      const context = trace.context as Record<string, unknown> | null;
      if (context?.userId !== userId) continue;
    }

    const dateKey = trace.createdAt.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) || { tokens: 0, cost: 0, calls: 0 };
    existing.tokens += trace.totalTokens;
    existing.cost += trace.estimatedCost || 0;
    existing.calls += 1;
    dailyMap.set(dateKey, existing);
  }

  // Fill in missing days
  const result: Array<{ date: string; tokens: number; cost: number; calls: number }> = [];
  const current = new Date(startDate);
  const today = new Date();

  while (current <= today) {
    const dateKey = current.toISOString().split("T")[0];
    const data = dailyMap.get(dateKey) || { tokens: 0, cost: 0, calls: 0 };
    result.push({ date: dateKey, ...data });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Get recent API calls for display
 */
export async function getRecentCalls(
  userId?: string,
  limit: number = 50
) {
  const traces = await prisma.lLMTrace.findMany({
    select: {
      id: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      estimatedCost: true,
      createdAt: true,
      context: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit * 2, // Fetch extra to account for filtering
  });

  // Filter by userId if provided and map to response format
  const calls = traces
    .filter((trace) => {
      if (!userId) return true;
      const context = trace.context as Record<string, unknown> | null;
      return context?.userId === userId;
    })
    .slice(0, limit)
    .map((trace) => {
      const context = trace.context as Record<string, unknown> | null;
      return {
        id: trace.id,
        feature: (context?.feature as string) || "unknown",
        model: trace.model,
        inputTokens: trace.inputTokens,
        outputTokens: trace.outputTokens,
        totalTokens: trace.totalTokens,
        estimatedCost: trace.estimatedCost || 0,
        createdAt: trace.createdAt.toISOString(),
        userEmail: (context?.userEmail as string | undefined) || undefined,
      };
    });

  return calls;
}
