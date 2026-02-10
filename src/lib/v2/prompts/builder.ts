/**
 * V2 Prompt Builder
 *
 * Assembles prompts from blocks and compositions.
 */

import type { LibraryId } from '@/types/v2';
import type { PromptBlock, PromptComposition, PromptContext, BuiltPrompt, BuildPromptOptions } from './types';
import { getBlocks, getBlock, coreBlocks } from './blocks';
import { getComposition, allCompositions } from './compositions';
import {
  skillCreationUserPrompt,
  skillUpdateUserPrompt,
  skillMatchingUserPrompt,
  skillFormatRefreshUserPrompt,
} from './compositions/skill-compositions';
import {
  foundationalCreationUserPrompt,
  foundationalAdditiveUpdateUserPrompt,
} from './compositions/foundational-compositions';
import { getLibraryGuidelineBlockId } from './blocks/library-guideline-blocks';
import { throwCompositionNotFound } from './errors';

// =============================================================================
// LIBRARY-SPECIFIC CONTEXT (LEGACY - Now mostly read from registry)
// =============================================================================

/**
 * Library-specific context that gets injected into prompts.
 *
 * @deprecated For skill-building libraries (knowledge, it, gtm, customers), use
 * the registry blocks instead. See: library-guideline-blocks.ts
 *
 * getLibraryContext() now reads from registry blocks first, falling back to this
 * for non-skill libraries (prompts, personas, templates, views).
 */
export const LIBRARY_CONTEXT: Record<LibraryId, string> = {
  knowledge: `LIBRARY: General Knowledge

KNOWLEDGE LIBRARY SPECIFICS:
- Focus on product capabilities, features, and technical details
- Include version numbers and release information when available
- Document integrations and API details
- Include practical examples and use cases

SCOPE CLARITY FOR SECURITY/COMPLIANCE CONTENT:
- If content describes INTERNAL CONTROLS (how the company operates), make this clear with headers like '## Internal Security Controls' or '## Internal Processes'
- If content describes PRODUCT FEATURES (what customers can use), make this clear with headers like '## Product Security Features' or '## Customer-Facing Capabilities'
- This prevents confusion when answering 'Does your application encrypt data?' vs 'How do you handle data internally?'

FUTURE ADDITIONS GUIDANCE:
When defining futureAdditions, think about:
- New product releases or feature announcements
- Updated API versions or endpoints
- New integration capabilities
- Additional compliance certifications or security updates
- Performance benchmarks or technical specifications`,

  it: `LIBRARY: IT Support

IT LIBRARY SPECIFICS:
- Include application/system names explicitly
- Capture error codes, symptoms, and diagnostic steps
- Document resolution steps in clear, actionable sequence
- Note which department or team owns this knowledge
- Reference Zendesk ticket patterns and common issues
- Include escalation paths when relevant
- Focus on troubleshooting workflows

FUTURE ADDITIONS GUIDANCE:
When defining futureAdditions, think about:
- New error codes or system behaviors not yet documented
- Additional troubleshooting steps or diagnostic procedures
- Updated escalation contacts or team ownership changes
- New platforms, versions, or system configurations
- Workarounds or temporary solutions that may become permanent`,

  gtm: `LIBRARY: Go-to-Market

GTM LIBRARY SPECIFICS:
- Note industry vertical relevance (Financial Services, Healthcare, etc.)
- Capture deal stage applicability (Discovery, Evaluation, Negotiation)
- Document competitor mentions and positioning strategies
- Include objection handling patterns with suggested responses
- Capture win/loss insights and proof points
- Include relevant case study references
- Focus on patterns that apply across multiple customers

FUTURE ADDITIONS GUIDANCE:
When defining futureAdditions, think about:
- New competitor responses or positioning updates
- Additional objection handling strategies or counterarguments
- Fresh case studies or proof points for this vertical
- Emerging market trends or customer pain points
- Updated customer testimonials or win patterns`,

  talent: `LIBRARY: Talent Acquisition

TALENT LIBRARY SPECIFICS:
- Focus on recruiting processes, hiring practices, and talent management
- Document interview processes and evaluation criteria
- Include job description templates and requirements
- Capture onboarding workflows and procedures
- Note compensation and benefits information
- Reference hiring tools and platforms used
- Include diversity and inclusion initiatives

FUTURE ADDITIONS GUIDANCE:
When defining futureAdditions, think about:
- New job roles or position requirements
- Updated interview questions or evaluation rubrics
- Additional recruiting channels or sourcing strategies
- Changes to compensation structures or benefits
- New onboarding materials or training programs
- Updated hiring policies or compliance requirements`,

  customers: `LIBRARY: Customer Profiles

CUSTOMER LIBRARY SPECIFICS:
- This is a customer-specific skill/profile scoped to a single customer
- Include customer name and context naturally in content
- Capture customer-specific pain points, use cases, and requirements
- Note which products/features this customer uses
- Reference relevant interactions (Gong calls, support tickets, etc.)
- Can build on org-level knowledge but adds customer-specific lens
- Keep separate from org-wide GTM skills (those are for patterns across customers)

FUTURE ADDITIONS GUIDANCE:
When defining futureAdditions, think about:
- New use cases discovered in customer interactions
- Updated product feature adoptions or roadmap requests
- Additional customer pain points or strategic initiatives
- New contacts or organizational changes at the customer
- Emerging opportunities or expansion vectors`,

  prompts: `LIBRARY: Prompts

PROMPT LIBRARY SPECIFICS:
- Focus on the prompt's use case and target model
- Document required and optional variables
- Include example inputs and expected outputs
- Note any performance metrics or A/B test results`,

  personas: `LIBRARY: Personas

PERSONA LIBRARY SPECIFICS:
- Define communication tone and style clearly
- Specify target audience characteristics
- Include "always do" and "never do" guidelines
- Provide example responses for consistency`,

  templates: `LIBRARY: Templates

TEMPLATE LIBRARY SPECIFICS:
- Define output format and structure
- Document all required sections
- Specify variables and their types
- Include example completed output`,

  views: `LIBRARY: Analysis Views

ANALYSIS VIEW SPECIFICS:
- Define the purpose of this analysis view
- Specify which prompt composition generates the content
- Document the intended output format and structure
- Note target audience and use case
- Include example outputs or preview
- Capture display order and presentation preferences`,
};

