// Snowflake Database Client
// Connects to Snowflake data warehouse for GTM data (Gong, HubSpot, Looker)

import snowflake from "snowflake-sdk";
import { logger } from "./logger";
import { circuitBreakers } from "./circuitBreaker";
import { getSecret } from "./secrets";

export type SnowflakeConfig = {
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
};

export type SnowflakeQueryResult<T = Record<string, unknown>> = {
  rows: T[];
  totalRows: number;
};

export type SnowflakeTableInfo = {
  tableName: string;
  tableType: string;
  rowCount?: number;
};

export type SnowflakeColumnInfo = {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  comment: string | null;
};

// Connection pool (reusable connection)
let cachedConnection: snowflake.Connection | null = null;
let cachedConfig: SnowflakeConfig | null = null;

async function getConfig(): Promise<SnowflakeConfig> {
  // Return cached config to avoid repeated secret lookups
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const account = await getSecret("snowflake-account", "SNOWFLAKE_ACCOUNT");
    const username = await getSecret("snowflake-user", "SNOWFLAKE_USER");
    const password = await getSecret("snowflake-password", "SNOWFLAKE_PASSWORD");
    const warehouse = await getSecret("snowflake-warehouse", "SNOWFLAKE_WAREHOUSE");
    const database = await getSecret("snowflake-database", "SNOWFLAKE_DATABASE");
    const schema = (await getSecret("snowflake-schema", "SNOWFLAKE_SCHEMA").catch(() => "PUBLIC")) || "PUBLIC";

    cachedConfig = { account, username, password, warehouse, database, schema };
    return cachedConfig;
  } catch {
    throw new Error(
      "Snowflake not configured. Set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_WAREHOUSE, and SNOWFLAKE_DATABASE in AWS Secrets Manager or environment variables."
    );
  }
}

export async function isSnowflakeConfigured(): Promise<boolean> {
  try {
    await getSecret("snowflake-account", "SNOWFLAKE_ACCOUNT");
    return true;
  } catch {
    return false;
  }
}

async function getConnection(): Promise<snowflake.Connection> {
  // Return cached connection if valid
  if (cachedConnection && cachedConnection.isUp()) {
    return cachedConnection;
  }

  const config = await getConfig();

  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
      account: config.account,
      username: config.username,
      password: config.password,
      warehouse: config.warehouse,
      database: config.database,
      schema: config.schema,
    });

    connection.connect((err, conn) => {
      if (err) {
        logger.error("Failed to connect to Snowflake", err);
        reject(new Error(`Snowflake connection failed: ${err.message}`));
      } else {
        cachedConnection = conn;
        resolve(conn);
      }
    });
  });
}

/**
 * Execute a SQL query against Snowflake
 */
export async function snowflakeQuery<T = Record<string, unknown>>(
  sqlText: string,
  binds?: (string | number)[]
): Promise<SnowflakeQueryResult<T>> {
  const connection = await getConnection();

  return circuitBreakers.snowflake.execute(
    () =>
      new Promise<SnowflakeQueryResult<T>>((resolve, reject) => {
        connection.execute({
          sqlText,
          binds: binds,
          complete: (err, stmt, rows) => {
            if (err) {
              logger.error("Snowflake query failed", err, { sqlText });
              reject(new Error(`Snowflake query failed: ${err.message}`));
            } else {
              resolve({
                rows: (rows as T[]) || [],
                totalRows: stmt?.getNumRows() || 0,
              });
            }
          },
        });
      })
  );
}

/**
 * Test Snowflake connection
 */
export async function testSnowflakeConnection(): Promise<{
  success: boolean;
  message: string;
  details?: {
    account: string;
    warehouse: string;
    database: string;
    schema: string;
  };
}> {
  try {
    const config = await getConfig();
    await getConnection();

    // Run a simple test query
    const result = await snowflakeQuery<{ CURRENT_VERSION: string }>(
      "SELECT CURRENT_VERSION() AS CURRENT_VERSION"
    );

    return {
      success: true,
      message: `Connected to Snowflake v${result.rows[0]?.CURRENT_VERSION || "unknown"}`,
      details: {
        account: config.account,
        warehouse: config.warehouse,
        database: config.database,
        schema: config.schema,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get list of tables in the configured schema
 */
export async function getSchemaTableList(
  schemaOverride?: string
): Promise<SnowflakeTableInfo[]> {
  const config = await getConfig();
  const schema = schemaOverride || config.schema;

  const result = await snowflakeQuery<{
    TABLE_NAME: string;
    TABLE_TYPE: string;
    ROW_COUNT: number | null;
  }>(
    `
    SELECT
      TABLE_NAME,
      TABLE_TYPE,
      ROW_COUNT
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_NAME
  `,
    [schema]
  );

  return result.rows.map((row) => ({
    tableName: row.TABLE_NAME,
    tableType: row.TABLE_TYPE,
    rowCount: row.ROW_COUNT ?? undefined,
  }));
}

/**
 * Get columns for a specific table
 */
export async function getTableColumns(
  tableName: string,
  schemaOverride?: string
): Promise<SnowflakeColumnInfo[]> {
  const config = await getConfig();
  const schema = schemaOverride || config.schema;

  const result = await snowflakeQuery<{
    COLUMN_NAME: string;
    DATA_TYPE: string;
    IS_NULLABLE: string;
    COLUMN_DEFAULT: string | null;
    COMMENT: string | null;
  }>(
    `
    SELECT
      COLUMN_NAME,
      DATA_TYPE,
      IS_NULLABLE,
      COLUMN_DEFAULT,
      COMMENT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `,
    [schema, tableName]
  );

  return result.rows.map((row) => ({
    columnName: row.COLUMN_NAME,
    dataType: row.DATA_TYPE,
    isNullable: row.IS_NULLABLE === "YES",
    defaultValue: row.COLUMN_DEFAULT,
    comment: row.COMMENT,
  }));
}

/**
 * Preview data from a table (first N rows)
 */
export async function previewTableData(
  tableName: string,
  limit: number = 10,
  schemaOverride?: string
): Promise<Record<string, unknown>[]> {
  const config = await getConfig();
  const schema = schemaOverride || config.schema;

  // Validate table name to prevent SQL injection
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error("Invalid table name");
  }

  const result = await snowflakeQuery(
    `SELECT * FROM "${schema}"."${tableName}" LIMIT ${Math.min(limit, 100)}`
  );

  return result.rows;
}

/**
 * Get available schemas in the database
 */
export async function getSchemaList(): Promise<string[]> {
  const result = await snowflakeQuery<{ SCHEMA_NAME: string }>(
    `
    SELECT SCHEMA_NAME
    FROM INFORMATION_SCHEMA.SCHEMATA
    WHERE SCHEMA_NAME NOT IN ('INFORMATION_SCHEMA')
    ORDER BY SCHEMA_NAME
  `
  );

  return result.rows.map((row) => row.SCHEMA_NAME);
}

/**
 * Close the connection (for cleanup)
 */
export function closeConnection(): void {
  if (cachedConnection) {
    cachedConnection.destroy((err) => {
      if (err) {
        logger.error("Error closing Snowflake connection", err);
      }
    });
    cachedConnection = null;
  }
}
