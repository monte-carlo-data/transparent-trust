import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-v2";
import { snowflakeQuery, isSnowflakeConfigured } from "@/lib/snowflake";
import { logger } from "@/lib/logger";
import { apiSuccess, errors } from "@/lib/apiResponse";
import type {
  GongCall,
  HubSpotActivity,
  LookerMetrics,
  CustomerGTMData,
  FetchGTMDataRequest,
  FetchGTMDataResponse,
} from "@/types/gtmData";

/**
 * Snowflake table/column configuration
 * These should be configured based on actual Snowflake schema
 * Can be moved to admin settings later
 */
const SNOWFLAKE_CONFIG = {
  // Gong calls table
  gong: {
    table: process.env.SNOWFLAKE_GONG_TABLE || "GONG_CALLS",
    columns: {
      id: "CALL_ID",
      salesforceAccountId: "SALESFORCE_ACCOUNT_ID",
      title: "CALL_TITLE",
      date: "CALL_DATE",
      duration: "DURATION_SECONDS",
      participants: "PARTICIPANTS", // JSON array or comma-separated
      transcript: "TRANSCRIPT",
      summary: "SUMMARY",
      sentiment: "SENTIMENT",
      topics: "TOPICS", // JSON array or comma-separated
    },
  },
  // HubSpot activities table
  hubspot: {
    table: process.env.SNOWFLAKE_HUBSPOT_TABLE || "HUBSPOT_ACTIVITIES",
    columns: {
      id: "ACTIVITY_ID",
      salesforceAccountId: "SALESFORCE_ACCOUNT_ID",
      type: "ACTIVITY_TYPE",
      date: "ACTIVITY_DATE",
      subject: "SUBJECT",
      content: "CONTENT",
      associatedDeal: "DEAL_NAME",
      owner: "OWNER_NAME",
    },
  },
  // Looker metrics table
  looker: {
    table: process.env.SNOWFLAKE_LOOKER_TABLE || "LOOKER_METRICS",
    columns: {
      salesforceAccountId: "SALESFORCE_ACCOUNT_ID",
      period: "PERIOD",
      metrics: "METRICS_JSON", // JSON object
    },
  },
};

/**
 * Parse array from Snowflake column (JSON or comma-separated)
 */
