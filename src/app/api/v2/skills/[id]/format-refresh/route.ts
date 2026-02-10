/**
 * POST /api/v2/skills/[id]/format-refresh
 * Regenerate an existing skill through current format standards
 *
 * Regenerates a skill using all incorporated sources, ensuring the skill
 * conforms to current format standards and conventions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { canManageLibrary } from '@/lib/v2/teams';
import { reformatSkill } from '@/lib/v2/skills';
import { urlAdapter } from '@/lib/v2/sources/adapters/url-adapter';
import { getScopeFromContent } from '@/lib/v2/skills/content-parser';
import { validateScopeDefinition } from '@/lib/v2/skills/scope-validator';
import { extractKeywords } from '@/lib/v2/matching/keyword-utils';
import { logger } from '@/lib/logger';
import type { LibraryId } from '@/types/v2';
import type { StagedSource } from '@prisma/client';

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

interface FormatRefreshRequest {
  additionalContext?: string;
}

interface FormatRefreshResponse {
  id: string;
  title: string;
  status: string;
  content: string;
  originalContent?: string;
  summary: string;
  scopeDefinition: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
  changes: {
    sectionsAdded: string[];
    sectionsUpdated: string[];
    sectionsRemoved: string[];
    changeSummary: string;
  };
  splitRecommendation?: {
    shouldSplit: boolean;
    reason?: string;
    suggestedSkills?: Array<{
      title: string;
      scope: string;
    }>;
  };
  promptUsed?: {
    composition: string;
    blocksUsed: string[];
    systemPrompt: string;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Fetch content for a URL source if it's missing.
 * Updates the staged source in the database with the fetched content.
 * Returns the content (fetched or existing).
 */
