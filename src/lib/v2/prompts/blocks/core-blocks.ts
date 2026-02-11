/**
 * V2 Core Prompt Blocks
 *
 * Reusable building blocks for prompt composition.
 * Each block has ONE definition - no variants.
 * Different compositions use different blocks.
 */

import type { PromptBlock, PromptBlockWithTokens } from '../types';
import { estimateTokens } from '@/lib/tokenUtils';
import {
  chatRoleBlock,
  chatSourcePriorityBlock,
  chatQualityChecksBlock,
  chatConfidenceLevelsBlock,
  chatOutputFormatBlock,
  rfpRoleBlock,
  rfpSourcePriorityBlock,
  rfpQualityBlock,
  rfpScopeValidationBlock,
  rfpConfidenceLevelsBlock,
  rfpJsonOutputBlock,
  batchJsonInstructionBlock,
  rfpSingleQuestionSchemaBlock,
  rfpBatchQuestionsSchemaBlock,
} from './chat-blocks';
import {
  promptEngineerRoleBlock,
  promptAnalysisRulesBlock,
  promptOptimizerRoleBlock,
  optimizationPrioritiesBlock,
} from './utility-blocks';
import { customerViewBlocks } from './customer-view-blocks';
import { libraryGuidelineBlocks } from './library-guideline-blocks';
import { slackBotBlocks } from './slack-bot-role-blocks';
import { pdfExtractionBlocks } from './pdf-extraction-blocks';
import { contractAnalysisBlocks } from './contract-analysis-blocks';
import { skillTaskBlocks } from './skill-task-blocks';
import { skillOutputBlocks } from './skill-output-blocks';
import { modeTaskBlocks } from './mode-task-blocks';
import { collateralBlocks } from './collateral-blocks';

// =============================================================================
// FOUNDATION BLOCKS (Tier 1 - Locked)
// =============================================================================

export const sourceFidelityBlock: PromptBlock = {
  id: 'source_fidelity',
  name: 'Source Fidelity',
  description: 'Critical rules for extracting content only from provided sources.',
  tier: 1,
  content: `SOURCE FIDELITY (CRITICAL):
- ONLY include information directly found in the provided sources
- DO NOT fabricate, hallucinate, or infer technical details not explicitly stated
- When a source says "we have X", don't expand it into implementation specifics
- Rich sources produce rich content; sparse sources produce brief content
- It's better to be accurate and brief than padded with assumptions
- If information contradicts between sources, note it explicitly

COMPLETE LISTS - NEVER TRUNCATE:
- When a source contains a list of items (features, platforms, integrations, error codes, etc.), include ALL of them
- Never say "X, Y, Z, and more" or "including X, Y, Z"
- List everything the source provides - this completeness is critical for accuracy`,
};

export const jsonOutputBlock: PromptBlock = {
  id: 'json_output',
  name: 'JSON Output Rules',
  description: 'Standard rules for contexts that require JSON responses.',
  tier: 1,
  content: `OUTPUT FORMAT:
Return ONLY valid JSON. No text before or after. No markdown code fences. No explanatory text.
Ensure all strings are properly escaped and the JSON is parseable.`,
};

export const citationFormatBlock: PromptBlock = {
  id: 'citation_format',
  name: 'Citation Format',
  description: 'How to create inline citations that link back to sources.',
  tier: 1,
  content: `SOURCE CITATIONS:
- ASSIGN A UNIQUE NUMBER TO EACH SOURCE. Use [1], [2], [3], etc.
- Add citations after facts extracted from specific sources
- Each citation number must correspond to exactly one source
- Citations help verify information against original sources
- Use citations especially for: technical details, version numbers, specific capabilities, processes
- Keep citations clean and non-disruptive to reading flow
- Example with 2 sources: "The API supports rate limits of 1000 requests/minute. [1] Authentication uses OAuth 2.0. [2]"

CRITICAL CITATION RULES:
1. FIRST, map each input source to a citation number (Source 1 → [1], Source 2 → [2], etc.)
2. Use the SAME citation number EVERY TIME you reference that source
3. Never reuse the same citation number for different sources
4. Include ALL sources used - don't leave any sources without citations
5. FOR SKILL UPDATES: If updating an existing skill with new sources, preserve the citation numbers from existing citations. Map the existing source IDs to their existing citation numbers, and assign new sequential numbers to new sources (e.g., if existing has [1] and [2], assign [3], [4], etc. to new sources).

EMBEDDED SOURCES SECTION:
Skills now embed a "## Sources" section at the end of content listing all sources with their citation numbers.
This makes skills self-contained - the content can be used independently without needing separate citations metadata.

CITATION OUTPUT:
For each source used, include in the citations array:
- id: The unique citation number (e.g., "1", "2", "3")
- sourceId: The exact source ID from the input
- label: Display label - for URL sources use the actual URL, for others use document title or "Slack thread", ticket number, etc.
- url: Direct link if available (for URL sources; prefer .com domains when available for primary sources)

Additionally, embed these sources in the content under a "## Sources" section (see CONTENT FORMAT in the skill creation/update prompts).`,
};

