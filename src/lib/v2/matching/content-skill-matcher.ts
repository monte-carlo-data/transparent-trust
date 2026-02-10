/**
 * Unified Content-to-Skill Matching Service
 *
 * Single source of truth for matching any content (sources, questions, batches)
 * to skills using scope definitions. Supports:
 *
 * - Keyword matching: Fast, no LLM, using TF-IDF-like scoring
 * - LLM matching: Semantic analysis via Claude
 * - Hybrid: Keyword pre-filter + LLM refinement
 *
 * Three modes:
 * - preview: Return all skills ranked + AI recommendations (for approval UI)
 * - execute: Return only matched/approved skills (for processing)
 * - forecast: Estimate token usage without LLM call
 *
 * Used by:
 * - RFP question processing (via selectSkillsForQuestions adapter)
 * - Source-to-skill matching (via matchSourceToSkills functions)
 * - Any future content→skill matching needs
 *
 * Architecture: This service replaces duplicate matching logic that existed in:
 * - skill-selection-service.ts (RFP questions)
 * - source-skill-matching-service.ts (sources)
 * Now both use this unified implementation.
 */

import type { LibraryId, ScopeDefinition } from '@/types/v2';
import {
  extractKeywords,
  scoreKeywordMatch,
} from '../skills/keyword-extractor';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Lightweight skill data for matching (same as SkillScopeIndex)
 */
export interface SkillForMatching {
  id: string;
  title: string;
  scopeDefinition?: ScopeDefinition;
}

/**
 * A single match result
 */
export interface ContentSkillMatch {
  skillId: string;
  skillTitle: string;
  score: number; // 0-1
  confidence: 'high' | 'medium' | 'low';
  matchedTerms: string[];
  reason: string;
  matchStrategy: 'keyword' | 'llm';
  suggestedExcerpt?: string; // For source matching - which part of content matches
}

/**
 * Skill with ranking info for preview UI
 */
export interface SkillWithRanking {
  id: string;
  title: string;
  score: number;
  matchPercentage: number;
  matchedTerms: string[];
  recommended: boolean; // Is this in the AI-recommended set?
}

/**
 * Content to match against skills
 */
export interface ContentToMatch {
  id: string;
  label: string;
  content: string;
  keywords?: string[]; // Pre-extracted keywords (for sources)
}

/**
 * Request for content-to-skill matching
 */
export interface MatchContentRequest {
  /** Content to match (single item or batch) */
  content: ContentToMatch | ContentToMatch[];
  /** Content type affects matching behavior */
  contentType: 'source' | 'question' | 'question_batch';
  /** Skills to match against */
  skills: SkillForMatching[];
  /** Library context */
  libraryId: LibraryId;
  /** Matching strategy */
  strategy: 'keyword' | 'llm' | 'hybrid';
  /** Mode: preview for UI, execute for processing, forecast for estimation */
  mode: 'preview' | 'execute' | 'forecast';
  /** Optional configuration */
  options?: {
    maxSkills?: number;
    minScore?: number;
    approvedSkillIds?: string[]; // For execute mode with user-approved IDs
  };
  /** Additional context for LLM matching */
  additionalContext?: string;
}

/**
 * Preview mode result - includes all skills ranked for UI
 */
export interface MatchContentPreviewResult {
  mode: 'preview';
  totalContentItems: number;
  totalSkillsAvailable: number;
  recommendations: ContentSkillMatch[];
  allSkills: SkillWithRanking[];
  coverage: {
    recommendedCount: number;
    totalSkills: number;
    avgRecommendedScore: string;
  };
}

/**
 * Execute mode result - just the matched skills
 */
export interface MatchContentExecuteResult {
  mode: 'execute';
  totalContentItems: number;
  matches: ContentSkillMatch[];
  coverage: {
    matchedCount: number;
  };
}

/**
 * Forecast mode result - estimation only
 */
export interface MatchContentForecastResult {
  mode: 'forecast';
  totalContentItems: number;
  estimatedMatchedSkills: number;
  estimatedTokens: number;
  coveragePercent: number;
}

/**
 * Union of all result types
 */
export type MatchContentResult =
  | MatchContentPreviewResult
  | MatchContentExecuteResult
  | MatchContentForecastResult;

// =============================================================================
// CORE MATCHING LOGIC
// =============================================================================

