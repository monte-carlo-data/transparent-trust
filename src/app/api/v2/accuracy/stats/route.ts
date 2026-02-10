import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth-v2';

/**
 * GET /api/v2/accuracy/stats
 *
 * Returns accuracy metrics for the current user/team
 * Query params:
 *   - days: 7, 30, or 90 (default: 30)
 *   - libraryId: filter by library (optional)
 */

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const libraryId = searchParams.get('libraryId');

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Build query filters
    const whereClause: Record<string, unknown> = {
      userId: session.user.id,
      createdAt: {
        gte: sinceDate,
      },
    };

    if (libraryId) {
      whereClause.library = libraryId;
    }

    // Get question history stats
    const questionHistory = await prisma.v2QuestionHistory.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        flaggedForReview: true,
        reviewStatus: true,
        createdAt: true,
      },
    });

    // Get bulk project row stats - get user's projects first
    const userProjects = await prisma.bulkProject.findMany({
      where: {
        ownerId: session.user.id,
      },
      select: {
        id: true,
      },
    });

    const projectIds = userProjects.map((p) => p.id);

    const bulkRows = projectIds.length > 0 ? await prisma.bulkRow.findMany({
      where: {
        projectId: {
          in: projectIds,
        },
        processedAt: {
          gte: sinceDate,
        },
      },
      select: {
        id: true,
        status: true,
        flaggedForReview: true,
        reviewStatus: true,
        processedAt: true,
      },
    }) : [];

    // Normalize items for processing
    const questionItems = questionHistory.map((item) => ({
      ...item,
      dateField: item.createdAt,
    }));
    const bulkItems = bulkRows.map((item) => ({
      ...item,
      dateField: item.processedAt,
    }));
    const allItems = [...questionItems, ...bulkItems];

    // Calculate stats
    const totalCount = allItems.length;
    const completedCount = allItems.filter((item) => item.status === 'COMPLETED').length;
    const flaggedCount = allItems.filter((item) => item.flaggedForReview).length;
    const reviewedCount = allItems.filter(
      (item) => item.reviewStatus === 'APPROVED' || item.reviewStatus === 'CORRECTED'
    ).length;
    const correctedCount = allItems.filter((item) => item.reviewStatus === 'CORRECTED').length;

    const accuracyPercent = completedCount > 0 ? Math.round(((completedCount - correctedCount) / completedCount) * 100) : 0;

    // Group by day for trend
    const trend: Record<string, { date: string; accuracy: number; count: number }> = {};
    allItems.forEach((item) => {
      const dateField = item.dateField || new Date();
      const date = new Date(dateField);
      const dateStr = date.toISOString().split('T')[0];

      if (!trend[dateStr]) {
        trend[dateStr] = { date: dateStr, accuracy: 0, count: 0 };
      }

      trend[dateStr].count += 1;
      if (item.status === 'COMPLETED' && item.reviewStatus !== 'CORRECTED') {
        trend[dateStr].accuracy += 1;
      }
    });

    const trendArray = Object.values(trend)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((t) => ({
        date: t.date,
        accuracy: t.count > 0 ? Math.round((t.accuracy / t.count) * 100) : 0,
        count: t.count,
      }));

    return NextResponse.json({
      success: true,
      data: {
        period: { days, since: sinceDate.toISOString() },
        summary: {
          totalQuestions: totalCount,
          completedQuestions: completedCount,
          accuracyPercent,
          flaggedForReview: flaggedCount,
          reviewedCount,
          correctedCount,
        },
        trend: trendArray,
      },
    });
  } catch (error) {
    console.error('Error fetching accuracy stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
