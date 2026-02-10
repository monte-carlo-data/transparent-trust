/**
 * V2 Skill Generation Service
 *
 * Orchestrates LLM-based skill creation, updates, and matching.
 * Uses the v2 prompt system with library-specific context.
 */

import { getAnthropicClient } from '@/lib/apiHelpers';
import { CLAUDE_MODEL, LLM_PARAMS, getMaxTokensForSpeed } from '@/lib/config';
import { circuitBreakers } from '@/lib/circuitBreaker';
import { logUsage } from '@/lib/usageTracking';
import { validateScopeDefinition } from '@/lib/v2/skills/scope-validator';
import type { LibraryId, SkillType } from '@/types/v2';
import type {
  SkillCreationOutput,
  SkillUpdateOutput,
  SkillMatchingOutput,
  SkillFormatRefreshOutput,
} from '@/lib/v2/prompts/types';
import {
  buildSkillMatchingPrompt,
  buildSkillFormatRefreshPrompt,
  buildPrompt,
  buildPromptFromComposition,
  fillUserPrompt,
  formatSourcesForPrompt,
  formatSkillScopesForPrompt,
} from '@/lib/v2/prompts';
import { getSkillCreationComposition, getSkillUpdateComposition } from '@/lib/v2/prompts/compositions/skill-compositions';
import type { RefreshMode } from '@/types/v2';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for creating a new skill
 */
export interface CreateSkillInput {
  sources: Array<{
    id: string;
    type: string;
    label: string;
    content: string;
  }>;
  libraryId: LibraryId;
  skillType?: SkillType;
  isCustomerSkill?: boolean;
  customerName?: string;
  additionalContext?: string;
}

/**
 * Input for updating an existing skill
 */
export interface UpdateSkillInput {
  existingSkill: {
    title: string;
    content: string;
    scopeDefinition?: {
      covers: string;
      futureAdditions: string[];
      notIncluded?: string[];
    };
    citations?: Array<{
      id: string;
      sourceId: string;
      label: string;
      url?: string;
    }>;
  };
  newSources: Array<{
    id: string;
    type: string;
    label: string;
    url?: string;
    content: string;
  }>;
  libraryId: LibraryId;
  skillType?: SkillType;
  isCustomerSkill?: boolean;
  additionalContext?: string;
  /** Refresh mode: 'regenerative' reprocesses all, 'additive' only appends new */
  refreshMode?: RefreshMode;
}

/**
 * Input for matching sources to skills
 */
export interface MatchSourceInput {
  source: {
    id: string;
    type: string;
    label: string;
    content: string;
  };
  existingSkills: Array<{
    id: string;
    title: string;
    scopeDefinition?: {
      covers: string;
      futureAdditions: string[];
      notIncluded?: string[];
    };
  }>;
  libraryId: LibraryId;
  additionalContext?: string;
}

/**
 * Input for reformatting an existing skill through current format standards
 */
export interface ReformatSkillInput {
  existingSkill: {
    title: string;
    content: string;
    scopeDefinition?: {
      covers: string;
      futureAdditions: string[];
      notIncluded?: string[];
    };
    citations?: Array<{
      id: string;
      sourceId: string;
      label: string;
      url?: string;
    }>;
  };
  allSources: Array<{
    id: string;
    type: string;
    label: string;
    content: string;
  }>;
  libraryId: LibraryId;
  additionalContext?: string;
}

// =============================================================================
// SKILL CREATION
// =============================================================================

/**
 * Generate a new skill from source materials
 */