/**
 * Score content against a single skill's scope definition using keywords
 */
export function scoreContentAgainstSkill(
  content: string,
  contentKeywords: string[],
  skill: SkillForMatching
): { score: number; matchedTerms: string[] } {
  if (!skill.scopeDefinition?.covers) {
    return { score: 0, matchedTerms: [] };
  }

  const scope = skill.scopeDefinition;
  const contentLower = content.toLowerCase();

  // Get skill keywords (use stored keywords or extract from covers)
  const skillKeywords = scope.keywords?.length
    ? scope.keywords
    : extractScopeTerms(scope.covers);

  // Calculate keyword overlap score
  const keywordScore = contentKeywords.length > 0 && skillKeywords.length > 0
    ? scoreKeywordMatch(contentKeywords, skillKeywords)
    : 0;

  // Track matched terms
  const matchedTerms: string[] = [];

  // Check covers field for direct matches
  const coverTerms = extractScopeTerms(scope.covers);
  for (const term of coverTerms) {
    const termWords = term.split(/\s+/);
    const hasMatch =
      contentLower.includes(term) ||
      termWords.some(word => word.length > 2 && contentLower.includes(word));
    if (hasMatch) {
      matchedTerms.push(term);
    }
  }

  // Check futureAdditions for partial matches
  let futureScore = 0;
  for (const addition of scope.futureAdditions || []) {
    if (contentLower.includes(addition.toLowerCase())) {
      futureScore += 0.1;
      matchedTerms.push(addition);
    }
  }

  // Penalty for notIncluded matches
  let penalty = 0;
  for (const excluded of scope.notIncluded || []) {
    if (contentLower.includes(excluded.toLowerCase())) {
      penalty += 0.3;
    }
  }

  // Combine scores: keyword overlap (60%) + term matches (30%) + future (10%) - penalty
  const termMatchScore = matchedTerms.length > 0
    ? Math.min(1, matchedTerms.length / Math.max(coverTerms.length, 1))
    : 0;

  const combinedScore = Math.max(
    0,
    Math.min(1, keywordScore * 0.6 + termMatchScore * 0.3 + futureScore - penalty)
  );

  return {
    score: combinedScore,
    matchedTerms: [...new Set(matchedTerms)], // Dedupe
  };
}

/**
 * Extract terms from a scope's "covers" field
 */
function extractScopeTerms(coversText: string | undefined): string[] {
  if (!coversText) return [];
  return coversText
    .split(/[,;]/)
    .map(term => term.trim().toLowerCase())
    .filter(term => term.length > 0);
}

/**
 * Convert score to confidence level
 */
function scoreToConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

// =============================================================================
// MAIN MATCHING FUNCTION
// =============================================================================

/**
 * Match content to skills using the unified matching logic.
 *
 * This is the single entry point for all content-to-skill matching.
 */