function parseArrayColumn(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    // Try JSON first
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall back to comma-separated
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Parse metrics JSON from Snowflake
 */
function parseMetricsColumn(value: unknown): Record<string, number | string> {
  if (!value) return {};
  if (typeof value === "object" && value !== null) return value as Record<string, number | string>;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Fetch Gong calls for a customer
 */
async function fetchGongCalls(
  salesforceAccountId: string,
  limit: number = 10,
  dateFrom?: string,
  dateTo?: string
): Promise<{ calls: GongCall[]; total: number }> {
  const { table, columns } = SNOWFLAKE_CONFIG.gong;

  let whereClause = `WHERE ${columns.salesforceAccountId} = ?`;
  const binds: (string | number)[] = [salesforceAccountId];

  if (dateFrom) {
    whereClause += ` AND ${columns.date} >= ?`;
    binds.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ` AND ${columns.date} <= ?`;
    binds.push(dateTo);
  }

  // Get total count
  const countResult = await snowflakeQuery<{ COUNT: number }>(
    `SELECT COUNT(*) AS COUNT FROM ${table} ${whereClause}`,
    binds
  );
  const total = countResult.rows[0]?.COUNT || 0;

  // Get calls
  const result = await snowflakeQuery<Record<string, unknown>>(
    `SELECT * FROM ${table} ${whereClause} ORDER BY ${columns.date} DESC LIMIT ${limit}`,
    binds
  );

  const calls: GongCall[] = result.rows.map((row) => ({
    id: String(row[columns.id] || ""),
    salesforceAccountId: String(row[columns.salesforceAccountId] || ""),
    title: String(row[columns.title] || "Untitled Call"),
    date: String(row[columns.date] || ""),
    duration: Number(row[columns.duration]) || 0,
    participants: parseArrayColumn(row[columns.participants]),
    transcript: row[columns.transcript] ? String(row[columns.transcript]) : undefined,
    summary: row[columns.summary] ? String(row[columns.summary]) : undefined,
    sentiment: row[columns.sentiment] as GongCall["sentiment"],
    topics: parseArrayColumn(row[columns.topics]),
  }));

  return { calls, total };
}

/**
 * Fetch HubSpot activities for a customer
 */
async function fetchHubSpotActivities(
  salesforceAccountId: string,
  limit: number = 20,
  dateFrom?: string,
  dateTo?: string
): Promise<{ activities: HubSpotActivity[]; total: number }> {
  const { table, columns } = SNOWFLAKE_CONFIG.hubspot;

  let whereClause = `WHERE ${columns.salesforceAccountId} = ?`;
  const binds: (string | number)[] = [salesforceAccountId];

  if (dateFrom) {
    whereClause += ` AND ${columns.date} >= ?`;
    binds.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ` AND ${columns.date} <= ?`;
    binds.push(dateTo);
  }

  // Get total count
  const countResult = await snowflakeQuery<{ COUNT: number }>(
    `SELECT COUNT(*) AS COUNT FROM ${table} ${whereClause}`,
    binds
  );
  const total = countResult.rows[0]?.COUNT || 0;

  // Get activities
  const result = await snowflakeQuery<Record<string, unknown>>(
    `SELECT * FROM ${table} ${whereClause} ORDER BY ${columns.date} DESC LIMIT ${limit}`,
    binds
  );

  const activities: HubSpotActivity[] = result.rows.map((row) => ({
    id: String(row[columns.id] || ""),
    salesforceAccountId: String(row[columns.salesforceAccountId] || ""),
    type: (row[columns.type] as HubSpotActivity["type"]) || "note",
    date: String(row[columns.date] || ""),
    subject: String(row[columns.subject] || ""),
    content: row[columns.content] ? String(row[columns.content]) : undefined,
    associatedDeal: row[columns.associatedDeal] ? String(row[columns.associatedDeal]) : undefined,
    owner: row[columns.owner] ? String(row[columns.owner]) : undefined,
  }));

  return { activities, total };
}

/**
 * Fetch Looker metrics for a customer
 */
async function fetchLookerMetrics(
  salesforceAccountId: string
): Promise<LookerMetrics[]> {
  const { table, columns } = SNOWFLAKE_CONFIG.looker;

  const result = await snowflakeQuery<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE ${columns.salesforceAccountId} = ? ORDER BY ${columns.period} DESC LIMIT 12`,
    [salesforceAccountId]
  );

  return result.rows.map((row) => ({
    salesforceAccountId: String(row[columns.salesforceAccountId] || ""),
    period: String(row[columns.period] || ""),
    metrics: parseMetricsColumn(row[columns.metrics]),
  }));
}

/**
 * GET /api/snowflake/customer-data
 * Fetch GTM data for a customer by Salesforce Account ID
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    if (!isSnowflakeConfigured()) {
      return errors.internal("Snowflake not configured");
    }

    const { searchParams } = new URL(request.url);
    const salesforceAccountId = searchParams.get("salesforceAccountId");

    if (!salesforceAccountId) {
      return errors.badRequest("salesforceAccountId is required");
    }

    const includeGongCalls = searchParams.get("includeGongCalls") !== "false";
    const includeHubSpotActivities = searchParams.get("includeHubSpotActivities") !== "false";
    const includeLookerMetrics = searchParams.get("includeLookerMetrics") !== "false";
    const gongCallLimit = parseInt(searchParams.get("gongCallLimit") || "10", 10);
    const hubspotActivityLimit = parseInt(searchParams.get("hubspotActivityLimit") || "20", 10);
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const gtmData: CustomerGTMData = {
      salesforceAccountId,
      gongCalls: [],
      hubspotActivities: [],
      lookerMetrics: [],
      lastUpdated: new Date().toISOString(),
    };

    let gongCallsTotal = 0;
    let hubspotActivitiesTotal = 0;
    let hasMoreGongCalls = false;
    let hasMoreHubSpotActivities = false;

    // Fetch data in parallel
    const promises: Promise<void>[] = [];

    if (includeGongCalls) {
      promises.push(
        fetchGongCalls(salesforceAccountId, gongCallLimit, dateFrom, dateTo)
          .then(({ calls, total }) => {
            gtmData.gongCalls = calls;
            gongCallsTotal = total;
            hasMoreGongCalls = total > gongCallLimit;
          })
          .catch((err) => {
            logger.warn("Failed to fetch Gong calls", err);
            // Continue with empty data
          })
      );
    }

    if (includeHubSpotActivities) {
      promises.push(
        fetchHubSpotActivities(salesforceAccountId, hubspotActivityLimit, dateFrom, dateTo)
          .then(({ activities, total }) => {
            gtmData.hubspotActivities = activities;
            hubspotActivitiesTotal = total;
            hasMoreHubSpotActivities = total > hubspotActivityLimit;
          })
          .catch((err) => {
            logger.warn("Failed to fetch HubSpot activities", err);
          })
      );
    }

    if (includeLookerMetrics) {
      promises.push(
        fetchLookerMetrics(salesforceAccountId)
          .then((metrics) => {
            gtmData.lookerMetrics = metrics;
          })
          .catch((err) => {
            logger.warn("Failed to fetch Looker metrics", err);
          })
      );
    }

    await Promise.all(promises);

    const response: FetchGTMDataResponse = {
      data: gtmData,
      metadata: {
        gongCallsTotal,
        hubspotActivitiesTotal,
        hasMoreGongCalls,
        hasMoreHubSpotActivities,
      },
    };

    return apiSuccess(response);
  } catch (error) {
    logger.error("Failed to fetch GTM data", error);
    const message = error instanceof Error ? error.message : "Failed to fetch GTM data";
    return errors.internal(message);
  }
}

/**
 * POST /api/snowflake/customer-data
 * Fetch GTM data with request body (for more complex queries)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized();
    }

    if (!isSnowflakeConfigured()) {
      return errors.internal("Snowflake not configured");
    }

    const body: FetchGTMDataRequest = await request.json();
    const {
      salesforceAccountId,
      includeGongCalls = true,
      includeHubSpotActivities = true,
      includeLookerMetrics = true,
      gongCallLimit = 10,
      hubspotActivityLimit = 20,
      dateFrom,
      dateTo,
    } = body;

    if (!salesforceAccountId) {
      return errors.badRequest("salesforceAccountId is required");
    }

    const gtmData: CustomerGTMData = {
      salesforceAccountId,
      gongCalls: [],
      hubspotActivities: [],
      lookerMetrics: [],
      lastUpdated: new Date().toISOString(),
    };

    let gongCallsTotal = 0;
    let hubspotActivitiesTotal = 0;
    let hasMoreGongCalls = false;
    let hasMoreHubSpotActivities = false;

    const promises: Promise<void>[] = [];

    if (includeGongCalls) {
      promises.push(
        fetchGongCalls(salesforceAccountId, gongCallLimit, dateFrom, dateTo)
          .then(({ calls, total }) => {
            gtmData.gongCalls = calls;
            gongCallsTotal = total;
            hasMoreGongCalls = total > gongCallLimit;
          })
          .catch((err) => {
            logger.warn("Failed to fetch Gong calls", err);
          })
      );
    }

    if (includeHubSpotActivities) {
      promises.push(
        fetchHubSpotActivities(salesforceAccountId, hubspotActivityLimit, dateFrom, dateTo)
          .then(({ activities, total }) => {
            gtmData.hubspotActivities = activities;
            hubspotActivitiesTotal = total;
            hasMoreHubSpotActivities = total > hubspotActivityLimit;
          })
          .catch((err) => {
            logger.warn("Failed to fetch HubSpot activities", err);
          })
      );
    }

    if (includeLookerMetrics) {
      promises.push(
        fetchLookerMetrics(salesforceAccountId)
          .then((metrics) => {
            gtmData.lookerMetrics = metrics;
          })
          .catch((err) => {
            logger.warn("Failed to fetch Looker metrics", err);
          })
      );
    }

    await Promise.all(promises);

    const response: FetchGTMDataResponse = {
      data: gtmData,
      metadata: {
        gongCallsTotal,
        hubspotActivitiesTotal,
        hasMoreGongCalls,
        hasMoreHubSpotActivities,
      },
    };

    return apiSuccess(response);
  } catch (error) {
    logger.error("Failed to fetch GTM data", error);
    const message = error instanceof Error ? error.message : "Failed to fetch GTM data";
    return errors.internal(message);
  }
}
