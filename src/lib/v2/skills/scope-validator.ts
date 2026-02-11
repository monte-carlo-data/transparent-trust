/**
 * Scope Definition Validation and Derivation
 *
 * Provides Zod-based validation for scopeDefinition with type safety,
 * plus helper functions for deriving Anthropic-compatible fields.
 *
 * Scope is the source of truth for what a skill covers and should be
 * embedded in skill content. This validator ensures scope data is always valid.
 */

import { z } from 'zod';
import type { ScopeDefinition } from '@/types/v2';

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

/**
 * Schema for scope definition validation
 * - covers: REQUIRED, non-empty string
 * - futureAdditions: array of strings (can be empty)
 * - notIncluded: optional array of strings
 */
export const ScopeDefinitionSchema = z.object({
  covers: z
    .string()
    .min(1, 'Scope definition must include "covers" field')
    .trim(),
  futureAdditions: z.array(z.string().trim()).default([]),
  notIncluded: z.array(z.string().trim()).optional(),
});

/**
 * Validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] };

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate and parse a scope definition object
 * @param raw - Unknown data to validate
 * @returns Validation result with parsed data or errors
 */
export function validateScopeDefinition(raw: unknown): ValidationResult<ScopeDefinition> {
  try {
    const data = ScopeDefinitionSchema.parse(raw);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Type guard for scope definition
 * @param value - Value to check
 * @returns True if value is a valid ScopeDefinition
 */
export function isScopeDefinition(value: unknown): value is ScopeDefinition {
  const result = validateScopeDefinition(value);
  return result.success;
}

/**
 * Sanitize and provide safe defaults for scope definition
 * Used when loading from git or handling partial data
 * @param raw - Raw scope data
 * @returns Valid scope definition or throws error if covers is missing
 */
export function sanitizeScopeDefinition(raw: unknown): ScopeDefinition {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Scope definition must be an object');
  }

  const obj = raw as Record<string, unknown>;

  // Extract covers - REQUIRED
  const covers = typeof obj.covers === 'string' ? obj.covers.trim() : '';
  if (!covers) {
    throw new Error('Scope definition must include non-empty "covers" field');
  }

  // Extract futureAdditions - optional, default to []
  const futureAdditions = Array.isArray(obj.futureAdditions)
    ? obj.futureAdditions.filter((item) => typeof item === 'string').map((item) => (item as string).trim())
    : [];

  // Extract notIncluded - optional
  const notIncluded = Array.isArray(obj.notIncluded)
    ? obj.notIncluded.filter((item) => typeof item === 'string').map((item) => (item as string).trim())
    : undefined;

  return {
    covers,
    futureAdditions,
    ...(notIncluded && { notIncluded }),
  };
}

// =============================================================================
// DERIVATION FUNCTIONS (for Anthropic compatibility)
// =============================================================================

/**
 * Derive the "name" field (Anthropic SKILL.md)
 * Name is always the slug (lowercase-with-hyphens)
 * @param slug - URL-friendly skill identifier
 * @returns The name field
 */
export function deriveName(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Derive the "description" field (Anthropic SKILL.md)
 * Combines summary + scopeDefinition.covers for Anthropic compatibility
 * @param summary - Brief skill summary (e.g., "SSO configuration guide")
 * @param scope - Scope definition with covers field
 * @returns Description for Anthropic format
 */
export function deriveDescription(
  summary: string | undefined,
  scope: ScopeDefinition | undefined
): string {
  if (!summary && !scope?.covers) {
    return '';
  }

  if (!summary) {
    return scope?.covers || '';
  }

  if (!scope?.covers) {
    return summary;
  }

  // Combine summary and covers for complete description
  // Format: "Summary. Use when: covers"
  return `${summary}. Use when: ${scope.covers}`;
}

/**
 * Derive the "description" field from covers text directly
 * For cases where we only have covers, not full scope object
 * @param covers - The "covers" text from scope definition
 * @returns Description for Anthropic format
 */
export function deriveDescriptionFromCovers(covers: string): string {
  if (!covers) {
    return '';
  }
  return `Use when: ${covers}`;
}

// =============================================================================
// SCOPE EXTRACTION & VALIDATION FROM CONTENT
// =============================================================================

/**
 * Extract scope definition from markdown content with robust parsing
 * Handles various formatting variations
 * @param content - Markdown content with embedded scope section
 * @returns Extracted scope or undefined if not found
 * @throws Error if scope section found but malformed
 */
export function extractScopeFromMarkdown(content: string): ScopeDefinition | undefined {
  if (!content) {
    return undefined;
  }

  // Try to find scope definition section (flexible heading matching)
  const scopePatterns = [
    /##\s*Scope\s*Definition\s*([\s\S]*?)(?=##\s*|\Z)/i,
    /##\s*Scope\s*([\s\S]*?)(?=##\s*|\Z)/i,
  ];

  let scopeMatch: RegExpMatchArray | null = null;
  for (const pattern of scopePatterns) {
    scopeMatch = content.match(pattern);
    if (scopeMatch) break;
  }

  if (!scopeMatch) {
    return undefined;
  }

  const scopeText = scopeMatch[1];
  console.log('[Scope Extraction] Found scope section, extracting fields...', {
    scopeTextLength: scopeText.length,
    scopePreview: scopeText.substring(0, 200),
  });

  // Extract covers (REQUIRED)
  const coversPatterns = [
    /\*\*Covers:\*\*\s*([\s\S]+?)(?=\*\*|$)/i,
    /\*\*Current Coverage:\*\*\s*([\s\S]+?)(?=\*\*|$)/i,
    /\*\*What.*Covers:\*\*\s*([\s\S]+?)(?=\*\*|$)/i,
    /\*\*Coverage:\*\*\s*([\s\S]+?)(?=\*\*|$)/i,
    /Covers:\s*([\s\S]+?)(?=\*\*|^##|$)/i,
  ];

  let covers = '';
  for (const pattern of coversPatterns) {
    const match = scopeText.match(pattern);
    if (match) {
      covers = match[1].trim();
      break;
    }
  }

  if (!covers) {
    console.error('[Scope Extraction] Failed to extract covers', {
      scopeText: scopeText.substring(0, 500),
    });
    throw new Error('Scope Definition section found but missing "Covers" field');
  }

  console.log('[Scope Extraction] Extracted covers:', covers.substring(0, 100));

  // Extract futureAdditions
  const futurePatterns = [
    /\*\*Future\s*Additions:\*\*\s*([\s\S]*?)(?=\*\*|$)/i,
    /\*\*Planned\s*Additions:\*\*\s*([\s\S]*?)(?=\*\*|$)/i,
    /\*\*Future.*:\*\*\s*([\s\S]*?)(?=\*\*|$)/i,
    /Future\s*Additions?:\s*([\s\S]*?)(?=\*\*|^##|$)/i,
  ];

  let futureAdditions: string[] = [];
  for (const pattern of futurePatterns) {
    const match = scopeText.match(pattern);
    if (match) {
      futureAdditions = match[1]
        .split('\n')
        .filter((line) => line.trim().startsWith('-'))
        .map((line) => line.replace(/^[\s-]*/, '').trim())
        .filter((line) => line.length > 0);
      break;
    }
  }

  console.log('[Scope Extraction] Extracted futureAdditions:', {
    count: futureAdditions.length,
    items: futureAdditions.slice(0, 2),
  });

  // Extract notIncluded
  const notIncludedPatterns = [
    /\*\*Not\s*Included:\*\*\s*([\s\S]*?)(?=\*\*|$)/i,
    /\*\*Not.*Included:\*\*\s*([\s\S]*?)(?=\*\*|$)/i,
    /\*\*Explicitly\s*(?:Not\s*)?Excluded:\*\*\s*([\s\S]*?)(?=\*\*|$)/i,
    /Not\s*Included:\s*([\s\S]*?)(?=\*\*|^##|$)/i,
  ];

  let notIncluded: string[] | undefined;
  for (const pattern of notIncludedPatterns) {
    const match = scopeText.match(pattern);
    if (match) {
      notIncluded = match[1]
        .split('\n')
        .filter((line) => line.trim().startsWith('-'))
        .map((line) => line.replace(/^[\s-]*/, '').trim())
        .filter((line) => line.length > 0);
      break;
    }
  }

  console.log('[Scope Extraction] Extracted notIncluded:', {
    count: notIncluded?.length || 0,
    items: notIncluded?.slice(0, 2) || [],
    found: !!notIncluded,
  });

  return {
    covers,
    futureAdditions,
    ...(notIncluded && notIncluded.length > 0 && { notIncluded }),
  };
}

// =============================================================================
// ERROR MESSAGES
// =============================================================================

/**
 * Format validation errors for display
 * @param errors - Array of error messages
 * @returns Formatted error message
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) {
    return 'Unknown validation error';
  }
  if (errors.length === 1) {
    return errors[0];
  }
  return `Validation errors:\n${errors.map((e) => `- ${e}`).join('\n')}`;
}
