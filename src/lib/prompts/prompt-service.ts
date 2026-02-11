/**
 * Unified Prompt Management Service
 *
 * Bridges between:
 * - Hard-coded core blocks (v2/prompts/core-blocks.ts)
 * - Hard-coded legacy blocks (prompt-system/blocks.ts)
 * - Database-stored prompt blocks (BuildingBlock with libraryId='prompts')
 *
 * Provides:
 * - CRUD operations for prompts
 * - Version history with diffs
 * - Variant management
 * - Override system (DB takes precedence over hard-coded)
 */

import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  toTypedBlock,
  type PromptBlock as TypedPromptBlock,
  type PromptAttributes,
  type PromptVersionEntry,
} from '@/types/v2';
import type { PromptBlock, BlockTier } from '@/lib/v2/prompts/types';
import { coreBlocks as v2CoreBlocks } from '@/lib/v2/prompts/blocks';
import { LIBRARY_CONTEXT } from '@/lib/v2/prompts/builder';
import type { LibraryId } from '@/types/v2';

// =============================================================================
// TYPES
// =============================================================================

/** Unified prompt representation for the admin UI */
export interface ManagedPrompt {
  /** Unique identifier */
  id: string;
  /** URL-safe slug */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Description of what this prompt does */
  description: string;
  /** Main content (or default variant content) */
  content: string;
  /** Editability tier (1=locked, 2=caution, 3=open) */
  tier: BlockTier;
  /** Source system */
  source: 'v2-core' | 'legacy' | 'chat-library' | 'library-context' | 'custom';
  /** Type categorization */
  type: 'system-block' | 'chat-prompt' | 'library-context' | 'preset';
  /** Context variants (for legacy blocks) */
  variants?: Record<string, string>;
  /** Available contexts this prompt is used in */
  contexts?: string[];
  /** Whether this prompt has a DB override */
  hasOverride: boolean;
  /** Version number (if from DB) */
  version?: number;
  /** Last updated timestamp */
  updatedAt?: string;
  /** Categories/tags */
  categories?: string[];
}

/** Input for creating a new prompt */
export interface CreatePromptInput {
  slug: string;
  name: string;
  description?: string;
  content: string;
  tier?: BlockTier;
  type?: 'system-block' | 'chat-prompt' | 'library-context' | 'preset';
  variants?: Record<string, string>;
  categories?: string[];
  commitMessage: string;
  userId: string;
}

/** Input for updating a prompt */
export interface UpdatePromptInput {
  content?: string;
  name?: string;
  description?: string;
  variants?: Record<string, string>;
  categories?: string[];
  commitMessage: string;
  userId: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a simple line-based diff between two strings
 */
function generateDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: string[] = [];

  // Simple diff - not perfect but good enough for display
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine !== newLine) {
      if (oldLine !== undefined) diff.push(`- ${oldLine}`);
      if (newLine !== undefined) diff.push(`+ ${newLine}`);
    }
  }

  return diff.length > 0 ? diff.join('\n') : '(no changes)';
}


// =============================================================================
// CORE SERVICE FUNCTIONS
// =============================================================================

/**
 * Get all prompts from all sources (hard-coded + DB overrides)
 */
