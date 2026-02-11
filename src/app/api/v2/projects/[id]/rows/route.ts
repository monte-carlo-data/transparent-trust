/**
 * V2 Project Rows API Route
 *
 * Manage rows (questions) within a project.
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const addRowsSchema = z.object({
  rows: z.array(
    z.object({
      question: z.string().min(1),
      context: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
  ),
});

// GET /api/v2/projects/[id]/rows
// List rows for a project
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const userId = auth.session.user.id;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Verify ownership
    const project = await prisma.bulkProject.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });

    if (!project) {
      return errors.notFound("Project not found");
    }

    const where = {
      projectId: id,
      ...(status && { status }),
    };

    const [rows, total] = await Promise.all([
      prisma.bulkRow.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { rowNumber: "asc" },
      }),
      prisma.bulkRow.count({ where }),
    ]);

    return apiSuccess({
      rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error("List rows error", error, { route: "/api/v2/projects/[id]/rows", id });
    return errors.internal("Failed to list rows");
  }
}

// POST /api/v2/projects/[id]/rows
// Add rows to a project
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const userId = auth.session.user.id;

  try {
    // Verify ownership
    const project = await prisma.bulkProject.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });

    if (!project) {
      return errors.notFound("Project not found");
    }

    const body = await request.json();
    const parsed = addRowsSchema.safeParse(body);

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid request");
    }

    // Get the current max row number
    const maxRow = await prisma.bulkRow.findFirst({
      where: { projectId: id },
      orderBy: { rowNumber: "desc" },
      select: { rowNumber: true },
    });

    const startRowNumber = (maxRow?.rowNumber || 0) + 1;

    // Create rows
    const rowData: Prisma.BulkRowCreateManyInput[] = parsed.data.rows.map((row, index) => ({
      projectId: id,
      rowNumber: startRowNumber + index,
      inputData: {
        question: row.question,
        context: row.context,
        ...row.metadata,
      } as Prisma.InputJsonValue,
      outputData: {} as Prisma.InputJsonValue,
      status: "PENDING",
    }));

    await prisma.bulkRow.createMany({
      data: rowData,
    });

    // Update project status if it was draft
    await prisma.bulkProject.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
      },
    });

    return apiSuccess({ created: rowData.length }, 201);
  } catch (error) {
    logger.error("Add rows error", error, { route: "/api/v2/projects/[id]/rows", id });
    return errors.internal("Failed to add rows");
  }
}

// DELETE /api/v2/projects/[id]/rows
// Delete all rows from a project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const userId = auth.session.user.id;

  try {
    // Verify ownership
    const project = await prisma.bulkProject.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });

    if (!project) {
      return errors.notFound("Project not found");
    }

    const result = await prisma.bulkRow.deleteMany({
      where: { projectId: id },
    });

    return apiSuccess({ deleted: result.count });
  } catch (error) {
    logger.error("Delete rows error", error, { route: "/api/v2/projects/[id]/rows", id });
    return errors.internal("Failed to delete rows");
  }
}
