/**
 * POST /api/v2/sources/link-to-customer - Link library sources to a customer
 *
 * Creates customer-scoped copies of library sources.
 * Supports single and bulk linking operations.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import {
  linkSourceToCustomer,
  linkSourcesToCustomer,
} from '@/lib/v2/sources/source-linking-service';
import { canManageCustomer } from '@/lib/v2/customers/customer-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/v2/sources/link-to-customer
 *
 * Body (single):
 *   { sourceId: string, customerId: string }
 *
 * Body (bulk):
 *   { sourceIds: string[], customerId: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceId, sourceIds, customerId } = body;

    // Validate customerId
    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    // Check customer access
    const canManage = await canManageCustomer(session.user.id, customerId);
    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this customer' },
        { status: 403 }
      );
    }

    // Bulk link
    if (sourceIds && Array.isArray(sourceIds)) {
      if (sourceIds.length === 0) {
        return NextResponse.json(
          { error: 'sourceIds array cannot be empty' },
          { status: 400 }
        );
      }

      if (sourceIds.length > 100) {
        return NextResponse.json(
          { error: 'Maximum 100 sources can be linked at once' },
          { status: 400 }
        );
      }

      const result = await linkSourcesToCustomer({
        sourceIds,
        customerId,
        linkedBy: session.user.id,
      });

      // Return success: false if there were any errors
      return NextResponse.json({
        success: result.errors.length === 0,
        linked: result.linked,
        skipped: result.skipped,
        errors: result.errors,
      });
    }

    // Single link
    if (sourceId) {
      const result = await linkSourceToCustomer({
        sourceId,
        customerId,
        linkedBy: session.user.id,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        linkedSourceId: result.linkedSourceId,
      });
    }

    return NextResponse.json(
      { error: 'Either sourceId or sourceIds is required' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Error linking source to customer', error, {
      operation: 'linkSourceToCustomer',
    });
    return NextResponse.json(
      { error: 'Failed to link source to customer. Please try again.' },
      { status: 500 }
    );
  }
}
