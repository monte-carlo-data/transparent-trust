/**
 * GET /api/v2/collateral/slides-placeholders
 *
 * Extract placeholders from a Google Slides template.
 * Used to auto-detect placeholders for template configuration.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { getGoogleSlidesPlaceholders } from '@/lib/v2/collateral';
import { hasGoogleSlidesAccess } from '@/lib/googleSlides';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errors.unauthorized();
  }

  try {
    // Check if user has Google Slides access
    const hasAccess = await hasGoogleSlidesAccess(session.user.id);
    if (!hasAccess) {
      return errors.forbidden('Google Slides access not configured. Please reconnect your Google account with Slides permissions.');
    }

    const { searchParams } = new URL(request.url);
    const presentationId = searchParams.get('presentationId');

    if (!presentationId) {
      return errors.badRequest('presentationId is required');
    }

    const placeholders = await getGoogleSlidesPlaceholders(session.user.id, presentationId);

    return apiSuccess({
      placeholders,
    });
  } catch (error) {
    logger.error('Get slides placeholders error', error, { route: '/api/v2/collateral/slides-placeholders' });
    const errorMessage = error instanceof Error ? error.message : 'Failed to get placeholders';
    return errors.internal(errorMessage);
  }
}
