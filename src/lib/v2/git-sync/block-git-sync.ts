/**
 * Unified Git Sync Service for BuildingBlocks
 *
 * Syncs all block types (knowledge, persona, template) to git.
 * Each library gets its own directory structure.
 */

import { prisma } from '@/lib/prisma';
import { getBlocksNeedingSync, markBlockSynced } from '../blocks/block-service';
import type { TypedBuildingBlock, LibraryId } from '@/types/v2';
import matter from 'gray-matter';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Base directory for git-synced blocks */
const GIT_BASE_DIR = 'knowledge';

/** Directory mapping for each library */
const LIBRARY_DIRS: Record<LibraryId, string> = {
  'knowledge': 'knowledge',
  'it': 'it',
  'gtm': 'gtm',
  'talent': 'talent',
  'customers': 'customers',
  'prompts': 'prompts',
  'personas': 'personas',
  'templates': 'templates',
  'views': 'views',
};

// =============================================================================
// FILE PATH HELPERS
// =============================================================================

/**
 * Get the git path for a block.
 */
export function getBlockGitPath(block: TypedBuildingBlock): string {
  const dir = LIBRARY_DIRS[block.libraryId];
  const slug = block.slug || block.id;
  return `${GIT_BASE_DIR}/${dir}/${slug}.md`;
}

/**
 * Parse library and slug from a git path.
 */
export function parseGitPath(gitPath: string): { libraryId: LibraryId; slug: string } | null {
  const match = gitPath.match(/^knowledge\/([^/]+)\/([^/]+)\.md$/);
  if (!match) return null;

  const [, dir, slug] = match;
  const libraryId = Object.entries(LIBRARY_DIRS).find(([, d]) => d === dir)?.[0] as LibraryId;

  if (!libraryId) return null;
  return { libraryId, slug };
}

// =============================================================================
// SERIALIZATION
// =============================================================================

/**
 * Serialize a block to markdown with frontmatter.
 */
export function serializeBlock(block: TypedBuildingBlock): string {
  const frontmatter: Record<string, unknown> = {
    id: block.id,
    title: block.title,
    blockType: block.blockType,
    libraryId: block.libraryId,
    status: block.status,
    version: block.version,
    categories: block.categories,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  };

  // Add optional fields
  if (block.entryType) frontmatter.entryType = block.entryType;
  if (block.summary) frontmatter.summary = block.summary;
  if (block.teamId) frontmatter.teamId = block.teamId;
  if (block.ownerId) frontmatter.ownerId = block.ownerId;

  // Add attributes (type-specific fields)
  if (block.attributes && Object.keys(block.attributes).length > 0) {
    frontmatter.attributes = block.attributes;
  }

  return matter.stringify(block.content, frontmatter);
}

/**
 * Parse a markdown file into block data.
 */
export function parseBlockFile(content: string): {
  frontmatter: Record<string, unknown>;
  content: string;
} {
  const { data, content: body } = matter(content);
  return {
    frontmatter: data,
    content: body.trim(),
  };
}

// =============================================================================
// GIT OPERATIONS (File-based)
// =============================================================================

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

/** Get the repo root directory */
function getRepoRoot(): string {
  return process.env.GIT_REPO_PATH || process.cwd();
}

/**
 * Write a block to the git repository.
 */
export async function writeBlockToGit(block: TypedBuildingBlock): Promise<string> {
  const repoRoot = getRepoRoot();
  const gitPath = getBlockGitPath(block);
  const fullPath = path.join(repoRoot, gitPath);

  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  // Write file
  const content = serializeBlock(block);
  await fs.writeFile(fullPath, content, 'utf-8');

  return gitPath;
}

/**
 * Read a block from the git repository.
 */
