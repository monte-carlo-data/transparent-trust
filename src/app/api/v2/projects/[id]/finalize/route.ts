/**
 * Finalize or unfinalize a project.
 */

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const finalizeSchema = z.object({
  action: z.enum(["finalize", "unfinalize"]),
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
    const parsed = finalizeSchema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid request");
    }

    const project = await prisma.bulkProject.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      return errors.notFound("Project not found");
    }

    const data =
      parsed.data.action === "finalize"
        ? {
            status: "FINALIZED",
            finalizedAt: new Date(),
            finalizedBy: userId,
          }
        : {
            status: "DRAFT",
            finalizedAt: null,
            finalizedBy: null,
          };

    const updated = await prisma.bulkProject.update({
      where: { id: projectId },
      data,
    });

    // Revalidate project pages to ensure fresh data
    revalidatePath(`/v2/rfps/${projectId}`);
    revalidatePath(`/v2/contracts`);

    return apiSuccess({ success: true, data: { project: updated } });
  } catch (error) {
    logger.error("Finalize project error", error, { route: "/api/v2/projects/[id]/finalize", projectId });
    return errors.internal("Failed to update project status");
  }
}