export async function generateSkill(input: CreateSkillInput): Promise<SkillCreationOutput> {
  try {
    const skillType = input.skillType || 'knowledge';

    // Get the composition for this skill type
    const composition = getSkillCreationComposition(skillType);

    // Build the prompt using the composition
    const prompt = buildPromptFromComposition(composition, {
      libraryId: input.libraryId,
      isCustomerSkill: input.isCustomerSkill,
      additionalContext: input.additionalContext,
    });

    // Capture system prompt for transparency
    const systemPromptUsed = prompt.systemPrompt;

    // Format sources with citation numbers
    const formattedSources = formatSourcesForPrompt(input.sources);

    // Fill in the user prompt
    const userPrompt = fillUserPrompt(prompt.userPromptTemplate, {
      libraryContext: `Library: ${input.libraryId}`,
      sources: formattedSources,
      customerName: input.customerName || '',
    });

    // Call Claude with the prompts
    const anthropic = await getAnthropicClient();
    const response = await circuitBreakers.anthropic.execute(() =>
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: getMaxTokensForSpeed('quality'),
        temperature: LLM_PARAMS.temperature.precise,
        system: prompt.systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      })
    );

    // Log usage for dashboard tracking
    logUsage({
      feature: "skill_creation",
      model: CLAUDE_MODEL,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    });

    // Parse the response
    const content = response.content[0];
    if (content.type !== 'text' || !content.text?.trim()) {
      throw new Error('Claude returned an empty response');
    }

    const output = parseJsonResponse<SkillCreationOutput>(content.text);

    // Validate scope definition in LLM output
    if (output.scopeDefinition) {
      const validationResult = validateScopeDefinition(output.scopeDefinition);
      if (!validationResult.success) {
        console.error('Invalid scope definition in LLM output:', validationResult.errors);
        throw new Error(`LLM generated invalid scope definition: ${validationResult.errors.join(', ')}`);
      }
    }

    // Add transparency metadata from the actual prompt object
    return {
      ...output,
      transparency: {
        systemPrompt: systemPromptUsed,
        userPrompt,
        rawResponse: content.text,
        compositionId: prompt.compositionId,
        blockIds: prompt.blocksUsed,
        model: CLAUDE_MODEL,
        tokens: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
        },
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to generate skill: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// =============================================================================
// SKILL UPDATE
// =============================================================================

/**
 * Update an existing skill with new source material
 *
 * @param input.refreshMode - 'regenerative' (default) or 'additive'
 *   - regenerative: Standard update that can modify all content
 *   - additive: Foundational skill update that preserves title/scope and only appends new content
 */
export async function updateSkill(input: UpdateSkillInput): Promise<SkillUpdateOutput> {
  try {
    const refreshMode = input.refreshMode || 'regenerative';
    const skillType = input.skillType || 'knowledge';

    // Select composition based on refresh mode
    const prompt = refreshMode === 'additive'
      ? buildPrompt({
          context: 'foundational_additive_update',
          libraryId: input.libraryId,
          isCustomerSkill: input.isCustomerSkill,
          additionalContext: input.additionalContext,
        })
      : buildPromptFromComposition(getSkillUpdateComposition(skillType), {
          libraryId: input.libraryId,
          isCustomerSkill: input.isCustomerSkill,
          additionalContext: input.additionalContext,
        });

    // Capture system prompt for transparency
    const systemPromptUsed = prompt.systemPrompt;

    // Format new sources
    const formattedSources = formatSourcesForPrompt(input.newSources);

    // Format existing citations for reference
    const citationsList = input.existingSkill.citations
      ?.map((c) => `[${c.id}] ${c.label}${c.url ? ` - ${c.url}` : ''}`)
      .join('\n') || 'None';

    // Format scope definition
    const scopeText = input.existingSkill.scopeDefinition
      ? `Covers: ${input.existingSkill.scopeDefinition.covers}
Future Additions: ${input.existingSkill.scopeDefinition.futureAdditions.join(', ')}
Not Included: ${input.existingSkill.scopeDefinition.notIncluded?.join(', ') || 'Not specified'}`
      : 'No scope definition';

    // Truncate existing content if too large (to stay under token limit)
    const MAX_EXISTING_CONTENT_CHARS = 12000; // ~3k tokens
    const truncatedExistingContent = input.existingSkill.content?.length > MAX_EXISTING_CONTENT_CHARS
      ? input.existingSkill.content.substring(0, MAX_EXISTING_CONTENT_CHARS) + '\n\n[Content truncated for token limit management]'
      : input.existingSkill.content;

    // Fill user prompt
    const userPrompt = fillUserPrompt(prompt.userPromptTemplate, {
      existingTitle: input.existingSkill.title,
      existingContent: truncatedExistingContent,
      scopeDefinition: scopeText,
      existingCitations: citationsList,
      newSources: formattedSources,
    });

    // Call Claude
    const anthropic = await getAnthropicClient();
    const response = await circuitBreakers.anthropic.execute(() =>
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: getMaxTokensForSpeed('quality'),
        temperature: LLM_PARAMS.temperature.precise,
        system: prompt.systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      })
    );

    // Log usage for dashboard tracking
    logUsage({
      feature: refreshMode === 'additive' ? 'skill_update_additive' : 'skill_update',
      model: CLAUDE_MODEL,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text' || !content.text?.trim()) {
      throw new Error('Claude returned an empty response');
    }

    const output = parseJsonResponse<SkillUpdateOutput>(content.text);

    // For additive mode, preserve the original title and scope (don't use LLM output)
    const finalOutput: SkillUpdateOutput = refreshMode === 'additive'
      ? {
          ...output,
          title: input.existingSkill.title,
          scopeDefinition: input.existingSkill.scopeDefinition,
        }
      : output;

    // Add transparency metadata from the actual prompt object
    return {
      ...finalOutput,
      transparency: {
        systemPrompt: systemPromptUsed,
        userPrompt,
        rawResponse: content.text,
        compositionId: prompt.compositionId,
        blockIds: prompt.blocksUsed,
        model: CLAUDE_MODEL,
        tokens: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
        },
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to update skill: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// =============================================================================
// SKILL FORMAT REFRESH
// =============================================================================

/**
 * Regenerate an existing skill through current format standards
 * Uses all incorporated sources to ensure consistency with current format conventions
 */
export async function reformatSkill(input: ReformatSkillInput): Promise<SkillFormatRefreshOutput> {
  try {
    // Build the prompt using format refresh composition
    const prompt = buildSkillFormatRefreshPrompt({
      libraryId: input.libraryId,
      additionalContext: input.additionalContext,
    });

    // Capture system prompt for transparency
    const systemPromptUsed = prompt.systemPrompt;

    // Format all incorporated sources with citation numbers
    const formattedSources = formatSourcesForPrompt(input.allSources);

    // Format scope definition for display
    const scopeText = input.existingSkill.scopeDefinition
      ? `Covers: ${input.existingSkill.scopeDefinition.covers}
Future Additions: ${input.existingSkill.scopeDefinition.futureAdditions?.join(', ') || 'None'}
Not Included: ${input.existingSkill.scopeDefinition.notIncluded?.join(', ') || 'Not specified'}`
      : 'No scope definition';

    // Format citations for display
    const citationsList = input.existingSkill.citations
      ?.map((c) => `[${c.id}] ${c.label}${c.url ? ` - ${c.url}` : ''}`)
      .join('\n') || 'None';

    // Truncate existing content if too large (to stay under token limit)
    const MAX_EXISTING_CONTENT_CHARS = 12000; // ~3k tokens
    const truncatedExistingContent = input.existingSkill.content?.length > MAX_EXISTING_CONTENT_CHARS
      ? input.existingSkill.content.substring(0, MAX_EXISTING_CONTENT_CHARS) + '\n\n[Content truncated for token limit management]'
      : input.existingSkill.content;

    // Fill user prompt with existing skill and all sources
    const userPrompt = fillUserPrompt(prompt.userPromptTemplate, {
      existingTitle: input.existingSkill.title,
      existingContent: truncatedExistingContent,
      scopeDefinition: scopeText,
      existingCitations: citationsList,
      allSources: formattedSources,
    });

    // Call Claude
    const anthropic = await getAnthropicClient();
    const response = await circuitBreakers.anthropic.execute(() =>
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: getMaxTokensForSpeed('quality'),
        temperature: LLM_PARAMS.temperature.precise,
        system: prompt.systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      })
    );

    // Log usage for tracking
    logUsage({
      feature: 'skill_format_refresh',
      model: CLAUDE_MODEL,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text' || !content.text?.trim()) {
      throw new Error('Claude returned an empty response');
    }

    const output = parseJsonResponse<SkillFormatRefreshOutput>(content.text);

    // Add transparency metadata from the actual prompt object
    return {
      ...output,
      transparency: {
        systemPrompt: systemPromptUsed,
        userPrompt,
        rawResponse: content.text,
        compositionId: prompt.compositionId,
        blockIds: prompt.blocksUsed,
        model: CLAUDE_MODEL,
        tokens: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
        },
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to reformat skill: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// =============================================================================
// SKILL MATCHING
// =============================================================================

/**
 * Match a source to existing skills based on scope definitions
 */
export async function matchSourceToSkills(input: MatchSourceInput): Promise<SkillMatchingOutput> {
  try {
    const prompt = buildSkillMatchingPrompt({
      libraryId: input.libraryId,
      additionalContext: input.additionalContext,
    });

    // Format skill scopes
    const formattedSkopes = formatSkillScopesForPrompt(input.existingSkills);

    // Truncate source content if too large (to stay under token limit)
    const MAX_SOURCE_CONTENT_CHARS = 12000; // ~3k tokens
    const truncatedSourceContent = input.source.content?.length > MAX_SOURCE_CONTENT_CHARS
      ? input.source.content.substring(0, MAX_SOURCE_CONTENT_CHARS) + '\n\n[Content truncated for token limit management]'
      : input.source.content;

    // Fill user prompt
    const userPrompt = fillUserPrompt(prompt.userPromptTemplate, {
      sourceId: input.source.id,
      sourceType: input.source.type,
      sourceLabel: input.source.label,
      sourceContent: truncatedSourceContent,
      skillScopes: formattedSkopes,
    });

    // Call Claude
    const anthropic = await getAnthropicClient();
    const response = await circuitBreakers.anthropic.execute(() =>
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: getMaxTokensForSpeed('quality'),
        temperature: LLM_PARAMS.temperature.precise,
        system: prompt.systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      })
    );

    // Log usage for dashboard tracking
    logUsage({
      feature: "skill_matching",
      model: CLAUDE_MODEL,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text' || !content.text?.trim()) {
      throw new Error('Claude returned an empty response');
    }

    const output = parseJsonResponse<SkillMatchingOutput>(content.text);
    return output;
  } catch (error) {
    throw new Error(
      `Failed to match source: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse JSON response from Claude, handling markdown code blocks
 */
function parseJsonResponse<T>(text: string): T {
  let cleanedText = text.trim();

  // Remove markdown code block if present
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7); // Remove ```json
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3); // Remove ```
  }

  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3); // Remove trailing ```
  }

  cleanedText = cleanedText.trim();

  try {
    return JSON.parse(cleanedText) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse Claude response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
