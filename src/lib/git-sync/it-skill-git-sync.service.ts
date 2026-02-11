/**
 * IT Skill Git Sync Service
 *
 * Concrete implementation of BaseGitSyncService for IT skills.
 * Follows the same pattern as skill-git-sync.service.ts.
 */

import { BaseGitSyncService } from "./base-git-sync.service";
import {
  writeITSkillFile,
  getITSkillSlug,
  renameITSkillFile,
  deleteITSkillFile,
  type ITSkillFile,
} from "../itSkillFiles";
import { serializeFrontmatter } from "../frontmatterStore";

/**
 * Git sync service for IT skills
 */
class ITSkillGitSyncService extends BaseGitSyncService<ITSkillFile> {
  protected getDirectory(): string {
    return "it";
  }

  protected getFileExtension(): string {
    return "md";
  }

  protected generateSlug(skill: ITSkillFile): string {
    return getITSkillSlug(skill.title);
  }

  protected serializeEntity(skill: ITSkillFile): string {
    const frontmatter: Record<string, unknown> = {
      // Agent Skills fields (at top for visibility)
      name: skill.name || skill.slug,
      description: skill.description || "",

      // Internal fields
      id: skill.id,
      title: skill.title,
      categories: skill.categories,
      created: skill.created,
      updated: new Date().toISOString(),
      owners: skill.owners,
      sources: skill.sources,
      active: skill.active,

      // Zendesk-specific fields (only include if present)
      ...(skill.zendeskTags && { zendeskTags: skill.zendeskTags }),
      ...(skill.lastTicketSync && { lastTicketSync: skill.lastTicketSync }),
      ...(skill.incorporatedTickets && { incorporatedTickets: skill.incorporatedTickets }),
    };
    return serializeFrontmatter(skill.content, frontmatter);
  }

  protected async writeFile(slug: string, skill: ITSkillFile): Promise<void> {
    await writeITSkillFile(slug, skill);
  }

  protected async deleteFile(slug: string): Promise<void> {
    await deleteITSkillFile(slug);
  }

  protected async renameFile(oldSlug: string, newSlug: string): Promise<void> {
    await renameITSkillFile(oldSlug, newSlug);
  }
}

// Export singleton instance
export const itSkillGitSync = new ITSkillGitSyncService();

// Re-export types for convenience
export type { ITSkillFile } from "../itSkillFiles";
export type { GitAuthor } from "../gitCommitHelpers";
