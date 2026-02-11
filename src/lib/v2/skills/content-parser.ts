/**
 * Content Parser for V2 Skills
 *
 * Extracts scope definition and sources from embedded skill content.
 * Skills now embed these sections directly in content for self-containment.
 *
 * Key change: Uses robust parsing from scope-validator.ts
 * Throws errors for malformed scope instead of silent empty fallbacks.
 */

import { extractScopeFromMarkdown } from './scope-validator';
import type { ScopeDefinition } from '@/types/v2';

interface ParsedContent {
  main: string;
  scopeDefinition?: ScopeDefinition;
  sources?: Array<{
    id: string;
    label: string;
  }>;
}

/**
 * Parse skill content to extract scope definition and sources sections
 *
 * @param content - The skill content markdown
 * @returns Parsed content with main body, scope definition, and sources
 * @throws Error if scope section is found but malformed (missing "Covers" field)
 */
export function parseSkillContent(content: string): ParsedContent {
  if (!content) {
    return { main: '' };
  }

  let scopeDefinition: ScopeDefinition | undefined;

  try {
    // Use robust parser from scope-validator
    scopeDefinition = extractScopeFromMarkdown(content);
  } catch (error) {
    // Re-throw parsing errors - don't silently fail
    if (error instanceof Error) {
      throw new Error(`Failed to parse scope definition: ${error.message}`);
    }
    throw error;
  }

  // Find the sources section
  const sourcesMatch = content.match(/##\s*Sources\s*([\s\S]*?)$/i);
  let sources: ParsedContent['sources'];

  if (sourcesMatch) {
    const sourcesText = sourcesMatch[1];
    const sourceLines = sourcesText.split('\n').filter((line) => line.trim().match(/^\[\d+\]/));

    sources = sourceLines.map((line) => {
      const match = line.match(/\[(\d+)\]\s*(.+?)(?:\s*-\s*|$)/);
      if (match) {
        return {
          id: match[1],
          label: match[2].trim(),
        };
      }
      return { id: '', label: '' };
    }).filter(s => s.id);
  }

  // Extract main content (everything before scope definition)
  const scopeMatch = content.match(/##\s*Scope\s*Definition/i);
  const mainEndIndex = scopeMatch ? content.indexOf(scopeMatch[0]) : content.length;
  const main = content.substring(0, mainEndIndex).trim();

  return {
    main,
    scopeDefinition,
    sources,
  };
}

/**
 * Check if content has embedded scope definition section
 */
export function hasEmbeddedScope(content: string): boolean {
  return /##\s*Scope\s*Definition/i.test(content);
}

/**
 * Check if content has embedded sources section
 */
export function hasEmbeddedSources(content: string): boolean {
  return /##\s*Sources/.test(content);
}

/**
 * Extract just the main content (without scope and sources sections)
 */
export function getMainContent(content: string): string {
  const parsed = parseSkillContent(content);
  return parsed.main;
}

/**
 * Extract just the scope definition from content
 *
 * @param content - The skill content markdown
 * @returns Scope definition or undefined if not found
 * @throws Error if scope section found but malformed
 */
export function getScopeFromContent(
  content: string
): ScopeDefinition | undefined {
  const parsed = parseSkillContent(content);
  return parsed.scopeDefinition;
}

/**
 * Extract just the sources from content
 */
export function getSourcesFromContent(content: string): ParsedContent['sources'] | undefined {
  const parsed = parseSkillContent(content);
  return parsed.sources;
}

/**
 * Strip embedded scope definition and sources sections from content.
 * Used during format refresh to clean up legacy content that has these embedded.
 * Scope and sources are now stored separately in attributes.
 *
 * @param content - The content to clean
 * @param maxLength - Maximum allowed content length (default 100KB) to prevent ReDoS
 * @throws Error if content exceeds maxLength
 */
export function stripEmbeddedSections(content: string, maxLength: number = 102400): string {
  if (!content) return '';

  // Prevent ReDoS by validating content length
  if (content.length > maxLength) {
    throw new Error(`Content exceeds maximum length of ${maxLength} bytes`);
  }

  // Remove ## Scope Definition section and everything after it until ## Sources or end
  let cleaned = content.replace(/##\s*Scope\s*Definition[\s\S]*?(?=##\s*Sources|$)/i, '');

  // Remove ## Sources section and everything after it
  cleaned = cleaned.replace(/##\s*Sources[\s\S]*$/i, '');

  return cleaned.trim();
}
