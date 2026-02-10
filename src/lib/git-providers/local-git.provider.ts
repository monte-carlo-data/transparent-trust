/**
 * Local Git Provider
 *
 * Implements GitProvider interface using local shell git commands.
 * Used for local development where git is available.
 */

import { promises as fs } from "fs";
import path from "path";
import type {
  GitProvider,
  GitAuthor,
  GitCommitInfo,
  GitCommitResult,
  FileChange,
} from "./git-provider.interface";
import {
  gitAdd,
  gitRemove,
  commitStagedChangesIfAny,
  getFileHistory as getGitFileHistory,
  getFileDiff as getGitFileDiff,
  isRepoClean,
  isPathClean as checkPathClean,
  getCurrentBranch as getGitCurrentBranch,
  pushToRemote as pushToGitRemote,
} from "../gitCommitHelpers";
import { logger } from "../logger";

export class LocalGitProvider implements GitProvider {
  readonly providerType = "local" as const;

  constructor() {
    logger.info("LocalGitProvider initialized");
  }

  async createOrUpdateFile(
    filePath: string,
    content: string,
    message: string,
    author: GitAuthor
  ): Promise<GitCommitResult> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, content, "utf-8");

      // Git add
      await gitAdd(filePath);

      // Commit
      const sha = await commitStagedChangesIfAny(message, author);

      logger.info("File created/updated via local git", { path: filePath, sha });

      return {
        sha,
        branch: await this.getCurrentBranch(),
      };
    } catch (error) {
      logger.error("Failed to create/update file via local git", error, {
        path: filePath,
      });
      throw error;
    }
  }

  async deleteFile(
    filePath: string,
    message: string,
    author: GitAuthor
  ): Promise<GitCommitResult> {
    try {
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        logger.warn("File not found for deletion", { path: filePath });
        return { sha: null, branch: await this.getCurrentBranch() };
      }

      // Delete file
      await fs.unlink(filePath);

      // Git remove
      await gitRemove(filePath);

      // Commit
      const sha = await commitStagedChangesIfAny(message, author);

      logger.info("File deleted via local git", { path: filePath, sha });

      return {
        sha,
        branch: await this.getCurrentBranch(),
      };
    } catch (error) {
      logger.error("Failed to delete file via local git", error, {
        path: filePath,
      });
      throw error;
    }
  }

  async commitFiles(
    changes: FileChange[],
    message: string,
    author: GitAuthor
  ): Promise<GitCommitResult> {
    try {
      // Process each change
      for (const change of changes) {
        if (change.content === null) {
          // Delete
          try {
            await fs.access(change.path);
            await fs.unlink(change.path);
            await gitRemove(change.path);
          } catch {
            // File doesn't exist, skip
          }
        } else {
          // Create/update
          const dir = path.dirname(change.path);
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(change.path, change.content, "utf-8");
          await gitAdd(change.path);
        }
      }

      // Commit all staged changes
      const sha = await commitStagedChangesIfAny(message, author);

      logger.info("Batch commit via local git", {
        files: changes.length,
        sha,
      });

      return {
        sha,
        branch: await this.getCurrentBranch(),
      };
    } catch (error) {
      logger.error("Failed to batch commit via local git", error, {
        files: changes.map((c) => c.path),
      });
      throw error;
    }
  }

  async getFileContent(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    } catch {
      return null;
    }
  }

  async getFileHistory(filePath: string, limit: number): Promise<GitCommitInfo[]> {
    try {
      return await getGitFileHistory(filePath, limit);
    } catch (error) {
      logger.error("Failed to get file history via local git", error, {
        path: filePath,
      });
      return [];
    }
  }

  async getFileDiff(
    filePath: string,
    fromCommit: string,
    toCommit: string
  ): Promise<string> {
    try {
      return await getGitFileDiff(filePath, fromCommit, toCommit);
    } catch (error) {
      logger.error("Failed to get file diff via local git", error, {
        path: filePath,
      });
      return "";
    }
  }

  async isClean(): Promise<boolean> {
    return isRepoClean();
  }

  async isPathClean(pathspec: string): Promise<boolean> {
    return checkPathClean(pathspec);
  }

  async getCurrentBranch(): Promise<string> {
    return getGitCurrentBranch();
  }

  async pushToRemote(remote?: string, branch?: string): Promise<void> {
    await pushToGitRemote(remote, branch);
  }
}

/**
 * Create LocalGitProvider singleton
 */
let localProviderInstance: LocalGitProvider | null = null;

export function getLocalGitProvider(): LocalGitProvider {
  if (!localProviderInstance) {
    localProviderInstance = new LocalGitProvider();
  }
  return localProviderInstance;
}
