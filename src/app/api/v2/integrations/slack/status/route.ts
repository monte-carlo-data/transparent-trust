/**
 * GET /api/v2/integrations/slack/status
 * Get Slack bot connection status and available channels for a library
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { canManageLibrary } from '@/lib/v2/teams';
import { getSecret } from '@/lib/secrets';
import { getIntegrationConnectionName } from '@/lib/v2/integrations/integration-config';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { WebClient } from '@slack/web-api';
import type { LibraryId } from '@/types/v2';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const libraryId = searchParams.get('libraryId') as LibraryId | null;
    const customerId = searchParams.get('customerId') || undefined;

    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId is required' },
        { status: 400 }
      );
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, libraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    // Load library-specific bot token (strict library isolation)
    let botToken: string | null = null;
    let isConfigured = false;

    try {
      const envVarName = `SLACK_BOT_TOKEN_${libraryId.toUpperCase()}`;
      botToken = await getSecret(`slack-bot-token-${libraryId}`, envVarName);
      isConfigured = true;
    } catch {
      // No library-specific token found - don't fall back to generic token
      // Each library should have its own dedicated token
    }

    // Load configured channels from database
    const connectionName = getIntegrationConnectionName('slack', libraryId, customerId);

    const connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'slack',
        name: connectionName,
      },
    });

    const config = (connection?.config as Record<string, unknown>) || {};

    // Extract config values with type safety
    const configuredChannelIds = (config.channels as string[]) || [];
    const configuredChannelData = (config.channelData as Array<{ id: string; name: string }>) || [];
    const botChannelIds = (config.botChannels as string[]) || [];
    const botChannelData = (config.botChannelData as Array<{ id: string; name: string }>) || [];
    const includeThreadsOnly = typeof config.includeThreadsOnly === 'boolean' ? config.includeThreadsOnly : undefined;
    const minReplyCount = typeof config.minReplyCount === 'number' ? config.minReplyCount : undefined;

    const statusConfig = { includeThreadsOnly, minReplyCount };


    // Build common response data
    const responseData = {
      selectedChannels: configuredChannelIds,
      selectedChannelData: configuredChannelData,
      botChannels: botChannelIds,
      botChannelData: botChannelData,
      config: statusConfig,
    };

    // If no token, return unconfigured status
    if (!botToken) {
      return NextResponse.json({
        status: {
          configured: false,
          connected: false,
          error: 'Slack bot token not configured. Please add slack-bot-token-{libraryId} to AWS Secrets Manager.',
        },
        ...responseData,
      });
    }

    // Test connection with auth.test (fast, single API call)
    try {
      const webClient = new WebClient(botToken);
      const authTest = await webClient.auth.test();

      if (!authTest.ok) {
        throw new Error('Auth test failed');
      }

      return NextResponse.json({
        status: {
          configured: true,
          connected: true,
          botName: authTest.user,
          teamName: authTest.team,
        },
        ...responseData,
      });
    } catch (error) {
      return NextResponse.json({
        status: {
          configured: isConfigured,
          connected: false,
          error: error instanceof Error ? error.message : 'Failed to connect to Slack',
        },
        ...responseData,
      });
    }
  } catch (error) {
    logger.error('Error getting Slack status:', {
      error: error instanceof Error ? error : new Error(String(error)),
      errorId: 'slack_status_fetch_failed',
    });
    return NextResponse.json(
      {
        error: 'Failed to get Slack status',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorId: 'slack_status_fetch_failed',
      },
      { status: 500 }
    );
  }
}
