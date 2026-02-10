/**
 * POST /api/v2/collateral/generate
 *
 * Generate collateral content from a template.
 * For Google Slides templates, returns placeholder values.
 * For text templates, returns generated content.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { generateCollateral } from '@/lib/v2/collateral';
import { canAccessCustomer } from '@/lib/v2/customers/customer-service';

export const maxDuration = 120;

const generateSchema = z.object({
  templateId: z.string().min(1),
  blockIds: z.array(z.string()).default([]),
  stagedSourceIds: z.array(z.string()).optional().default([]),
  customerId: z.string().optional(),
  modelSpeed: z.enum(['fast', 'quality']).default('quality'),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errors.unauthorized();
  }

  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || 'Invalid request');
    }

    const { templateId, blockIds, stagedSourceIds, customerId, modelSpeed } = parsed.data;

    // Verify customer access if customerId is provided
    if (customerId) {
      const hasAccess = await canAccessCustomer(session.user.id, customerId);
      if (!hasAccess) {
        return errors.forbidden('You do not have access to this customer');
      }
    }

    const result = await generateCollateral({
      templateId,
      blockIds,
      stagedSourceIds,
      customerId,
      userId: session.user.id,
      userEmail: session.user.email || undefined,
      modelSpeed,
    });

    if (result.errors?.length) {
      return errors.internal(result.errors.join(', '));
    }

    return apiSuccess({
      placeholders: result.placeholders,
      content: result.content,
      transparency: result.transparency,
    });
  } catch (error) {
    logger.error('Collateral generation error', error, { route: '/api/v2/collateral/generate' });
    const errorMessage = error instanceof Error ? error.message : 'Generation failed';
    return errors.internal(errorMessage);
  }
}
