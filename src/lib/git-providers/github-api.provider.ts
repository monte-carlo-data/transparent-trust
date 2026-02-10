/**
 * GitHub API Provider
 *
 * Implements GitProvider interface using GitHub REST API.
 * Used when running on AWS ECS/Fargate where local git is not available.
 */

import {
  GitHubApiClient,
  GitHubConfig,
  GitHubApiError,
} from "./github-api.client";
import type {
  GitProvider,
  GitAuthor,
  GitCommitInfo,
  GitCommitResult,
  FileChange,
} from "./git-provider.interface";
import { logger } from "../logger";

export class GitHubApiProvider implements GitProvider {
  readonly providerType = "github-api" as const;
  private client: GitHubApiClient;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.client = new GitHubApiClient(config);
    logger.info("GitHubApiProvider initialized", {
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
    });
  }

  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    author: GitAuthor
  ): Promise<GitCommitResult> {
    try {
      const result = await this.client.createOrUpdateFile(path, content, message, {
        name: author.name,
        email: author.email,
      });

      logger.info("File created/updated via GitHub API", {
        path,
        commitSha: result.commitSha,
      });

      return {
        sha: result.commitSha,
        branch: this.config.branch,
      };
    } catch (error) {
      logger.error("Failed to create/update file via GitHub API", error, {
        path,
      });
      throw error;
    }
  }

  async deleteFile(
    path: string,
    message: string,
    author: GitAuthor
  ): Promise<GitCommitResult> {
    try {
      const result = await this.client.deleteFile(path, message, {
        name: author.name,
        email: author.email,
      });

      logger.info("File deleted via GitHub API", {
        path,
        commitSha: result.commitSha,
      });

      return {
        sha: result.commitSha,
        branch: this.config.branch,
      };
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        logger.warn("File not found for deletion", { path });
        return { sha: null, branch: this.config.branch };
      }
      logger.error("Failed to delete file via GitHub API", error, { path });
      throw error;
    }
  }

  async commitFiles(
    changes: FileChange[],
    message: string,
    author: GitAuthor
  ): Promise<GitCommitResult> {
    try {
      // Use Git Data API for batch commits
      const commitSha = await this.client.commitMultipleFiles(
        changes.map((c) => ({ path: c.path, content: c.content })),
        message,
        { name: author.name, email: author.email }
      );

      logger.info("Batch commit via GitHub API", {
        files: changes.length,
        commitSha,
      });

      return {
        sha: commitSha,
        branch: this.config.branch,
      };
    } catch (error) {
      logger.error("Failed to batch commit via GitHub API", error, {
        files: changes.map((c) => c.path),
      });
      throw error;
    }
  }

  async getFileContent(path: string): Promise<string | null> {
    try {
      const content = await this.client.getFileContent(path);
      return content?.content || null;
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getFileHistory(path: string, limit: number): Promise<GitCommitInfo[]> {
    try {
      const history = await this.client.getFileHistory(path, limit);
      return history.map((commit) => ({
        sha: commit.sha,
        author: commit.author.name,
        email: commit.author.email,
        date: commit.author.date,
        message: commit.message,
      }));
    } catch (error) {
      logger.error("Failed to get file history via GitHub API", error, {
        path,
      });
      return [];
    }
  }

  async getFileDiff(
    path: string,
    fromCommit: string,
    toCommit: string
  ): Promise<string> {
    try {
      return await this.client.getCommitDiff(fromCommit, toCommit, path);
    } catch (error) {
      logger.error("Failed to get file diff via GitHub API", error, {
        path,
        fromCommit,
        toCommit,
      });
      return "";
    }
  }

  async isClean(): Promise<boolean> {
    // GitHub API doesn't have uncommitted changes - always "clean"
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async isPathClean(_pathspec: string): Promise<boolean> {
    // GitHub API doesn't have uncommitted changes - always "clean"
    return true;
  }

  async getCurrentBranch(): Promise<string> {
    return this.client.getCurrentBranch();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async pushToRemote(_remote?: string, _branch?: string): Promise<void> {
    // No-op for GitHub API - commits are immediately pushed
    logger.debug("pushToRemote called on GitHub API provider (no-op)");
  }
}

/**
 * Create GitHubApiProvider from environment variables
 */
export function createGitHubApiProviderFromEnv(): GitHubApiProvider {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const branch = process.env.GITHUB_BRANCH || "main";
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    throw new Error(
      "Missing required GitHub config. Set GITHUB_REPO_OWNER, GITHUB_REPO_NAME, and GITHUB_TOKEN environment variables."
    );
  }

  return new GitHubApiProvider({ owner, repo, branch, token });
}
