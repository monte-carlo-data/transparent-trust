/**
 * V2 Projects API Route
 *
 * CRUD for bulk processing projects (RFP, BVA, etc.)
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  projectType: z.enum(["rfp", "bva", "contract-review", "custom"]),
  config: z.record(z.string(), z.unknown()).optional(),
  teamId: z.string().optional(),
});

// GET /api/v2/projects
// List projects for the current user
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const userId = auth.session.user.id;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const status = searchParams.get("status");
    const projectType = searchParams.get("type");

    const where = {
      ownerId: userId,
      ...(status && { status }),
      ...(projectType && { projectType }),
    };

    const [projects, total] = await Promise.all([
      prisma.bulkProject.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { updatedAt: "desc" },
        include: {
          _count: {
            select: { rows: true },
          },
        },
      }),
      prisma.bulkProject.count({ where }),
    ]);

    // Get row status counts for each project
    const projectIds = projects.map((p) => p.id);
    const rowStats = await prisma.bulkRow.groupBy({
      by: ["projectId", "status"],
      where: { projectId: { in: projectIds } },
      _count: true,
    });

    // Transform to include stats
    const projectsWithStats = projects.map((project) => {
      const stats = rowStats.filter((r) => r.projectId === project.id);
      const pending = stats.find((s) => s.status === "PENDING")?._count || 0;
      const processing = stats.find((s) => s.status === "PROCESSING")?._count || 0;
      const completed = stats.find((s) => s.status === "COMPLETED")?._count || 0;
      const error = stats.find((s) => s.status === "ERROR")?._count || 0;

      return {
        ...project,
        rowCount: project._count.rows,
        rowStats: { pending, processing, completed, error },
      };
    });

    return apiSuccess({
      success: true,
      data: {
        projects: projectsWithStats,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error("List projects error", error, { route: "/api/v2/projects" });
    return errors.internal("Failed to list projects");
  }
}

// POST /api/v2/projects
// Create a new project
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const userId = auth.session.user.id;

  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid request");
    }

    const { name, description, projectType, config, teamId } = parsed.data;

    const project = await prisma.bulkProject.create({
      data: {
        name,
        description,
        projectType,
        config: (config || {}) as Prisma.InputJsonValue,
        ownerId: userId,
        teamId,
        status: "DRAFT",
      },
    });

    return apiSuccess(project, 201);
  } catch (error) {
    logger.error("Create project error", error, { route: "/api/v2/projects" });
    return errors.internal("Failed to create project");
  }
}
