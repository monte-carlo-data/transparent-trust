/**
 * Git Provider Interface
 *
 * Defines the contract for git operations that can be implemented
 * by different providers (local shell git or GitHub API).
 */

export interface GitAuthor {
  name: string;
  email: string;
}

export interface GitCommitInfo {
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export interface GitCommitResult {
  sha: string | null;
  branch: string;
}

export interface FileChange {
  path: string;
  content: string | null; // null = delete
  encoding?: "utf-8" | "base64";
}

export interface GitProvider {
  /**
   * Provider type identifier
   */
  readonly providerType: "local" | "github-api" | "noop";

  /**
   * Create or update a single file and commit
   */
  createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    author: GitAuthor
  ): Promise<GitCommitResult>;

  /**
   * Delete a file and commit
   */
  deleteFile(
    path: string,
    message: string,
    author: GitAuthor
  ): Promise<GitCommitResult>;

  /**
   * Commit multiple file changes in a single commit
   * Useful for renames (delete old + create new)
   */
  commitFiles(
    changes: FileChange[],
    message: string,
    author: GitAuthor
  ): Promise<GitCommitResult>;

  /**
   * Get file content from the repository
   * Returns null if file doesn't exist
   */
  getFileContent(path: string): Promise<string | null>;

  /**
   * Get commit history for a file
   */
  getFileHistory(path: string, limit: number): Promise<GitCommitInfo[]>;

  /**
   * Get diff between two commits for a file
   */
  getFileDiff(
    path: string,
    fromCommit: string,
    toCommit: string
  ): Promise<string>;

  /**
   * Check if repository has no uncommitted changes
   */
  isClean(): Promise<boolean>;

  /**
   * Check if specific path has no uncommitted changes
   */
  isPathClean(pathspec: string): Promise<boolean>;

  /**
   * Get current branch name
   */
  getCurrentBranch(): Promise<string>;

  /**
   * Push commits to remote (no-op for GitHub API provider)
   */
  pushToRemote(remote?: string, branch?: string): Promise<void>;
}
