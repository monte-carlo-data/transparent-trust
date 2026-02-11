/**
 * BlockService - CRUD operations for BuildingBlocks
 *
 * This is the primary service for working with the unified BuildingBlock model.
 * All block types (knowledge, persona, template) flow through this service.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  type TypedBuildingBlock,
  type CreateBlockInput,
  type UpdateBlockInput,
  type BlockQueryOptions,
  type LibraryId,
  type BlockStatus,
  toTypedBlock,
  LIBRARY_BLOCK_TYPE,
} from '@/types/v2';
import { createSlug } from '@/lib/frontmatterStore';
import { validateScopeDefinition } from '@/lib/v2/skills/scope-validator';

// =============================================================================
// CREATE
// =============================================================================

/**
 * Create a new BuildingBlock.
 */
export async function createBlock<T extends TypedBuildingBlock>(
  input: CreateBlockInput<T>
): Promise<T> {
  const blockType = LIBRARY_BLOCK_TYPE[input.libraryId];

  // Generate slug if not provided
  const slug = input.slug || createSlug(input.title);

  const block = await prisma.buildingBlock.create({
    data: {
      blockType,
      libraryId: input.libraryId,
      entryType: input.entryType,
      slug,
      title: input.title,
      content: input.content,
      summary: input.summary,
      categories: input.categories || [],
      attributes: (input.attributes || {}) as Prisma.InputJsonValue,
      teamId: input.teamId,
      ownerId: input.ownerId,
      status: input.status || 'ACTIVE',
      customerId: input.customerId,
      skillType: input.skillType || 'knowledge',
    },
  });

  return toTypedBlock(block) as T;
}

// =============================================================================
// READ
// =============================================================================

/**
 * Get a block by ID.
 */
export async function getBlockById(id: string): Promise<TypedBuildingBlock | null> {
  const block = await prisma.buildingBlock.findUnique({
    where: { id },
  });

  return block ? toTypedBlock(block) : null;
}

/**
 * Get a block by library and slug (for global skills, not customer-scoped).
 *
 * Note: For customer-scoped skills (libraryId='customers'), use queryBlocks
 * with both libraryId and customerId filters, as the unique constraint is now
 * [libraryId, customerId, slug].
 */
export async function getBlockBySlug(
  libraryId: LibraryId,
  slug: string
): Promise<TypedBuildingBlock | null> {
  // The unique constraint is now [libraryId, customerId, slug]
  // For global skills, customerId is null
  const block = await prisma.buildingBlock.findFirst({
    where: {
      libraryId,
      slug,
      customerId: null, // Only global skills
    },
  });

  return block ? toTypedBlock(block) : null;
}

/**
 * Query blocks with filters.
 */
