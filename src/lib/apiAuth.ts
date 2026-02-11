/**
 * API Authentication Helpers (v2)
 *
 * Provides route-level authentication utilities using team-based permissions.
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth-v2";
import prisma from "./prisma";

export type AuthResult =
  | {
      authorized: true;
      session: {
        user: {
          id: string;
          email?: string;
          name?: string;
        };
      };
    }
  | { authorized: false; response: NextResponse };

export type TeamAuthResult =
  | {
      authorized: true;
      session: {
        user: {
          id: string;
          email?: string;
          name?: string;
        };
      };
      teamRole: string;
    }
  | { authorized: false; response: NextResponse };

/**
 * Require authentication for an API route.
 * Returns the session if authenticated, or an error response to return.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    session: {
      user: {
        id: session.user.id,
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      },
    },
  };
}

/**
 * Require team membership for an API route.
 * Checks if user is a member of the specified team.
 */
export async function requireTeamMember(teamId: string): Promise<TeamAuthResult> {
  const authResult = await requireAuth();

  if (!authResult.authorized) {
    return authResult;
  }

  const membership = await prisma.teamMembership.findUnique({
    where: {
      userId_teamId: {
        userId: authResult.session.user.id,
        teamId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Not a member of this team" },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session: authResult.session,
    teamRole: membership.role,
  };
}

/**
 * Require team admin role for an API route.
 */
export async function requireTeamAdmin(teamId: string): Promise<TeamAuthResult> {
  const result = await requireTeamMember(teamId);

  if (!result.authorized) {
    return result;
  }

  const role = result.teamRole?.toLowerCase();
  if (role !== "admin" && role !== "owner") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return result;
}

/**
 * Check if user has access to any team (i.e., is logged in and has at least one team).
 * Useful for routes that just need basic authenticated access.
 */
export async function requireAnyTeamMember(): Promise<AuthResult> {
  const authResult = await requireAuth();

  if (!authResult.authorized) {
    return authResult;
  }

  const membership = await prisma.teamMembership.findFirst({
    where: {
      userId: authResult.session.user.id,
    },
  });

  if (!membership) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "No team membership found" },
        { status: 403 }
      ),
    };
  }

  return authResult;
}
