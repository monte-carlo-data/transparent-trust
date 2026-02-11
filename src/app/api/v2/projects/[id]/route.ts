/**
 * V2 Project Detail API Route
 *
 * Get, update, or delete a specific project.
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "FINALIZED"]).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/v2/projects/[id]
// Get project with rows
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const userId = auth.session.user.id;

  try {
    const { searchParams } = new URL(request.url);
    const includeRows = searchParams.get("includeRows") !== "false";
    const rowStatus = searchParams.get("rowStatus");

    const project = await prisma.bulkProject.findFirst({
      where: { id, ownerId: userId },
      include: includeRows
        ? {
            rows: {
              where: rowStatus ? { status: rowStatus } : undefined,
              orderBy: { rowNumber: "asc" },
            },
            _count: { select: { rows: true } },
          }
        : { _count: { select: { rows: true } } },
    });

    if (!project) {
      return errors.notFound("Project not found");
    }

    // Get row stats
    const rowStats = await prisma.bulkRow.groupBy({
      by: ["status"],
      where: { projectId: id },
      _count: true,
    });

    const stats = {
      pending: rowStats.find((s) => s.status === "PENDING")?._count || 0,
      processing: rowStats.find((s) => s.status === "PROCESSING")?._count || 0,
      completed: rowStats.find((s) => s.status === "COMPLETED")?._count || 0,
      error: rowStats.find((s) => s.status === "ERROR")?._count || 0,
    };

    const serializedRows = includeRows && "rows" in project && project.rows
      ? (project.rows as unknown[]).map((row) => {
          const rowObj = row as Record<string, unknown>;
          const input = rowObj.inputData as Prisma.JsonObject;
          const output = rowObj.outputData as Prisma.JsonObject;

          // Format depends on project type
          const isContractProject = project.projectType === 'contract-review';

          if (isContractProject) {
            // Contracts use nested inputData/outputData structure
            return {
              id: rowObj.id,
              rowIndex: rowObj.rowNumber,
              inputData: input || {},
              outputData: output || undefined,
              status: rowObj.status,
              errorMessage: rowObj.errorMessage,
            };
          } else {
            // RFPs use flat structure (question, response, confidence, etc.)
            return {
              id: rowObj.id,
              rowNumber: rowObj.rowNumber,
              question: (input?.question as string) || "",
              context: (input?.context as string) || "",
              response: (output?.response as string) || null,
              confidence: (output?.confidence as string) || null,
              sources: (output?.sources as string) || null,
              reasoning: (output?.reasoning as string) || null,
              inference: (output?.inference as string) || null,
              remarks: (output?.remarks as string) || null,
              status: rowObj.status,
              flaggedForReview: rowObj.flaggedForReview,
              reviewNote: (rowObj.reviewNote as string) || null,
              reviewStatus: rowObj.reviewStatus,
              createdAt: rowObj.createdAt,
            };
          }
        })
      : undefined;

    return apiSuccess({
      success: true,
      data: {
        project: {
          ...project,
          rowCount: project._count.rows,
          rowStats: stats,
          rows: serializedRows,
        },
      },
    });
  } catch (error) {
    logger.error("Get project error", error, { route: "/api/v2/projects/[id]", id });
    return errors.internal("Failed to get project");
  }
}

// PATCH /api/v2/projects/[id]
// Update a project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const userId = auth.session.user.id;

  try {
    const existing = await prisma.bulkProject.findFirst({
      where: { id, ownerId: userId },
    });

    if (!existing) {
      return errors.notFound("Project not found");
    }

    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid request");
    }

    const { name, description, status, config } = parsed.data;

    const updateData: Prisma.BulkProjectUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (config !== undefined) {
      updateData.config = { ...(existing.config as object), ...config } as Prisma.InputJsonValue;
    }
    if (status === "COMPLETED") updateData.completedAt = new Date();
    if (status === "FINALIZED") {
      updateData.status = "FINALIZED";
      updateData.completedAt = new Date();
    }

    const project = await prisma.bulkProject.update({
      where: { id, ownerId: userId },
      data: updateData,
    });

    return apiSuccess(project);
  } catch (error) {
    logger.error("Update project error", error, { route: "/api/v2/projects/[id]", id });
    return errors.internal("Failed to update project");
  }
}

// DELETE /api/v2/projects/[id]
// Delete a project and its rows
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const userId = auth.session.user.id;

  try {
    const existing = await prisma.bulkProject.findFirst({
      where: { id, ownerId: userId },
    });

    if (!existing) {
      return errors.notFound("Project not found");
    }

    // Rows are cascade deleted via the relation
    await prisma.bulkProject.delete({
      where: { id },
    });

    return apiSuccess({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error("Delete project error", error, { route: "/api/v2/projects/[id]", id });
    return errors.internal("Failed to delete project");
  }
}
