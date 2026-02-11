/**
 * Generic prompt transparency endpoint.
 * Returns the composed prompt for a given context using the v2 registry.
 *
 * Example: /api/v2/prompts/chat, /api/v2/prompts/questions, /api/v2/prompts/rfp_single
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { assembleSystemPrompt } from "@/lib/llm/registry";
import { logger } from "@/lib/logger";

// Map legacy context names to v2 composition IDs
const CONTEXT_TO_COMPOSITION: Record<string, string> = {
  questions: "rfp_single",
  rfp_single: "rfp_single",
  rfp_batch: "rfp_batch",
  chat: "chat_response",
  chat_response: "chat_response",
  // Customer view compositions
  customer_revenue_forecast: "customer_revenue_forecast",
  customer_competitive_analysis: "customer_competitive_analysis",
  customer_risk_assessment: "customer_risk_assessment",
  customer_expansion_opportunities: "customer_expansion_opportunities",
  customer_coverage_audit: "customer_coverage_audit",
  customer_operations_audit: "customer_operations_audit",
  customer_adoption_audit: "customer_adoption_audit",
  customer_account_plan: "customer_account_plan",
};

type RouteParams = { params: Promise<{ context: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { context } = await params;

  try {
    const compositionId = CONTEXT_TO_COMPOSITION[context];

    if (!compositionId) {
      return errors.badRequest(
        `Unknown context: "${context}". Available: ${Object.keys(CONTEXT_TO_COMPOSITION).join(", ")}`
      );
    }

    const { prompt, blockIds } = await assembleSystemPrompt(compositionId);

    return apiSuccess({
      success: true,
      data: {
        prompt,
        source: "registry",
        compositionId,
        blockIds,
      },
    });
  } catch (error) {
    logger.error("Prompt load error", error, { route: "/api/v2/prompts/[context]", context });
    return errors.internal("Failed to load prompt");
  }
}
