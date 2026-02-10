/**
 * GET /api/v2/integrations/[type]/status
 *
 * Returns status for a specific integration type.
 *
 * Path Parameters:
 *   - type: Integration type (notion, slack, zendesk, gong)
 *
 * Query Parameters:
 *   - verify: Run live connection test (optional, default: false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationStatus } from '@/lib/v2/integrations/integration-status-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const verify = searchParams.get('verify') === 'true';
    const { type } = await params;

    const status = await getIntegrationStatus(type, { verify });

    if (!status) {
      return NextResponse.json(
        { error: 'Integration type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Integration status error:', error);
    return NextResponse.json(
      { error: 'Failed to get integration status' },
      { status: 500 }
    );
  }
}
