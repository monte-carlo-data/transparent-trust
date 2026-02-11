/**
 * GET /api/v2/integrations/notion/configure?libraryId={libraryId}
 * POST /api/v2/integrations/notion/configure
 *
 * GET: Returns current Notion configuration and connection status
 * POST: Updates Notion configuration (databaseIds, pageIds, rootPageId)
 *
 * Query parameters (GET):
 * - libraryId (optional): Library context ('it', 'knowledge', 'gtm'). Defaults to 'it'
 *
 * Request body (POST):
 * {
 *   databaseIds: string | string[] (comma-separated or array)
 *   pageIds: string | string[] (comma-separated or array)
 *   rootPageId: string
 *   libraryId?: string (optional, defaults to 'it')
 * }
 *
 * Returns:
 * {
 *   configured: boolean (token exists in Secrets Manager)
 *   config: { databaseIds: string[], pageIds: string[], rootPageId: string }
 *   lastSyncAt: ISO date string or null
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSecret } from '@/lib/secrets';

interface NotionConfig {
  databaseIds: string[];
  pageIds: string[];
  rootPageId: string;
}

interface ConfigResponse {
  configured: boolean;
  config: NotionConfig;
  lastSyncAt: string | null;
}

async function getNotionConfigured(): Promise<boolean> {
  try {
    const token = await getSecret('notion-api-token');
    return !!(token && token.trim() && token.trim().toUpperCase() !== 'PLACEHOLDER');
  } catch (error) {
    logger.error('Failed to check Notion configuration status', {
      error,
      integrationType: 'notion',
    });
    return false;
  }
}

function isValidNotionId(id: string): boolean {
  const normalized = id.replace(/-/g, '');
  return /^[a-f0-9]{32}$/i.test(normalized);
}

export async function GET(): Promise<NextResponse> {
  // Authenticate the request
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return errors.unauthorized('Authentication required');
  }
  try {
    const configured = await getNotionConfigured();

    // Find IntegrationConnection for Notion/IT
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'notion',
        status: 'ACTIVE',
      },
    });

    const config: NotionConfig = connection?.config
      ? {
          databaseIds: (connection.config as Record<string, unknown>).databaseIds as string[] || [],
          pageIds: (connection.config as Record<string, unknown>).pageIds as string[] || [],
          rootPageId: ((connection.config as Record<string, unknown>).rootPageId as string) || '',
        }
      : {
          databaseIds: [],
          pageIds: [],
          rootPageId: '',
        };

    const response: ConfigResponse = {
      configured,
      config,
      lastSyncAt: connection?.lastSyncAt?.toISOString() || null,
    };

    return apiSuccess({ data: response });
  } catch (error) {
    logger.error('Failed to get Notion configuration', error);
    return errors.internal(
      'Failed to get Notion configuration: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Authenticate the request
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return errors.unauthorized('Authentication required');
  }

  try {
    const body = await request.json();
    const { databaseIds, pageIds, rootPageId } = body as {
      databaseIds?: string | string[];
      pageIds?: string | string[];
      rootPageId?: string;
    };

    // Parse comma-separated strings or use arrays directly
    const parseDatabaseIds = (val: unknown): string[] => {
      if (typeof val === 'string') {
        return val
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);
      }
      if (Array.isArray(val)) {
        return val.filter((id) => typeof id === 'string').map((id) => id.trim());
      }
      return [];
    };

    const parsedDatabaseIds = parseDatabaseIds(databaseIds);
    const parsedPageIds = parseDatabaseIds(pageIds);

    // Validate Notion ID formats
    const invalidDatabaseIds = parsedDatabaseIds.filter((id) => !isValidNotionId(id));
    const invalidPageIds = parsedPageIds.filter((id) => !isValidNotionId(id));

    if (invalidDatabaseIds.length > 0 || invalidPageIds.length > 0) {
      logger.warn('Invalid Notion ID format detected', {
        invalidDatabaseIds,
        invalidPageIds,
      });
      return errors.badRequest(
        'Invalid Notion ID format. IDs must be 32 hexadecimal characters (optionally with hyphens)'
      );
    }

    // Find or create IntegrationConnection for Notion
    let connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'notion',
        status: 'ACTIVE',
      },
    });

    const config: NotionConfig = {
      databaseIds: parsedDatabaseIds,
      pageIds: parsedPageIds,
      rootPageId: rootPageId || '',
    };

    if (connection) {
      // Update existing connection
      connection = await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          config: {
            ...(typeof connection.config === 'object' ? connection.config : {}),
            databaseIds: config.databaseIds,
            pageIds: config.pageIds,
            rootPageId: config.rootPageId,
          },
          lastSyncAt: new Date(),
        },
      });

      logger.info('Updated Notion integration configuration', {
        connectionId: connection.id,
        databaseCount: parsedDatabaseIds.length,
        pageCount: parsedPageIds.length,
      });
    } else {
      // Create new connection
      connection = await prisma.integrationConnection.create({
        data: {
          integrationType: 'notion',
          name: 'Notion Integration',
          config: {
            databaseIds: config.databaseIds,
            pageIds: config.pageIds,
            rootPageId: config.rootPageId,
          },
          status: 'ACTIVE',
        },
      });

      logger.info('Created Notion integration connection', {
        connectionId: connection.id,
        databaseCount: parsedDatabaseIds.length,
        pageCount: parsedPageIds.length,
      });
    }

    const configured = await getNotionConfigured();

    const response: ConfigResponse = {
      configured,
      config,
      lastSyncAt: connection.lastSyncAt?.toISOString() || null,
    };

    return apiSuccess({
      data: {
        ...response,
        message: 'Notion configuration updated successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to configure Notion integration', error);
    return errors.internal(
      'Failed to configure Notion integration: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}
