/**
 * Admin Prompts API - Single Prompt Operations
 *
 * GET    /api/admin/prompts/[slug] - Get a single prompt
 * PUT    /api/admin/prompts/[slug] - Update a prompt
 * DELETE /api/admin/prompts/[slug] - Delete a prompt (custom only) or reset (built-in)
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import {
  getPromptBySlug,
  updatePrompt,
  resetToDefault,
  deletePrompt,
  type UpdatePromptInput,
} from '@/lib/prompts/prompt-service';

type RouteParams = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/admin/prompts/[slug]
 * Get a single prompt by slug
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

    return apiSuccess(prompt);
  } catch (error) {
    const { slug } = await params;
    logger.error('Failed to fetch prompt', error, {
      route: '/api/admin/prompts/[slug]',
      slug,
    });
    return errors.internal('Failed to fetch prompt');
  }
}

/**
 * PUT /api/admin/prompts/[slug]
 * Update a prompt (creates override if updating built-in)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { slug } = await params;
    const body = await request.json();
    const { content, name, description, variants, categories, commitMessage } =
      body as Partial<UpdatePromptInput>;

    if (!commitMessage) {
      return errors.badRequest('commitMessage is required');
    }

    const userId = auth.session?.user?.id || auth.session?.user?.email || 'unknown';

    const prompt = await updatePrompt(slug, {
      content,
      name,
      description,
      variants,
      categories,
      commitMessage,
      userId,
    });

    return apiSuccess(prompt);
  } catch (error) {
    const { slug } = await params;
    logger.error('Failed to update prompt', error, {
      route: '/api/admin/prompts/[slug]',
      slug,
    });

    if (error instanceof Error && error.message.includes('not found')) {
      return errors.notFound(error.message);
    }

    return errors.internal('Failed to update prompt');
  }
}

/**
 * DELETE /api/admin/prompts/[slug]
 * Delete a custom prompt or reset a built-in prompt to default
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Check query param for action
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'delete';

    if (action === 'reset') {
      // Reset built-in prompt to default
      const success = await resetToDefault(slug);
      if (!success) {
        return errors.badRequest('Nothing to reset - prompt has no override');
      }
      return apiSuccess({ message: 'Prompt reset to default', slug });
    } else {
      // Delete custom prompt
      if (prompt.source !== 'custom') {
        return errors.badRequest(
          'Cannot delete built-in prompts. Use ?action=reset to reset to default.'
        );
      }

      const success = await deletePrompt(prompt.id);
      if (!success) {
        return errors.notFound('Prompt not found or already deleted');
      }
      return apiSuccess({ message: 'Prompt deleted', slug });
    }
  } catch (error) {
    const { slug } = await params;
    logger.error('Failed to delete/reset prompt', error, {
      route: '/api/admin/prompts/[slug]',
      slug,
    });

    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }

    return errors.internal('Failed to delete/reset prompt');
  }
}
