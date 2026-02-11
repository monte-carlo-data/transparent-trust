/**
 * GET /api/v2/integrations/gong/discover
 *
 * Discover Gong calls.
 * Requires authentication and library access.
 *
 * Query parameters:
 *   - libraryId: Library to discover for (default: 'gtm')
 *   - customerId: Optional customer ID for customer-scoped sources
 *   - limit: Max calls to return (default: 50, max: 200)
 *   - since: Unix timestamp (seconds) to fetch calls since
 */

import { NextRequest, NextResponse } from 'next/server';
import { gongHandler } from '@/lib/v2/integrations/handlers/gong-handler';
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

    // Parse and validate parameters (default to gtm for Gong)
    const libraryIdParam = searchParams.get('libraryId');
    if (!libraryIdParam) {
      searchParams.set('libraryId', 'gtm');
    }

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
    const connectionTest = await gongHandler.testConnection();
    if (!connectionTest.success) {
      return integrationNotConfiguredError('Gong', params.libraryId);
    }

    // Discover calls
    const result = await gongHandler.discover(params);

    return NextResponse.json(result);
  } catch (error) {
    return logAndReturnError('Gong discover', error, 'Gong');
  }
}
