/**
 * Source Assignment API
 *
 * POST /api/v2/assignments - Create a source assignment
 * DELETE /api/v2/assignments/[id] - Remove a source assignment
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceIds, stagedSourceId, blockId } = body;

    // Support both old (stagedSourceId) and new (sourceIds array) formats
    const sourceIdArray = sourceIds ? (Array.isArray(sourceIds) ? sourceIds : [sourceIds]) : stagedSourceId ? [stagedSourceId] : null;

    if (!sourceIdArray || sourceIdArray.length === 0 || !blockId) {
      return NextResponse.json(
        { error: 'Missing required fields: sourceIds/stagedSourceId, blockId' },
        { status: 400 }
      );
    }

    // Validate max 15 sources at once (same as generate endpoint)
    if (sourceIdArray.length > 15) {
      return NextResponse.json(
        { error: 'Cannot assign more than 15 sources at once' },
        { status: 400 }
      );
    }

    // Verify the block exists (include customer for path revalidation)
    const block = await prisma.buildingBlock.findUnique({
      where: { id: blockId },
      include: {
        customer: { select: { slug: true } },
      },
    });

    if (!block) {
      return NextResponse.json(
        { error: 'Building block not found' },
        { status: 404 }
      );
    }

    // Verify all staged sources exist and have content
    const stagedSources = await prisma.stagedSource.findMany({
      where: {
        id: { in: sourceIdArray },
      },
    });

    if (stagedSources.length !== sourceIdArray.length) {
      return NextResponse.json(
        { error: 'One or more staged sources not found' },
        { status: 404 }
      );
    }

    // Validate that sources match the block's library
    // For customer skills: allow library-scoped sources (customerId=null) or customer-scoped sources (customerId=block.customerId)
    // For other libraries: require exact scope match
    const sourcesWithWrongScope = stagedSources.filter((source) => {
      const libraryMatches = source.libraryId === block.libraryId;

      if (!libraryMatches) {
        return true; // Different library - always invalid
      }

      // Same library - check customerId
      if (block.libraryId === 'customers') {
        // For customer skills: allow library-scoped (null) or customer-scoped (same customerId)
        return source.customerId !== null && source.customerId !== block.customerId;
      } else {
        // For other libraries: require both to be null
        return source.customerId !== null || block.customerId !== null;
      }
    });

    if (sourcesWithWrongScope.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot assign sources from different library or customer scope',
          details: `Source(s) are from a different scope than the target skill`,
        },
        { status: 400 }
      );
    }

    // Validate sources have content
    const sourcesWithoutContent = stagedSources.filter(s => !s.content || s.content.trim().length === 0);
    if (sourcesWithoutContent.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot assign sources without content',
          details: `Sources ${sourcesWithoutContent.map(s => s.id).join(', ')} are missing content. Please refresh them first.`,
        },
        { status: 400 }
      );
    }

    // Use upsert to handle race conditions atomically
    // If assignment already exists (same stagedSourceId + blockId), return it
    // If not, create a new one with assignedBy set to current user
    // This prevents duplicate assignments from concurrent requests
    const assignments = await Promise.all(
      sourceIdArray.map((sourceId) =>
        prisma.sourceAssignment.upsert({
          where: {
            stagedSourceId_blockId: {
              stagedSourceId: sourceId,
              blockId,
            },
          },
          create: {
            stagedSourceId: sourceId,
            blockId,
            assignedBy: session.user.id,
          },
          update: {
            // Update is a no-op but required by upsert API
            assignedBy: session.user.id,
          },
          include: {
            stagedSource: true,
            block: true,
          },
        })
      )
    );

    // Revalidate the skill detail page to reflect source assignment changes
    // This ensures pending sources are removed and sourceAssignments are updated
    if (block.slug) {
      if (block.libraryId === 'customers' && block.customer?.slug) {
        // Customer skills need the customer slug in the path
        revalidatePath(`/v2/customers/${block.customer.slug}/skills/${block.slug}`);
      } else if (block.libraryId !== 'customers') {
        revalidatePath(`/v2/${block.libraryId}/${block.slug}`);
      }
    }

    return NextResponse.json(
      { assignments, count: assignments.length },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Assignment creation error', error, {
      route: '/api/v2/assignments',
    });

    // Handle known Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: Record<string, unknown> };

      if (prismaError.code === 'P2002') {
        // Unique constraint violation - assignment already exists
        return NextResponse.json(
          { error: 'Assignment already exists', details: 'This source is already assigned to this skill' },
          { status: 409 }
        );
      }

      if (prismaError.code === 'P2003') {
        // Foreign key constraint violation
        return NextResponse.json(
          { error: 'Invalid reference', details: 'The skill or source ID is invalid' },
          { status: 400 }
        );
      }
    }

    // Generic fallback for unexpected errors
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to create assignment', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create assignment', details: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
