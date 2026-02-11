/**
 * Base Source Handler for V2 Integration APIs
 *
 * Abstract base class that provides common functionality for all integration handlers.
 * Wraps discovery adapters and provides unified response formatting.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { SourceType, LibraryId } from '@/types/v2';
import type {
  DiscoveryParams,
  DiscoveryResponse,
  DiscoveredItem,
  StageListParams,
  StageListResponse,
  StagedSourceSummary,
  SourceStatus,
} from '../types';

/**
 * Abstract base handler for integration sources.
 * Provides common discovery, staging, and query functionality.
 */
export abstract class BaseSourceHandler {
  abstract readonly sourceType: SourceType;
  abstract readonly displayName: string;

  /**
   * Discover sources from the external system.
   * Must be implemented by each handler.
   */
  abstract discover(params: DiscoveryParams): Promise<DiscoveryResponse<DiscoveredItem>>;

  /**
   * Get staged sources for this source type.
   * Provides filtering by status and pagination.
   */
  async getStagedSources(params: StageListParams): Promise<StageListResponse> {
    const { libraryId, customerId, status, limit, offset } = params;

    // Build where clause based on status
    const whereClause = this.buildWhereClause(libraryId, customerId, status);

    // Fetch filtered and paginated results
    const [items, counts] = await Promise.all([
      prisma.stagedSource.findMany({
        where: whereClause,
        orderBy: { stagedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          assignments: { select: { id: true } },
        },
      }),
      this.getStatusCounts(libraryId, customerId),
    ]);

    // Map to summary format
    const summaries: StagedSourceSummary[] = items.map((item) => ({
      id: item.id,
      externalId: item.externalId,
      title: item.title,
      contentPreview: item.contentPreview || '',
      status: this.computeStatus(item),
      stagedAt: item.stagedAt.toISOString(),
      metadata: item.metadata as Record<string, unknown>,
    }));

    // Get total count for requested status
    const total =
      status === 'NEW'
        ? counts.NEW
        : status === 'REVIEWED'
          ? counts.REVIEWED
          : status === 'ASSIGNED'
            ? counts.ASSIGNED
            : counts.IGNORED;

    return {
      items: summaries,
      counts,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  /**
   * Stage discovered items into the database.
   */
  async stageItems(
    items: Array<{
      externalId: string;
      title: string;
      content: string;
      contentPreview: string;
      metadata?: Record<string, unknown>;
    }>,
    libraryId: LibraryId,
    customerId?: string
  ): Promise<{ staged: number; skipped: number; total: number }> {
    let staged = 0;
    let skipped = 0;

    for (const item of items) {
      // Check for existing source (same sourceType + externalId + libraryId + customerId)
      const existing = await prisma.stagedSource.findFirst({
        where: {
          sourceType: this.sourceType,
          externalId: item.externalId,
          libraryId,
          customerId: customerId || null,
        },
      });

      if (!existing) {
        await prisma.stagedSource.create({
          data: {
            sourceType: this.sourceType,
            externalId: item.externalId,
            libraryId,
            customerId: customerId || null,
            title: item.title || `${this.displayName} ${item.externalId}`,
            content: item.content || '',
            contentPreview: item.contentPreview || '',
            metadata: (item.metadata || {}) as Prisma.InputJsonValue,
          },
        });
        staged++;
      } else {
        skipped++;
      }
    }

    return {
      staged,
      skipped,
      total: items.length,
    };
  }

  /**
   * Build Prisma where clause for status filtering.
   */
  protected buildWhereClause(
    libraryId: LibraryId,
    customerId?: string,
    status?: SourceStatus
  ): Prisma.StagedSourceWhereInput {
    const baseWhere: Prisma.StagedSourceWhereInput = {
      sourceType: this.sourceType,
      libraryId,
      customerId: customerId || null,
    };

    switch (status) {
      case 'IGNORED':
        return { ...baseWhere, ignoredAt: { not: null } };

      case 'REVIEWED':
        return {
          ...baseWhere,
          ignoredAt: null,
          stagedBy: { not: null },
          assignments: { none: {} },
        };

      case 'ASSIGNED':
        return {
          ...baseWhere,
          ignoredAt: null,
          assignments: { some: {} },
        };

      case 'NEW':
      default:
        return {
          ...baseWhere,
          ignoredAt: null,
          stagedBy: null,
          assignments: { none: {} },
        };
    }
  }

  /**
   * Get counts for all status categories.
   */
  protected async getStatusCounts(
    libraryId: LibraryId,
    customerId?: string
  ): Promise<{ NEW: number; REVIEWED: number; ASSIGNED: number; IGNORED: number }> {
    const [newCount, reviewedCount, assignedCount, ignoredCount] = await Promise.all([
      prisma.stagedSource.count({
        where: this.buildWhereClause(libraryId, customerId, 'NEW'),
      }),
      prisma.stagedSource.count({
        where: this.buildWhereClause(libraryId, customerId, 'REVIEWED'),
      }),
      prisma.stagedSource.count({
        where: this.buildWhereClause(libraryId, customerId, 'ASSIGNED'),
      }),
      prisma.stagedSource.count({
        where: this.buildWhereClause(libraryId, customerId, 'IGNORED'),
      }),
    ]);

    return {
      NEW: newCount,
      REVIEWED: reviewedCount,
      ASSIGNED: assignedCount,
      IGNORED: ignoredCount,
    };
  }

  /**
   * Compute status from database row.
   */
  protected computeStatus(
    source: {
      ignoredAt: Date | null;
      stagedBy: string | null;
      assignments: Array<{ id: string }>;
    }
  ): SourceStatus {
    if (source.ignoredAt) return 'IGNORED';
    if (source.assignments.length > 0) return 'ASSIGNED';
    if (source.stagedBy) return 'REVIEWED';
    return 'NEW';
  }
}