export async function getAllPrompts(): Promise<ManagedPrompt[]> {
  const prompts: ManagedPrompt[] = [];

  // 1. Load DB overrides first (to check against hard-coded)
  const dbPrompts = await prisma.buildingBlock.findMany({
    where: {
      libraryId: 'prompts',
      status: 'ACTIVE',
    },
  });

  const dbOverridesBySlug = new Map(dbPrompts.map((p) => [p.slug, p]));

  // 2. Add V2 core blocks
  for (const block of v2CoreBlocks) {
    const override = dbOverridesBySlug.get(block.id);
    const attrs = override
      ? (toTypedBlock(override) as TypedPromptBlock).attributes
      : null;

    prompts.push({
      id: override?.id || `v2-${block.id}`,
      slug: block.id,
      name: block.name,
      description: block.description,
      content: override?.content || block.content,
      tier: attrs?.promptTier || block.tier,
      source: 'v2-core',
      type: 'system-block',
      contexts: ['skill_creation', 'skill_update', 'skill_matching'],
      hasOverride: !!override,
      version: override?.version || undefined,
      updatedAt: override?.updatedAt?.toISOString(),
      categories: override?.categories || [],
    });

    // Remove from map so we don't double-count
    if (override) dbOverridesBySlug.delete(block.id);
  }

  // 3. Add library contexts
  // Note: 'customers' is no longer a library (customers are now a separate table)
  // 'personas' and 'templates' are deprecated (consolidated into 'prompts')
  const libraryIds: LibraryId[] = ['knowledge', 'it', 'gtm', 'prompts'];
  for (const libId of libraryIds) {
    const contextContent = LIBRARY_CONTEXT[libId];
    if (!contextContent) continue;

    const slug = `library-context-${libId}`;
    const override = dbOverridesBySlug.get(slug);
    const attrs = override
      ? (toTypedBlock(override) as TypedPromptBlock).attributes
      : null;

    prompts.push({
      id: override?.id || slug,
      slug,
      name: `Library Context: ${libId.charAt(0).toUpperCase() + libId.slice(1)}`,
      description: `Context injected when building ${libId} skills`,
      content: override?.content || contextContent,
      tier: attrs?.promptTier || 2,
      source: 'library-context',
      type: 'library-context',
      hasOverride: !!override,
      version: override?.version || undefined,
      updatedAt: override?.updatedAt?.toISOString(),
      categories: ['library-context', libId],
    });

    if (override) dbOverridesBySlug.delete(slug);
  }

  // 5. Add any remaining DB prompts (custom user-created)
  for (const [, dbPrompt] of dbOverridesBySlug) {
    const attrs = (toTypedBlock(dbPrompt) as TypedPromptBlock).attributes;

    prompts.push({
      id: dbPrompt.id,
      slug: dbPrompt.slug || dbPrompt.id, // Fallback to id if slug is null
      name: dbPrompt.title,
      description: dbPrompt.summary || '',
      content: dbPrompt.content,
      tier: attrs?.promptTier || 3,
      source: 'custom',
      type: (attrs?.presetConfig ? 'preset' : 'system-block') as ManagedPrompt['type'],
      variants: attrs?.contextVariants,
      hasOverride: false, // It IS the override
      version: dbPrompt.version || 1,
      updatedAt: dbPrompt.updatedAt?.toISOString(),
      categories: dbPrompt.categories || [],
    });
  }

  return prompts;
}

/**
 * Get a single prompt by slug
 */
export async function getPromptBySlug(slug: string): Promise<ManagedPrompt | null> {
  const allPrompts = await getAllPrompts();
  return allPrompts.find((p) => p.slug === slug) || null;
}

/**
 * Get a prompt by ID (DB ID or synthetic ID)
 */
export async function getPromptById(id: string): Promise<ManagedPrompt | null> {
  const allPrompts = await getAllPrompts();
  return allPrompts.find((p) => p.id === id) || null;
}

/**
 * Create a new prompt (stored in DB)
 */
export async function createPrompt(input: CreatePromptInput): Promise<ManagedPrompt> {
  const attributes: PromptAttributes = {
    promptTier: input.tier || 3,
    promptSource: 'custom',
    contextVariants: input.variants,
    versionHistory: [
      {
        version: 1,
        content: input.content,
        contextVariantsSnapshot: input.variants,
        commitMessage: input.commitMessage,
        changedBy: input.userId,
        changedAt: new Date().toISOString(),
      },
    ],
  };

  const created = await prisma.buildingBlock.create({
    data: {
      slug: input.slug,
      title: input.name,
      summary: input.description || '',
      content: input.content,
      blockType: 'knowledge',
      libraryId: 'prompts',
      entryType: input.type || 'system-block',
      categories: input.categories || [],
      attributes: attributes as unknown as Prisma.InputJsonValue,
      status: 'ACTIVE',
      version: 1,
    },
  });

  return {
    id: created.id,
    slug: created.slug || input.slug, // Use input slug as fallback
    name: created.title,
    description: created.summary || '',
    content: created.content,
    tier: input.tier || 3,
    source: 'custom',
    type: input.type || 'system-block',
    variants: input.variants,
    hasOverride: false,
    version: 1,
    updatedAt: created.updatedAt.toISOString(),
    categories: input.categories,
  };
}

