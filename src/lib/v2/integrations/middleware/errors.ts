/**
 * Error Response Helpers for V2 Integration APIs
 *
 * Provides consistent error response formatting across all integration endpoints.
 */

import { NextResponse } from 'next/server';
import type { IntegrationError, IntegrationErrorCode } from '../types';
import { logger } from '@/lib/logger';

/**
 * Create a standardized JSON error response
 */
export function errorResponse(
  error: string,
  message: string,
  code: IntegrationErrorCode,
  status: number,
  hint?: string
): NextResponse<IntegrationError> {
  return NextResponse.json(
    {
      error,
      message,
      code,
      ...(hint && { hint }),
    },
    { status }
  );
}

/**
 * Create an "integration not configured" error
 */
export function integrationNotConfiguredError(
  integrationType: string,
  libraryId: string
): NextResponse<IntegrationError> {
  return errorResponse(
    `${capitalize(integrationType)} not configured`,
    `The ${integrationType} integration is not configured for the ${libraryId} library.`,
    'INTEGRATION_NOT_CONFIGURED',
    400,
    `Please configure the ${integrationType} connection in the integration settings.`
  );
}

/**
 * Create an "integration error" response for external API failures
 */
export function integrationError(
  integrationType: string,
  errorMessage: string,
  hint?: string
): NextResponse<IntegrationError> {
  return errorResponse(
    `${capitalize(integrationType)} error`,
    errorMessage,
    'INTEGRATION_ERROR',
    500,
    hint || `Check that the ${integrationType} credentials are valid and the service is accessible.`
  );
}

/**
 * Create an "internal error" response
 */
export function internalError(
  message: string = 'An unexpected error occurred'
): NextResponse<IntegrationError> {
  return errorResponse(
    'Internal error',
    message,
    'INTERNAL_ERROR',
    500,
    'Please try again or contact support if the issue persists.'
  );
}

/**
 * Log an error and return a standardized response
 */
export function logAndReturnError(
  context: string,
  error: unknown,
  integrationType?: string
): NextResponse<IntegrationError> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  logger.error(`Integration error in ${context}`, error, {
    context,
    integrationType,
    errorMessage,
  });

  // Return a sanitized message to the user - avoid exposing internal details
  const userMessage = integrationType
    ? `An error occurred while communicating with ${integrationType}`
    : 'An unexpected error occurred';

  if (integrationType) {
    return integrationError(integrationType, userMessage);
  }

  return internalError(userMessage);
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