// =============================================================================
// SKILL BUILDING BLOCKS (Tier 2 - Caution)
// =============================================================================

export const skillPrinciplesBlock: PromptBlock = {
  id: 'skill_principles',
  name: 'Skill Library Principles',
  description: 'Guidelines for building comprehensive, non-bloated skills.',
  tier: 2,
  content: `SKILL LIBRARY PHILOSOPHY:
- Build comprehensive skills that cover BROAD CAPABILITY AREAS
- Think of skills like chapters in a book, not individual pages
- Examples: "Security & Compliance", "Data Platform", "Integrations & APIs"

CONSOLIDATION BIAS:
- STRONGLY prefer updating existing skills over creating new ones
- Only create a new skill if content is genuinely unrelated to ALL existing skills
- A "Security" skill absorbs encryption, access control, compliance content
- An "Integrations" skill absorbs APIs, webhooks, SSO, authentication content

CONTENT DEPTH:
- Multi-source skills: 2000-5000+ characters of substantive content
- Single-source skills: 1000-3000+ characters
- If under 1000 chars, you're summarizing too much - include more details
- Include ALL facts, numbers, versions, capabilities from sources
- Full lists (never "X, Y, and more") - list everything`,
};

export const scopeDefinitionBlock: PromptBlock = {
  id: 'scope_definition',
  name: 'Scope Definition',
  description: 'How to define what a skill covers and what should be added later.',
  tier: 2,
  content: `SCOPE DEFINITION:
Every skill MUST include a scope definition that answers:
1. "covers": What does this skill currently cover? (1-2 sentences)
2. "futureAdditions": What types of content SHOULD be added to this skill later?
   - Be specific: "New API endpoints", "Additional error codes", "Updated compliance certifications"
   - Think about what would naturally extend this topic
3. "notIncluded": What should explicitly NOT be in this skill? (prevents bloat)
   - Clarify boundaries: "Usage tutorials (separate skill)", "Pricing (separate skill)"

GOOD SCOPE EXAMPLE:
{
  "covers": "Technical specifications and capabilities of the AI platform including supported models, rate limits, and integration points.",
  "futureAdditions": ["New model releases", "Updated rate limits", "New API endpoints", "Performance benchmarks"],
  "notIncluded": ["Getting started tutorials", "Pricing information", "Customer case studies"]
}

BOUNDARY CLARITY EXAMPLE:
{
  "covers": "OAuth 2.0 authentication implementation including token management, refresh flows, and error handling.",
  "futureAdditions": ["Additional OAuth providers", "Token encryption methods", "Single sign-on integration patterns"],
  "notIncluded": ["User password management (separate 'User Management' skill)", "API rate limiting (separate 'API Infrastructure' skill)", "Frontend authentication UI (separate 'UI Components' skill)"]
}

The scope definition is used to:
- Decide if new sources belong in this skill
- Prevent skill bloat by having clear boundaries
- Guide future content additions`,
};

export const contradictionDetectionBlock: PromptBlock = {
  id: 'contradiction_detection',
  name: 'Contradiction Detection',
  description: 'How to identify and report conflicts between sources.',
  tier: 2,
  content: `CONTRADICTION DETECTION:
When analyzing multiple sources, actively look for contradictions:

- Technical contradictions: Different specs, capabilities, or behaviors stated
  Example: Source A says "supports 10 concurrent connections" but Source B says "supports 5 concurrent connections"

- Version mismatches: Different version numbers or release dates
  Example: Source A references "API v2.0" but Source B shows features only in "API v3.0"

- Outdated vs current: One source has newer info that supersedes another
  Example: Source A from 2023 says feature is "planned" but Source B from 2024 says it's "released"

- Scope mismatches: Sources describe different scopes of the same feature
  Example: Source A describes basic tier limitations but Source B describes enterprise tier capabilities

WHEN CONTRADICTION FOUND:
1. The skill content should reflect the MOST CURRENT/ACCURATE information
2. Report the contradiction in the "contradictions" array with:
   - type: Category of contradiction
   - description: What exactly conflicts
   - sourceA/sourceB: The conflicting sources with excerpts
   - severity: low/medium/high based on impact
   - recommendation: How to resolve (e.g., "Update docs at [URL] to reflect v2.0")

This helps teams identify documentation that needs updating.`,
};

