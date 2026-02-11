/**
 * Authentication & Authorization Middleware for V2 Integration APIs
 *
 * Provides consistent auth checks across all integration endpoints.
 * All integration endpoints require session authentication and library access.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { canManageLibrary } from '@/lib/v2/teams/team-service';
import { canAccessCustomer } from '@/lib/v2/customers/customer-service';
import type { LibraryId } from '@/types/v2';
import type { AuthContext, MiddlewareResult, IntegrationError } from '../types';

/**
 * Create a standardized error response
 */
function errorResponse(
  error: IntegrationError,
  status: number
): NextResponse<IntegrationError> {
  return NextResponse.json(error, { status });
}

/**
 * Require authenticated session.
 * Returns user ID if authenticated, or an error response.
 */
export async function requireAuth(): Promise<MiddlewareResult<{ userId: string }>> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      success: false,
      response: errorResponse(
        {
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
          hint: 'Please sign in to access this endpoint.',
        },
        401
      ),
    };
  }

  return {
    success: true,
    data: { userId: session.user.id },
  };
}

/**
 * Require authenticated session with library access.
 * Returns auth context if authorized, or an error response.
 */
export async function requireLibraryAccess(
  libraryId: LibraryId,
  customerId?: string
): Promise<MiddlewareResult<AuthContext>> {
  // First check authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult;
  }

  const { userId } = authResult.data;

  // Check library access
  const hasLibraryAccess = await canManageLibrary(userId, libraryId);
  if (!hasLibraryAccess) {
    return {
      success: false,
      response: errorResponse(
        {
          error: 'Forbidden',
          message: 'You do not have access to this library',
          code: 'LIBRARY_ACCESS_DENIED',
          hint: `You need to be a member of a team that manages the "${libraryId}" library.`,
        },
        403
      ),
    };
  }

  // If customerId is provided, check customer access
  if (customerId) {
    const hasCustomerAccess = await canAccessCustomer(userId, customerId);
    if (!hasCustomerAccess) {
      return {
        success: false,
        response: errorResponse(
          {
            error: 'Forbidden',
            message: 'You do not have access to this customer',
            code: 'CUSTOMER_ACCESS_DENIED',
            hint: 'You need appropriate permissions to access customer-scoped resources.',
          },
          403
        ),
      };
    }
  }

  return {
    success: true,
    data: {
      userId,
      libraryId,
      customerId,
    },
  };
}

/**
 * Type guard to check if a middleware result is successful
 */
export function isAuthSuccess<T>(
  result: MiddlewareResult<T>
): result is { success: true; data: T } {
  return result.success;
}
