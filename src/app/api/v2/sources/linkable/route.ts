/**
 * GET /api/v2/sources/linkable - Get sources available for customer linking
 *
 * Two modes:
 * 1. Linkable query: Returns library sources that can be linked to customers
 *    - Pass libraryId (required) and optional filters
 * 2. Suggested mode: Returns sources auto-matched to a specific customer
 *    - Pass suggestedForCustomer parameter
 *
 * Used by LinkToCustomerModal to show available sources.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { getLinkableSources, getSuggestedSourcesForCustomer } from '@/lib/v2/sources/source-linking-service';
import { canAccessLibrary } from '@/lib/v2/teams';
import { canAccessCustomer } from '@/lib/v2/customers/customer-service';
import { logger } from '@/lib/logger';
import type { LibraryId, SourceType } from '@/types/v2';
import { LIBRARY_IDS, SOURCE_TYPES } from '@/types/v2';

/**
 * GET /api/v2/sources/linkable
 *
 * Query params:
 *   - libraryId: Library to query (required, e.g., 'gtm')
 *   - sourceType: Filter by source type (optional, e.g., 'gong')
 *   - matchedCustomerId: Filter by auto-matched customer (optional)
 *   - excludeLinkedTo: Exclude sources already linked to this customer (optional)
 *   - search: Search in title (optional)
 *   - limit: Pagination limit (default 50, max 100)
 *   - offset: Pagination offset (default 0)
 *
 * Alternative mode (suggested sources for a customer):
 *   - suggestedForCustomer: Customer ID to get suggested sources for
 *   - sourceType: Filter by source type (optional)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Check for suggested mode
    const suggestedForCustomer = searchParams.get('suggestedForCustomer');
    if (suggestedForCustomer) {
      // Check customer access
      const canAccess = await canAccessCustomer(session.user.id, suggestedForCustomer);
      if (!canAccess) {
        return NextResponse.json(
          { error: 'You do not have access to this customer' },
          { status: 403 }
        );
      }

      const sourceType = searchParams.get('sourceType') as SourceType | null;
      if (sourceType && !SOURCE_TYPES.includes(sourceType)) {
        return NextResponse.json(
          { error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      const sources = await getSuggestedSourcesForCustomer(suggestedForCustomer, {
        sourceType: sourceType || undefined,
        limit: parseInt(searchParams.get('limit') || '20', 10),
      });

      return NextResponse.json({ sources, total: sources.length });
    }

    // Regular linkable sources query
    const libraryId = searchParams.get('libraryId') as LibraryId | null;
    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId is required' },
        { status: 400 }
      );
    }

    if (!LIBRARY_IDS.includes(libraryId)) {
      return NextResponse.json(
        { error: `Invalid libraryId. Must be one of: ${LIBRARY_IDS.join(', ')}` },
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

    const sourceType = searchParams.get('sourceType') as SourceType | null;
    if (sourceType && !SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json(
        { error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getLinkableSources({
      libraryId,
      sourceType: sourceType || undefined,
      matchedCustomerId: searchParams.get('matchedCustomerId') || undefined,
      excludeLinkedTo: searchParams.get('excludeLinkedTo') || undefined,
      search: searchParams.get('search') || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      sources: result.sources,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching linkable sources', error, {
      operation: 'getLinkableSources',
    });
    return NextResponse.json(
      { error: 'Failed to fetch linkable sources. Please try again.' },
      { status: 500 }
    );
  }
}
