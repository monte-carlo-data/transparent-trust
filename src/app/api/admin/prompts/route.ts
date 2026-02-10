/**
 * Admin Prompts API
 *
 * GET  /api/admin/prompts - List all prompts
 * POST /api/admin/prompts - Create a new prompt
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import {
  getAllPrompts,
  createPrompt,
  type CreatePromptInput,
} from '@/lib/prompts/prompt-service';

/**
 * GET /api/admin/prompts
 * List all prompts from all sources (v2-core, legacy, chat-library, library-context, custom)
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const prompts = await getAllPrompts();

    return apiSuccess({
      prompts,
      meta: {
        total: prompts.length,
        bySource: {
          'v2-core': prompts.filter((p) => p.source === 'v2-core').length,
          legacy: prompts.filter((p) => p.source === 'legacy').length,
          'chat-library': prompts.filter((p) => p.source === 'chat-library').length,
          'library-context': prompts.filter((p) => p.source === 'library-context').length,
          custom: prompts.filter((p) => p.source === 'custom').length,
        },
        byType: {
          'system-block': prompts.filter((p) => p.type === 'system-block').length,
          'chat-prompt': prompts.filter((p) => p.type === 'chat-prompt').length,
          'library-context': prompts.filter((p) => p.type === 'library-context').length,
          preset: prompts.filter((p) => p.type === 'preset').length,
        },
        withOverrides: prompts.filter((p) => p.hasOverride).length,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch prompts', error, {
      route: '/api/admin/prompts',
    });
    return errors.internal('Failed to fetch prompts');
  }
}

/**
 * POST /api/admin/prompts
 * Create a new custom prompt
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { slug, name, description, content, tier, type, variants, categories, commitMessage } =
      body as CreatePromptInput & { commitMessage?: string };

    // Validate required fields
    if (!slug || !name || !content) {
      return errors.badRequest('slug, name, and content are required');
    }

    if (!commitMessage) {
      return errors.badRequest('commitMessage is required');
    }

    const userId = auth.session?.user?.id || auth.session?.user?.email || 'unknown';

    const prompt = await createPrompt({
      slug,
      name,
      description,
      content,
      tier,
      type,
      variants,
      categories,
      commitMessage,
      userId,
    });

    return apiSuccess(prompt, 201);
  } catch (error) {
    logger.error('Failed to create prompt', error, {
      route: '/api/admin/prompts',
    });

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return errors.conflict('A prompt with this slug already exists');
    }

    return errors.internal('Failed to create prompt');
  }
}
