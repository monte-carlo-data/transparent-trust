/**
 * GET /api/v2/integrations/gong/stage
 * POST /api/v2/integrations/gong/stage
 *
 * List and stage Gong calls as sources.
 * Requires authentication and library access.
 *
 * GET Query parameters:
 *   - libraryId: Library to query (default: 'gtm')
 *   - customerId: Optional customer ID for customer-scoped sources
 *   - status: Filter by status (NEW, REVIEWED, ASSIGNED, IGNORED) - default: NEW
 *   - limit: Results per page (default: 100, max: 500)
 *   - offset: Pagination offset (default: 0)
 *
 * POST Body:
 *   - items: Array of calls to stage
 *   - libraryId: Target library
 *   - customerId: Optional customer ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { gongHandler } from '@/lib/v2/integrations/handlers/gong-handler';
import {
  requireLibraryAccess,
  isAuthSuccess,
  parseStageListParams,
  validateStageCreateBody,
  isValidationSuccess,
  logAndReturnError,
} from '@/lib/v2/integrations/middleware';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Default to gtm for Gong
    if (!searchParams.get('libraryId')) {
      searchParams.set('libraryId', 'gtm');
    }

    // Parse and validate parameters
    const paramsResult = parseStageListParams(searchParams, 'gong');
    if (!isValidationSuccess(paramsResult)) {
      return paramsResult.response;
    }
    const params = paramsResult.data;

    // Check authentication and authorization
    const authResult = await requireLibraryAccess(params.libraryId, params.customerId);
    if (!isAuthSuccess(authResult)) {
      return authResult.response;
    }

    // Get staged sources
    const result = await gongHandler.getStagedSources(params);

    return NextResponse.json(result);
  } catch (error) {
    return logAndReturnError('Gong stage list', error, 'Gong');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const bodyResult = validateStageCreateBody(body);
    if (!isValidationSuccess(bodyResult)) {
      return bodyResult.response;
    }
    const { items, libraryId, customerId } = bodyResult.data;

    // Check authentication and authorization
    const authResult = await requireLibraryAccess(libraryId, customerId);
    if (!isAuthSuccess(authResult)) {
      return authResult.response;
    }

    // Stage the items
    const result = await gongHandler.stageItems(items, libraryId, customerId);

    return NextResponse.json(result);
  } catch (error) {
    return logAndReturnError('Gong stage create', error);
  }
}
