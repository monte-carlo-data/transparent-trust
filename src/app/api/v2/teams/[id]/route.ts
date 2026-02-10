/**
 * GET /api/v2/teams/[id] - Get a team by ID
 * PATCH /api/v2/teams/[id] - Update a team
 * DELETE /api/v2/teams/[id] - Delete a team
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import {
  getTeamById,
  updateTeam,
  deleteTeam,
  isAdmin,
  isMember,
} from '@/lib/v2/teams';
import type { UpdateTeamInput } from '@/lib/v2/teams';
import { LIBRARY_IDS, type LibraryId } from '@/types/v2';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v2/teams/[id]
 * Get a team by ID
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const team = await getTeamById(id);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is a member
    const memberCheck = await isMember(id, session.user.id);
    if (!memberCheck) {
      return NextResponse.json(
        { error: 'You are not a member of this team' },
        { status: 403 }
      );
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error('Error getting team:', error);
    return NextResponse.json(
      { error: 'Failed to get team' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v2/teams/[id]
 * Update a team (admin only)
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Check if team exists
    const existing = await getTeamById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is admin
    const adminCheck = await isAdmin(id, session.user.id);
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Only team admins can update the team' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate libraries if provided
    if (body.libraries) {
      if (!Array.isArray(body.libraries)) {
        return NextResponse.json(
          { error: 'libraries must be an array' },
          { status: 400 }
        );
      }
      for (const lib of body.libraries) {
        if (!LIBRARY_IDS.includes(lib as LibraryId)) {
          return NextResponse.json(
            { error: `Invalid library: ${lib}. Must be one of: ${LIBRARY_IDS.join(', ')}` },
            { status: 400 }
          );
        }
      }
    }

    const input: UpdateTeamInput = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.libraries !== undefined && { libraries: body.libraries }),
      ...(body.monthlyTokenLimit !== undefined && { monthlyTokenLimit: body.monthlyTokenLimit }),
      ...(body.settings !== undefined && { settings: body.settings }),
    };

    const team = await updateTeam(id, input);

    return NextResponse.json(team);
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json(
      { error: 'Failed to update team' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v2/teams/[id]
 * Delete a team (admin only)
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Check if team exists
    const existing = await getTeamById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is admin
    const adminCheck = await isAdmin(id, session.user.id);
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Only team admins can delete the team' },
        { status: 403 }
      );
    }

    await deleteTeam(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json(
      { error: 'Failed to delete team' },
      { status: 500 }
    );
  }
}