export const diffOutputBlock: PromptBlock = {
  id: 'diff_output',
  name: 'Diff Output',
  description: 'How to report what changed when updating a skill.',
  tier: 2,
  content: `CHANGE TRACKING:
When updating an existing skill, clearly report what changed:
- sectionsAdded: New sections or topics added to the skill
- sectionsUpdated: Existing sections that were modified
- sectionsRemoved: Sections that were removed (rare - explain why)
- changeSummary: Human-readable summary of changes (2-3 sentences)

SPLIT RECOMMENDATION:
If the updated skill is becoming too broad, recommend splitting:
- shouldSplit: true if skill covers too many unrelated topics
- reason: Why splitting is recommended
- suggestedSkills: Array of {title, scope} for proposed new skills

Prefer updating over splitting. Only recommend split if topics are truly unrelated.`,
};

// =============================================================================
// MATCHING BLOCKS (Tier 2 - Caution)
// =============================================================================

export const skillMatchingBlock: PromptBlock = {
  id: 'skill_matching',
  name: 'Skill Matching',
  description: 'How to match new sources to existing skills using scope definitions.',
  tier: 2,
  content: `SKILL MATCHING:
You will receive:
1. New source content to be incorporated
2. List of existing skills with their scope definitions

Your job is to determine which skill(s) this source belongs to.

MATCHING PROCESS:
1. Read the source content carefully
2. For each skill, check if source matches:
   - The "covers" description
   - Any of the "futureAdditions" criteria
   - NOT in the "notIncluded" list
3. Assign confidence: high/medium/low
4. Explain WHY it matches (which criteria)
5. Suggest what excerpt to use

ONE SOURCE CAN MATCH MULTIPLE SKILLS:
- A Gong call might have customer insights AND objection handling
- A document might cover both API specs AND security compliance
- Extract different excerpts for different skills

IF NO MATCH:
- Recommend creating a new skill
- Suggest title and scope definition for the new skill`,
};

// Slack bot blocks now imported from slack-bot-role-blocks.ts

// =============================================================================
// ROLE BLOCKS (Tier 3 - Open)
// =============================================================================

export const skillCreationRoleBlock: PromptBlock = {
  id: 'role_skill_creation',
  name: 'Skill Creation Role',
  description: 'Role definition for creating new skills.',
  tier: 3,
  content: `You are a knowledge extraction specialist creating comprehensive reference documents from source material.

Your output will be used by:
1. AI systems that need accurate, detailed knowledge to answer questions
2. Humans who want to trace information back to its source

Create skills that are:
- COMPREHENSIVE: Include all relevant facts, not summaries
- TRACEABLE: Every key fact has a citation to its source
- BOUNDED: Clear scope of what's included and excluded
- EXTENSIBLE: Scope definition guides future additions

INCLUDE A '## Common Questions' SECTION:
Add the most important questions this skill answers, with brief answers. Include as many as genuinely belong (could be 1-2 for narrow topics, or 8-10 for broad ones). This helps match skills to incoming questions and makes skills self-documenting.

IMPORTANT: If the source materials already contain a Q&A section (very common in URLs and documentation), include ALL of those questions and answers verbatim or minimally adapted.

Example format:
  ## Common Questions
  **Q: Do you encrypt data at rest?**
  A: Yes, using AES-256 encryption.
  **Q: What compliance certifications do you have?**
  A: SOC 2 Type II, ISO 27001, GDPR compliant.
  **Q: How do you handle key rotation?**
  A: Automatic annual rotation with on-demand rotation available.`,
};

export const skillUpdateRoleBlock: PromptBlock = {
  id: 'role_skill_update',
  name: 'Skill Update Role',
  description: 'Role definition for updating existing skills.',
  tier: 3,
  content: `You are a knowledge maintenance specialist updating existing skills with new information.

Your job is to:
1. Integrate new source content into the existing skill
2. Preserve existing valuable content (don't remove without reason)
3. Maintain citation integrity (add new citations, keep relevant old ones)
4. Detect contradictions between old and new information
5. Report what changed clearly for review

Bias toward minimal changes. Only modify what the new source warrants.`,
};

