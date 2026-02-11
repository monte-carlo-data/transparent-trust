/**
 * GET /api/v2/integrations/zendesk/discover
 *
 * Discover Zendesk tickets.
 * Requires authentication and library access.
 *
 * Query parameters:
 *   - libraryId: Library to discover for (default: 'it')
 *   - customerId: Optional customer ID for customer-scoped sources
 *   - limit: Max tickets to return (default: 50, max: 200)
 *   - since: Unix timestamp (seconds) to fetch tickets since
 *   - page: Page number for pagination (default: 1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { zendeskHandler } from '@/lib/v2/integrations/handlers/zendesk-handler';
import {
  requireLibraryAccess,
  isAuthSuccess,
  parseDiscoveryParams,
  isValidationSuccess,
  logAndReturnError,
  integrationNotConfiguredError,
} from '@/lib/v2/integrations/middleware';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Parse and validate parameters
    const paramsResult = parseDiscoveryParams(searchParams);
    if (!isValidationSuccess(paramsResult)) {
      return paramsResult.response;
    }
    const params = paramsResult.data;

    // Check authentication and authorization
    const authResult = await requireLibraryAccess(params.libraryId, params.customerId);
    if (!isAuthSuccess(authResult)) {
      return authResult.response;
    }

    // Test connection first
    const connectionTest = await zendeskHandler.testConnection();
    if (!connectionTest.success) {
      return integrationNotConfiguredError('Zendesk', params.libraryId);
    }

    // Discover tickets
    const result = await zendeskHandler.discover(params);

    return NextResponse.json(result);
  } catch (error) {
    return logAndReturnError('Zendesk discover', error, 'Zendesk');
  }
}
