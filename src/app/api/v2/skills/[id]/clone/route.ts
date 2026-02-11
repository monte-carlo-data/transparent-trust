/**
 * POST /api/v2/skills/[id]/clone
 * Clone a foundational skill to one or more customers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { cloneFoundationalSkill } from '@/lib/v2/skills/template-service';

interface CloneSkillRequest {
  /** Customer IDs to clone to */
  customerIds: string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: skillId } = await params;
    const body: CloneSkillRequest = await request.json();

    if (!body.customerIds || body.customerIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one customer ID is required' },
        { status: 400 }
      );
    }

    // Clone the foundational skill
    const result = await cloneFoundationalSkill({
      sourceSkillId: skillId,
      customerIds: body.customerIds,
      userId: session.user.id,
      userName: session.user.name || undefined,
      userEmail: session.user.email || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API /skills/[id]/clone] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to clone skill',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