export const skillMatchingRoleBlock: PromptBlock = {
  id: 'role_skill_matching',
  name: 'Skill Matching Role',
  description: 'Role definition for matching sources to skills.',
  tier: 3,
  content: `You are a knowledge organization specialist routing new content to the right skills.

Your job is to:
1. Analyze incoming source content
2. Match it to existing skills based on their scope definitions
3. Identify multiple matches when content spans topics
4. Recommend new skills only when truly necessary

Bias toward matching existing skills. The knowledge base should stay consolidated.`,
};

export const skillFormatRefreshRoleBlock: PromptBlock = {
  id: 'role_skill_format_refresh',
  name: 'Skill Format Refresh Role',
  description: 'Role definition for reformatting existing skills to current standards.',
  tier: 3,
  content: `You are a documentation standards specialist updating skills to current format standards.

Your job is to:
1. REFORMAT the existing skill content to match current documentation standards
2. Preserve ALL factual knowledge and key information from the existing skill
3. Reorganize structure and sections for better clarity and consistency
4. Ensure proper section formatting (## Scope Definition, ## Sources)
5. Verify and standardize citations for consistency ([1], [2], [3], etc.)
6. Report what changed structurally (formatting improvements, section reorganization)

DO NOT:
- Remove valuable content
- Change facts or accuracy
- Omit citations
- Reduce comprehensiveness

ALWAYS:
- Regenerate the full content through current format standards (don't just validate it)
- Include all required sections (main content, Scope Definition, Sources)
- Maintain citation integrity with correct numbering`,
};


// =============================================================================
// EXPORT ALL BLOCKS
// =============================================================================

export const coreBlocks: PromptBlock[] = [
  // Foundation (Tier 1)
  sourceFidelityBlock,
  jsonOutputBlock,
  citationFormatBlock,
  // Chat & RFP (Tier 1)
  chatOutputFormatBlock,
  rfpJsonOutputBlock,
  batchJsonInstructionBlock,
  rfpSingleQuestionSchemaBlock,
  rfpBatchQuestionsSchemaBlock,
  // Customer View Blocks (all roles, frameworks, and output formats)
  ...customerViewBlocks,
  // Skill Output Structure (Tier 1)
  ...skillOutputBlocks,
  // Skill Building (Tier 2)
  skillPrinciplesBlock,
  scopeDefinitionBlock,
  contradictionDetectionBlock,
  diffOutputBlock,
  skillMatchingBlock,
  // Skill Task Framing (Tier 2)
  ...skillTaskBlocks,
  // Mode-Specific Task Framing (Tier 2)
  ...modeTaskBlocks,
  // Chat & RFP Quality (Tier 2)
  chatQualityChecksBlock,
  rfpQualityBlock,
  rfpScopeValidationBlock,
  // Utility Analysis (Tier 2)
  promptAnalysisRulesBlock,
  optimizationPrioritiesBlock,
  // Chat & RFP Source Management (Tier 2)
  chatSourcePriorityBlock,
  rfpSourcePriorityBlock,
  // Chat & RFP Confidence (Tier 2)
  chatConfidenceLevelsBlock,
  rfpConfidenceLevelsBlock,
  // Roles (Tier 3)
  skillCreationRoleBlock,
  skillUpdateRoleBlock,
  skillMatchingRoleBlock,
  skillFormatRefreshRoleBlock,
  chatRoleBlock,
  rfpRoleBlock,
  promptEngineerRoleBlock,
  promptOptimizerRoleBlock,
  // Imported from specialized block files
  ...libraryGuidelineBlocks,
  ...slackBotBlocks,
  ...pdfExtractionBlocks,
  ...contractAnalysisBlocks,
  ...collateralBlocks,
];

/**
 * Add computed token count to a block
 */
function withTokens(block: PromptBlock): PromptBlockWithTokens {
  return {
    ...block,
    tokens: block.tokens ?? estimateTokens(block.content),
  };
}

/**
 * Get a block by ID (with computed token count)
 */
export function getBlock(id: string): PromptBlockWithTokens | undefined {
  const block = coreBlocks.find(b => b.id === id);
  return block ? withTokens(block) : undefined;
}

/**
 * Get multiple blocks by IDs, in order (with computed token counts)
 */
export function getBlocks(ids: string[]): PromptBlockWithTokens[] {
  return ids.map(id => getBlock(id)).filter((b): b is PromptBlockWithTokens => b !== undefined);
}
