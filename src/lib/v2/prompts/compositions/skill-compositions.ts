/**
 * V2 Skill Building Compositions
 *
 * Compositions for creating, updating, and matching skills.
 */

import type { PromptComposition } from '../types';
import type { SkillType } from '@/types/v2';

// =============================================================================
// SKILL CREATION
// =============================================================================

/**
 * Get the skill creation composition based on skill type
 * - Knowledge skills: Include Q&A section requirement
 * - Intelligence skills: Exclude Q&A section, focus on narrative
 */
export function getSkillCreationComposition(skillType: SkillType = 'knowledge'): PromptComposition {
  const baseBlockIds = [
    'role_skill_creation',
    'task_framing_creation',
    'skill_principles',
    'source_fidelity',
    'citation_format',
  ];

  const contentStructureBlock = skillType === 'intelligence'
    ? 'intelligence_content_structure'
    : 'knowledge_content_structure';

  const outputBlocks = [
    contentStructureBlock,
    ...(skillType === 'knowledge' ? ['skill_common_questions_requirement'] : []),
    'skill_citation_embedding',
    'skill_list_completeness',
    'scope_definition',
    'contradiction_detection',
    'json_output',
  ];

  return {
    context: 'skill_creation',
    name: `Skill Creation (${skillType})`,
    description: `Create a new ${skillType}-type skill from source materials with scope definition and citations.`,
    category: 'skills',
    usedBy: [
      { feature: 'Skill Creation', location: 'skill-orchestrator.ts', type: 'internal' },
      { feature: 'Create Skill API', location: '/api/v2/skills/create', type: 'api' },
    ],
    blockIds: [...baseBlockIds, ...outputBlocks],
    outputFormat: 'json',
    outputSchema: `{
  "title": "string - Concise, descriptive skill title",
  "content": "string - Comprehensive skill content with [1], [2] citations",
  "summary": "string - One sentence summary",
  "scopeDefinition": {
    "covers": "string - What this skill covers",
    "futureAdditions": ["string[] - What should be added later"],
    "notIncluded": ["string[] - What should NOT be in this skill"]
  },
  "citations": [{
    "id": "string - Citation number (1, 2, etc.)",
    "sourceId": "string - Source ID from input",
    "label": "string - Display label",
    "url": "string? - Direct link if available"
  }],
  "contradictions": [{
    "type": "string - technical_contradiction|version_mismatch|outdated_vs_current|scope_mismatch",
    "description": "string - What conflicts",
    "sourceA": { "id": "string", "label": "string", "excerpt": "string" },
    "sourceB": { "id": "string", "label": "string", "excerpt": "string" },
    "severity": "low|medium|high",
    "recommendation": "string - How to resolve"
  }]
}`,
  };
}

// Legacy export for backward compatibility
export const skillCreationComposition = getSkillCreationComposition('knowledge');

/**
 * User prompt template for skill creation
 * DATA ONLY - all instructions are in blocks
 * Placeholders: {{sources}}, {{libraryContext}}
 */
export const skillCreationUserPrompt = `{{libraryContext}}

## Source Materials

{{sources}}`;

// =============================================================================
// SKILL UPDATE
// =============================================================================

/**
 * Get the skill update composition based on skill type
 */
