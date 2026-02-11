/**
 * GET /api/v2/contracts/[id]/preview-skills
 *
 * Fetch available skills for contract analysis.
 * User manually selects which skills to use (no LLM matching).
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { generateErrorId } from '@/lib/error-id';
import prisma from '@/lib/prisma';
import type { LibraryId } from '@/types/v2';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    const { searchParams } = new URL(request.url);
    const libraryId = (searchParams.get('libraryId') || 'knowledge') as LibraryId;

    // Verify project exists and user has access
    const project = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        projectType: true,
        customerId: true,
      },
    });

    if (!project) {
      return errors.notFound('Project not found');
    }

    if (project.ownerId !== auth.session.user.id) {
      return errors.forbidden('Access denied');
    }

    if (project.projectType !== 'contract-review') {
      return errors.badRequest('Project is not a contract review project');
    }

    // Fetch library skills
    const librarySkills = await prisma.buildingBlock.findMany({
      where: {
        libraryId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        title: true,
        attributes: true,
      },
      orderBy: {
        title: 'asc',
      },
    });

    // Fetch customer skills if project linked to customer
    let customerSkills: typeof librarySkills = [];
    let customer = null;

    if (project.customerId) {
      customerSkills = await prisma.buildingBlock.findMany({
        where: {
          libraryId: 'customers',
          customerId: project.customerId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          title: true,
          attributes: true,
        },
        orderBy: {
          title: 'asc',
        },
      });

      // Fetch customer info
      customer = await prisma.customer.findUnique({
        where: { id: project.customerId },
        select: {
          id: true,
          company: true,
        },
      });
    }

    // Transform skills for frontend
    const transformSkill = (skill: typeof librarySkills[0], isCustomerSkill: boolean) => {
      const attributes = skill.attributes as { scopeDefinition?: string } | null;
      const scopeCovers = attributes?.scopeDefinition || 'No scope defined';
      const estimatedTokens = Math.ceil(scopeCovers.length / 4); // Rough estimate

      return {
        skillId: skill.id,
        skillTitle: skill.title,
        scopeCovers,
        estimatedTokens,
        isCustomerSkill,
      };
    };

    const skills = [
      ...librarySkills.map(s => transformSkill(s, false)),
      ...customerSkills.map(s => transformSkill(s, true)),
    ];

    return apiSuccess({
      success: true,
      data: {
        projectId: project.id,
        projectName: project.name,
        libraryId,
        customer,
        skills,
        librarySkillCount: librarySkills.length,
        customerSkillCount: customerSkills.length,
      },
    });
  } catch (error) {
    const errorId = generateErrorId();

    logger.error('Failed to fetch skills for contract analysis', error, {
      projectId,
      errorId,
      route: '/api/v2/contracts/[id]/preview-skills',
    });

    return errors.internal(`Failed to fetch skills for contract analysis. Please try again or contact support. (Error ID: ${errorId})`);
  }
}
