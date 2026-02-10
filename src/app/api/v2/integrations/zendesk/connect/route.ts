/**
 * POST /api/v2/integrations/zendesk/connect
 *
 * Connects a Zendesk instance for a library integration.
 * Discovers and stages sources synchronously (user controls what's imported).
 *
 * Body:
 *   - ZENDESK_SUBDOMAIN: Zendesk subdomain (e.g., 'mycompany')
 *   - ZENDESK_EMAIL: API user email
 *   - ZENDESK_API_TOKEN: API token
 *   - ZENDESK_TAGS: Comma-separated tags to filter (optional)
 *   - libraryId: Target library ('it', 'knowledge', 'gtm') - default: 'it'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { putSecret } from '@/lib/secrets';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN, ZENDESK_TAGS, libraryId } = await req.json();

    if (!ZENDESK_SUBDOMAIN || !ZENDESK_EMAIL || !ZENDESK_API_TOKEN) {
      return NextResponse.json(
        { error: 'Zendesk subdomain, email, and API token are required' },
        { status: 400 }
      );
    }

    const targetLibraryId = libraryId || 'it';
    const tags = ZENDESK_TAGS?.split(',').map((tag: string) => tag.trim()).filter(Boolean) || [];

    // Store credentials in AWS Secrets Manager
    // Uses 'internal' prefix to distinguish from support Zendesk instance
    await putSecret('zendesk-internal-subdomain', ZENDESK_SUBDOMAIN);
    await putSecret('zendesk-internal-email', ZENDESK_EMAIL);
    await putSecret('zendesk-internal-api-token', ZENDESK_API_TOKEN);
    logger.info('Zendesk internal credentials stored in Secrets Manager');

    // Library-specific connection names
    const libraryNames: Record<string, string> = {
      'it': 'IT Zendesk',
      'knowledge': 'Knowledge Zendesk',
      'gtm': 'GTM Zendesk',
    };
    const connectionName = libraryNames[targetLibraryId] || 'Zendesk Integration';

    // Find or create the Zendesk integration connection for this library
    let connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'zendesk',
        name: connectionName,
      },
    });

    if (connection) {
      // Update existing connection (config only, credentials are in Secrets Manager)
      connection = await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          config: {
            tags,
            status: ['solved', 'closed'],
            minComments: 1,
          },
          status: 'ACTIVE',
          lastSyncAt: new Date(),
        },
      });
    } else {
      // Create new connection (config only, credentials are in Secrets Manager)
      connection = await prisma.integrationConnection.create({
        data: {
          integrationType: 'zendesk',
          name: connectionName,
          config: {
            tags,
            status: ['solved', 'closed'],
            minComments: 1,
          },
          status: 'ACTIVE',
        },
      });
    }

    logger.info(`Zendesk integration connected for ${targetLibraryId} library: ${connection.id}`);

    // Discover sources synchronously
    const discovered = await discoverZendeskSources(connection.id, targetLibraryId);

    return NextResponse.json({
      success: true,
      message: 'Zendesk integration connected. Discovery complete.',
      connectionId: connection.id,
      libraryId: targetLibraryId,
      sourceCount: discovered.length,
      sources: discovered,
    });
  } catch (error) {
    logger.error('Zendesk integration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect Zendesk' },
      { status: 500 }
    );
  }
}

async function discoverZendeskSources(connectionId: string, libraryId: string) {
  try {
    // Load the adapter dynamically
    const { ZendeskDiscoveryAdapter } = await import('@/lib/v2/sources/adapters/zendesk-adapter');
    const adapter = new ZendeskDiscoveryAdapter();

    // Run discovery
    const discovered = await adapter.discover({
      connectionId,
      libraryId: libraryId as 'it' | 'knowledge' | 'gtm' | 'customers' | 'prompts' | 'personas' | 'templates',
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      limit: 100,
    });

    logger.info(`Discovered ${discovered.length} Zendesk sources for ${libraryId} library (connection ${connectionId})`);

    return discovered;
  } catch (error) {
    logger.error(`Failed to discover Zendesk sources:`, error);
    throw error;
  }
}