export async function matchContentToSkills(
  request: MatchContentRequest
): Promise<MatchContentResult> {
  const {
    content,
    contentType,
    skills,
    libraryId,
    strategy,
    mode,
    options = {},
    additionalContext,
  } = request;

  const { maxSkills = 10, minScore = 0.1, approvedSkillIds } = options;

  // Normalize content to array
  const contentItems = Array.isArray(content) ? content : [content];

  // Validate inputs
  if (contentItems.length === 0) {
    throw new Error('At least one content item is required');
  }

  if (skills.length === 0) {
    throw new Error('No skills available for matching');
  }

  // ==========================================================================
  // MODE: FORECAST
  // ==========================================================================

  if (mode === 'forecast') {
    const estimatedMatchedSkills = Math.min(8, skills.length);
    const avgTokensPerSkill = 3000;
    const skillTokens = estimatedMatchedSkills * avgTokensPerSkill;
    const contentTokens = contentItems.length * 200; // Avg tokens per content item
    const overheadTokens = 500;
    const estimatedTokens = skillTokens + contentTokens + overheadTokens;

    return {
      mode: 'forecast',
      totalContentItems: contentItems.length,
      estimatedMatchedSkills,
      estimatedTokens,
      coveragePercent: Math.round((estimatedMatchedSkills / skills.length) * 100),
    };
  }

  // ==========================================================================
  // KEYWORD MATCHING (fast path)
  // ==========================================================================

  const keywordMatches = matchWithKeywords(contentItems, skills, { minScore, maxSkills });

  // ==========================================================================
  // LLM MATCHING (if requested)
  // ==========================================================================

  let llmMatches: ContentSkillMatch[] = [];

  if (strategy === 'llm' || strategy === 'hybrid') {
    try {
      llmMatches = await matchWithLLM(
        contentItems,
        skills,
        libraryId,
        contentType,
        additionalContext,
        maxSkills
      );
    } catch (error) {
      // If LLM fails in hybrid mode, fall back to keyword results
      if (strategy === 'hybrid') {
        console.warn('[matchContentToSkills] LLM matching failed, using keyword results:', error);
      } else {
        throw error;
      }
    }
  }

  // ==========================================================================
  // COMBINE RESULTS
  // ==========================================================================

  // For hybrid: merge LLM results with keyword results, preferring LLM scores
  let finalMatches: ContentSkillMatch[];

  if (strategy === 'llm' && llmMatches.length > 0) {
    finalMatches = llmMatches;
  } else if (strategy === 'hybrid' && llmMatches.length > 0) {
    // Merge: LLM matches take precedence, add keyword-only matches
    const llmSkillIds = new Set(llmMatches.map(m => m.skillId));
    const keywordOnlyMatches = keywordMatches.filter(m => !llmSkillIds.has(m.skillId));
    finalMatches = [...llmMatches, ...keywordOnlyMatches].slice(0, maxSkills);
  } else {
    finalMatches = keywordMatches;
  }

  // ==========================================================================
  // MODE: EXECUTE
  // ==========================================================================

  if (mode === 'execute') {
    // If approvedSkillIds provided, filter to only those
    const matchesToUse = approvedSkillIds
      ? finalMatches.filter(m => approvedSkillIds.includes(m.skillId))
      : finalMatches;

    return {
      mode: 'execute',
      totalContentItems: contentItems.length,
      matches: matchesToUse,
      coverage: {
        matchedCount: matchesToUse.length,
      },
    };
  }

  // ==========================================================================
  // MODE: PREVIEW
  // ==========================================================================

  // Get ALL skills ranked for preview UI
  const allSkillsRanked = rankAllSkills(contentItems, skills);

  // Mark which skills are recommended
  const recommendedSkillIds = new Set(finalMatches.map(m => m.skillId));

  const allSkillsSuggestions: SkillWithRanking[] = allSkillsRanked.map(skill => ({
    id: skill.skillId,
    title: skill.skillTitle,
    score: skill.score,
    matchPercentage: Math.round(skill.score * 100),
    matchedTerms: skill.matchedTerms,
    recommended: recommendedSkillIds.has(skill.skillId),
  }));

  const avgRecommendedScore = finalMatches.length > 0
    ? (finalMatches.reduce((sum, m) => sum + m.score, 0) / finalMatches.length).toFixed(2)
    : '0';

  return {
    mode: 'preview',
    totalContentItems: contentItems.length,
    totalSkillsAvailable: skills.length,
    recommendations: finalMatches,
    allSkills: allSkillsSuggestions,
    coverage: {
      recommendedCount: finalMatches.length,
      totalSkills: allSkillsSuggestions.length,
      avgRecommendedScore,
    },
  };
}

// =============================================================================
// KEYWORD MATCHING
// =============================================================================

/**
 * Match content to skills using keyword-based scoring
 */
function matchWithKeywords(
  contentItems: ContentToMatch[],
  skills: SkillForMatching[],
  options: { minScore: number; maxSkills: number }
): ContentSkillMatch[] {
  const { minScore, maxSkills } = options;

  // Combine all content for batch analysis
  const combinedContent = contentItems.map(c => c.content).join('\n\n');

  // Get keywords from content (use pre-extracted if available, otherwise extract)
  const combinedKeywords = contentItems.flatMap(c =>
    c.keywords?.length ? c.keywords : extractKeywords(c.content, 5)
  );
  const uniqueKeywords = [...new Set(combinedKeywords)];

  // Score each skill
  const matches: ContentSkillMatch[] = [];

  for (const skill of skills) {
    const { score, matchedTerms } = scoreContentAgainstSkill(
      combinedContent,
      uniqueKeywords,
      skill
    );

    if (score >= minScore) {
      matches.push({
        skillId: skill.id,
        skillTitle: skill.title,
        score,
        confidence: scoreToConfidence(score),
        matchedTerms,
        reason: matchedTerms.length > 0
          ? `Keyword match: ${matchedTerms.slice(0, 3).join(', ')}`
          : 'Partial keyword overlap',
        matchStrategy: 'keyword',
      });
    }
  }

  // Sort by score and limit
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSkills);
}

