/**
 * Rerun a single row with the current clarify conversation/context.
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { processQuestionBatchWithScope } from "@/lib/v2/questions/process";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string; rowId: string }> };

const rerunSchema = z.object({
  library: z.string().default("skills"),
  categories: z.array(z.string()).optional(),
  modelSpeed: z.enum(["fast", "quality"]).default("quality"),
  autoSelectSkills: z.boolean().default(true),
  minScopeScore: z.number().min(0).max(1).default(0.1),
  maxSkills: z.number().int().min(1).max(30).default(10),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id: projectId, rowId } = await params;
  const userId = auth.session.user.id;

  try {
    const body = await request.json();
    const parsed = rerunSchema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid request");
    }

    const { library, categories, modelSpeed, autoSelectSkills, minScopeScore, maxSkills } = parsed.data;

    const row = await prisma.bulkRow.findFirst({
      where: {
        id: rowId,
        project: { id: projectId, ownerId: userId },
      },
    });

    if (!row) {
      return errors.notFound("Row not found");
    }

    const input = row.inputData as Prisma.JsonObject;
    const question = (input?.question as string) || "";
    const context = (input?.context as string) || "";

    if (!question.trim()) {
      return errors.badRequest("Row has no question to process");
    }

    await prisma.bulkRow.update({
      where: { id: rowId },
      data: { status: "PROCESSING" },
    });

    try {
      const outputs = await processQuestionBatchWithScope({
        questions: [{ question, context }],
        library,
        modelSpeed,
        autoSelectSkills,
        minScopeScore,
        maxSkills,
        categories,
      });

      const output = outputs[0];

      await prisma.bulkRow.update({
        where: { id: rowId },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          outputData: {
            ...(row.outputData as Prisma.JsonObject),
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

      return apiSuccess({ success: true });
    } catch (error) {
      // Revert row back to PENDING so it can be retried
      await prisma.bulkRow.update({
        where: { id: rowId },
        data: { status: "PENDING" },
      });
      logger.error("Row processing failed, reverted to PENDING", error);
      throw error;
    }
  } catch (error) {
    logger.error("Rerun row error", error, { route: "/api/v2/projects/[id]/rows/[rowId]/rerun", projectId, rowId });
    return errors.internal("Failed to rerun row");
  }
}
