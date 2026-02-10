/**
 * V2 Prompt System
 *
 * Simplified prompt system for skill building:
 * - Blocks: Reusable prompt components (no variants)
 * - Compositions: Which blocks to use for each task
 * - Builder: Assembles prompts from blocks
 *
 * Key compositions:
 * - skill_creation: Create new skill with scope + citations
 * - skill_update: Update skill with diff + contradiction detection
 * - skill_matching: Match source to skills via scope definitions
 */

// Types
export * from './types';

// Blocks
export { coreBlocks, getBlock, getBlocks } from './blocks';

// Compositions
export {
  skillCompositions,
  skillCreationComposition,
  skillUpdateComposition,
  skillMatchingComposition,
  skillFormatRefreshComposition,
  skillCreationUserPrompt,
  skillUpdateUserPrompt,
  skillMatchingUserPrompt,
  skillFormatRefreshUserPrompt,
} from './compositions';
export { allCompositions, getComposition } from './compositions';

// Builder
export {
  buildPrompt,
  buildPromptFromComposition,
  buildSystemPrompt,
  buildSkillCreationPrompt,
  buildSkillUpdatePrompt,
  buildSkillMatchingPrompt,
  buildSkillFormatRefreshPrompt,
  getUserPromptTemplate,
  fillUserPrompt,
  formatSourcesForPrompt,
  formatSkillScopesForPrompt,
  // Library context helpers
  getLibraryContext,
  getCustomerSkillContext,
} from './builder';
