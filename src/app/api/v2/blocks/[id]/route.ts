/**
 * GET /api/v2/blocks/[id] - Get a block by ID
 * PATCH /api/v2/blocks/[id] - Update a block
 * DELETE /api/v2/blocks/[id] - Delete a block
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import {
  getBlockById,
  updateBlock,
  deleteBlock,
  activateBlock,
  archiveBlock,
} from '@/lib/v2/blocks';
import { canManageLibrary, canAccessLibrary } from '@/lib/v2/teams';
import { canAccessCustomer, canManageCustomer } from '@/lib/v2/customers/customer-service';
import { logger } from '@/lib/logger';
import type { UpdateBlockInput, LibraryId, BlockStatus } from '@/types/v2';
import { BLOCK_STATUSES } from '@/types/v2';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v2/blocks/[id]
 * Get a block by ID
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const block = await getBlockById(id);
    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Check library access (read-only, so use canAccessLibrary)
    const hasAccess = await canAccessLibrary(session.user.id, block.libraryId as LibraryId);
    if (!hasAccess) {
      logger.warn('Library access denied', {
        userId: session.user.id,
        blockId: id,
        libraryId: block.libraryId,
        route: 'GET /api/v2/blocks/[id]',
      });
      return NextResponse.json(
        { error: 'You do not have access to this block' },
        { status: 403 }
      );
    }

    // For customer-scoped skills, also check customer access
    if (block.customerId) {
      const hasCustomerAccess = await canAccessCustomer(session.user.id, block.customerId);
      if (!hasCustomerAccess) {
        logger.warn('Customer access denied', {
          userId: session.user.id,
          blockId: id,
          customerId: block.customerId,
          route: 'GET /api/v2/blocks/[id]',
        });
        return NextResponse.json(
          { error: 'You do not have access to this customer' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(block);
  } catch (error) {
    logger.error('Error getting block', error, {
      blockId: id,
      route: 'GET /api/v2/blocks/[id]',
    });
    return NextResponse.json(
      { error: 'Failed to get block' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v2/blocks/[id]
 * Update a block
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get existing block
    const existing = await getBlockById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, existing.libraryId as LibraryId);
    if (!hasAccess) {
      logger.warn('Library management access denied', {
        userId: session.user.id,
        blockId: id,
        libraryId: existing.libraryId,
        route: 'PATCH /api/v2/blocks/[id]',
      });
      return NextResponse.json(
        { error: 'You do not have access to this block' },
        { status: 403 }
      );
    }

    // For customer-scoped skills, also check customer access
    if (existing.customerId) {
      const hasCustomerAccess = await canManageCustomer(session.user.id, existing.customerId);
      if (!hasCustomerAccess) {
        logger.warn('Customer management access denied', {
          userId: session.user.id,
          blockId: id,
          customerId: existing.customerId,
          route: 'PATCH /api/v2/blocks/[id]',
        });
        return NextResponse.json(
          { error: 'You do not have permission to manage this customer' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    // Handle status-specific actions
    if (body.status && body.status !== existing.status) {
      if (!BLOCK_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${BLOCK_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }

      // Use specific methods for status changes
      if (body.status === 'ACTIVE') {
        const block = await activateBlock(id);
        return NextResponse.json(block);
      }
      if (body.status === 'ARCHIVED') {
        const block = await archiveBlock(id);
        return NextResponse.json(block);
      }
    }

    const input: UpdateBlockInput = {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.slug !== undefined && { slug: body.slug }),
      ...(body.summary !== undefined && { summary: body.summary }),
      ...(body.categories !== undefined && { categories: body.categories }),
      ...(body.attributes !== undefined && { attributes: body.attributes }),
      ...(body.entryType !== undefined && { entryType: body.entryType }),
      ...(body.status !== undefined && { status: body.status as BlockStatus }),
    };

    const block = await updateBlock(id, input);

    return NextResponse.json(block);
  } catch (error) {
    logger.error('Error updating block', error, {
      blockId: id,
      route: 'PATCH /api/v2/blocks/[id]',
    });

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A block with this slug already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update block' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v2/blocks/[id]
 * Soft delete a block (sets status to ARCHIVED)
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get existing block
    const existing = await getBlockById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, existing.libraryId as LibraryId);
    if (!hasAccess) {
      logger.warn('Library management access denied', {
        userId: session.user.id,
        blockId: id,
        libraryId: existing.libraryId,
        route: 'DELETE /api/v2/blocks/[id]',
      });
      return NextResponse.json(
        { error: 'You do not have access to this block' },
        { status: 403 }
      );
    }

    // For customer-scoped skills, also check customer access
    if (existing.customerId) {
      const hasCustomerAccess = await canManageCustomer(session.user.id, existing.customerId);
      if (!hasCustomerAccess) {
        logger.warn('Customer management access denied', {
          userId: session.user.id,
          blockId: id,
          customerId: existing.customerId,
          route: 'DELETE /api/v2/blocks/[id]',
        });
        return NextResponse.json(
          { error: 'You do not have permission to manage this customer' },
          { status: 403 }
        );
      }
    }

    await deleteBlock(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting block', error, {
      blockId: id,
      route: 'DELETE /api/v2/blocks/[id]',
    });
    return NextResponse.json(
      { error: 'Failed to delete block' },
      { status: 500 }
    );
  }
}
