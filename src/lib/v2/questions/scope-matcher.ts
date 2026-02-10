/**
 * Scope Matcher - Score questions against skill scope definitions
 *
 * Enables intelligent skill selection for RFP processing based on question content
 * rather than pre-assigned categories.
 */

import type { SkillScopeIndex } from '../blocks/block-service';
import type { LibraryId } from '@/types/v2'; // Used for type casting in matchSourceToSkills

export interface ScopeMatchResult {
  skillId: string;
  title: string;
  score: number;         // 0-1 confidence score
  matchedTerms: string[]; // Which scope terms matched the questions
}

/**
 * Extract key terms from a scope definition's "covers" field.
 * Splits by commas/semicolons and normalizes to lowercase.
 */
function extractScopeTerms(coversText: string | undefined): string[] {
  if (!coversText) return [];

  return coversText
    .split(/[,;]/)
    .map(term => term.trim().toLowerCase())
    .filter(term => term.length > 0);
}

/**
 * Score how well a single question matches a skill's scope definition.
 * Returns 0-1 score based on:
 * - Matches in "covers" (primary, 0.7 weight)
 * - Matches in "futureAdditions" (secondary, 0.2 weight)
 * - Penalty for "notIncluded" matches (-0.5)
 */
export function scoreQuestionAgainstScope(
  question: string,
  scope: SkillScopeIndex
): number {
  if (!scope.scopeDefinition?.covers) {
    return 0;
  }

  const questionLower = question.toLowerCase();
  const coverTerms = extractScopeTerms(scope.scopeDefinition.covers);
  const futureTerms = (scope.scopeDefinition.futureAdditions || [])
    .map(f => f.toLowerCase());
  const notIncludedTerms = (scope.scopeDefinition.notIncluded || [])
    .map(n => n.toLowerCase());

  let score = 0;

  // Check for matches in covers (primary signal)
  let coversMatches = 0;
  for (const term of coverTerms) {
    // Check both exact term and individual words
    const termWords = term.split(/\s+/);
    const hasMatch =
      questionLower.includes(term) ||
      termWords.some(word => word.length > 2 && questionLower.includes(word));

    if (hasMatch) {
      coversMatches++;
    }
  }

  if (coverTerms.length > 0) {
    score += (coversMatches / coverTerms.length) * 0.7;
  }

  // Check for matches in futureAdditions (secondary signal)
  let futureMatches = 0;
  for (const term of futureTerms) {
    if (questionLower.includes(term)) {
      futureMatches++;
    }
  }

  if (futureTerms.length > 0) {
    score += (futureMatches / futureTerms.length) * 0.2;
  }

  // Penalty for notIncluded matches
  for (const term of notIncludedTerms) {
    if (questionLower.includes(term)) {
      score -= 0.5;
    }
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Select the best skills for a batch of questions based on scope definitions.
 * Scores each skill against ALL questions and returns top candidates.
 *
 * @param questions - Array of question strings to analyze
 * @param scopeIndex - Scope index from getScopeIndex()
 * @param options - Configuration options
 * @returns Ranked array of matching skills
 */
export function selectSkillsForQuestions(
  questions: string[],
  scopeIndex: SkillScopeIndex[],
  options: {
    minScore?: number;   // Minimum score to include (0-1, default 0.1)
    maxSkills?: number;  // Max skills to return (default 10)
  } = {}
): ScopeMatchResult[] {
  const { minScore = 0.1, maxSkills = 10 } = options;

  if (questions.length === 0 || scopeIndex.length === 0) {
    return [];
  }

  // Score each skill against all questions
  const skillScores = scopeIndex.map(scope => {
    // Get scores for this skill against each question
    const scores = questions.map(q => scoreQuestionAgainstScope(q, scope));

    // Calculate aggregate score:
    // - Average score shows general fit
    // - Max score shows best-match potential
    // - Use weighted combination to prioritize skills that match multiple questions well
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const combinedScore = avgScore * 0.6 + maxScore * 0.4;

    // Track which scope terms were actually matched
    const matchedTerms = new Set<string>();
    const coverTerms = extractScopeTerms(scope.scopeDefinition?.covers);

    for (const term of coverTerms) {
      const matchCount = questions.filter(q =>
        q.toLowerCase().includes(term)
      ).length;
      if (matchCount > 0) {
        matchedTerms.add(term);
      }
    }

    return {
      skillId: scope.id,
      title: scope.title,
      score: combinedScore,
      matchedTerms: Array.from(matchedTerms),
    };
  });

  // Filter by minimum score, sort by score, limit to maxSkills
  return skillScores
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSkills);
}

/**
 * Analyze which skills would be selected for a question batch without selecting them.
 * Useful for preview/debugging.
 */
export function analyzeSkillCoverage(
  questions: string[],
  scopeIndex: SkillScopeIndex[]
): {
  selectedSkills: ScopeMatchResult[];
  uncoveredQuestions: Array<{ index: number; question: string }>;
  coveragePercent: number;
} {
  const selectedSkills = selectSkillsForQuestions(questions, scopeIndex, {
    minScore: 0,
    maxSkills: scopeIndex.length,
  });

  // Find questions not covered by any selected skill
  const uncovered = questions
    .map((q, i) => ({
      index: i,
      question: q,
      anyMatch: selectedSkills.some(
        skill =>
          scoreQuestionAgainstScope(q, scopeIndex.find(s => s.id === skill.skillId)!) > 0
      ),
    }))
    .filter(x => !x.anyMatch)
    .map(({ index, question }) => ({ index, question }));

  return {
    selectedSkills,
    uncoveredQuestions: uncovered,
    coveragePercent: Math.round(
      ((questions.length - uncovered.length) / questions.length) * 100
    ),
  };
}

/**
 * Get all skills ranked by match score for preview UI.
 * Returns every skill with its relevance score for the questions.
 * Useful for allowing users to manually select additional skills beyond AI recommendations.
 */
export function getAllSkillsWithScores(
  questions: string[],
  scopeIndex: SkillScopeIndex[]
): ScopeMatchResult[] {
  if (questions.length === 0 || scopeIndex.length === 0) {
    return [];
  }

  // Score each skill against all questions
  const skillScores = scopeIndex.map(scope => {
    // Get scores for this skill against each question
    const scores = questions.map(q => scoreQuestionAgainstScope(q, scope));

    // Calculate aggregate score
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const combinedScore = avgScore * 0.6 + maxScore * 0.4;

    // Track which scope terms were matched
    const matchedTerms = new Set<string>();
    const coverTerms = extractScopeTerms(scope.scopeDefinition?.covers);

    for (const term of coverTerms) {
      const matchCount = questions.filter(q =>
        q.toLowerCase().includes(term)
      ).length;
      if (matchCount > 0) {
        matchedTerms.add(term);
      }
    }

    return {
      skillId: scope.id,
      title: scope.title,
      score: combinedScore,
      matchedTerms: Array.from(matchedTerms),
    };
  });

  // Sort by score (highest first)
  return skillScores.sort((a, b) => b.score - a.score);
}

/**
 * Select skills for questions using LLM-based semantic matching.
 * Uses Claude to understand question intent and match against skill scopes.
 */
export async function selectSkillsForQuestionsWithLLM(
  questions: string[],
  scopeIndex: SkillScopeIndex[],
  libraryId: string,
  options: {
    maxSkills?: number;
  } = {}
): Promise<ScopeMatchResult[]> {
  const { maxSkills = 10 } = options;

  if (questions.length === 0 || scopeIndex.length === 0) {
    return [];
  }

  try {
    // Import here to avoid circular dependencies
    const { matchSourceToSkills } = await import('../skills/skill-generation-service');

    // Combine questions into a single prompt for LLM analysis
    const combinedQuestions = questions.join('\n- ');

    // Prepare skill data in the format matchSourceToSkills expects
    const existingSkills = scopeIndex.map(skill => ({
      id: skill.id,
      title: skill.title,
      scopeDefinition: skill.scopeDefinition,
    }));

    // Use LLM to match questions to skills
    const matchingOutput = await matchSourceToSkills({
      source: {
        id: 'batch_questions',
        type: 'rfp_batch',
        label: 'RFP Questions Batch',
        content: combinedQuestions,
      },
      existingSkills,
      libraryId: libraryId as LibraryId,
      additionalContext: 'These are RFP questions. Match them to the most relevant skills based on their scope definitions.',
    });

    // Convert LLM output format to ScopeMatchResult format
    return matchingOutput.matches
      .slice(0, maxSkills)
      .map((match) => ({
        skillId: match.skillId,
        title: match.skillTitle,
        score: match.confidence === 'high' ? 0.9 : match.confidence === 'medium' ? 0.6 : 0.3,
        matchedTerms: [match.reason.split('\n')[0]?.slice(0, 50) || 'Matched by LLM'],
      }));
  } catch (error) {
    // LLM-based matching failed - propagate error for user feedback
    throw new Error(
      `Failed to analyze questions with LLM: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
