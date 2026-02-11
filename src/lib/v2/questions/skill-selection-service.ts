/**
 * Skill Selection Service (RFP Questions)
 *
 * Adapter layer that uses the unified content-skill matcher for RFP question processing.
 * Maintains backward compatibility with existing RFP code while using the unified matching engine.
 */

import type { SkillScopeIndex } from '../blocks/block-service';
import type { LibraryId } from '@/types/v2';
import { matchContentToSkills, type MatchContentResult } from '../matching/content-skill-matcher';

// =============================================================================
// TYPES (Public API - unchanged for backward compatibility)
// =============================================================================

export interface SkillSelection {
  skillId: string;
  title: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  matchedTerms: string[];
}

export interface AllSkillWithRanking {
  id: string;
  title: string;
  score: number;
  matchPercentage: number;
  matchedTerms: string[];
  recommended: boolean;
}

export interface SkillSelectionPreviewResult {
  mode: 'preview';
  totalQuestions: number;
  totalSkillsAvailable: number;
  recommendations: SkillSelection[];
  allSkills: AllSkillWithRanking[];
  coverage: {
    recommendedCount: number;
    totalSkills: number;
    avgRecommendedScore: string;
  };
}

export interface SkillSelectionExecuteResult {
  mode: 'execute';
  totalQuestions: number;
  selectedSkills: SkillSelection[];
  coverage: {
    selectedCount: number;
  };
}

export interface SkillSelectionForecastResult {
  mode: 'forecast';
  totalQuestions: number;
  estimatedSelectedSkills: number;
  estimatedTokens: number;
  coveragePercent: number;
}

export type SkillSelectionResult =
  | SkillSelectionPreviewResult
  | SkillSelectionExecuteResult
  | SkillSelectionForecastResult;

export interface SkillSelectionRequest {
  questions: string[];
  scopeIndex: SkillScopeIndex[];
  libraryId: LibraryId;
  mode: 'preview' | 'execute' | 'forecast';
  options?: {
    maxSkills?: number;
    approvedSkillIds?: string[];
  };
}

// =============================================================================
// ADAPTER FUNCTIONS
// =============================================================================

/**
 * Convert SkillScopeIndex to SkillForMatching format
 */
function scopeIndexToSkillsForMatching(scopeIndex: SkillScopeIndex[]) {
  return scopeIndex.map(s => ({
    id: s.id,
    title: s.title,
    scopeDefinition: s.scopeDefinition,
  }));
}

/**
 * Convert unified MatchContentResult to SkillSelectionResult
 */
function adaptMatchResultToSkillSelection(
  result: MatchContentResult,
  totalQuestions: number
): SkillSelectionResult {
  if (result.mode === 'forecast') {
    return {
      mode: 'forecast',
      totalQuestions,
      estimatedSelectedSkills: result.estimatedMatchedSkills,
      estimatedTokens: result.estimatedTokens,
      coveragePercent: result.coveragePercent,
    };
  }

  if (result.mode === 'execute') {
    return {
      mode: 'execute',
      totalQuestions,
      selectedSkills: result.matches.map(m => ({
        skillId: m.skillId,
        title: m.skillTitle,
        score: m.score,
        confidence: m.confidence,
        reason: m.reason,
        matchedTerms: m.matchedTerms,
      })),
      coverage: {
        selectedCount: result.matches.length,
      },
    };
  }

  // preview mode
  return {
    mode: 'preview',
    totalQuestions,
    totalSkillsAvailable: result.totalSkillsAvailable,
    recommendations: result.recommendations.map(m => ({
      skillId: m.skillId,
      title: m.skillTitle,
      score: m.score,
      confidence: m.confidence,
      reason: m.reason,
      matchedTerms: m.matchedTerms,
    })),
    allSkills: result.allSkills.map(s => ({
      id: s.id,
      title: s.title,
      score: s.score,
      matchPercentage: s.matchPercentage,
      matchedTerms: s.matchedTerms,
      recommended: s.recommended,
    })),
    coverage: {
      recommendedCount: result.coverage.recommendedCount,
      totalSkills: result.coverage.totalSkills,
      avgRecommendedScore: result.coverage.avgRecommendedScore,
    },
  };
}

// =============================================================================
// PUBLIC API (unchanged)
// =============================================================================

/**
 * Select skills for RFP questions using the unified matching engine.
 *
 * This function maintains the existing public API while delegating to the
 * unified content-skill matcher internally.
 */
export async function selectSkillsForQuestions(
  request: SkillSelectionRequest
): Promise<SkillSelectionResult> {
  const {
    questions,
    scopeIndex,
    libraryId,
    mode,
    options = {},
  } = request;

  const { maxSkills = 10, approvedSkillIds } = options;

  // Validate inputs
  if (questions.length === 0) {
    throw new Error('At least one question is required');
  }

  if (scopeIndex.length === 0) {
    throw new Error('No skills available in the selected library');
  }

  // Convert to unified matching request
  const matchResult = await matchContentToSkills({
    content: questions.map((q, idx) => ({
      id: `question_${idx}`,
      label: `Question ${idx + 1}`,
      content: q,
    })),
    contentType: 'question_batch',
    skills: scopeIndexToSkillsForMatching(scopeIndex),
    libraryId,
    strategy: 'llm', // RFP always uses LLM for semantic matching
    mode,
    options: {
      maxSkills,
      approvedSkillIds,
    },
  });

  // Adapt result back to SkillSelectionResult format
  return adaptMatchResultToSkillSelection(matchResult, questions.length);
}
