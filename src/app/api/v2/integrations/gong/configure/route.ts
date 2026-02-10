/**
 * POST /api/v2/integrations/gong/configure
 *
 * Save Gong configuration (workspace ID, filters, etc.)
 * Separate from credentials - this is operational config.
 *
 * Body:
 *   - libraryId: Target library
 *   - workspaceId: Gong workspace ID (optional, used for global config only)
 *   - minDuration: Minimum call duration in seconds (optional)
 *   - crmId: Customer ID to explicitly assign calls to this customer (optional, overrides domain matching)
 *   - domain: Email domain for customer matching (optional, used if crmId not provided)
 *   - customerId: Customer ID for customer-scoped config (optional)
 *   - internalCompanyName: Your company name for filtering in Gong call titles (optional)
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
const MAX_DURATION_SECONDS = 86400; // 24 hours

export async function POST(req: NextRequest) {
  try {
    // Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { libraryId, workspaceId, minDuration, crmId, domain, customerId, internalCompanyName } = await req.json();

    if (!libraryId) {
      return NextResponse.json(
        { error: 'Missing required field: libraryId' },
        { status: 400 }
      );
    }

    // Validate libraryId
    if (!INTEGRATION_SUPPORTED_LIBRARIES.includes(libraryId)) {
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

    // NOTE: Workspace ID is now configured globally in /v2/admin/settings and applies to all customers.
    // Customer-scoped configs use crmId or domain for customer identification, not workspace isolation.

    // Validate workspaceId format (must be numeric)
    if (workspaceId) {
      const trimmed = workspaceId.trim();
      if (!/^\d+$/.test(trimmed)) {
        return NextResponse.json(
          {
            error: 'Invalid workspace ID format',
            message: 'Workspace ID must be numeric (e.g., 123456789)',
          },
          { status: 400 }
        );
      }
    }

    // Validate minDuration range
    if (minDuration !== undefined) {
      if (typeof minDuration !== 'number' || minDuration < 0) {
        return NextResponse.json(
          {
            error: 'Invalid minimum duration',
            message: 'Minimum duration must be a positive number of seconds',
          },
          { status: 400 }
        );
      }
      if (minDuration > MAX_DURATION_SECONDS) {
        return NextResponse.json(
          {
            error: 'Invalid minimum duration',
            message: `Minimum duration cannot exceed 24 hours (${MAX_DURATION_SECONDS} seconds)`,
          },
          { status: 400 }
        );
      }
    }

    // Validate crmId format (alphanumeric and common separators)
    if (crmId) {
      const trimmed = crmId.trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return NextResponse.json(
          {
            error: 'Invalid CRM ID format',
            message: 'CRM ID must contain only letters, numbers, hyphens, and underscores',
          },
          { status: 400 }
        );
      }
    }

    // Validate domain format (basic email domain validation)
    if (domain) {
      const trimmed = domain.trim();
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(trimmed)) {
        return NextResponse.json(
          {
            error: 'Invalid domain format',
            message: 'Domain must be a valid email domain (e.g., acme.com)',
          },
          { status: 400 }
        );
      }
    }

    const targetLibraryId = libraryId;

    // Use centralized connection name utility for consistency
    const connectionName = getIntegrationConnectionName('gong', targetLibraryId, customerId);

    // Find or create integration connection record
    let connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'gong',
        name: connectionName,
      },
    });

    const config = {
      ...(workspaceId && { workspaceId: workspaceId.trim() }),
      ...(minDuration && minDuration > 0 && { minDuration }),
      ...(crmId && { crmId: crmId.trim() }),
      ...(domain && { domain: domain.trim() }),
      ...(internalCompanyName && { internalCompanyName: internalCompanyName.trim() }),
      configuredAt: new Date().toISOString(),
    };

    if (connection) {
      connection = await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          config,
          status: 'ACTIVE',
        },
      });
    } else {
      connection = await prisma.integrationConnection.create({
        data: {
          integrationType: 'gong',
          name: connectionName,
          status: 'ACTIVE',
          config,
        },
      });
    }

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      config: connection.config,
    });
  } catch (error) {
    const body = await req.json().catch(() => ({}));
    logger.error('Failed to save Gong configuration', error, {
      libraryId: body.libraryId || undefined,
      customerId: body.customerId || undefined,
      hasWorkspaceId: !!body.workspaceId,
      hasMinDuration: body.minDuration > 0,
    });
    return NextResponse.json(
      {
        error: 'Failed to save Gong configuration',
        message: error instanceof Error ? error.message : 'Database operation failed',
      },
      { status: 500 }
    );
  }
}
