/**
 * Template Fill Endpoint
 *
 * POST /api/v2/templates/fill
 * Fills template placeholders with context values
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

interface PlaceholderContext {
  customer?: {
    id: string;
    name: string;
    industry?: string;
    tier?: string;
    content?: string;
  };
  skills?: Array<{
    id: string;
    title: string;
    content: string;
  }>;
}

interface FillRequest {
  templateId: string;
  context: PlaceholderContext;
}

interface FillResponse {
  filledContent: string;
  placeholdersUsed: string[];
  placeholdersMissing: string[];
}

/**
 * Common placeholder patterns that templates might use:
 * {{customer.name}}, {{customer.industry}}, {{customer.tier}}
 * {{skills[0].title}}, {{skills[0].content}}
 * {{skill.title}}, {{skill.content}} (singular form iterates)
 */
function extractPlaceholders(content: string): string[] {
  const placeholderRegex = /\{\{[\w\.[\]\-]+\}\}/g;
  const matches = content.match(placeholderRegex) || [];
  return Array.from(new Set(matches)).map((p) => p.slice(2, -2)); // Remove {{ }}
}

function resolvePlaceholder(placeholder: string, context: PlaceholderContext): string | null {
  // Handle customer properties
  if (placeholder.startsWith('customer.')) {
    const prop = placeholder.slice('customer.'.length);
    const value = (context.customer as Record<string, unknown> | undefined)?.[prop];
    return value ? String(value) : null;
  }

  // Handle skill array access: skills[0].title
  const skillArrayMatch = placeholder.match(/^skills\[(\d+)\]\.(\w+)$/);
  if (skillArrayMatch) {
    const index = parseInt(skillArrayMatch[1], 10);
    const prop = skillArrayMatch[2];
    if (context.skills && context.skills[index]) {
      const value = (context.skills[index] as Record<string, unknown>)[prop];
      return value ? String(value) : null;
    }
    return null;
  }

  // Handle singular skill reference (use first skill): skill.title
  if (placeholder.startsWith('skill.')) {
    const prop = placeholder.slice('skill.'.length);
    if (context.skills && context.skills.length > 0) {
      const value = (context.skills[0] as Record<string, unknown>)[prop];
      return value ? String(value) : null;
    }
    return null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as FillRequest;
    const { templateId, context } = body;

    if (!templateId || !context) {
      return NextResponse.json(
        { error: 'templateId and context are required' },
        { status: 400 }
      );
    }

    // Fetch template
    const template = await prisma.buildingBlock.findUnique({
      where: { id: templateId },
    });

    if (!template || template.libraryId !== 'templates') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Extract placeholders from template
    const allPlaceholders = extractPlaceholders(template.content);

    // Try to fill each placeholder
    let filledContent = template.content;
    const placeholdersUsed: string[] = [];
    const placeholdersMissing: string[] = [];

    for (const placeholder of allPlaceholders) {
      const value = resolvePlaceholder(placeholder, context);

      if (value !== null) {
        filledContent = filledContent.replaceAll(
          `{{${placeholder}}}`,
          value
        );
        placeholdersUsed.push(placeholder);
      } else {
        placeholdersMissing.push(placeholder);
      }
    }

    const response: FillResponse = {
      filledContent,
      placeholdersUsed,
      placeholdersMissing,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('Error filling template:', error);
    return NextResponse.json(
      { error: 'Failed to fill template' },
      { status: 500 }
    );
  }
}