/**
 * Customer-specific context for skills scoped to a particular customer
 */
const CUSTOMER_SKILL_CONTEXT = `CUSTOMER-SPECIFIC SKILL:
- This skill is scoped to a specific customer
- Include customer name and context naturally in content
- Capture customer-specific pain points, use cases, and requirements
- Note which products/features this customer uses
- Reference relevant interactions (Gong calls, support tickets, etc.)
- Can build on org-level knowledge but adds customer-specific lens
- Keep separate from org-wide GTM skills (those are for patterns across customers)`;

/**
 * Get the library-specific context for a given library.
 * Now reads from the prompt registry blocks instead of hardcoded LIBRARY_CONTEXT.
 */
export function getLibraryContext(libraryId: LibraryId): string {
  // First try to get from registry blocks (the new way)
  const blockId = getLibraryGuidelineBlockId(libraryId);
  if (blockId) {
    const block = getBlock(blockId);
    if (block) {
      return block.content;
    }
  }

  // Fallback to hardcoded LIBRARY_CONTEXT for libraries without guideline blocks
  // (prompts, personas, templates, views - these aren't skill-building libraries)
  return LIBRARY_CONTEXT[libraryId] || '';
}

/**
 * Get customer skill context
 */
export function getCustomerSkillContext(): string {
  return CUSTOMER_SKILL_CONTEXT;
}

// =============================================================================
// PROMPT BUILDING
// =============================================================================

/**
 * Build a system prompt from blocks for a given composition
 */
export function buildSystemPrompt(
  blocks: PromptBlock[],
  composition: PromptComposition
): string {
  const parts: string[] = [];

  // Add blocks in order
  for (const blockId of composition.blockIds) {
    const block = blocks.find(b => b.id === blockId);
    if (!block) {
      console.warn(`Block not found: ${blockId}`);
      continue;
    }

    if (block.content.trim()) {
      parts.push(`## ${block.name}\n\n${block.content}`);
    }
  }

  // Add output schema if JSON format
  if (composition.outputFormat === 'json' && composition.outputSchema) {
    parts.push(`## Expected Output Schema\n\n\`\`\`json\n${composition.outputSchema}\n\`\`\``);
  }

  return parts.join('\n\n');
}

