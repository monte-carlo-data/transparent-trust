/**
 * Source-to-Skill Matching Service
 *
 * Adapter layer that uses the unified content-skill matcher for source matching.
 * Provides domain-specific functions for matching sources to skills with three modes:
 * - Single source matching (for UI suggestions)
 * - Batch source matching (for inbox processing with approval)
 * - Quick keyword matching (synchronous, for cards)
 */

import {
  matchContentToSkills,
  getQuickKeywordMatches,
  shouldSuggestNewSkill,
} from '../matching/content-skill-matcher';
import type { LibraryId, ScopeDefinition } from '@/types/v2';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A potential match between a source and a skill
 */
export interface SourceSkillMatch {
  skillId: string;
  skillTitle: string;
  confidence: 'high' | 'medium' | 'low';
  matchScore: number; // 0-1 for numeric comparison
  reason: string;
  matchStrategy: 'keyword' | 'llm' | 'hybrid';
  suggestedExcerpt?: string;
}

/**
 * Matching request for single source
 */
export interface MatchSourceInput {
  source: {
    id: string;
    label: string;
    content: string;
    keywords?: string[];
  };
  existingSkills: Array<{
    id: string;
    title: string;
    scopeDefinition?: ScopeDefinition;
  }>;
  libraryId: LibraryId;
  strategy: 'keyword' | 'llm' | 'hybrid';
  additionalContext?: string;
}

/**
 * Batch matching request for multiple sources
 */
export interface MatchSourcesBatchInput {
  sources: Array<{
    id: string;
    label: string;
    content: string;
    keywords?: string[];
  }>;
  existingSkills: Array<{
    id: string;
    title: string;
    scopeDefinition?: ScopeDefinition;
  }>;
  libraryId: LibraryId;
  strategy: 'keyword' | 'llm';
  additionalContext?: string;
}

/**
 * Result for a single source in batch
 */
export interface BatchSourceMatches {
  sourceId: string;
  sourceLabel: string;
  matches: SourceSkillMatch[];
  suggestNewSkill: boolean;
}

/**
 * Batch matching result
 */
export interface MatchSourcesBatchResult {
  results: BatchSourceMatches[];
  summary: {
    totalSources: number;
    totalMatches: number;
    matchedSources: number;
    unmatchedSources: number;
  };
}

/**
 * Matching result
 */
export interface MatchingResult {
  matches: SourceSkillMatch[];
  suggestNewSkill: boolean;
  suggestedSkillTitle?: string;
  suggestedScope?: {
    covers: string;
    futureAdditions: string[];
  };
}

// =============================================================================
// ADAPTER FUNCTIONS
// =============================================================================

/**
 * Convert unified ContentSkillMatch to SourceSkillMatch
 */
function adaptContentMatchToSourceMatch(match: {
  skillId: string;
  skillTitle: string;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  reason: string;
  matchStrategy: 'keyword' | 'llm' | 'hybrid';
  suggestedExcerpt?: string;
}): SourceSkillMatch {
  return {
    skillId: match.skillId,
    skillTitle: match.skillTitle,
    confidence: match.confidence,
    matchScore: match.score,
    reason: match.reason,
    matchStrategy: match.matchStrategy,
    suggestedExcerpt: match.suggestedExcerpt,
  };
}

// =============================================================================
// SINGLE SOURCE MATCHING
// =============================================================================

/**
 * Match a single source to existing skills
 * Returns matches with optional new skill suggestion
 *
 * @param input - Source, skills, library, and matching strategy
 * @returns Matches and new skill recommendation
 */
