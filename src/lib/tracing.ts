/**
 * LLM Tracing Library (v2)
 *
 * Captures every LLM call with full context for observability.
 * Uses a simplified schema with JSON context field for flexibility.
 */

import { randomUUID } from "crypto";
import { createHash } from "crypto";
import prisma from "./prisma";
import { logger } from "./logger";
import { calculateCost } from "./usageTracking";

export type TraceContext = {
  traceId: string;
  sessionId?: string;
  feature: string;
  spanName: string;
  parentTraceId?: string;
  userId?: string;
  userEmail?: string;
};

export type TraceInput = {
  model: string;
  provider?: string;
  systemPrompt?: string;
  userMessage?: string;
  skills?: { id: string; title: string }[];
};

export type TraceOutput = {
  response?: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
};

export type EntityLink = {
  questionHistoryId?: string;
  bulkRowId?: string;
  chatSessionId?: string;
  blockId?: string;
};

/**
 * Generate a new trace ID (UUID v4)
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * Create a hash of the prompt for deduplication/grouping
 */
export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

/**
 * Start a new trace context
 */
export function startTrace(
  spanName: string,
  feature: string,
  options?: {
    sessionId?: string;
    parentTraceId?: string;
    userId?: string;
    userEmail?: string;
  }
): TraceContext {
  return {
    traceId: generateTraceId(),
    sessionId: options?.sessionId,
    feature,
    spanName,
    parentTraceId: options?.parentTraceId,
    userId: options?.userId,
    userEmail: options?.userEmail,
  };
}

/**
 * Record a completed LLM trace to the database
 */
export async function recordTrace(
  context: TraceContext,
  input: TraceInput,
  output: TraceOutput,
  latencyMs: number,
  entityLink?: EntityLink,
  status: "SUCCESS" | "ERROR" | "TIMEOUT" = "SUCCESS",
  errorMessage?: string
): Promise<string> {
  try {
    // Calculate cost if not provided
    const estimatedCost = output.estimatedCost ?? calculateCost(
      input.model,
      output.inputTokens,
      output.outputTokens,
      output.cacheCreationTokens,
      output.cacheReadTokens
    );

    const trace = await prisma.lLMTrace.create({
      data: {
        traceId: context.traceId,
        sessionId: context.sessionId,
        model: input.model,
        provider: input.provider ?? "anthropic",
        inputTokens: output.inputTokens,
        outputTokens: output.outputTokens,
        totalTokens: output.inputTokens + output.outputTokens,
        estimatedCost,
        latencyMs,
        status,
        errorMessage,
        context: {
          feature: context.feature,
          spanName: context.spanName,
          parentTraceId: context.parentTraceId,
          userId: context.userId,
          userEmail: context.userEmail,
          promptHash: input.systemPrompt ? hashPrompt(input.systemPrompt) : null,
          skills: input.skills,
          entityLink,
          cacheCreationTokens: output.cacheCreationTokens,
          cacheReadTokens: output.cacheReadTokens,
          response: output.response?.slice(0, 1000), // Truncate for storage
        },
      },
    });

    logger.info("LLM trace recorded", {
      traceId: context.traceId,
      feature: context.feature,
      spanName: context.spanName,
      latencyMs,
      inputTokens: output.inputTokens,
      outputTokens: output.outputTokens,
    });

    return trace.traceId ?? context.traceId;
  } catch (error) {
    // Log but don't throw - tracing shouldn't break the main flow
    logger.error("Failed to record LLM trace", error, {
      traceId: context.traceId,
      feature: context.feature,
    });
    return context.traceId;
  }
}

/**
 * High-level wrapper to trace an LLM call
 */
export async function withTracing<T extends { usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } }>(
  context: TraceContext,
  input: TraceInput,
  llmCall: () => Promise<T>,
  options?: {
    extractResponse?: (result: T) => string;
    entityLink?: EntityLink;
  }
): Promise<{ result: T; traceId: string }> {
  const startTime = Date.now();

  try {
    const result = await llmCall();
    const latencyMs = Date.now() - startTime;

    const output: TraceOutput = {
      response: options?.extractResponse?.(result),
      inputTokens: result.usage?.input_tokens ?? 0,
      outputTokens: result.usage?.output_tokens ?? 0,
      cacheCreationTokens: result.usage?.cache_creation_input_tokens,
      cacheReadTokens: result.usage?.cache_read_input_tokens,
    };

    const traceId = await recordTrace(context, input, output, latencyMs, options?.entityLink);

    return { result, traceId };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    await recordTrace(
      context,
      input,
      { inputTokens: 0, outputTokens: 0 },
      latencyMs,
      options?.entityLink,
      "ERROR",
      error instanceof Error ? error.message : String(error)
    );

    throw error;
  }
}
