import { answerQuestionsBatch } from "@/lib/llm";
import { executeLLMCall, assembleSystemPrompt } from "@/lib/llm/registry"; // Registry for single questions + batch orchestration
import { getActiveBlocksForContext, getScopeIndex } from "@/lib/v2/blocks";
import { selectSkillsForQuestions as selectSkillsWithUnifiedService } from "./skill-selection-service";
import { getCustomerSkills } from "@/lib/v2/customers/customer-service";
import prisma from "@/lib/prisma";
import type { LibraryId } from "@/types/v2";
import type {
  QuestionOutput,
  ProcessQuestionParams,
  ProcessQuestionBatchParams,
  ContextFitResult,
  EstimateContextFitParams,
} from "./types";

// Context window limits (input + output combined)
const CONTEXT_WINDOW_TOKENS = 200000;
const BUFFER_TOKENS = 10000; // Reserve for response overhead
const LLM_TIMEOUT_MS = 120000; // 120 second timeout for LLM calls (increased for batches)

// Batch size is constrained by OUTPUT tokens, not input context
// With max_tokens=16384 and ~600 tokens per answer, max is ~27 questions
// We cap at 20 for safety margin and consistent quality
export const MAX_BATCH_SIZE = 20;

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}
// RFP prompts now come from the prompt system, not hardcoded

// Map friendly library names to LibraryIds
const LIBRARY_NAME_MAP: Record<string, LibraryId> = {
  'skills': 'knowledge',
  'knowledge': 'knowledge',
  'it': 'it',
  'it-skills': 'it',
  'gtm': 'gtm',
};

/**
 * Normalize library name to LibraryId
 */
function normalizeLibraryId(library: string): LibraryId {
  return LIBRARY_NAME_MAP[library.toLowerCase()] || 'knowledge';
}


/**
 * Process a single question with BuildingBlocks.
 * Uses LLM-based skill selection (unified service) for accurate semantic matching.
 */
export async function processQuestion(
  params: ProcessQuestionParams
): Promise<QuestionOutput> {
  const {
    question,
    context,
    library,
    categories,
    customerId,
    modelSpeed,
  } = params;

  // Normalize library name
  const libraryId = normalizeLibraryId(library);
  let blocks;

  // Prepare full question (with context if provided)
  let fullQuestion = question;
  if (context) {
    fullQuestion = `Context: ${context}\n\nQuestion: ${question}`;
  }

  // Use unified skill selection service
  if (!categories?.length) {
    // LLM-based skill selection (semantic matching)
    const scopeIndex = await getScopeIndex([libraryId]);
    const selectionResult = await selectSkillsWithUnifiedService({
      questions: [fullQuestion],
      scopeIndex,
      libraryId,
      mode: 'execute',
      options: { maxSkills: 5 },
    });

    if (selectionResult.mode !== 'execute') {
      throw new Error('Unexpected result mode from skill selection');
    }

    const selectedIds = selectionResult.selectedSkills.map(s => s.skillId);
    blocks = await prisma.buildingBlock.findMany({
      where: {
        id: { in: selectedIds },
        status: 'ACTIVE',
      },
    });

    console.log(`[LLM Skill Selection] Selected ${blocks.length} skills for single question`, {
      selectedCount: selectionResult.selectedSkills.length,
      skills: selectionResult.selectedSkills.map(s => ({ id: s.skillId, title: s.title, confidence: s.confidence })),
    });
  } else {
    // Legacy: Category-based selection if explicitly provided
    blocks = await getActiveBlocksForContext(
      [libraryId],
      {
        limit: 30,
        categories,
      }
    );
    console.log(`[Category Filter] Loaded ${blocks.length} skills for single question`);
  }

  // Fetch customer-specific skills if customerId is provided
  let customerBlocks: typeof blocks = [];
  if (customerId) {
    const allCustomerSkills = await getCustomerSkills(customerId);
    // Limit to 10 most recent customer skills to avoid overwhelming context
    customerBlocks = allCustomerSkills.slice(0, 10);
    console.log(`[Customer Skills] Loaded ${customerBlocks.length} customer-specific skills for customer ${customerId}`);
  }

  // Convert blocks to skills format (combine library and customer skills)
  const allBlocks = [...blocks, ...customerBlocks];
  const skills = allBlocks.map((block) => ({
    title: block.title,
    content: block.content,
  }));

  // Process with LLM via registry (single question uses rfp_single composition)
  const result = await withTimeout(
    executeLLMCall({
      question: fullQuestion,
      compositionId: "rfp_single",
      skills,
      modelSpeed,
    }),
    LLM_TIMEOUT_MS
  );

  // Parse the JSON response
  // Handle various LLM output formats:
  // 1. Pure JSON
  // 2. JSON wrapped in ```json ... ``` fences
  // 3. Markdown text followed by JSON in fences (defense-in-depth)
  let jsonText = result.answer.trim();

  // First, try to extract JSON from markdown code fences anywhere in the response
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  }

  // If still not valid JSON, try to find a JSON object directly
  if (!jsonText.startsWith('{') && !jsonText.startsWith('[')) {
    const jsonObjectMatch = jsonText.match(/(\{[\s\S]*\})\s*$/);
    if (jsonObjectMatch) {
      jsonText = jsonObjectMatch[1].trim();
    }
  }

  let parsedResponse;
  try {
    parsedResponse = JSON.parse(jsonText);
  } catch {
    throw new Error(`Failed to parse RFP response as JSON: ${result.answer.substring(0, 500)}...`);
  }

  return {
    response: parsedResponse.response,
    confidence: parsedResponse.confidence,
    sources: parsedResponse.sources,
    reasoning: parsedResponse.reasoning,
    inference: parsedResponse.inference,
    remarks: parsedResponse.remarks,
    tokensUsed: result.usage
      ? result.usage.inputTokens + result.usage.outputTokens
      : undefined,
    transparency: {
      systemPrompt: result.transparency.systemPrompt,
      compositionId: result.transparency.compositionId,
      blockIds: result.transparency.blockIds,
      runtimeBlockIds: result.transparency.runtimeBlockIds,
      assembledAt: result.transparency.assembledAt,
    },
  };
}