export async function queryBlocks(
  options: BlockQueryOptions = {}
): Promise<{ blocks: TypedBuildingBlock[]; total: number }> {
  const {
    libraryId,
    blockType,
    status,
    teamId,
    ownerId,
    customerId,
    categories,
    search,
    limit = 50,
    offset = 0,
    orderBy = 'updatedAt',
    orderDir = 'desc',
  } = options;

  const where: Prisma.BuildingBlockWhereInput = {
    ...(libraryId && { libraryId }),
    ...(blockType && { blockType }),
    ...(status && { status }),
    ...(teamId && { teamId }),
    ...(ownerId && { ownerId }),
    ...(customerId && { customerId }),
    ...(categories?.length && { categories: { hasSome: categories } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [blocks, total] = await Promise.all([
    prisma.buildingBlock.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { [orderBy]: orderDir },
    }),
    prisma.buildingBlock.count({ where }),
  ]);

  return {
    blocks: blocks.map(toTypedBlock),
    total,
  };
}

/**
 * Get all blocks for a library.
 */
export async function getBlocksByLibrary(
  libraryId: LibraryId,
  options: Omit<BlockQueryOptions, 'libraryId'> = {}
): Promise<{ blocks: TypedBuildingBlock[]; total: number }> {
  return queryBlocks({ ...options, libraryId });
}

/**
 * Get active blocks for context injection (e.g., for chat).
 */
export async function getActiveBlocksForContext(
  libraryIds: LibraryId[],
  options: { limit?: number; categories?: string[] } = {}
): Promise<TypedBuildingBlock[]> {
  const { limit = 100, categories } = options;

  const blocks = await prisma.buildingBlock.findMany({
    where: {
      libraryId: { in: libraryIds },
      status: 'ACTIVE',
      ...(categories?.length && { categories: { hasSome: categories } }),
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  });

  return blocks.map(toTypedBlock);
}

/**
 * Lightweight scope index for all active skills.
 * Used for pre-flight skill selection without loading full content.
 * Returns ~100-150 tokens per skill vs ~3000 for full content.
 */
export interface SkillScopeIndex {
  id: string;
  title: string;
  scopeDefinition?: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
    keywords?: string[]; // For fast keyword-based matching
  };
}

/**
 * Get scope index for skills - lightweight alternative to getActiveBlocksForContext.
 * Used for scope-based skill selection in RFP processing.
 * Validates scope definitions and warns if invalid (but doesn't fail - returns as-is).
 */
export async function getScopeIndex(
  libraryIds: LibraryId[]
): Promise<SkillScopeIndex[]> {
  const blocks = await prisma.buildingBlock.findMany({
    where: {
      libraryId: { in: libraryIds },
      status: 'ACTIVE',
    },
    select: {
      id: true,
      title: true,
      attributes: true,
    },
  });

  return blocks.map(block => {
    const attrs = (block.attributes as Record<string, unknown>) || {};
    const rawScope = attrs.scopeDefinition as unknown;

    const scopeDefinition = rawScope as SkillScopeIndex['scopeDefinition'];

    // Validate scope definition if present
    if (rawScope) {
      const validation = validateScopeDefinition(rawScope);
      if (!validation.success) {
        console.warn('[getScopeIndex] Invalid scope definition for skill:', {
          blockId: block.id,
          title: block.title,
          errors: validation.errors
        });
        // Don't fail - return the invalid scope so we can see what's wrong
        // The scope matching logic will handle empty/invalid scopes gracefully
      }
    }

    return {
      id: block.id,
      title: block.title,
      scopeDefinition,
    };
  });
}

// =============================================================================
// UPDATE
// =============================================================================

/**
 * Update a block.
 */
export async function updateBlock<T extends TypedBuildingBlock>(
  id: string,
  input: UpdateBlockInput<T>
): Promise<T> {
  const existing = await prisma.buildingBlock.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error(`Block not found: ${id}`);
  }

  // Merge attributes if provided
  const attributes = input.attributes
    ? { ...(existing.attributes as object), ...input.attributes }
    : undefined;

  const block = await prisma.buildingBlock.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.summary !== undefined && { summary: input.summary }),
      ...(input.categories !== undefined && { categories: input.categories }),
      ...(input.entryType !== undefined && { entryType: input.entryType }),
      ...(input.status !== undefined && { status: input.status }),
      ...(attributes && { attributes: attributes as Prisma.InputJsonValue }),
      // Increment version on content changes
      ...(input.content !== undefined && { version: { increment: 1 } }),
      // Mark as having local changes if git-synced
      ...(existing.gitPath && { syncStatus: 'LOCAL_CHANGES' }),
    },
  });

  return toTypedBlock(block) as T;
}

/**
 * Update block status.
 */
export async function updateBlockStatus(
  id: string,
  status: BlockStatus
): Promise<TypedBuildingBlock> {
  const block = await prisma.buildingBlock.update({
    where: { id },
    data: { status },
  });

  return toTypedBlock(block);
}

/**
 * Activate a block (set status to ACTIVE).
 */
export async function activateBlock(id: string): Promise<TypedBuildingBlock> {
  return updateBlockStatus(id, 'ACTIVE');
}

/**
 * Archive a block (set status to ARCHIVED).
 */
export async function archiveBlock(id: string): Promise<TypedBuildingBlock> {
  return updateBlockStatus(id, 'ARCHIVED');
}

// =============================================================================
// DELETE
// =============================================================================

/**
 * Soft delete a block (sets status to ARCHIVED).
 */
export async function deleteBlock(id: string): Promise<void> {
  await prisma.buildingBlock.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  });
}

/**
 * Hard delete a block (permanently removes from database).
 * Use with caution - this is irreversible.
 */