export function getSkillUpdateComposition(skillType: SkillType = 'knowledge'): PromptComposition {
  const baseBlockIds = [
    'role_skill_update',
    'task_framing_update',
    'source_fidelity',
    'citation_format',
  ];

  const contentStructureBlock = skillType === 'intelligence'
    ? 'intelligence_content_structure'
    : 'knowledge_content_structure';

  const outputBlocks = [
    contentStructureBlock,
    'skill_citation_embedding',
    'skill_list_completeness',
    'skill_update_structure',
    'scope_definition',
    'contradiction_detection',
    'diff_output',
    'json_output',
  ];

  return {
    context: 'skill_update',
    name: `Skill Update (${skillType})`,
    description: `Update an existing ${skillType}-type skill with new source material, tracking changes.`,
    category: 'skills',
    usedBy: [
      { feature: 'Skill Update', location: 'skill-orchestrator.ts', type: 'internal' },
      { feature: 'Skill Update API', location: '/api/v2/skills/[id]/update', type: 'api' },
    ],
    blockIds: [...baseBlockIds, ...outputBlocks],
    outputFormat: 'json',
    outputSchema: `{
  "title": "string - Updated title (or unchanged)",
  "content": "string - Updated content with citations",
  "summary": "string - Updated summary",
  "changes": {
    "sectionsAdded": ["string[] - New sections added"],
    "sectionsUpdated": ["string[] - Sections that were modified"],
    "sectionsRemoved": ["string[] - Sections removed (rare)"],
    "changeSummary": "string - Human-readable summary of changes"
  },
  "citations": [{
    "id": "string",
    "sourceId": "string",
    "label": "string",
    "url": "string?"
  }],
  "contradictions": [{
    "type": "string",
    "description": "string",
    "sourceA": { "id": "string", "label": "string", "excerpt": "string" },
    "sourceB": { "id": "string", "label": "string", "excerpt": "string" },
    "severity": "low|medium|high",
    "recommendation": "string"
  }],
  "scopeDefinition": {
    "covers": "string - What this skill covers",
    "futureAdditions": ["string[] - What should be added later"],
    "notIncluded": ["string[] - What should NOT be in this skill"]
  },
  "splitRecommendation": {
    "shouldSplit": "boolean",
    "reason": "string?",
    "suggestedSkills": [{ "title": "string", "scope": "string" }]
  }
}`,
  };
}

// Legacy export for backward compatibility
export const skillUpdateComposition = getSkillUpdateComposition('knowledge');

/**
 * User prompt template for skill update
 * DATA ONLY - all instructions are in blocks
 * Placeholders:
 *   {{existingTitle}} - Title of the existing skill
 *   {{existingContent}} - Current skill content
 *   {{scopeDefinition}} - Current scope definition text
 *   {{existingCitations}} - Format: "[1] Label\n[2] Label\n[3] Label"
 *   {{newSources}} - New source materials to integrate
 */
export const skillUpdateUserPrompt = `## Existing Skill

Title: {{existingTitle}}

Content:
{{existingContent}}

Scope Definition:
{{scopeDefinition}}

Existing Citations:
{{existingCitations}}

## New Source Material

{{newSources}}`;

// =============================================================================
// SKILL MATCHING
// =============================================================================

export const skillMatchingComposition: PromptComposition = {
  context: 'skill_matching',
  name: 'Skill Matching',
  description: 'Match a new source to existing skills based on scope definitions.',
  category: 'skills',
  usedBy: [
    { feature: 'Skill Matching', location: 'skill-orchestrator.ts', type: 'internal' },
    { feature: 'Source Assignment', location: '/v2/[library]/sources', type: 'ui' },
  ],
  blockIds: [
    'role_skill_matching',
    'task_framing_matching',
    'skill_matching',
    'skill_principles',
    'json_output',
  ],
  outputFormat: 'json',
  outputSchema: `{
  "matches": [{
    "skillId": "string - ID of matching skill",
    "skillTitle": "string - Title of matching skill",
    "confidence": "high|medium|low",
    "reason": "string - Why this matches",
    "matchedCriteria": "string - Which scope criteria matched",
    "suggestedExcerpt": "string - What excerpt to use from source"
  }],
  "createNew": {
    "recommended": "boolean",
    "suggestedTitle": "string",
    "suggestedScope": {
      "covers": "string",
      "futureAdditions": ["string[]"]
    }
  }
}`,
};

/**
 * User prompt template for skill matching
 * DATA ONLY - all instructions are in blocks
 * Placeholders: {{sourceId}}, {{sourceType}}, {{sourceLabel}}, {{sourceContent}}, {{skillScopes}}
 */