/**
 * Estimate context fit for questions - with scope-based selection awareness
 */
export async function estimateContextFit(
  params: EstimateContextFitParams
): Promise<ContextFitResult> {
  const { questionCount, library, categories, approvedSkillIds, fileContextTokens } = params;
  const availableTokens = CONTEXT_WINDOW_TOKENS - BUFFER_TOKENS;

  // Normalize library name and get blocks for estimation
  const libraryId = normalizeLibraryId(library);

  // Calculate skill tokens based on what we have
  let skillTokens = 0;
  let skillCount = 0;

  if (approvedSkillIds?.length) {
    // Use actual approved skills for accurate estimation
    const blocks = await prisma.buildingBlock.findMany({
      where: {
        id: { in: approvedSkillIds },
        status: 'ACTIVE',
      },
      select: { content: true },
    });
    skillCount = blocks.length;
    const skillContent = blocks.map((b) => b.content).join("\n");
    skillTokens = Math.ceil(skillContent.length / 4);
  } else if (categories?.length) {
    // Category-based estimate: fetch blocks matching selected categories
    const blocks = await getActiveBlocksForContext([libraryId], {
      limit: 50,
      categories,
    });
    skillCount = blocks.length;
    const skillContent = blocks.map((b) => b.content).join("\n");
    skillTokens = Math.ceil(skillContent.length / 4);
  } else {
    // New: Scope-based estimate
    // Sample estimate: average skill is ~3K tokens, assume 5-8 will be selected
    // This is more optimistic than category-based (which loads 30+)
    const scopeIndex = await getScopeIndex([libraryId]);

    // For estimation: assume ~3000 tokens per selected skill
    // Default maxSkills is 10, but typically 5-8 are selected
    const estimatedSelectedSkills = Math.min(8, scopeIndex.length);
    const avgTokensPerSkill = 3000;
    skillTokens = estimatedSelectedSkills * avgTokensPerSkill;
    skillCount = estimatedSelectedSkills;
  }

  // Estimate token usage with detailed breakdown
  const questionTokens = questionCount * 50; // ~50 tokens per question
  const fileContextTokensEstimate = fileContextTokens || 0;
  // System prompt overhead: ~2000 tokens for RFP batch prompt (role, instructions, schema)
  const systemPromptTokens = 2000;
  const totalTokens = skillTokens + questionTokens + fileContextTokensEstimate + systemPromptTokens;
  const fits = totalTokens <= availableTokens;

  // Batch size is constrained by OUTPUT tokens (max_tokens=16384), not input context
  // With ~600 tokens per answer, max is ~27 questions, we cap at 20 for safety
  const suggestedBatchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, questionCount));

  return {
    fits,
    skillCount,
    skillTokens, // Legacy field
    totalTokens,
    maxTokens: CONTEXT_WINDOW_TOKENS,
    availableTokens,
    utilizationPercent: Math.min(100, Math.round((totalTokens / CONTEXT_WINDOW_TOKENS) * 100)),
    suggestedBatchSize,
    // Detailed breakdown for UI transparency
    breakdown: {
      skillTokens,
      questionTokens,
      fileContextTokens: fileContextTokensEstimate,
      systemPromptTokens,
    },
  };
}

