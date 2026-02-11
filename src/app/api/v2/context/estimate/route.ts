import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { estimateContextFit } from "@/lib/v2/questions/process";
import { z } from "zod";

const querySchema = z.object({
  library: z.string().default("skills"),
  categories: z.string().nullable().optional(),
  questionCount: z.coerce.number().min(1).max(1000).default(1),
  tier: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      library: searchParams.get("library"),
      categories: searchParams.get("categories"),
      questionCount: searchParams.get("questionCount"),
      tier: searchParams.get("tier"),
    });

    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid query");
    }

    const { library, categories, questionCount, tier } = parsed.data;

    const result = await estimateContextFit({
      library,
      questionCount,
      categories: categories ? categories.split(",") : undefined,
      tier: tier || undefined,
    });

    return apiSuccess(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to estimate context";
    return errors.internal(errorMessage);
  }
}
