/**
 * V2 Usage API Route
 *
 * Returns LLM usage statistics.
 * Query parameters:
 *   - feature: Filter by specific feature (optional)
 *   - days: Number of days to include in daily usage (default: 30)
 *   - scope: "user" (current user only) or "all" (all users, default: all)
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-v2";
import { getUsageSummary, getDailyUsage, getRecentCalls } from "@/lib/usageTracking";
import { apiSuccess } from "@/lib/apiResponse";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const { searchParams } = request.nextUrl;
  const feature = searchParams.get("feature") || undefined;
  const scope = searchParams.get("scope") as "user" | "all" | undefined;
  const days = parseInt(searchParams.get("days") || "30", 10);

  // Determine which userId to query
  // "user" scope = current user only, "all" scope = all users
  const queryUserId = scope === "user" ? userId : undefined;

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get usage summary
  const byFeature = await getUsageSummary(queryUserId, startDate, endDate);

  // Filter by feature if specified
  const filteredByFeature = feature
    ? byFeature.filter((f) => f.feature === feature)
    : byFeature;

  // Calculate totals
  const summary = filteredByFeature.reduce(
    (acc, f) => ({
      inputTokens: acc.inputTokens + f.inputTokens,
      outputTokens: acc.outputTokens + f.outputTokens,
      totalTokens: acc.totalTokens + f.totalTokens,
      totalCost: acc.totalCost + f.totalCost,
      callCount: acc.callCount + f.callCount,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0, callCount: 0 }
  );

  // Get daily usage
  const daily = await getDailyUsage(queryUserId, days);

  // Get recent calls
  const recentCalls = await getRecentCalls(queryUserId, 50);

  return apiSuccess({
    summary,
    byFeature: filteredByFeature,
    daily,
    recentCalls,
  });
}
