/**
 * Smart context truncation that scores items by relevance to the question
 * and includes top-K items instead of boundary truncation.
 */

export interface ContextItem {
  id: string;
  title: string;
  content: string;
  type: "skill" | "document" | "url" | "customer";
}

export interface ScoredItem extends ContextItem {
  score: number;
  summary?: string;
}

/**
 * Calculate relevance score between question and content item
 * Uses simple keyword matching and TF-IDF-like scoring
 */
export function calculateRelevanceScore(question: string, item: ContextItem): number {
  const questionLower = question.toLowerCase();
  const titleLower = item.title.toLowerCase();
  const contentLower = item.content.toLowerCase();

  let score = 0;

  // Extract meaningful keywords from question (exclude common words)
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "is", "are",
    "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "should", "could", "can", "may", "might", "what", "when", "where", "who", "why", "how",
  ]);

  const keywords = questionLower
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, ""))
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Score based on keyword matches
  for (const keyword of keywords) {
    // Title matches are worth more
    if (titleLower.includes(keyword)) {
      score += 10;
    }

    // Content matches
    const contentMatches = (contentLower.match(new RegExp(keyword, "g")) || []).length;
    score += Math.min(contentMatches * 2, 20); // Cap at 20 points per keyword
  }

  // Boost for exact phrase match in title
  if (questionLower.length > 10 && titleLower.includes(questionLower)) {
    score += 50;
  }

  // Length penalty - prefer more concise, focused content
  const contentLength = item.content.length;
  if (contentLength < 500) {
    score += 5; // Bonus for concise content
  } else if (contentLength > 5000) {
    score -= 10; // Penalty for very long content
  }

  return score;
}

/**
 * Generate a summary of content for lower-priority items
 */
export function generateSummary(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Take first paragraph or up to maxLength
  const firstParagraph = content.split("\n\n")[0];
  if (firstParagraph.length <= maxLength) {
    return firstParagraph + "\n\n[...summary...]";
  }

  return content.slice(0, maxLength - 20) + "...\n\n[...summary...]";
}

/**
 * Smart truncation: score items by relevance, include top-K with full content,
 * include lower-K with summaries, exclude the rest
 */
export function smartTruncate(
  question: string,
  items: ContextItem[],
  maxTotalChars: number,
  options: {
    topKFullContent?: number; // Number of top items to include with full content
    nextKSummaries?: number; // Number of next items to include with summaries
  } = {}
): {
  items: ScoredItem[];
  totalChars: number;
  truncated: boolean;
  includedCount: number;
  excludedCount: number;
} {
  const { topKFullContent = 10, nextKSummaries = 10 } = options;

  // Score all items
  const scoredItems: ScoredItem[] = items.map((item) => ({
    ...item,
    score: calculateRelevanceScore(question, item),
  }));

  // Sort by score descending
  scoredItems.sort((a, b) => b.score - a.score);

  // Build result with smart inclusion
  const included: ScoredItem[] = [];
  let totalChars = 0;
  let currentIndex = 0;

  // Phase 1: Include top-K items with full content
  while (currentIndex < Math.min(topKFullContent, scoredItems.length)) {
    const item = scoredItems[currentIndex];
    const itemSize = item.title.length + item.content.length + 50; // +50 for formatting

    if (totalChars + itemSize > maxTotalChars && included.length > 0) {
      break; // Stop if we exceed limit (but ensure at least one item)
    }

    included.push(item);
    totalChars += itemSize;
    currentIndex++;
  }

  // Phase 2: Include next-K items with summaries
  while (currentIndex < Math.min(topKFullContent + nextKSummaries, scoredItems.length)) {
    const item = scoredItems[currentIndex];
    const summary = generateSummary(item.content);
    const itemSize = item.title.length + summary.length + 50;

    if (totalChars + itemSize > maxTotalChars) {
      break;
    }

    included.push({
      ...item,
      summary,
    });
    totalChars += itemSize;
    currentIndex++;
  }

  return {
    items: included,
    totalChars,
    truncated: currentIndex < scoredItems.length,
    includedCount: included.length,
    excludedCount: scoredItems.length - included.length,
  };
}

/**
 * Build context string from scored items
 */
export function buildContextString(
  scoredItems: ScoredItem[],
  type: "skill" | "document" | "url" | "customer"
): string {
  if (scoredItems.length === 0) {
    return "";
  }

  const typeLabel = {
    skill: "SKILL",
    document: "DOCUMENT",
    url: "REFERENCE URL",
    customer: "CUSTOMER PROFILE",
  }[type];

  return scoredItems
    .map((item, idx) => {
      const content = item.summary || item.content;
      const header = `=== ${typeLabel} ${idx + 1}: ${item.title} ===`;
      return `${header}\n\n${content}`;
    })
    .join("\n\n---\n\n");
}
