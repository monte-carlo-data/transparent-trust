/**
 * Error ID Generator
 *
 * Generates unique error IDs for tracking errors across logs and user feedback.
 * Used when Sentry or other error tracking is not available.
 */

/**
 * Generate a short, unique error ID
 * Format: err_XXXXXXXX (8 random hex characters)
 */
export function generateErrorId(): string {
  const randomHex = Math.random().toString(16).substring(2, 10);
  return `err_${randomHex}`;
}

/**
 * Create an error with an embedded error ID
 */
export function createTrackedError(message: string, errorId?: string): Error & { errorId: string } {
  const id = errorId || generateErrorId();
  const error = new Error(`${message} [${id}]`) as Error & { errorId: string };
  error.errorId = id;
  return error;
}
