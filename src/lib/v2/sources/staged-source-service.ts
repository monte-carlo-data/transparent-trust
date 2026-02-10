/**
 * StagedSourceService - Manage staged sources and assignments
 *
 * This service handles the source staging layer:
 * - Staging new sources from discovery adapters
 * - Assigning sources to building blocks
 * - Marking sources as incorporated
 * - Ignoring/unignoring sources
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  type TypedStagedSource,
  type StageSourceInput,
  type AssignSourceInput,
  type SourceQueryOptions,
  type SourceType,
  type TypedSourceAssignment,
  toTypedSource,
} from '@/types/v2';
import type { LibraryId } from '@/types/v2';

// =============================================================================
// STAGE SOURCES
// =============================================================================

/**
 * Stage a new source for triage.
 * If the source already exists (same sourceType + externalId + libraryId), update it.
 */
export async function stageSource<T extends TypedStagedSource>(
  input: StageSourceInput<T>
): Promise<T> {
  // Check if source already exists, accounting for customerId
  const existing = await prisma.stagedSource.findFirst({
    where: {
      sourceType: input.sourceType,
      externalId: input.externalId,
      libraryId: input.libraryId,
      customerId: input.customerId || null,
    },
  });

  if (existing) {
    // Update existing source
    const source = await prisma.stagedSource.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        content: input.content,
        contentPreview: input.contentPreview,
        metadata: input.metadata as unknown as Prisma.InputJsonValue,
        // Reset ignored status when re-staging (content may have changed)
        ignoredAt: null,
        ignoredBy: null,
      },
    });
    return toTypedSource(source) as T;
  }

  // Create new source
  const source = await prisma.stagedSource.create({
    data: {
      sourceType: input.sourceType,
      externalId: input.externalId,
      libraryId: input.libraryId,
      ...(input.customerId && { customerId: input.customerId }),
      title: input.title,
      content: input.content,
      contentPreview: input.contentPreview,
      metadata: input.metadata as unknown as Prisma.InputJsonValue,
      stagedBy: input.stagedBy,
    },
  });

  return toTypedSource(source) as T;
}

/**
 * Stage multiple sources at once (batch operation).
 */
export async function stageSources(
  inputs: StageSourceInput[]
): Promise<{ staged: number; updated: number }> {
  let staged = 0;
  let updated = 0;

  // Use transaction for atomicity
  await prisma.$transaction(async (tx) => {
    for (const input of inputs) {
      const existing = await tx.stagedSource.findFirst({
        where: {
          sourceType: input.sourceType,
          externalId: input.externalId,
          libraryId: input.libraryId,
          customerId: input.customerId || null,
        },
      });

      if (existing) {
        await tx.stagedSource.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            content: input.content,
            contentPreview: input.contentPreview,
            metadata: input.metadata as unknown as Prisma.InputJsonValue,
            ignoredAt: null,
            ignoredBy: null,
          },
        });
        updated++;
      } else {
        await tx.stagedSource.create({
          data: {
            sourceType: input.sourceType,
            externalId: input.externalId,
            libraryId: input.libraryId,
            ...(input.customerId && { customerId: input.customerId }),
            title: input.title,
            content: input.content,
            contentPreview: input.contentPreview,
            metadata: input.metadata as unknown as Prisma.InputJsonValue,
            stagedBy: input.stagedBy,
          },
        });
        staged++;
      }
    }
  });

  return { staged, updated };
}

// =============================================================================
// QUERY SOURCES
// =============================================================================

/**
 * Get a staged source by ID.
 */
export async function getSourceById(id: string): Promise<TypedStagedSource | null> {
  const source = await prisma.stagedSource.findUnique({
    where: { id },
    include: { assignments: { include: { block: { select: { id: true, title: true, slug: true, status: true } } } } },
  });

  return source ? toTypedSource(source) : null;
}

/**
 * Get a staged source by external ID.
 */
export async function getSourceByExternalId(
  sourceType: SourceType,
  externalId: string,
  libraryId: LibraryId
): Promise<TypedStagedSource | null> {
  const source = await prisma.stagedSource.findFirst({
    where: {
      sourceType,
      externalId,
      libraryId,
      customerId: null,
    },
    include: { assignments: { include: { block: { select: { id: true, title: true, slug: true, status: true } } } } },
  });

  return source ? toTypedSource(source) : null;
}

