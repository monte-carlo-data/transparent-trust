/**
 * Skill Git Sync Service
 *
 * Concrete implementation of BaseGitSyncService for skills.
 * Replaces the old skillGitSync.ts with a class-based approach.
 */

import { BaseGitSyncService } from "./base-git-sync.service";
import {
  writeSkillFile,
  getSkillSlug,
  renameSkillFile,
  deleteSkillFile,
  type SkillFile,
} from "../skillFiles";
import { serializeFrontmatter } from "../frontmatterStore";
import { deriveName, deriveDescription } from "../v2/skills/scope-validator";

/**
 * Git sync service for skills
 */
class SkillGitSyncService extends BaseGitSyncService<SkillFile> {
  protected getDirectory(): string {
    return "skills";
  }

  protected getFileExtension(): string {
    return "md";
  }

  protected generateSlug(skill: SkillFile): string {
    return getSkillSlug(skill.title);
  }

  protected serializeEntity(skill: SkillFile): string {
    // Derive Anthropic-compatible fields
    const name = deriveName(skill.slug);
    const description = deriveDescription(skill.summary, undefined); // Scope not needed for derivation here

    const frontmatter = {
      // Anthropic-compatible fields
      name,
      description,

      // Internal fields
      id: skill.id,
      title: skill.title,
      categories: skill.categories,
      created: skill.created,
      updated: new Date().toISOString(),
      owners: skill.owners,
      sources: skill.sources,
      active: skill.active,

      // Optional
      ...(skill.summary && { summary: skill.summary }),
    };
    return serializeFrontmatter(skill.content, frontmatter);
  }

  protected async writeFile(slug: string, skill: SkillFile): Promise<void> {
    await writeSkillFile(slug, skill);
  }

  protected async deleteFile(slug: string): Promise<void> {
    await deleteSkillFile(slug);
  }

  protected async renameFile(oldSlug: string, newSlug: string): Promise<void> {
    await renameSkillFile(oldSlug, newSlug);
  }
}

// Export singleton instance
export const skillGitSync = new SkillGitSyncService();

// Re-export types for backwards compatibility
export type { SkillFile } from "../skillFiles";
export type { GitAuthor } from "../gitCommitHelpers";
