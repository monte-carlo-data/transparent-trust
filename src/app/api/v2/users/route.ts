/**
 * GET /api/v2/users - List users with search and filters
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { getUsers } from '@/lib/v2/users';

/**
 * GET /api/v2/users
 * List users with optional search and team filters
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const teamId = searchParams.get('teamId') || undefined;
    const excludeTeamId = searchParams.get('excludeTeamId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getUsers({
      search,
      teamId,
      excludeTeamId,
      limit: Math.min(limit, 100),
      offset,
    });

    return NextResponse.json({
      users: result.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        createdAt: u.createdAt.toISOString(),
        teamMemberships: u.teamMemberships,
      })),
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json(
      { error: 'Failed to list users' },
      { status: 500 }
    );
  }
}
