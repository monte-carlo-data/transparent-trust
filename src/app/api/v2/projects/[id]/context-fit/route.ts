/**
 * Estimate context utilization and suggested batch size for a project.
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { estimateContextFit } from "@/lib/v2/questions/process";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const fitSchema = z.object({
  library: z.string().default("skills"),
  categories: z.array(z.string()).optional(),
  modelSpeed: z.enum(["fast", "quality"]).default("quality"),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id: projectId } = await params;
  const userId = auth.session.user.id;

  try {
    const body = await request.json();
    const parsed = fitSchema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid request");
    }

    const project = await prisma.bulkProject.findFirst({
      where: { id: projectId, ownerId: userId },
      select: {
        id: true,
        fileContextTokens: true,
        _count: { select: { rows: true } },
      },
    });

    if (!project) {
      return errors.notFound("Project not found");
    }

    const questionCount = project._count.rows || 0;
    const fit = await estimateContextFit({
      questionCount,
      library: parsed.data.library,
      categories: parsed.data.categories,
      modelSpeed: parsed.data.modelSpeed,
      fileContextTokens: project.fileContextTokens || 0,
      tier: undefined,
    });

    return apiSuccess({ success: true, data: { fit } });
  } catch (error) {
    logger.error("Context fit error", error, { route: "/api/v2/projects/[id]/context-fit", projectId });
    return errors.internal("Failed to estimate context fit");
  }
}
