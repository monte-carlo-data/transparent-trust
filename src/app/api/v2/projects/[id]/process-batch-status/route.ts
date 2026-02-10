/**
 * Batch Processing Status API
 *
 * GET /api/v2/projects/[projectId]/process-batch-status
 *
 * Returns real-time status of batch processing (no clustering).
 * Used for polling during processing step.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { generateErrorId } from '@/lib/error-id';
import prisma from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

// Disable caching for real-time status polling
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    // Fetch project
    const project = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        status: true,
        _count: {
          select: { rows: true },
        },
      },
    });

    if (!project) {
      return errors.notFound('Project not found');
    }

    if (project.ownerId !== auth.session.user.id) {
      return errors.forbidden('Access denied');
    }

    // Fetch row counts by status
    const statusCounts = await prisma.bulkRow.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    });

    const totalRows = project._count.rows;
    const completedRows =
      statusCounts.find((s) => s.status === 'COMPLETED')?._count || 0;
    const errorRows =
      statusCounts.find((s) => s.status === 'ERROR')?._count || 0;
    const pendingRows =
      statusCounts.find((s) => s.status === 'PENDING')?._count || 0;

    const completionPercent = totalRows > 0
      ? Math.round((completedRows / totalRows) * 100)
      : 0;

    // Determine overall status
    let overallStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' = 'PENDING';
    if (project.status === 'PROCESSING') {
      overallStatus = 'PROCESSING';
    } else if (project.status === 'COMPLETED') {
      overallStatus = 'COMPLETED';
    } else if (project.status === 'ERROR' || errorRows > 0) {
      overallStatus = 'ERROR';
    }

    logger.debug('Batch processing status polled', {
      projectId,
      totalRows,
      completedRows,
      errorRows,
      pendingRows,
      status: overallStatus,
    });

    const response = apiSuccess({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        projectStatus: overallStatus,
        totalRows,
        completedRows,
        errorRows,
        pendingRows,
        completionPercent,
      },
    });

    // Ensure no caching of status responses
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    return response;
  } catch (error) {
    const errorId = generateErrorId();
    logger.error('Failed to fetch batch processing status', error, {
      projectId,
      errorId,
      route: '/api/v2/projects/[id]/process-batch-status',
    });

    const errorResponse = errors.internal(`Failed to fetch processing status [${errorId}]`);
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return errorResponse;
  }
}
