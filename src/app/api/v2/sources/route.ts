/**
 * GET /api/v2/sources - List staged sources with filters
 * POST /api/v2/sources - Stage a new source
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { stageSource, querySources, getInboxCounts } from '@/lib/v2/sources';
import { canManageLibrary, canAccessLibrary } from '@/lib/v2/teams';
import type { StageSourceInput, SourceQueryOptions, LibraryId, SourceType } from '@/types/v2';
import { LIBRARY_IDS, SOURCE_TYPES } from '@/types/v2';

/**
 * GET /api/v2/sources
 * List staged sources with optional filters
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse query params
    const libraryId = searchParams.get('libraryId') as LibraryId | null;
    const sourceType = searchParams.get('sourceType') as SourceType | null;
    const customerId = searchParams.get('customerId');
    const hasContent = searchParams.get('hasContent') === 'true';
    const pendingOnly = searchParams.get('pendingOnly') === 'true';
    const ignoredOnly = searchParams.get('ignoredOnly') === 'true';
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const orderBy = (searchParams.get('orderBy') || 'stagedAt') as 'stagedAt' | 'title';
    const orderDir = (searchParams.get('orderDir') || 'desc') as 'asc' | 'desc';
    const countOnly = searchParams.get('countOnly') === 'true';

    // Validate libraryId if provided
    if (libraryId && !LIBRARY_IDS.includes(libraryId)) {
      return NextResponse.json(
        { error: `Invalid libraryId. Must be one of: ${LIBRARY_IDS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate sourceType if provided
    if (sourceType && !SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json(
        { error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // If libraryId is specified, check access
    if (libraryId) {
      const hasAccess = await canAccessLibrary(session.user.id, libraryId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'You do not have access to this library' },
          { status: 403 }
        );
      }

      // Return inbox counts if requested
      if (countOnly) {
        const counts = await getInboxCounts(libraryId);
        return NextResponse.json({ counts });
      }
    } else if (customerId) {
      // Allow querying by customerId without libraryId (for customer sources selection)
      // Access is controlled by the customer's library access
      const hasAccess = await canAccessLibrary(session.user.id, 'customers');
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'You do not have access to customer sources' },
          { status: 403 }
        );
      }
    } else {
      // If neither libraryId nor customerId specified, require one
      return NextResponse.json(
        { error: 'libraryId or customerId is required' },
        { status: 400 }
      );
    }

    const options: SourceQueryOptions = {
      ...(libraryId && { libraryId }),
      ...(sourceType && { sourceType }),
      ...(customerId && { customerId }),
      ...(hasContent && { hasContent }),
      ...(pendingOnly && { pendingOnly }),
      ...(ignoredOnly && { ignoredOnly }),
      ...(search && { search }),
      limit: Math.min(limit, 100),
      offset,
      orderBy,
      orderDir,
    };

    const result = await querySources(options);

    // Enrich sources with externalUrl for URL sources (for UI display)
    const enrichedSources = result.sources.map((source) => {
      if (source.sourceType === 'url' && source.metadata && typeof source.metadata === 'object' && 'url' in source.metadata) {
        const metadata = source.metadata as unknown as Record<string, unknown>;
        return {
          ...source,
          externalUrl: metadata.url,
        };
      }
      return source;
    });

    return NextResponse.json({
      sources: enrichedSources,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error listing sources:', error);
    return NextResponse.json(
      { error: 'Failed to list sources' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/sources
 * Stage a new source
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.sourceType || !body.externalId || !body.libraryId || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: sourceType, externalId, libraryId, title' },
        { status: 400 }
      );
    }

    // Validate sourceType
    if (!SOURCE_TYPES.includes(body.sourceType)) {
      return NextResponse.json(
        { error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate libraryId
    if (!LIBRARY_IDS.includes(body.libraryId)) {
      return NextResponse.json(
        { error: `Invalid libraryId. Must be one of: ${LIBRARY_IDS.join(', ')}` },
        { status: 400 }
      );
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, body.libraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    const input: StageSourceInput = {
      sourceType: body.sourceType,
      externalId: body.externalId,
      libraryId: body.libraryId,
      ...(body.customerId && { customerId: body.customerId }),
      title: body.title,
      content: body.content,
      contentPreview: body.contentPreview,
      metadata: body.metadata || {},
      stagedBy: session.user.id,
    };

    const source = await stageSource(input);

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error('Error staging source:', error);
    return NextResponse.json(
      { error: 'Failed to stage source' },
      { status: 500 }
    );
  }
}