async function fetchUrlContentIfMissing(source: StagedSource): Promise<string> {
  // If source already has content, return it
  if (source.content && source.content.trim().length > 0) {
    return source.content;
  }

  // Only fetch for URL sources
  if (source.sourceType !== 'url') {
    return source.content || '';
  }

  // Get the URL from externalId or metadata
  const url = source.externalId ||
    (source.metadata && typeof source.metadata === 'object' && 'url' in source.metadata
      ? (source.metadata as { url: string }).url
      : null);

  if (!url) {
    logger.warn('[Format Refresh] URL source has no URL to fetch', { sourceId: source.id });
    return '';
  }

  try {
    logger.debug('[Format Refresh] Fetching content for URL source', { sourceId: source.id, url });
    const fetched = await urlAdapter.fetchUrl(url);

    if (fetched.content && fetched.content.trim().length > 0) {
      // Update the staged source in the database with the fetched content
      await prisma.stagedSource.update({
        where: { id: source.id },
        data: {
          content: fetched.content,
          contentPreview: fetched.contentPreview || fetched.content.substring(0, 500),
          title: fetched.title || source.title,
          metadata: {
            ...(typeof source.metadata === 'object' ? source.metadata : {}),
            ...fetched.metadata,
            lastFetchedAt: new Date().toISOString(),
          },
        },
      });

      logger.debug('[Format Refresh] Successfully fetched URL content', {
        sourceId: source.id,
        contentLength: fetched.content.length
      });

      return fetched.content;
    }
  } catch (error) {
    logger.error('[Format Refresh] Failed to fetch URL content', error, {
      sourceId: source.id,
      url,
    });
  }

  return '';
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: skillId } = await params;

    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: FormatRefreshRequest = await request.json();
    const { additionalContext } = body;

    // Fetch the skill
    const skill = await prisma.buildingBlock.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    // Check library access
    const libraryId = skill.libraryId as LibraryId;
    const hasAccess = await canManageLibrary(session.user.id, libraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    // Log what we're doing
    logger.debug('[Format Refresh V2] Refreshing format for skill', {
      skillId,
      skillTitle: skill.title,
      libraryId,
    });

    // Extract existing skill data
    type HistoryEntry = {
      date: string;
      action: string;
      summary: string;
      user: string;
    };
    type SkillAttributes = {
      scopeDefinition?: unknown;
      citations?: unknown;
      summary?: unknown;
      contradictions?: unknown;
      history?: HistoryEntry[];
    };

    const existingAttrs = (skill.attributes as SkillAttributes) || {};
    type ScopeDefinition = { covers: string; futureAdditions: string[]; notIncluded?: string[]; keywords?: string[] };
    type Citation = { id: string; sourceId: string; label: string; url?: string };

    const typedScope =
      (existingAttrs.scopeDefinition as ScopeDefinition | undefined) || undefined;
    const typedCitations = Array.isArray(existingAttrs.citations)
      ? (existingAttrs.citations as Citation[])
      : undefined;

    const existingSkillData = {
      title: skill.title,
      content: skill.content,
      scopeDefinition: typedScope,
      citations: typedCitations,
    };

    // Fetch ALL incorporated sources (not just pending)
    const incorporatedSources = await prisma.sourceAssignment.findMany({
      where: {
        blockId: skillId,
        incorporatedAt: { not: null },
      },
      include: {
        stagedSource: true,
      },
    });

    if (incorporatedSources.length === 0) {
      logger.warn('[Format Refresh] No incorporated sources found for skill', { skillId });
    }

    // Filter to only refreshable source types (URL, Notion)
    const refreshableSourceTypes = ['url', 'notion'];
    const refreshableSources = incorporatedSources.filter(
      (a) => refreshableSourceTypes.includes(a.stagedSource.sourceType)
    );

    // Map refreshable sources for context (fetch URL content if missing)
    const allSourcesForRefresh = await Promise.all(
      refreshableSources.map(async (a) => {
        const content = await fetchUrlContentIfMissing(a.stagedSource);
        return {
          id: a.stagedSource.id,
          type: a.stagedSource.sourceType,
          label: a.stagedSource.title,
          content,
        };
      })
    );

    logger.debug('[Format Refresh V2] Sources for LLM', {
      skillId,
      refreshableSources: refreshableSources.length,
      skippedSources: incorporatedSources.length - refreshableSources.length,
      totalForLLM: allSourcesForRefresh.length,
    });

    // Use V2 skill format refresh service
    const refreshOutput = await reformatSkill({
      existingSkill: existingSkillData,
      allSources: allSourcesForRefresh,
      libraryId,
      additionalContext,
    });

    // Extract scope definition from the refreshed content
    let parsedScopeFromOutput;
    let parsedScopeFromExisting;

    try {
      parsedScopeFromOutput = getScopeFromContent(refreshOutput.content);
    } catch (error) {
      logger.warn('[Format Refresh] Failed to parse scope from LLM output', error);
    }

    try {
      parsedScopeFromExisting = getScopeFromContent(skill.content);
    } catch (error) {
      logger.warn('[Format Refresh] Failed to parse scope from existing content', error);
    }

    // Determine the final scope - with validation
    const updatedScope = parsedScopeFromOutput || parsedScopeFromExisting || typedScope;

    // Validate that we have a non-empty scope
    if (!updatedScope?.covers || !updatedScope.covers.trim()) {
      logger.error('[Format Refresh] Skill is missing scope definition after refresh', undefined, {
        skillId,
        hasOutputScope: !!parsedScopeFromOutput,
        hasExistingScope: !!parsedScopeFromExisting,
        hasAttributeScope: !!typedScope?.covers,
      });
      return NextResponse.json(
        {
          error: 'Skill format refresh failed: missing scope definition',
          details: 'The LLM did not generate a scope definition and none could be recovered from existing content or attributes. Please try again or provide additional context.'
        },
        { status: 400 }
      );
    }

    // Validate the final scope
    const scopeValidation = validateScopeDefinition(updatedScope);
    if (!scopeValidation.success) {
      logger.error('[Format Refresh] Invalid scope definition after refresh', undefined, {
        skillId,
        errors: scopeValidation.errors
      });
      return NextResponse.json(
        {
          error: 'Skill format refresh failed: invalid scope definition',
          details: scopeValidation.errors
        },
        { status: 400 }
      );
    }

    // Backfill keywords if not present - extract from covers + title
    if (!updatedScope.keywords || updatedScope.keywords.length === 0) {
      const keywordSource = `${refreshOutput.title} ${updatedScope.covers}`;
      updatedScope.keywords = extractKeywords(keywordSource, 10);
      logger.debug('[Format Refresh] Backfilled keywords', {
        skillId,
        keywords: updatedScope.keywords,
      });
    }

    logger.debug('[Format Refresh V2] Scope extraction', {
      skillId,
      hasOutputScope: !!parsedScopeFromOutput,
      hasExistingContentScope: !!parsedScopeFromExisting,
      hasAttributeScope: !!typedScope?.covers,
      finalScopeCovers: updatedScope.covers?.substring(0, 50),
    });

    // Keep content as-is (includes citations and scope sections)
    const finalContent = refreshOutput.content;

    logger.debug('[Format Refresh V2] Content update', {
      skillId,
      contentLength: finalContent.length,
    });

    // Update the skill in database
    const updatedSkill = await prisma.buildingBlock.update({
      where: { id: skillId },
      data: {
        title: refreshOutput.title,
        content: finalContent,
        attributes: {
          ...((skill.attributes as Record<string, unknown>) || {}),
          summary: refreshOutput.summary,
          scopeDefinition: updatedScope as unknown as Record<string, unknown>,
          lastRefreshedAt: new Date().toISOString(),
          llmTrace: refreshOutput.transparency
            ? {
                systemPrompt: refreshOutput.transparency.systemPrompt,
                userPrompt: refreshOutput.transparency.userPrompt,
                rawResponse: refreshOutput.transparency.rawResponse,
                compositionId: refreshOutput.transparency.compositionId,
                blockIds: refreshOutput.transparency.blockIds,
                model: refreshOutput.transparency.model,
                tokens: refreshOutput.transparency.tokens,
                timestamp: refreshOutput.transparency.timestamp,
                operation: 'format_refresh',
              }
            : undefined,
          history: [
            ...(existingAttrs.history || []),
            {
              date: new Date().toISOString(),
              action: 'format_refreshed',
              summary: refreshOutput.changes?.changeSummary || 'Skill format refreshed to current standards',
              user: session.user.id,
            },
          ],
        } as Prisma.InputJsonValue,
      },
    });

    // Build response
    const response: FormatRefreshResponse = {
      id: updatedSkill.id,
      title: updatedSkill.title,
      status: updatedSkill.status,
      content: updatedSkill.content,
      originalContent: skill.content,
      summary: refreshOutput.summary,
      scopeDefinition: updatedScope,
      changes: refreshOutput.changes,
      splitRecommendation: refreshOutput.splitRecommendation,
      promptUsed: {
        composition: 'skill_format_refresh',
        blocksUsed: refreshOutput.transparency?.blockIds || [
          'role_skill_format_refresh',
          'source_fidelity',
          'citation_format',
          'scope_definition',
          'contradiction_detection',
          'diff_output',
          'json_output',
        ],
        systemPrompt: refreshOutput.transparency?.systemPrompt || '',
      },
    };

    logger.info('[Format Refresh V2] Success', {
      skillId,
      title: refreshOutput.title,
      contentLength: refreshOutput.content.length,
      citationCount: refreshOutput.citations.length,
      contradictionCount: refreshOutput.contradictions?.length || 0,
      hasSplitRecommendation: !!refreshOutput.splitRecommendation?.shouldSplit,
      hasScopeDefinition: !!updatedScope?.covers,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[Format Refresh V2] Error', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh skill format',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
