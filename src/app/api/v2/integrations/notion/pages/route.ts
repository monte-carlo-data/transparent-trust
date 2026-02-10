/**
 * GET /api/v2/integrations/notion/pages
 *
 * Returns list of available Notion pages for selection in UI dropdown.
 * Used when configuring which pages to sync.
 *
 * Query params:
 *   - search?: string (optional filter by title)
 *   - limit?: number (default 100)
 *
 * Returns:
 * {
 *   pages: [
 *     {
 *       id: string,
 *       title: string,
 *       icon?: string,
 *       parentId?: string,
 *       parentType: 'workspace' | 'page' | 'database',
 *       lastEditedTime: string
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { notionAdapter } from '@/lib/v2/sources/adapters/notion-adapter';

interface PageOption {
  id: string;
  title: string;
  icon?: string;
  parentId?: string;
  parentType: 'workspace' | 'page' | 'database';
  lastEditedTime: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const rootPageId = searchParams.get('rootPageId') || undefined;
    const libraryId = (searchParams.get('libraryId') || 'it') as
      | 'knowledge'
      | 'it'
      | 'gtm'
      | 'customers'
      | 'prompts'
      | 'personas'
      | 'templates';

    // Discover pages (scoped by rootPageId if provided)
    const discovered = await notionAdapter.discover({
      libraryId,
      limit: 500, // Get more pages to filter
      config: rootPageId ? { rootPageId } : undefined,
    });

    // Transform to page options
    let pages: PageOption[] = discovered.map((source) => {
      const metadata = source.metadata as Record<string, unknown>;
      const parentType = (metadata?.parentType as string) || 'workspace';
      return {
        id: source.externalId,
        title: source.title,
        icon: (metadata?.icon as { value?: string } | undefined)?.value,
        parentId: metadata?.parentId as string | undefined,
        parentType: (parentType === 'database' || parentType === 'page' || parentType === 'workspace'
          ? parentType
          : 'workspace') as 'workspace' | 'page' | 'database',
        lastEditedTime: (metadata?.notionUpdatedAt as string) || new Date().toISOString(),
      };
    });

    // Filter by search query if provided
    if (search) {
      pages = pages.filter((p) => p.title.toLowerCase().includes(search));
    }

    // Apply limit
    pages = pages.slice(0, limit);

    logger.info('Retrieved Notion page options', {
      count: pages.length,
      search: search || undefined,
    });

    return apiSuccess({ data: { pages } });
  } catch (error) {
    logger.error('Failed to retrieve Notion page options', error);
    return errors.internal(
      'Failed to retrieve Notion page options: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}
