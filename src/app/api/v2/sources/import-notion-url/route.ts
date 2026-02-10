/**
 * POST /api/v2/sources/import-notion-url
 * Import a single Notion page by URL and stage it
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { stageSource } from '@/lib/v2/sources';
import { canManageLibrary } from '@/lib/v2/teams';
import { notionAdapter } from '@/lib/v2/sources/adapters/notion-adapter';
import type { LibraryId } from '@/types/v2';
import { LIBRARY_IDS } from '@/types/v2';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, libraryId } = body;

    // Validate inputs
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId is required' },
        { status: 400 }
      );
    }

    // Validate libraryId
    if (!LIBRARY_IDS.includes(libraryId)) {
      return NextResponse.json(
        { error: `Invalid libraryId. Must be one of: ${LIBRARY_IDS.join(', ')}` },
        { status: 400 }
      );
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, libraryId as LibraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    // Extract page ID from Notion URL
    // URLs can be:
    // - https://www.notion.so/[workspace]/[page-id]
    // - https://www.notion.so/[page-id]
    // - [page-id] (just the ID)
    const pageIdMatch = url.match(/(?:notion\.so\/)?(?:[a-zA-Z0-9]+(?::[a-zA-Z0-9]+)?\/)?([a-f0-9]{32})/i);
    if (!pageIdMatch || !pageIdMatch[1]) {
      return NextResponse.json(
        { error: 'Invalid Notion URL. Please provide a valid Notion page URL or ID.' },
        { status: 400 }
      );
    }

    const pageId = pageIdMatch[1].replace(/-/g, '');

    // Discover the specific page using the Notion adapter
    // Pass the pageId via config.pageIds to fetch only that page
    const discovered = await notionAdapter.discover({
      libraryId: libraryId as LibraryId,
      config: {
        pageIds: [pageId],
      },
    });

    if (discovered.length === 0) {
      return NextResponse.json(
        { error: 'Notion page not found or not accessible. Check URL and permissions.' },
        { status: 404 }
      );
    }

    const page = discovered[0];

    // Stage the discovered page
    const source = await stageSource({
      sourceType: 'notion',
      externalId: page.externalId,
      libraryId: libraryId as LibraryId,
      title: page.title,
      content: page.content,
      contentPreview: page.contentPreview,
      metadata: page.metadata,
      stagedBy: session.user.id,
    });

    return NextResponse.json(
      {
        id: source.id,
        message: 'Notion page imported successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error importing Notion URL:', error);
    const message = error instanceof Error ? error.message : 'Failed to import Notion page';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
