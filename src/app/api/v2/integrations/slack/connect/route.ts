/**
 * POST /api/v2/integrations/slack/connect
 *
 * Connects a Slack workspace for a library integration.
 * Discovers and stages sources synchronously (user controls what's imported).
 *
 * Body:
 *   - SLACK_BOT_TOKEN: Slack bot token (xoxb-...)
 *   - SLACK_CHANNEL_IDS: Comma-separated channel IDs (optional)
 *   - libraryId: Target library ('it', 'knowledge', 'gtm') - default: 'it'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { getIntegrationConnectionName } from '@/lib/v2/integrations/integration-config';
import { logger } from '@/lib/logger';
import { putSecret } from '@/lib/secrets';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { SLACK_BOT_TOKEN, SLACK_CHANNEL_IDS, libraryId } = await req.json();

    if (!SLACK_BOT_TOKEN) {
      return NextResponse.json({ error: 'Slack bot token is required' }, { status: 400 });
    }

    // Validate token format
    if (!SLACK_BOT_TOKEN.startsWith('xoxb-')) {
      return NextResponse.json({ error: 'Invalid Slack bot token format (should start with xoxb-)' }, { status: 400 });
    }

    const targetLibraryId = libraryId || 'it';
    const channelIds = SLACK_CHANNEL_IDS?.split(',').map((id: string) => id.trim()).filter(Boolean) || [];

    // Store token in AWS Secrets Manager with library-specific name
    const secretName = `slack-bot-token-${targetLibraryId}`;
    await putSecret(secretName, SLACK_BOT_TOKEN);
    logger.info(`Slack bot token stored in Secrets Manager: ${secretName}`);

    // Get library-specific connection name
    const connectionName = getIntegrationConnectionName('slack', targetLibraryId);

    // Find or create the Slack integration connection for this library
    let connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'slack',
        name: connectionName,
      },
    });

    if (connection) {
      // Update existing connection (config only, credentials are in Secrets Manager)
      connection = await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          config: {
            channels: channelIds,
            minReplyCount: 1,
            includeThreadsOnly: true,
          },
          status: 'ACTIVE',
          lastSyncAt: new Date(),
        },
      });
    } else {
      // Create new connection (config only, credentials are in Secrets Manager)
      connection = await prisma.integrationConnection.create({
        data: {
          integrationType: 'slack',
          name: connectionName,
          config: {
            channels: channelIds,
            minReplyCount: 1,
            includeThreadsOnly: true,
          },
          status: 'ACTIVE',
        },
      });
    }

    logger.info(`Slack integration connected for ${targetLibraryId} library: ${connection.id}`);

    // Discover sources synchronously
    const discovered = await discoverSlackSources(connection.id, targetLibraryId);

    return NextResponse.json({
      success: true,
      message: 'Slack integration connected. Discovery complete.',
      connectionId: connection.id,
      libraryId: targetLibraryId,
      sourceCount: discovered.length,
      sources: discovered,
    });
  } catch (error) {
    logger.error('Slack integration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect Slack' },
      { status: 500 }
    );
  }
}

async function discoverSlackSources(connectionId: string, libraryId: string) {
  try {
    // Load the adapter dynamically
    const { SlackDiscoveryAdapter } = await import('@/lib/v2/sources/adapters/slack-adapter');
    const adapter = new SlackDiscoveryAdapter();

    // Run discovery
    const discovered = await adapter.discover({
      connectionId,
      libraryId: libraryId as 'it' | 'knowledge' | 'gtm' | 'customers' | 'prompts' | 'personas' | 'templates',
      since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      limit: 100,
    });

    logger.info(`Discovered ${discovered.length} Slack sources for ${libraryId} library (connection ${connectionId})`);

    return discovered;
  } catch (error) {
    logger.error(`Failed to discover Slack sources:`, error);
    throw error;
  }
}
