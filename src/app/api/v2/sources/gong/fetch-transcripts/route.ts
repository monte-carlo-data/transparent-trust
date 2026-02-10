/**
 * POST /api/v2/sources/gong/fetch-transcripts
 * Fetch transcripts for Gong call sources that were discovered without transcripts.
 *
 * This endpoint fetches the full transcript content from Gong API for selected
 * staged sources and updates their content and metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { Prisma, StagedSource } from '@prisma/client';
import { canManageLibrary } from '@/lib/v2/teams';
import { gongAdapter } from '@/lib/v2/sources/adapters/gong-adapter';
import type { LibraryId, GongSourceMetadata } from '@/types/v2';
import { logger } from '@/lib/logger';

interface FetchResult {
  id: string;
  title: string;
  contentLength: number;
  success: boolean;
  error?: string;
}

/**
 * Fetch transcript for a single Gong source
 */
async function fetchTranscriptForSource(source: StagedSource): Promise<FetchResult> {
  try {
    const metadata = source.metadata as unknown as GongSourceMetadata;
    const callId = metadata?.callId || source.externalId;

    if (!callId) {
      throw new Error('Missing callId in source metadata');
    }

    // Use the adapter's fetchContent method to get the full call with transcript
    const result = await gongAdapter.fetchContent(callId);

    if (!result.content) {
      throw new Error(result.error || 'Failed to fetch transcript content');
    }

    // Update the source with the new content
    const updatedMetadata: GongSourceMetadata = {
      ...metadata,
      hasTranscript: true,
    };

    await prisma.stagedSource.update({
      where: { id: source.id },
      data: {
        content: result.content,
        contentPreview: result.content.substring(0, 500),
        metadata: updatedMetadata as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      id: source.id,
      title: source.title,
      contentLength: result.content.length,
      success: true,
    };
  } catch (error) {
    logger.error('Failed to fetch transcript for Gong source:', error, { sourceId: source.id });
    return {
      id: source.id,
      title: source.title,
      contentLength: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceIds } = body;

    if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return NextResponse.json(
        { error: 'sourceIds array required' },
        { status: 400 }
      );
    }

    // Limit bulk fetch to 20 sources at a time (transcript fetching is expensive)
    if (sourceIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 transcripts can be fetched at once' },
        { status: 400 }
      );
    }

    // Get all sources
    const sources = await prisma.stagedSource.findMany({
      where: {
        id: { in: sourceIds },
        sourceType: 'gong', // Only Gong sources
      },
    });

    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'No Gong sources found' },
        { status: 404 }
      );
    }

    // Check library access for all sources
    const libraryIds = [...new Set(sources.map((s) => s.libraryId as LibraryId))];
    for (const libId of libraryIds) {
      const hasAccess = await canManageLibrary(session.user.id, libId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: `You do not have access to library: ${libId}` },
          { status: 403 }
        );
      }
    }

    // Fetch transcripts with concurrency limit
    const results: FetchResult[] = [];
    const batchSize = 5; // Process 5 at a time to respect Gong rate limits

    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);

      // Add delay between batches to avoid rate limiting
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const batchResults = await Promise.all(
        batch.map((source) => fetchTranscriptForSource(source))
      );
      results.push(...batchResults);
    }

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return NextResponse.json({
      total: results.length,
      succeeded: succeeded.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    logger.error('Error fetching Gong transcripts:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch transcripts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
