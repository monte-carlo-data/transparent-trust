/**
 * GET /api/v2/integrations/slack/discover
 *
 * Discover Slack threads from configured channels.
 * Requires authentication and library access.
 *
 * Query parameters:
 *   - libraryId: Library to discover for (default: 'it')
 *   - customerId: Optional customer ID for customer-scoped sources
 *   - limit: Max threads to return (default: 50, max: 200)
 *   - since: Unix timestamp (seconds) to fetch threads since
 */

import { NextRequest, NextResponse } from 'next/server';
import { slackHandler } from '@/lib/v2/integrations/handlers/slack-handler';
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
    const connectionTest = await slackHandler.testConnection(params.libraryId, params.customerId);
    if (!connectionTest.success) {
      return integrationNotConfiguredError('Slack', params.libraryId);
    }

    // Discover threads
    const result = await slackHandler.discover(params);

    return NextResponse.json(result);
  } catch (error) {
    return logAndReturnError('Slack discover', error, 'Slack');
  }
}
