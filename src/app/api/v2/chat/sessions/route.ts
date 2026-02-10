/**
 * V2 Chat Sessions API Route
 *
 * Manage chat sessions for authenticated users.
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { canAccessCustomer } from "@/lib/v2/customers/customer-service";

// GET /api/v2/chat/sessions
// List chat sessions for the current user
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const userId = auth.session.user.id;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          sessionType: true,
          customerId: true,
          customer: {
            select: { id: true, company: true },
          },
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { messages: true },
          },
        },
      }),
      prisma.chatSession.count({ where: { userId } }),
    ]);

    // Transform to include messageCount
    const transformedSessions = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      sessionType: s.sessionType,
      customerId: s.customerId,
      customer: s.customer,
      messageCount: s._count.messages,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return apiSuccess({
      sessions: transformedSessions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error("List chat sessions error", error, { route: "/api/v2/chat/sessions" });
    return errors.internal("Failed to list chat sessions");
  }
}

// POST /api/v2/chat/sessions
// Create a new chat session
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const userId = auth.session.user.id;

  try {
    const body = await request.json();
    const { title, customerId, sessionType } = body as {
      title?: string;
      customerId?: string;
      sessionType?: 'chat' | 'collateral';
    };

    // Verify user has access to the customer if linking to one
    if (customerId) {
      const hasAccess = await canAccessCustomer(userId, customerId);
      if (!hasAccess) {
        return errors.forbidden("You do not have access to this customer");
      }
    }

    const session = await prisma.chatSession.create({
      data: {
        userId,
        title: title || "New Chat",
        customerId: customerId || undefined,
        sessionType: sessionType || "chat",
      },
      include: {
        customer: {
          select: { id: true, company: true },
        },
      },
    });

    return apiSuccess(session, 201);
  } catch (error) {
    logger.error("Create chat session error", error, { route: "/api/v2/chat/sessions" });
    return errors.internal("Failed to create chat session");
  }
}
