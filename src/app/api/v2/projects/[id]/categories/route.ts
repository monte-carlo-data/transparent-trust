/**
 * Get available categories for a project's library
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import prisma from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id: projectId } = await params;
  const userId = auth.session.user.id;

  try {
    // Verify project exists
    const project = await prisma.bulkProject.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      return errors.notFound("Project not found");
    }

    // Get library from query params
    const url = new URL(request.url);
    const library = url.searchParams.get("library") || "skills";

    // Map library name to libraryId
    const libraryMap: Record<string, string> = {
      skills: "knowledge",
      knowledge: "knowledge",
      it: "it",
      gtm: "gtm",
    };
    const libraryId = libraryMap[library.toLowerCase()] || "knowledge";

    // Fetch unique categories from all blocks in this library
    const blocks = await prisma.buildingBlock.findMany({
      where: {
        libraryId,
        // Don't filter by status - include ACTIVE, ARCHIVED
      },
      select: { categories: true },
    });

    // Extract unique categories
    const categorySet = new Set<string>();
    blocks.forEach((block) => {
      if (Array.isArray(block.categories)) {
        block.categories.forEach((cat: string) => categorySet.add(cat));
      }
    });

    // Format as CategoryItem objects (match global endpoint)
    const categories = Array.from(categorySet)
      .sort()
      .map((id) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
      }));

    return apiSuccess({ categories });
  } catch {
    return errors.internal("Failed to fetch categories");
  }
}
