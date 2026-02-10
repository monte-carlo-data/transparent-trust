/**
 * V2 Chat Feedback API Route
 *
 * Save feedback for a chat message.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

const feedbackSchema = z.object({
  messageId: z.string().min(1),
  sessionId: z.string().min(1),
  rating: z.enum(["THUMBS_UP", "THUMBS_DOWN"]).nullable().optional(),
  comment: z.string().optional(),
  flaggedForReview: z.boolean().optional(),
  flagNote: z.string().optional(),
  reviewRequested: z.boolean().optional(),
  reviewerId: z.string().optional(),
  reviewerName: z.string().optional(),
  reviewNote: z.string().optional(),
  sendNow: z.boolean().optional(),
});

// POST /api/v2/chat/feedback
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const userId = auth.session.user.id;

  try {
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid request");
    }

    const { messageId, sessionId } = parsed.data;
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        sessionId,
        session: { userId },
      },
      select: { id: true, metadata: true },
    });

    if (!message) {
      return errors.notFound("Chat message not found");
    }

    const metadata = (message.metadata || {}) as Prisma.JsonObject;
    const existingFeedback = (metadata.feedback || {}) as Prisma.JsonObject;
    const updates: Prisma.JsonObject = {};

    if (Object.prototype.hasOwnProperty.call(parsed.data, "rating")) {
      updates.rating = parsed.data.rating;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "comment")) {
      updates.comment = parsed.data.comment;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "flaggedForReview")) {
      updates.flaggedForReview = parsed.data.flaggedForReview;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "flagNote")) {
      updates.flagNote = parsed.data.flagNote;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "reviewRequested")) {
      updates.reviewRequested = parsed.data.reviewRequested;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "reviewerId")) {
      updates.reviewerId = parsed.data.reviewerId;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "reviewerName")) {
      updates.reviewerName = parsed.data.reviewerName;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "reviewNote")) {
      updates.reviewNote = parsed.data.reviewNote;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "sendNow")) {
      updates.sendNow = parsed.data.sendNow;
    }

    const nextFeedback: Prisma.JsonObject = {
      ...existingFeedback,
      ...updates,
    };
    const nextMetadata: Prisma.JsonObject = {
      ...metadata,
      feedback: nextFeedback,
    };

    await prisma.chatMessage.update({
      where: { id: message.id },
      data: { metadata: nextMetadata as Prisma.InputJsonValue },
    });

    return apiSuccess({ success: true, data: { feedback: nextFeedback } });
  } catch (error) {
    logger.error("Chat feedback error", error, { route: "/api/v2/chat/feedback" });
    return errors.internal("Failed to save feedback");
  }
}
