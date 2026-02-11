/**
 * Collateral Generation Service
 *
 * Generates content for collateral templates using LLM.
 * Supports both free-form text and structured placeholder generation.
 */

import { executeLLMCall } from '@/lib/llm/registry';
import prisma from '@/lib/prisma';
import type { TemplateAttributes } from '@/types/v2';
import type { TracingOptions } from '@/lib/llm';

export interface GenerationInput {
  /** The template to generate from */
  templateId: string;
  /** Block IDs to use as context (skills) */
  blockIds: string[];
  /** Staged source IDs to use as context */
  stagedSourceIds?: string[];
  /** Customer ID for customer-specific generation */
  customerId?: string;
  /** User ID for tracing */
  userId?: string;
  /** User email for tracing */
  userEmail?: string;
  /** Model speed preference */
  modelSpeed?: 'fast' | 'quality';
}

export interface GenerationResult {
  /** The generated placeholder values (for structured templates) */
  placeholders?: Record<string, string>;
  /** The generated text content (for text templates) */
  content?: string;
  /** Transparency information from the LLM call */
  transparency?: {
    systemPrompt: string;
    compositionId: string;
    model: string;
  };
  /** Errors during generation */
  errors?: string[];
}

/**
 * Generate collateral content from a template.
 * For Google Slides templates, generates placeholder values.
 * For text templates, generates free-form content.
 */
export async function generateCollateral(
  input: GenerationInput
): Promise<GenerationResult> {
  const { templateId, blockIds, stagedSourceIds = [], userId, userEmail, modelSpeed = 'quality' } = input;

  // Fetch the template
  const template = await prisma.buildingBlock.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const attributes = (template.attributes || {}) as TemplateAttributes;
  const outputType = attributes.outputType || 'text';

  // Fetch blocks for context
  const blocks = await prisma.buildingBlock.findMany({
    where: {
      id: { in: blockIds },
      status: 'ACTIVE',
    },
    select: {
      id: true,
      title: true,
      content: true,
    },
  });

  // Fetch staged sources for context
  let sources: Array<{ id: string; title: string; content: string | null; sourceType: string }> = [];
  if (stagedSourceIds.length > 0) {
    sources = await prisma.stagedSource.findMany({
      where: {
        id: { in: stagedSourceIds },
        content: { not: null },
      },
      select: {
        id: true,
        title: true,
        content: true,
        sourceType: true,
      },
    });
  }

  // Build skills array for LLM
  const skills = [
    ...blocks.map((block) => ({
      id: block.id,
      title: block.title,
      content: block.content,
    })),
    ...sources.map((source) => ({
      id: source.id,
      title: `[${source.sourceType.toUpperCase()}] ${source.title}`,
      content: source.content || '',
    })),
  ];

  // Tracing options
  const tracingOptions: TracingOptions = {
    userId,
    userEmail,
  };

  if (outputType === 'google-slides') {
    // Generate structured placeholder values
    return generatePlaceholderValues({
      template,
      attributes,
      skills,
      tracingOptions,
      modelSpeed,
    });
  }

  // Default: generate text content
  return generateTextContent({
    template,
    skills,
    tracingOptions,
    modelSpeed,
  });
}

async function generatePlaceholderValues(params: {
  template: { id: string; title: string; content: string };
  attributes: TemplateAttributes;
  skills: Array<{ id: string; title: string; content: string }>;
  tracingOptions: TracingOptions;
  modelSpeed: 'fast' | 'quality';
}): Promise<GenerationResult> {
  const { template, attributes, skills, tracingOptions, modelSpeed } = params;

  // Build placeholder guide from template attributes
  const placeholderGuide = attributes.placeholderGuide || {};
  const detectedPlaceholders = attributes.detectedPlaceholders || [];

  // If we have detected placeholders but no guide, create a basic guide
  const fullGuide: Record<string, string> = { ...placeholderGuide };
  for (const placeholder of detectedPlaceholders) {
    if (!fullGuide[placeholder]) {
      fullGuide[placeholder] = `Value for ${placeholder}`;
    }
  }

  // Build the question for the LLM
  const placeholderGuideText = Object.entries(fullGuide)
    .map(([key, description]) => `- {{${key}}}: ${description}`)
    .join('\n');

  const question = `Based on the provided information, generate content for a presentation titled "${template.title}".

TEMPLATE DESCRIPTION:
${template.content}

PLACEHOLDERS TO FILL:
${placeholderGuideText}

Return a JSON object with placeholder names as keys and generated content as values. Each value should be concise and appropriate for a presentation slide.`;

  try {
    const result = await executeLLMCall({
      question,
      compositionId: 'collateral_placeholder_generation',
      skills,
      modelSpeed,
      tracingOptions,
    });

    // Parse the JSON response
    let placeholders: Record<string, string> = {};
    try {
      // Try to extract JSON from the response
      const jsonMatch = result.answer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        placeholders = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If JSON parsing fails, return an error
      return {
        errors: ['Failed to parse placeholder values from LLM response'],
        transparency: {
          systemPrompt: result.transparency.systemPrompt,
          compositionId: result.transparency.compositionId,
          model: result.usage?.model || 'unknown',
        },
      };
    }

    return {
      placeholders,
      transparency: {
        systemPrompt: result.transparency.systemPrompt,
        compositionId: result.transparency.compositionId,
        model: result.usage?.model || 'unknown',
      },
    };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

async function generateTextContent(params: {
  template: { id: string; title: string; content: string };
  skills: Array<{ id: string; title: string; content: string }>;
  tracingOptions: TracingOptions;
  modelSpeed: 'fast' | 'quality';
}): Promise<GenerationResult> {
  const { template, skills, tracingOptions, modelSpeed } = params;

  const question = `Based on the provided information, generate content for: "${template.title}"

TEMPLATE INSTRUCTIONS:
${template.content}

Generate comprehensive content following the template instructions.`;

  try {
    const result = await executeLLMCall({
      question,
      compositionId: 'chat_response', // Use standard chat response for text
      skills,
      modelSpeed,
      tracingOptions,
    });

    return {
      content: result.answer,
      transparency: {
        systemPrompt: result.transparency.systemPrompt,
        compositionId: result.transparency.compositionId,
        model: result.usage?.model || 'unknown',
      },
    };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
