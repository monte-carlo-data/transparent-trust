import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const querySchema = z.object({
  libraryId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      libraryId: searchParams.get("libraryId"),
    });

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid query");
    }

    let { libraryId } = parsed.data;

    // Map frontend library names to database LibraryIds
    const LIBRARY_NAME_MAP: Record<string, string> = {
      'skills': 'knowledge',
      'knowledge': 'knowledge',
      'it': 'it',
      'it-skills': 'it',
      'gtm': 'gtm',
      'talent': 'talent',
      'customers': 'customers',
    };

    if (libraryId) {
      libraryId = LIBRARY_NAME_MAP[libraryId.toLowerCase()] || libraryId;
    }

    // Query blocks to extract unique categories (include ALL statuses)
    const where: Record<string, unknown> = {
      // Don't filter by status - include ACTIVE, ARCHIVED
    };

    if (libraryId) {
      where.libraryId = libraryId;
    }

    const blocks = await prisma.buildingBlock.findMany({
      where,
      select: { categories: true },
      take: 500,
    });

    // Extract unique categories from blocks
    const categorySet = new Set<string>();
    blocks.forEach((block) => {
      if (Array.isArray(block.categories)) {
        block.categories.forEach((cat: string) => categorySet.add(cat));
      }
    });

    // Only return categories that actually exist on blocks
    const categories = Array.from(categorySet)
      .sort()
      .map((id) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '), // Capitalize and format
      }));

    return apiSuccess({ categories });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch categories";
    return errors.internal(errorMessage);
  }
}
