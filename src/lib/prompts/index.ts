/**
 * Unified Prompt Management
 *
 * This module provides:
 * - CRUD operations for all prompts (system blocks, chat library, personas)
 * - Version history with diffs and rollback
 * - DB override support (edits stored in DB, fall back to hard-coded)
 * - Async-aware prompt building for runtime customization
 *
 * Usage:
 *
 * ```typescript
 * // Admin operations
 * import { getAllPrompts, updatePrompt, getVersionHistory } from '@/lib/prompts';
 *
 * // List all prompts
 * const prompts = await getAllPrompts();
 *
 * // Update a prompt (creates DB override if built-in)
 * await updatePrompt('source_fidelity', {
 *   content: 'Updated content...',
 *   commitMessage: 'Made it more concise',
 *   userId: 'user@example.com',
 * });
 *
 * // Rollback to previous version
 * await rollbackToVersion('source_fidelity', 2, 'user@example.com');
 *
 * // For building prompts with DB override support
 * import { resolveBlocks, resolveLibraryContext, buildPromptAsync } from '@/lib/prompts';
 *
 * // Build prompt with overrides applied
 * const { systemPrompt, blocksUsed } = await buildPromptAsync({
 *   context: 'skill_creation',
 *   blockIds: ['source_fidelity', 'skill_principles', 'json_output'],
 *   libraryId: 'it',
 * });
 * ```
 */

export {
  // Types
  type ManagedPrompt,
  type CreatePromptInput,
  type UpdatePromptInput,

  // CRUD operations
  getAllPrompts,
  getPromptBySlug,
  getPromptById,
  createPrompt,
  updatePrompt,
  updatePromptVariant,
  resetToDefault,
  deletePrompt,

  // Version history
  getVersionHistory,
  rollbackToVersion,

  // Block resolution (for prompt building)
  resolveBlock,
  resolveBlockVariant,
  resolveLibraryContext,
  resolveBlocks,

  // Async prompt building
  buildPromptAsync,
} from './prompt-service';
