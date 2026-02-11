/**
 * Git Sync Services
 *
 * Centralized exports for all git-synced entity services.
 * Use these services for all git operations on Skills, Customers, Prompts, and Templates.
 *
 * @example
 * ```typescript
 * import { skillGitSync } from '@/lib/git-sync';
 *
 * // Save and commit a skill
 * const commitSha = await skillGitSync.saveAndCommit(
 *   'onboarding-process',
 *   skillData,
 *   'Add onboarding process skill',
 *   { name: 'John Doe', email: 'john@example.com' }
 * );
 *
 * // Get history
 * const history = await skillGitSync.getHistory('onboarding-process', 10);
 * ```
 */

// Base class (for extending with new entity types)
export { BaseGitSyncService } from "./base-git-sync.service";
export type { GitCommitInfo } from "./base-git-sync.service";

// Concrete service instances
export { skillGitSync } from "./skill-git-sync.service";
export { promptBlockGitSync } from "./prompt-block-git-sync.service";
export { promptModifierGitSync } from "./prompt-modifier-git-sync.service";

// Type re-exports for convenience
export type { GitAuthor } from "../gitCommitHelpers";
export type { SkillFile } from "../skillFiles";
export type { PromptBlockFile, PromptModifierFile } from "../promptFiles";
