import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import prisma from "@/lib/prisma";
import { z } from "zod";

const querySchema = z.object({
  source: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? "all" : val,
    z.enum(["all", "quick", "project", "rfp"])
  ),
  status: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? "all" : val,
    z.enum(["PENDING", "PROCESSING", "COMPLETED", "ERROR", "all"])
  ),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? undefined : val,
    z.string().optional()
  ),
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
      source: searchParams.get("source"),
      status: searchParams.get("status"),
      limit: searchParams.get("limit"),
      cursor: searchParams.get("cursor"),
    });

    if (!parsed.success) {
      console.error('[Questions Log] Validation error:', {
        issues: parsed.error.issues,
        params: {
          source: searchParams.get("source"),
          status: searchParams.get("status"),
          limit: searchParams.get("limit"),
          cursor: searchParams.get("cursor"),
        }
      });
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid query");
    }

    const { source, status, limit, cursor } = parsed.data;

    // Fetch quick questions
    let quickQuestions: Record<string, unknown>[] = [];
    let quickTotal = 0;

    if (source === "all" || source === "quick") {
      const quickWhere: Record<string, unknown> = { userId, source: "quick" };
      if (status !== "all") {
        quickWhere.status = status;
      }

      quickTotal = await prisma.v2QuestionHistory.count({ where: quickWhere });

      quickQuestions = await prisma.v2QuestionHistory.findMany({
        where: quickWhere,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
      });
    }

    // Fetch RFP questions
    let rfpQuestions: Record<string, unknown>[] = [];
    let rfpTotal = 0;

    if (source === "all" || source === "rfp") {
      const rfpWhere: Record<string, unknown> = { userId, source: "rfp" };
      if (status !== "all") {
        rfpWhere.status = status;
      }

      rfpTotal = await prisma.v2QuestionHistory.count({ where: rfpWhere });

      rfpQuestions = await prisma.v2QuestionHistory.findMany({
        where: rfpWhere,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
      });
    }

    // Fetch project rows
    let projectRows: Record<string, unknown>[] = [];
    let projectTotal = 0;

    if (source === "all" || source === "project") {
      const projectWhere: Record<string, unknown> = {
        project: {
          ownerId: userId,
        },
      };
      if (status !== "all") {
        projectWhere.status = status;
      }

      projectTotal = await prisma.bulkRow.count({ where: projectWhere });

      projectRows = await prisma.bulkRow.findMany({
        where: projectWhere,
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
      });
    }

    // Merge and sort by creation date
    const items = [
      ...quickQuestions.map((qObj) => {
        const output = (qObj.outputData as Record<string, unknown>) || {};
        return {
          id: qObj.id,
          source: "quick" as const,
          question: qObj.question,
          response: (output.response as string | null) || null,
          confidence: (output.confidence as string | null) || null,
          status: qObj.status,
          library: qObj.library,
          flaggedForReview: qObj.flaggedForReview,
          reviewStatus: qObj.reviewStatus,
          createdAt: qObj.createdAt,
          projectId: null,
          projectName: null,
        };
      }),
      ...rfpQuestions.map((qObj) => {
        const output = (qObj.outputData as Record<string, unknown>) || {};
        return {
          id: qObj.id,
          source: "rfp" as const,
          question: qObj.question,
          response: (output.response as string | null) || null,
          confidence: (output.confidence as string | null) || null,
          status: qObj.status,
          library: qObj.library,
          flaggedForReview: qObj.flaggedForReview,
          reviewStatus: qObj.reviewStatus,
          createdAt: qObj.createdAt,
          projectId: null,
          projectName: null,
        };
      }),
      ...projectRows.map((rObj) => {
        const input = (rObj.inputData as Record<string, unknown>) || {};
        const output = (rObj.outputData as Record<string, unknown>) || {};
        const project = (rObj.project as Record<string, unknown>) || {};
        return {
          id: rObj.id,
          source: "project" as const,
          question: (input.question as string | null) || null,
          response: (output.response as string | null) || null,
          confidence: (output.confidence as string | null) || null,
          status: rObj.status,
          library: null,
          flaggedForReview: rObj.flaggedForReview,
          reviewStatus: rObj.reviewStatus,
          createdAt: rObj.createdAt,
          projectId: project.id,
          projectName: project.name,
        };
      }),
    ].sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());

    // Paginate combined results
    const paginatedItems = items.slice(0, limit);
    let nextCursor: string | null = null;
    if (items.length > limit) {
      nextCursor = items[limit].id as string;
    }

    return apiSuccess({
      success: true,
      data: {
        items: paginatedItems,
        total: quickTotal + rfpTotal + projectTotal,
        nextCursor,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch log";
    return errors.internal(errorMessage);
  }
}
