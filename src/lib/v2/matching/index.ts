/**
 * Unified Matching Module
 *
 * Exports all content-to-skill matching functionality.
 */

export {
  // Core function
  matchContentToSkills,
  getQuickKeywordMatches,
  shouldSuggestNewSkill,
  scoreContentAgainstSkill,

  // Types
  type SkillForMatching,
  type ContentSkillMatch,
  type SkillWithRanking,
  type ContentToMatch,
  type MatchContentRequest,
  type MatchContentPreviewResult,
  type MatchContentExecuteResult,
  type MatchContentForecastResult,
  type MatchContentResult,
} from './content-skill-matcher';
