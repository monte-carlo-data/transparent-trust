/**
 * Git Provider Factory
 *
 * Automatically selects the appropriate git provider based on environment:
 * - LocalGitProvider for local development (shell git commands)
 * - GitHubApiProvider for AWS deployment (GitHub REST API)
 * - NoOpProvider when git sync is disabled
 *
 * Git sync is DISABLED by default in local development.
 * Set GIT_SYNC_ENABLED=true to enable it locally for testing.
 * On AWS, git sync is enabled by default when GitHub config is present.
 */

import type { GitProvider, GitCommitResult } from "./git-provider.interface";
import { getLocalGitProvider } from "./local-git.provider";
import { createGitHubApiProviderFromEnv } from "./github-api.provider";
import { logger } from "../logger";

export type { GitProvider, GitAuthor, GitCommitInfo, GitCommitResult, FileChange } from "./git-provider.interface";
export { LocalGitProvider, getLocalGitProvider } from "./local-git.provider";
export { GitHubApiProvider, createGitHubApiProviderFromEnv } from "./github-api.provider";
export { GitHubApiClient, GitHubApiError } from "./github-api.client";

/**
 * Error thrown when git sync is disabled but an operation is attempted
 */
export class GitSyncDisabledError extends Error {
  constructor() {
    super("Git sync is disabled. Set GIT_SYNC_ENABLED=true or configure GitHub credentials on AWS.");
    this.name = "GitSyncDisabledError";
  }
}

/**
 * NoOp Git Provider - throws error when operations are attempted
 * This ensures the UI doesn't falsely show success when sync is disabled
 */
class NoOpGitProvider implements GitProvider {
  readonly providerType = "noop" as const;

  async createOrUpdateFile(): Promise<GitCommitResult> {
    throw new GitSyncDisabledError();
  }

  async deleteFile(): Promise<GitCommitResult> {
    throw new GitSyncDisabledError();
  }

  async commitFiles(): Promise<GitCommitResult> {
    throw new GitSyncDisabledError();
  }

  async getFileContent(): Promise<string | null> {
    return null;
  }

  async getFileHistory(): Promise<[]> {
    return [];
  }

  async getFileDiff(): Promise<string> {
    return "";
  }

  async isClean(): Promise<boolean> {
    return true;
  }

  async isPathClean(): Promise<boolean> {
    return true;
  }

  async getCurrentBranch(): Promise<string> {
    return "main";
  }

  async pushToRemote(): Promise<void> {
    // No-op
  }
}

let noOpProvider: NoOpGitProvider | null = null;

function getNoOpProvider(): NoOpGitProvider {
  if (!noOpProvider) {
    noOpProvider = new NoOpGitProvider();
  }
  return noOpProvider;
}

/**
 * Detect if running in AWS environment
 */
function isAWSEnvironment(): boolean {
  // ECS sets this environment variable
  return !!process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    // ECS Fargate also sets these
    !!process.env.AWS_EXECUTION_ENV ||
    // Explicit flag
    process.env.DEPLOYMENT_ENVIRONMENT === "aws";
}

/**
 * Check if GitHub API config is available
 */
function hasGitHubConfig(): boolean {
  return !!(
    process.env.GITHUB_TOKEN &&
    process.env.GITHUB_REPO_OWNER &&
    process.env.GITHUB_REPO_NAME
  );
}

/**
 * Check if git sync is enabled
 * - Explicitly enabled: GIT_SYNC_ENABLED=true
 * - Explicitly disabled: GIT_SYNC_ENABLED=false
 * - Default: enabled on AWS (production), disabled locally (development)
 */
function isGitSyncEnabled(): boolean {
  const explicit = process.env.GIT_SYNC_ENABLED;
  if (explicit === "true") return true;
  if (explicit === "false") return false;

  // Default: only enabled in AWS environment with GitHub config
  return isAWSEnvironment() && hasGitHubConfig();
}

/**
 * Determine which provider to use
 */
function determineProvider(): "local" | "github-api" | "noop" {
  // 0. Check if git sync is disabled
  if (!isGitSyncEnabled()) {
    logger.info("Git sync disabled (set GIT_SYNC_ENABLED=true to enable)");
    return "noop";
  }

  // 1. Explicit override
  const explicit = process.env.GIT_PROVIDER;
  if (explicit === "github-api" || explicit === "local") {
    logger.info(`Git provider explicitly set to: ${explicit}`);
    return explicit;
  }

  // 2. Auto-detect based on environment
  const isAWS = isAWSEnvironment();
  const hasGitHub = hasGitHubConfig();

  if (isAWS && hasGitHub) {
    logger.info("Auto-detected AWS environment with GitHub config, using github-api provider");
    return "github-api";
  }

  if (isAWS && !hasGitHub) {
    logger.warn("AWS environment detected but no GitHub config available. Git sync will fail.");
    // Still return local, but it will fail - better to have clear errors
    return "local";
  }

  // 3. Default: local
  logger.info("Using local git provider (development mode)");
  return "local";
}

// Singleton provider instance
let cachedProvider: GitProvider | null = null;
let cachedProviderType: "local" | "github-api" | "noop" | null = null;

/**
 * Get the git provider instance
 * Uses singleton pattern - provider is created once and reused
 */
export function getGitProvider(): GitProvider {
  const targetType = determineProvider();

  // Return cached if same type
  if (cachedProvider && cachedProviderType === targetType) {
    return cachedProvider;
  }

  // Create new provider
  if (targetType === "noop") {
    cachedProvider = getNoOpProvider();
    cachedProviderType = "noop";
  } else if (targetType === "github-api") {
    try {
      cachedProvider = createGitHubApiProviderFromEnv();
      cachedProviderType = "github-api";
    } catch (error) {
      logger.error("Failed to create GitHub API provider, falling back to noop", error);
      cachedProvider = getNoOpProvider();
      cachedProviderType = "noop";
    }
  } else {
    cachedProvider = getLocalGitProvider();
    cachedProviderType = "local";
  }

  return cachedProvider;
}

/**
 * Reset the cached provider (useful for testing)
 */
export function resetGitProvider(): void {
  cachedProvider = null;
  cachedProviderType = null;
}

/**
 * Get current provider type without creating instance
 */
export function getGitProviderType(): "local" | "github-api" | "noop" {
  return determineProvider();
}

/**
 * Check if git sync is currently enabled
 */
export function isGitSyncActive(): boolean {
  return isGitSyncEnabled();
}
