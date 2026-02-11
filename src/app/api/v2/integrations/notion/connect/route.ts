/**
 * POST /api/v2/integrations/notion/connect
 *
 * Connects a Notion workspace for a library integration.
 * Discovers and stages sources synchronously (user controls what's imported).
 *
 * Body:
 *   - NOTION_API_TOKEN: Notion API token
 *   - NOTION_DATABASE_IDS: Comma-separated database IDs (optional)
 *   - NOTION_PAGE_IDS: Comma-separated page IDs (optional)
 *   - NOTION_ROOT_PAGE_ID: Root page ID (optional)
 *   - libraryId: Target library ('it', 'knowledge', 'gtm') - default: 'knowledge'
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

    const { NOTION_API_TOKEN, NOTION_DATABASE_IDS, NOTION_PAGE_IDS, NOTION_ROOT_PAGE_ID, libraryId } = await req.json();

    if (!NOTION_API_TOKEN) {
      return NextResponse.json({ error: 'Notion API token is required' }, { status: 400 });
    }

    // Validate token format
    if (!NOTION_API_TOKEN.startsWith('secret_')) {
      return NextResponse.json(
        { error: 'Invalid Notion token format (should start with secret_)' },
        { status: 400 }
      );
    }

    const targetLibraryId = libraryId || 'knowledge';
    const databaseIds = NOTION_DATABASE_IDS?.split(',').map((id: string) => id.trim()).filter(Boolean) || [];
    const pageIds = NOTION_PAGE_IDS?.split(',').map((id: string) => id.trim()).filter(Boolean) || [];

    // Store token in AWS Secrets Manager
    await putSecret('notion-api-token', NOTION_API_TOKEN);
    logger.info('Notion API token stored in Secrets Manager');

    // Library-specific connection names
    const libraryNames: Record<string, string> = {
      'it': 'IT Notion Documentation',
      'knowledge': 'Knowledge Notion Documentation',
      'gtm': 'GTM Notion Documentation',
    };
    const connectionName = libraryNames[targetLibraryId] || 'Notion Documentation';

    // Find or create the Notion integration connection for this library
    let connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'notion',
        name: connectionName,
      },
    });

    if (connection) {
      // Update existing connection (config only, credentials are in Secrets Manager)
      connection = await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          config: {
            databaseIds,
            pageIds,
            rootPageId: NOTION_ROOT_PAGE_ID || '',
          },
          status: 'ACTIVE',
          lastSyncAt: new Date(),
        },
      });
    } else {
      // Create new connection (config only, credentials are in Secrets Manager)
      connection = await prisma.integrationConnection.create({
        data: {
          integrationType: 'notion',
          name: connectionName,
          config: {
            databaseIds,
            pageIds,
            rootPageId: NOTION_ROOT_PAGE_ID || '',
          },
          status: 'ACTIVE',
        },
      });
    }

    logger.info(`Notion integration connected for ${targetLibraryId} library: ${connection.id}`);

    // Discover sources synchronously
    const discovered = await discoverNotionSources(connection.id, targetLibraryId);

    return NextResponse.json({
      success: true,
      message: 'Notion integration connected. Discovery complete.',
      connectionId: connection.id,
      libraryId: targetLibraryId,
      sourceCount: discovered.length,
      sources: discovered,
    });
  } catch (error) {
    logger.error('Notion integration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect Notion' },
      { status: 500 }
    );
  }
}

async function discoverNotionSources(connectionId: string, targetLibraryId: string) {
  try {
    // Load the adapter dynamically
    const { NotionDiscoveryAdapter } = await import('@/lib/v2/sources/adapters/notion-adapter');
    const adapter = new NotionDiscoveryAdapter();

    // Run discovery
    const discovered = await adapter.discover({
      connectionId,
      libraryId: targetLibraryId as 'it' | 'knowledge' | 'gtm' | 'customers' | 'prompts' | 'personas' | 'templates',
      since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      limit: 100,
    });

    logger.info(`Discovered ${discovered.length} Notion sources for ${targetLibraryId} library (connection ${connectionId})`);

    return discovered;
  } catch (error) {
    logger.error(`Failed to discover Notion sources:`, error);
    throw error;
  }
}
