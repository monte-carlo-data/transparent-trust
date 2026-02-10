/**
 * POST /api/v2/sources/quick-assign
 *
 * Quick assign a source to a skill without LLM matching.
 * Creates a source assignment and optionally marks for incorporation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { canManageLibrary } from '@/lib/v2/teams';
import { assignSourceToBlock } from '@/lib/v2/sources/staged-source-service';
import { checkRateLimit, getResetTime } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { LibraryId } from '@/types/v2';

interface QuickAssignRequest {
  sourceId: string;
  skillId: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 10 assignments per user per minute
    const rateLimitKey = `quick-assign:${session.user.id}`;
    if (!checkRateLimit(rateLimitKey, 10, 60000)) {
      const resetTime = getResetTime(rateLimitKey);
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 assignments per minute.' },
        {
          status: 429,
          headers: {
            'Retry-After': resetTime ? Math.ceil((resetTime - Date.now()) / 1000).toString() : '60',
          },
        }
      );
    }

    const body: QuickAssignRequest = await request.json();
    const { sourceId, skillId, notes } = body;

    // Validate inputs
    if (!sourceId || !skillId) {
      return NextResponse.json(
        { error: 'sourceId and skillId are required' },
        { status: 400 }
      );
    }

    // Fetch source to get library ID
    const source = await prisma.stagedSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, source.libraryId as LibraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this library' },
        { status: 403 }
      );
    }

    // Verify skill exists and belongs to same library
    const skill = await prisma.buildingBlock.findUnique({
      where: { id: skillId },
      select: { id: true, title: true, libraryId: true },
    });

    if (!skill) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    if (skill.libraryId !== source.libraryId) {
      return NextResponse.json(
        { error: 'Source and skill must belong to the same library' },
        { status: 400 }
      );
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.sourceAssignment.findFirst({
      where: {
        stagedSourceId: sourceId,
        blockId: skillId,
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Source is already assigned to this skill' },
        { status: 409 }
      );
    }

    // Create the assignment
    const assignment = await assignSourceToBlock({
      stagedSourceId: sourceId,
      blockId: skillId,
      assignedBy: session.user.id,
      notes: notes || `Quick assigned via keyword match`,
    });

    logger.info('[Quick Assign] Success', {
      sourceId,
      skillId,
      skillTitle: skill.title,
      assignmentId: assignment.id,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      assignment: {
        id: assignment.id,
        sourceId,
        skillId,
        skillTitle: skill.title,
        assignedAt: assignment.assignedAt,
      },
    });
  } catch (error) {
    logger.error('[Quick Assign API] Error', error);
    return NextResponse.json(
      { error: 'Failed to assign source' },
      { status: 500 }
    );
  }
}
