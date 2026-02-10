/**
 * RFP Batch Processor
 *
 * Core processing logic for RFP batch operations.
 * Used by both:
 * - API endpoint (sync fallback when Redis not configured)
 * - Background worker (async when Redis is available)
 *
 * Updates DB after each batch so polling can show progress.
 */

import prisma from '@/lib/prisma';
import { answerQuestionsBatch } from '@/lib/llm';
import { logger } from '@/lib/logger';
import { generateErrorId } from '@/lib/error-id';
import type { LibraryId } from '@/types/v2';
import type { ModelSpeed } from '@/lib/config';
import { fetchRFPSkills } from './skill-fetcher';

export interface BatchProcessorParams {
  projectId: string;
  skillIds: string[];
  batchSize: number;
  libraryId: LibraryId;
  modelSpeed: ModelSpeed;
  onBatchComplete?: (batchNumber: number, totalBatches: number, processedCount: number) => void;
}

export interface BatchProcessorResult {
  projectId: string;
  totalQuestions: number;
  totalProcessed: number;
  totalErrors: number;
  batchCount: number;
  batchResults: Array<{
    batchNumber: number;
    questionCount: number;
    processedCount: number;
    status: 'COMPLETED' | 'ERROR';
    error?: string;
  }>;
}

/**
 * Process all questions in a project in batches.
 * Updates DB after each batch for real-time progress tracking.
 */
export async function processProjectBatches(
  params: BatchProcessorParams
): Promise<BatchProcessorResult> {
  const { projectId, skillIds, batchSize, libraryId, modelSpeed, onBatchComplete } = params;

  // Verify project exists
  const project = await prisma.bulkProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      fileContext: true,
      customerId: true,
      _count: { select: { rows: true } },
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Fetch skills using shared utility
  const { allSkills, librarySkills, customerSkills } = await fetchRFPSkills({
    skillIds,
    libraryId,
    customerId: project.customerId,
  });

  if (allSkills.length === 0) {
    throw new Error('No valid skills found');
  }

  logger.info('Starting batch processing', {
    projectId,
    projectName: project.name,
    questionCount: project._count.rows,
    batchSize,
    skillCount: allSkills.length,
    librarySkillCount: librarySkills.length,
    customerSkillCount: customerSkills.length,
    libraryId,
    modelSpeed,
  });

  // Fetch all questions
  const rows = await prisma.bulkRow.findMany({
    where: { projectId },
    select: {
      id: true,
      rowNumber: true,
      inputData: true,
    },
    orderBy: { rowNumber: 'asc' },
  });

  if (rows.length === 0) {
    throw new Error('Project has no questions');
  }

  // Update project status to PROCESSING
  await prisma.bulkProject.update({
    where: { id: projectId },
    data: { status: 'PROCESSING' },
  });

  // Chunk questions into batches
  const batches: typeof rows[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize));
  }

  logger.info('Processing batches', {
    projectId,
    totalQuestions: rows.length,
    batchSize,
    batchCount: batches.length,
  });

  // Process each batch sequentially
  let totalProcessed = 0;
  let totalErrors = 0;
  const batchResults: BatchProcessorResult['batchResults'] = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchNumber = batchIndex + 1;

    logger.info('Processing batch', {
      projectId,
      batchNumber,
      batchSize: batch.length,
    });

    try {
      // Prepare questions for this batch (1-based index for LLM)
      const questions = batch.map((row, idx) => {
        const input = row.inputData as Record<string, unknown>;
        return {
          index: idx + 1,
          question: String(input.question || ''),
        };
      });

      // Process batch with LLM
      const result = await answerQuestionsBatch(
        questions,
        'rfp_batch',
        allSkills.map((s) => ({ title: s.title, content: s.content })),
        undefined, // fallbackContent
        modelSpeed,
        project.fileContext || undefined
      );

      // Save answers to database
      for (const answer of result.answers) {
        const row = batch[answer.questionIndex - 1];
        if (!row) continue;

        await prisma.bulkRow.update({
          where: { id: row.id },
          data: {
            outputData: {
              response: answer.response,
              confidence: answer.confidence,
              sources: answer.sources,
              reasoning: answer.reasoning,
              inference: answer.inference,
              transparency: {
                batchNumber,
                skillIds,
                skillCount: allSkills.length,
                modelSpeed,
              },
            },
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });

        totalProcessed++;
      }

      batchResults.push({
        batchNumber,
        questionCount: batch.length,
        processedCount: result.answers.length,
        status: 'COMPLETED',
      });

      logger.info('Batch completed', {
        projectId,
        batchNumber,
        processedCount: result.answers.length,
      });

      // Callback for progress updates (used by worker)
      if (onBatchComplete) {
        onBatchComplete(batchNumber, batches.length, totalProcessed);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
      const errorId = generateErrorId();

      logger.error('Batch processing failed', error, {
        projectId,
        batchNumber,
        errorType,
        errorMessage,
        errorId,
        isRetryable: errorType.includes('Timeout') || errorType.includes('Network'),
      });

      // Mark questions in this batch as ERROR
      try {
        for (const row of batch) {
          await prisma.bulkRow.update({
            where: { id: row.id },
            data: {
              status: 'ERROR',
              processedAt: new Date(),
              outputData: {
                error: errorMessage,
                errorType,
                errorId,
                batchNumber,
              },
            },
          });
          totalErrors++;
        }
      } catch (updateError) {
        logger.error('Failed to mark rows as ERROR after batch failure', updateError, {
          projectId,
          batchNumber,
          originalError: errorMessage,
        });
        // Continue processing - don't let DB errors stop us from trying other batches
      }

      batchResults.push({
        batchNumber,
        questionCount: batch.length,
        processedCount: 0,
        status: 'ERROR',
        error: errorMessage,
      });
    }
  }

  // Update project status to COMPLETED
  await prisma.bulkProject.update({
    where: { id: projectId },
    data: {
      status: totalErrors > 0 ? 'ERROR' : 'COMPLETED',
      completedAt: new Date(),
    },
  });

  logger.info('Batch processing complete', {
    projectId,
    totalQuestions: rows.length,
    totalProcessed,
    totalErrors,
    batchCount: batches.length,
  });

  return {
    projectId,
    totalQuestions: rows.length,
    totalProcessed,
    totalErrors,
    batchCount: batches.length,
    batchResults,
  };
}
