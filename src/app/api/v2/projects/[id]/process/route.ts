/**
 * Process bulk project rows (RFP/questions) using the V2 question pipeline.
 *
 * - Maps inputData.question -> row processing payload
 * - Supports categories/prompt/library/modelSpeed overrides
 * - Updates outputData and row status
 */

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { processQuestionBatchWithScope } from "@/lib/v2/questions/process";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const processSchema = z.object({
  library: z.string().default("skills"),
  categories: z.array(z.string()).optional(),
  modelSpeed: z.enum(["fast", "quality"]).default("quality"),
  batchSize: z.number().int().min(1).max(20).optional(),
  prompt: z.string().optional(),
  // New scope-based selection options
  autoSelectSkills: z.boolean().default(true),
  minScopeScore: z.number().min(0).max(1).default(0.1),
  maxSkills: z.number().int().min(1).max(30).default(10),
  // Pre-approved skill IDs (from skill preview approval)
  approvedSkillIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id: projectId } = await params;
  const userId = auth.session.user.id;

  try {
    const body = await request.json();
    const parsed = processSchema.safeParse(body);

    if (!parsed.success) {
      const errorDetails = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      logger.error("Process request validation failed", { body, errors: errorDetails });
      return errors.badRequest(`Invalid request: ${errorDetails}`);
    }

    const { library, categories, modelSpeed, batchSize, autoSelectSkills, minScopeScore, maxSkills, approvedSkillIds } = parsed.data;

    // Ensure project exists and belongs to user
    const project = await prisma.bulkProject.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      return errors.notFound("Project not found");
    }

    // Fetch pending/processing rows
    const rows = await prisma.bulkRow.findMany({
      where: { projectId, status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: { rowNumber: "asc" },
    });

    if (rows.length === 0) {
      return errors.badRequest("No pending rows to process");
    }

    // Prepare questions with row mapping
    const questionMap = new Map<string, string>(); // Map question ID to row ID
    const questions = rows
      .map((row) => {
        const input = row.inputData as Prisma.JsonObject;
        const questionText = (input?.question as string) || "";
        if (questionText.trim().length > 0) {
          questionMap.set(row.id, row.id);
        }
        return {
          id: row.id,
          question: questionText,
          context: (input?.context as string) || undefined,
        };
      })
      .filter((q) => q.question.trim().length > 0);

    if (questions.length === 0) {
      return errors.badRequest("No valid questions found in rows");
    }

    // Mark rows as processing and project in progress
    await prisma.bulkProject.update({
      where: { id: projectId },
      data: { status: "IN_PROGRESS" },
    });
    await prisma.bulkRow.updateMany({
      where: { id: { in: questions.map((q) => q.id) } },
      data: { status: "PROCESSING" },
    });

    // Process with new scope-based selection
    let outputs;
    try {
      outputs = await processQuestionBatchWithScope({
        questions,
        library,
        modelSpeed,
        batchSize,  // Use UI-configured batch size
        autoSelectSkills,
        minScopeScore,
        maxSkills,
        categories,  // Falls back to this if autoSelectSkills=false
        approvedSkillIds,  // Use pre-approved skills if provided
      });

      if (!Array.isArray(outputs) || outputs.length !== questions.length) {
        throw new Error(`Output mismatch: expected ${questions.length} outputs, got ${Array.isArray(outputs) ? outputs.length : 'invalid'}`);
      }
    } catch (error) {
      // Revert rows back to PENDING so they can be retried
      await prisma.bulkRow.updateMany({
        where: { id: { in: questions.map((q) => q.id) } },
        data: { status: "PENDING" },
      });
      // Revert project status back to DRAFT
      await prisma.bulkProject.update({
        where: { id: projectId },
        data: { status: "DRAFT" },
      });
      logger.error("Processing failed, rows reverted to PENDING", { error, questionCount: questions.length, outputCount: Array.isArray(outputs) ? outputs.length : 'invalid' });
      throw error;
    }

    // Update rows with outputs and create question history entries
    await Promise.all(
      questions.map(async (q, index) => {
        const output = outputs?.[index];
        if (!output) {
          logger.warn(`No output for question ${q.id} at index ${index}`);
          return;
        }

        await prisma.bulkRow.update({
          where: { id: q.id },
          data: {
            status: "COMPLETED",
            processedAt: new Date(),
            outputData: {
              response: output.response,
              confidence: output.confidence,
              sources: output.sources,
              reasoning: output.reasoning,
              inference: output.inference,
              remarks: output.remarks,
            } as Prisma.InputJsonValue,
            tokensUsed: output.tokensUsed,
          },
        });

        // Also save to V2QuestionHistory so it appears in question history panel
        await prisma.v2QuestionHistory.create({
          data: {
            userId,
            question: q.question,
            context: q.context,
            library,
            modelSpeed,
            source: "rfp", // Mark as RFP question, not single question
            status: "COMPLETED",
            outputData: {
              response: output.response,
              confidence: output.confidence,
              sources: output.sources,
              reasoning: output.reasoning,
              inference: output.inference,
              remarks: output.remarks,
            } as Prisma.InputJsonValue,
            tokensUsed: output.tokensUsed,
          },
        });
      })
    );

    // Refresh project with rows and stats
    const updatedProject = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      include: {
        rows: {
          orderBy: { rowNumber: "asc" },
        },
        _count: { select: { rows: true } },
      },
    });

    if (!updatedProject) {
      return errors.internal("Failed to load updated project");
    }

    const rowStatsRaw = await prisma.bulkRow.groupBy({
      by: ["status"],
      where: { projectId },
      _count: true,
    });

    const rowStats = {
      pending: rowStatsRaw.find((s) => s.status === "PENDING")?._count || 0,
      processing: rowStatsRaw.find((s) => s.status === "PROCESSING")?._count || 0,
      completed: rowStatsRaw.find((s) => s.status === "COMPLETED")?._count || 0,
      error: rowStatsRaw.find((s) => s.status === "ERROR")?._count || 0,
    };

    const serializedRows = updatedProject.rows.map((row) => {
      const input = row.inputData as Prisma.JsonObject;
      const output = row.outputData as Prisma.JsonObject;
      return {
        id: row.id,
        rowNumber: row.rowNumber,
        question: (input?.question as string) || "",
        context: (input?.context as string) || "",
        response: (output?.response as string) || null,
        confidence: (output?.confidence as string) || null,
        sources: (output?.sources as string) || null,
        reasoning: (output?.reasoning as string) || null,
        inference: (output?.inference as string) || null,
        remarks: (output?.remarks as string) || null,
        status: row.status,
        flaggedForReview: row.flaggedForReview,
        reviewStatus: row.reviewStatus,
        createdAt: row.createdAt,
      };
    });

    // Revalidate project pages to ensure fresh data
    revalidatePath(`/v2/rfps/${projectId}`);

    return apiSuccess({
      success: true,
      data: {
        project: {
          ...updatedProject,
          rowCount: updatedProject._count.rows,
          rowStats,
          rows: serializedRows,
        },
      },
    });
  } catch (error) {
    logger.error("Process project error", error, { route: "/api/v2/projects/[id]/process", projectId });
    return errors.internal("Failed to process project rows");
  }
}