/**
 * Get the user prompt template for a context
 */
export function getUserPromptTemplate(context: PromptContext): string {
  switch (context) {
    case 'skill_creation':
      return skillCreationUserPrompt;
    case 'skill_update':
      return skillUpdateUserPrompt;
    case 'skill_matching':
      return skillMatchingUserPrompt;
    case 'skill_format_refresh':
      return skillFormatRefreshUserPrompt;
    case 'foundational_creation':
      return foundationalCreationUserPrompt;
    case 'foundational_additive_update':
      return foundationalAdditiveUpdateUserPrompt;
    default:
      return 'Please process the following content:\n\n{{content}}';
  }
}

/**
 * Build a complete prompt for a given context
 */
export function buildPrompt(options: BuildPromptOptions): BuiltPrompt {
  const composition = getComposition(options.context);

  if (!composition) {
    throwCompositionNotFound(options.context);
  }

  // Get blocks for this composition
  const blocks = getBlocks(composition.blockIds);

  // Build system prompt
  let systemPrompt = buildSystemPrompt(blocks, composition);

  // Add library-specific context if libraryId provided
  if (options.libraryId) {
    const libraryContext = getLibraryContext(options.libraryId);
    if (libraryContext) {
      systemPrompt += `\n\n## Library Context\n\n${libraryContext}`;
    }
  }

  // Add customer skill context if this is a customer-scoped skill
  if (options.isCustomerSkill) {
    systemPrompt += `\n\n## Customer Skill Context\n\n${CUSTOMER_SKILL_CONTEXT}`;
  }

  // Add additional context if provided
  if (options.additionalContext) {
    systemPrompt += `\n\n## Additional Context\n\n${options.additionalContext}`;
  }

  // Get user prompt template
  const userPromptTemplate = getUserPromptTemplate(options.context);

  return {
    systemPrompt,
    userPromptTemplate,
    compositionId: composition.context,
    blocksUsed: composition.blockIds,
    outputFormat: composition.outputFormat,
  };
}

/**
 * Build a complete prompt from a composition object directly (bypasses lookup)
 * Use this when you need to pass a dynamically-generated composition
 */
