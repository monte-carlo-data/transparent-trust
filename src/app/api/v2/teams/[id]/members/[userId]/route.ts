/**
 * PATCH /api/v2/teams/[id]/members/[userId] - Update member role
 * DELETE /api/v2/teams/[id]/members/[userId] - Remove member from team
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import {
  getTeamById,
  updateMemberRole,
  removeMember,
  isAdmin,
  isMember,
} from '@/lib/v2/teams';
import type { TeamRole } from '@/lib/v2/teams';

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

const VALID_ROLES: TeamRole[] = ['admin', 'member', 'viewer'];

/**
 * PATCH /api/v2/teams/[id]/members/[userId]
 * Update a member's role (admin only)
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, userId } = await context.params;

    // Check if team exists
    const team = await getTeamById(id);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if current user is admin
    const adminCheck = await isAdmin(id, session.user.id);
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Only team admins can update member roles' },
        { status: 403 }
      );
    }

    // Check if target user is a member
    const memberCheck = await isMember(id, userId);
    if (!memberCheck) {
      return NextResponse.json(
        { error: 'User is not a member of this team' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate role
    if (!body.role) {
      return NextResponse.json(
        { error: 'role is required' },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Prevent removing the last admin
    if (body.role !== 'admin') {
      const admins = await prisma.teamMembership.findMany({
        where: { teamId: id, role: 'admin' },
      });

      const isLastAdmin = admins.length === 1 && admins[0].userId === userId;
      if (isLastAdmin) {
        return NextResponse.json(
          { error: 'Cannot demote the last admin. Promote another member to admin first.' },
          { status: 400 }
        );
      }
    }

    // Update the role
    const membership = await updateMemberRole(id, userId, body.role as TeamRole);

    // Fetch with user details
    const memberWithUser = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId, teamId: id } },
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
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v2/teams/[id]/members/[userId]
 * Remove a member from a team (admin only, or self-removal)
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, userId } = await context.params;

    // Check if team exists
    const team = await getTeamById(id);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if current user is admin OR is removing themselves
    const adminCheck = await isAdmin(id, session.user.id);
    const isSelfRemoval = session.user.id === userId;

    if (!adminCheck && !isSelfRemoval) {
      return NextResponse.json(
        { error: 'Only team admins can remove members' },
        { status: 403 }
      );
    }

    // Check if target user is a member
    const memberCheck = await isMember(id, userId);
    if (!memberCheck) {
      return NextResponse.json(
        { error: 'User is not a member of this team' },
        { status: 404 }
      );
    }

    // Prevent removing the last admin
    const admins = await prisma.teamMembership.findMany({
      where: { teamId: id, role: 'admin' },
    });

    const targetMembership = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId, teamId: id } },
    });

    const isLastAdmin = admins.length === 1 && targetMembership?.role === 'admin';
    if (isLastAdmin) {
      return NextResponse.json(
        { error: 'Cannot remove the last admin. Promote another member to admin first.' },
        { status: 400 }
      );
    }

    // Remove the member
    await removeMember(id, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    );
  }
}
