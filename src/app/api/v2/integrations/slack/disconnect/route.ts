/**
 * POST /api/v2/integrations/slack/disconnect
 * Clear Slack channel configuration for a library
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { canManageLibrary } from '@/lib/v2/teams';
import { getIntegrationConnectionName } from '@/lib/v2/integrations/integration-config';
import { logger } from '@/lib/logger';
import type { LibraryId } from '@/types/v2';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { libraryId, customerId } = body as { libraryId: string; customerId?: string };

    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId is required' }, { status: 400 });
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, libraryId as LibraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    // Get library-specific connection name (with optional customer scoping)
    const connectionName = getIntegrationConnectionName('slack', libraryId, customerId);

    // Find the connection
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'slack',
        name: connectionName,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'No Slack connection found for this library' },
        { status: 404 }
      );
    }

    // Clear channel configuration by updating config
    const existingConfig = (connection.config as Record<string, unknown>) || {};
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        config: {
          ...existingConfig,
          channels: [],
          channelData: [],
          botChannels: [],
          botChannelData: [],
        },
        updatedAt: new Date(),
      },
    });

    logger.info('Slack channels disconnected', {
      libraryId,
      customerId,
      connectionId: connection.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error disconnecting Slack channels:', error);
    return NextResponse.json(
      {
        error: 'Failed to disconnect Slack channels',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
