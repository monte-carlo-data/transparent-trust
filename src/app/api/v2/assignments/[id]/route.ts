/**
 * Source Assignment Detail API
 *
 * DELETE /api/v2/assignments/[id] - Remove a source assignment
 * PATCH /api/v2/assignments/[id] - Update assignment (mark as incorporated)
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify the assignment exists
    const assignment = await prisma.sourceAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Delete the assignment
    await prisma.sourceAssignment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Assignment deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete assignment' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { incorporatedAt } = body;

    // Verify the assignment exists
    const assignment = await prisma.sourceAssignment.findUnique({
      where: { id },
      include: {
        stagedSource: true,
        block: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Update the assignment
    const updated = await prisma.sourceAssignment.update({
      where: { id },
      data: {
        incorporatedAt: incorporatedAt ? new Date(incorporatedAt) : null,
        incorporatedBy: incorporatedAt ? (session.user.email || 'unknown') : null,
      },
      include: {
        stagedSource: true,
        block: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Assignment update error:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    );
  }
}
