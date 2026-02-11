/**
 * Request Validation Middleware for V2 Integration APIs
 *
 * Provides consistent parameter validation across all integration endpoints.
 */

import type { LibraryId } from '@/types/v2';
import { INTEGRATION_SUPPORTED_LIBRARIES } from '@/lib/v2/library-constants';
import type {
  DiscoveryParams,
  StageListParams,
  SourceStatus,
  IntegrationError,
  MiddlewareResult,
} from '../types';

/**
 * Default values for pagination
 */
const DEFAULTS = {
  DISCOVERY_LIMIT: 50,
  DISCOVERY_MAX_LIMIT: 200,
  STAGE_LIMIT: 100,
  STAGE_MAX_LIMIT: 500,
  STAGE_OFFSET: 0,
};

/**
 * Parse and validate discovery request parameters
 */
export function parseDiscoveryParams(
  searchParams: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number } = {}
): MiddlewareResult<DiscoveryParams> {
  const { defaultLimit = DEFAULTS.DISCOVERY_LIMIT, maxLimit = DEFAULTS.DISCOVERY_MAX_LIMIT } =
    options;

  // Validate libraryId
  const libraryIdParam = searchParams.get('libraryId') || 'it';
  if (!INTEGRATION_SUPPORTED_LIBRARIES.includes(libraryIdParam as LibraryId)) {
    return {
      success: false,
      response: createValidationError({
        error: 'Invalid library ID',
        message: `Library must be one of: ${INTEGRATION_SUPPORTED_LIBRARIES.join(', ')}`,
        code: 'INVALID_LIBRARY',
      }),
    };
  }
  const libraryId = libraryIdParam as LibraryId;

  // Parse and validate limit
  const limitParam = searchParams.get('limit');
  let limit = defaultLimit;
  if (limitParam) {
    limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit < 1) {
      return {
        success: false,
        response: createValidationError({
          error: 'Invalid limit',
          message: `Limit "${limitParam}" is not a valid positive integer`,
          code: 'INVALID_LIMIT',
        }),
      };
    }
  }
  if (limit > maxLimit) {
    return {
      success: false,
      response: createValidationError({
        error: 'Invalid limit',
        message: `Limit must be between 1 and ${maxLimit}`,
        code: 'INVALID_LIMIT',
      }),
    };
  }

  // Parse since parameter (Unix timestamp in seconds)
  const sinceParam = searchParams.get('since');
  let since: Date | undefined;
  if (sinceParam) {
    const sinceTs = parseInt(sinceParam, 10);
    if (isNaN(sinceTs)) {
      return {
        success: false,
        response: createValidationError({
          error: 'Invalid since parameter',
          message: `Since "${sinceParam}" is not a valid Unix timestamp`,
          code: 'INVALID_SINCE',
        }),
      };
    }
    since = new Date(sinceTs * 1000);
  }

  // Parse page parameter
  const pageParam = searchParams.get('page');
  let page = 1;
  if (pageParam) {
    page = parseInt(pageParam, 10);
    if (isNaN(page) || page < 1) {
      return {
        success: false,
        response: createValidationError({
          error: 'Invalid page parameter',
          message: `Page "${pageParam}" is not a valid positive integer`,
          code: 'INVALID_PAGE',
        }),
      };
    }
  }

  // Get optional customerId
  const customerId = searchParams.get('customerId') || undefined;

  // Get optional cursor for cursor-based pagination
  const cursor = searchParams.get('cursor') || undefined;

  return {
    success: true,
    data: {
      libraryId,
      customerId,
      limit,
      since,
      page,
      cursor,
    },
  };
}

/**
 * Parse and validate stage list request parameters
 */
