import { requireAuth } from "@/lib/apiAuth";
import { isSnowflakeConfigured, testSnowflakeConnection } from "@/lib/snowflake";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/snowflake/test
// Test Snowflake connection and return status
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  // TODO: Add proper admin check via team role when admin UI is built
  // For now, any authenticated user can access (Snowflake credentials provide access control)

  if (!isSnowflakeConfigured()) {
    return Response.json(
      {
        error: {
          code: "NOT_IMPLEMENTED",
          message: "Snowflake not configured",
        },
        configured: false,
        hint: "Set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_WAREHOUSE, and SNOWFLAKE_DATABASE",
      },
      { status: 501 }
    );
  }

  try {
    const result = await testSnowflakeConnection();

    if (result.success) {
      return apiSuccess({
        connected: true,
        message: result.message,
        details: result.details,
      });
    } else {
      return apiSuccess({
        connected: false,
        message: result.message,
      });
    }
  } catch (error) {
    logger.error("Snowflake test error", error, { route: "/api/snowflake/test" });
    return errors.internal(error instanceof Error ? error.message : "Snowflake test failed");
  }
}
