/**
 * Admin Prompts API - Version History
 *
 * GET  /api/admin/prompts/[slug]/versions - Get version history
 * POST /api/admin/prompts/[slug]/versions - Rollback to a specific version
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import {
  getPromptBySlug,
  getVersionHistory,
  rollbackToVersion,
} from '@/lib/prompts/prompt-service';

type RouteParams = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/admin/prompts/[slug]/versions
 * Get version history for a prompt
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { slug } = await params;
    const prompt = await getPromptBySlug(slug);

    if (!prompt) {
      return errors.notFound(`Prompt not found: ${slug}`);
    }

    const history = await getVersionHistory(slug);

    return apiSuccess({
      slug,
      name: prompt.name,
      currentVersion: prompt.version || 1,
      hasOverride: prompt.hasOverride,
      versions: history,
    });
  } catch (error) {
    const { slug } = await params;
    logger.error('Failed to fetch version history', error, {
      route: '/api/admin/prompts/[slug]/versions',
      slug,
    });
    return errors.internal('Failed to fetch version history');
  }
}

/**
 * POST /api/admin/prompts/[slug]/versions
 * Rollback to a specific version
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { slug } = await params;
    const body = await request.json();
    const { targetVersion } = body as { targetVersion: number };

    if (!targetVersion || typeof targetVersion !== 'number') {
      return errors.badRequest('targetVersion is required and must be a number');
    }

    const prompt = await getPromptBySlug(slug);
    if (!prompt) {
      return errors.notFound(`Prompt not found: ${slug}`);
    }

    const userId = auth.session?.user?.id || auth.session?.user?.email || 'unknown';

    const updated = await rollbackToVersion(slug, targetVersion, userId);

    return apiSuccess({
      message: `Rolled back to version ${targetVersion}`,
      prompt: updated,
    });
  } catch (error) {
    const { slug } = await params;
    logger.error('Failed to rollback prompt', error, {
      route: '/api/admin/prompts/[slug]/versions',
      slug,
    });

    if (error instanceof Error && error.message.includes('not found')) {
      return errors.notFound(error.message);
    }

    return errors.internal('Failed to rollback prompt');
  }
}
