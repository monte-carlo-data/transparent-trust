/**
 * Cancel RFP Processing
 *
 * POST /api/v2/projects/[projectId]/cancel
 *
 * Stops ongoing processing for a project by:
 * 1. Setting project status back to DRAFT
 * 2. Keeping completed rows, marking in-flight rows as PENDING
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    // Verify project exists and user has access
    const project = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        status: true,
      },
    });

    if (!project) {
      return errors.notFound('Project not found');
    }

    if (project.ownerId !== auth.session.user.id) {
      // TODO: Check team membership
      return errors.forbidden('Access denied');
    }

    logger.info('Canceling project processing', {
      projectId,
      projectName: project.name,
      currentStatus: project.status,
    });

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Reset project status
      await tx.bulkProject.update({
        where: { id: projectId },
        data: {
          status: 'DRAFT',
        },
      });

      // Mark in-flight rows as PENDING (keep completed rows)
      await tx.bulkRow.updateMany({
        where: {
          projectId,
          status: 'PROCESSING',
        },
        data: {
          status: 'PENDING',
        },
      });
    });

    logger.info('Project processing canceled', {
      projectId,
      projectName: project.name,
    });

    return apiSuccess({
      success: true,
      message: 'Processing canceled successfully',
      data: {
        projectId,
      },
    });
  } catch (error) {
    logger.error('Failed to cancel processing', error, {
      projectId,
      route: '/api/v2/projects/[id]/cancel',
    });

    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }

    return errors.internal('Failed to cancel processing');
  }
}
