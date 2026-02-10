import fs from "fs/promises";
import matter from "gray-matter";

export function createSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function readFrontmatterFile(
  filepath: string,
  notFoundMessage: string
): Promise<{ frontmatter: Record<string, unknown>; content: string }> {
  try {
    const fileContent = await fs.readFile(filepath, "utf-8");
    const { data: frontmatter, content } = matter(fileContent);
    return { frontmatter, content };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(notFoundMessage);
    }
    throw error;
  }
}

export async function writeFrontmatterFile(
  filepath: string,
  content: string,
  frontmatter: Record<string, unknown>
): Promise<void> {
  const markdown = matter.stringify(content, frontmatter);
  await fs.writeFile(filepath, markdown, "utf-8");
}

export async function listMarkdownFiles(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files
      .filter((file) => file.endsWith(".md") && file !== "README.md")
      .map((file) => file.replace(/\.md$/, ""));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function deleteFile(filepath: string): Promise<void> {
  await fs.unlink(filepath);
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  await fs.rename(oldPath, newPath);
}

/**
 * Serialize content with YAML frontmatter to a string
 * Used by GitHub API provider to get file content without writing to disk
 */
export function serializeFrontmatter(
  content: string,
  frontmatter: Record<string, unknown>
): string {
  return matter.stringify(content, frontmatter);
}
