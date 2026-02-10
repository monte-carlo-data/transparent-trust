/**
 * Source Linking Service
 *
 * Handles linking library-scoped staged sources to specific customers.
 * This creates a customer-scoped copy of the source (metadata only initially,
 * content synced lazily on first access).
 *
 * Key concepts:
 * - Library-scoped sources: customerId=null, discovered from integrations (e.g., GTM Gong calls)
 * - Customer-scoped sources: customerId set, linked from library sources
 * - Lazy content sync: Only metadata copied initially, content fetched on demand
 * - Sources are read-only once linked (only for skill assignment)
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { TypedStagedSource, SourceType } from '@/types/v2';
import type { LibraryId } from '@/types/v2';
import { toTypedSource } from '@/types/v2/staged-source';
import { logger } from '@/lib/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface LinkSourceInput {
  /** ID of the library-scoped source to link */
  sourceId: string;
  /** Customer ID to link to */
  customerId: string;
  /** User performing the action */
  linkedBy?: string;
}

export interface LinkSourcesInput {
  /** IDs of library-scoped sources to link */
  sourceIds: string[];
  /** Customer ID to link to */
  customerId: string;
  /** User performing the action */
  linkedBy?: string;
}

export interface LinkableSourcesQuery {
  /** Library to query (e.g., 'gtm') */
  libraryId: LibraryId;
  /** Filter by source type */
  sourceType?: SourceType;
  /** Filter by matched customer (from auto-matching) */
  matchedCustomerId?: string;
  /** Search in title */
  search?: string;
  /** Only show sources not yet linked to specified customer */
  excludeLinkedTo?: string;
  /** Pagination */
  limit?: number;
  offset?: number;
}

export type LinkableSource = TypedStagedSource & {
  /** Customer ID auto-matched from metadata (e.g., Gong CRM match) */
  matchedCustomerId?: string;
  /** Whether already linked to a specific customer */
  linkedToCustomers: Array<{
    customerId: string;
    customerName?: string;
  }>;
};

export interface LinkResult {
  success: boolean;
  linkedSourceId?: string;
  error?: string;
}

export interface BulkLinkResult {
  linked: number;
  skipped: number;
  errors: Array<{ sourceId: string; error: string }>;
}

// =============================================================================
// LINK SOURCE TO CUSTOMER
// =============================================================================

/**
 * Link a single library-scoped source to a customer.
 * Creates a new customer-scoped StagedSource with metadata copied.
 * Content is NOT copied - it will be synced lazily on first access.
 */
export async function linkSourceToCustomer(input: LinkSourceInput): Promise<LinkResult> {
  const { sourceId, customerId, linkedBy } = input;

  // Get the source to link
  const source = await prisma.stagedSource.findUnique({
    where: { id: sourceId },
  });

  if (!source) {
    logger.warn('Link source failed: source not found', { sourceId, customerId, linkedBy });
    return { success: false, error: 'Source not found' };
  }

  // Verify it's a library-scoped source (not already customer-scoped)
  if (source.customerId) {
    logger.warn('Link source failed: already customer-scoped', {
      sourceId,
      existingCustomerId: source.customerId,
      targetCustomerId: customerId,
    });
    return { success: false, error: 'Source is already customer-scoped' };
  }

  // Create customer-scoped copy (metadata only, no content)
  // Use try-catch to handle race conditions (unique constraint violations)
  const metadata = source.metadata as Record<string, unknown>;
  try {
    const linkedSource = await prisma.stagedSource.create({
      data: {
        sourceType: source.sourceType,
        externalId: source.externalId,
        libraryId: 'customers',
        customerId,
        title: source.title,
        // Content NOT copied - will be synced lazily
        content: null,
        contentPreview: source.contentPreview,
        metadata: {
          ...metadata,
          // Track the link relationship
          linkedFrom: {
            sourceId: source.id,
            libraryId: source.libraryId,
            linkedAt: new Date().toISOString(),
            linkedBy,
          },
        } as unknown as Prisma.InputJsonValue,
        stagedBy: linkedBy,
      },
    });

    return { success: true, linkedSourceId: linkedSource.id };
  } catch (error) {
    // Handle unique constraint violation (race condition - already linked)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.info('Link source skipped: already linked (concurrent request)', {
        sourceId,
        customerId,
      });
      return { success: false, error: 'Source already linked to this customer' };
    }
    throw error;
  }
}

