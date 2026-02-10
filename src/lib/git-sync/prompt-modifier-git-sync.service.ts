/**
 * Prompt Modifier Git Sync Service
 *
 * Concrete implementation of BaseGitSyncService for prompt modifiers.
 */

import { BaseGitSyncService } from "./base-git-sync.service";
import {
  writeModifierFile,
  deleteModifierFile,
  type PromptModifierFile,
} from "../promptFiles";
import { serializeFrontmatter } from "../frontmatterStore";

/**
 * Git sync service for prompt modifiers
 */
class PromptModifierGitSyncService extends BaseGitSyncService<PromptModifierFile> {
  protected getDirectory(): string {
    return "prompts/modifiers";
  }

  protected getFileExtension(): string {
    return "md";
  }

  protected generateSlug(modifier: PromptModifierFile): string {
    // Modifiers use their ID as the slug
    return modifier.id;
  }

  protected serializeEntity(modifier: PromptModifierFile): string {
    const frontmatter = {
      id: modifier.id,
      name: modifier.name,
      type: modifier.type,
      tier: modifier.tier,
      created: modifier.created,
      updated: new Date().toISOString(),
      updatedBy: modifier.updatedBy,
    };
    return serializeFrontmatter(modifier.content, frontmatter);
  }

  protected async writeFile(modifierId: string, modifier: PromptModifierFile): Promise<void> {
    await writeModifierFile(modifierId, modifier);
  }

  protected async deleteFile(modifierId: string): Promise<void> {
    await deleteModifierFile(modifierId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async renameFile(_oldId: string, _newId: string): Promise<void> {
    // Modifiers don't typically rename - ID is stable
    throw new Error("Modifier renaming not supported - IDs should be stable");
  }
}

// Export singleton instance
export const promptModifierGitSync = new PromptModifierGitSyncService();

// Re-export types for backwards compatibility
export type { PromptModifierFile } from "../promptFiles";
export type { GitAuthor } from "../gitCommitHelpers";
