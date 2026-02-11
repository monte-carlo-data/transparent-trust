/**
 * Source Content Sync Service
 *
 * Handles lazy content synchronization for customer-linked sources.
 * When a source is linked to a customer, only metadata is copied initially.
 * Content is fetched on-demand via the appropriate discovery adapter.
 *
 * Key concepts:
 * - Lazy sync: Content fetched only when needed (first view or explicit refresh)
 * - Adapter-based: Uses DiscoveryAdapter.fetchContent() for each source type
 * - Tracks sync state: Records when content was last synced
 */

import { prisma } from '@/lib/prisma';
import type { SourceType, TypedStagedSource } from '@/types/v2';
import { toTypedSource } from '@/types/v2/staged-source';
import { getAdapter } from './adapters';
import { logger } from '@/lib/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface SyncResult {
  success: boolean;
  sourceId: string;
  contentLength?: number;
  error?: string;
  syncedAt?: string;
}

export interface BulkSyncResult {
  synced: number;
  skipped: number;
  errors: Array<{ sourceId: string; error: string }>;
}

interface LinkedSourceMetadata {
  linkedFrom?: {
    sourceId: string;
    libraryId: string;
    linkedAt: string;
    linkedBy?: string;
  };
  contentSyncedAt?: string;
  contentSyncError?: string;
}

// =============================================================================
// SYNC CONTENT
// =============================================================================

/**
 * Sync content for a customer-linked source.
 * Fetches content from the original library source or directly from the external API.
 */
