/**
 * POST /api/v2/collateral/export-slides
 *
 * Export generated content to Google Slides.
 * Creates a copy of the template and fills placeholders.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { exportToGoogleSlides } from '@/lib/v2/collateral';
import { hasGoogleSlidesAccess } from '@/lib/googleSlides';

export const maxDuration = 60;

const exportSchema = z.object({
  templatePresentationId: z.string().min(1),
  placeholders: z.record(z.string(), z.string()),
  copyTitle: z.string().optional(),
});

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parsed = exportSchema.safeParse(body);

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || 'Invalid request');
    }

    const { templatePresentationId, placeholders, copyTitle } = parsed.data;

    const result = await exportToGoogleSlides({
      userId: session.user.id,
      templatePresentationId,
      placeholders,
      copyTitle,
    });

    if (result.errors?.length) {
      return errors.internal(result.errors.join(', '));
    }

    return apiSuccess({
      presentationId: result.presentationId,
      webViewLink: result.webViewLink,
    });
  } catch (error) {
    logger.error('Google Slides export error', error, { route: '/api/v2/collateral/export-slides' });
    const errorMessage = error instanceof Error ? error.message : 'Export failed';
    return errors.internal(errorMessage);
  }
}