/**
 * Rank ALL skills by match score (for preview UI)
 */
function rankAllSkills(
  contentItems: ContentToMatch[],
  skills: SkillForMatching[]
): ContentSkillMatch[] {
  const combinedContent = contentItems.map(c => c.content).join('\n\n');
  const combinedKeywords = contentItems.flatMap(c =>
    c.keywords?.length ? c.keywords : extractKeywords(c.content, 5)
  );
  const uniqueKeywords = [...new Set(combinedKeywords)];

  return skills
    .map(skill => {
      const { score, matchedTerms } = scoreContentAgainstSkill(
        combinedContent,
        uniqueKeywords,
        skill
      );

      return {
        skillId: skill.id,
        skillTitle: skill.title,
        score,
        confidence: scoreToConfidence(score),
        matchedTerms,
        reason: matchedTerms.length > 0
          ? `Keywords: ${matchedTerms.slice(0, 3).join(', ')}`
          : 'No direct matches',
        matchStrategy: 'keyword' as const,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// =============================================================================
// LLM MATCHING
// =============================================================================

/**
 * Match content to skills using LLM semantic analysis
 */
async function matchWithLLM(
  contentItems: ContentToMatch[],
  skills: SkillForMatching[],
  libraryId: LibraryId,
  contentType: string,
  additionalContext: string | undefined,
  maxSkills: number
): Promise<ContentSkillMatch[]> {
  // Import here to avoid circular dependencies
  const { matchSourceToSkills } = await import('../skills/skill-generation-service');

  // Combine content for LLM analysis
  const combinedContent = contentItems.map(c => `[${c.label}]: ${c.content}`).join('\n\n---\n\n');

  // Prepare skill data in the format matchSourceToSkills expects
  const existingSkills = skills.map(skill => ({
    id: skill.id,
    title: skill.title,
    scopeDefinition: skill.scopeDefinition,
  }));

  // Build context hint based on content type
  const contextHint = contentType === 'question' || contentType === 'question_batch'
    ? 'These are questions to answer. Match them to skills that can provide relevant information.'
    : 'These are source materials. Match them to skills that should incorporate this knowledge.';

  // Use LLM to match content to skills
  const matchingOutput = await matchSourceToSkills({
    source: {
      id: contentItems.length === 1 ? contentItems[0].id : 'batch_content',
      type: contentType,
      label: contentItems.length === 1 ? contentItems[0].label : `${contentItems.length} items`,
      content: combinedContent,
    },
    existingSkills,
    libraryId,
    additionalContext: [contextHint, additionalContext].filter(Boolean).join('\n\n'),
  });

  // Convert LLM output to ContentSkillMatch format
  return (matchingOutput.matches || [])
    .slice(0, maxSkills)
    .map(match => ({
      skillId: match.skillId,
      skillTitle: match.skillTitle,
      score: match.confidence === 'high' ? 0.9 : match.confidence === 'medium' ? 0.6 : 0.3,
      confidence: match.confidence,
      matchedTerms: [match.reason.split('\n')[0]?.slice(0, 50) || 'Matched by LLM'],
      reason: match.reason,
      matchStrategy: 'llm' as const,
      suggestedExcerpt: match.suggestedExcerpt,
    }));
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick keyword-only matching (synchronous, for UI)
 */
export function getQuickKeywordMatches(
  content: ContentToMatch,
  skills: SkillForMatching[],
  maxSkills: number = 5
): ContentSkillMatch[] {
  return matchWithKeywords([content], skills, { minScore: 0.1, maxSkills });
}

/**
 * Check if content should suggest creating a new skill
 */
export function shouldSuggestNewSkill(matches: ContentSkillMatch[]): boolean {
  const hasHighConfidenceMatch = matches.some(
    m => m.confidence === 'high' && m.score >= 0.6
  );
  return !hasHighConfidenceMatch && matches.length === 0;
}
