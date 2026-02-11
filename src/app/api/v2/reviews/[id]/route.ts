/**
 * Unified Review Update API
 *
 * PATCH /api/v2/reviews/[id] - Update a review item (approve, mark corrected, resolve flag, etc.)
 * Body:
 *   - reviewStatus?: 'APPROVED' | 'CORRECTED' (for project rows)
 *   - reviewNote?: string
 *   - flagResolved?: boolean (for flagged items)
 *   - flagResolutionNote?: string
 *   - source: 'project' | 'question' (required)
 *   - projectId?: string (required if source='project')
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
    const { source, projectId, reviewStatus, flagResolved, flagResolutionNote, note } = body;

    if (!source || !['project', 'question'].includes(source)) {
      return errors.badRequest('source is required and must be "project" or "question"');
    }

    // note field may come as 'note' from the client
    const resolutionNote = note || flagResolutionNote;

    if (source === 'project') {
      // Update a bulk row (project source)
      if (!projectId) {
        return errors.badRequest('projectId is required for project source');
      }

      // Verify user owns this project AND the row belongs to that project
      const project = await prisma.bulkProject.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      });

      if (!project || project.ownerId !== userId) {
        return errors.notFound('Project not found');
      }

      // Verify the row belongs to this project
      const row = await prisma.bulkRow.findFirst({
        where: { id, projectId },
      });

      if (!row) {
        return errors.notFound('Row not found or does not belong to this project');
      }

      // Update the bulk row
      const updates: Record<string, unknown> = {};

      if (reviewStatus && ['APPROVED', 'CORRECTED'].includes(reviewStatus)) {
        updates.reviewStatus = reviewStatus;
        updates.reviewedAt = new Date();
        updates.reviewedBy = userId;
      }

      if (flagResolved !== undefined) {
        updates.flagResolved = flagResolved;
        if (flagResolved) {
          updates.flagResolvedAt = new Date();
          updates.flagResolvedBy = userId;
          if (resolutionNote) {
            updates.flagResolutionNote = resolutionNote;
          }
        }
      }

      const updatedRow = await prisma.bulkRow.update({
        where: { id },
        data: updates,
      });

      return apiSuccess({ id: updatedRow.id, source: 'project' });
    } else {
      // Update a question history (question source)
      // Verify user owns this question
      const question = await prisma.v2QuestionHistory.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!question || question.userId !== userId) {
        return errors.notFound('Question not found');
      }

      // Update the question
      const updates: Record<string, unknown> = {};

      if (reviewStatus && ['APPROVED', 'CORRECTED'].includes(reviewStatus)) {
        updates.reviewStatus = reviewStatus;
        updates.reviewedAt = new Date();
        updates.reviewedBy = userId;
      }

      if (flagResolved !== undefined) {
        updates.flagResolved = flagResolved;
        if (flagResolved) {
          updates.flagResolvedAt = new Date();
          updates.flagResolvedBy = userId;
          if (resolutionNote) {
            updates.flagResolutionNote = resolutionNote;
          }
        }
      }

      const updatedQuestion = await prisma.v2QuestionHistory.update({
        where: { id },
        data: updates,
      });

      return apiSuccess({ id: updatedQuestion.id, source: 'question' });
    }
  } catch (error) {
    console.error('Review update error:', error);
    return errors.internal('Failed to update review');
  }
}
