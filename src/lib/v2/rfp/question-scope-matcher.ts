/**
 * Skill Matcher for RFP Questions
 *
 * LLM-based skill matching that evaluates ALL skills against questions.
 * No clustering - all questions use the same skill set for simplicity.
 */

import { logger } from '@/lib/logger';
import { generateErrorId } from '@/lib/error-id';
import { executeLLMCall } from '@/lib/llm/registry';
import type { LibraryId } from '@/types/v2';

// ============================================================================
// Types
// ============================================================================

export interface QuestionInfo {
  id: string;
  question: string;
  context?: string;
  category?: string;
  originalSheetName?: string;
}

export interface SkillInfo {
  id: string;
  title: string;
  scopeCovers: string;
}

export interface SkillMatch {
  skillId: string;
  skillTitle: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface MatchSkillsToQuestionsRequest {
  projectId: string;
  questions: QuestionInfo[];
  skills: SkillInfo[];
  libraryId: LibraryId;
  fileContext?: string;
}

export interface MatchSkillsToQuestionsResult {
  skills: SkillMatch[];
  questionCount: number;
  transparency: {
    projectId: string;
    totalQuestions: number;
    totalSkillsEvaluated: number;
    compositionId: string;
    modelUsed: string;
    tokensUsed?: number;
    systemPrompt?: string;
    blockIds?: string[];
  };
}

// ============================================================================
// Main Matching Function
// ============================================================================

/**
 * Match skills to ALL questions without clustering.
 *
 * Returns ALL skills with LLM opinions on which are relevant.
 * Skills get one of these confidence levels:
 * - high: LLM says directly answers questions
 * - medium: LLM says provides context
 * - low: LLM says tangentially related
 *
 * User selects which skills to use, then all questions are processed
 * with the same skill set (chunked into batches by caller).
 */
export async function matchSkillsToAllQuestions(
  request: MatchSkillsToQuestionsRequest
): Promise<MatchSkillsToQuestionsResult> {
  const { projectId, questions, skills, libraryId, fileContext } = request;

  logger.info('Starting skill matching for all questions', {
    projectId,
    questionCount: questions.length,
    skillCount: skills.length,
    libraryId,
    hasFileContext: !!fileContext,
  });

  // Build skill scopes for matching prompt (only skills that fit in context window)
  // We'll match relevant ones via LLM, then assign low confidence to unmatched skills
  const skillScopes = skills
    .map(skill => `- ${skill.title} (ID: ${skill.id}): ${skill.scopeCovers}`)
    .join('\n');

  // Build question preview (first 30 for context)
  const questionPreview = questions
    .slice(0, 30)
    .map((q, i) => `${i + 1}. ${q.question}`)
    .join('\n');

  // Build the matching prompt
  const userPrompt = `## Skill Matching Task

You are matching RFP/questionnaire questions to relevant skills based on skill scope definitions.

### Available Skills (${skills.length} total)
${skillScopes}

### Questions to Answer (showing first 30 of ${questions.length})
${questionPreview}
${questions.length > 30 ? `\n... and ${questions.length - 30} more questions` : ''}

${fileContext ? `### File Context\n${fileContext.substring(0, 3000)}${fileContext.length > 3000 ? '...(truncated)' : ''}` : ''}

### Your Task
Evaluate each skill and determine if it can help answer these questions.

Return a JSON array of skills that you identify as relevant, with confidence levels:
- "high": Skill directly answers multiple questions
- "medium": Skill provides useful context for some questions
- "low": Skill is tangentially related

Only return skills that have some relevance to the questions. Skills not in your response will be assigned low confidence by default.

Return format:
[
  {
    "skillId": "skill_id_here",
    "skillTitle": "Skill Title",
    "confidence": "high",
    "reason": "Brief explanation why this skill is relevant"
  }
]

Return ONLY the JSON array, no other text.`;

  // Make LLM call
  const result = await executeLLMCall({
    question: userPrompt,
    compositionId: 'rfp_skill_matching',
    skills: [],
    modelSpeed: 'quality',
    runtimeContext: {},
  });

  // Parse response - this gives us LLM-matched skills
  const llmMatchedSkills = parseMatchingResponse(result.answer, skills);

  // Assign all skills: LLM matches keep their confidence, unmatched get 'low'
  const allSkillsWithConfidence: SkillMatch[] = skills.map(skill => {
    const llmMatch = llmMatchedSkills.find(m => m.skillId === skill.id);
    if (llmMatch) {
      return llmMatch;
    }
    // Unmatched skills get low confidence
    return {
      skillId: skill.id,
      skillTitle: skill.title,
      confidence: 'low',
      reason: 'Not identified as relevant by matching analysis',
    };
  });

  // Sort by confidence (high > medium > low) for display
  const confidenceOrder: Record<SkillMatch['confidence'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  allSkillsWithConfidence.sort(
    (a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
  );

  logger.info('Skill matching complete', {
    projectId,
    totalSkills: allSkillsWithConfidence.length,
    llmMatchedSkills: llmMatchedSkills.length,
    highConfidence: allSkillsWithConfidence.filter(s => s.confidence === 'high').length,
    mediumConfidence: allSkillsWithConfidence.filter(s => s.confidence === 'medium').length,
    lowConfidence: allSkillsWithConfidence.filter(s => s.confidence === 'low').length,
  });

  return {
    skills: allSkillsWithConfidence,
    questionCount: questions.length,
    transparency: {
      projectId,
      totalQuestions: questions.length,
      totalSkillsEvaluated: skills.length,
      compositionId: 'rfp_skill_matching',
      modelUsed: result.usage?.model || 'claude-sonnet-4',
      tokensUsed: result.usage
        ? result.usage.inputTokens + result.usage.outputTokens
        : undefined,
      systemPrompt: result.transparency.systemPrompt,
      blockIds: result.transparency.blockIds,
    },
  };
}

// ============================================================================
// Response Parsing
// ============================================================================

function parseMatchingResponse(answer: string, skills: SkillInfo[]): SkillMatch[] {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = answer.trim();
    if (jsonStr.startsWith('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonStr = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonStr) as SkillMatch[];

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    // Validate and filter to known skills
    const skillIds = new Set(skills.map(s => s.id));
    const validSkills = parsed.filter(
      skill =>
        skill &&
        typeof skill.skillId === 'string' &&
        skillIds.has(skill.skillId) &&
        ['high', 'medium', 'low'].includes(skill.confidence)
    );

    // Sort by confidence (high > medium > low)
    const confidenceOrder: Record<SkillMatch['confidence'], number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    validSkills.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);

    return validSkills;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const responsePreview = answer.substring(0, 500);
    const errorId = generateErrorId();

    logger.error('Failed to parse skill matching response', error, {
      answer: responsePreview,
      answerLength: answer.length,
      parseError: errorMessage,
      errorId,
      skillCount: skills.length,
    });

    throw new Error(
      `Failed to parse skill matching results. The LLM returned an unexpected response format. ` +
      `Error: ${errorMessage}. Response preview: ${responsePreview.substring(0, 100)}... [${errorId}]`
    );
  }
}
