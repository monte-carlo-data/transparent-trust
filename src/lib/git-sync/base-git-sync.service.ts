/**
 * Base Git Sync Service
 *
 * Abstract base class for git-synced entities (Skills, Customers, Prompts, Templates).
 * Provides common git operations (save, update, delete, history) with entity-specific
 * customization through abstract methods.
 *
 * Supports two modes:
 * - Local: Uses shell git commands (development)
 * - GitHub API: Uses GitHub REST API (AWS deployment)
 *
 * The provider is automatically selected based on environment.
 */

import {
  getGitProvider,
  type GitProvider,
  type GitAuthor,
  type GitCommitInfo,
} from "../git-providers";
import { logger } from "../logger";

// Re-export types for backwards compatibility
export type { GitAuthor, GitCommitInfo };

/**
 * Abstract base class for git-synced entities
 * @template T - The entity file type (e.g., SkillFile, CustomerFile)
 */
export abstract class BaseGitSyncService<T> {
  private _provider: GitProvider | null = null;

  /**
   * Get the git provider (lazy initialization)
   */
  protected get provider(): GitProvider {
    if (!this._provider) {
      this._provider = getGitProvider();
      logger.info(`Git sync using ${this._provider.providerType} provider`, {
        service: this.constructor.name,
      });
    }
    return this._provider;
  }

  /**
   * Get the directory name for this entity type
   * @example "skills", "customers", "prompts", "templates"
   */
  protected abstract getDirectory(): string;

  /**
   * Get the file extension for this entity type
   * @example "md", "json"
   */
  protected abstract getFileExtension(): string;

  /**
   * Generate a slug (filename without extension) from the entity
   * @param entity - The entity data
   * @returns Slug string (e.g., "customer-onboarding-process")
   */
  protected abstract generateSlug(entity: T): string;

  /**
   * Serialize the entity to file content (markdown with frontmatter, JSON, etc.)
   * This is used by the GitHub API provider to get the file content.
   * @param entity - The entity data
   * @returns Serialized file content as string
   */
  protected abstract serializeEntity(entity: T): string;

  /**
   * Write the entity to a file (filesystem only - used by local provider)
   * @param slug - The filename slug
   * @param entity - The entity data
   */
  protected abstract writeFile(slug: string, entity: T): Promise<void>;

  /**
   * Delete the entity file (filesystem only - used by local provider)
   * @param slug - The filename slug
   */
  protected abstract deleteFile(slug: string): Promise<void>;

  /**
   * Rename the entity file (filesystem only - used by local provider)
   * @param oldSlug - Current filename slug
   * @param newSlug - New filename slug
   */
  protected abstract renameFile(oldSlug: string, newSlug: string): Promise<void>;

  /**
   * Get the full file path for an entity
   * @param slug - The filename slug
   * @returns Full relative path (e.g., "skills/onboarding.md")
   */
  protected getFilePath(slug: string): string {
    return `${this.getDirectory()}/${slug}.${this.getFileExtension()}`;
  }

  /**
   * Save an entity to file and commit to git
   * @param slug - The filename slug
   * @param entity - The entity data
   * @param commitMessage - Git commit message
   * @param author - Git author info
   * @returns Git commit SHA if a commit was created, null if no changes
   */
  async saveAndCommit(
    slug: string,
    entity: T,
    commitMessage: string,
    author: GitAuthor
  ): Promise<string | null> {
    const filepath = this.getFilePath(slug);

    if (this.provider.providerType === "github-api") {
      // GitHub API: serialize and send directly
      const content = this.serializeEntity(entity);
      const result = await this.provider.createOrUpdateFile(
        filepath,
        content,
        commitMessage,
        author
      );
      return result.sha;
    } else {
      // Local: write to filesystem, then use git commands
      await this.writeFile(slug, entity);
      const result = await this.provider.createOrUpdateFile(
        filepath,
        "", // Content already written to filesystem
        commitMessage,
        author
      );
      return result.sha;
    }
  }

