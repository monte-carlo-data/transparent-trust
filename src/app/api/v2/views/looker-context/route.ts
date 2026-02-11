import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { getLookerContextForAudit, type AuditType } from '@/lib/v2/views/looker-context-service';
import { canAccessCustomer } from '@/lib/v2/customers/customer-service';
import { LIBRARY_IDS, type LibraryId } from '@/types/v2';
import { logger } from '@/lib/logger';

const VALID_AUDIT_TYPES: AuditType[] = ['coverage', 'operations', 'adoption'];

/**
 * GET /api/v2/views/looker-context
 * Fetch Looker dashboard context for audit preview
 *
 * Query params:
 * - libraryId: Required. The library context (e.g., 'customers')
 * - customerId: Optional. Customer ID for customer-scoped audits
 * - auditType: Optional. Type of audit: 'coverage', 'operations', or 'adoption'. Defaults to 'operations'
 * - teamId: Required. Team ID to load the correct Looker integration config
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const libraryId = searchParams.get('libraryId');
    const customerId = searchParams.get('customerId');
    const auditTypeParam = searchParams.get('auditType');
    const teamId = searchParams.get('teamId');

    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId required' }, { status: 400 });
    }

    if (!teamId) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }

    // Validate libraryId against allowed values
    if (!LIBRARY_IDS.includes(libraryId as LibraryId)) {
      return NextResponse.json(
        { error: `Invalid libraryId. Must be one of: ${LIBRARY_IDS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate auditType if provided
    const auditType: AuditType = auditTypeParam && VALID_AUDIT_TYPES.includes(auditTypeParam as AuditType)
      ? (auditTypeParam as AuditType)
      : 'operations';

    // Check authorization if customerId is provided
    if (customerId) {
      const canAccess = await canAccessCustomer(session.user.id, customerId);
      if (!canAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // After validation, libraryId is a valid LibraryId
    const context = await getLookerContextForAudit(libraryId as LibraryId, customerId || undefined, auditType, teamId);

    if (!context) {
      return NextResponse.json(
        { error: 'Failed to fetch Looker dashboard data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      dashboardTitle: context.dashboardTitle,
      dashboardDescription: context.dashboardDescription,
      tiles: context.tiles,
      formattedHtml: context.formattedHtml,
      rawJson: context.rawJson,
    });
  } catch (error) {
    logger.error('Error fetching Looker context', { error });

    if (error instanceof Error) {
      if (error.message.includes('not configured')) {
        return NextResponse.json(
          { error: 'Looker integration not configured for this library' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch Looker context' },
      { status: 500 }
    );
  }
}
