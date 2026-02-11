/**
 * Question Update API
 *
 * PATCH /api/v2/questions/[id] - Update a question (flag for review, approve, edit, etc.)
 * This is a convenience endpoint that proxies to /api/v2/reviews/[id] with source='question'
 *
 * Body:
 *   - flaggedForReview?: boolean
 *   - reviewStatus?: 'APPROVED' | 'CORRECTED'
 *   - userEditedAnswer?: string
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import prisma from '@/lib/prisma';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const userId = auth.session.user.id;
  const { id } = await params;

  try {
    const body = await request.json();
    const { flaggedForReview, reviewStatus, userEditedAnswer } = body;

    // Fetch the question to verify user can update it
    const question = await prisma.v2QuestionHistory.findUnique({
      where: { id },
    });

    if (!question) {
      return errors.notFound('Question not found');
    }

    // Verify user owns this question
    if (question.userId !== userId) {
      return errors.notFound('Question not found');
    }

    // Build updates
    const updates: Record<string, unknown> = {};

    if (flaggedForReview !== undefined) {
      updates.flaggedForReview = flaggedForReview;
      if (flaggedForReview && !question.flaggedAt) {
        updates.flaggedAt = new Date();
        updates.flaggedBy = userId;
      }
    }

    if (reviewStatus && ['APPROVED', 'CORRECTED'].includes(reviewStatus)) {
      updates.reviewStatus = reviewStatus;
      updates.reviewedAt = new Date();
      updates.reviewedBy = userId;
    }

    if (userEditedAnswer !== undefined) {
      updates.userEditedAnswer = userEditedAnswer;
    }

    if (Object.keys(updates).length === 0) {
      return apiSuccess({
        success: true,
        data: { question },
      });
    }

    // Apply updates
    const updated = await prisma.v2QuestionHistory.update({
      where: { id },
      data: updates,
    });

    return apiSuccess({
      success: true,
      data: { question: updated },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update question';
    return errors.internal(errorMessage);
  }
}
