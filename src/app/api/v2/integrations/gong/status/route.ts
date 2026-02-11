/**
 * GET /api/v2/integrations/gong/status?libraryId=...&customerId=...
 *
 * Get Gong integration status and configuration.
 * Returns connection status, config (workspace ID, filters), etc.
 *
 * Requires authentication and library access permissions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { canManageLibrary } from '@/lib/v2/teams';
import { INTEGRATION_SUPPORTED_LIBRARIES } from '@/lib/v2/library-constants';
import { getIntegrationConnectionName } from '@/lib/v2/integrations/integration-config';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { LibraryId } from '@/types/v2';

export async function GET(req: NextRequest) {
  try {
    // Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let libraryId = searchParams.get('libraryId');
    const customerId = searchParams.get('customerId');

    // Default to 'gtm' if not provided (matching discover endpoint behavior)
    if (!libraryId) {
      libraryId = 'gtm';
    }

    // Validate libraryId
    if (!INTEGRATION_SUPPORTED_LIBRARIES.includes(libraryId as LibraryId)) {
      return NextResponse.json(
        {
          error: 'Invalid library ID',
          message: `Library must be one of: ${INTEGRATION_SUPPORTED_LIBRARIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Authorization - check library access
    const hasAccess = await canManageLibrary(session.user.id, libraryId as LibraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    // Use centralized connection name utility for consistency
    const connectionName = getIntegrationConnectionName('gong', libraryId, customerId || undefined);

    // Find integration connection
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'gong',
        name: connectionName,
      },
    });

    if (!connection) {
      return NextResponse.json({
        isConfigured: false,
        isHealthy: false,
        config: null,
      });
    }

    // Connection exists - check if it's healthy
    const isHealthy = connection.status === 'ACTIVE' || connection.status === 'CONNECTED';

    return NextResponse.json({
      isConfigured: true,
      isHealthy,
      config: connection.config,
      lastSyncAt: connection.lastSyncAt?.toISOString(),
      lastError: connection.status === 'ERROR' || connection.status === 'FAILED'
        ? 'Connection test failed - check credentials'
        : undefined,
      lastChecked: connection.lastSyncAt?.toISOString() || new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to retrieve Gong integration status', error, {
      libraryId: req.nextUrl.searchParams.get('libraryId') || undefined,
      customerId: req.nextUrl.searchParams.get('customerId') || undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to retrieve Gong status',
        message: error instanceof Error ? error.message : 'Database query failed',
      },
      { status: 500 }
    );
  }
}
