import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Check if user has access to the specified team
 */
async function userCanAccessTeam(userId: string, teamId: string): Promise<boolean> {
  const membership = await prisma.teamMembership.findFirst({
    where: { userId, teamId },
  });
  return !!membership;
}

/**
 * GET /api/v2/integrations/looker/config
 * Get Looker integration config for a team
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }

    // Check team membership
    if (!(await userCanAccessTeam(session.user.id, teamId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const connection = await prisma.integrationConnection.findFirst({
      where: {
        teamId,
        integrationType: 'looker',
        status: 'ACTIVE',
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Looker integration not configured' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: connection.id,
      config: connection.config,
      status: connection.status,
    });
  } catch (error) {
    logger.error('Error fetching Looker config', { error });
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/integrations/looker/config
 * Create or update Looker integration config for a team
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, dashboardIds } = await request.json();

    if (!teamId || !dashboardIds) {
      return NextResponse.json(
        { error: 'teamId and dashboardIds required' },
        { status: 400 }
      );
    }

    if (typeof dashboardIds !== 'object' || Array.isArray(dashboardIds)) {
      return NextResponse.json(
        { error: 'dashboardIds must be an object mapping libraryId to dashboard config' },
        { status: 400 }
      );
    }

    // Validate dashboard config format
    for (const [key, value] of Object.entries(dashboardIds)) {
      if (typeof value === 'string') {
        // Simple string format: just the ID
        continue;
      } else if (typeof value === 'object' && value !== null && 'id' in value) {
        // Object format: { id: string, workspace?: string, filters?: Record<string, string> }
        const config = value as Record<string, unknown>;
        if (typeof config.id !== 'string') {
          return NextResponse.json(
            { error: `Invalid config for ${key}: id must be a string` },
            { status: 400 }
          );
        }
        if (config.workspace && typeof config.workspace !== 'string') {
          return NextResponse.json(
            { error: `Invalid config for ${key}: workspace must be a string` },
            { status: 400 }
          );
        }
        if (config.filters) {
          if (typeof config.filters !== 'object' || Array.isArray(config.filters)) {
            return NextResponse.json(
              { error: `Invalid config for ${key}: filters must be an object` },
              { status: 400 }
            );
          }
          for (const [filterName, filterValue] of Object.entries(config.filters as Record<string, unknown>)) {
            if (typeof filterValue !== 'string') {
              return NextResponse.json(
                { error: `Invalid config for ${key}: filter "${filterName}" value must be a string` },
                { status: 400 }
              );
            }
          }
        }
      } else {
        return NextResponse.json(
          { error: `Invalid config for ${key}: must be a string ID or {id, workspace?} object` },
          { status: 400 }
        );
      }
    }

    // Check team membership
    if (!(await userCanAccessTeam(session.user.id, teamId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find or create the connection
    let connection = await prisma.integrationConnection.findFirst({
      where: {
        teamId,
        integrationType: 'looker',
      },
    });

    if (connection) {
      // Update existing connection
      connection = await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          config: { dashboardIds },
          status: 'ACTIVE',
        },
      });
    } else {
      // Create new connection
      connection = await prisma.integrationConnection.create({
        data: {
          teamId,
          integrationType: 'looker',
          name: 'Looker Integration',
          config: { dashboardIds },
          status: 'ACTIVE',
        },
      });
    }

    return NextResponse.json({
      id: connection.id,
      config: connection.config,
      status: connection.status,
      message: 'Looker configuration saved',
    });
  } catch (error) {
    logger.error('Error saving Looker config', { error });

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Looker integration already configured for this team' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v2/integrations/looker/config
 * Disable Looker integration for a team
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }

    // Check team membership
    if (!(await userCanAccessTeam(session.user.id, teamId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.integrationConnection.updateMany({
      where: {
        teamId,
        integrationType: 'looker',
      },
      data: {
        status: 'INACTIVE',
      },
    });

    return NextResponse.json({ message: 'Looker integration disabled' });
  } catch (error) {
    logger.error('Error disabling Looker config', { error });
    return NextResponse.json(
      { error: 'Failed to disable configuration' },
      { status: 500 }
    );
  }
}