/**
 * Update a prompt (creates DB override if updating hard-coded, updates existing if DB)
 */
export async function updatePrompt(
  slug: string,
  input: UpdatePromptInput
): Promise<ManagedPrompt> {
  // Check if there's already a DB record
  let dbPrompt = await prisma.buildingBlock.findFirst({
    where: { slug, libraryId: 'prompts' },
  });

  // Get the current prompt data
  const currentPrompt = await getPromptBySlug(slug);
  if (!currentPrompt) {
    throw new Error(`Prompt not found: ${slug}`);
  }

  const newContent = input.content ?? currentPrompt.content;
  const newVariants = input.variants ?? currentPrompt.variants;
  const newVersion = (currentPrompt.version || 0) + 1;

  // Build new version history entry
  const versionEntry: PromptVersionEntry = {
    version: newVersion,
    content: newContent,
    contextVariantsSnapshot: newVariants,
    commitMessage: input.commitMessage,
    changedBy: input.userId,
    changedAt: new Date().toISOString(),
    diff: generateDiff(currentPrompt.content, newContent),
  };

  if (dbPrompt) {
    // Update existing DB record
    const existingAttrs = (toTypedBlock(dbPrompt) as TypedPromptBlock).attributes || {};
    const existingHistory = existingAttrs.versionHistory || [];

    const updatedAttrs: PromptAttributes = {
      ...existingAttrs,
      contextVariants: newVariants,
      versionHistory: [...existingHistory, versionEntry],
    };

    await prisma.buildingBlock.update({
      where: { id: dbPrompt.id },
      data: {
        title: input.name ?? dbPrompt.title,
        summary: input.description ?? dbPrompt.summary,
        content: newContent,
        categories: input.categories ?? dbPrompt.categories,
        attributes: updatedAttrs as unknown as Prisma.InputJsonValue,
        version: newVersion,
        syncStatus: 'LOCAL_CHANGES',
      },
    });
  } else {
    // Create new DB override for hard-coded prompt
    const attributes: PromptAttributes = {
      promptTier: currentPrompt.tier,
      promptSource: currentPrompt.source,
      overridesBlockId: slug,
      contextVariants: newVariants,
      versionHistory: [versionEntry],
    };

    dbPrompt = await prisma.buildingBlock.create({
      data: {
        slug,
        title: input.name ?? currentPrompt.name,
        summary: input.description ?? currentPrompt.description,
        content: newContent,
        blockType: 'knowledge',
        libraryId: 'prompts',
        entryType: currentPrompt.type,
        categories: input.categories ?? currentPrompt.categories ?? [],
        attributes: attributes as unknown as Prisma.InputJsonValue,
        status: 'ACTIVE',
        version: newVersion,
        syncStatus: 'LOCAL_CHANGES',
      },
    });
  }

  return {
    ...currentPrompt,
    id: dbPrompt.id,
    content: newContent,
    name: input.name ?? currentPrompt.name,
    description: input.description ?? currentPrompt.description,
    variants: newVariants,
    hasOverride: true,
    version: newVersion,
    updatedAt: new Date().toISOString(),
    categories: input.categories ?? currentPrompt.categories,
  };
}

/**
 * Update a specific variant of a prompt
 */