export async function syncSourceContent(sourceId: string): Promise<SyncResult> {
  const source = await prisma.stagedSource.findUnique({
    where: { id: sourceId },
  });

  if (!source) {
    return { success: false, sourceId, error: 'Source not found' };
  }

  // Verify it's a customer-scoped source
  if (!source.customerId) {
    return { success: false, sourceId, error: 'Source is not customer-scoped' };
  }

  const metadata = source.metadata as unknown as LinkedSourceMetadata;

  // Strategy 1: Try to copy from the linked library source
  if (metadata.linkedFrom?.sourceId) {
    const librarySource = await prisma.stagedSource.findUnique({
      where: { id: metadata.linkedFrom.sourceId },
    });

    if (librarySource?.content) {
      // Copy content from library source
      await prisma.stagedSource.update({
        where: { id: sourceId },
        data: {
          content: librarySource.content,
          contentPreview: librarySource.contentPreview,
          metadata: {
            ...(source.metadata as object),
            contentSyncedAt: new Date().toISOString(),
            contentSyncError: null,
          },
        },
      });

      return {
        success: true,
        sourceId,
        contentLength: librarySource.content.length,
        syncedAt: new Date().toISOString(),
      };
    }
  }

  // Strategy 2: Fetch directly from external API via adapter
  const adapter = getAdapter(source.sourceType as SourceType);
  if (!adapter || !adapter.fetchContent) {
    return {
      success: false,
      sourceId,
      error: `No content fetcher available for source type: ${source.sourceType}`,
    };
  }

  try {
    const fetchResult = await adapter.fetchContent(source.externalId);

    // Handle new return type (object with content/error) or legacy (string | null)
    const content =
      typeof fetchResult === 'object' && fetchResult !== null && 'content' in fetchResult
        ? fetchResult.content
        : fetchResult;
    const fetchError =
      typeof fetchResult === 'object' && fetchResult !== null && 'error' in fetchResult
        ? fetchResult.error
        : null;

    if (!content) {
      const errorMsg = fetchError || 'No content available from external source';

      // Mark sync attempt but no content available
      await prisma.stagedSource.update({
        where: { id: sourceId },
        data: {
          metadata: {
            ...(source.metadata as object),
            contentSyncedAt: new Date().toISOString(),
            contentSyncError: errorMsg,
          },
        },
      });

      return {
        success: false,
        sourceId,
        error: errorMsg,
      };
    }

    // Update source with fetched content
    const preview = content.substring(0, 200) + (content.length > 200 ? '...' : '');
    await prisma.stagedSource.update({
      where: { id: sourceId },
      data: {
        content,
        contentPreview: preview,
        metadata: {
          ...(source.metadata as object),
          contentSyncedAt: new Date().toISOString(),
          contentSyncError: null,
        },
      },
    });

    return {
      success: true,
      sourceId,
      contentLength: content.length,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Record the sync error
    await prisma.stagedSource.update({
      where: { id: sourceId },
      data: {
        metadata: {
          ...(source.metadata as object),
          contentSyncError: errorMessage,
        },
      },
    });

    logger.error('Failed to sync source content', error, {
      sourceId,
      sourceType: source.sourceType,
      externalId: source.externalId,
    });

    return { success: false, sourceId, error: errorMessage };
  }
}

/**
 * Sync content for multiple customer-linked sources.
 */
export async function syncSourcesContent(sourceIds: string[]): Promise<BulkSyncResult> {
  const result: BulkSyncResult = { synced: 0, skipped: 0, errors: [] };

  for (const sourceId of sourceIds) {
    const syncResult = await syncSourceContent(sourceId);

    if (syncResult.success) {
      result.synced++;
    } else if (syncResult.error === 'Source is not customer-scoped') {
      result.skipped++;
    } else {
      result.errors.push({ sourceId, error: syncResult.error || 'Unknown error' });
    }
  }

  return result;
}

// =============================================================================
// SYNC STATUS
// =============================================================================

/**
 * Check if a source needs content sync.
 * Returns true if source is customer-scoped and has no content.
 */
export async function needsContentSync(sourceId: string): Promise<boolean> {
  const source = await prisma.stagedSource.findUnique({
    where: { id: sourceId },
    select: { customerId: true, content: true },
  });

  if (!source) return false;

  // Only customer-scoped sources need sync
  if (!source.customerId) return false;

  // Needs sync if no content
  return !source.content;
}

/**
 * Get sources for a customer that need content sync.
 */
export async function getSourcesNeedingSync(
  customerId: string,
  options: { sourceType?: SourceType; limit?: number } = {}
): Promise<TypedStagedSource[]> {
  const { sourceType, limit = 50 } = options;

  const sources = await prisma.stagedSource.findMany({
    where: {
      customerId,
      libraryId: 'customers',
      content: null, // No content yet
      ignoredAt: null,
      ...(sourceType && { sourceType }),
    },
    take: limit,
    orderBy: { stagedAt: 'desc' },
  });

  return sources.map(toTypedSource);
}

/**
 * Get sync status for a customer's linked sources.
 */
export async function getCustomerSyncStatus(customerId: string): Promise<{
  total: number;
  synced: number;
  pending: number;
  errors: number;
  bySourceType: Record<string, { synced: number; pending: number; errors: number }>;
}> {
  const sources = await prisma.stagedSource.findMany({
    where: {
      customerId,
      libraryId: 'customers',
      ignoredAt: null,
    },
    select: {
      sourceType: true,
      content: true,
      metadata: true,
    },
  });

  const result = {
    total: sources.length,
    synced: 0,
    pending: 0,
    errors: 0,
    bySourceType: {} as Record<string, { synced: number; pending: number; errors: number }>,
  };

  for (const source of sources) {
    const metadata = source.metadata as unknown as LinkedSourceMetadata;
    const hasContent = !!source.content;
    const hasError = !!metadata.contentSyncError;

    // Initialize source type stats
    if (!result.bySourceType[source.sourceType]) {
      result.bySourceType[source.sourceType] = { synced: 0, pending: 0, errors: 0 };
    }

    if (hasContent) {
      result.synced++;
      result.bySourceType[source.sourceType].synced++;
    } else if (hasError) {
      result.errors++;
      result.bySourceType[source.sourceType].errors++;
    } else {
      result.pending++;
      result.bySourceType[source.sourceType].pending++;
    }
  }

  return result;
}

// =============================================================================
// AUTO-SYNC ON ACCESS
// =============================================================================

export interface SourceWithSyncStatus {
  source: TypedStagedSource | null;
  syncAttempted: boolean;
  syncError?: string;
}

/**
 * Get source with auto-sync if needed.
 * If source is customer-scoped and has no content, triggers sync first.
 * Returns sync status alongside the source for transparency.
 */
export async function getSourceWithAutoSync(sourceId: string): Promise<SourceWithSyncStatus> {
  const source = await prisma.stagedSource.findUnique({
    where: { id: sourceId },
  });

  if (!source) return { source: null, syncAttempted: false };

  // Auto-sync if customer-scoped and no content
  if (source.customerId && !source.content) {
    const syncResult = await syncSourceContent(sourceId);

    if (syncResult.success) {
      // Re-fetch to get updated content
      const updated = await prisma.stagedSource.findUnique({
        where: { id: sourceId },
      });
      return {
        source: updated ? toTypedSource(updated) : null,
        syncAttempted: true,
      };
    }

    // Sync attempted but failed
    logger.warn('Auto-sync failed for source', {
      sourceId,
      error: syncResult.error,
    });

    return {
      source: toTypedSource(source),
      syncAttempted: true,
      syncError: syncResult.error,
    };
  }

  return { source: toTypedSource(source), syncAttempted: false };
}
