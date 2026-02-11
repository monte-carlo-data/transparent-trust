/**
 * POST /api/v2/sources/fetch-url
 * Fetch content from a URL for staging
 * Used by frontend to populate content before staging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { urlAdapter } from '@/lib/v2/sources/adapters/url-adapter';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Fetch and extract content from URL with fallback
    let discovered = {
      title: url,
      content: '',
      contentPreview: '',
      metadata: {},
    };

    // Try to fetch content, but use fallback if it fails
    try {
      const fetched = await urlAdapter.fetchUrl(url);
      if (fetched) {
        discovered = {
          title: fetched.title || url,
          content: fetched.content || '',
          contentPreview: fetched.contentPreview || '',
          metadata: fetched.metadata || {},
        };
      }
    } catch (fetchError) {
      console.warn('URL fetch failed, using fallback:', { url, error: fetchError instanceof Error ? fetchError.message : 'Unknown error' });
      // Use fallback - URL as title, empty content
    }

    return NextResponse.json({
      title: discovered.title,
      content: discovered.content,
      contentPreview: discovered.contentPreview,
      metadata: { url, ...discovered.metadata },
    });
  } catch (error) {
    console.error('Error fetching URL:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch URL content',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
