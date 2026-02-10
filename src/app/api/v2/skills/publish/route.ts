/**
 * POST /api/v2/skills/publish
 * Save a draft skill and optionally publish it to the library
 * Creates SourceAssignment records linking sources to the skill
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { canManageLibrary } from '@/lib/v2/teams';
import { createAuditEntry, addAuditEntry, getAuditLog } from '@/lib/v2/audit';
import { validateScopeDefinition } from '@/lib/v2/skills/scope-validator';
import type { LibraryId, BlockStatus, ScopeDefinition, SourceCitation, SourceContradiction } from '@/types/v2';

interface Owner {
  id: string;
  name: string;
  email?: string;
  image?: string;
}

interface PublishSkillRequest {
  title: string;
  summary?: string;
  content: string;
  categories?: string[];
  tier?: 'core' | 'extended' | 'library';
  tierOverrides?: Record<string, 'core' | 'extended' | 'library'>;
  libraryId: LibraryId;
  sourceIds?: string[];
  owners?: Owner[];
  status: BlockStatus; // 'DRAFT' or 'ACTIVE'
  customerId?: string;
  skillId?: string; // If updating existing draft/skill
  refreshAction?: 'manual-edit' | 'regenerate' | 'apply-refresh'; // Track what kind of update
  // V2 Skill Building Fields
  scopeDefinition?: ScopeDefinition;
  citations?: SourceCitation[];
  contradictions?: SourceContradiction[];
  // LLM Trace Data (from generation)
  llmTrace?: {
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
  // Additional attributes (keywords, product, etc.)
  attributes?: Record<string, unknown>;
}

interface PublishSkillResponse {
  id: string;
  title: string;
  slug: string | null;
  status: BlockStatus;
  sourceAssignments: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PublishSkillRequest = await request.json();
    const {
      title, summary, content, categories, tierOverrides, owners, attributes, libraryId, sourceIds, status,
      customerId, skillId, refreshAction, scopeDefinition, citations, contradictions, llmTrace
    } = body;

    // Validate inputs
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    if (!libraryId) {
      return NextResponse.json(
        { error: 'Library ID is required' },
        { status: 400 }
      );
    }

    if (!['DRAFT', 'ACTIVE'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be DRAFT or ACTIVE' },
        { status: 400 }
      );
    }

    // Validate scope definition if provided
    if (scopeDefinition) {
      const validationResult = validateScopeDefinition(scopeDefinition);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Invalid scope definition',
            details: validationResult.errors
          },
          { status: 400 }
        );
      }
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, libraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 100);

    let skill;
    let isUpdate = false;

    if (skillId) {
      // UPDATE existing skill
      // Fetch the existing skill first
      const existingSkill = await prisma.buildingBlock.findUnique({
        where: { id: skillId },
      });

      if (!existingSkill) {
        return NextResponse.json(
          { error: 'Skill not found' },
          { status: 404 }
        );
      }

      const updateData: Record<string, unknown> = {
        title,
        slug,
        content,
        status,
      };
      if (summary) {
        updateData.summary = summary;
      }
      if (categories && categories.length > 0) {
        updateData.categories = categories;
      }
      if (owners && owners.length > 0) {
        updateData.ownerId = owners[0].id;
      }

      // Build merged attributes with V2 fields and add audit entry
      const existingAuditLog = getAuditLog(existingSkill.attributes);
      const changesSummary = [];
      if (title !== existingSkill.title) changesSummary.push('title');
      if (content !== existingSkill.content) changesSummary.push('content');
      if (categories?.join(',') !== existingSkill.categories?.join(',')) changesSummary.push('categories');

      const updateAuditEntry = createAuditEntry(
        refreshAction === 'regenerate' ? 'refreshed' : 'updated',
        refreshAction === 'regenerate'
          ? 'Refreshed content from sources'
          : changesSummary.length > 0
          ? `Updated: ${changesSummary.join(', ')}`
          : 'Updated',
        session.user.id,
        session.user.name || undefined,
        session.user.email || undefined
      );

      updateData.attributes = buildSkillAttributes(
        existingSkill.attributes as Record<string, unknown>,
        {
          scopeDefinition,
          citations,
          contradictions,
          llmTrace,
          tierOverrides: tierOverrides || (existingSkill.attributes as Record<string, unknown>)?.tierOverrides || {},
          owners: owners || (existingSkill.attributes as Record<string, unknown>)?.owners || [],
          auditLog: addAuditEntry(existingAuditLog, updateAuditEntry),
          ...attributes,
        }
      );
      skill = await prisma.buildingBlock.update({
        where: { id: skillId },
        data: updateData,
      });
      isUpdate = true;
    } else {
      // CREATE new skill
      // Get user's team
      let userTeams = await prisma.teamMembership.findFirst({
        where: {
          userId: session.user.id,
          role: { in: ['OWNER', 'ADMIN'] },
        },
        select: { teamId: true },
      });

      let teamId = userTeams?.teamId;

      // If no admin team, try to find any team membership
      if (!teamId) {
        userTeams = await prisma.teamMembership.findFirst({
          where: {
            userId: session.user.id,
          },
          select: { teamId: true },
        });
        teamId = userTeams?.teamId;
      }

      // If still no team, create a default one (for local dev)
      if (!teamId) {
        const defaultTeam = await prisma.team.create({
          data: {
            name: `${session.user.name || 'User'}'s Team`,
            slug: `team-${session.user.id.substring(0, 8)}-${Date.now().toString(36)}`,
          },
        });

        await prisma.teamMembership.create({
          data: {
            userId: session.user.id,
            teamId: defaultTeam.id,
            role: 'OWNER',
          },
        });

        teamId = defaultTeam.id;
      }

      // Build attributes with V2 fields and metadata
      const auditLog = createAuditEntry(
        'created',
        `Created skill "${title}"`,
        session.user.id,
        session.user.name || undefined,
        session.user.email || undefined
      );

      const skillAttributes = buildSkillAttributes(
        {},
        {
          scopeDefinition,
          citations,
          contradictions,
          llmTrace,
          tierOverrides: tierOverrides || {},
          owners: owners || [],
          auditLog: { entries: [auditLog] },
          ...attributes,
        }
      );

      const blockData: Prisma.BuildingBlockUncheckedCreateInput = {
        title,
        slug,
        content,
        libraryId,
        blockType: libraryId === 'gtm' ? 'customer' : libraryId === 'it' ? 'it-skill' : 'skill',
        status,
        teamId,
        ownerId: owners && owners.length > 0 ? owners[0].id : session.user.id,
        ...(summary && { summary }),
        ...(categories && categories.length > 0 && { categories }),
        attributes: skillAttributes as Prisma.InputJsonValue,
        ...(customerId && { customerId }),
      };
      skill = await prisma.buildingBlock.create({ data: blockData });
    }

    // Handle source assignments
    let assignmentCount = 0;
    if (sourceIds && sourceIds.length > 0) {
      // Delete existing assignments if updating
      if (isUpdate) {
        await prisma.sourceAssignment.deleteMany({
          where: { blockId: skill.id },
        });
      }

      // Create new assignments with incorporation timestamp
      const assignments = await Promise.all(
        sourceIds.map((stagedSourceId) =>
          prisma.sourceAssignment.create({
            data: {
              blockId: skill.id,
              stagedSourceId,
              assignedAt: new Date(),
              assignedBy: session.user.id,
              incorporatedAt: new Date(),
              incorporatedBy: session.user.id,
            },
          })
        )
      );
      assignmentCount = assignments.length;
    }

    // Add history entry
    const historyEntry = {
      date: new Date().toISOString(),
      action: isUpdate ?
        (refreshAction === 'regenerate' ? 'refreshed' : 'updated') :
        'created',
      summary: isUpdate ?
        (refreshAction === 'regenerate' ? 'Regenerated from sources' : 'Manual edit') :
        'Skill created from sources',
      user: session.user.id,
    };

    const skillAttrs = (skill.attributes as Record<string, unknown>) || {};
    const currentHistory = (skillAttrs.history as Array<Record<string, unknown>>) || [];
    const updatedAttributes: Record<string, unknown> = {
      ...skillAttrs,
      history: [...currentHistory, historyEntry],
      lastRefreshedAt: refreshAction === 'regenerate' ? new Date().toISOString() : skillAttrs.lastRefreshedAt,
    };

    // Update attributes with history
    await prisma.buildingBlock.update({
      where: { id: skill.id },
      data: { attributes: updatedAttributes as Prisma.InputJsonValue },
    });

    const response: PublishSkillResponse = {
      id: skill.id,
      title: skill.title,
      slug: skill.slug,
      status: skill.status as BlockStatus,
      sourceAssignments: assignmentCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error publishing skill:', error);
    // Log full error stack for debugging
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      {
        error: 'Failed to publish skill',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Build skill attributes, merging new V2 fields with existing attributes
 * Validates scopeDefinition and ensures name/description are properly set
 */
