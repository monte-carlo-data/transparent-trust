/**
 * POST /api/v2/contracts/[id]/analyze
 *
 * Trigger contract analysis with selected skills.
 * Returns immediately and processes in background.
 * Frontend should poll /api/v2/contracts/[id]/status for progress.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { generateErrorId } from '@/lib/error-id';
import prisma from '@/lib/prisma';
import { processContract } from '@/lib/v2/contracts/contract-processor';
import { isQueueConfigured } from '@/lib/queue/config';
import { addJob, QUEUE_NAMES } from '@/lib/queue/client';
import type { LibraryId } from '@/types/v2';
import type { ModelSpeed } from '@/lib/config';

type RouteParams = { params: Promise<{ id: string }> };

interface AnalyzeContractRequest {
  skillIds: string[];
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
    const body = (await request.json()) as AnalyzeContractRequest;
    const { skillIds, libraryId, modelSpeed } = body;

    // Validation
    if (!skillIds || !Array.isArray(skillIds) || skillIds.length === 0) {
      return errors.badRequest('skillIds is required and must be a non-empty array');
    }

    if (!libraryId) {
      return errors.badRequest('libraryId is required');
    }

    if (!modelSpeed || !['quality', 'balanced', 'fast'].includes(modelSpeed)) {
      return errors.badRequest('modelSpeed must be quality, balanced, or fast');
    }

    // Verify project exists and user has access
    const project = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        projectType: true,
        status: true,
        customerId: true,
        fileContext: true,
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

    if (!project.fileContext || project.fileContext.length === 0) {
      return errors.badRequest('No contract text found. Please upload a contract first.');
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
      logger.info('Enqueueing contract analysis job (async)', {
        projectId,
        projectName: project.name,
        skillCount: totalSkillCount,
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
        'process_contract_analysis',
        {
          type: 'process_contract_analysis',
          projectId,
          skillIds,
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
          message: 'Analysis job enqueued. Poll status endpoint for progress.',
          skillCount: totalSkillCount,
        },
      });
    } else {
      // SYNC PATH: Fire-and-forget (fallback when Redis not configured)
      logger.info('Starting contract analysis (sync fire-and-forget)', {
        projectId,
        projectName: project.name,
        skillCount: totalSkillCount,
        libraryId,
        modelSpeed,
      });

      // Update project status to PROCESSING before starting
      await prisma.bulkProject.update({
        where: { id: projectId },
        data: { status: 'PROCESSING' },
      });

      // Fire-and-forget: start processing without awaiting
      // Note: processContract handles all errors internally and updates project status to ERROR
      void processContract({
        projectId,
        skillIds,
        libraryId,
        modelSpeed,
      });

      return apiSuccess({
        success: true,
        data: {
          projectId,
          mode: 'sync-background',
          message: 'Analysis started. Poll status endpoint for progress.',
          skillCount: totalSkillCount,
        },
      });
    }
  } catch (error) {
    const errorId = generateErrorId();

    logger.error('Failed to start contract analysis', error, {
      projectId,
      errorId,
      route: '/api/v2/contracts/[id]/analyze',
    });

    if (error instanceof Error) {
      return errors.badRequest(`Unable to start analysis: ${error.message} (Error ID: ${errorId})`);
    }

    return errors.internal(`Failed to start contract analysis. Please try again or contact support. (Error ID: ${errorId})`);
  }
}
