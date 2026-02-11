/**
 * Update a single row for review/flag/edit actions.
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string; rowId: string }> };

const updateRowSchema = z.object({
  flaggedForReview: z.boolean().optional(),
  reviewStatus: z.string().optional(), // REQUESTED, APPROVED, CORRECTED, etc.
  reviewNote: z.string().optional(),
  userEditedAnswer: z.string().optional(),
  clarifyMessage: z
    .object({
      role: z.enum(["user", "assistant"]).default("user"),
      message: z.string().min(1).max(4000),
      ts: z.string().optional(),
    })
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id: projectId, rowId } = await params;
  const userId = auth.session.user.id;

  try {
    // Ensure row belongs to user's project
    const row = await prisma.bulkRow.findFirst({
      where: {
        id: rowId,
        project: { id: projectId, ownerId: userId },
      },
    });

    if (!row) {
      return errors.notFound("Row not found");
    }

    const body = await request.json();
    const parsed = updateRowSchema.safeParse(body);

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid request");
    }

    const data: Prisma.BulkRowUpdateInput = {};

    if (parsed.data.flaggedForReview !== undefined) {
      data.flaggedForReview = parsed.data.flaggedForReview;
      data.flaggedAt = parsed.data.flaggedForReview ? new Date() : null;
      data.flaggedBy = parsed.data.flaggedForReview ? userId : null;
    }

    if (parsed.data.reviewStatus !== undefined) {
      data.reviewStatus = parsed.data.reviewStatus;
      if (parsed.data.reviewStatus === "APPROVED" || parsed.data.reviewStatus === "CORRECTED") {
        data.reviewedAt = new Date();
        data.reviewedBy = userId;
      }
      if (parsed.data.reviewStatus === "REQUESTED") {
        data.reviewRequestedAt = new Date();
        data.reviewRequestedBy = userId;
      }
    }

    if (parsed.data.reviewNote !== undefined) {
      data.reviewNote = parsed.data.reviewNote;
    }

    if (parsed.data.userEditedAnswer !== undefined) {
      data.userEditedAnswer = parsed.data.userEditedAnswer;
      data.outputData = {
        ...(row.outputData as Prisma.JsonObject),
        response: parsed.data.userEditedAnswer,
      } as Prisma.InputJsonValue;
    }

    if (parsed.data.clarifyMessage) {
      const existingThread = (row.clarifyConversation as Prisma.JsonValue) || [];
      const nextMessage = {
        role: parsed.data.clarifyMessage.role,
        message: parsed.data.clarifyMessage.message,
        ts: parsed.data.clarifyMessage.ts || new Date().toISOString(),
      };
      data.clarifyConversation = [...(existingThread as unknown[]), nextMessage] as Prisma.InputJsonValue;
    }

    const updated = await prisma.bulkRow.update({
      where: { id: rowId },
      data,
    });

    const input = updated.inputData as Prisma.JsonObject;
    const output = updated.outputData as Prisma.JsonObject;

    return apiSuccess({
      success: true,
      data: {
        row: {
          id: updated.id,
          rowNumber: updated.rowNumber,
          question: (input?.question as string) || "",
          context: (input?.context as string) || "",
          response: (output?.response as string) || null,
          confidence: (output?.confidence as string) || null,
          status: updated.status,
          flaggedForReview: updated.flaggedForReview,
          reviewStatus: updated.reviewStatus,
          reviewNote: updated.reviewNote,
          createdAt: updated.createdAt,
        },
      },
    });
  } catch (error) {
    logger.error("Update project row error", error, {
      route: "/api/v2/projects/[id]/rows/[rowId]",
      projectId,
      rowId,
    });
    return errors.internal("Failed to update row");
  }
}
