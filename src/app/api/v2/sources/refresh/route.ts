/**
 * POST /api/v2/sources/refresh
 * Refresh content for staged source(s) by re-fetching from the original source
 *
 * Supports:
 * - URL sources: Fetches the URL content
 * - Zendesk tickets: Fetches ticket details and comments from Zendesk API
 * - Slack threads: Fetches thread messages from Slack API
 *
 * Can refresh a single source (sourceId) or multiple sources (sourceIds)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { Prisma, StagedSource } from '@prisma/client';
import { canManageLibrary } from '@/lib/v2/teams';
import { adapters } from '@/lib/v2/sources/adapters';
import { zendeskAdapter } from '@/lib/v2/sources/adapters/zendesk-adapter';
import { SlackDiscoveryAdapter } from '@/lib/v2/sources/adapters/slack-adapter';
import type { LibraryId } from '@/types/v2';
import { logger } from '@/lib/logger';

interface RefreshResult {
  id: string;
  title: string;
  contentLength: number;
  success: boolean;
  error?: string;
}

/**
 * Refresh content for a single source based on its type
 */
async function refreshSource(source: StagedSource, libraryId: LibraryId): Promise<RefreshResult> {
  const sourceType = source.sourceType;
  const externalId = source.externalId;

  try {
    let title = source.title;
    let content = '';
    let contentPreview = '';
    let metadata: Record<string, unknown> = (source.metadata as Record<string, unknown>) || {};

    if (sourceType === 'url') {
      // URL source - fetch the URL
      try {
        const fetched = await adapters.url.fetchUrl(externalId);
        if (fetched) {
          title = fetched.title || externalId;
          content = fetched.content || '';
          contentPreview = fetched.contentPreview || '';
          metadata = {
            ...metadata,
            ...(fetched.metadata || {}),
            lastRefreshedAt: new Date().toISOString(),
          };
        }
      } catch (urlError) {
        // URL fetch failed - log but don't fail the refresh
        logger.warn('Failed to fetch URL content:', { url: externalId, error: urlError instanceof Error ? urlError.message : 'Unknown error' });
        // At least update the refresh timestamp even if content fetch failed
        metadata = {
          ...metadata,
          lastRefreshedAt: new Date().toISOString(),
          lastRefreshError: urlError instanceof Error ? urlError.message : 'Failed to fetch URL',
        };
      }
    } else if (sourceType === 'zendesk') {
      // Zendesk ticket - fetch ticket details and comments
      const ticketId = parseInt(externalId, 10);
      if (isNaN(ticketId)) {
        throw new Error(`Invalid Zendesk ticket ID: ${externalId}`);
      }

      const ticketResult = await refreshZendeskTicket(ticketId, libraryId);
      if (ticketResult) {
        title = ticketResult.title;
        content = ticketResult.content;
        contentPreview = ticketResult.contentPreview;
        metadata = {
          ...metadata,
          ...ticketResult.metadata,
          lastRefreshedAt: new Date().toISOString(),
        };
      }
    } else if (sourceType === 'slack') {
      // Slack thread - fetch thread messages
      const slackAdapter = new SlackDiscoveryAdapter();
      const threadResult = await refreshSlackThread(source, libraryId, slackAdapter);
      if (threadResult) {
        title = threadResult.title || title;
        content = threadResult.content;
        contentPreview = threadResult.contentPreview;
        metadata = {
          ...metadata,
          ...threadResult.metadata,
          lastRefreshedAt: new Date().toISOString(),
        };
      }
    } else {
      throw new Error(`Source type '${sourceType}' does not support refresh`);
    }

    // Only update if we got new content or this is a fresh metadata update
    // Allow sources with metadata but no content (backward compatibility)
    const updateData: Prisma.StagedSourceUpdateInput = {
      metadata: metadata as Prisma.InputJsonValue,
      title,
      // Only update content if we fetched something new
      ...(content && { content, contentPreview: contentPreview || content.substring(0, 500) }),
    };

    // Update the source in the database
    await prisma.stagedSource.update({
      where: { id: source.id },
      data: updateData,
    });

    return {
      id: source.id,
      title,
      contentLength: content.length,
      success: true,
    };
  } catch (error) {
    logger.error('Failed to refresh source:', error, { sourceId: source.id, sourceType });
    return {
      id: source.id,
      title: source.title,
      contentLength: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Refresh a specific Zendesk ticket by ID
 */
async function refreshZendeskTicket(ticketId: number, libraryId: LibraryId): Promise<{
  title: string;
  content: string;
  contentPreview: string;
  metadata: Record<string, unknown>;
} | null> {
  try {
    // Discover tickets updated in the last year (to include most tickets)
    // and filter to find our specific ticket
    const discovered = await zendeskAdapter.discover({
      libraryId, // Use the library to ensure correct credential loading
      limit: 100,
      since: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
    });

    const ticket = discovered.find((d) => d.externalId === ticketId.toString());
    if (ticket && ticket.content) {
      return {
        title: ticket.title,
        content: ticket.content,
        contentPreview: ticket.contentPreview || ticket.content.substring(0, 500),
        metadata: ticket.metadata as unknown as Record<string, unknown>,
      };
    }

    // If not found in recent tickets, the ticket might be older
    // For now, return null and log a warning
    logger.warn('Zendesk ticket not found in recent results:', { ticketId });
    return null;
  } catch (error) {
    logger.error('Failed to fetch Zendesk ticket:', error, { ticketId });
    throw error;
  }
}

/**
 * Refresh a Slack thread by fetching its messages
 */
async function refreshSlackThread(
  source: StagedSource,
  libraryId: LibraryId,
  adapter: SlackDiscoveryAdapter
): Promise<{
  title: string;
  content: string;
  contentPreview: string;
  metadata: Record<string, unknown>;
} | null> {
  try {
    const metadata = source.metadata as Record<string, unknown>;
    const channelId = metadata?.channelId as string;
    const threadTs = metadata?.threadTs as string || source.externalId;

    if (!channelId || !threadTs) {
      throw new Error('Missing channelId or threadTs in source metadata');
    }

    // Discover threads from this channel
    const discovered = await adapter.discover({
      libraryId,
      limit: 50,
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    });

    // Find the specific thread
    const thread = discovered.find((d) => {
      const m = d.metadata as unknown as Record<string, unknown>;
      return m?.threadTs === threadTs || d.externalId === threadTs;
    });

    if (thread && thread.content) {
      return {
        title: thread.title,
        content: thread.content,
        contentPreview: thread.contentPreview || thread.content.substring(0, 500),
        metadata: thread.metadata as unknown as Record<string, unknown>,
      };
    }

    logger.warn('Slack thread not found in recent results:', { threadTs, channelId });
    return null;
  } catch (error) {
    logger.error('Failed to fetch Slack thread:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceId, sourceIds } = body;

    // Support both single sourceId and array of sourceIds
    const idsToRefresh: string[] = sourceIds
      ? (Array.isArray(sourceIds) ? sourceIds : [sourceIds])
      : sourceId
        ? [sourceId]
        : [];

    if (idsToRefresh.length === 0) {
      return NextResponse.json(
        { error: 'Source ID(s) required' },
        { status: 400 }
      );
    }

    // Limit bulk refresh to 50 sources at a time
    if (idsToRefresh.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 sources can be refreshed at once' },
        { status: 400 }
      );
    }

    // Get all sources
    const sources = await prisma.stagedSource.findMany({
      where: { id: { in: idsToRefresh } },
    });

    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'No sources found' },
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

    // Refresh all sources in parallel (with concurrency limit)
    const results: RefreshResult[] = [];
    const batchSize = 5; // Process 5 at a time to avoid rate limits

    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((source) => refreshSource(source, source.libraryId as LibraryId))
      );
      results.push(...batchResults);
    }

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Return appropriate response based on single vs bulk
    if (idsToRefresh.length === 1) {
      const result = results[0];
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to refresh source' },
          { status: 500 }
        );
      }
      return NextResponse.json(result);
    }

    // Bulk response
    return NextResponse.json({
      total: results.length,
      succeeded: succeeded.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    logger.error('Error refreshing source(s):', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh source(s)',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
