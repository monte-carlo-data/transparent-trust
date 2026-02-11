/**
 * POST /api/v2/personas/create - Create a new persona
 *
 * Type-specific endpoint for persona creation, separated from generic block creation.
 * This keeps the persona creation flow distinct from skills, prompts, and templates.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { createPersona } from '@/lib/v2/personas/persona-service';
import { Prisma } from '@prisma/client';
import { canManageLibrary } from '@/lib/v2/teams';
import { logger } from '@/lib/logger';
import type { PersonaAttributes } from '@/types/v2/building-block';

const PERSONAS_LIBRARY = 'personas';

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
        route: 'POST /api/v2/personas/create',
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
      hasManageAccess = await canManageLibrary(session.user.id, PERSONAS_LIBRARY);
    } catch (authError) {
      logger.error('Failed to check library management access', authError, {
        route: 'POST /api/v2/personas/create',
        userId: session.user.id,
        libraryId: PERSONAS_LIBRARY,
      });
      return NextResponse.json(
        { error: 'Unable to verify your permissions. Please try again.' },
        { status: 500 }
      );
    }

    if (!hasManageAccess) {
      logger.warn('Persona library management access denied', {
        userId: session.user.id,
        libraryId: PERSONAS_LIBRARY,
        route: 'POST /api/v2/personas/create',
      });
      return NextResponse.json(
        { error: 'You do not have permission to create personas in this library' },
        { status: 403 }
      );
    }

    // Prepare persona attributes with defaults
    const bodyAttributes = typeof body.attributes === 'object' && body.attributes !== null ? (body.attributes as Record<string, unknown>) : {};

    // Validate tone if provided
    const validTones = ['professional', 'casual', 'technical', 'friendly', 'formal'];
    const tone = bodyAttributes.tone && validTones.includes(String(bodyAttributes.tone)) ? (bodyAttributes.tone as PersonaAttributes['tone']) : undefined;

    // Parse voice - accept either a string (for backwards compatibility) or structured object
    let voice: PersonaAttributes['voice'] = undefined;
    if (bodyAttributes.voice) {
      if (typeof bodyAttributes.voice === 'object') {
        voice = bodyAttributes.voice as PersonaAttributes['voice'];
      }
      // If it's a string, we skip it - voice should be a structured object
    }

    // Validate shareStatus if provided
    const validShareStatuses = ['PRIVATE', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
    const shareStatus = bodyAttributes.shareStatus && validShareStatuses.includes(String(bodyAttributes.shareStatus)) ? (bodyAttributes.shareStatus as PersonaAttributes['shareStatus']) : 'PRIVATE';

    const attributes: PersonaAttributes = {
      tone,
      audience: (bodyAttributes.audience as string) || undefined,
      voice,
      styleGuide: (bodyAttributes.styleGuide as string) || undefined,
      alwaysDo: (Array.isArray(bodyAttributes.alwaysDo) ? bodyAttributes.alwaysDo : []) as string[],
      neverDo: (Array.isArray(bodyAttributes.neverDo) ? bodyAttributes.neverDo : []) as string[],
      examples: (Array.isArray(bodyAttributes.examples) ? bodyAttributes.examples : []) as Array<{ input: string; output: string }>,
      isDefault: (bodyAttributes.isDefault as boolean) || false,
      shareStatus,
    };

    const persona = await createPersona({
      title: titleStr,
      content: contentStr,
      summary: body.summary ? String(body.summary).trim() : undefined,
      attributes,
      ownerId: session.user.id,
      teamId: body.teamId as string | undefined,
    });

    logger.info('Persona created', {
      userId: session.user.id,
      personaId: persona.id,
      route: 'POST /api/v2/personas/create',
    });

    return NextResponse.json(persona, { status: 201 });
  } catch (error) {
    logger.error('Error creating persona', error, {
      route: 'POST /api/v2/personas/create',
      userId: session?.user?.id,
      inputTitle: body?.title ? String(body.title).substring(0, 50) : undefined,
    });

    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'A persona with this slug already exists in this library' },
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
        { error: 'Invalid persona data provided. Please check your input.' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A persona with this slug already exists in this library' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create persona. Please try again or contact support if the problem persists.' },
      { status: 500 }
    );
  }
}
