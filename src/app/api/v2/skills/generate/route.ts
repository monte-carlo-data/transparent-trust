/**
 * POST /api/v2/skills/generate
 * Generate a draft skill from selected sources using LLM
 *
 * V2: Uses new prompt system with scope definitions, citations, and contradiction detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { canManageLibrary } from '@/lib/v2/teams';
import { generateSkill } from '@/lib/v2/skills';
import { logger } from '@/lib/logger';
import type { LibraryId, ScopeDefinition, SourceCitation, SourceContradiction } from '@/types/v2';

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

interface GenerateSkillRequest {
  sourceIds: string[];
  libraryId: LibraryId;
  customerId?: string;
  /** Optional customer name for customer-specific skills */
  customerName?: string;
  /** Additional context to inject into the prompt */
  additionalContext?: string;
}

interface GenerateSkillResponse {
  draft: {
    title: string;
    content: string;
    summary: string;
    /** V2: Scope definition for skill boundaries */
    scopeDefinition: ScopeDefinition;
    /** V2: Inline citations [1], [2], etc. */
    citations: SourceCitation[];
    /** V2: Contradictions detected between sources */
    contradictions: SourceContradiction[];
    /** Additional attributes (keywords, product, etc.) */
    attributes?: {
      keywords?: string[];
      product?: string;
    };
  };
  sourceContents: Array<{
    id: string;
    title: string;
    type: string;
    preview: string;
  }>;
  promptUsed: {
    composition: string;
    libraryId: LibraryId;
    isCustomerSkill: boolean;
    blocksUsed: string[];
    systemPrompt: string;
  };
  /** Full LLM trace data for transparency */
  transparency?: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    compositionId: string;
    blockIds: string[];
    model: string;
    tokens: {
      input: number;
      output: number;
    };
    timestamp: string;
  };
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: GenerateSkillRequest = await request.json();
    const { sourceIds, libraryId, customerId, customerName, additionalContext } = body;

    // Validate inputs
    if (!sourceIds || sourceIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one source is required' },
        { status: 400 }
      );
    }

    if (sourceIds.length > 15) {
      return NextResponse.json(
        { error: 'Maximum 15 sources allowed per generation' },
        { status: 400 }
      );
    }

    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId is required' },
        { status: 400 }
      );
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, libraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    // Fetch staged sources
    const sources = await prisma.stagedSource.findMany({
      where: {
        id: { in: sourceIds },
        libraryId,
      },
    });

    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'No sources found for the specified library' },
        { status: 404 }
      );
    }

    if (sources.length !== sourceIds.length) {
      return NextResponse.json(
        { error: 'Some sources were not found or do not belong to this library' },
        { status: 404 }
      );
    }

    // For sources without content (lazy-loaded Gong calls, URLs, etc.), attempt to sync content now
    const { syncSourceContent } = await import('@/lib/v2/sources/source-content-sync-service');
    const { getAdapter } = await import('@/lib/v2/sources/adapters');

    for (const source of sources) {
      if (!source.content || source.content.trim().length === 0) {
        try {
          // For customer-scoped sources, use the sync service
          if (source.customerId) {
            const syncResult = await syncSourceContent(source.id);

            if (syncResult.success && syncResult.contentLength) {
              // Re-fetch source to get updated content in memory
              const updated = await prisma.stagedSource.findUnique({
                where: { id: source.id },
              });
              if (updated?.content) {
                source.content = updated.content;
                logger.debug('[Skill Generation V2] Synced customer source content', {
                  sourceId: source.id,
                  sourceType: source.sourceType,
                  contentLength: syncResult.contentLength,
                });
              }
            } else {
              logger.warn('[Skill Generation V2] Failed to sync customer source content', {
                sourceId: source.id,
                sourceType: source.sourceType,
                error: syncResult.error,
              });
            }
          } else {
            // For library-scoped sources, fetch content directly via adapter
            const adapter = getAdapter(source.sourceType as import('@/types/v2').SourceType);
            if (adapter?.fetchContent) {
              const fetchResult = await adapter.fetchContent(source.externalId);

              // Handle new return type (object with content/error) or legacy (string | null)
              const content =
                typeof fetchResult === 'object' && fetchResult !== null && 'content' in fetchResult
                  ? fetchResult.content
                  : fetchResult;

              if (content) {
                // Update source in database and in memory
                const preview = content.substring(0, 200) + (content.length > 200 ? '...' : '');
                await prisma.stagedSource.update({
                  where: { id: source.id },
                  data: { content, contentPreview: preview },
                });
                source.content = content;
                logger.debug('[Skill Generation V2] Fetched library source content', {
                  sourceId: source.id,
                  sourceType: source.sourceType,
                  contentLength: content.length,
                });
              } else {
                const fetchError =
                  typeof fetchResult === 'object' && fetchResult !== null && 'error' in fetchResult
                    ? fetchResult.error
                    : 'No content returned';
                logger.warn('[Skill Generation V2] Failed to fetch library source content', {
                  sourceId: source.id,
                  sourceType: source.sourceType,
                  error: fetchError,
                });
              }
            } else {
              logger.warn('[Skill Generation V2] No content fetcher for source type', {
                sourceId: source.id,
                sourceType: source.sourceType,
              });
            }
          }
        } catch (error) {
          logger.warn('[Skill Generation V2] Error during source content sync', error, {
            sourceId: source.id,
            sourceType: source.sourceType,
          });
        }
      }
    }

    // Validate that sources have content after attempting to sync
    const sourcesWithoutContent = sources.filter(s => {
      return !s.content || s.content.trim().length === 0;
    });
    if (sourcesWithoutContent.length > 0) {
      return NextResponse.json(
        {
          error: 'Some sources do not have content',
          details: `Sources ${sourcesWithoutContent.map(s => s.id).join(', ')} are missing content and cannot be used for skill generation. Content sync was attempted but failed. Check the source connections or try refreshing manually.`,
        },
        { status: 400 }
      );
    }

    // Log what we're sending to Claude for debugging
    logger.debug('[Skill Generation V2] Generating skill', {
      libraryId,
      sourceCount: sources.length,
      isCustomerSkill: !!customerId,
      sources: sources.map(s => ({
        id: s.id,
        title: s.title,
        type: s.sourceType,
        contentLength: (s.content || '').length,
      })),
    });

    // Use V2 skill generation service
    const skillOutput = await generateSkill({
      sources: sources.map(s => ({
        id: s.id,
        type: s.sourceType,
        label: s.title,
        url: s.sourceType === 'url' ? s.externalId : undefined,
        content: s.content || '', // Content guaranteed by validation above
      })),
      libraryId,
      isCustomerSkill: !!customerId,
      customerName,
      additionalContext,
    });

    // Format source contents for response
    const sourceContents = sources.map(s => ({
      id: s.id,
      title: s.title,
      type: s.sourceType,
      preview: (s.content || '').substring(0, 150),
    }));

    // Map LLM contradiction types to SourceContradiction interface types
    const mapContradictionType = (llmType: string): SourceContradiction['type'] | null => {
      const typeMapping: Record<string, SourceContradiction['type']> = {
        'factual': 'technical_contradiction',
        'methodological': 'different_perspectives',
        'scope': 'scope_mismatch',
        'version': 'version_mismatch',
        'outdated': 'outdated_vs_current',
      };
      return typeMapping[llmType] || null;
    };

    const mappedContradictions: SourceContradiction[] = (skillOutput.contradictions || [])
      .map(c => {
        const mappedType = c.type ? mapContradictionType(c.type) : null;
        if (!mappedType) {
          logger.warn('[Skill Generation V2] Could not map contradiction type', { type: c.type });
          return null;
        }
        return {
          type: mappedType,
          description: c.description || '',
          sourceA: c.sourceA || { id: '', label: '', excerpt: '' },
          sourceB: c.sourceB || { id: '', label: '', excerpt: '' },
          severity: (c.severity as SourceContradiction['severity']) || 'medium',
          recommendation: c.recommendation || '',
        };
      })
      .filter((c): c is SourceContradiction => c !== null);

    // Build response
    const response: GenerateSkillResponse = {
      draft: {
        title: skillOutput.title,
        content: skillOutput.content,
        summary: skillOutput.summary,
        scopeDefinition: skillOutput.scopeDefinition,
        citations: skillOutput.citations,
        contradictions: mappedContradictions,
        attributes: skillOutput.attributes,
      },
      sourceContents,
      promptUsed: {
        composition: 'skill_creation',
        libraryId,
        isCustomerSkill: !!customerId,
        blocksUsed: skillOutput.transparency?.blockIds || [
          'role_skill_creation',
          'skill_principles',
          'source_fidelity',
          'citation_format',
          'scope_definition',
          'contradiction_detection',
          'json_output',
        ],
        systemPrompt: skillOutput.transparency?.systemPrompt || '',
      },
      // Include full transparency for LLM trace persistence
      transparency: skillOutput.transparency
        ? {
            systemPrompt: skillOutput.transparency.systemPrompt,
            userPrompt: skillOutput.transparency.userPrompt,
            rawResponse: skillOutput.transparency.rawResponse,
            compositionId: skillOutput.transparency.compositionId,
            blockIds: skillOutput.transparency.blockIds,
            model: skillOutput.transparency.model,
            tokens: skillOutput.transparency.tokens,
            timestamp: skillOutput.transparency.timestamp,
          }
        : undefined,
    };

    logger.info('[Skill Generation V2] Success', {
      title: skillOutput.title,
      contentLength: skillOutput.content.length,
      citationCount: skillOutput.citations.length,
      contradictionCount: skillOutput.contradictions?.length || 0,
      hasScopeDefinition: !!skillOutput.scopeDefinition,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[Skill Generation V2] Error', error);
    return NextResponse.json(
      {
        error: 'Failed to generate skill',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