/**
 * Process a batch of questions
 */
export async function processQuestionBatch(
  params: ProcessQuestionBatchParams
): Promise<QuestionOutput[]> {
  const {
    questions,
    library,
    categories,
    modelSpeed,
    batchSize: _batchSize,
  } = params;
  void _batchSize; // Future: use for batch processing optimization

  // Normalize library name and get blocks
  const libraryId = normalizeLibraryId(library);
  const blocks = await getActiveBlocksForContext(
    [libraryId],
    {
      limit: 30,
      categories,
    }
  );

  // Convert blocks to skills
  const skills = blocks.map((block) => ({
    title: block.title,
    content: block.content,
  }));

  // Prepare questions for batch
  const preparedQuestions = questions.map((q, index) => {
    let questionText = q.question;
    if (q.context) {
      questionText = `Context: ${q.context}\n\nQuestion: ${questionText}`;
    }
    return {
      index: index + 1,
      question: questionText,
    };
  });

  // Fetch the assembled system prompt from registry
  const { prompt: systemPrompt, blockIds: promptBlockIds, runtimeBlockIds } = await assembleSystemPrompt("rfp_batch");

  // Process batch (via registry - no hardcoded prompts)
  const result = await withTimeout(
    answerQuestionsBatch(
      preparedQuestions,
      "rfp_batch", // Fetch from prompt registry
      skills,
      undefined,
      modelSpeed
    ),
    LLM_TIMEOUT_MS
  );

  // Return answers mapped directly from batch result
  return result.answers.map((answer) => ({
    response: answer.response,
    confidence: answer.confidence,
    sources: answer.sources,
    reasoning: answer.reasoning,
    inference: answer.inference,
    remarks: answer.remarks,
    tokensUsed: result.usage
      ? result.usage.inputTokens + result.usage.outputTokens
      : undefined,
    transparency: {
      systemPrompt,
      compositionId: "rfp_batch",
      blockIds: promptBlockIds,
      runtimeBlockIds,
      assembledAt: new Date().toISOString(),
    },
  }));
}

/**
 * Process a batch of questions with scope-based skill selection.
 * This is the new approach that selects only relevant skills based on question content.
 */
export interface ProcessQuestionBatchWithScopeParams {
  questions: Array<{ id?: string; question: string; context?: string }>;
  library: string;
  modelSpeed?: 'fast' | 'quality';
  batchSize?: number;  // Number of questions to process per LLM call
  // Scope-based selection options
  autoSelectSkills?: boolean;
  minScopeScore?: number;
  maxSkills?: number;
  // Legacy category filter (still supported)
  categories?: string[];
  // Pre-approved skill IDs (from skill preview approval)
  approvedSkillIds?: string[];
  // File context (full file content for additional context)
  fileContext?: string;
}