export const skillMatchingUserPrompt = `## New Source Content

Source ID: {{sourceId}}
Source Type: {{sourceType}}
Source Label: {{sourceLabel}}

Content:
{{sourceContent}}

## Existing Skills and Their Scopes

{{skillScopes}}`;

// =============================================================================
// SKILL FORMAT REFRESH
// =============================================================================

/**
 * Get the skill format refresh composition based on skill type
 */
export function getSkillFormatRefreshComposition(skillType: SkillType = 'knowledge'): PromptComposition {
  const baseBlockIds = [
    'role_skill_format_refresh',
    'task_framing_format_refresh',
    'source_fidelity',
    'citation_format',
  ];

  const contentStructureBlock = skillType === 'intelligence'
    ? 'intelligence_content_structure'
    : 'knowledge_content_structure';

  const outputBlocks = [
    contentStructureBlock,
    'skill_citation_embedding',
    'skill_list_completeness',
    'skill_refresh_structure',
    'scope_definition',
    'contradiction_detection',
    'diff_output',
    'json_output',
  ];

  return {
    context: 'skill_format_refresh',
    name: `Skill Format Refresh (${skillType})`,
    description: `Regenerate an existing ${skillType}-type skill through current format standards and format conventions.`,
    category: 'skills',
    usedBy: [
      { feature: 'Skill Format Refresh', location: 'skill-orchestrator.ts', type: 'internal' },
      { feature: 'Skill Detail Page', location: '/v2/[library]/skills/[slug]', type: 'ui' },
    ],
    blockIds: [...baseBlockIds, ...outputBlocks],
    outputFormat: 'json',
    outputSchema: `{
  "title": "string - Updated title (or unchanged)",
  "content": "string - Reformatted content with current standards",
  "summary": "string - Updated summary",
  "changes": {
    "sectionsAdded": ["string[] - New sections added"],
    "sectionsUpdated": ["string[] - Sections that were reformatted"],
    "sectionsRemoved": ["string[] - Sections removed (rare)"],
    "changeSummary": "string - Human-readable summary of changes"
  },
  "citations": [{
    "id": "string",
    "sourceId": "string",
    "label": "string",
    "url": "string?"
  }],
  "contradictions": [{
    "type": "string",
    "description": "string",
    "sourceA": { "id": "string", "label": "string", "excerpt": "string" },
    "sourceB": { "id": "string", "label": "string", "excerpt": "string" },
    "severity": "low|medium|high",
    "recommendation": "string"
  }],
  "scopeDefinition": {
    "covers": "string - What this skill covers",
    "futureAdditions": ["string[] - What should be added later"],
    "notIncluded": ["string[] - What should NOT be in this skill"]
  },
  "splitRecommendation": {
    "shouldSplit": "boolean",
    "reason": "string?",
    "suggestedSkills": [{ "title": "string", "scope": "string" }]
  }
}`,
  };
}

// Legacy export for backward compatibility
export const skillFormatRefreshComposition = getSkillFormatRefreshComposition('knowledge');

/**
 * User prompt template for skill format refresh
 * DATA ONLY - all instructions are in blocks
 * Placeholders:
 *   {{existingTitle}} - Title of the existing skill
 *   {{existingContent}} - Current skill content
 *   {{scopeDefinition}} - Current scope definition text
 *   {{existingCitations}} - Format: "[1] Label\n[2] Label\n[3] Label"
 *   {{allSources}} - All incorporated source materials
 */
export const skillFormatRefreshUserPrompt = `## Existing Skill

Title: {{existingTitle}}

Content:
{{existingContent}}

Current Scope Definition:
{{scopeDefinition}}

Existing Citations:
{{existingCitations}}

## All Incorporated Source Materials

{{allSources}}`;

// =============================================================================
// EXPORT ALL COMPOSITIONS
// =============================================================================

// Legacy static compositions array for backward compatibility
export const skillCompositions: PromptComposition[] = [
  skillCreationComposition,
  skillUpdateComposition,
  skillMatchingComposition,
  skillFormatRefreshComposition,
];
