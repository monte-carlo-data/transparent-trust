/**
 * Adapter Utility Types
 *
 * Shared type definitions for credential management, API clients, and batch processing.
 */

/**
 * Generic credential structure
 */
export interface BaseCredentials {
  [key: string]: string;
}

/**
 * Credential manager loading options
 */
export interface CredentialLoadOptions {
  connectionId?: string;
  libraryId?: string;
  customerId?: string;
  teamId?: string;
}

/**
 * Result of credential loading
 */
export interface CredentialLoadResult<TCreds, TConfig = Record<string, unknown>> {
  credentials: TCreds;
  config?: TConfig;
  connectionId: string | null;
}

/**
 * API client request options
 */
export interface ApiRequestOptions {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Batch processing result
 */
export interface BatchProcessResult<TInput, TOutput> {
  results: Map<TInput, TOutput>;
  errors: Map<TInput, Error>;
}