/**
 * Link multiple library-scoped sources to a customer (batch operation).
 */
export async function linkSourcesToCustomer(input: LinkSourcesInput): Promise<BulkLinkResult> {
  const { sourceIds, customerId, linkedBy } = input;
  const result: BulkLinkResult = { linked: 0, skipped: 0, errors: [] };

  for (const sourceId of sourceIds) {
    const linkResult = await linkSourceToCustomer({ sourceId, customerId, linkedBy });

    if (linkResult.success) {
      result.linked++;
    } else if (linkResult.error === 'Source already linked to this customer') {
      result.skipped++;
    } else {
      result.errors.push({ sourceId, error: linkResult.error || 'Unknown error' });
    }
  }

  return result;
}

// =============================================================================
// QUERY LINKABLE SOURCES
// =============================================================================

/**
 * Get library-scoped sources that can be linked to customers.
 * Includes auto-matched customer info from metadata.
 */
export async function getLinkableSources(
  query: LinkableSourcesQuery
): Promise<{ sources: LinkableSource[]; total: number }> {
  const {
    libraryId,
    sourceType,
    matchedCustomerId,
    search,
    excludeLinkedTo,
    limit = 50,
    offset = 0,
  } = query;

  // Build the where clause for library-scoped sources
  const where: Prisma.StagedSourceWhereInput = {
    libraryId,
    customerId: null, // Only library-scoped sources
    ignoredAt: null, // Not ignored
    ...(sourceType && { sourceType }),
    ...(search && {
      title: { contains: search, mode: 'insensitive' },
    }),
  };

  // If filtering by matched customer, we need to filter in application code
  // since Prisma doesn't support JSON field queries well

  const [sources, total] = await Promise.all([
    prisma.stagedSource.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { stagedAt: 'desc' },
    }),
    prisma.stagedSource.count({ where }),
  ]);

  // Get all customer-scoped copies to show which customers each source is linked to
  const externalIds = sources.map((s) => s.externalId);
  const linkedCopies = await prisma.stagedSource.findMany({
    where: {
      externalId: { in: externalIds },
      libraryId: 'customers',
      customerId: { not: null },
    },
    include: {
      customer: {
        select: { id: true, company: true },
      },
    },
  });

  // Group linked copies by externalId
  const linksByExternalId = new Map<string, Array<{ customerId: string; customerName?: string }>>();
  for (const copy of linkedCopies) {
    const existing = linksByExternalId.get(copy.externalId) || [];
    existing.push({
      customerId: copy.customerId!,
      customerName: copy.customer?.company,
    });
    linksByExternalId.set(copy.externalId, existing);
  }

  // Transform to LinkableSource
  let linkableSources: LinkableSource[] = sources.map((source) => {
    const typed = toTypedSource(source);

    return {
      ...typed,
      matchedCustomerId: extractMatchedCustomerId(typed),
      linkedToCustomers: linksByExternalId.get(source.externalId) || [],
    };
  });

  // Filter by matched customer if specified
  if (matchedCustomerId) {
    linkableSources = linkableSources.filter((s) => s.matchedCustomerId === matchedCustomerId);
  }

  // Filter out sources already linked to specified customer
  if (excludeLinkedTo) {
    linkableSources = linkableSources.filter(
      (s) => !s.linkedToCustomers.some((link) => link.customerId === excludeLinkedTo)
    );
  }

  return { sources: linkableSources, total };
}

/**
 * Get sources that are auto-matched to a specific customer but not yet linked.
 * Useful for showing "suggested sources" on customer profile.
 */
