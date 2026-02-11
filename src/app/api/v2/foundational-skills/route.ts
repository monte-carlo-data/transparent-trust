/**
 * GET /api/v2/foundational-skills
 * List all foundational skills (templates that can be cloned to customers)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { listFoundationalSkills } from '@/lib/v2/skills/template-service';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // List foundational skills (available to all users regardless of team)
    const foundationalSkills = await listFoundationalSkills();

    return NextResponse.json({
      success: true,
      data: foundationalSkills,
    });
  } catch (error) {
    logger.error('Failed to list foundational skills', error, {
      route: '/api/v2/foundational-skills',
    });

    return NextResponse.json(
      {
        error: 'Failed to list foundational skills',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
