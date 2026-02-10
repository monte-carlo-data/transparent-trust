/**
 * GitHub API Client
 *
 * Low-level client for GitHub REST API operations.
 * Uses the Contents API for single file operations and
 * Git Data API for batch commits.
 */

import { logger } from "../logger";

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export interface GitHubFileContent {
  path: string;
  content: string;
  sha: string;
  encoding: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
}

export interface GitHubTreeEntry {
  path: string;
  mode: "100644" | "100755" | "040000" | "160000" | "120000";
  type: "blob" | "tree" | "commit";
  sha?: string | null; // null to delete
  content?: string; // For inline content
}

export interface GitHubAuthor {
  name: string;
  email: string;
  date?: string;
}

/**
 * GitHub API Client for git operations
 */
export class GitHubApiClient {
  private readonly baseUrl = "https://api.github.com";
  private readonly config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  private get headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  private get repoPath(): string {
    return `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}`;
  }

  /**
   * Make an API request with error handling
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.repoPath}${path}`;

    const response = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("GitHub API error", new Error(errorBody), {
        status: response.status,
        url,
        method,
      });

      if (response.status === 404) {
        throw new GitHubApiError("Resource not found", 404);
      }
      if (response.status === 409) {
        throw new GitHubApiError("Conflict - file may have been modified", 409);
      }
      if (response.status === 422) {
        throw new GitHubApiError(`Validation failed: ${errorBody}`, 422);
      }

      throw new GitHubApiError(
        `GitHub API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // ==================== Contents API ====================

  /**
   * Get file content from repository
   * Returns null if file doesn't exist
   */
  async getFileContent(path: string): Promise<GitHubFileContent | null> {
    try {
      const response = await this.request<{
        path: string;
        content: string;
        sha: string;
        encoding: string;
      }>("GET", `/contents/${path}?ref=${this.config.branch}`);

      return {
        path: response.path,
        content: Buffer.from(response.content, "base64").toString("utf-8"),
        sha: response.sha,
        encoding: response.encoding,
      };
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update a file using Contents API
   */
  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    author: GitHubAuthor
  ): Promise<{ sha: string; commitSha: string }> {
    // First, try to get the current file to get its SHA
    const existingFile = await this.getFileContent(path);

    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content).toString("base64"),
      branch: this.config.branch,
      committer: {
        name: author.name,
        email: author.email,
      },
      author: {
        name: author.name,
        email: author.email,
      },
    };

    // Include SHA if updating existing file
    if (existingFile) {
      body.sha = existingFile.sha;
    }

    const response = await this.request<{
      content: { sha: string };
      commit: { sha: string };
    }>("PUT", `/contents/${path}`, body);

