/**
 * Build a PostgreSQL connection string from environment variables.
 * Supports either a pre-built DATABASE_URL or individual RDS components.
 */
export function buildDatabaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  // Use explicit DATABASE_URL if provided
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const host = env.DB_HOST;
  const port = env.DB_PORT || "5432";
  const name = env.DB_NAME;
  const username = env.DB_USERNAME;
  const password = env.DB_PASSWORD;
  const ssl = env.DB_SSL !== "false";

  if (!host || !username || !password || !name) {
    return "";
  }

  const encodedPassword = encodeURIComponent(password);
  const hostWithPort = host.includes(":") ? host : `${host}:${port}`;
  const sslParam = ssl ? "?sslmode=require" : "";

  return `postgresql://${username}:${encodedPassword}@${hostWithPort}/${name}${sslParam}`;
}

/**
 * Ensure DATABASE_URL is present in process.env by constructing it from
 * individual components when necessary. Returns the resolved URL (or empty string).
 */
export function ensureDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = buildDatabaseUrlFromEnv(env);

  if (databaseUrl && !env.DATABASE_URL) {
    env.DATABASE_URL = databaseUrl;
  }

  return env.DATABASE_URL ?? "";
}
