/**
 * Unified Integration API Types
 *
 * Shared types and response formats for all V2 integration endpoints.
 * Used by Slack, Zendesk, Gong, and Notion integrations.
 */

import type { LibraryId, SourceType } from '@/types/v2';

// =============================================================================
// DISCOVERY TYPES
// =============================================================================

/**
 * Common parameters for discovery requests
 */
export interface DiscoveryParams {
  libraryId: LibraryId;
  customerId?: string;
  limit: number;
  since?: Date;
  page?: number;
  /** Cursor for cursor-based pagination (e.g., Gong API) */
  cursor?: string;
}

/**
 * A discovered item from an external source (before staging)
 */
export interface DiscoveredItem {
  externalId: string;
  title: string;
  content: string;
  contentPreview: string;
  metadata: Record<string, unknown>;
}

/**
 * Unified response format for discovery endpoints
 */
export interface DiscoveryResponse<T = DiscoveredItem> {
  items: T[];
  pagination: {
    hasMore: boolean;
    page?: number;
    nextPage?: number;
    totalFound: number;
    /** Cursor for next page (cursor-based pagination) */
    cursor?: string;
  };
  meta: {
    sourceType: SourceType;
    libraryId: LibraryId;
    customerId?: string;
  };
}

// =============================================================================
// STAGING TYPES
// =============================================================================

/**
 * Source status for filtering staged sources
 *
 * - NEW: Not reviewed (stagedBy=null, no assignments)
 * - REVIEWED: Reviewed but not assigned (stagedBy set, no assignments)
 * - ASSIGNED: Has skill assignments (incorporated)
 * - IGNORED: Explicitly ignored
 *
 * Note: UI may map these to simpler names:
 * - "pending" = NEW + REVIEWED (not yet assigned)
 * - "incorporated" = ASSIGNED (has assignments)
 * - "ignored" = IGNORED
 */
export type SourceStatus = 'NEW' | 'REVIEWED' | 'ASSIGNED' | 'IGNORED';

export const SOURCE_STATUSES: SourceStatus[] = ['NEW', 'REVIEWED', 'ASSIGNED', 'IGNORED'];

/**
 * Parameters for listing staged sources
 */
export interface StageListParams {
  libraryId: LibraryId;
  customerId?: string;
  status?: SourceStatus;
  limit: number;
  offset: number;
}

/**
 * Summary of a staged source for list responses
 */
export interface StagedSourceSummary {
  id: string;
  externalId: string;
  title: string;
  contentPreview: string;
  status: SourceStatus;
  stagedAt: string;
  metadata: Record<string, unknown>;
}

/**
 * Unified response format for stage list endpoints (GET)
 */
export interface StageListResponse {
  items: StagedSourceSummary[];
  counts: {
    NEW: number;
    REVIEWED: number;
    ASSIGNED: number;
    IGNORED: number;
  };
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

/**
 * Input for staging new sources (POST body)
 */
export interface StageCreateInput {
  items: Array<{
    externalId: string;
    title: string;
    content: string;
    contentPreview: string;
    metadata?: Record<string, unknown>;
  }>;
  libraryId: LibraryId;
  customerId?: string;
}

/**
 * Unified response format for stage create endpoints (POST)
 */
export interface StageCreateResponse {
  staged: number;
  skipped: number;
  total: number;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Error codes for integration API responses
 */
export type IntegrationErrorCode =
  | 'AUTH_REQUIRED'
  | 'LIBRARY_ACCESS_DENIED'
  | 'CUSTOMER_ACCESS_DENIED'
  | 'INVALID_LIBRARY'
  | 'INVALID_LIMIT'
  | 'INVALID_STATUS'
  | 'INVALID_BODY'
  | 'INVALID_SINCE'
  | 'INVALID_PAGE'
  | 'INVALID_OFFSET'
  | 'INTEGRATION_NOT_CONFIGURED'
  | 'INTEGRATION_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Standardized error response format
 */
export interface IntegrationError {
  error: string;
  message: string;
  code: IntegrationErrorCode;
  hint?: string;
}

// =============================================================================
// HANDLER TYPES
// =============================================================================

/**
 * Result type for middleware functions that can return either
 * successful data or an error response
 */
export type MiddlewareResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

/**
 * Authenticated request context passed through middleware
 */
export interface AuthContext {
  userId: string;
  libraryId: LibraryId;
  customerId?: string;
}