export async function processQuestionBatchWithScope(
  params: ProcessQuestionBatchWithScopeParams
): Promise<QuestionOutput[]> {
  const {
    questions,
    library,
    modelSpeed = 'quality',
    batchSize = MAX_BATCH_SIZE,
    autoSelectSkills = true,
    minScopeScore: _minScopeScore = 0.1, // eslint-disable-line @typescript-eslint/no-unused-vars
    maxSkills = 10,
    categories,
    approvedSkillIds,
    fileContext,
  } = params;

  const libraryId = normalizeLibraryId(library);
  let blocks;

  if (approvedSkillIds && approvedSkillIds.length > 0) {
    // Use pre-approved skill IDs from skill preview approval
    blocks = await prisma.buildingBlock.findMany({
      where: {
        id: { in: approvedSkillIds },
        status: 'ACTIVE',
      },
    });
    console.log(`[Pre-Approved Skills] Loaded ${blocks.length} approved skills`);
  } else if (autoSelectSkills && !categories?.length) {
    // NEW: LLM-based skill selection via unified service
    const scopeIndex = await getScopeIndex([libraryId]);
    const questionTexts = questions.map(q => q.question);

    const selectionResult = await selectSkillsWithUnifiedService({
      questions: questionTexts,
      scopeIndex,
      libraryId,
      mode: 'execute',
      options: { maxSkills },
    });

    if (selectionResult.mode !== 'execute') {
      throw new Error('Unexpected result mode from skill selection');
    }

    // Load only the selected skills
    const selectedIds = selectionResult.selectedSkills.map(s => s.skillId);
    blocks = await prisma.buildingBlock.findMany({
      where: {
        id: { in: selectedIds },
        status: 'ACTIVE',
      },
    });

    console.log(`[LLM Skill Selection] Selected ${blocks.length} skills for batch`, {
      selectedCount: selectionResult.selectedSkills.length,
      skills: selectionResult.selectedSkills.map(s => ({ id: s.skillId, title: s.title, confidence: s.confidence })),
    });
  } else {
    // Category-based filtering
    blocks = await getActiveBlocksForContext([libraryId], {
      limit: 30,
      categories,
    });
  }

  // Rest of processing is the same
  const skills = blocks.map(block => ({
    title: block.title,
    content: block.content,
  }));

  const preparedQuestions = questions.map((q, index) => {
    let questionText = q.question;
    if (q.context) {
      questionText = `Context: ${q.context}\n\nQuestion: ${questionText}`;
    }
    return {
      index: index + 1,
      question: questionText,
    };
  });

  // Fetch the assembled system prompt from registry (once for all batches)
  const { prompt: systemPrompt, blockIds: promptBlockIds, runtimeBlockIds } = await assembleSystemPrompt("rfp_batch");

  // Process in batches to avoid timeouts on large question sets
  const effectiveBatchSize = Math.min(batchSize, 20); // Cap at 20 max
  const allAnswers: QuestionOutput[] = [];

  console.log(`[Batch Processing] Processing ${preparedQuestions.length} questions in batches of ${effectiveBatchSize}`);

  for (let i = 0; i < preparedQuestions.length; i += effectiveBatchSize) {
    const batch = preparedQuestions.slice(i, i + effectiveBatchSize);
    const batchNum = Math.floor(i / effectiveBatchSize) + 1;
    const totalBatches = Math.ceil(preparedQuestions.length / effectiveBatchSize);

    console.log(`[Batch Processing] Processing batch ${batchNum}/${totalBatches} (${batch.length} questions)`);

    // Use registry for batch processing (uses rfp_batch composition)
    const result = await withTimeout(
      answerQuestionsBatch(
        batch,
        "rfp_batch", // Fetch from prompt registry (no hardcoded prompts)
        skills,
        undefined,
        modelSpeed,
        fileContext
      ),
      LLM_TIMEOUT_MS
    );

    // Map answers from this batch
    const batchAnswers = result.answers.map(answer => ({
      response: answer.response,
      confidence: answer.confidence,
      sources: answer.sources,
      reasoning: answer.reasoning,
      inference: answer.inference,
      remarks: answer.remarks,
      tokensUsed: result.usage
        ? Math.round((result.usage.inputTokens + result.usage.outputTokens) / batch.length)
        : undefined,
      transparency: {
        systemPrompt,
        compositionId: "rfp_batch",
        blockIds: promptBlockIds,
        runtimeBlockIds,
        assembledAt: new Date().toISOString(),
      },
    }));

    allAnswers.push(...batchAnswers);

    console.log(`[Batch Processing] Completed batch ${batchNum}/${totalBatches}, total answers: ${allAnswers.length}`);
  }

  return allAnswers;
}
