import path from "path";
import {
  readFrontmatterFile,
  writeFrontmatterFile,
  listMarkdownFiles,
  fileExists,
  ensureDir,
  deleteFile,
} from "./frontmatterStore";

/**
 * Prompt Block file format
 * Stored as markdown files with YAML frontmatter in prompts/blocks/ directory
 *
 * Blocks have variants for different contexts, separated by ---variant:{context}--- markers
 */
export interface PromptBlockFile {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3;
  variants: Record<string, string> & { default: string };
  created: string; // ISO 8601 timestamp
  updated: string; // ISO 8601 timestamp
  updatedBy?: string;
}

/**
 * Prompt Modifier file format
 * Stored as markdown files with YAML frontmatter in prompts/modifiers/ directory
 */
export interface PromptModifierFile {
  id: string;
  name: string;
  type: "mode" | "domain";
  tier: 1 | 2 | 3;
  content: string;
  created: string; // ISO 8601 timestamp
  updated: string; // ISO 8601 timestamp
  updatedBy?: string;
}

// Paths to prompts directories (relative to project root)
const PROMPTS_DIR = path.join(process.cwd(), "prompts");
const BLOCKS_DIR = path.join(PROMPTS_DIR, "blocks");
const MODIFIERS_DIR = path.join(PROMPTS_DIR, "modifiers");

/**
 * Parse variants from content using ---variant:{context}--- markers
 * The content before the first marker is the "default" variant
 */
function parseVariants(content: string): Record<string, string> & { default: string } {
  const variants: Record<string, string> = {};

  // Split by variant markers
  const parts = content.split(/---variant:(\w+)---\n?/);

  // First part is always the default variant
  variants.default = parts[0].trim();

  // Process remaining parts in pairs: [context, content, context, content, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const context = parts[i];
    const variantContent = parts[i + 1]?.trim() || "";
    if (context && variantContent) {
      variants[context] = variantContent;
    }
  }

  return variants as Record<string, string> & { default: string };
}

/**
 * Serialize variants to content with ---variant:{context}--- markers
 */
export function serializeVariants(variants: Record<string, string>): string {
  const parts: string[] = [];

  // Default variant first (no marker)
  if (variants.default) {
    parts.push(variants.default);
  }

  // Other variants with markers
  for (const [context, content] of Object.entries(variants)) {
    if (context !== "default" && content) {
      parts.push(`---variant:${context}---\n\n${content}`);
    }
  }

  return parts.join("\n\n");
}

// ============================================
// BLOCK FILE OPERATIONS
// ============================================

/**
 * Read a prompt block file from the prompts/blocks/ directory
 * @param blockId - The block ID (filename without .md extension)
 * @returns Parsed block file data
 */
export async function readBlockFile(blockId: string): Promise<PromptBlockFile> {
  const filepath = path.join(BLOCKS_DIR, `${blockId}.md`);

  const { frontmatter, content } = await readFrontmatterFile(
    filepath,
    `Block file not found: ${blockId}.md`
  );

  return {
    id: (frontmatter.id as string) || blockId,
    name: frontmatter.name as string,
    description: (frontmatter.description as string) || "",
    tier: (frontmatter.tier as PromptBlockFile["tier"]) || 3,
    variants: parseVariants(content),
    created: frontmatter.created as string,
    updated: frontmatter.updated as string,
    updatedBy: frontmatter.updatedBy as string | undefined,
  };
}

/**
 * Write a prompt block file to the prompts/blocks/ directory
 * @param blockId - The block ID (filename without .md extension)
 * @param block - The block data to write
 */
