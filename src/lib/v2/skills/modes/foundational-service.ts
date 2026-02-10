/**
 * Foundational Skills Service
 *
 * Creates foundational skills by EXTRACTING scope-relevant content from sources.
 * Unlike standard skill generation which synthesizes, this mode:
 * - Uses a pre-defined scope as a filter
 * - Extracts only relevant portions from each source
 * - Tracks what was extracted per-source for transparency
 *
 * Use cases:
 * - Customer profile skills like "Tech Stack", "Key Contacts"
 * - One Gong call can feed 5 different skills, each extracting its relevant portion
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LibraryId, SkillType } from '@/types/v2';
import type { FoundationalCreationOutput } from '../../prompts/types';
import { buildPrompt, fillUserPrompt, formatSourcesForPrompt } from '../../prompts/builder';
import { getMaxTokensForSpeed } from '../../../config';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// =============================================================================
// TYPES
// =============================================================================

interface GenerateFoundationalSkillInput {
  sources: Array<{
    id: string;
    type: string;
    label: string;
    url?: string;
    content: string;
  }>;
  scopeDefinition: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  title: string;
  libraryId: LibraryId;
  skillType?: SkillType;
  modelSpeed?: 'quality' | 'fast';
  customerId?: string;
}

// =============================================================================
// FOUNDATIONAL SKILL GENERATION
// =============================================================================

/**
 * Generate a foundational skill by extracting scope-relevant content from sources
 */
export async function generateFoundationalSkill(
  input: GenerateFoundationalSkillInput
): Promise<FoundationalCreationOutput> {
  const startTime = Date.now();

  // Build prompt using foundational composition
  const prompt = buildPrompt({
    context: 'foundational_creation',
    libraryId: input.libraryId,
    isCustomerSkill: !!input.customerId,
  });

  // Format sources
  const formattedSources = formatSourcesForPrompt(input.sources);

  // Format scope definition
  const futureAdditionsText = input.scopeDefinition.futureAdditions.join('\n- ');
  const notIncludedText = input.scopeDefinition.notIncluded
    ? input.scopeDefinition.notIncluded.join('\n- ')
    : 'Not specified';

  // Fill user prompt with data
  const userPrompt = fillUserPrompt(prompt.userPromptTemplate, {
    libraryContext: '',  // Already in system prompt
    foundationalTitle: input.title,
    foundationalCovers: input.scopeDefinition.covers,
    foundationalFutureAdditions: `- ${futureAdditionsText}`,
    foundationalNotIncluded: `- ${notIncludedText}`,
    sources: formattedSources,
  });

  // Select model
  const model = input.modelSpeed === 'fast'
    ? 'claude-3-5-haiku-20241022'
    : 'claude-3-7-sonnet-20250219';

  // Call Claude API
  const response = await anthropic.messages.create({
    model,
    max_tokens: getMaxTokensForSpeed(input.modelSpeed),
    temperature: 0.3,
    system: prompt.systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  // Extract response
  const rawResponse = response.content[0]?.type === 'text'
    ? response.content[0].text
    : '';

  // Parse JSON response
  let result: FoundationalCreationOutput;
  try {
    // Try to parse as JSON
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    result = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to parse foundational skill creation response:', error);
    throw new Error('Failed to parse LLM response as JSON');
  }

  // Add transparency metadata
  result.transparency = {
    systemPrompt: prompt.systemPrompt,
    userPrompt,
    rawResponse,
    compositionId: prompt.compositionId,
    blockIds: prompt.blocksUsed,
    model,
    tokens: {
      input: response.usage?.input_tokens || 0,
      output: response.usage?.output_tokens || 0,
    },
    timestamp: new Date().toISOString(),
  };

  const elapsedMs = Date.now() - startTime;
  console.log(`[FoundationalService] Generated skill in ${elapsedMs}ms using ${model}`);

  return result;
}
