import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth-v2';

/**
 * GET /api/v2/accuracy/feedback
 *
 * Returns recent corrections and feedback items
 * Query params:
 *   - source: 'rfp' | 'chat' | 'contract' | 'all' (default: 'all')
 *   - limit: number (default: 10)
 */

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const source = searchParams.get('source') || 'all';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get flagged/corrected items from question history
    const questionHistory = await prisma.v2QuestionHistory.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { flaggedForReview: true },
          { reviewStatus: { not: null } },
        ],
      },
      select: {
        id: true,
        question: true,
        outputData: true,
        flagNote: true,
        flaggedForReview: true,
        reviewStatus: true,
        userEditedAnswer: true,
        flaggedAt: true,
        reviewedAt: true,
        reviewedBy: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get user's projects first
    const userProjects = await prisma.bulkProject.findMany({
      where: {
        ownerId: session.user.id,
      },
      select: {
        id: true,
      },
    });

    const projectIds = userProjects.map((p) => p.id);

    // Get flagged/corrected items from bulk rows
    const bulkRows = projectIds.length > 0 ? await prisma.bulkRow.findMany({
      where: {
        projectId: {
          in: projectIds,
        },
        OR: [
          { flaggedForReview: true },
          { reviewStatus: { not: null } },
        ],
      },
      select: {
        id: true,
        inputData: true,
        outputData: true,
        flagNote: true,
        flaggedForReview: true,
        reviewStatus: true,
        userEditedAnswer: true,
        flaggedAt: true,
        reviewedAt: true,
        reviewedBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) : [];

    // Convert to feedback items
    const items = [
      ...questionHistory.map((item) => ({
        id: item.id,
        type: item.reviewStatus === 'CORRECTED' ? ('correction' as const) : item.flaggedForReview ? ('flag' as const) : ('approved' as const),
        source: 'chat' as const,
        question: item.question,
        originalAnswer: typeof item.outputData === 'object' && item.outputData ? (item.outputData as Record<string, unknown>).response as string : undefined,
        correctedAnswer: item.userEditedAnswer || undefined,
        note: item.flagNote || undefined,
        user: item.reviewedBy || undefined,
        createdAt: (item.reviewedAt || item.flaggedAt || new Date()).toISOString(),
      })),
      ...bulkRows.map((item) => ({
        id: item.id,
        type: item.reviewStatus === 'CORRECTED' ? ('correction' as const) : item.flaggedForReview ? ('flag' as const) : ('approved' as const),
        source: 'rfp' as const,
        question: typeof item.inputData === 'object' && item.inputData ? (item.inputData as Record<string, unknown>).question as string : 'Question',
        originalAnswer: typeof item.outputData === 'object' && item.outputData ? (item.outputData as Record<string, unknown>).response as string : undefined,
        correctedAnswer: item.userEditedAnswer || undefined,
        note: item.flagNote || undefined,
        user: item.reviewedBy || undefined,
        createdAt: (item.reviewedAt || item.flaggedAt || new Date()).toISOString(),
      })),
    ];

    // Filter by source if specified
    let filteredItems = items;
    if (source !== 'all') {
      filteredItems = items.filter((item) => item.source === source);
    }

    // Sort by date and limit
    const sortedItems = filteredItems
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        items: sortedItems,
      },
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
