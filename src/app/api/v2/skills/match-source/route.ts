/**
 * POST /api/v2/skills/match-source
 * Match a source to existing skills based on scope definitions
 *
 * Uses the v2 skill matching service to recommend which existing skills
 * a source should be added to, or if a new skill should be created.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { canManageLibrary } from '@/lib/v2/teams';
import { matchSourceToSkills } from '@/lib/v2/skills';
import { logger } from '@/lib/logger';
import type { LibraryId } from '@/types/v2';

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

interface MatchSourceRequest {
  sourceId: string;
  libraryId: LibraryId;
  additionalContext?: string;
}

interface MatchSourceResponse {
  matches: Array<{
    skillId: string;
    skillTitle: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    matchedCriteria: string;
    suggestedExcerpt: string;
  }>;
  createNew?: {
    recommended: boolean;
    suggestedTitle: string;
    suggestedScope: {
      covers: string;
      futureAdditions: string[];
    };
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

    const body: MatchSourceRequest = await request.json();
    const { sourceId, libraryId, additionalContext } = body;

    // Validate inputs
    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId is required' },
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

    // Fetch the source
    const source = await prisma.stagedSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    if (source.libraryId !== libraryId) {
      return NextResponse.json(
        { error: 'Source does not belong to this library' },
        { status: 400 }
      );
    }

    // Fetch existing skills for the library with their scope definitions
    const existingSkills = await prisma.buildingBlock.findMany({
      where: {
        libraryId,
        status: { in: ['DRAFT', 'ACTIVE'] },
      },
      select: {
        id: true,
        title: true,
        attributes: true,
      },
    });

    // Format skills for matching service
    const skillsForMatching = existingSkills.map(skill => {
      const attrs = (skill.attributes as Record<string, unknown>) || {};
      const scope = attrs.scopeDefinition as { covers?: string; futureAdditions?: string[]; notIncluded?: string[] } | undefined;
      return {
        id: skill.id,
        title: skill.title,
        scopeDefinition: scope
          ? {
              covers: scope.covers || 'Not defined',
              futureAdditions: scope.futureAdditions || [],
              notIncluded: scope.notIncluded,
            }
          : {
              covers: 'Not defined',
              futureAdditions: [],
            },
      };
    });

    // Log what we're sending for debugging
    logger.debug('[Skill Matching V2] Matching source', {
      sourceId,
      libraryId,
      sourceTitle: source.title,
      sourceType: source.sourceType,
      existingSkillsCount: skillsForMatching.length,
    });

    // Use V2 skill matching service
    const matchingOutput = await matchSourceToSkills({
      source: {
        id: source.id,
        type: source.sourceType,
        label: source.title,
        content: source.content || '',
      },
      existingSkills: skillsForMatching,
      libraryId,
      additionalContext,
    });

    // Build response
    const response: MatchSourceResponse = {
      matches: matchingOutput.matches,
      createNew: matchingOutput.createNew,
    };

    logger.info('[Skill Matching V2] Success', {
      sourceId,
      matchCount: matchingOutput.matches.length,
      recommendCreate: matchingOutput.createNew?.recommended || false,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[Skill Matching V2] Error', error);
    return NextResponse.json(
      {
        error: 'Failed to match source',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
