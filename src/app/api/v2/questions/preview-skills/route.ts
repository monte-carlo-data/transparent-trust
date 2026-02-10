/**
 * Preview skills endpoint for single questions
 *
 * POST /api/v2/questions/preview-skills
 *
 * Analyzes which skills would be selected for a question.
 * Returns AI recommendations + all skills ranked by relevance.
 * Part of the "AI suggests → Human reviews → Approves → Executes" pattern.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { getScopeIndex } from '@/lib/v2/blocks/block-service';
import { selectSkillsForQuestions } from '@/lib/v2/questions/skill-selection-service';
import type { LibraryId } from '@/types/v2';
import { z } from 'zod';

const previewSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  context: z.string().optional(),
  library: z.string().default('knowledge'),
  maxSkills: z.number().int().min(1).max(30).default(10),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = previewSchema.safeParse(body);

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || 'Invalid request');
    }

    const { question, context, library, maxSkills } = parsed.data;

    // Map library to libraryId
    const libraryMap: Record<string, LibraryId> = {
      skills: 'knowledge',
      knowledge: 'knowledge',
      it: 'it',
      gtm: 'gtm',
    };
    const libraryId = libraryMap[library.toLowerCase()] || 'knowledge';

    // Get scope index (lightweight skill data)
    const scopeIndex = await getScopeIndex([libraryId]);

    if (scopeIndex.length === 0) {
      return apiSuccess({
        success: true,
        data: {
          totalQuestions: 1,
          totalSkillsAvailable: 0,
          recommendations: [],
          allSkills: [],
          coverage: {
            recommendedCount: 0,
            totalSkills: 0,
            avgRecommendedScore: '0',
          },
          message: 'No skills available in the selected library',
        },
      });
    }

    // Prepare question (optionally with context)
    const fullQuestion = context
      ? `Context: ${context}\n\nQuestion: ${question}`
      : question;

    // Use unified skill selection service in preview mode
    try {
      const result = await selectSkillsForQuestions({
        questions: [fullQuestion],
        scopeIndex,
        libraryId,
        mode: 'preview',
        options: { maxSkills },
      });

      if (result.mode !== 'preview') {
        throw new Error('Unexpected result mode');
      }

      logger.info(`Previewed skills for question`, {
        library: libraryId,
        recommendedCount: result.recommendations.length,
      });

      return apiSuccess({
        success: true,
        data: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Skill selection failed', { error: errorMessage, question: question.slice(0, 100) });

      return errors.internal('Failed to analyze question - please try again');
    }
  } catch (error) {
    logger.error('Preview skills error', error, { route: '/api/v2/questions/preview-skills' });
    return errors.internal('Failed to preview skills for question');
  }
}
