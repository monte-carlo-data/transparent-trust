/**
 * POST /api/v2/sources/[id]/sync-content - Sync content for a customer-linked source
 *
 * Triggers lazy content sync for a customer-scoped source.
 * Fetches content from the original library source or external API.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { syncSourceContent } from '@/lib/v2/sources/source-content-sync-service';
import { prisma } from '@/lib/prisma';
import { canAccessCustomer } from '@/lib/v2/customers/customer-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/v2/sources/[id]/sync-content
 *
 * Syncs content for a customer-linked source.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sourceId } = await context.params;

    // Get source to check ownership
    const source = await prisma.stagedSource.findUnique({
      where: { id: sourceId },
      select: { customerId: true },
    });

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Only customer-scoped sources can be synced
    if (!source.customerId) {
      return NextResponse.json(
        { error: 'Only customer-linked sources can be synced' },
        { status: 400 }
      );
    }

    // Check customer access
    const canAccess = await canAccessCustomer(session.user.id, source.customerId);
    if (!canAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this customer' },
        { status: 403 }
      );
    }

    const result = await syncSourceContent(sourceId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      contentLength: result.contentLength,
      syncedAt: result.syncedAt,
    });
  } catch (error) {
    const { id: sourceId } = await context.params;
    logger.error('Error syncing source content', error, {
      sourceId,
      operation: 'syncSourceContent',
    });
    return NextResponse.json(
      { error: 'Failed to sync source content. Please try again.' },
      { status: 500 }
    );
  }
}
