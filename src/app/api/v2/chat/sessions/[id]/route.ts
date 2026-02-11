/**
 * V2 Chat Session Detail API Route
 *
 * Get, update, or delete a specific chat session.
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v2/chat/sessions/[id]
// Get a chat session with its messages
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const userId = auth.session.user.id;

  try {
    const session = await prisma.chatSession.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      return errors.notFound("Chat session not found");
    }

    return apiSuccess(session);
  } catch (error) {
    logger.error("Get chat session error", error, { route: "/api/v2/chat/sessions/[id]", id });
    return errors.internal("Failed to get chat session");
  }
}

// PATCH /api/v2/chat/sessions/[id]
// Update a chat session (e.g., rename)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const userId = auth.session.user.id;

  try {
    // Check ownership
    const existing = await prisma.chatSession.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return errors.notFound("Chat session not found");
    }

    const body = await request.json();
    const { title } = body as { title?: string };

    const session = await prisma.chatSession.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
      },
    });

    return apiSuccess(session);
  } catch (error) {
    logger.error("Update chat session error", error, { route: "/api/v2/chat/sessions/[id]", id });
    return errors.internal("Failed to update chat session");
  }
}

// DELETE /api/v2/chat/sessions/[id]
// Delete a chat session and its messages
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  const userId = auth.session.user.id;

  try {
    // Check ownership
    const existing = await prisma.chatSession.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return errors.notFound("Chat session not found");
    }

    // Delete messages first, then session
    await prisma.chatMessage.deleteMany({
      where: { sessionId: id },
    });

    await prisma.chatSession.delete({
      where: { id },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Delete chat session error", error, { route: "/api/v2/chat/sessions/[id]", id });
    return errors.internal("Failed to delete chat session");
  }
}
