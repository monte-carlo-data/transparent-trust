/**
 * Foundational Skills Prompt Compositions
 *
 * Compositions for creating and updating foundational skills.
 * These use extraction-focused task blocks instead of synthesis-focused ones.
 */

import type { PromptComposition } from '../types';

// =============================================================================
// FOUNDATIONAL SKILL CREATION
// =============================================================================

export const foundationalCreationComposition: PromptComposition = {
  context: 'foundational_creation',
  name: 'Foundational Skill Creation',
  description: 'Create a foundational skill by extracting scope-relevant content from sources.',
  category: 'foundational',
  usedBy: [
    { feature: 'Foundational Skill Creation', location: 'skill-orchestrator.ts', type: 'internal' },
    { feature: 'Create Skill API', location: '/api/v2/skills/create', type: 'api' },
  ],
  blockIds: [
    'role_skill_creation',
    'task_framing_foundational_creation',
    'skill_principles',
    'source_fidelity',
    'citation_format',
    'skill_content_structure',
    'skill_common_questions_requirement',
    'skill_citation_embedding',
    'skill_list_completeness',
    'scope_definition',
    'contradiction_detection',
    'json_output',
  ],
  outputFormat: 'json',
  outputSchema: `{
  "title": "string - Skill title (from foundational scope)",
  "content": "string - Extracted content with [1], [2] citations, only scope-relevant",
  "summary": "string - One sentence summary",
  "scopeDefinition": {
    "covers": "string - What this skill covers (from foundational scope)",
    "futureAdditions": ["string[] - What should be added later (from foundational scope)"],
    "notIncluded": ["string[] - What should NOT be in this skill (from foundational scope)"]
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
  }],
  "extractedContent": [{
    "sourceId": "string - Source ID",
    "extracted": "string - What was extracted from this source"
  }]
}`,
};

/**
 * User prompt template for foundational skill creation
 * DATA ONLY - all instructions are in blocks
 * Placeholders: {{foundationalTitle}}, {{foundationalCovers}}, {{foundationalFutureAdditions}}, {{foundationalNotIncluded}}, {{sources}}, {{libraryContext}}
 */
export const foundationalCreationUserPrompt = `{{libraryContext}}

## Foundational Scope (Pre-Defined)

Title: {{foundationalTitle}}

Covers: {{foundationalCovers}}

Future Additions:
{{foundationalFutureAdditions}}

Not Included:
{{foundationalNotIncluded}}

## Source Materials

{{sources}}`;

// =============================================================================
// FOUNDATIONAL SKILL UPDATE (ADDITIVE)
// =============================================================================

export const foundationalAdditiveUpdateComposition: PromptComposition = {
  context: 'foundational_additive_update',
  name: 'Foundational Skill Update (Additive)',
  description: 'Update a foundational skill by extracting and appending scope-relevant content from new sources only.',
  category: 'foundational',
  usedBy: [
    { feature: 'Foundational Skill Update', location: 'skill-orchestrator.ts', type: 'internal' },
    { feature: 'Skill Update API', location: '/api/v2/skills/[id]/update', type: 'api' },
  ],
  blockIds: [
    'role_skill_update',
    'task_framing_foundational_update',
    'source_fidelity',
    'citation_format',
    'skill_content_structure',
    'skill_citation_embedding',
    'skill_list_completeness',
    'skill_update_structure',
    'scope_definition',
    'contradiction_detection',
    'diff_output',
    'json_output',
  ],
  outputFormat: 'json',
  outputSchema: `{
  "content": "string - Full content (existing + new extracts) with citations",
  "summary": "string - Updated summary",
  "changes": {
    "sectionsAdded": ["string[] - New sections added from extractions"],
    "sectionsUpdated": ["string[] - Sections where content was appended"],
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
  "extractedContent": [{
    "sourceId": "string - Source ID",
    "extracted": "string - What was extracted from this source"
  }]
}`,
};

/**
 * User prompt template for foundational skill additive update
 * DATA ONLY - all instructions are in blocks
 * Placeholders:
 *   {{existingTitle}} - Title of the existing skill
 *   {{existingContent}} - Current skill content
 *   {{scopeDefinition}} - Current scope definition text
 *   {{existingCitations}} - Format: "[1] Label\n[2] Label\n[3] Label"
 *   {{newSources}} - New source materials to extract from
 */
export const foundationalAdditiveUpdateUserPrompt = `## Existing Foundational Skill

Title: {{existingTitle}}

Content:
{{existingContent}}

Scope Definition:
{{scopeDefinition}}

Existing Citations:
{{existingCitations}}

## New Source Material (Extract Scope-Relevant Content Only)

{{newSources}}`;

// =============================================================================
// EXPORT ALL COMPOSITIONS
// =============================================================================

export const foundationalCompositions: PromptComposition[] = [
  foundationalCreationComposition,
  foundationalAdditiveUpdateComposition,
];
