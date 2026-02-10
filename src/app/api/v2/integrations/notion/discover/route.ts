/**
 * GET /api/v2/integrations/notion/discover
 *
 * Discover Notion pages.
 * Requires authentication and library access.
 *
 * Query parameters:
 *   - libraryId: Library to discover for (default: 'it')
 *   - customerId: Optional customer ID for customer-scoped sources
 *   - limit: Max pages to return (default: 50, max: 200)
 *   - since: Unix timestamp (seconds) to fetch pages since
 */

import { NextRequest, NextResponse } from 'next/server';
import { notionHandler } from '@/lib/v2/integrations/handlers/notion-handler';
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
    const connectionTest = await notionHandler.testConnection();
    if (!connectionTest.success) {
      return integrationNotConfiguredError('Notion', params.libraryId);
    }

    // Discover pages
    const result = await notionHandler.discover(params);

    return NextResponse.json(result);
  } catch (error) {
    return logAndReturnError('Notion discover', error, 'Notion');
  }
}
