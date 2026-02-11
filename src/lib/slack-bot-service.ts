/**
 * Reusable Slack Bot Service
 *
 * Provides bot answer generation for any knowledge library (IT, Skills, GTM, etc)
 * Uses the V2 prompt composition system (core-blocks) for prompts.
 * Prompts can be edited in Admin > Prompts page.
 */

import { prisma } from "./prisma";
import { getAnthropicClient } from "./apiHelpers";
import { CLAUDE_MODEL } from "./config";
import { slackBotCompositions } from "./v2/prompts/compositions/slack-bot-compositions";
import { getBlocks } from "./v2/prompts/blocks/core-blocks";
import { throwCompositionNotFound, throwNoBlocksFound } from "./v2/prompts/errors";
import { type ThreadContext } from "./slack/thread-context";
import { rerankSkills } from "./slack/skill-reranker";
import { getScopeIndex } from "./v2/blocks/block-service";
import { selectSkillsForQuestions } from "./v2/questions/skill-selection-service";
import { logUsage } from "./usageTracking";
import type { LibraryId } from "@/types/v2";

export interface BotAnswer {
  answer: string;
  confidence: string;
  skillsUsed: Array<{
    id: string;
    title: string;
    sourceUrls?: string[];
    reason?: string;         // Why this skill was selected
    confidence?: 'high' | 'medium' | 'low';  // Selection confidence
  }>;
  skillsSearched: number;
  skillSelectionMethod: 'llm_semantic' | 'rerank_thread' | 'keyword'; // How skills were selected
  inputTokens?: number;
  outputTokens?: number;
  contextWarning?: string;
  transparency?: {
    systemPrompt: string;
    compositionId: string;
    blockIds: string[];
  };
}

// Explicitly define bot library type to match SLACK_BOT_LIBRARIES constant
export type BotLibraryId = 'knowledge' | 'it' | 'gtm' | 'talent';

interface LibraryConfig {
  libraryId: BotLibraryId;
  label: string;
  compositionContext: string; // Maps to slackBotCompositions context
}

const LIBRARY_CONFIGS = {
  it: {
    libraryId: "it",
    label: "IT",
    compositionContext: "slack_bot_it",
  },
  knowledge: {
    libraryId: "knowledge",
    label: "Skills",
    compositionContext: "slack_bot_knowledge",
  },
  gtm: {
    libraryId: "gtm",
    label: "GTM",
    compositionContext: "slack_bot_gtm",
  },
  talent: {
    libraryId: "talent",
    label: "Talent Acquisition",
    compositionContext: "slack_bot_talent",
  },
} as const satisfies Record<BotLibraryId, LibraryConfig>;

interface BuiltBotPrompt {
  systemPrompt: string;
  compositionId: string;
  blockIds: string[];
}

/**
 * Build the system prompt from the V2 prompt composition system.
 * This reads from core-blocks.ts which can be edited in Admin > Prompts.
 * Returns prompt with transparency metadata.
 */
function buildSystemPrompt(libraryId: BotLibraryId): BuiltBotPrompt {
  const config = LIBRARY_CONFIGS[libraryId];

  // Find the composition for this library
  const composition = slackBotCompositions.find(c => c.context === config.compositionContext);

  if (!composition) {
    throwCompositionNotFound(config.compositionContext);
  }

  // Get the blocks for this composition
  const blocks = getBlocks(composition.blockIds);

  if (blocks.length === 0) {
    throwNoBlocksFound(config.compositionContext, composition.blockIds);
  }

  // Build the prompt by joining block contents
  const promptParts = blocks.map(block => block.content);
  const systemPrompt = promptParts.join('\n\n');

  return {
    systemPrompt,
    compositionId: composition.context,
    blockIds: composition.blockIds,
  };
}

/**
 * Generate an answer from a knowledge library
 *
 * @param question - User question to answer
 * @param libraryId - Which library to search (it, knowledge, gtm)
 * @param threadContext - Optional thread context for follow-up questions
 */
