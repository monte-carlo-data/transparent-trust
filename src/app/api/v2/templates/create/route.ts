/**
 * POST /api/v2/templates/create - Create a new template
 *
 * Type-specific endpoint for template creation, separated from generic block creation.
 * This keeps the template creation flow distinct from skills, prompts, and personas.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { createBlock } from '@/lib/v2/blocks';
import { Prisma } from '@prisma/client';
import { canManageLibrary } from '@/lib/v2/teams';
import { logger } from '@/lib/logger';
import type { CreateBlockInput } from '@/types/v2';

const TEMPLATES_LIBRARY = 'templates';

// Input validation constants
const MAX_TITLE_LENGTH = 500;
const MAX_CONTENT_LENGTH = 100000;

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
        route: 'POST /api/v2/templates/create',
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: 'Invalid request body. Please ensure you are sending valid JSON.' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.title || !body.content) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content' },
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

    if (contentStr.length === 0) {
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

    // Check library management access (includes implicit access check)
    let hasManageAccess: boolean;
    try {
      hasManageAccess = await canManageLibrary(session.user.id, TEMPLATES_LIBRARY);
    } catch (authError) {
      logger.error('Failed to check library management access', authError, {
        route: 'POST /api/v2/templates/create',
        userId: session.user.id,
        libraryId: TEMPLATES_LIBRARY,
      });
      return NextResponse.json(
        { error: 'Unable to verify your permissions. Please try again.' },
        { status: 500 }
      );
    }

    if (!hasManageAccess) {
      logger.warn('Template library management access denied', {
        userId: session.user.id,
        libraryId: TEMPLATES_LIBRARY,
        route: 'POST /api/v2/templates/create',
      });
      return NextResponse.json(
        { error: 'You do not have permission to create templates in this library' },
        { status: 403 }
      );
    }

    const input: CreateBlockInput = {
      libraryId: TEMPLATES_LIBRARY,
      title: titleStr,
      content: contentStr,
      slug: body.slug as string | undefined,
      summary: (body.summary ? String(body.summary).trim() : undefined) || undefined,
      categories: (Array.isArray(body.categories) ? body.categories : []) as string[],
      attributes: (typeof body.attributes === 'object' && body.attributes !== null ? body.attributes : {}) as Record<string, unknown>,
      entryType: 'template',
      teamId: body.teamId as string | undefined,
      ownerId: session.user.id,
      status: (body.status as 'ACTIVE' | 'ARCHIVED' | undefined) || 'ACTIVE',
    };

    const template = await createBlock(input);

    logger.info('Template created', {
      userId: session.user.id,
      templateId: template.id,
      route: 'POST /api/v2/templates/create',
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    logger.error('Error creating template', error, {
      route: 'POST /api/v2/templates/create',
      userId: session?.user?.id,
      inputTitle: body?.title ? String(body.title).substring(0, 50) : undefined,
    });

    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'A template with this slug already exists in this library' },
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
        { error: 'Invalid template data provided. Please check your input.' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A template with this slug already exists in this library' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create template. Please try again or contact support if the problem persists.' },
      { status: 500 }
    );
  }
}
