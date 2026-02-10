import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import {
  isSnowflakeConfigured,
  getSchemaList,
  getSchemaTableList,
  getTableColumns,
  previewTableData,
} from "@/lib/snowflake";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/snowflake/schema
// Query params:
//   - schemas: list available schemas
//   - tables: list tables in a schema (requires ?schema=xxx)
//   - columns: list columns in a table (requires ?schema=xxx&table=xxx)
//   - preview: preview data from a table (requires ?schema=xxx&table=xxx)
export async function GET(request: NextRequest) {
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
      },
      { status: 501 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action") || "schemas";
  const schema = searchParams.get("schema");
  const table = searchParams.get("table");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 100);

  try {
    switch (action) {
      case "schemas": {
        const schemas = await getSchemaList();
        return apiSuccess({ schemas });
      }

      case "tables": {
        if (!schema) {
          return errors.badRequest("schema parameter required for tables action");
        }
        const tables = await getSchemaTableList(schema);
        return apiSuccess({ tables, schema });
      }

      case "columns": {
        if (!schema || !table) {
          return errors.badRequest("schema and table parameters required for columns action");
        }
        const columns = await getTableColumns(table, schema);
        return apiSuccess({ columns, schema, table });
      }

      case "preview": {
        if (!schema || !table) {
          return errors.badRequest("schema and table parameters required for preview action");
        }
        const data = await previewTableData(table, limit, schema);
        return apiSuccess({ data, schema, table, rowCount: data.length });
      }

      default:
        return errors.badRequest(`Unknown action: ${action}. Valid actions: schemas, tables, columns, preview`);
    }
  } catch (error) {
    logger.error("Snowflake schema error", error, { route: "/api/snowflake/schema", action, schema, table });
    return errors.internal(error instanceof Error ? error.message : "Snowflake schema query failed");
  }
}