export async function updatePromptVariant(
  slug: string,
  context: string,
  content: string,
  commitMessage: string,
  userId: string
): Promise<ManagedPrompt> {
  const currentPrompt = await getPromptBySlug(slug);
  if (!currentPrompt) {
    throw new Error(`Prompt not found: ${slug}`);
  }

  const newVariants = {
    ...(currentPrompt.variants || {}),
    [context]: content,
  };

  return updatePrompt(slug, {
    variants: newVariants,
    commitMessage,
    userId,
  });
}

/**
 * Get version history for a prompt
 */
export async function getVersionHistory(slug: string): Promise<PromptVersionEntry[]> {
  const dbPrompt = await prisma.buildingBlock.findFirst({
    where: { slug, libraryId: 'prompts' },
  });

  if (!dbPrompt) {
    return []; // No history for hard-coded prompts without overrides
  }

  const attrs = (toTypedBlock(dbPrompt) as TypedPromptBlock).attributes;
  return attrs?.versionHistory || [];
}

/**
 * Rollback a prompt to a specific version
 */
export async function rollbackToVersion(
  slug: string,
  targetVersion: number,
  userId: string
): Promise<ManagedPrompt> {
  const history = await getVersionHistory(slug);
  const targetEntry = history.find((v) => v.version === targetVersion);

  if (!targetEntry) {
    throw new Error(`Version ${targetVersion} not found for prompt: ${slug}`);
  }

  return updatePrompt(slug, {
    content: targetEntry.content,
    variants: targetEntry.contextVariantsSnapshot,
    commitMessage: `Rollback to version ${targetVersion}`,
    userId,
  });
}

/**
 * Reset a prompt to its default (delete DB override)
 */
export async function resetToDefault(slug: string): Promise<boolean> {
  const dbPrompt = await prisma.buildingBlock.findFirst({
    where: { slug, libraryId: 'prompts' },
  });

  if (!dbPrompt) {
    return false; // Nothing to reset
  }

  // Check if this is an override or a custom prompt
  const attrs = (toTypedBlock(dbPrompt) as TypedPromptBlock).attributes;
  if (attrs?.promptSource === 'custom') {
    throw new Error('Cannot reset custom prompts - use delete instead');
  }

  await prisma.buildingBlock.delete({
    where: { id: dbPrompt.id },
  });

  return true;
}

/**
 * Delete a custom prompt (only works for user-created prompts)
 */
export async function deletePrompt(id: string): Promise<boolean> {
  const dbPrompt = await prisma.buildingBlock.findUnique({
    where: { id },
  });

  if (!dbPrompt || dbPrompt.libraryId !== 'prompts') {
    return false;
  }

  const attrs = (toTypedBlock(dbPrompt) as TypedPromptBlock).attributes;
  if (attrs?.promptSource !== 'custom') {
    throw new Error('Cannot delete built-in prompts - use resetToDefault instead');
  }

  await prisma.buildingBlock.delete({
    where: { id },
  });

  return true;
}

// =============================================================================
// BLOCK RESOLUTION (for use by prompt builder)
// =============================================================================

/**
 * Get a prompt block for use in prompt building
 * DB override takes precedence over hard-coded
 */
export async function resolveBlock(blockId: string): Promise<PromptBlock | null> {
  // Check DB first
  const dbPrompt = await prisma.buildingBlock.findFirst({
    where: {
      slug: blockId,
      libraryId: 'prompts',
      status: 'ACTIVE',
    },
  });

  if (dbPrompt) {
    const attrs = (toTypedBlock(dbPrompt) as TypedPromptBlock).attributes;
    return {
      id: blockId,
      name: dbPrompt.title,
      description: dbPrompt.summary || '',
      tier: attrs?.promptTier || 3,
      content: dbPrompt.content,
    };
  }

  // Check V2 core blocks
  const v2Block = v2CoreBlocks.find((b) => b.id === blockId);
  if (v2Block) {
    return v2Block;
  }

  return null;
}

