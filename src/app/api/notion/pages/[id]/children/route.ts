/**
 * GET /api/notion/pages/[id]/children
 *
 * Get child pages of a Notion page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@/lib/secrets';
import { logger } from '@/lib/logger';

interface NotionBlock {
  object: string;
  id: string;
  type: string;
  child_page?: {
    title: string;
  };
  heading_1?: {
    rich_text: Array<{ plain_text: string }>;
  };
  heading_2?: {
    rich_text: Array<{ plain_text: string }>;
  };
  heading_3?: {
    rich_text: Array<{ plain_text: string }>;
  };
  paragraph?: {
    rich_text: Array<{ plain_text: string }>;
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if Notion is configured
    const token = await getSecret('notion-api-token');
    if (!token) {
      return NextResponse.json(
        { error: 'Notion not configured' },
        { status: 400 }
      );
    }

    // Fetch child blocks from Notion API
    const response = await fetch(`https://api.notion.com/v1/blocks/${id}/children?page_size=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      logger.error('Failed to fetch Notion page children', { pageId: id, status: response.status, error });
      return NextResponse.json(
        { error: `Failed to get page children: ${error.message || response.statusText}` },
        { status: response.status }
      );
    }

    const data = (await response.json()) as { results: NotionBlock[] };

    // Extract child pages
    const childPages = data.results
      .filter(block => block.type === 'child_page')
      .map(block => ({
        id: block.id,
        title: block.child_page?.title || 'Untitled',
      }));

    return NextResponse.json({
      pages: childPages,
      total: data.results.length,
    });
  } catch (error) {
    logger.error('Notion children error:', error);
    return NextResponse.json(
      { error: 'Failed to get page children' },
      { status: 500 }
    );
  }
}
