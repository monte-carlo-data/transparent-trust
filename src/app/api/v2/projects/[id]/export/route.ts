/**
 * Export project rows to CSV with transparency details (confidence, reasoning, inference, sources).
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id: projectId } = await params;
  const userId = auth.session.user.id;

  try {
    const project = await prisma.bulkProject.findFirst({
      where: { id: projectId, ownerId: userId },
      include: {
        rows: {
          orderBy: { rowNumber: "asc" },
        },
      },
    });

    if (!project) {
      return errors.notFound("Project not found");
    }

    const header = [
      "rowNumber",
      "sourceTab",
      "question",
      "context",
      "response",
      "confidence",
      "reasoning",
      "inference",
      "sources",
      "status",
      "flaggedForReview",
      "reviewStatus",
    ];

    const lines = project.rows.map((row) => {
      const input = row.inputData as Prisma.JsonObject;
      const output = row.outputData as Prisma.JsonObject;
      const question = (input?.question as string) || "";
      const context = (input?.context as string) || "";
      const response = (output?.response as string) || "";
      const confidence = (output?.confidence as string) || "";
      const reasoning = (output?.reasoning as string) || "";
      const inference = (output?.inference as string) || "";
      const sources = (output?.sources as string) || "";
      // Source tab extracted from inputData (originalSheetName) since clusters were removed
      const sourceTab = (input?.originalSheetName as string) || "";
      const values = [
        row.rowNumber,
        sourceTab,
        question,
        context,
        response,
        confidence,
        reasoning,
        inference,
        sources,
        row.status,
        row.flaggedForReview ? "true" : "false",
        row.reviewStatus || "",
      ];
      return values
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [header.join(","), ...lines].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${project.name}.csv"`,
      },
    });
  } catch (error) {
    logger.error("Export project error", error, { route: "/api/v2/projects/[id]/export", projectId });
    return errors.internal("Failed to export project");
  }
}