export async function writeBlockFile(blockId: string, block: PromptBlockFile): Promise<void> {
  // Ensure blocks directory exists
  await ensureDir(BLOCKS_DIR);

  const frontmatter = {
    id: block.id,
    name: block.name,
    description: block.description,
    tier: block.tier,
    created: block.created,
    updated: new Date().toISOString(),
    updatedBy: block.updatedBy,
  };

  // Generate markdown with YAML frontmatter and variant content
  const content = serializeVariants(block.variants);
  const filepath = path.join(BLOCKS_DIR, `${blockId}.md`);
  await writeFrontmatterFile(filepath, content, frontmatter);
}

/**
 * List all block files in the prompts/blocks/ directory
 * @returns Array of block IDs (filenames without .md extension)
 */
export async function listBlockFiles(): Promise<string[]> {
  return listMarkdownFiles(BLOCKS_DIR);
}

/**
 * Check if a block file exists
 * @param blockId - The block ID to check
 * @returns True if the file exists
 */
export async function blockFileExists(blockId: string): Promise<boolean> {
  const filepath = path.join(BLOCKS_DIR, `${blockId}.md`);
  return fileExists(filepath);
}

/**
 * Delete a block file from the prompts/blocks/ directory
 * @param blockId - The block ID to delete
 */
export async function deleteBlockFile(blockId: string): Promise<void> {
  const filepath = path.join(BLOCKS_DIR, `${blockId}.md`);
  await deleteFile(filepath);
}

// ============================================
// MODIFIER FILE OPERATIONS
// ============================================

/**
 * Read a prompt modifier file from the prompts/modifiers/ directory
 * @param modifierId - The modifier ID (filename without .md extension)
 * @returns Parsed modifier file data
 */
export async function readModifierFile(modifierId: string): Promise<PromptModifierFile> {
  const filepath = path.join(MODIFIERS_DIR, `${modifierId}.md`);

  const { frontmatter, content } = await readFrontmatterFile(
    filepath,
    `Modifier file not found: ${modifierId}.md`
  );

  return {
    id: (frontmatter.id as string) || modifierId,
    name: frontmatter.name as string,
    type: (frontmatter.type as PromptModifierFile["type"]) || "mode",
    tier: (frontmatter.tier as PromptModifierFile["tier"]) || 3,
    content: content.trim(),
    created: frontmatter.created as string,
    updated: frontmatter.updated as string,
    updatedBy: frontmatter.updatedBy as string | undefined,
  };
}

/**
 * Write a prompt modifier file to the prompts/modifiers/ directory
 * @param modifierId - The modifier ID (filename without .md extension)
 * @param modifier - The modifier data to write
 */
export async function writeModifierFile(modifierId: string, modifier: PromptModifierFile): Promise<void> {
  // Ensure modifiers directory exists
  await ensureDir(MODIFIERS_DIR);

  const frontmatter = {
    id: modifier.id,
    name: modifier.name,
    type: modifier.type,
    tier: modifier.tier,
    created: modifier.created,
    updated: new Date().toISOString(),
    updatedBy: modifier.updatedBy,
  };

  // Generate markdown with YAML frontmatter
  const filepath = path.join(MODIFIERS_DIR, `${modifierId}.md`);
  await writeFrontmatterFile(filepath, modifier.content, frontmatter);
}

/**
 * List all modifier files in the prompts/modifiers/ directory
 * @returns Array of modifier IDs (filenames without .md extension)
 */
export async function listModifierFiles(): Promise<string[]> {
  return listMarkdownFiles(MODIFIERS_DIR);
}

/**
 * Check if a modifier file exists
 * @param modifierId - The modifier ID to check
 * @returns True if the file exists
 */
export async function modifierFileExists(modifierId: string): Promise<boolean> {
  const filepath = path.join(MODIFIERS_DIR, `${modifierId}.md`);
  return fileExists(filepath);
}

/**
 * Delete a modifier file from the prompts/modifiers/ directory
 * @param modifierId - The modifier ID to delete
 */
export async function deleteModifierFile(modifierId: string): Promise<void> {
  const filepath = path.join(MODIFIERS_DIR, `${modifierId}.md`);
  await deleteFile(filepath);
}
