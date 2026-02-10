/**
 * POST /api/v2/integrations/slack/configure
 * Save Slack channel configuration for a library
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { canManageLibrary } from '@/lib/v2/teams';
import { getIntegrationConnectionName } from '@/lib/v2/integrations/integration-config';
import { logger } from '@/lib/logger';
import type { LibraryId } from '@/types/v2';
import type { Prisma } from '@prisma/client';

interface SlackChannel {
  id: string;
  name: string;
  isMember?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    // channels = source/ingestion channels (optional)
    // botChannels = channels where bot responds (optional)
    // At least one must be provided
    // customerId = optional customer ID for scoping
    const { libraryId, channels, botChannels, customerId, includeThreadsOnly, minReplyCount } = body as {
      libraryId: string;
      channels?: SlackChannel[];
      botChannels?: SlackChannel[];
      customerId?: string;
      includeThreadsOnly?: boolean;
      minReplyCount?: number;
    };

    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId is required' },
        { status: 400 }
      );
    }

    if ((!channels || !Array.isArray(channels) || channels.length === 0) &&
        (!botChannels || !Array.isArray(botChannels) || botChannels.length === 0)) {
      return NextResponse.json(
        { error: 'At least one of channels or botChannels must be provided' },
        { status: 400 }
      );
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

    // Store full channel objects (id + name) for display, and extract IDs for bot/adapter use
    const channelData = channels?.map((c) => ({ id: c.id, name: c.name })) || [];
    const channelIds = channels?.map((c) => c.id) || [];

    // Bot channels are separate from source/ingestion channels
    const botChannelData = botChannels?.map((c) => ({ id: c.id, name: c.name }));
    const botChannelIds = botChannels?.map((c) => c.id);

    // Find or create the Slack integration connection for this library
    let connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'slack',
        name: connectionName,
      },
    });

    // Build config object - separate source and bot channels
    const baseConfig: Record<string, unknown> = {
      ...(customerId && { customerId }),
    };

    // Add source channels if provided
    if (channelIds.length > 0) {
      baseConfig.channels = channelIds;
      baseConfig.channelData = channelData;
      baseConfig.includeThreadsOnly = includeThreadsOnly ?? (customerId ? false : true);
      baseConfig.minReplyCount = minReplyCount ?? (customerId ? 0 : 1);
    }

    // Add bot channels if provided
    if (botChannelIds && botChannelIds.length > 0) {
      baseConfig.botChannels = botChannelIds;
      baseConfig.botChannelData = botChannelData;
    }

    if (connection) {
      // Update existing connection config
      const existingConfig = typeof connection.config === 'object' && connection.config !== null
        ? (connection.config as Record<string, unknown>)
        : {};
      const config = {
        ...existingConfig,
        ...baseConfig,
      } as Prisma.InputJsonValue;
      connection = await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          config,
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new connection
      connection = await prisma.integrationConnection.create({
        data: {
          integrationType: 'slack',
          name: connectionName,
          config: baseConfig as Prisma.InputJsonValue,
          status: 'ACTIVE',
        },
      });
    }

    logger.info('Slack channels configured', {
      libraryId,
      connectionId: connection.id,
      channelIds,
      channelNames: channels?.map((c) => c.name),
      botChannelIds,
      botChannelNames: botChannels?.map((c) => c.name),
    });

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      channels: channelData,
      botChannels: botChannelData,
    });
  } catch (error) {
    logger.error('Error configuring Slack channels:', {
      error: error instanceof Error ? error : new Error(String(error)),
      errorId: 'slack_configure_failed',
    });
    return NextResponse.json(
      {
        error: 'Failed to configure Slack channels',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorId: 'slack_configure_failed',
      },
      { status: 500 }
    );
  }
}
