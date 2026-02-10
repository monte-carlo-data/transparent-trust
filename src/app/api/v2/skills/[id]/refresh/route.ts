/**
 * POST /api/v2/skills/[id]/refresh
 * Refresh an existing skill with new source material
 *
 * Updates a skill with new sources, generates a diff showing what changed,
 * and detects any contradictions between sources.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { canManageLibrary } from '@/lib/v2/teams';
import { updateSkill as updateSkillOrchestrator, getRefreshMode } from '@/lib/v2/skills/skill-orchestrator';
import { urlAdapter } from '@/lib/v2/sources/adapters/url-adapter';
import { getScopeFromContent, hasEmbeddedScope } from '@/lib/v2/skills/content-parser';
import { validateScopeDefinition } from '@/lib/v2/skills/scope-validator';
import { logger } from '@/lib/logger';
import type { LibraryId } from '@/types/v2';
import type { StagedSource } from '@prisma/client';

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

interface RefreshSkillRequest {
  sourceIds: string[];
  additionalContext?: string;
  forceRegenerate?: boolean; // Force full regeneration even with no new sources
}

interface RefreshSkillResponse {
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
  citations: Array<{
    id: string;
    sourceId: string;
    label: string;
    url?: string;
  }>;
  contradictions?: Array<{
    type: string;
    description: string;
    sourceA: { id: string; label: string; excerpt: string };
    sourceB: { id: string; label: string; excerpt: string };
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
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
    logger.warn('[Skill Refresh] URL source has no URL to fetch', { sourceId: source.id });
    return '';
  }

  try {
    logger.debug('[Skill Refresh] Fetching content for URL source', { sourceId: source.id, url });
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

      logger.debug('[Skill Refresh] Successfully fetched URL content', {
        sourceId: source.id,
        contentLength: fetched.content.length
      });

      return fetched.content;
    }
  } catch (error) {
    logger.error('[Skill Refresh] Failed to fetch URL content', error, {
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

    const body: RefreshSkillRequest = await request.json();
    const { sourceIds = [], forceRegenerate = false } = body;

    // Validate inputs - allow empty sourceIds for refreshing with existing sources
    if (sourceIds.length > 15) {
      return NextResponse.json(
        { error: 'Maximum 15 sources allowed per refresh' },
        { status: 400 }
      );
    }

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

    // Fetch the new sources (if any provided)
    let newSources: StagedSource[] = [];
    if (sourceIds.length > 0) {
      newSources = await prisma.stagedSource.findMany({
        where: {
          id: { in: sourceIds },
          libraryId,
        },
      });

      if (newSources.length !== sourceIds.length) {
        return NextResponse.json(
          { error: 'Some sources were not found or do not belong to this library' },
          { status: 404 }
        );
      }

      // Validate that new sources have either content or a URL to work with (allow URL sources even if fetch failed)
      const sourcesWithoutContentOrUrl = newSources.filter(s => {
        const hasContent = s.content && s.content.trim().length > 0;
        const hasUrl = s.sourceType === 'url' || (s.metadata && typeof s.metadata === 'object' && 'url' in s.metadata);
        return !hasContent && !hasUrl;
      });
      if (sourcesWithoutContentOrUrl.length > 0) {
        return NextResponse.json(
          {
            error: 'Some sources do not have content',
            details: `Sources ${sourcesWithoutContentOrUrl.map(s => s.id).join(', ')} are missing content and cannot be used for skill refresh.`,
          },
          { status: 400 }
        );
      }
    }

    // Log what we're doing
    logger.debug('[Skill Refresh V2] Refreshing skill', {
      skillId,
      skillTitle: skill.title,
      libraryId,
      sourceCount: newSources.length,
      sources: newSources.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.sourceType,
      })),
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
    type ScopeDefinition = { covers: string; futureAdditions: string[]; notIncluded?: string[] };
    type Citation = { id: string; sourceId: string; label: string; url?: string };

    const typedScope =
      (existingAttrs.scopeDefinition as ScopeDefinition | undefined) || undefined;
    const typedCitations = Array.isArray(existingAttrs.citations)
      ? (existingAttrs.citations as Citation[])
      : undefined;

    const existingSkillData = {
      id: skill.id,
      title: skill.title,
      content: skill.content,
      scopeDefinition: typedScope,
      citations: typedCitations,
    };

    // Fetch original sources that were incorporated into this skill
    const incorporatedSources = await prisma.sourceAssignment.findMany({
      where: {
        blockId: skillId,
        incorporatedAt: { not: null },
      },
      include: {
        stagedSource: true,
      },
    });

    // Filter to only refreshable source types (URL, Notion)
    // Slack/Zendesk are ephemeral conversations - their content was already extracted
    // and incorporated into the skill, no need to re-send them on refresh
    const refreshableSourceTypes = ['url', 'notion'];
    const refreshableSources = incorporatedSources.filter(
      (a) => refreshableSourceTypes.includes(a.stagedSource.sourceType)
    );

    // Map refreshable sources for context (fetch URL content if missing)
    const originalSourcesForContext = await Promise.all(
      refreshableSources.map(async (a) => {
        const content = await fetchUrlContentIfMissing(a.stagedSource);
        return {
          id: a.stagedSource.id,
          type: a.stagedSource.sourceType,
          label: a.stagedSource.title,
          url: a.stagedSource.sourceType === 'url' ? a.stagedSource.externalId : undefined,
          content,
        };
      })
    );

    // Process new sources (ensure content is available for all types)
    const newSourcesWithContent = await Promise.all(
      newSources.map(async (s) => {
        let content = s.content || '';

        // For URL sources, try to fetch content if missing
        if (s.sourceType === 'url' && (!content || content.trim().length === 0)) {
          content = await fetchUrlContentIfMissing(s);
        }

        // Validate that we have content
        if (!content || content.trim().length === 0) {
          logger.warn('[Skill Refresh] Source has no content available', {
            sourceId: s.id,
            sourceType: s.sourceType,
            title: s.title,
          });
        }

        return {
          id: s.id,
          type: s.sourceType,
          label: s.title,
          url: s.sourceType === 'url' ? s.externalId : undefined,
          content,
        };
      })
    );

    // Combine original and new sources for the update
    // Filter out sources with no content to avoid sending empty material to LLM
    const validNewSources = newSourcesWithContent.filter(s => s.content && s.content.trim().length > 0);
    const allSourcesForUpdate = [...originalSourcesForContext, ...validNewSources];

    // Check if scope is missing and needs to be generated
    const needsScopeGeneration = !typedScope?.covers && !hasEmbeddedScope(skill.content);

    logger.debug('[Skill Refresh V2] Sources for LLM', {
      skillId,
      refreshableSources: refreshableSources.length,
      skippedSources: incorporatedSources.length - refreshableSources.length,
      newSources: newSourcesWithContent.length,
      totalForLLM: allSourcesForUpdate.length,
      needsScopeGeneration,
      forceRegenerate,
    });

    // Determine refresh mode from skill attributes
    const refreshMode = getRefreshMode(skill.attributes as Record<string, unknown>);

    logger.debug('[Skill Refresh V2] Using refresh mode', { refreshMode });

    // Use orchestrator to route to correct service based on mode
    const updateOutput = await updateSkillOrchestrator({
      existingSkill: existingSkillData,
      newSources: validNewSources, // Only the new sources being added
      refreshMode,
      libraryId,
      // For regenerative mode, include all sources
      allSources: refreshMode === 'regenerative' ? allSourcesForUpdate : undefined,
      customerId: skill.customerId || undefined,
    });

    // Extract scope definition from the refreshed content (LLM embeds it in ## Scope Definition section)
    // Also try parsing from existing content if LLM didn't generate new scope
    // Validate at each step and fail loudly if scope is empty
    let parsedScopeFromOutput;
    let parsedScopeFromExisting;

    try {
      parsedScopeFromOutput = getScopeFromContent(updateOutput.content);
    } catch (error) {
      logger.warn('[Skill Refresh] Failed to parse scope from LLM output', error);
    }

    try {
      parsedScopeFromExisting = getScopeFromContent(skill.content);
    } catch (error) {
      logger.warn('[Skill Refresh] Failed to parse scope from existing content', error);
    }

    // Determine the final scope - with validation
    const updatedScope = parsedScopeFromOutput || parsedScopeFromExisting || typedScope;

    // Validate that we have a non-empty scope
    if (!updatedScope?.covers || !updatedScope.covers.trim()) {
      logger.error('[Skill Refresh] Skill is missing scope definition after refresh', undefined, {
        skillId,
        hasOutputScope: !!parsedScopeFromOutput,
        hasExistingScope: !!parsedScopeFromExisting,
        hasAttributeScope: !!typedScope?.covers,
      });
      return NextResponse.json(
        {
          error: 'Skill refresh failed: missing scope definition',
          details: 'The LLM did not generate a scope definition and none could be recovered from existing content or attributes. Please try again or provide additional context.'
        },
        { status: 400 }
      );
    }

    // Validate the final scope
    const scopeValidation = validateScopeDefinition(updatedScope);
    if (!scopeValidation.success) {
      logger.error('[Skill Refresh] Invalid scope definition after refresh', undefined, {
        skillId,
        errors: scopeValidation.errors
      });
      return NextResponse.json(
        {
          error: 'Skill refresh failed: invalid scope definition',
          details: scopeValidation.errors
        },
        { status: 400 }
      );
    }

    logger.debug('[Skill Refresh V2] Scope extraction', {
      skillId,
      hasOutputScope: !!parsedScopeFromOutput,
      hasExistingContentScope: !!parsedScopeFromExisting,
      hasAttributeScope: !!typedScope?.covers,
      finalScopeCovers: updatedScope.covers?.substring(0, 50),
    });

    // Update the skill in database
    const updatedSkill = await prisma.buildingBlock.update({
      where: { id: skillId },
      data: {
        title: updateOutput.title,
        content: updateOutput.content,
        attributes: {
          ...((skill.attributes as Record<string, unknown>) || {}),
          summary: updateOutput.summary,
          scopeDefinition: updatedScope as unknown as Record<string, unknown>,
          citations: updateOutput.citations,
          contradictions: updateOutput.contradictions,
          lastRefreshedAt: new Date().toISOString(),
          llmTrace: updateOutput.transparency
            ? {
                systemPrompt: updateOutput.transparency.systemPrompt,
                userPrompt: updateOutput.transparency.userPrompt,
                rawResponse: updateOutput.transparency.rawResponse,
                compositionId: updateOutput.transparency.compositionId,
                blockIds: updateOutput.transparency.blockIds,
                model: updateOutput.transparency.model,
                tokens: updateOutput.transparency.tokens,
                timestamp: updateOutput.transparency.timestamp,
                operation: 'refresh',
              }
            : undefined,
          history: [
            ...(existingAttrs.history || []),
            {
              date: new Date().toISOString(),
              action: 'refreshed',
              summary: updateOutput.changes?.changeSummary || 'Skill refreshed with new sources',
              user: session.user.id,
            },
          ],
        } as Prisma.InputJsonValue,
      },
    });

    // Mark the pending source assignments as incorporated
    // For foundational skills, also store the extractedContent
    const extractedContentMap = new Map<string, string>();
    if ('extractedContent' in updateOutput && Array.isArray(updateOutput.extractedContent)) {
      updateOutput.extractedContent.forEach((ec: { sourceId: string; extracted: string }) => {
        extractedContentMap.set(ec.sourceId, ec.extracted);
      });
    }

    // Update each source assignment individually
    // TODO: Once migration is applied, add extractedContent to the update
    for (const sourceId of sourceIds) {
      // const extracted = extractedContentMap.get(sourceId);
      const updateData = {
        incorporatedAt: new Date(),
        incorporatedBy: session.user.id,
      };

      // After migration is applied, uncomment this:
      // const extracted = extractedContentMap.get(sourceId);
      // if (extracted) {
      //   updateData.extractedContent = extracted;
      // }

      await prisma.sourceAssignment.updateMany({
        where: {
          blockId: skillId,
          stagedSourceId: sourceId,
          incorporatedAt: null,
        },
        data: updateData,
      });
    }

    // Build response
    const response: RefreshSkillResponse = {
      id: updatedSkill.id,
      title: updatedSkill.title,
      status: updatedSkill.status,
      content: updatedSkill.content,
      originalContent: skill.content,
      summary: updateOutput.summary,
      scopeDefinition: updatedScope,
      citations: updateOutput.citations,
      contradictions: updateOutput.contradictions,
      changes: updateOutput.changes,
      splitRecommendation: updateOutput.splitRecommendation,
      promptUsed: {
        composition: 'skill_update',
        blocksUsed: updateOutput.transparency?.blockIds || [
          'role_skill_update',
          'source_fidelity',
          'citation_format',
          'scope_definition',
          'contradiction_detection',
          'diff_output',
          'json_output',
        ],
        systemPrompt: updateOutput.transparency?.systemPrompt || '',
      },
    };

    logger.info('[Skill Refresh V2] Success', {
      skillId,
      title: updateOutput.title,
      contentLength: updateOutput.content.length,
      citationCount: updateOutput.citations.length,
      contradictionCount: updateOutput.contradictions?.length || 0,
      hasSplitRecommendation: !!updateOutput.splitRecommendation?.shouldSplit,
      hasScopeDefinition: !!updatedScope?.covers,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[Skill Refresh V2] Error', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh skill',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
