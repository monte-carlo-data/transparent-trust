/**
 * API: Get skill sources by titles
 *
 * Returns the underlying sources (URL, Zendesk, etc.) for skills.
 * Used for transparency display in Q&A responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSkillSourcesByTitles } from '@/lib/v2/blocks/block-service';
import type { LibraryId } from '@/types/v2';

const requestSchema = z.object({
  titles: z.array(z.string()).min(1).max(50),
  library: z.string().default('knowledge'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { titles, library } = requestSchema.parse(body);

    // Map library to libraryId
    const libraryMap: Record<string, LibraryId> = {
      skills: 'knowledge',
      knowledge: 'knowledge',
      it: 'it',
      gtm: 'gtm',
    };
    const libraryId = libraryMap[library.toLowerCase()] || 'knowledge';

    const sources = await getSkillSourcesByTitles(titles, [libraryId]);

    return NextResponse.json({
      success: true,
      data: { sources },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Invalid request', errors: error.issues },
        { status: 400 }
      );
    }

    console.error('Error fetching skill sources:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch skill sources' },
      { status: 500 }
    );
  }
}
