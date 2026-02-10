/**
 * Shared data fetching functions for skill detail pages
 *
 * Centralizes common query patterns used across knowledge, IT, and customers libraries
 * to prevent duplication and ensure consistency.
 */

import { prisma } from '@/lib/prisma';
import type { LibraryId, TypedBuildingBlock } from '@/types/v2';
import { toTypedBlock } from '@/types/v2';

interface RelatedSkillBase {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  attributes: unknown;
  status: string;
  updatedAt: Date;
}

/**
 * Get a skill by slug or ID
 * @param customerId - Pass null explicitly to find foundational skills (templates)
 * @returns TypedBuildingBlock or null if not found
 */
export async function getSkillWithRelations(
  slug: string,
  libraryId: LibraryId,
  customerId?: string | null
): Promise<TypedBuildingBlock | null> {
  const skill = await prisma.buildingBlock.findFirst({
    where: {
      OR: [{ slug, libraryId }, { id: slug, libraryId }],
      status: 'ACTIVE',
      // If customerId is explicitly passed (including null), filter by it
      ...(customerId !== undefined && { customerId }),
    },
    include: {
      team: { select: { id: true, name: true } },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return skill ? toTypedBlock(skill as any) : null;
}

/**
 * Get source assignments (incorporated sources) for a skill
 */
export async function getSourceAssignments(skillId: string) {
  return prisma.sourceAssignment.findMany({
    where: { blockId: skillId },
    include: { stagedSource: true },
    orderBy: { assignedAt: 'desc' },
  });
}

/**
 * Get incorporated sources (with incorporatedAt timestamp)
 */
export async function getIncorporatedSources(skillId: string) {
  return prisma.sourceAssignment.findMany({
    where: {
      blockId: skillId,
      incorporatedAt: { not: null },
    },
    include: { stagedSource: true },
    orderBy: { incorporatedAt: 'desc' },
  });
}

/**
 * Get pending assignments (assigned but not yet incorporated)
 */
export async function getPendingAssignments(skillId: string) {
  return prisma.sourceAssignment.findMany({
    where: {
      blockId: skillId,
      incorporatedAt: null,
    },
    include: { stagedSource: true },
    orderBy: { assignedAt: 'desc' },
  });
}

/**
 * Get pending sources for a library (not yet assigned to this skill)
 */
export async function getPendingSources(skillId: string, libraryId: LibraryId) {
  return prisma.stagedSource.findMany({
    where: {
      libraryId,
      ignoredAt: null,
      assignments: { none: { blockId: skillId } },
    },
    take: 10,
    orderBy: { stagedAt: 'desc' },
  });
}

/**
 * Get related skills by slug within the same library
 */
export async function getRelatedSkillsBySlug(
  skillId: string,
  relatedSlugs: string[],
  libraryId: LibraryId = 'knowledge'
): Promise<RelatedSkillBase[]> {
  if (relatedSlugs.length === 0) return [];

  return (await prisma.buildingBlock.findMany({
    where: {
      libraryId,
      status: 'ACTIVE',
      slug: { in: relatedSlugs },
    },
    take: 10,
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      attributes: true,
      status: true,
      updatedAt: true,
    },
  })) as RelatedSkillBase[];
}

/**
 * Get linked skills for a customer
 */
export async function getLinkedSkillsForCustomer(relatedSlugs: string[]) {
  if (relatedSlugs.length === 0) return [];

  return await prisma.buildingBlock.findMany({
    where: {
      libraryId: 'knowledge',
      status: 'ACTIVE',
      slug: { in: relatedSlugs },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      attributes: true,
    },
    take: 20,
  });
}

/**
 * Get linked documents for a customer
 */
export async function getLinkedDocuments(sourceIds: string[]) {
  if (sourceIds.length === 0) return [];

  return await prisma.stagedSource.findMany({
    where: { id: { in: sourceIds } },
    select: {
      id: true,
      title: true,
      sourceType: true,
      content: true,
      stagedAt: true,
    },
  });
}

// ============================================================================
// Serialization helpers for client components
// ============================================================================

/** Return type for source assignments passed to client components */
export interface SerializedSourceAssignment {
  id: string;
  stagedSourceId: string;
  incorporatedAt: string | null;
  title: string;
  sourceType: string;
  content: string;
  contentLength: number;
}

/** Return type for pending sources passed to client components */
export interface SerializedPendingSource {
  id: string;
  title: string;
  sourceType: string;
  content: string;
  contentLength: number;
}

/** Raw source assignment from Prisma (with stagedSource included) */
type RawSourceAssignment = Awaited<ReturnType<typeof getSourceAssignments>>[number];

/** Raw pending assignment from Prisma (with stagedSource included) */
type RawPendingAssignment = Awaited<ReturnType<typeof getPendingAssignments>>[number];

/**
 * Serialize source assignments for client components.
 * Converts dates to ISO strings and includes content for token calculation.
 */
export function serializeSourceAssignments(
  raw: RawSourceAssignment[]
): SerializedSourceAssignment[] {
  return raw.map((sa) => ({
    id: sa.id,
    stagedSourceId: sa.stagedSourceId,
    incorporatedAt: sa.incorporatedAt?.toISOString() ?? null,
    title: sa.stagedSource.title,
    sourceType: sa.stagedSource.sourceType,
    content: sa.stagedSource.content || '',
    contentLength: sa.stagedSource.content?.length || 0,
  }));
}

/**
 * Serialize pending assignments for client components.
 * Includes content for token calculation.
 */
export function serializePendingSources(
  raw: RawPendingAssignment[]
): SerializedPendingSource[] {
  return raw.map((pa) => ({
    id: pa.stagedSourceId,
    title: pa.stagedSource.title,
    sourceType: pa.stagedSource.sourceType,
    content: pa.stagedSource.content || '',
    contentLength: pa.stagedSource.content?.length || 0,
  }));
}