  /**
   * Update an entity file and commit the changes
   * Handles slug changes (renames) automatically
   * @param oldSlug - Current filename slug (may be different if name/title changed)
   * @param entity - Updated entity data
   * @param commitMessage - Git commit message
   * @param author - Git author info
   * @returns Git commit SHA if a commit was created, null if no changes
   */
  async updateAndCommit(
    oldSlug: string,
    entity: T,
    commitMessage: string,
    author: GitAuthor
  ): Promise<string | null> {
    const newSlug = this.generateSlug(entity);
    const oldPath = this.getFilePath(oldSlug);
    const newPath = this.getFilePath(newSlug);

    if (this.provider.providerType === "github-api") {
      // GitHub API: handle rename with batch commit
      const content = this.serializeEntity(entity);

      if (oldSlug !== newSlug) {
        // Rename: delete old file and create new in single commit
        const result = await this.provider.commitFiles(
          [
            { path: oldPath, content: null }, // Delete old
            { path: newPath, content }, // Create new
          ],
          commitMessage,
          author
        );
        return result.sha;
      } else {
        // No rename: just update
        const result = await this.provider.createOrUpdateFile(
          newPath,
          content,
          commitMessage,
          author
        );
        return result.sha;
      }
    } else {
      // Local: use filesystem operations
      if (oldSlug !== newSlug) {
        await this.renameFile(oldSlug, newSlug);
      }
      await this.writeFile(newSlug, entity);

      // Commit using local provider
      if (oldSlug !== newSlug) {
        const result = await this.provider.commitFiles(
          [
            { path: oldPath, content: null },
            { path: newPath, content: "" }, // Content already on filesystem
          ],
          commitMessage,
          author
        );
        return result.sha;
      } else {
        const result = await this.provider.createOrUpdateFile(
          newPath,
          "",
          commitMessage,
          author
        );
        return result.sha;
      }
    }
  }

  /**
   * Delete an entity file and commit the deletion
   * @param slug - The filename slug to delete
   * @param commitMessage - Git commit message
   * @param author - Git author info
   * @returns Git commit SHA if a commit was created, null if no changes
   */
  async deleteAndCommit(
    slug: string,
    commitMessage: string,
    author: GitAuthor
  ): Promise<string | null> {
    const filepath = this.getFilePath(slug);

    if (this.provider.providerType === "github-api") {
      // GitHub API: delete via API
      const result = await this.provider.deleteFile(
        filepath,
        commitMessage,
        author
      );
      return result.sha;
    } else {
      // Local: delete from filesystem, then git remove
      await this.deleteFile(slug);
      const result = await this.provider.deleteFile(
        filepath,
        commitMessage,
        author
      );
      return result.sha;
    }
  }

  /**
   * Get git log for an entity file
   * @param slug - The filename slug
   * @param limit - Maximum number of commits to return
   * @returns Array of commit info
   */
  async getHistory(slug: string, limit = 10): Promise<GitCommitInfo[]> {
    const filepath = this.getFilePath(slug);
    return this.provider.getFileHistory(filepath, limit);
  }

  /**
   * Get diff between two commits for an entity file
   * @param slug - The filename slug
   * @param fromCommit - Starting commit SHA (or 'HEAD~1' for previous)
   * @param toCommit - Ending commit SHA (default: 'HEAD')
   * @returns Diff output
   */
  async getDiff(
    slug: string,
    fromCommit: string,
    toCommit = "HEAD"
  ): Promise<string> {
    const filepath = this.getFilePath(slug);
    return this.provider.getFileDiff(filepath, fromCommit, toCommit);
  }

  /**
   * Check if git working directory is clean
   * @returns True if no uncommitted changes
   */
  async isClean(): Promise<boolean> {
    return this.provider.isClean();
  }

  /**
   * Get current git branch name
   * @returns Branch name
   */
  async getCurrentBranch(): Promise<string> {
    return this.provider.getCurrentBranch();
  }

  /**
   * Push commits to remote
   * @param remote - Remote name (default: 'origin')
   * @param branch - Branch name (default: current branch)
   */
  async pushToRemote(remote = "origin", branch?: string): Promise<void> {
    await this.provider.pushToRemote(remote, branch);
  }
}