/**
 * Query staged sources with filters.
 */
export async function querySources(
  options: SourceQueryOptions = {}
): Promise<{ sources: TypedStagedSource[]; total: number }> {
  const {
    libraryId,
    sourceType,
    customerId,
    hasContent,
    pendingOnly,
    ignoredOnly,
    search,
    stagedAfter,
    stagedBefore,
    limit = 50,
    offset = 0,
    orderBy = 'stagedAt',
    orderDir = 'desc',
  } = options;

  const where: Prisma.StagedSourceWhereInput = {
    ...(libraryId && { libraryId }),
    ...(sourceType && { sourceType }),
    ...(customerId && { customerId }),
    ...(hasContent && { content: { not: null } }),
    ...(pendingOnly && { ignoredAt: null }),
    ...(ignoredOnly && { ignoredAt: { not: null } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(stagedAfter && { stagedAt: { gte: stagedAfter } }),
    ...(stagedBefore && { stagedAt: { lte: stagedBefore } }),
  };

  const [sources, total] = await Promise.all([
    prisma.stagedSource.findMany({
      where,
      include: { assignments: { include: { block: { select: { id: true, title: true, slug: true, status: true } } } } },
      take: limit,
      skip: offset,
      orderBy: { [orderBy]: orderDir },
    }),
    prisma.stagedSource.count({ where }),
  ]);

  return {
    sources: sources.map(toTypedSource),
    total,
  };
}

/**
 * Get pending sources for a library (not ignored, not fully incorporated).
 */
export async function getPendingSources(
  libraryId: LibraryId,
  options: { sourceType?: SourceType; limit?: number } = {}
): Promise<TypedStagedSource[]> {
  const { sourceType, limit = 50 } = options;

  const sources = await prisma.stagedSource.findMany({
    where: {
      libraryId,
      ignoredAt: null,
      ...(sourceType && { sourceType }),
    },
    include: { assignments: { include: { block: { select: { id: true, title: true, slug: true, status: true } } } } },
    take: limit,
    orderBy: { stagedAt: 'desc' },
  });

  return sources.map(toTypedSource);
}

/**
 * Get inbox counts by source type for a library.
 */
export async function getInboxCounts(
  libraryId: LibraryId
): Promise<Record<SourceType, number>> {
  const counts = await prisma.stagedSource.groupBy({
    by: ['sourceType'],
    where: {
      libraryId,
      ignoredAt: null,
    },
    _count: true,
  });

  const result: Record<string, number> = {
    url: 0,
    zendesk: 0,
    slack: 0,
    notion: 0,
    gong: 0,
    document: 0,
  };

  for (const item of counts) {
    result[item.sourceType] = item._count;
  }

  return result as Record<SourceType, number>;
}

// =============================================================================
// ASSIGNMENTS
// =============================================================================

/**
 * Assign a staged source to a building block.
 */
export async function assignSourceToBlock(
  input: AssignSourceInput
): Promise<TypedSourceAssignment> {
  const assignment = await prisma.sourceAssignment.create({
    data: {
      stagedSourceId: input.stagedSourceId,
      blockId: input.blockId,
      assignedBy: input.assignedBy,
      notes: input.notes,
    },
    include: {
      stagedSource: true,
    },
  });

  return {
    ...assignment,
    stagedSource: toTypedSource(assignment.stagedSource),
  };
}

/**
 * Get assignments for a block.
 */
export async function getBlockAssignments(
  blockId: string
): Promise<TypedSourceAssignment[]> {
  const assignments = await prisma.sourceAssignment.findMany({
    where: { blockId },
    include: { stagedSource: true },
    orderBy: { assignedAt: 'desc' },
  });

  return assignments.map((a) => ({
    ...a,
    stagedSource: toTypedSource(a.stagedSource),
  }));
}

/**
 * Get assignments for a source.
 */
export async function getSourceAssignments(
  stagedSourceId: string
): Promise<TypedSourceAssignment[]> {
  const assignments = await prisma.sourceAssignment.findMany({
    where: { stagedSourceId },
    include: { stagedSource: true },
    orderBy: { assignedAt: 'desc' },
  });

  return assignments.map((a) => ({
    ...a,
    stagedSource: toTypedSource(a.stagedSource),
  }));
}

/**
 * Mark an assignment as incorporated (content has been added to the block).
 */
export async function markAssignmentIncorporated(
  assignmentId: string,
  incorporatedBy?: string
): Promise<TypedSourceAssignment> {
  const assignment = await prisma.sourceAssignment.update({
    where: { id: assignmentId },
    data: {
      incorporatedAt: new Date(),
      incorporatedBy,
    },
    include: { stagedSource: true },
  });

  return {
    ...assignment,
    stagedSource: toTypedSource(assignment.stagedSource),
  };
}

/**
 * Remove an assignment.
 */
export async function removeAssignment(assignmentId: string): Promise<void> {
  await prisma.sourceAssignment.delete({
    where: { id: assignmentId },
  });
}

// =============================================================================
// IGNORE/UNIGNORE
// =============================================================================

/**
 * Ignore a staged source (won't appear in pending list).
 */
export async function ignoreSource(
  id: string,
  ignoredBy?: string
): Promise<TypedStagedSource> {
  const source = await prisma.stagedSource.update({
    where: { id },
    data: {
      ignoredAt: new Date(),
      ignoredBy,
    },
  });

  return toTypedSource(source);
}

/**
 * Unignore a staged source (will reappear in pending list).
 */
export async function unignoreSource(id: string): Promise<TypedStagedSource> {
  const source = await prisma.stagedSource.update({
    where: { id },
    data: {
      ignoredAt: null,
      ignoredBy: null,
    },
  });

  return toTypedSource(source);
}

/**
 * Bulk ignore sources.
 */
export async function ignoreSources(
  ids: string[],
  ignoredBy?: string
): Promise<{ ignored: number }> {
  const result = await prisma.stagedSource.updateMany({
    where: { id: { in: ids } },
    data: {
      ignoredAt: new Date(),
      ignoredBy,
    },
  });

  return { ignored: result.count };
}

// =============================================================================
// DELETE
// =============================================================================

/**
 * Delete a staged source and its assignments.
 */
export async function deleteSource(id: string): Promise<void> {
  await prisma.stagedSource.delete({
    where: { id },
  });
}

/**
 * Delete old ignored sources (cleanup).
 */
export async function deleteOldIgnoredSources(
  olderThanDays: number = 30
): Promise<{ deleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.stagedSource.deleteMany({
    where: {
      ignoredAt: { lt: cutoffDate },
    },
  });

  return { deleted: result.count };
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get staging statistics for a library.
 */
export async function getLibraryStats(libraryId: LibraryId): Promise<{
  pending: number;
  ignored: number;
  assigned: number;
  incorporated: number;
  bySourceType: Record<SourceType, number>;
}> {
  const [pending, ignored, assigned, incorporated, bySourceType] = await Promise.all([
    prisma.stagedSource.count({
      where: { libraryId, ignoredAt: null },
    }),
    prisma.stagedSource.count({
      where: { libraryId, ignoredAt: { not: null } },
    }),
    prisma.sourceAssignment.count({
      where: {
        stagedSource: { libraryId },
        incorporatedAt: null,
      },
    }),
    prisma.sourceAssignment.count({
      where: {
        stagedSource: { libraryId },
        incorporatedAt: { not: null },
      },
    }),
    prisma.stagedSource.groupBy({
      by: ['sourceType'],
      where: { libraryId },
      _count: true,
    }),
  ]);

  const sourceTypeCounts: Record<string, number> = {
    url: 0,
    zendesk: 0,
    slack: 0,
    notion: 0,
    gong: 0,
    document: 0,
  };

  for (const item of bySourceType) {
    sourceTypeCounts[item.sourceType] = item._count;
  }

  return {
    pending,
    ignored,
    assigned,
    incorporated,
    bySourceType: sourceTypeCounts as Record<SourceType, number>,
  };
}
