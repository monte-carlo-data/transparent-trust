/**
 * API Response Helpers
 *
 * Standardized response utilities for API routes.
 */

import { NextResponse } from 'next/server';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Sanitize error messages to prevent leaking internal details in production.
 * In development, returns the full message for debugging.
 * In production, returns a generic message unless it's explicitly safe.
 */
function sanitizeErrorMessage(message: string, fallback: string): string {
  if (isDev) {
    return message;
  }

  // Patterns that indicate internal/sensitive information
  const sensitivePatterns = [
    /prisma/i,
    /database/i,
    /sql/i,
    /column/i,
    /table/i,
    /constraint/i,
    /foreign key/i,
    /unique/i,
    /timeout/i,
    /connection/i,
    /ECONNREFUSED/i,
    /ENOTFOUND/i,
    /certificate/i,
    /secret/i,
    /token/i,
    /api[\s_-]?key/i,
    /password/i,
    /credential/i,
    /internal/i,
    /stack/i,
    /at\s+\w+\s+\(/i, // Stack trace pattern
    /node_modules/i,
    /\/src\//i,
    /\.ts:/i,
    /\.js:/i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(message)) {
      return fallback;
    }
  }

  return message;
}

/**
 * Create a successful JSON response.
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Standard error response generators.
 * Messages are sanitized in production to prevent information leakage.
 */
export const errors = {
  badRequest: (message = 'Bad Request') =>
    NextResponse.json(
      { error: sanitizeErrorMessage(message, 'Bad Request') },
      { status: 400 }
    ),

  unauthorized: (message = 'Unauthorized') =>
    NextResponse.json(
      { error: sanitizeErrorMessage(message, 'Unauthorized') },
      { status: 401 }
    ),

  forbidden: (message = 'Forbidden') =>
    NextResponse.json(
      { error: sanitizeErrorMessage(message, 'Forbidden') },
      { status: 403 }
    ),

  notFound: (message = 'Not Found') =>
    NextResponse.json(
      { error: sanitizeErrorMessage(message, 'Not Found') },
      { status: 404 }
    ),

  conflict: (message = 'Conflict') =>
    NextResponse.json(
      { error: sanitizeErrorMessage(message, 'Conflict') },
      { status: 409 }
    ),

  internal: (message = 'Internal Server Error') =>
    NextResponse.json(
      { error: sanitizeErrorMessage(message, 'Internal Server Error') },
      { status: 500 }
    ),

  badGateway: (message = 'Bad Gateway') =>
    NextResponse.json(
      { error: sanitizeErrorMessage(message, 'Bad Gateway') },
      { status: 502 }
    ),
};
