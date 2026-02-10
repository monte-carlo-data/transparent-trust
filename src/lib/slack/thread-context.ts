/**
 * Thread Context Manager
 *
 * Fetches conversation history from SlackBotInteraction table
 * and builds context for LLM calls.
 */

import { prisma } from '@/lib/prisma';
import { estimateTokens } from '@/lib/tokenUtils';
import { logger } from '@/lib/logger';

export interface ThreadContext {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  previousSkillIds: string[];
  tokenEstimate: number;
  exceedsLimits: boolean;
  warningMessage?: string;
}

export interface ThreadContextOptions {
  maxMessages?: number;
  tokenBudget?: number;
  includeSkillContext?: boolean;
}

/**
 * Fetch thread context from SlackBotInteraction table
 *
 * Retrieves the last N interactions in a Slack thread and builds:
 * - conversationHistory: Array of user/assistant message pairs
 * - previousSkillIds: Deduplicated list of skills used in thread
 * - tokenEstimate: Estimated token count of thread context only (not including skills)
 * - warningMessage: Warning if context exceeds token budget
 *
 * NOTE: The token budget (default 2000) applies only to thread context history.
 * The actual total prompt will be larger due to system prompt (~500) and skills context
 * (~10k-40k depending on number of active skills). The thread budget is conservative to
 * prevent runaway conversation history from consuming the entire Claude context window.
 */
export async function fetchThreadContext(
  slackThreadTs: string,
  libraryId: string,
  options: ThreadContextOptions = {}
): Promise<ThreadContext> {
  const {
    maxMessages = 10,
    tokenBudget = 2000,
    includeSkillContext = true,
  } = options;

  try {
    // Fetch last N interactions from thread
    const interactions = await prisma.slackBotInteraction.findMany({
      where: {
        slackThreadTs,
        libraryId,
      },
      orderBy: { createdAt: 'desc' },
      take: maxMessages,
      select: {
        question: true,
        answer: true,
        skillsUsed: true,
        createdAt: true,
      },
    });

    // Build conversation history (reverse to chronological order)
    const conversationHistory = interactions.reverse().flatMap(interaction => [
      { role: 'user' as const, content: interaction.question },
      { role: 'assistant' as const, content: interaction.answer },
    ]);

    // Extract skill IDs if requested
    let previousSkillIds: string[] = [];
    if (includeSkillContext) {
      const skillIdSet = new Set<string>();
      interactions.forEach(interaction => {
        const skillsArray = interaction.skillsUsed as Array<{ id: string }> | null;
        if (Array.isArray(skillsArray)) {
          skillsArray.forEach(skill => {
            if (skill && skill.id) {
              skillIdSet.add(skill.id);
            }
          });
        }
      });
      previousSkillIds = Array.from(skillIdSet);
    }

    // Estimate tokens
    const contextText = conversationHistory.map(m => m.content).join('\n');
    const tokenEstimate = estimateTokens(contextText);
    const exceedsLimits = tokenEstimate > tokenBudget;

    let warningMessage: string | undefined;
    if (exceedsLimits) {
      warningMessage = `Thread context is large (${tokenEstimate} tokens, budget: ${tokenBudget}). Earlier messages may be truncated.`;
    }

    if (conversationHistory.length > 0) {
      logger.info('Fetched thread context', {
        slackThreadTs,
        libraryId,
        messageCount: conversationHistory.length,
        skillCount: previousSkillIds.length,
        tokenEstimate,
        exceedsLimits,
      });
    }

    return {
      conversationHistory,
      previousSkillIds,
      tokenEstimate,
      exceedsLimits,
      warningMessage,
    };
  } catch (error) {
    logger.error('Failed to fetch thread context from database', error, {
      slackThreadTs,
      libraryId,
    });
    // Return empty context on error - bot should continue functioning
    return {
      conversationHistory: [],
      previousSkillIds: [],
      tokenEstimate: 0,
      exceedsLimits: false,
    };
  }
}