    return {
      sha: response.content.sha,
      commitSha: response.commit.sha,
    };
  }

  /**
   * Delete a file using Contents API
   */
  async deleteFile(
    path: string,
    message: string,
    author: GitHubAuthor
  ): Promise<{ commitSha: string }> {
    // Get current file SHA
    const existingFile = await this.getFileContent(path);
    if (!existingFile) {
      throw new GitHubApiError(`File not found: ${path}`, 404);
    }

    const response = await this.request<{
      commit: { sha: string };
    }>("DELETE", `/contents/${path}`, {
      message,
      sha: existingFile.sha,
      branch: this.config.branch,
      committer: {
        name: author.name,
        email: author.email,
      },
      author: {
        name: author.name,
        email: author.email,
      },
    });

    return { commitSha: response.commit.sha };
  }

  // ==================== Git Data API (for batch commits) ====================

  /**
   * Get the SHA of the latest commit on a branch
   */
  async getBranchHeadSha(): Promise<string> {
    const response = await this.request<{
      object: { sha: string };
    }>("GET", `/git/refs/heads/${this.config.branch}`);

    return response.object.sha;
  }

  /**
   * Get commit details including tree SHA
   */
  async getCommit(sha: string): Promise<{ treeSha: string; message: string }> {
    const response = await this.request<{
      tree: { sha: string };
      message: string;
    }>("GET", `/git/commits/${sha}`);

    return {
      treeSha: response.tree.sha,
      message: response.message,
    };
  }

  /**
   * Create a new tree with file changes
   */
  async createTree(
    baseTreeSha: string,
    entries: GitHubTreeEntry[]
  ): Promise<string> {
    const response = await this.request<{ sha: string }>(
      "POST",
      "/git/trees",
      {
        base_tree: baseTreeSha,
        tree: entries.map((entry) => ({
          path: entry.path,
          mode: entry.mode,
          type: entry.type,
          ...(entry.sha !== undefined ? { sha: entry.sha } : {}),
          ...(entry.content !== undefined ? { content: entry.content } : {}),
        })),
      }
    );

    return response.sha;
  }

  /**
   * Create a new commit
   */
  async createCommit(
    message: string,
    treeSha: string,
    parentSha: string,
    author: GitHubAuthor
  ): Promise<string> {
    const response = await this.request<{ sha: string }>(
      "POST",
      "/git/commits",
      {
        message,
        tree: treeSha,
        parents: [parentSha],
        author: {
          name: author.name,
          email: author.email,
          date: author.date || new Date().toISOString(),
        },
        committer: {
          name: author.name,
          email: author.email,
          date: author.date || new Date().toISOString(),
        },
      }
    );

    return response.sha;
  }

  /**
   * Update branch to point to a new commit
   */
  async updateBranchRef(sha: string): Promise<void> {
    await this.request("PATCH", `/git/refs/heads/${this.config.branch}`, {
      sha,
      force: false,
    });
  }

  /**
   * Commit multiple file changes in a single commit using Git Data API
   */
  async commitMultipleFiles(
    changes: Array<{ path: string; content: string | null }>,
    message: string,
    author: GitHubAuthor
  ): Promise<string> {
    // 1. Get current branch HEAD
    const headSha = await this.getBranchHeadSha();

    // 2. Get current tree
    const commit = await this.getCommit(headSha);

    // 3. Build tree entries
    const treeEntries: GitHubTreeEntry[] = changes.map((change) => {
      if (change.content === null) {
        // Delete: set sha to null
        return {
          path: change.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: null,
        };
      }
      // Create/update: use inline content
      return {
        path: change.path,
        mode: "100644" as const,
        type: "blob" as const,
        content: change.content,
      };
    });

    // 4. Create new tree
    const newTreeSha = await this.createTree(commit.treeSha, treeEntries);

    // 5. Create commit
    const newCommitSha = await this.createCommit(
      message,
      newTreeSha,
      headSha,
      author
    );

    // 6. Update branch ref
    await this.updateBranchRef(newCommitSha);

    return newCommitSha;
  }

  // ==================== Commits API ====================

  /**
   * Get commit history for a file
   */
  async getFileHistory(
    path: string,
    limit: number = 10
  ): Promise<GitHubCommit[]> {
    const response = await this.request<
      Array<{
        sha: string;
        commit: {
          message: string;
          author: {
            name: string;
            email: string;
            date: string;
          };
        };
      }>
    >(
      "GET",
      `/commits?path=${encodeURIComponent(path)}&sha=${this.config.branch}&per_page=${limit}`
    );

    return response.map((item) => ({
      sha: item.sha,
      message: item.commit.message,
      author: {
        name: item.commit.author.name,
        email: item.commit.author.email,
        date: item.commit.author.date,
      },
    }));
  }

  // ==================== Compare API ====================

  /**
   * Get diff between two commits
   */
  async getCommitDiff(
    baseSha: string,
    headSha: string,
    path?: string
  ): Promise<string> {
    const response = await this.request<{
      files: Array<{
        filename: string;
        patch?: string;
      }>;
    }>("GET", `/compare/${baseSha}...${headSha}`);

    if (path) {
      const file = response.files.find((f) => f.filename === path);
      return file?.patch || "";
    }

    return response.files.map((f) => f.patch || "").join("\n\n");
  }

  /**
   * Get current branch name (just returns configured branch)
   */
  getCurrentBranch(): string {
    return this.config.branch;
  }
}

/**
 * Custom error class for GitHub API errors
 */
export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}
