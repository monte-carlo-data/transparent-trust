/**
 * Keyword Extraction Service
 *
 * Provides algorithmic keyword extraction for skill matching.
 * Uses TF-IDF-like approach to identify important terms from skill content or source material.
 * These keywords enable fast matching without LLM calls.
 */

import type { ScopeDefinition } from '@/types/v2';

// =============================================================================
// TYPES
// =============================================================================

interface KeywordStats {
  term: string;
  frequency: number;
  score: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Stop words to exclude from keyword extraction */
const STOP_WORDS = new Set([
  // Common English words
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how',
  'all', 'each', 'every', 'both', 'any', 'some', 'no', 'none', 'not',
  'also', 'as', 'just', 'only', 'so', 'such', 'than', 'too', 'very',
  // Technical filler words common in documentation
  'skill', 'content', 'document', 'section', 'information', 'data', 'item', 'element',
  'please', 'note', 'see', 'refer', 'etc', 'example', 'including', 'such',
  // Short words
  'it', 'if', 'or', 'up', 'us', 'vs'
]);

// =============================================================================
// KEYWORD EXTRACTION
// =============================================================================

/**
 * Extract keywords from text using frequency analysis
 *
 * Algorithm:
 * 1. Tokenize and normalize text
 * 2. Filter stop words
 * 3. Calculate frequency and position scores
 * 4. Sort by score and return top N
 *
 * @param text - Text to extract keywords from
 * @param limit - Maximum number of keywords to extract (default: 5)
 * @returns Array of keywords sorted by importance
 */
export function extractKeywords(text: string, limit: number = 5): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normalize and tokenize
  const tokens = normalizeText(text);

  if (tokens.length === 0) {
    return [];
  }

  // Calculate frequency scores
  const scores = new Map<string, KeywordStats>();

  tokens.forEach((token, index) => {
    if (!scores.has(token)) {
      scores.set(token, { term: token, frequency: 0, score: 0 });
    }

    const stats = scores.get(token)!;
    stats.frequency += 1;

    // Position boost: earlier appearances are more important
    const positionBoost = Math.max(0, 1 - (index / tokens.length) * 0.5);
    stats.score += 1 + positionBoost;
  });

  // Sort by score and extract top keywords
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(stat => stat.term);
}

/**
 * Extract keywords from a scope definition's covers field
 * @param scope - Scope definition to extract from
 * @param limit - Maximum keywords to extract
 * @returns Array of keywords
 */
export function extractKeywordsFromScope(scope: ScopeDefinition | undefined, limit: number = 5): string[] {
  if (!scope?.covers) {
    return [];
  }

  return extractKeywords(scope.covers, limit);
}

/**
 * Extract keywords from multiple sources (useful for matching)
 * Combines keywords from all sources and deduplicates
 *
 * @param sources - Array of source material
 * @param limit - Maximum keywords to extract
 * @returns Array of unique keywords
 */
export function extractKeywordsFromSources(
  sources: Array<{ content: string; label?: string }>,
  limit: number = 5
): string[] {
  if (sources.length === 0) {
    return [];
  }

  // Combine all content
  const combined = sources
    .map(s => s.content)
    .filter(c => c && c.length > 0)
    .join('\n');

  return extractKeywords(combined, limit);
}

/**
 * Normalize text for keyword extraction
 * - Convert to lowercase
 * - Remove special characters (keep alphanumeric and common separators)
 * - Split into tokens
 * - Filter stop words and empty tokens
 *
 * @param text - Text to normalize
 * @returns Array of normalized tokens
 */
function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Keep letters, numbers, spaces, hyphens
    .split(/\s+/) // Split on whitespace
    .filter(token => token.length > 2 && !STOP_WORDS.has(token)); // Filter by length and stop words
}

// =============================================================================
// KEYWORD SCORING & MATCHING
// =============================================================================

/**
 * Score how well source keywords match skill scope keywords
 * Uses simple set intersection with frequency weighting
 *
 * @param sourceKeywords - Keywords extracted from source
 * @param skillKeywords - Keywords extracted from skill scope
 * @returns Score from 0 to 1 (1.0 = perfect match)
 */
export function scoreKeywordMatch(sourceKeywords: string[], skillKeywords: string[]): number {
  if (skillKeywords.length === 0) {
    return 0;
  }

  if (sourceKeywords.length === 0) {
    return 0;
  }

  // Convert to sets for comparison
  const sourceSet = new Set(sourceKeywords);
  const skillSet = new Set(skillKeywords);

  // Calculate intersection
  const intersection = Array.from(skillSet).filter(k => sourceSet.has(k)).length;

  // Score = intersection / min(source size, skill size)
  // This prevents small keyword sets from scoring too high
  const denominator = Math.min(sourceSet.size, skillSet.size);
  return intersection / denominator;
}

/**
 * Find best keyword matches between source and multiple skills
 * Returns skills ranked by keyword match score
 *
 * @param sourceKeywords - Keywords from source
 * @param skills - Array of skills with keywords
 * @returns Ranked array of { skillId, score }
 */
export function rankSkillsByKeywords(
  sourceKeywords: string[],
  skills: Array<{
    id: string;
    keywords?: string[];
  }>
): Array<{ skillId: string; score: number }> {
  return skills
    .map(skill => ({
      skillId: skill.id,
      score: scoreKeywordMatch(sourceKeywords, skill.keywords || []),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Filter keywords by minimum score threshold
 * Useful for only considering significant matches
 *
 * @param keywords - Keywords to filter
 * @param minLength - Minimum keyword length
 * @returns Filtered keywords
 */
export function filterKeywords(keywords: string[], minLength: number = 3): string[] {
  return keywords.filter(k => k.length >= minLength);
}

/**
 * Deduplicate keywords (case-insensitive)
 * @param keywords - Keywords to deduplicate
 * @returns Unique keywords
 */
export function deduplicateKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  return keywords.filter(k => {
    const lower = k.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

/**
 * Combine multiple keyword arrays and deduplicate
 * @param keywordArrays - Multiple arrays of keywords
 * @returns Combined unique keywords
 */
export function combineKeywords(...keywordArrays: string[][]): string[] {
  const combined = keywordArrays.flat();
  return deduplicateKeywords(combined);
}
