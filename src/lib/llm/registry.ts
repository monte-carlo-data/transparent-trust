/**
 * LLM Call Registry
 *
 * Central registry for all LLM calls. This is the ONLY path through which
 * LLM calls should be made. All LLM interactions route through this registry
 * to ensure prompt consistency and transparency.
 *
 * This enforces the architecture pattern:
 * 1. All prompts come from the prompt admin system (DB or coreBlocks)
 * 2. No hardcoded prompts or silent fallbacks
 * 3. Runtime modifications are explicit blocks
 * 4. Failures bubble up immediately (no catch-and-hide)
 */

import { resolveBlocks } from "@/lib/prompts/prompt-service";
import { answerQuestionWithPrompt as _answerQuestionWithPrompt } from "@/lib/llm";
import type { TracingOptions, ModelSpeed, UsageInfo } from "@/lib/llm";
import { allCompositions } from "@/lib/v2/prompts/compositions";
import { callModeBlock, userInstructionsBlock } from "@/lib/v2/prompts/blocks/runtime-blocks";
import type { PromptComposition } from "@/lib/v2/prompts/types";

// Registry of all compositions - imported from single source of truth
const COMPOSITIONS_BY_ID = new Map<string, PromptComposition>(
  allCompositions.map((c) => [c.context, c])
);

export interface ExecuteLLMCallParams {
  // Core inputs
  question: string;
  compositionId: string; // Maps to composition context (e.g., "chat_response", "rfp_single", "rfp_batch")

  // Context that affects prompt assembly
  runtimeContext?: {
    callMode?: boolean;
    userInstructions?: string;
  };

  // Skills/reference material
  skills?: { title: string; content: string; id?: string }[];
  fallbackContent?: Array<{ title: string; url: string; content: string }>;

  // Execution options
  modelSpeed?: ModelSpeed;
  tracingOptions?: TracingOptions;
}

export interface ExecuteLLMCallResult {
  answer: string;
  usage?: UsageInfo;
  traceId?: string;
  transparency: {
    systemPrompt: string;
    compositionId: string;
    blockIds: string[];
    runtimeBlockIds: string[];
    runtimeContext?: ExecuteLLMCallParams['runtimeContext'];
    assembledAt: string;
  };
}

/**
 * Assemble the final system prompt from composition + runtime context
 * Exported for use by batch processing functions
 */
export async function assembleSystemPrompt(
  compositionId: string,
  runtimeContext?: ExecuteLLMCallParams['runtimeContext']
): Promise<{ prompt: string; blockIds: string[]; runtimeBlockIds: string[] }> {
  // Look up the composition
  const composition = COMPOSITIONS_BY_ID.get(compositionId);
  if (!composition) {
    throw new Error(
      `Unknown composition: "${compositionId}". Available: ${Array.from(COMPOSITIONS_BY_ID.keys()).join(", ")}`
    );
  }

  // Collect block IDs to resolve
  const allBlockIds = [...composition.blockIds];
  const runtimeBlockIds: string[] = [];

  // Add runtime blocks based on context
  if (runtimeContext?.callMode) {
    allBlockIds.push(callModeBlock.id);
    runtimeBlockIds.push(callModeBlock.id);
  }

  if (runtimeContext?.userInstructions) {
    allBlockIds.push(userInstructionsBlock.id);
    runtimeBlockIds.push(userInstructionsBlock.id);
  }

  // Resolve all blocks (handles DB overrides)
  const blocks = await resolveBlocks(allBlockIds);

  // Assemble the prompt
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.content.trim()) {
      parts.push(`## ${block.name}\n\n${block.content}`);
    }
  }

  // Special handling for user instructions
  if (runtimeContext?.userInstructions && parts.length > 0) {
    // Insert user instructions right before the last block for prominence
    const lastPart = parts.pop();
    if (lastPart) {
      parts.push(
        `## User Instructions\n\n${runtimeContext.userInstructions}`,
        lastPart
      );
    }
  }

  const systemPrompt = parts.join('\n\n');

  return {
    prompt: systemPrompt,
    blockIds: composition.blockIds,
    runtimeBlockIds,
  };
}

/**
 * Central LLM call execution function
 * This is the ONLY function that should call the LLM.
 *
 * Enforces:
 * - All prompts come from the prompt system
 * - No silent fallbacks
 * - Failures bubble up
 * - Transparency of what prompt was assembled
 */
export async function executeLLMCall(
  params: ExecuteLLMCallParams
): Promise<ExecuteLLMCallResult> {
  const {
    question,
    compositionId,
    runtimeContext,
    skills,
    fallbackContent,
    modelSpeed = "quality",
    tracingOptions,
  } = params;

  // Build the prompt from the prompt system
  // This will throw if composition doesn't exist (no silent fallbacks)
  const { prompt: systemPrompt, blockIds, runtimeBlockIds } = await assembleSystemPrompt(
    compositionId,
    runtimeContext
  );

  // Execute the LLM call
  const result = await _answerQuestionWithPrompt(
    question,
    systemPrompt,
    skills,
    fallbackContent,
    modelSpeed,
    tracingOptions
  );

  return {
    answer: result.answer,
    usage: result.usage,
    traceId: result.traceId,
    transparency: {
      systemPrompt,
      compositionId,
      blockIds,
      runtimeBlockIds,
      runtimeContext,
      assembledAt: new Date().toISOString(),
    },
  };
}
