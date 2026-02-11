import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { processQuestion } from "@/lib/v2/questions/process";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const askSchema = z.object({
  question: z.string().min(1).max(5000),
  context: z.string().max(5000).optional(),
  library: z.string().default("skills"),
  categories: z.array(z.string()).optional(),
  customerId: z.string().optional(),
  modelSpeed: z.enum(["fast", "quality"]).default("quality"),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const userId = auth.session.user.id;

  try {
    const body = await request.json();
    const parsed = askSchema.safeParse(body);

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid request");
    }

    const { question, context, library, categories, customerId, modelSpeed } = parsed.data;

    // Create question history entry
    const historyEntry = await prisma.v2QuestionHistory.create({
      data: {
        userId,
        question,
        context,
        library,
        modelSpeed,
        source: "quick", // Mark as single question, not RFP
        status: "PROCESSING",
      },
    });

    try {
      // Process question
      const output = await processQuestion({
        question,
        context,
        library,
        categories,
        customerId,
        modelSpeed,
      });

      // Update with results
      const updated = await prisma.v2QuestionHistory.update({
        where: { id: historyEntry.id },
        data: {
          status: "COMPLETED",
          outputData: output as unknown as Prisma.InputJsonValue,
          tokensUsed: output.tokensUsed,
        },
      });

      return apiSuccess({
        success: true,
        data: {
          id: updated.id,
          outputData: output,
          status: "COMPLETED",
        },
      });
    } catch (processError) {
      // Update with error
      const errorMessage =
        processError instanceof Error
          ? processError.message
          : "Processing failed";

      await prisma.v2QuestionHistory.update({
        where: { id: historyEntry.id },
        data: {
          status: "ERROR",
          errorMessage,
        },
      });

      throw processError;
    }
  } catch (error) {
    logger.error("Ask question error", error, { route: "/api/v2/questions/ask" });
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process question";
    return errors.internal(errorMessage);
  }
}