export async function hardDeleteBlock(id: string): Promise<void> {
  await prisma.buildingBlock.delete({
    where: { id },
  });
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Create multiple blocks at once.
 */
export async function createManyBlocks(
  inputs: CreateBlockInput[]
): Promise<{ created: number }> {
  const data = inputs.map((input) => {
    const blockType = LIBRARY_BLOCK_TYPE[input.libraryId];
    const slug = input.slug || createSlug(input.title);

    return {
      blockType,
      libraryId: input.libraryId,
      entryType: input.entryType,
      slug,
      title: input.title,
      content: input.content,
      summary: input.summary,
      categories: input.categories || [],
      attributes: (input.attributes || {}) as Prisma.InputJsonValue,
      teamId: input.teamId,
      ownerId: input.ownerId,
      status: input.status || 'ACTIVE',
      skillType: input.skillType || 'knowledge',
    };
  });

  const result = await prisma.buildingBlock.createMany({
    data,
    skipDuplicates: true,
  });

  return { created: result.count };
}

/**
 * Update status for multiple blocks.
 */
export async function updateManyBlockStatus(
  ids: string[],
  status: BlockStatus
): Promise<{ updated: number }> {
  const result = await prisma.buildingBlock.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  return { updated: result.count };
}

// =============================================================================
// GIT SYNC HELPERS
// =============================================================================

/**
 * Get blocks that need to be synced to git.
 */
export async function getBlocksNeedingSync(): Promise<TypedBuildingBlock[]> {
  const blocks = await prisma.buildingBlock.findMany({
    where: {
      gitPath: { not: null },
      syncStatus: 'LOCAL_CHANGES',
      status: 'ACTIVE',
    },
  });

  return blocks.map(toTypedBlock);
}

/**
 * Mark a block as synced with git.
 */
export async function markBlockSynced(
  id: string,
  commitSha: string
): Promise<TypedBuildingBlock> {
  const block = await prisma.buildingBlock.update({
    where: { id },
    data: {
      gitCommitSha: commitSha,
      syncStatus: 'SYNCED',
      lastSyncedAt: new Date(),
    },
  });

  return toTypedBlock(block);
}

/**
 * Set up git sync for a block.
 */
export async function enableGitSync(
  id: string,
  gitPath: string
): Promise<TypedBuildingBlock> {
  const block = await prisma.buildingBlock.update({
    where: { id },
    data: {
      gitPath,
      syncStatus: 'LOCAL_CHANGES', // Will be synced on next push
    },
  });

  return toTypedBlock(block);
}

// =============================================================================
// SOURCE TRANSPARENCY
// =============================================================================

export interface SkillSource {
  skillTitle: string;
  skillId: string;
  sources: Array<{
    type: string;
    url?: string;
    title?: string;
    externalId?: string;
  }>;
}

/**
 * Get the underlying sources for skills by their titles.
 * Used for transparency display in Q&A responses.
 */
export async function getSkillSourcesByTitles(
  titles: string[],
  libraryIds: LibraryId[]
): Promise<SkillSource[]> {
  // Find skills by title
  const blocks = await prisma.buildingBlock.findMany({
    where: {
      title: { in: titles },
      libraryId: { in: libraryIds },
      status: 'ACTIVE',
    },
    select: {
      id: true,
      title: true,
      attributes: true,
    },
  });

  // Get source assignments for these blocks
  const blockIds = blocks.map((b) => b.id);
  const assignments = await prisma.sourceAssignment.findMany({
    where: {
      blockId: { in: blockIds },
      incorporatedAt: { not: null },
    },
    include: {
      stagedSource: {
        select: {
          id: true,
          title: true,
          sourceType: true,
          externalId: true,
          metadata: true,
        },
      },
    },
  });

  // Group sources by block
  const sourcesByBlock = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const existing = sourcesByBlock.get(assignment.blockId) || [];
    existing.push(assignment);
    sourcesByBlock.set(assignment.blockId, existing);
  }

  // Build result
  return blocks.map((block) => {
    const blockAssignments = sourcesByBlock.get(block.id) || [];
    const attrs = (block.attributes as Record<string, unknown>) || {};

    // Get URL sources from attributes (legacy format)
    const urlSources = (attrs.sources as string[]) || [];

    const sources: SkillSource['sources'] = [];

    // Add staged source assignments
    for (const assignment of blockAssignments) {
      const metadata = (assignment.stagedSource.metadata as Record<string, unknown>) || {};
      sources.push({
        type: assignment.stagedSource.sourceType,
        url: (metadata.url as string) || (metadata.permalink as string),
        title: assignment.stagedSource.title,
        externalId: assignment.stagedSource.externalId || undefined,
      });
    }

    // Add legacy URL sources
    for (const url of urlSources) {
      sources.push({
        type: 'URL',
        url,
      });
    }

    return {
      skillTitle: block.title,
      skillId: block.id,
      sources,
    };
  });
}
