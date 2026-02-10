/**
 * GET /api/v2/integrations/status
 *
 * Returns status for all integrations or a specific integration type.
 *
 * Query Parameters:
 *   - type: Filter to specific integration (optional)
 *   - verify: Run live connection test (optional, default: false)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getIntegrationStatus,
  getAllIntegrationStatuses,
} from '@/lib/v2/integrations/integration-status-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const verify = searchParams.get('verify') === 'true';

    if (type) {
      // Single integration status
      const status = await getIntegrationStatus(type, { verify });
      if (!status) {
        return NextResponse.json(
          { error: 'Integration type not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(status);
    }

    // All integrations status
    const statuses = await getAllIntegrationStatuses({ verify });
    return NextResponse.json({ integrations: statuses });
  } catch (error) {
    console.error('Integration status error:', error);
    return NextResponse.json(
      { error: 'Failed to get integration status' },
      { status: 500 }
    );
  }
}
