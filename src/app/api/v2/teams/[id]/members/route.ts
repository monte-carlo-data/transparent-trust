/**
 * GET /api/v2/teams/[id]/members - List team members
 * POST /api/v2/teams/[id]/members - Add a member to team
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import {
  getTeamById,
  addMember,
  isAdmin,
  isMember,
} from '@/lib/v2/teams';
import type { TeamRole } from '@/lib/v2/teams';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const VALID_ROLES: TeamRole[] = ['admin', 'member', 'viewer'];

/**
 * GET /api/v2/teams/[id]/members
 * List all members of a team
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Check if team exists
    const team = await getTeamById(id);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is a member (any role can view members)
    const memberCheck = await isMember(id, session.user.id);
    if (!memberCheck) {
      return NextResponse.json(
        { error: 'You are not a member of this team' },
        { status: 403 }
      );
    }

    // Get all members with user details
    const members = await prisma.teamMembership.findMany({
      where: { teamId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // admins first
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({
      members: members.map((m) => ({
        userId: m.userId,
        user: m.user,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error listing team members:', error);
    return NextResponse.json(
      { error: 'Failed to list team members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/teams/[id]/members
 * Add a member to a team (admin only)
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Check if team exists
    const team = await getTeamById(id);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is admin
    const adminCheck = await isAdmin(id, session.user.id);
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Only team admins can add members' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Validate role if provided
    const role = body.role || 'member';
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already a member
    const existingMember = await isMember(id, body.userId);
    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 409 }
      );
    }

    // Add the member
    const membership = await addMember({
      teamId: id,
      userId: body.userId,
      role: role as TeamRole,
    });

    // Fetch with user details
    const memberWithUser = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId: body.userId, teamId: id } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      membership: {
        userId: membership.userId,
        user: memberWithUser?.user,
        role: membership.role,
        createdAt: membership.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding team member:', error);
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    );
  }
}