export async function generateLibraryAnswer(
  question: string,
  libraryId: BotLibraryId,
  threadContext?: ThreadContext
): Promise<BotAnswer> {
  const config = LIBRARY_CONFIGS[libraryId];

  if (!config) {
    throw new Error(`Unknown library: ${libraryId}`);
  }

  // Fetch relevant skills from the library using LLM semantic matching
  let skills: Array<{
    id: string;
    title: string;
    content: string;
    categories?: string[];
    attributes?: unknown;
  }> = [];
  let selectedSkillsMetadata: Map<string, { reason: string; confidence: 'high' | 'medium' | 'low' }> = new Map();
  let skillSelectionMethod: 'llm_semantic' | 'rerank_thread' | 'keyword' = 'keyword';

  try {
    // Use LLM semantic matching to select relevant skills
    const scopeIndex = await getScopeIndex([libraryId as LibraryId]);

    if (scopeIndex.length > 0) {
      const selectionResult = await selectSkillsForQuestions({
        questions: [question],
        scopeIndex,
        libraryId: libraryId as LibraryId,
        mode: 'execute',
        options: { maxSkills: 50 },
      });

      if (selectionResult.mode === 'execute') {
        skillSelectionMethod = 'llm_semantic';
        selectedSkillsMetadata = new Map(
          selectionResult.selectedSkills.map(s => [
            s.skillId,
            { reason: s.reason, confidence: s.confidence }
          ])
        );

        // Fetch full content for selected skills
        const selectedIds = selectionResult.selectedSkills.map(s => s.skillId);
        skills = await prisma.buildingBlock.findMany({
          where: {
            id: { in: selectedIds },
            status: 'ACTIVE',
            libraryId,
          },
          select: {
            id: true,
            title: true,
            content: true,
            categories: true,
            attributes: true,
          },
        });

        // If LLM selection returns no skills but we have thread context, fall back to reranking
        if (skills.length === 0 && threadContext?.previousSkillIds && threadContext.previousSkillIds.length > 0) {
          skillSelectionMethod = 'rerank_thread';
          const allSkills = await prisma.buildingBlock.findMany({
            where: {
              status: 'ACTIVE',
              libraryId,
            },
            select: {
              id: true,
              title: true,
              content: true,
              categories: true,
              attributes: true,
            },
            orderBy: {
              updatedAt: "desc",
            },
          });
          skills = rerankSkills(allSkills, threadContext.previousSkillIds, {
            maxSkills: 50,
          });
          selectedSkillsMetadata = new Map();
        }
      }
    } else {
      throw new Error('No skills available in library');
    }
  } catch {
    // Fall back to reranking if LLM selection fails
    skillSelectionMethod = threadContext?.previousSkillIds && threadContext.previousSkillIds.length > 0
      ? 'rerank_thread'
      : 'keyword';

    selectedSkillsMetadata = new Map();

    if (threadContext?.previousSkillIds && threadContext.previousSkillIds.length > 0) {
      const allSkills = await prisma.buildingBlock.findMany({
        where: {
          status: 'ACTIVE',
          libraryId,
        },
        select: {
          id: true,
          title: true,
          content: true,
          categories: true,
          attributes: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });
      skills = rerankSkills(allSkills, threadContext.previousSkillIds, {
        maxSkills: 50,
      });
    } else {
      skills = await prisma.buildingBlock.findMany({
        where: {
          status: 'ACTIVE',
          libraryId,
        },
        select: {
          id: true,
          title: true,
          content: true,
          categories: true,
          attributes: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 50,
      });
    }
  }

  const skillsSearched = skills.length;

  // No skills available
  if (skills.length === 0) {
    return {
      answer: `I don't have any ${config.label} knowledge available yet. Please contact support directly for assistance.`,
      confidence: "Low",
      skillsUsed: [],
      skillsSearched: 0,
      skillSelectionMethod,
    };
  }

  // Build context from skills
  const skillContext = skills
    .map((s) => `### ${s.title}\n\n${s.content}`)
    .join("\n\n---\n\n");

  // Build prompt from V2 composition system (editable in Admin > Prompts)
  const builtPrompt = buildSystemPrompt(libraryId);

  // Append skill context
  let systemPrompt = `${builtPrompt.systemPrompt}

## Available ${config.label} Knowledge

${skillContext}`;

  // Append thread context if provided
  if (threadContext && threadContext.conversationHistory.length > 0) {
    const historyText = threadContext.conversationHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');
    systemPrompt += `\n\n## Previous Conversation in This Thread\n\nHere is the conversation history from earlier in this Slack thread. Use this context to provide continuity and reference previous answers:\n\n${historyText}`;
  }

  const userMessage = `Question: ${question}

Please answer this question using the knowledge above. If you're not sure or the information isn't available, say so.`;

  // Call the LLM
  const anthropic = await getAnthropicClient();

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // Log usage for dashboard tracking
  logUsage({
    feature: "slack_bot",
    model: CLAUDE_MODEL,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  });

  const answer =
    response.content[0].type === "text"
      ? response.content[0].text
      : "Unable to generate response";

  // Determine which skills were used
  // Priority: Use LLM-selected skills if available, otherwise keyword match
  let usedSkills;

  if (skillSelectionMethod === 'llm_semantic' && selectedSkillsMetadata.size > 0) {
    // Use skills that were selected by LLM semantic matching
    usedSkills = skills.filter(s => selectedSkillsMetadata.has(s.id)).slice(0, 3);
  } else {
    // Fall back to keyword matching (for reranking or keyword methods)
    usedSkills = skills.filter((skill) => {
      const titleWords = skill.title.toLowerCase().split(/\s+/);
      const questionLower = question.toLowerCase();
      const answerLower = answer.toLowerCase();

      return titleWords.some(
        (word) =>
          word.length > 3 &&
          (questionLower.includes(word) || answerLower.includes(word))
      );
    }).slice(0, 3);
  }

  // Determine confidence based on number of matching skills
  let confidence = "Medium";
  if (usedSkills.length >= 2) {
    confidence = "High";
  } else if (usedSkills.length === 0 || answer.includes("don't have")) {
    confidence = "Low";
  }

  // Update usage tracking for matched skills
  if (usedSkills.length > 0) {
    for (const skill of usedSkills) {
      const attrs = (skill.attributes as Record<string, unknown>) || {};
      const usageCount = ((attrs.usageCount as number) || 0) + 1;
      await prisma.buildingBlock.update({
        where: { id: skill.id },
        data: {
          attributes: {
            ...attrs,
            usageCount,
            lastUsedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  // Extract source URLs and selection metadata from attributes
  const skillsWithSourceUrls = usedSkills.map((s) => {
    const attrs = (s.attributes as Record<string, unknown>) || {};
    const sourceUrls = attrs.sourceUrls as Array<{ url: string }> | null;
    const metadata = selectedSkillsMetadata.get(s.id);

    return {
      id: s.id,
      title: s.title,
      sourceUrls: sourceUrls?.map((su) => su.url),
      reason: metadata?.reason,
      confidence: metadata?.confidence,
    };
  });

  return {
    answer,
    confidence,
    skillsUsed: skillsWithSourceUrls,
    skillsSearched,
    skillSelectionMethod,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    contextWarning: threadContext?.warningMessage,
    transparency: {
      systemPrompt,
      compositionId: builtPrompt.compositionId,
      blockIds: builtPrompt.blockIds,
    },
  };
}

/**
 * Get all available library IDs (for configuration)
 */
export function getAvailableLibraries(): LibraryConfig[] {
  return Object.values(LIBRARY_CONFIGS);
}
