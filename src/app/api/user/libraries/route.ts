/**
 * GET /api/user/libraries
 * Returns the list of libraries the authenticated user can access
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { getAccessibleLibraries } from '@/lib/v2/teams';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const libraries = await getAccessibleLibraries(session.user.id);

    return NextResponse.json({ libraries });
  } catch (error) {
    console.error('Error fetching user libraries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch libraries' },
      { status: 500 }
    );
  }
}
