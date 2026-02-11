/**
 * POST /api/v2/skills/create - Create a new skill (knowledge, IT, GTM, or customer-scoped)
 *
 * Type-specific endpoint for skill creation, separated from generic block creation.
 * This keeps the skill creation flow distinct from prompts, personas, and templates.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { createBlock } from '@/lib/v2/blocks';
import { Prisma } from '@prisma/client';
import { canManageLibrary } from '@/lib/v2/teams';
import { canManageCustomer } from '@/lib/v2/customers/customer-service';
import { SKILL_LIBRARIES } from '@/lib/v2/library-constants';
import { logger } from '@/lib/logger';
import type { CreateBlockInput, LibraryId, SkillType } from '@/types/v2';

// Input validation constants
const MAX_TITLE_LENGTH = 500;
const MAX_CONTENT_LENGTH = 100000;
const ALLOWED_ENTRY_TYPES = ['skill'] as const;

export async function POST(request: Request) {
  let session;
  let body: Record<string, unknown> = {};
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      body = await request.json();
    } catch (parseError) {
      logger.warn('Invalid JSON in request body', parseError, {
        route: 'POST /api/v2/skills/create',
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: 'Invalid request body. Please ensure you are sending valid JSON.' },
        { status: 400 }
      );
    }

    // Check if this is a foundational skill (allows empty content)
    const isFoundational = body.attributes &&
      typeof body.attributes === 'object' &&
      'isFoundational' in body.attributes &&
      body.attributes.isFoundational === true;

    // Validate required fields (content optional for foundational skills)
    if (!body.libraryId || !body.title || (!body.content && !isFoundational)) {
      return NextResponse.json(
        { error: 'Missing required fields: libraryId, title, content' },
        { status: 400 }
      );
    }

    // Validate libraryId is a skill library
    if (!SKILL_LIBRARIES.includes(body.libraryId as LibraryId)) {
      return NextResponse.json(
        { error: `Invalid libraryId. Must be one of: ${SKILL_LIBRARIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate title and content length
    const titleStr = String(body.title).trim();
    const contentStr = String(body.content).trim();

    if (titleStr.length === 0) {
      return NextResponse.json(
        { error: 'Title cannot be empty' },
        { status: 400 }
      );
    }

    if (titleStr.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title exceeds maximum length (${MAX_TITLE_LENGTH} characters)` },
        { status: 400 }
      );
    }

    // Allow empty content for foundational skills (they start empty)
    if (contentStr.length === 0 && !isFoundational) {
      return NextResponse.json(
        { error: 'Content cannot be empty' },
        { status: 400 }
      );
    }

    if (contentStr.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Content exceeds maximum length (${MAX_CONTENT_LENGTH} characters)` },
        { status: 400 }
      );
    }

    // Validate entryType if provided
    if (body.entryType && !ALLOWED_ENTRY_TYPES.includes(body.entryType as typeof ALLOWED_ENTRY_TYPES[number])) {
      return NextResponse.json(
        { error: `Invalid entryType. Must be one of: ${ALLOWED_ENTRY_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Check library management access (includes implicit access check)
    let hasManageAccess: boolean;
    try {
      hasManageAccess = await canManageLibrary(session.user.id, body.libraryId as LibraryId);
    } catch (authError) {
      logger.error('Failed to check library management access (transient)', authError, {
        route: 'POST /api/v2/skills/create',
        userId: session.user.id,
        libraryId: body.libraryId,
        errorType: 'TRANSIENT_AUTH_ERROR',
      });
      return NextResponse.json(
        { error: 'Unable to verify your permissions. Please try again.', errorType: 'TRANSIENT_AUTH_ERROR' },
        { status: 500 }
      );
    }

    if (!hasManageAccess) {
      logger.warn('Skill library management access denied (permanent)', {
        userId: session.user.id,
        libraryId: body.libraryId,
        route: 'POST /api/v2/skills/create',
        errorType: 'AUTH_DENIED',
      });
      return NextResponse.json(
        { error: 'You do not have permission to create skills in this library', errorType: 'AUTH_DENIED' },
        { status: 403 }
      );
    }

    // For customer-scoped skills, check customer access
    if (body.customerId) {
      let hasCustomerManageAccess: boolean;
      try {
        hasCustomerManageAccess = await canManageCustomer(session.user.id, body.customerId as string);
      } catch (authError) {
        logger.error('Failed to check customer management access (transient)', authError, {
          route: 'POST /api/v2/skills/create',
          userId: session.user.id,
          customerId: body.customerId,
          errorType: 'TRANSIENT_CUSTOMER_AUTH_ERROR',
        });
        return NextResponse.json(
          { error: 'Unable to verify your customer access. Please try again.', errorType: 'TRANSIENT_CUSTOMER_AUTH_ERROR' },
          { status: 500 }
        );
      }

      if (!hasCustomerManageAccess) {
        logger.warn('Customer management access denied (permanent)', {
          userId: session.user.id,
          customerId: body.customerId,
          route: 'POST /api/v2/skills/create',
          errorType: 'CUSTOMER_ACCESS_DENIED',
        });
        return NextResponse.json(
          { error: 'You do not have permission to manage this customer', errorType: 'CUSTOMER_ACCESS_DENIED' },
          { status: 403 }
        );
      }
    }

    // Derive skill type: foundational → intelligence, others → knowledge (or use explicit skillType)
    const skillType: SkillType = (body.skillType as SkillType) || (isFoundational ? 'intelligence' : 'knowledge');

    const input = {
      libraryId: body.libraryId as LibraryId,
      title: titleStr,
      content: contentStr,
      slug: body.slug as string | undefined,
      summary: (body.summary ? String(body.summary).trim() : undefined) || undefined,
      categories: (Array.isArray(body.categories) ? body.categories : []) as string[],
      skillType,
      attributes: (typeof body.attributes === 'object' && body.attributes !== null ? body.attributes : {}) as Record<string, unknown>,
      entryType: 'skill',
      teamId: body.teamId as string | undefined,
      ownerId: session.user.id,
      status: (body.status as 'ACTIVE' | 'ARCHIVED' | undefined) || 'ACTIVE',
      customerId: body.customerId as string | undefined,
    } as CreateBlockInput;

    const skill = await createBlock(input);

    logger.info('Skill created', {
      userId: session.user.id,
      skillId: skill.id,
      libraryId: body.libraryId,
      customerId: body.customerId,
      route: 'POST /api/v2/skills/create',
    });

    return NextResponse.json(skill, { status: 201 });
  } catch (error) {
    logger.error('Error creating skill', error, {
      route: 'POST /api/v2/skills/create',
      userId: session?.user?.id,
      inputTitle: body?.title ? String(body.title).substring(0, 50) : undefined,
      inputLibraryId: body?.libraryId,
    });

    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'A skill with this slug already exists in this library' },
          { status: 409 }
        );
      }
      if (error.code === 'P2003') {
        // Foreign key constraint
        return NextResponse.json(
          { error: 'Invalid team or owner reference. Please check your account settings.' },
          { status: 400 }
        );
      }
      if (error.code === 'P2025') {
        // Record not found
        return NextResponse.json(
          { error: 'Referenced record not found. Please refresh and try again.' },
          { status: 404 }
        );
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: 'Invalid skill data provided. Please check your input.' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A skill with this slug already exists in this library' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create skill. Please try again or contact support if the problem persists.' },
      { status: 500 }
    );
  }
}
