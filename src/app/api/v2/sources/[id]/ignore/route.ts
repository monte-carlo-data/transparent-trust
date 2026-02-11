/**
 * Ignore Source Endpoint
 *
 * POST /api/v2/sources/[id]/ignore
 * Marks a staged source as ignored
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { canManageLibrary } from '@/lib/v2/teams';
import { NextRequest, NextResponse } from 'next/server';
import type { LibraryId } from '@/types/v2';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify source exists
    const source = await prisma.stagedSource.findUnique({
      where: { id },
      select: { id: true, libraryId: true, ignoredAt: true, ignoredBy: true },
    });

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Authorize: user must have manage access to the library
    const hasAccess = await canManageLibrary(session.user.id, source.libraryId as LibraryId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Mark as ignored
    const updated = await prisma.stagedSource.update({
      where: { id },
      data: {
        ignoredAt: new Date(),
        ignoredBy: session.user.email,
      },
    });

    return NextResponse.json({
      id: updated.id,
      message: 'Source ignored',
    });
  } catch (error) {
    console.error('Error ignoring source:', error);
    return NextResponse.json(
      { error: 'Failed to ignore source' },
      { status: 500 }
    );
  }
}