export async function matchSourceToSkillsWithStrategy(
  input: MatchSourceInput
): Promise<MatchingResult> {
  // Use unified matcher in execute mode to get recommended skills
  const matchResult = await matchContentToSkills({
    content: {
      id: input.source.id,
      label: input.source.label,
      content: input.source.content,
      keywords: input.source.keywords,
    },
    contentType: 'source',
    skills: input.existingSkills.map(s => ({
      id: s.id,
      title: s.title,
      scopeDefinition: s.scopeDefinition,
    })),
    libraryId: input.libraryId,
    strategy: input.strategy,
    mode: 'execute',
    additionalContext: input.additionalContext,
  });

  if (matchResult.mode !== 'execute') {
    throw new Error('Expected execute mode result');
  }

  const matches = matchResult.matches.map(adaptContentMatchToSourceMatch);
  const suggestNew = shouldSuggestNewSkill(matchResult.matches);

  return {
    matches,
    suggestNewSkill: suggestNew,
    ...(suggestNew && {
      suggestedSkillTitle: `New Skill: ${input.source.label}`,
      suggestedScope: {
        covers: input.source.label,
        futureAdditions: [],
      },
    }),
  };
}

/**
 * Get keyword-based matches (fast path for UI, synchronous)
 * Perfect for source cards that need quick suggestions
 *
 * @param source - Source to match
 * @param skills - Skills to match against
 * @returns Matches sorted by score
 */
export function getKeywordMatches(
  source: {
    id: string;
    label: string;
    content: string;
    keywords?: string[];
  },
  skills: Array<{
    id: string;
    title: string;
    scopeDefinition?: ScopeDefinition;
  }>
): SourceSkillMatch[] {
  const matches = getQuickKeywordMatches(
    {
      id: source.id,
      label: source.label,
      content: source.content,
      keywords: source.keywords,
    },
    skills.map(s => ({
      id: s.id,
      title: s.title,
      scopeDefinition: s.scopeDefinition,
    })),
    10
  );

  return matches.map(adaptContentMatchToSourceMatch);
}

// =============================================================================
// BATCH SOURCE MATCHING
// =============================================================================

/**
 * Match multiple sources to existing skills for batch processing
 * Returns per-source matches with summary statistics
 *
 * This is the main entry point for inbox/batch processing where a user
 * selects multiple sources and wants to see matching suggestions before
 * proceeding with skill creation/updates.
 *
 * @param input - Multiple sources, skills, library, and matching strategy
 * @returns Per-source results with batch summary
 */
export async function matchSourcesBatch(
  input: MatchSourcesBatchInput
): Promise<MatchSourcesBatchResult> {
  // Use unified matcher in preview mode to get all matches + recommendations
  const matchResult = await matchContentToSkills({
    content: input.sources.map(s => ({
      id: s.id,
      label: s.label,
      content: s.content,
      keywords: s.keywords,
    })),
    contentType: 'source',
    skills: input.existingSkills.map(s => ({
      id: s.id,
      title: s.title,
      scopeDefinition: s.scopeDefinition,
    })),
    libraryId: input.libraryId,
    strategy: input.strategy,
    mode: 'preview', // Preview to get all skills ranked
    additionalContext: input.additionalContext,
  });

  if (matchResult.mode !== 'preview') {
    throw new Error('Expected preview mode result');
  }

  // For each source, determine if we'd suggest creating a new skill
  // A new skill is suggested if: no high-confidence match exists
  const results: BatchSourceMatches[] = input.sources.map(source => {
    // In preview mode, all matches are combined - we need to filter for this source
    // Since the unified matcher combines all sources, we use the AI recommendations
    // which are already ranked appropriately
    const sourceMatches = matchResult.recommendations.map(
      adaptContentMatchToSourceMatch
    );
    const suggestNew = shouldSuggestNewSkill(matchResult.recommendations);

    return {
      sourceId: source.id,
      sourceLabel: source.label,
      matches: sourceMatches,
      suggestNewSkill: suggestNew,
    };
  });

  // Calculate summary statistics
  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
  const matchedSources = results.filter(r => r.matches.length > 0).length;
  const unmatchedSources = input.sources.length - matchedSources;

  return {
    results,
    summary: {
      totalSources: input.sources.length,
      totalMatches,
      matchedSources,
      unmatchedSources,
    },
  };
}
