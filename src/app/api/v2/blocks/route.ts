/**
 * GET /api/v2/blocks - List blocks with filters
 * POST /api/v2/blocks - DEPRECATED (use type-specific endpoints)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { queryBlocks } from '@/lib/v2/blocks';
import { canAccessLibrary } from '@/lib/v2/teams';
import { canAccessCustomer } from '@/lib/v2/customers/customer-service';
import { logger } from '@/lib/logger';
import type { BlockQueryOptions, LibraryId, BlockType, BlockStatus } from '@/types/v2';
import { LIBRARY_IDS, BLOCK_TYPES, BLOCK_STATUSES } from '@/types/v2';

/**
 * GET /api/v2/blocks
 * List blocks with optional filters
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse query params
    const libraryId = searchParams.get('libraryId') as LibraryId | null;
    const blockType = searchParams.get('blockType') as BlockType | null;
    const status = searchParams.get('status') as BlockStatus | null;
    const teamId = searchParams.get('teamId');
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');
    const categories = searchParams.get('categories')?.split(',').filter(Boolean);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const orderBy = (searchParams.get('orderBy') || 'updatedAt') as 'createdAt' | 'updatedAt' | 'title';
    const orderDir = (searchParams.get('orderDir') || 'desc') as 'asc' | 'desc';

    // Validate libraryId if provided
    if (libraryId && !LIBRARY_IDS.includes(libraryId)) {
      return NextResponse.json(
        { error: `Invalid libraryId. Must be one of: ${LIBRARY_IDS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate blockType if provided
    if (blockType && !BLOCK_TYPES.includes(blockType)) {
      return NextResponse.json(
        { error: `Invalid blockType. Must be one of: ${BLOCK_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && !BLOCK_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${BLOCK_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate customerId format if provided (should be a valid CUID)
    if (customerId) {
      // CUIDs are 25 characters, alphanumeric lowercase (basic validation)
      if (!/^[a-z0-9]{25}$/.test(customerId)) {
        return NextResponse.json(
          { error: 'Invalid customer ID format' },
          { status: 400 }
        );
      }
    }

    // If libraryId is specified, check access
    if (libraryId) {
      const hasAccess = await canAccessLibrary(session.user.id, libraryId);
      if (!hasAccess) {
        logger.warn('Library access denied', {
          userId: session.user.id,
          libraryId,
          route: 'GET /api/v2/blocks',
        });
        return NextResponse.json(
          { error: 'You do not have access to this library' },
          { status: 403 }
        );
      }
    } else if (!customerId) {
      // Require either libraryId or customerId to prevent unbounded queries
      return NextResponse.json(
        { error: 'libraryId or customerId is required' },
        { status: 400 }
      );
    }

    // Check customer access when customerId is provided
    if (customerId) {
      const hasCustomerAccess = await canAccessCustomer(session.user.id, customerId);
      if (!hasCustomerAccess) {
        logger.warn('Customer access denied', {
          userId: session.user.id,
          customerId,
          route: 'GET /api/v2/blocks',
        });
        return NextResponse.json(
          { error: 'You do not have access to this customer' },
          { status: 403 }
        );
      }
    }

    const options: BlockQueryOptions = {
      ...(libraryId && { libraryId }),
      ...(blockType && { blockType }),
      ...(status && { status }),
      ...(teamId && { teamId }),
      ...(customerId && { customerId }),
      ...(search && { search }),
      ...(categories?.length && { categories }),
      limit: Math.min(limit, 100),
      offset,
      orderBy,
      orderDir,
    };

    const result = await queryBlocks(options);

    return NextResponse.json({
      blocks: result.blocks,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error listing blocks', error, {
      route: 'GET /api/v2/blocks',
    });
    return NextResponse.json(
      { error: 'Failed to list blocks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/blocks
 *
 * DEPRECATED: This generic endpoint has been replaced with type-specific endpoints:
 * - POST /api/v2/skills/create - For skills (knowledge, IT, GTM, customer-scoped)
 * - POST /api/v2/personas/create - For personas
 * - POST /api/v2/templates/create - For templates
 *
 * Prompts are managed through /v2/admin/prompts (specialized UI with tiers/versions).
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'This endpoint has been deprecated. Use type-specific endpoints instead.',
      alternatives: {
        skills: 'POST /api/v2/skills/create',
        personas: 'POST /api/v2/personas/create',
        templates: 'POST /api/v2/templates/create',
        prompts: 'Use /v2/admin/prompts UI',
      },
    },
    { status: 410 }
  );
}
