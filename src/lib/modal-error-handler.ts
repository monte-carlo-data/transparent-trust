/**
 * Shared error handling utility for modal forms
 *
 * Provides consistent error handling across all creation modals:
 * - Network errors
 * - HTTP status code errors
 * - Response validation
 */

interface HandleModalResponseOptions {
  response: Response;
  successMessage?: string;
  errorMessage: string;
}

/**
 * Handles modal API response with consistent error messaging
 *
 * @throws Error with user-friendly message if response is not ok
 * @returns Parsed JSON result
 */
export async function handleModalResponse<T extends { id: string }>({
  response,
  errorMessage,
}: HandleModalResponseOptions): Promise<T> {
  if (!response.ok) {
    let message = errorMessage;

    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // Response body wasn't valid JSON, use status-based message
      if (response.status === 401) {
        message = 'Your session has expired. Please refresh the page and log in again.';
      } else if (response.status === 403) {
        message = 'You do not have permission to perform this action.';
      } else if (response.status >= 500) {
        message = 'Server error. Please try again later or contact support.';
      }
    }

    throw new Error(message);
  }

  const result = await response.json();
  if (!result || typeof result.id !== 'string') {
    throw new Error(`${errorMessage.split(' ')[2]} created but response was invalid. Please refresh the page.`);
  }

  return result;
}

/**
 * Handles network-level errors (offline, DNS, timeout)
 */
export function getNetworkErrorMessage(): string {
  return 'Network error. Please check your connection and try again.';
}