export function buildPromptFromComposition(
  composition: PromptComposition,
  options?: {
    libraryId?: LibraryId;
    isCustomerSkill?: boolean;
    additionalContext?: string;
  }
): BuiltPrompt {
  // Get blocks for this composition
  const blocks = getBlocks(composition.blockIds);

  // Build system prompt
  let systemPrompt = buildSystemPrompt(blocks, composition);

  // Add library-specific context if libraryId provided
  if (options?.libraryId) {
    const libraryContext = getLibraryContext(options.libraryId);
    if (libraryContext) {
      systemPrompt += `\n\n## Library Context\n\n${libraryContext}`;
    }
  }

  // Add customer skill context if this is a customer-scoped skill
  if (options?.isCustomerSkill) {
    systemPrompt += `\n\n## Customer Skill Context\n\n${CUSTOMER_SKILL_CONTEXT}`;
  }

  // Add additional context if provided
  if (options?.additionalContext) {
    systemPrompt += `\n\n## Additional Context\n\n${options.additionalContext}`;
  }

  // Get user prompt template
  const userPromptTemplate = getUserPromptTemplate(composition.context);

  return {
    systemPrompt,
    userPromptTemplate,
    compositionId: composition.context,
    blocksUsed: composition.blockIds,
    outputFormat: composition.outputFormat,
  };
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Build prompt for skill creation
 */
export function buildSkillCreationPrompt(options?: {
  libraryId?: LibraryId;
  isCustomerSkill?: boolean;
  additionalContext?: string;
}): BuiltPrompt {
  return buildPrompt({
    context: 'skill_creation',
    libraryId: options?.libraryId,
    isCustomerSkill: options?.isCustomerSkill,
    additionalContext: options?.additionalContext,
  });
}

/**
 * Build prompt for skill update
 */
export function buildSkillUpdatePrompt(options?: {
  libraryId?: LibraryId;
  isCustomerSkill?: boolean;
  additionalContext?: string;
}): BuiltPrompt {
  return buildPrompt({
    context: 'skill_update',
    libraryId: options?.libraryId,
    isCustomerSkill: options?.isCustomerSkill,
    additionalContext: options?.additionalContext,
  });
}

/**
 * Build prompt for skill matching
 */
export function buildSkillMatchingPrompt(options?: {
  libraryId?: LibraryId;
  additionalContext?: string;
}): BuiltPrompt {
  return buildPrompt({
    context: 'skill_matching',
    libraryId: options?.libraryId,
    additionalContext: options?.additionalContext,
  });
}

/**
 * Build prompt for skill format refresh
 */
export function buildSkillFormatRefreshPrompt(options?: {
  libraryId?: LibraryId;
  additionalContext?: string;
}): BuiltPrompt {
  return buildPrompt({
    context: 'skill_format_refresh',
    libraryId: options?.libraryId,
    additionalContext: options?.additionalContext,
  });
}

// =============================================================================
// USER PROMPT HELPERS
// =============================================================================

/**
 * Fill placeholders in user prompt template
 */
export function fillUserPrompt(template: string, variables: Record<string, string>): string {
  let filled = template;
  for (const [key, value] of Object.entries(variables)) {
    filled = filled.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return filled;
}

/**
 * Format sources for skill creation prompt
 */
export function formatSourcesForPrompt(sources: Array<{
  id: string;
  type: string;
  label: string;
  url?: string;
  content: string;
}>): string {
  // Truncate content to prevent token limit exceed (~8k chars per source is ~2k tokens)
  // This allows for multiple sources while staying well under Claude's 200k limit
  const MAX_SOURCE_CHARS = 8000;

  return sources.map((source, index) => {
    const citationNum = index + 1;
    const urlLine = source.url ? `URL: ${source.url}\n` : '';

    // Truncate content if it exceeds the limit
    let contentToUse = source.content;
    let isTruncated = false;

    if (contentToUse && contentToUse.length > MAX_SOURCE_CHARS) {
      contentToUse = contentToUse.substring(0, MAX_SOURCE_CHARS);
      isTruncated = true;
    }

    const truncationNote = isTruncated
      ? `\n\n[Content truncated at ${MAX_SOURCE_CHARS} characters for token limit management]`
      : '';

    return `### Source [${citationNum}]: ${source.label}
Type: ${source.type}
${urlLine}ID: ${source.id}

${contentToUse}${truncationNote}`;
  }).join('\n\n---\n\n');
}

/**
 * Format skill scopes for matching prompt
 */
export function formatSkillScopesForPrompt(skills: Array<{
  id: string;
  title: string;
  scopeDefinition?: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
}>): string {
  return skills.map(skill => {
    const scope = skill.scopeDefinition;
    if (!scope) {
      return `### ${skill.title}
ID: ${skill.id}
Scope: Not defined`;
    }

    return `### ${skill.title}
ID: ${skill.id}
Covers: ${scope.covers}
Future Additions: ${scope.futureAdditions.join(', ')}
Not Included: ${scope.notIncluded?.join(', ') || 'Not specified'}`;
  }).join('\n\n');
}

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Get estimated token count for a composition's system prompt.
 * This accounts for all blocks in the composition assembled together.
 *
 * @param compositionId - The composition context (e.g., 'rfp_batch', 'chat_response')
 * @returns Token count estimate, or 0 if composition not found
 */
export function getCompositionTokenCount(compositionId: PromptContext): number {
  const composition = getComposition(compositionId);
  if (!composition) return 0;

  const blocks = getBlocks(composition.blockIds);
  // Sum block tokens (already computed by getBlocks)
  return blocks.reduce((sum, b) => sum + b.tokens, 0);
}

/**
 * Get detailed token breakdown for a composition.
 * Useful for transparency UI showing what contributes to prompt size.
 */
export function getCompositionTokenBreakdown(compositionId: PromptContext): {
  total: number;
  blocks: Array<{ id: string; name: string; tokens: number }>;
} | null {
  const composition = getComposition(compositionId);
  if (!composition) return null;

  const blocks = getBlocks(composition.blockIds);
  const breakdown = blocks.map(b => ({
    id: b.id,
    name: b.name,
    tokens: b.tokens, // Already computed by getBlocks
  }));

  return {
    total: breakdown.reduce((sum, b) => sum + b.tokens, 0),
    blocks: breakdown,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  coreBlocks,
  allCompositions,
  getComposition,
};
