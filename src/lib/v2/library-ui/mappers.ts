/**
 * Type Mappers for Sidebar Data
 *
 * Convert query results to SidebarContext interface shapes.
 * These mappers accept simplified types that can be serialized across server/client boundary.
 */

import type { SidebarContext } from './types';

/**
 * Simplified input type for source assignments (serializable across server/client boundary)
 */
interface SourceAssignmentInput {
  id: string;
  stagedSourceId: string;
  incorporatedAt?: string | null;
  title: string;
  sourceType: string;
}

/**
 * Map source assignments to SidebarContext incorporatedSources format.
 * Accepts simplified types that have been serialized for client components.
 */
export function mapIncorporatedSources(
  assignments: SourceAssignmentInput[]
): SidebarContext['incorporatedSources'] {
  return assignments
    .filter((a) => a.incorporatedAt !== null && a.incorporatedAt !== undefined)
    .map((a) => ({
      id: a.id,
      incorporatedAt: new Date(a.incorporatedAt!),
      stagedSource: {
        id: a.stagedSourceId,
        title: a.title,
        sourceType: a.sourceType,
      },
    }));
}

/**
 * Simplified input type for pending sources
 */
interface PendingSourceInput {
  id: string;
  title: string;
  sourceType: string;
}

/**
 * Map pending sources to SidebarContext pendingSources format
 */
export function mapPendingSources(
  sources: PendingSourceInput[]
): SidebarContext['pendingSources'] {
  return sources.map((s) => ({
    id: s.id,
    title: s.title,
    sourceType: s.sourceType,
  }));
}

/**
 * Map related skills to SidebarContext format
 */
export function mapRelatedSkills(
  skills: Array<{ id: string; title: string; slug: string | null }>
): SidebarContext['relatedSkills'] {
  return skills.map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
  }));
}