export function parseStageListParams(
  searchParams: URLSearchParams,
  _sourceType: string,
  options: { defaultLimit?: number; maxLimit?: number } = {}
): MiddlewareResult<StageListParams> {
  const { defaultLimit = DEFAULTS.STAGE_LIMIT, maxLimit = DEFAULTS.STAGE_MAX_LIMIT } = options;

  // Validate libraryId
  const libraryIdParam = searchParams.get('libraryId') || 'it';
  if (!INTEGRATION_SUPPORTED_LIBRARIES.includes(libraryIdParam as LibraryId)) {
    return {
      success: false,
      response: createValidationError({
        error: 'Invalid library ID',
        message: `Library must be one of: ${INTEGRATION_SUPPORTED_LIBRARIES.join(', ')}`,
        code: 'INVALID_LIBRARY',
      }),
    };
  }
  const libraryId = libraryIdParam as LibraryId;

  // Validate status
  const statusParam = searchParams.get('status') || 'NEW';
  const validStatuses: SourceStatus[] = ['NEW', 'REVIEWED', 'ASSIGNED', 'IGNORED'];
  if (!validStatuses.includes(statusParam as SourceStatus)) {
    return {
      success: false,
      response: createValidationError({
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS',
      }),
    };
  }
  const status = statusParam as SourceStatus;

  // Parse and validate limit
  const limitParam = searchParams.get('limit');
  let limit = defaultLimit;
  if (limitParam) {
    limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit < 1) {
      return {
        success: false,
        response: createValidationError({
          error: 'Invalid limit',
          message: `Limit "${limitParam}" is not a valid positive integer`,
          code: 'INVALID_LIMIT',
        }),
      };
    }
  }
  if (limit > maxLimit) {
    return {
      success: false,
      response: createValidationError({
        error: 'Invalid limit',
        message: `Limit must be between 1 and ${maxLimit}`,
        code: 'INVALID_LIMIT',
      }),
    };
  }

  // Parse offset
  const offsetParam = searchParams.get('offset');
  let offset = DEFAULTS.STAGE_OFFSET;
  if (offsetParam) {
    offset = parseInt(offsetParam, 10);
    if (isNaN(offset) || offset < 0) {
      return {
        success: false,
        response: createValidationError({
          error: 'Invalid offset',
          message: `Offset "${offsetParam}" is not a valid non-negative integer`,
          code: 'INVALID_OFFSET',
        }),
      };
    }
  }

  // Get optional customerId
  const customerId = searchParams.get('customerId') || undefined;

  return {
    success: true,
    data: {
      libraryId,
      customerId,
      status,
      limit,
      offset,
    },
  };
}

/**
 * Validate stage create request body
 * @param body - The request body to validate
 */
export function validateStageCreateBody(
  body: unknown
): MiddlewareResult<{
  items: Array<{
    externalId: string;
    title: string;
    content: string;
    contentPreview: string;
    metadata?: Record<string, unknown>;
  }>;
  libraryId: LibraryId;
  customerId?: string;
}> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      response: createValidationError({
        error: 'Invalid request body',
        message: 'Request body must be a JSON object',
        code: 'INVALID_BODY',
      }),
    };
  }

  const data = body as Record<string, unknown>;

  // Check for items array
  if (!Array.isArray(data.items)) {
    return {
      success: false,
      response: createValidationError({
        error: 'Invalid request body',
        message: 'Request body must include an "items" array',
        code: 'INVALID_BODY',
      }),
    };
  }

  // Validate libraryId
  const libraryId = (data.libraryId as string) || 'it';
  if (!INTEGRATION_SUPPORTED_LIBRARIES.includes(libraryId as LibraryId)) {
    return {
      success: false,
      response: createValidationError({
        error: 'Invalid library ID',
        message: `Library must be one of: ${INTEGRATION_SUPPORTED_LIBRARIES.join(', ')}`,
        code: 'INVALID_LIBRARY',
      }),
    };
  }

  // Validate items structure
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (!item || typeof item !== 'object') {
      return {
        success: false,
        response: createValidationError({
          error: 'Invalid item',
          message: `Item at index ${i} must be an object with externalId, title, content, and contentPreview`,
          code: 'INVALID_BODY',
        }),
      };
    }

    const itemObj = item as Record<string, unknown>;
    if (typeof itemObj.externalId !== 'string' || !itemObj.externalId) {
      return {
        success: false,
        response: createValidationError({
          error: 'Invalid item',
          message: `Item at index ${i} must have a non-empty externalId string. Got type: ${typeof itemObj.externalId}`,
          code: 'INVALID_BODY',
        }),
      };
    }

    if (typeof itemObj.title !== 'string') {
      return {
        success: false,
        response: createValidationError({
          error: 'Invalid item',
          message: `Item at index ${i} must have a title string. Got type: ${typeof itemObj.title}`,
          code: 'INVALID_BODY',
        }),
      };
    }

    if (typeof itemObj.content !== 'string') {
      return {
        success: false,
        response: createValidationError({
          error: 'Invalid item',
          message: `Item at index ${i} must have a content string. Got type: ${typeof itemObj.content}`,
          code: 'INVALID_BODY',
        }),
      };
    }

    if (typeof itemObj.contentPreview !== 'string') {
      return {
        success: false,
        response: createValidationError({
          error: 'Invalid item',
          message: `Item at index ${i} must have a contentPreview string. Got type: ${typeof itemObj.contentPreview}`,
          code: 'INVALID_BODY',
        }),
      };
    }
  }

  return {
    success: true,
    data: {
      items: data.items as Array<{
        externalId: string;
        title: string;
        content: string;
        contentPreview: string;
        metadata?: Record<string, unknown>;
      }>,
      libraryId: libraryId as LibraryId,
      customerId: (data.customerId as string) || undefined,
    },
  };
}

/**
 * Type guard to check if validation succeeded
 */
export function isValidationSuccess<T>(
  result: MiddlewareResult<T>
): result is { success: true; data: T } {
  return result.success;
}

/**
 * Create a validation error response (internal helper)
 */
function createValidationError(error: IntegrationError): Response {
  return new Response(JSON.stringify(error), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
