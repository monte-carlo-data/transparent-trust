/**
 * Unified Reviews API
 *
 * GET /api/v2/reviews - List all review items across sources
 * Query params:
 *   - type: 'pending' | 'flagged' | 'resolved' | 'approved' | 'corrected' | 'all'
 *   - source: 'project' | 'question' | 'all'
 *   - limit: number (default 50)
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import prisma from '@/lib/prisma';

interface ReviewItem {
  id: string;
  source: 'project' | 'question';
  sourceId: string; // projectId for project rows
  rowNumber: number | null;
  question: string | null;
  response: string | null;
  confidence: string | null;
  reviewStatus: string | null;
  reviewRequestedAt: string | null;
  reviewRequestedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  flaggedForReview: boolean;
  flaggedAt: string | null;
  flaggedBy: string | null;
  flagNote: string | null;
  flagResolved: boolean;
  flagResolvedAt: string | null;
  flagResolvedBy: string | null;
  flagResolutionNote: string | null;
  userEditedAnswer: string | null;
  projectName: string | null;
  customerName: string | null;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const userId = auth.session.user.id;
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'pending';
  const source = searchParams.get('source') || 'all';
  const libraryId = searchParams.get('libraryId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  try {
    const reviews: ReviewItem[] = [];

    // Build where clause for project rows
    if (source === 'all' || source === 'project') {
      const projectWhere: Record<string, unknown> = {
        project: { ownerId: userId },
      };

      // If libraryId is specified, filter projects by library
      if (libraryId) {
        projectWhere.project = {
          ownerId: userId,
          config: { path: ['library'], equals: libraryId },
        };
      }

      // Filter by review type
      if (type === 'pending') {
        projectWhere.reviewStatus = 'REQUESTED';
        projectWhere.flaggedForReview = false;
      } else if (type === 'flagged') {
        projectWhere.flaggedForReview = true;
        projectWhere.flagResolved = false;
      } else if (type === 'resolved') {
        projectWhere.flaggedForReview = true;
        projectWhere.flagResolved = true;
      } else if (type === 'approved') {
        projectWhere.reviewStatus = 'APPROVED';
      } else if (type === 'corrected') {
        projectWhere.reviewStatus = 'CORRECTED';
      }
      // 'all' = no additional filters

      const projectRows = await prisma.bulkRow.findMany({
        where: projectWhere,
        include: {
          project: {
            select: { id: true, name: true, config: true },
          },
        },
        orderBy: { processedAt: 'desc' },
        take: limit,
      });

      for (const row of projectRows) {
        const inputData = row.inputData as Record<string, unknown> | null;
        const outputData = row.outputData as Record<string, unknown> | null;
        const config = row.project?.config as Record<string, unknown> | null;

        reviews.push({
          id: row.id,
          source: 'project',
          sourceId: row.project?.id || '',
          rowNumber: row.rowNumber,
          question: (inputData?.question as string) || null,
          response: (outputData?.response as string) || null,
          confidence: (outputData?.confidence as string) || null,
          reviewStatus: row.reviewStatus,
          reviewRequestedAt: row.reviewRequestedAt?.toISOString() || null,
          reviewRequestedBy: row.reviewRequestedBy,
          reviewNote: row.reviewNote,
          reviewedAt: row.reviewedAt?.toISOString() || null,
          reviewedBy: row.reviewedBy,
          flaggedForReview: row.flaggedForReview,
          flaggedAt: row.flaggedAt?.toISOString() || null,
          flaggedBy: row.flaggedBy,
          flagNote: row.flagNote,
          flagResolved: row.flagResolved || false,
          flagResolvedAt: row.flagResolvedAt?.toISOString() || null,
          flagResolvedBy: row.flagResolvedBy,
          flagResolutionNote: row.flagResolutionNote,
          userEditedAnswer: row.userEditedAnswer,
          projectName: row.project?.name || null,
          customerName: (config?.customerName as string) || null,
          createdAt: row.processedAt?.toISOString() || row.createdAt.toISOString(),
        });
      }
    }

    // Build where clause for questions (V2QuestionHistory)
    if (source === 'all' || source === 'question') {
      const questionWhere: Record<string, unknown> = {
        userId: userId,
      };

      // If libraryId is specified, filter questions by library
      if (libraryId) {
        questionWhere.library = libraryId;
      }

      if (type === 'pending') {
        questionWhere.reviewStatus = 'REQUESTED';
        questionWhere.flaggedForReview = false;
      } else if (type === 'flagged') {
        questionWhere.flaggedForReview = true;
        questionWhere.flagResolved = false;
      } else if (type === 'resolved') {
        questionWhere.flaggedForReview = true;
        questionWhere.flagResolved = true;
      } else if (type === 'approved') {
        questionWhere.reviewStatus = 'APPROVED';
      } else if (type === 'corrected') {
        questionWhere.reviewStatus = 'CORRECTED';
      }

      const questions = await prisma.v2QuestionHistory.findMany({
        where: questionWhere,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      for (const q of questions) {
        const outputData = q.outputData as Record<string, unknown> | null;

        reviews.push({
          id: q.id,
          source: 'question',
          sourceId: q.id,
          rowNumber: null,
          question: q.question,
          response: (outputData?.response as string) || null,
          confidence: (outputData?.confidence as string) || null,
          reviewStatus: q.reviewStatus,
          reviewRequestedAt: q.reviewRequestedAt?.toISOString() || null,
          reviewRequestedBy: q.reviewRequestedBy,
          reviewNote: q.reviewNote,
          reviewedAt: q.reviewedAt?.toISOString() || null,
          reviewedBy: q.reviewedBy,
          flaggedForReview: q.flaggedForReview,
          flaggedAt: q.flaggedAt?.toISOString() || null,
          flaggedBy: q.flaggedBy,
          flagNote: q.flagNote,
          flagResolved: q.flagResolved || false,
          flagResolvedAt: q.flagResolvedAt?.toISOString() || null,
          flagResolvedBy: q.flagResolvedBy,
          flagResolutionNote: q.flagResolutionNote,
          userEditedAnswer: q.userEditedAnswer,
          projectName: null,
          customerName: null,
          createdAt: q.createdAt.toISOString(),
        });
      }
    }

    // Sort combined results by date
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Get user's projects for filtering
    const projectFilter: Record<string, unknown> = { ownerId: userId };
    if (libraryId) {
      projectFilter.config = { path: ['library'], equals: libraryId };
    }

    const userProjectIds = (await prisma.bulkProject.findMany({
      where: projectFilter,
      select: { id: true },
    })).map((p) => p.id);

    // Count totals for each type (from both project rows and questions)
    const [
      projectPendingCount,
      projectFlaggedCount,
      projectResolvedCount,
      projectApprovedCount,
      projectCorrectedCount,
      questionPendingCount,
      questionFlaggedCount,
      questionResolvedCount,
      questionApprovedCount,
      questionCorrectedCount,
    ] = await Promise.all([
      prisma.bulkRow.count({
        where: { projectId: { in: userProjectIds }, reviewStatus: 'REQUESTED', flaggedForReview: false },
      }),
      prisma.bulkRow.count({
        where: { projectId: { in: userProjectIds }, flaggedForReview: true, flagResolved: false },
      }),
      prisma.bulkRow.count({
        where: { projectId: { in: userProjectIds }, flaggedForReview: true, flagResolved: true },
      }),
      prisma.bulkRow.count({
        where: { projectId: { in: userProjectIds }, reviewStatus: 'APPROVED' },
      }),
      prisma.bulkRow.count({
        where: { projectId: { in: userProjectIds }, reviewStatus: 'CORRECTED' },
      }),
      prisma.v2QuestionHistory.count({
        where: { userId: userId, reviewStatus: 'REQUESTED', flaggedForReview: false, ...(libraryId && { library: libraryId }) },
      }),
      prisma.v2QuestionHistory.count({
        where: { userId: userId, flaggedForReview: true, flagResolved: false, ...(libraryId && { library: libraryId }) },
      }),
      prisma.v2QuestionHistory.count({
        where: { userId: userId, flaggedForReview: true, flagResolved: true, ...(libraryId && { library: libraryId }) },
      }),
      prisma.v2QuestionHistory.count({
        where: { userId: userId, reviewStatus: 'APPROVED', ...(libraryId && { library: libraryId }) },
      }),
      prisma.v2QuestionHistory.count({
        where: { userId: userId, reviewStatus: 'CORRECTED', ...(libraryId && { library: libraryId }) },
      }),
    ]);

    const pendingCount = projectPendingCount + questionPendingCount;
    const flaggedCount = projectFlaggedCount + questionFlaggedCount;
    const resolvedCount = projectResolvedCount + questionResolvedCount;
    const approvedCount = projectApprovedCount + questionApprovedCount;
    const correctedCount = projectCorrectedCount + questionCorrectedCount;

    return apiSuccess({
      reviews: reviews.slice(0, limit),
      counts: {
        pending: pendingCount,
        flagged: flaggedCount,
        resolved: resolvedCount,
        approved: approvedCount,
        corrected: correctedCount,
      },
    });
  } catch (error) {
    console.error('Reviews fetch error:', error);
    return errors.internal('Failed to fetch reviews');
  }
}
