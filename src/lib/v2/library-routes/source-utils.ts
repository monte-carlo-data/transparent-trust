/**
 * Shared Source Utilities
 *
 * Common helper functions for working with staged sources across all library components.
 */

import type { ScopeDefinition } from '@/types/v2/building-block';
import type { SourceType } from '@/lib/library-config';

/**
 * Source with minimal status fields needed for getSourceStatus
 */
export interface SourceStatusInput {
  ignoredAt: Date | null;
  assignments?: Array<{
    incorporatedAt: Date | null;
    block: { isActive?: boolean };
  }>;
}

/**
 * Determine the status of a staged source
 */
export function getSourceStatus(source: SourceStatusInput): 'pending' | 'incorporated' | 'ignored' {
  if (source.ignoredAt) return 'ignored';
  if (
    source.assignments?.some(
      (a) => a.incorporatedAt && (a.block?.isActive ?? true)
    )
  )
    return 'incorporated';
  return 'pending';
}

/**
 * Count sources that are pending (not ignored or incorporated)
 */
export function getPendingCount(sources: SourceStatusInput[]): number {
  return sources.filter((s) => getSourceStatus(s) === 'pending').length;
}

/**
 * Extract the scope covers string from skill attributes
 */
export function getScopeCovers(attributes: unknown): string | null {
  if (!attributes || typeof attributes !== 'object') return null;
  const attrs = attributes as Record<string, unknown>;
  const scopeDefinition = attrs.scopeDefinition as ScopeDefinition | undefined;
  return scopeDefinition?.covers || null;
}

/**
 * Map source types to dashboard icon names
 */
export function getIconForSourceType(
  type: SourceType
): 'search' | 'file' | 'megaphone' | 'zap' | 'ticket' | 'document' | 'bot' {
  switch (type) {
    case 'url':
      return 'search';
    case 'document':
      return 'file';
    case 'gong':
      return 'megaphone';
    case 'slack':
      return 'search';
    case 'zendesk':
      return 'ticket';
    case 'notion':
      return 'file';
    default:
      return 'file';
  }
}

/**
 * Color classes for library UI elements - all classes must be complete strings for Tailwind purging
 */
export const colorClasses = {
  blue: {
    button: 'bg-blue-600 hover:bg-blue-700',
    border: 'border-l-blue-500',
    hoverBorder: 'hover:border-blue-300',
    ring: 'focus:ring-blue-500',
  },
  purple: {
    button: 'bg-purple-600 hover:bg-purple-700',
    border: 'border-l-purple-500',
    hoverBorder: 'hover:border-purple-300',
    ring: 'focus:ring-purple-500',
  },
  green: {
    button: 'bg-green-600 hover:bg-green-700',
    border: 'border-l-green-500',
    hoverBorder: 'hover:border-green-300',
    ring: 'focus:ring-green-500',
  },
  amber: {
    button: 'bg-amber-600 hover:bg-amber-700',
    border: 'border-l-amber-500',
    hoverBorder: 'hover:border-amber-300',
    ring: 'focus:ring-amber-500',
  },
} as const;

export type ColorScheme = keyof typeof colorClasses;
export type ColorClasses = typeof colorClasses[ColorScheme];