export async function getSuggestedSourcesForCustomer(
  customerId: string,
  options: { sourceType?: SourceType; limit?: number } = {}
): Promise<LinkableSource[]> {
  const { sourceType, limit = 20 } = options;

  const result = await getLinkableSources({
    libraryId: 'gtm', // GTM library contains global Gong calls
    sourceType,
    matchedCustomerId: customerId,
    excludeLinkedTo: customerId,
    limit,
  });

  return result.sources;
}

// =============================================================================
// CHECK LINK STATUS
// =============================================================================

/**
 * Check if a source is linked to a specific customer.
 */
export async function isSourceLinkedToCustomer(
  sourceId: string,
  customerId: string
): Promise<boolean> {
  const source = await prisma.stagedSource.findUnique({
    where: { id: sourceId },
    select: { externalId: true, sourceType: true },
  });

  if (!source) return false;

  const linkedCopy = await prisma.stagedSource.findFirst({
    where: {
      sourceType: source.sourceType,
      externalId: source.externalId,
      libraryId: 'customers',
      customerId,
    },
  });

  return !!linkedCopy;
}

/**
 * Get all customers a source is linked to.
 */
export async function getLinkedCustomers(
  sourceId: string
): Promise<Array<{ customerId: string; customerName?: string; linkedSourceId: string }>> {
  const source = await prisma.stagedSource.findUnique({
    where: { id: sourceId },
    select: { externalId: true, sourceType: true },
  });

  if (!source) return [];

  const linkedCopies = await prisma.stagedSource.findMany({
    where: {
      sourceType: source.sourceType,
      externalId: source.externalId,
      libraryId: 'customers',
      customerId: { not: null },
    },
    include: {
      customer: {
        select: { id: true, company: true },
      },
    },
  });

  return linkedCopies.map((copy) => ({
    customerId: copy.customerId!,
    customerName: copy.customer?.company,
    linkedSourceId: copy.id,
  }));
}

// =============================================================================
// UNLINK SOURCE
// =============================================================================

/**
 * Unlink a source from a customer (delete the customer-scoped copy).
 * Only allowed if source has no skill assignments.
 */
export async function unlinkSourceFromCustomer(
  linkedSourceId: string
): Promise<{ success: boolean; error?: string }> {
  const source = await prisma.stagedSource.findUnique({
    where: { id: linkedSourceId },
    include: {
      assignments: { select: { id: true } },
    },
  });

  if (!source) {
    logger.warn('Unlink source failed: source not found', { linkedSourceId });
    return { success: false, error: 'Linked source not found' };
  }

  // Verify it's a customer-scoped source
  if (!source.customerId) {
    logger.warn('Unlink source failed: not customer-scoped', { linkedSourceId });
    return { success: false, error: 'Source is not customer-scoped' };
  }

  // Check for assignments
  if (source.assignments.length > 0) {
    logger.warn('Unlink source failed: has assignments', {
      linkedSourceId,
      assignmentCount: source.assignments.length,
    });
    return {
      success: false,
      error: `Source has ${source.assignments.length} skill assignment(s). Remove assignments first.`,
    };
  }

  await prisma.stagedSource.delete({
    where: { id: linkedSourceId },
  });

  logger.info('Source unlinked from customer', {
    linkedSourceId,
    customerId: source.customerId,
  });

  return { success: true };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract auto-matched customer ID from source metadata.
 * Supports Gong (matchedCustomerId), Slack (customerId), etc.
 */
function extractMatchedCustomerId(source: TypedStagedSource): string | undefined {
  // Gong: matchedCustomerId field (from CRM ID, domain, or email matching during discovery)
  if (source.sourceType === 'gong') {
    return source.metadata.matchedCustomerId;
  }

  // Slack: customerId field (populated during customer-specific ingestion)
  if (source.sourceType === 'slack') {
    return source.metadata.customerId;
  }

  // Zendesk: could be from requester.organization or custom field
  if (source.sourceType === 'zendesk') {
    // Check for matched customer in metadata (not a standard field, cast required)
    const metadata = source.metadata as unknown as { matchedCustomerId?: string };
    return metadata.matchedCustomerId;
  }

  return undefined;
}
