/**
 * GET /api/v2/teams - List teams for current user
 * POST /api/v2/teams - Create a new team
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import {
  createTeamWithMembers,
  getTeamsForUser,
  getAllTeams,
} from '@/lib/v2/teams';
import type { CreateTeamInput, TeamRole } from '@/lib/v2/teams';
import { LIBRARY_IDS, type LibraryId } from '@/types/v2';

/**
 * GET /api/v2/teams
 * List teams for current user
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';

    // If 'all' is requested, return all teams (for admin use)
    // In production, you'd want to check admin permissions here
    if (all) {
      const teams = await getAllTeams();
      return NextResponse.json({ teams });
    }

    // Otherwise, return teams the user is a member of
    const teams = await getTeamsForUser(session.user.id);

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('Error listing teams:', error);
    return NextResponse.json(
      { error: 'Failed to list teams' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/teams
 * Create a new team
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

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

    const input: CreateTeamInput = {
      name: body.name,
      slug: body.slug,
      description: body.description,
      libraries: body.libraries,
      monthlyTokenLimit: body.monthlyTokenLimit,
      settings: body.settings,
    };

    // Create team with the current user as admin
    const team = await createTeamWithMembers(input, [
      { userId: session.user.id, role: 'admin' as TeamRole },
    ]);

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error('Error creating team:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A team with this slug already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    );
  }
}
