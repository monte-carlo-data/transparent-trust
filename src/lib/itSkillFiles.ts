import path from "path";
import {
  createSlug,
  readFrontmatterFile,
  writeFrontmatterFile,
  listMarkdownFiles,
  fileExists,
  ensureDir,
  deleteFile,
  renameFile,
} from "./frontmatterStore";

/**
 * IT Skill file format - Agent Skills compatible structure
 * Stored as markdown files with YAML frontmatter in it/ directory
 *
 * IT skills are sourced primarily from Zendesk tickets and cover
 * internal IT support topics (hardware, software, access, onboarding, etc.)
 */
export interface ITSkillFile {
  // Agent Skills required fields
  name: string; // lowercase-with-hyphens (same as slug)
  description: string; // Trigger text for discovery (when to use this skill)

  // Internal fields
  id: string;
  slug: string;
  title: string;
  content: string; // Pure markdown content
  categories: string[]; // e.g., ["Hardware", "Software", "Access", "Onboarding", "Security"]
  owners: Array<{
    name: string;
    email?: string;
    userId?: string;
  }>;
  sources: Array<{
    url: string;
    addedAt: string;
    lastFetched?: string;
  }>;
  created: string; // ISO 8601 timestamp
  updated: string; // ISO 8601 timestamp
  active: boolean;

  // Zendesk-specific fields
  zendeskTags?: string[]; // Tags to match when refreshing from Zendesk
  lastTicketSync?: string; // ISO timestamp of last Zendesk ticket check
  incorporatedTickets?: number[]; // Last N ticket IDs that informed this skill
}

// Path to IT skills directory (relative to project root)
const IT_SKILLS_DIR = path.join(process.cwd(), "it");

/**
 * Generate URL-safe slug from IT skill title
 * e.g., "VPN Setup Guide" -> "vpn-setup-guide"
 */
export function getITSkillSlug(title: string): string {
  return createSlug(title);
}

/**
 * Read an IT skill file from the it/ directory
 * @param slug - The IT skill slug (filename without .md extension)
 * @returns Parsed IT skill file data
 */
export async function readITSkillFile(slug: string): Promise<ITSkillFile> {
  const filepath = path.join(IT_SKILLS_DIR, `${slug}.md`);

  const { frontmatter, content } = await readFrontmatterFile(
    filepath,
    `IT skill file not found: ${slug}.md`
  );

  return {
    // Agent Skills fields (default name to slug if not present)
    name: (frontmatter.name as string) || slug,
    description: (frontmatter.description as string) || "",

    // Internal fields
    id: frontmatter.id as string,
    slug,
    title: frontmatter.title as string,
    content: content.trim(),
    categories: (frontmatter.categories as ITSkillFile["categories"]) || [],
    owners: (frontmatter.owners as ITSkillFile["owners"]) || [],
    sources: (frontmatter.sources as ITSkillFile["sources"]) || [],
    created: frontmatter.created as string,
    updated: frontmatter.updated as string,
    active: frontmatter.active !== false,

    // Zendesk-specific fields
    zendeskTags: (frontmatter.zendeskTags as string[]) || undefined,
    lastTicketSync: frontmatter.lastTicketSync as string | undefined,
    incorporatedTickets: (frontmatter.incorporatedTickets as number[]) || undefined,
  };
}

/**
 * Write an IT skill file to the it/ directory
 * @param slug - The IT skill slug (filename without .md extension)
 * @param skill - The IT skill data to write
 */
export async function writeITSkillFile(
  slug: string,
  skill: ITSkillFile
): Promise<void> {
  // Ensure IT skills directory exists
  await ensureDir(IT_SKILLS_DIR);

  const frontmatter: Record<string, unknown> = {
    // Agent Skills required fields (at top for visibility)
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

  // Generate markdown with YAML frontmatter
  const filepath = path.join(IT_SKILLS_DIR, `${slug}.md`);
  await writeFrontmatterFile(filepath, skill.content, frontmatter);
}

/**
 * List all IT skill files in the it/ directory
 * @returns Array of IT skill slugs (filenames without .md extension)
 */
export async function listITSkillFiles(): Promise<string[]> {
  return listMarkdownFiles(IT_SKILLS_DIR);
}

/**
 * Check if an IT skill file exists
 * @param slug - The IT skill slug to check
 * @returns True if the file exists
 */
export async function itSkillFileExists(slug: string): Promise<boolean> {
  const filepath = path.join(IT_SKILLS_DIR, `${slug}.md`);
  return fileExists(filepath);
}

/**
 * Delete an IT skill file from the it/ directory
 * @param slug - The IT skill slug to delete
 */
export async function deleteITSkillFile(slug: string): Promise<void> {
  const filepath = path.join(IT_SKILLS_DIR, `${slug}.md`);
  await deleteFile(filepath);
}

/**
 * Rename an IT skill file (when title changes)
 * @param oldSlug - Current IT skill slug
 * @param newSlug - New IT skill slug
 */
export async function renameITSkillFile(
  oldSlug: string,
  newSlug: string
): Promise<void> {
  if (oldSlug === newSlug) return;

  const oldPath = path.join(IT_SKILLS_DIR, `${oldSlug}.md`);
  const newPath = path.join(IT_SKILLS_DIR, `${newSlug}.md`);

  await renameFile(oldPath, newPath);
}

/**
 * IT skill categories for organization
 */
export const IT_SKILL_CATEGORIES = [
  "Hardware",
  "Software",
  "Access & Permissions",
  "Onboarding",
  "Security",
  "Network & VPN",
  "Email & Communication",
  "Cloud Services",
  "Development Tools",
  "General IT",
] as const;

export type ITSkillCategory = (typeof IT_SKILL_CATEGORIES)[number];
