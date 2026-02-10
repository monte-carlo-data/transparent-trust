/**
 * POST /api/v2/skills/promote
 * Promote a customer-scoped skill to the GTM Skills library
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { canManageLibrary } from '@/lib/v2/teams';
import type { GTMSkillAttributes } from '@/types/v2';

interface PromoteSkillRequest {
  sourceSkillId: string;
  targetLibraryId: 'gtm';
  generalize?: boolean;
  vertical?: string;
  useCase?: string;
  dealStage?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PromoteSkillRequest = await request.json();
    const { sourceSkillId, targetLibraryId, vertical, useCase, dealStage } = body;

    // Validate target library
    if (targetLibraryId !== 'gtm') {
      return NextResponse.json(
        { error: 'Only promotion to gtm is supported' },
        { status: 400 }
      );
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, targetLibraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    // Fetch source skill
    const sourceSkill = await prisma.buildingBlock.findUnique({
      where: { id: sourceSkillId },
    });

    if (!sourceSkill) {
      return NextResponse.json(
        { error: 'Source skill not found' },
        { status: 404 }
      );
    }

    if (sourceSkill.libraryId !== 'gtm') {
      return NextResponse.json(
        { error: 'Can only promote skills from gtm library' },
        { status: 400 }
      );
    }

    // Create promoted GTM skill
    // Extract only the relevant base attributes, excluding customer-specific fields
    const sourceAttrs = (sourceSkill.attributes as Record<string, unknown>) || {};
    const { ...baseAttributes } = sourceAttrs;
    // Note: intentionally excluding customer-specific fields (company, industry, tier, contacts, products, healthScore, crmId)
    const gtmAttributes: GTMSkillAttributes = {
      ...baseAttributes,
      vertical,
      useCase,
      dealStage,
      promotedFrom: sourceSkill.id,
    };

    const gtmSkill = await prisma.buildingBlock.create({
      data: {
        title: sourceSkill.title,
        slug: null, // Will be generated on save
        content: sourceSkill.content,
        summary: sourceSkill.summary,
        libraryId: targetLibraryId,
        blockType: 'knowledge',
        status: 'DRAFT',
        syncStatus: 'LOCAL_CHANGES',
        attributes: gtmAttributes as Prisma.InputJsonValue,
        teamId: sourceSkill.teamId,
      },
    });

    return NextResponse.json({
      success: true,
      promotedSkillId: gtmSkill.id,
      message: `Skill promoted to GTM Skills library as draft`,
    });
  } catch (error) {
    console.error('Error promoting skill:', error);
    return NextResponse.json(
      { error: 'Failed to promote skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
