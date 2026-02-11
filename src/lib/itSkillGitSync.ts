/**
 * IT Skill Git Sync (Compatibility Layer)
 *
 * Maintains the function-based API while delegating to the class-based service.
 * Follows same pattern as skillGitSync.ts.
 */

import { itSkillGitSync } from "./git-sync/it-skill-git-sync.service";
import type { ITSkillFile } from "./itSkillFiles";
import type { GitAuthor } from "./gitCommitHelpers";

/**
 * Save an IT skill to the it/ directory and commit to git
 */
export async function saveITSkillAndCommit(
  slug: string,
  skill: ITSkillFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return itSkillGitSync.saveAndCommit(slug, skill, commitMessage, author);
}

/**
 * Update an IT skill file and commit the changes
 */
export async function updateITSkillAndCommit(
  oldSlug: string,
  skill: ITSkillFile,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return itSkillGitSync.updateAndCommit(oldSlug, skill, commitMessage, author);
}

/**
 * Delete an IT skill file and commit the deletion
 */
export async function deleteITSkillAndCommit(
  slug: string,
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  return itSkillGitSync.deleteAndCommit(slug, commitMessage, author);
}

/**
 * Get git log for an IT skill file
 */
export async function getITSkillHistory(
  slug: string,
  limit = 10
): Promise<
  Array<{
    sha: string;
    author: string;
    email: string;
    date: string;
    message: string;
  }>
> {
  return itSkillGitSync.getHistory(slug, limit);
}

/**
 * Get diff between two commits for an IT skill file
 */
export async function getITSkillDiff(
  slug: string,
  fromCommit: string,
  toCommit = "HEAD"
): Promise<string> {
  return itSkillGitSync.getDiff(slug, fromCommit, toCommit);
}

// Re-export the service for direct use
export { itSkillGitSync };
