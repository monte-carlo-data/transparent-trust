import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import prisma from "@/lib/prisma";
import { z } from "zod";

const querySchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "ERROR", "all"]).nullable().default("all"),
  limit: z.coerce.number().min(1).max(100).nullable().default(50),
  cursor: z.string().nullable().optional(),
  source: z.enum(["quick", "rfp", "all"]).nullable().default("all"),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const userId = auth.session.user.id;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      status: searchParams.get("status"),
      limit: searchParams.get("limit"),
      cursor: searchParams.get("cursor"),
      source: searchParams.get("source"),
    });

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid query");
    }

    const { status, limit, cursor, source } = parsed.data;
    const effectiveStatus = status ?? "all";
    const effectiveLimit = limit ?? 50;
    const effectiveSource = source ?? "all";

    // Build where clause
    const where: Record<string, unknown> = { userId };
    if (effectiveStatus !== "all") {
      where.status = effectiveStatus;
    }
    if (effectiveSource !== "all") {
      where.source = effectiveSource;
    }

    // Get total count
    const total = await prisma.v2QuestionHistory.count({ where });

    // Get paginated results
    const questions = await prisma.v2QuestionHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: effectiveLimit + 1, // Get one extra to determine if there's a next page
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    // Determine next cursor
    let nextCursor: string | null = null;
    if (questions.length > effectiveLimit) {
      nextCursor = questions[effectiveLimit].id;
      questions.pop(); // Remove the extra item
    }

    return apiSuccess({
      success: true,
      data: {
        questions: questions.map((q) => {
          const output = (q.outputData as Record<string, unknown>) || {};
          return {
            id: q.id,
            question: q.question,
            response: (output.response as string | null) || null,
            confidence: (output.confidence as string | null) || null,
            status: q.status,
            library: q.library,
            modelSpeed: q.modelSpeed,
            flaggedForReview: q.flaggedForReview,
            reviewStatus: q.reviewStatus,
            createdAt: q.createdAt,
          };
        }),
        total,
        nextCursor,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch history";
    return errors.internal(errorMessage);
  }
}
