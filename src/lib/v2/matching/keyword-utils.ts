/**
 * Client-Safe Keyword Utilities
 *
 * Lightweight keyword extraction and matching that runs in the browser.
 * No server dependencies - can be imported in 'use client' components.
 */

// =============================================================================
// STOP WORDS
// =============================================================================

const STOP_WORDS = new Set([
  // Common English words
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how',
  'all', 'each', 'every', 'both', 'any', 'some', 'no', 'none', 'not',
  'also', 'just', 'only', 'so', 'such', 'than', 'too', 'very',
  // Technical filler words
  'skill', 'content', 'document', 'section', 'information', 'data', 'item', 'element',
  'please', 'note', 'see', 'refer', 'etc', 'example', 'including',
  // Short words
  'it', 'if', 'or', 'up', 'us', 'vs', 'hi', 'ok', 're', 'am', 'pm',
  // Support ticket noise
  'ticket', 'issue', 'problem', 'help', 'need', 'want', 'thanks', 'thank', 'please',
  'hello', 'regards', 'best', 'sincerely', 'dear', 'hi', 'hey',
]);

// =============================================================================
// KEYWORD EXTRACTION
// =============================================================================

/**
 * Extract keywords from text (client-safe)
 * Uses frequency + position scoring
 */
export function extractKeywords(text: string, limit: number = 5): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normalize and tokenize
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));

  if (tokens.length === 0) {
    return [];
  }

  // Calculate frequency scores with position boost
  const scores = new Map<string, number>();

  tokens.forEach((token, index) => {
    const current = scores.get(token) || 0;
    const positionBoost = Math.max(0, 1 - (index / tokens.length) * 0.5);
    scores.set(token, current + 1 + positionBoost);
  });

  // Sort by score and return top N
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

// =============================================================================
// KEYWORD MATCHING
// =============================================================================

export interface QuickMatchResult {
  skillId: string;
  skillTitle: string;
  score: number;
  matchedKeywords: string[];
}

/**
 * Quick keyword-based skill matching (client-safe, synchronous)
 * Returns skills sorted by match score
 */
export function quickMatchKeywords(
  sourceKeywords: string[],
  skills: Array<{
    id: string;
    title: string;
    keywords?: string[];
    scopeCovers?: string;
  }>,
  maxResults: number = 3
): QuickMatchResult[] {
  if (sourceKeywords.length === 0 || skills.length === 0) {
    return [];
  }

  const sourceSet = new Set(sourceKeywords.map(k => k.toLowerCase()));
  const results: QuickMatchResult[] = [];

  for (const skill of skills) {
    // Get skill keywords from stored keywords or extract from scope
    const skillKeywords = skill.keywords?.length
      ? skill.keywords.map(k => k.toLowerCase())
      : extractKeywordsFromScope(skill.scopeCovers);

    if (skillKeywords.length === 0) continue;

    // Find matching keywords
    const matched = skillKeywords.filter(k => sourceSet.has(k));

    if (matched.length > 0) {
      // Score = matched / min(source, skill) for balanced scoring
      const score = matched.length / Math.min(sourceSet.size, skillKeywords.length);
      results.push({
        skillId: skill.id,
        skillTitle: skill.title,
        score,
        matchedKeywords: matched,
      });
    }
  }

  // Sort by score descending and limit
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Extract keywords from a scope "covers" field
 */
function extractKeywordsFromScope(coversText: string | undefined): string[] {
  if (!coversText) return [];

  // Split on common delimiters and clean up
  return coversText
    .toLowerCase()
    .split(/[,;]/)
    .flatMap(phrase => phrase.trim().split(/\s+/))
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/**
 * Format keywords for display (capitalize first letter)
 */
export function formatKeyword(keyword: string): string {
  return keyword.charAt(0).toUpperCase() + keyword.slice(1);
}

/**
 * Get confidence label based on match score
 */
export function getMatchConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.5) return 'high';
  if (score >= 0.25) return 'medium';
  return 'low';
}

/**
 * Get confidence color classes for UI
 */
export function getConfidenceColor(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'low':
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}