function buildSkillAttributes(
  existing: Record<string, unknown> | null | undefined,
  incoming: {
    scopeDefinition?: ScopeDefinition;
    citations?: SourceCitation[];
    contradictions?: SourceContradiction[];
    llmTrace?: {
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
    [key: string]: unknown;
  }
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...(existing || {}),
  };

  // Add V2 fields if provided
  if (incoming.scopeDefinition) {
    // Validation already done in POST handler, but validate again here for safety
    const validationResult = validateScopeDefinition(incoming.scopeDefinition);
    if (validationResult.success) {
      merged.scopeDefinition = validationResult.data;
    } else {
      console.error('[buildSkillAttributes] Scope validation failed:', {
        incoming: incoming.scopeDefinition,
        errors: validationResult.errors
      });
      throw new Error(`Invalid scope definition: ${validationResult.errors.join(', ')}`);
    }
  }

  if (incoming.citations) {
    merged.citations = incoming.citations;
  }
  if (incoming.contradictions) {
    merged.contradictions = incoming.contradictions;
  }
  if (incoming.llmTrace) {
    merged.llmTrace = incoming.llmTrace;
  }

  // Add any other attributes (V2 fields already handled above)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { scopeDefinition: _sd, citations: _c, contradictions: _ct, llmTrace: _lt, ...otherAttrs } = incoming;
  Object.assign(merged, otherAttrs);

  return merged;
}
