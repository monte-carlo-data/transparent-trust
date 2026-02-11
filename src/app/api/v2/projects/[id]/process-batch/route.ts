/**
 * Process Batch API (No Clustering)
 *
 * POST /api/v2/projects/[projectId]/process-batch
 *
 * Processes ALL questions in batches with a single skill set.
 *
 * When Redis is configured: Enqueues job and returns immediately.
 * When Redis is not configured: Runs synchronously (fire-and-forget from frontend).
 *
 * Body:
 * - skillIds: string[] - Skills to apply to ALL questions
 * - batchSize: number - Questions per batch (5-50)
 * - libraryId: LibraryId
 * - modelSpeed: 'quality' | 'balanced' | 'fast'
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { generateErrorId } from '@/lib/error-id';
import prisma from '@/lib/prisma';
import { isQueueConfigured } from '@/lib/queue/config';
import { addJob, QUEUE_NAMES } from '@/lib/queue/client';
import { processProjectBatches } from '@/lib/v2/rfp/batch-processor';
import type { LibraryId } from '@/types/v2';
import type { ModelSpeed } from '@/lib/config';

type RouteParams = { params: Promise<{ id: string }> };

interface ProcessBatchRequest {
  skillIds: string[];
  batchSize: number;
  libraryId: LibraryId;
  modelSpeed: ModelSpeed;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    const body = (await request.json()) as ProcessBatchRequest;
    const { skillIds, batchSize, libraryId, modelSpeed } = body;

    // Validation
    if (!skillIds || !Array.isArray(skillIds) || skillIds.length === 0) {
      return errors.badRequest('skillIds is required and must be a non-empty array');
    }

    if (!batchSize || batchSize < 5 || batchSize > 50) {
      return errors.badRequest('batchSize must be between 5 and 50');
    }

    // Verify project exists and user has access
    const project = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        status: true,
        customerId: true,
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

    // Verify skills exist (check both library and customer skills)
    const librarySkillCount = await prisma.buildingBlock.count({
      where: {
        id: { in: skillIds },
        libraryId,
        status: 'ACTIVE',
      },
    });

    let customerSkillCount = 0;
    if (project.customerId) {
      customerSkillCount = await prisma.buildingBlock.count({
        where: {
          id: { in: skillIds },
          libraryId: 'customers',
          customerId: project.customerId,
          status: 'ACTIVE',
        },
      });
    }

    const totalSkillCount = librarySkillCount + customerSkillCount;
    if (totalSkillCount === 0) {
      return errors.badRequest('No valid skills found');
    }

    // Check if Redis/queue is configured
    if (isQueueConfigured()) {
      // ASYNC PATH: Enqueue job and return immediately
      logger.info('Enqueueing batch processing job (async)', {
        projectId,
        projectName: project.name,
        questionCount: project._count.rows,
        batchSize,
        skillCount: totalSkillCount,
        librarySkillCount,
        customerSkillCount,
        libraryId,
        modelSpeed,
      });

      // Update project status to PROCESSING before enqueueing
      await prisma.bulkProject.update({
        where: { id: projectId },
        data: { status: 'PROCESSING' },
      });

      const jobId = await addJob(
        QUEUE_NAMES.BULK_OPERATIONS,
        'process_project_answers',
        {
          type: 'process_project_answers',
          projectId,
          skillIds,
          batchSize,
          libraryId,
          modelSpeed,
          userId: auth.session.user.id,
          userEmail: auth.session.user.email || undefined,
        }
      );

      return apiSuccess({
        success: true,
        data: {
          projectId,
          jobId,
          mode: 'async',
          message: 'Processing job enqueued. Poll status endpoint for progress.',
          totalQuestions: project._count.rows,
          batchSize,
          skillCount: totalSkillCount,
        },
      });
    } else {
      // SYNC PATH: Fire-and-forget (fallback when Redis not configured)
      // Return immediately and let frontend poll for status to avoid 504 timeouts
      logger.info('Starting batch processing (sync fire-and-forget)', {
        projectId,
        projectName: project.name,
        questionCount: project._count.rows,
        batchSize,
        skillCount: totalSkillCount,
        librarySkillCount,
        customerSkillCount,
        libraryId,
        modelSpeed,
      });

      // Update project status to PROCESSING before starting
      await prisma.bulkProject.update({
        where: { id: projectId },
        data: { status: 'PROCESSING' },
      });

      // Fire-and-forget: start processing without awaiting
      // This prevents 504 gateway timeouts on long-running batches
      processProjectBatches({
        projectId,
        skillIds,
        batchSize,
        libraryId,
        modelSpeed,
      }).catch((error) => {
        const errorId = generateErrorId();
        logger.error('Background batch processing failed', error, {
          projectId,
          errorId,
          route: '/api/v2/projects/[id]/process-batch',
        });
        // Update status to ERROR (fire-and-forget)
        prisma.bulkProject
          .update({
            where: { id: projectId },
            data: { status: 'ERROR' },
          })
          .catch((statusError) => {
            logger.error('Failed to update project status to ERROR after batch failure', statusError, {
              projectId,
              errorId,
              route: '/api/v2/projects/[id]/process-batch',
              originalError: error instanceof Error ? error.message : 'Unknown',
            });
          });
      });

      return apiSuccess({
        success: true,
        data: {
          projectId,
          mode: 'sync-background',
          message: 'Processing started. Poll status endpoint for progress.',
          totalQuestions: project._count.rows,
          batchSize,
          skillCount: totalSkillCount,
        },
      });
    }
  } catch (error) {
    const errorId = generateErrorId();
    logger.error('Failed to process batches', error, {
      projectId,
      errorId,
      route: '/api/v2/projects/[id]/process-batch',
    });

    // Update project status to ERROR
    await prisma.bulkProject
      .update({
        where: { id: projectId },
        data: { status: 'ERROR' },
      })
      .catch((statusError) => {
        logger.error('Failed to update project status to ERROR', statusError, {
          projectId,
          errorId,
          route: '/api/v2/projects/[id]/process-batch',
          originalError: error instanceof Error ? error.message : 'Unknown',
        });
      });

    if (error instanceof Error) {
      return errors.badRequest(`${error.message} [${errorId}]`);
    }

    return errors.internal(`Failed to process batches [${errorId}]`);
  }
}
