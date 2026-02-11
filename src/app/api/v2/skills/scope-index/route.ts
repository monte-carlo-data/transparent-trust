/**
 * GET /api/v2/skills/scope-index
 *
 * Returns lightweight skill scope data for client-side keyword matching.
 * Includes skill ID, title, and scope keywords for quick matching.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { canAccessLibrary } from '@/lib/v2/teams';
import { getScopeIndex } from '@/lib/v2/blocks/block-service';
import type { LibraryId } from '@/types/v2';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get library from query params
    const { searchParams } = new URL(request.url);
    const libraryId = searchParams.get('libraryId') as LibraryId;

    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId query parameter is required' },
        { status: 400 }
      );
    }

    // Check library access
    const hasAccess = await canAccessLibrary(session.user.id, libraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    // Get scope index (lightweight skill data)
    const scopeIndex = await getScopeIndex([libraryId]);

    // Transform to client-friendly format
    const skills = scopeIndex.map(skill => ({
      id: skill.id,
      title: skill.title,
      keywords: skill.scopeDefinition?.keywords || [],
      scopeCovers: skill.scopeDefinition?.covers || '',
    }));

    return NextResponse.json({
      skills,
      total: skills.length,
    });
  } catch (error) {
    console.error('[Scope Index API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scope index' },
      { status: 500 }
    );
  }
}
