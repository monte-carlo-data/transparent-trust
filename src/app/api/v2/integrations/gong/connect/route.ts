/**
 * POST /api/v2/integrations/gong/connect
 *
 * Configure Gong integration credentials and workspace.
 *
 * Body:
 *   - accessKey: string (Gong Access Key)
 *   - accessKeySecret: string (Gong Access Key Secret)
 *   - workspaceId: string (optional) - Gong workspace ID for your company
 *   - libraryId: Target library ('it', 'knowledge', 'gtm') - default: 'gtm'
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { putSecret } from '@/lib/secrets';
import { logger } from '@/lib/logger';
import { getAdapter } from '@/lib/v2/sources/adapters/base-adapter';

export async function POST(req: NextRequest) {
  try {
    const { accessKey, accessKeySecret, workspaceId, libraryId } = await req.json();

    if (!accessKey || !accessKeySecret) {
      return NextResponse.json(
        { error: 'Missing required fields: accessKey, accessKeySecret' },
        { status: 400 }
      );
    }

    // Validate workspaceId format if provided
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

    const targetLibraryId = libraryId || 'gtm';

    // Store credentials in AWS Secrets Manager
    // Note: Secret names should be lowercase (getSecretPath automatically adds environment prefix)
    await putSecret('gong-access-key', accessKey);
    await putSecret('gong-access-key-secret', accessKeySecret);

    // Test connection
    const adapter = getAdapter('gong');
    if (!adapter || !adapter.testConnection) {
      return NextResponse.json(
        { error: 'Gong adapter not found or does not support testing' },
        { status: 500 }
      );
    }

    const testResult = await adapter.testConnection();

    if (!testResult.success) {
      return NextResponse.json(
        { error: `Connection test failed: ${testResult.error}` },
        { status: 400 }
      );
    }

    // Library-specific connection names
    const libraryNames: Record<string, string> = {
      'it': 'IT Gong Integration',
      'knowledge': 'Knowledge Gong Integration',
      'gtm': 'GTM Gong Integration',
    };
    const connectionName = libraryNames[targetLibraryId] || 'Gong Integration';

    // Find or create integration connection record for this library
    let connection = await prisma.integrationConnection.findFirst({
      where: {
        integrationType: 'gong',
        name: connectionName,
      },
    });

    const config = {
      ...(workspaceId && { workspaceId: workspaceId.trim() }),
      configuredAt: new Date().toISOString(),
    };

    if (connection) {
      connection = await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          status: 'ACTIVE',
          lastSyncAt: new Date(),
          config,
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
      libraryId: targetLibraryId,
      status: connection.status,
      testedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Gong connect error:', error);
    return NextResponse.json(
      { error: 'Failed to configure Gong integration' },
      { status: 500 }
    );
  }
}
