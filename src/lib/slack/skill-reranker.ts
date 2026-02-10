/**
 * Skill Reranker
 *
 * Reranks skills to prioritize those used in previous thread messages.
 */

export interface RerankOptions {
  boostFactor?: number;
  maxSkills?: number;
}

/**
 * Rerank skills to prioritize previously used ones
 *
 * Scores skills based on whether they were used in previous thread messages.
 * Previously used skills get a boost factor (default: 10), others get 1.
 * Returns top N skills sorted by score, maintaining diversity.
 *
 * Type parameter T must include at least id, title, and content fields.
 * All properties of input skills are preserved in the output.
 *
 * @param allSkills - All available skills to rerank (must include id, title, content)
 * @param previousSkillIds - IDs of skills used in previous thread messages
 * @param options - Reranking options (boostFactor, maxSkills)
 * @returns Reranked skills array, limited to maxSkills (all properties preserved)
 */
export function rerankSkills<T extends { id: string; title: string; content: string }>(
  allSkills: T[],
  previousSkillIds: string[],
  options: RerankOptions = {}
): T[] {
  const { boostFactor = 10, maxSkills = 50 } = options;

  if (allSkills.length === 0) {
    return [];
  }

  // Score skills based on prior usage
  const scored = allSkills.map(skill => ({
    skill,
    score: previousSkillIds.includes(skill.id) ? boostFactor : 1,
  }));

  // Sort by score descending, then by title for stable ordering
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.skill.title.localeCompare(b.skill.title);
  });

  // Take top N
  return scored.slice(0, maxSkills).map(item => item.skill);
}
