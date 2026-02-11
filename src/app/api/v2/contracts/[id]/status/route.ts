/**
 * GET /api/v2/contracts/[id]/status
 *
 * Return current status of contract analysis for polling.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { generateErrorId } from '@/lib/error-id';
import prisma from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

export const revalidate = 0; // Disable caching for polling

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    const project = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        status: true,
        rows: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!project) {
      return errors.notFound('Project not found');
    }

    if (project.ownerId !== auth.session.user.id) {
      return errors.forbidden('Access denied');
    }

    const row = project.rows[0];
    const response = apiSuccess({
      success: true,
      data: {
        projectId: project.id,
        projectName: project.name,
        projectStatus: project.status,
        rowStatus: row?.status || 'PENDING',
        isProcessing: project.status === 'PROCESSING',
      },
    });

    // Prevent caching for polling
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    return response;
  } catch (error) {
    const errorId = generateErrorId();

    logger.error('Failed to fetch contract status', error, {
      projectId,
      errorId,
      route: '/api/v2/contracts/[id]/status',
    });

    return errors.internal(`Failed to fetch contract status. Please try again. (Error ID: ${errorId})`);
  }
}
