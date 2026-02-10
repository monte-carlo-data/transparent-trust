/**
 * Return the RFP system prompt for transparency in the UI.
 */
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { assembleSystemPrompt } from "@/lib/llm/registry";
import { logger } from "@/lib/logger";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { prompt, blockIds } = await assembleSystemPrompt("rfp_single");

    return apiSuccess({
      success: true,
      data: {
        prompt,
        source: "registry",
        compositionId: "rfp_single",
        blockIds,
      },
    });
  } catch (error) {
    logger.error("Failed to load RFP prompt", error, { route: "/api/v2/rfps/prompt" });
    return errors.internal("Failed to load prompt");
  }
}
