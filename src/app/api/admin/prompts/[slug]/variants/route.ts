/**
 * Admin Prompts API - Variant Operations
 *
 * PUT /api/admin/prompts/[slug]/variants - Update a specific variant
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { getPromptBySlug, updatePromptVariant } from '@/lib/prompts/prompt-service';

type RouteParams = {
  params: Promise<{ slug: string }>;
};

/**
 * PUT /api/admin/prompts/[slug]/variants
 * Update a specific context variant of a prompt
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { slug } = await params;
    const body = await request.json();
    const { context, content, commitMessage } = body as {
      context: string;
      content: string;
      commitMessage: string;
    };

    if (!context || !content) {
      return errors.badRequest('context and content are required');
    }

    if (!commitMessage) {
      return errors.badRequest('commitMessage is required');
    }

    const prompt = await getPromptBySlug(slug);
    if (!prompt) {
      return errors.notFound(`Prompt not found: ${slug}`);
    }

    // Check if this prompt supports variants
    if (prompt.source !== 'legacy' && !prompt.variants) {
      return errors.badRequest(
        'This prompt does not support variants. Only legacy system prompts have context variants.'
      );
    }

    const userId = auth.session?.user?.id || auth.session?.user?.email || 'unknown';

    const updated = await updatePromptVariant(slug, context, content, commitMessage, userId);

    return apiSuccess({
      message: `Updated variant: ${context}`,
      prompt: updated,
    });
  } catch (error) {
    const { slug } = await params;
    logger.error('Failed to update prompt variant', error, {
      route: '/api/admin/prompts/[slug]/variants',
      slug,
    });

    if (error instanceof Error && error.message.includes('not found')) {
      return errors.notFound(error.message);
    }

    return errors.internal('Failed to update prompt variant');
  }
}