export async function readBlockFromGit(gitPath: string): Promise<{
  frontmatter: Record<string, unknown>;
  content: string;
} | null> {
  const repoRoot = getRepoRoot();
  const fullPath = path.join(repoRoot, gitPath);

  try {
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    return parseBlockFile(fileContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Delete a block from the git repository.
 */
export async function deleteBlockFromGit(gitPath: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const fullPath = path.join(repoRoot, gitPath);

  try {
    await fs.unlink(fullPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Rename a block file in the git repository.
 */
export async function renameBlockInGit(
  oldPath: string,
  newPath: string
): Promise<void> {
  const repoRoot = getRepoRoot();
  const oldFullPath = path.join(repoRoot, oldPath);
  const newFullPath = path.join(repoRoot, newPath);

  // Ensure new directory exists
  await fs.mkdir(path.dirname(newFullPath), { recursive: true });

  // Rename file
  await fs.rename(oldFullPath, newFullPath);
}

// =============================================================================
// GIT COMMIT OPERATIONS
// =============================================================================

/**
 * Stage and commit a block change.
 */
export async function commitBlockChange(
  gitPath: string,
  message: string,
  author?: { name: string; email: string }
): Promise<string> {
  const repoRoot = getRepoRoot();

  // Stage the file
  execSync(`git add "${gitPath}"`, { cwd: repoRoot });

  // Build commit command
  let commitCmd = `git commit -m "${message.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  if (author) {
    commitCmd += ` --author="${author.name} <${author.email}>"`;
  }

  // Commit
  try {
    execSync(commitCmd, { cwd: repoRoot });
  } catch {
    // No changes to commit
    return '';
  }

  // Get commit SHA
  const sha = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
  return sha;
}

/**
 * Stage and commit multiple block changes.
 */
export async function commitBlockChanges(
  changes: Array<{ gitPath: string; action: 'add' | 'modify' | 'delete' }>,
  message: string,
  author?: { name: string; email: string }
): Promise<string> {
  const repoRoot = getRepoRoot();

  // Stage all files
  for (const change of changes) {
    if (change.action === 'delete') {
      execSync(`git rm "${change.gitPath}"`, { cwd: repoRoot });
    } else {
      execSync(`git add "${change.gitPath}"`, { cwd: repoRoot });
    }
  }

  // Build commit command
  let commitCmd = `git commit -m "${message.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  if (author) {
    commitCmd += ` --author="${author.name} <${author.email}>"`;
  }

  // Commit
  try {
    execSync(commitCmd, { cwd: repoRoot });
  } catch {
    // No changes to commit
    return '';
  }

  // Get commit SHA
  const sha = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
  return sha;
}

// =============================================================================
// SYNC OPERATIONS
// =============================================================================

/**
 * Sync a single block to git.
 */
export async function syncBlockToGit(
  blockId: string,
  options: {
    message?: string;
    author?: { name: string; email: string };
  } = {}
): Promise<{ gitPath: string; commitSha: string }> {
  // Get block
  const block = await prisma.buildingBlock.findUnique({
    where: { id: blockId },
  });

  if (!block) {
    throw new Error(`Block not found: ${blockId}`);
  }

  const typedBlock = block as unknown as TypedBuildingBlock;

  // Write to git
  const gitPath = await writeBlockToGit(typedBlock);

  // Commit
  const message = options.message || `Update ${block.libraryId}: ${block.title}`;
  const commitSha = await commitBlockChange(gitPath, message, options.author);

  // Update block with git info
  if (commitSha) {
    await markBlockSynced(blockId, commitSha);
  }

  return { gitPath, commitSha };
}

/**
 * Sync all blocks with LOCAL_CHANGES to git.
 */
export async function syncAllPendingBlocks(
  options: {
    author?: { name: string; email: string };
  } = {}
): Promise<{ synced: number; commitSha: string }> {
  const blocksToSync = await getBlocksNeedingSync();

  if (blocksToSync.length === 0) {
    return { synced: 0, commitSha: '' };
  }

  // Write all blocks
  const changes: Array<{ gitPath: string; action: 'add' | 'modify' | 'delete' }> = [];

  for (const block of blocksToSync) {
    const gitPath = await writeBlockToGit(block);
    changes.push({
      gitPath,
      action: block.gitPath ? 'modify' : 'add',
    });
  }

  // Commit all changes
  const message = blocksToSync.length === 1
    ? `Update ${blocksToSync[0].libraryId}: ${blocksToSync[0].title}`
    : `Sync ${blocksToSync.length} blocks`;

  const commitSha = await commitBlockChanges(changes, message, options.author);

  // Update blocks with git info
  if (commitSha) {
    for (const block of blocksToSync) {
      await markBlockSynced(block.id, commitSha);
    }
  }

  return { synced: blocksToSync.length, commitSha };
}

/**
 * Import blocks from git into the database.
 */
export async function importBlocksFromGit(
  libraryId: LibraryId
): Promise<{ imported: number; updated: number }> {
  const repoRoot = getRepoRoot();
  const dir = LIBRARY_DIRS[libraryId];
  const libraryPath = path.join(repoRoot, GIT_BASE_DIR, dir);

  let imported = 0;
  let updated = 0;

  try {
    const files = await fs.readdir(libraryPath);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const gitPath = `${GIT_BASE_DIR}/${dir}/${file}`;
      const fileContent = await fs.readFile(path.join(libraryPath, file), 'utf-8');
      const { frontmatter, content } = parseBlockFile(fileContent);

      // Check if block exists
      const existingBlock = frontmatter.id
        ? await prisma.buildingBlock.findUnique({
            where: { id: frontmatter.id as string },
          })
        : null;

      if (existingBlock) {
        // Update existing block
        await prisma.buildingBlock.update({
          where: { id: existingBlock.id },
          data: {
            title: frontmatter.title as string,
            content,
            categories: frontmatter.categories as string[] || [],
            attributes: frontmatter.attributes as object || {},
            status: frontmatter.status as string || 'ACTIVE',
            gitPath,
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
          },
        });
        updated++;
      } else {
        // Create new block
        const slug = file.replace('.md', '');
        await prisma.buildingBlock.create({
          data: {
            id: frontmatter.id as string || undefined,
            blockType: frontmatter.blockType as string || 'knowledge',
            libraryId,
            slug,
            title: frontmatter.title as string || slug,
            content,
            categories: frontmatter.categories as string[] || [],
            attributes: frontmatter.attributes as object || {},
            status: frontmatter.status as string || 'ACTIVE',
            entryType: frontmatter.entryType as string || undefined,
            teamId: frontmatter.teamId as string || undefined,
            ownerId: frontmatter.ownerId as string || undefined,
            gitPath,
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
          },
        });
        imported++;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // Directory doesn't exist yet
  }

  return { imported, updated };
}