/**
 * Get a prompt block variant (for legacy system)
 */
export async function resolveBlockVariant(
  blockId: string,
  context: string
): Promise<string | null> {
  // Check DB first
  const dbPrompt = await prisma.buildingBlock.findFirst({
    where: {
      slug: blockId,
      libraryId: 'prompts',
      status: 'ACTIVE',
    },
  });

  if (dbPrompt) {
    const attrs = (toTypedBlock(dbPrompt) as TypedPromptBlock).attributes;
    const variants = attrs?.contextVariants;
    if (variants && variants[context]) {
      return variants[context];
    }
    // Fall back to default content if no variant
    return dbPrompt.content;
  }

  return null;
}

/**
 * Get library context (with potential DB override)
 */
export async function resolveLibraryContext(libraryId: LibraryId): Promise<string> {
  const slug = `library-context-${libraryId}`;

  // Check DB first
  const dbPrompt = await prisma.buildingBlock.findFirst({
    where: {
      slug,
      libraryId: 'prompts',
      status: 'ACTIVE',
    },
  });

  if (dbPrompt) {
    return dbPrompt.content;
  }

  // Fall back to hard-coded
  return LIBRARY_CONTEXT[libraryId] || '';
}

// =============================================================================
// ASYNC PROMPT BUILDING (DB-AWARE)
// =============================================================================

/**
 * Build a system prompt with DB override support
 * This is the async version of buildPrompt from builder.ts
 *
 * Use this when you need DB overrides to take effect.
 * For static/cached scenarios, use the sync version from builder.ts.
 */
export async function buildPromptAsync(options: {
  context: string;
  blockIds: string[];
  libraryId?: LibraryId;
  additionalContext?: string;
}): Promise<{
  systemPrompt: string;
  blocksUsed: string[];
}> {
  // Resolve blocks with DB override support
  const blocks = await resolveBlocks(options.blockIds);

  // Build system prompt from blocks
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.content.trim()) {
      parts.push(`## ${block.name}\n\n${block.content}`);
    }
  }

  let systemPrompt = parts.join('\n\n');

  // Add library-specific context if provided
  if (options.libraryId) {
    const libraryContext = await resolveLibraryContext(options.libraryId);
    if (libraryContext) {
      systemPrompt += `\n\n## Library Context\n\n${libraryContext}`;
    }
  }

  // Add additional context if provided
  if (options.additionalContext) {
    systemPrompt += `\n\n## Additional Context\n\n${options.additionalContext}`;
  }

  return {
    systemPrompt,
    blocksUsed: options.blockIds,
  };
}

/**
 * Resolve multiple blocks at once (more efficient than calling resolveBlock multiple times)
 * DB overrides take precedence over hard-coded blocks
 */
export async function resolveBlocks(blockIds: string[]): Promise<PromptBlock[]> {
  // Fetch all DB overrides in one query
  const dbPrompts = await prisma.buildingBlock.findMany({
    where: {
      slug: { in: blockIds },
      libraryId: 'prompts',
      status: 'ACTIVE',
    },
  });

  const dbBySlug = new Map(dbPrompts.map((p) => [p.slug, p]));

  const result: PromptBlock[] = [];

  for (const blockId of blockIds) {
    // Check DB first
    const dbPrompt = dbBySlug.get(blockId);
    if (dbPrompt) {
      const attrs = (toTypedBlock(dbPrompt) as TypedPromptBlock).attributes;
      result.push({
        id: blockId,
        name: dbPrompt.title,
        description: dbPrompt.summary || '',
        tier: attrs?.promptTier || 3,
        content: dbPrompt.content,
      });
      continue;
    }

    // Check V2 core blocks
    const v2Block = v2CoreBlocks.find((b) => b.id === blockId);
    if (v2Block) {
      result.push(v2Block);
      continue;
    }

    // Block not found - log warning but continue
    console.warn(`Block not found: ${blockId}`);
  }

  return result;
}
