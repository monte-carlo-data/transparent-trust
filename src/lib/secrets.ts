/**
 * AWS Secrets Manager Integration
 *
 * Provides secure secret retrieval from AWS Secrets Manager with local caching
 * and environment variable fallback for development.
 *
 * Features:
 * - AWS Secrets Manager integration for production
 * - Local cache (5 minutes TTL) to reduce API calls
 * - Environment variable fallback for local development
 * - Automatic JSON parsing for structured secrets
 * - Error handling and logging
 *
 * Secret Naming Convention:
 * - Development: development/transparent-trust-{secret-name}
 * - Production: production/transparent-trust-{secret-name}
 *
 * Example Secrets:
 * - development/transparent-trust-encryption-key
 * - development/transparent-trust-anthropic-api-key
 * - development/transparent-trust-google-oauth (JSON: { client_id, client_secret })
 * - development/transparent-trust-nextauth-secret
 *
 * @module lib/secrets
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { logger } from "./logger";

/**
 * Secrets Manager client configuration
 * Uses IAM roles in ECS, falls back to env vars for local development
 */
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || "us-east-1",
});

/**
 * In-memory cache for secrets
 * Reduces AWS API calls (cost optimization)
 * 5-minute TTL is a good balance between security and performance
 */
interface CachedSecret {
  value: string;
  expiresAt: number;
}

const secretCache = new Map<string, CachedSecret>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if Secrets Manager is configured
 */
export function isSecretsManagerConfigured(): boolean {
  const hasRegion = !!process.env.AWS_REGION;

  // Credentials can come from multiple sources:
  // 1. Explicit credentials (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY)
  // 2. ECS IAM role (AWS_CONTAINER_CREDENTIALS_RELATIVE_URI)
  // 3. AWS CLI profile (AWS_PROFILE)
  // 4. Default credentials chain (~/.aws/credentials)
  const hasCredentials =
    !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
    !!process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || // ECS IAM role indicator
    !!process.env.AWS_PROFILE; // AWS CLI profile

  return hasRegion && hasCredentials;
}

/**
 * Get environment name for secret path
 * Defaults to "production" if not specified
 */
function getEnvironmentName(): string {
  return process.env.ENVIRONMENT || (process.env.NODE_ENV === "production" ? "production" : "development");
}

/**
 * Generate full secret ARN or name
 * Format: {environment}/transparent-trust-{secret-name}
 * This matches the Terraform-deployed secret naming in AWS
 */
function getSecretPath(secretName: string): string {
  // For secrets managed by Terraform, they use the path format with environment prefix
  // e.g., development/transparent-trust-anthropic-api-key
  const env = getEnvironmentName();
  return `${env}/transparent-trust-${secretName}`;
}

/**
 * Get a secret from AWS Secrets Manager
 *
 * Retrieves secrets from AWS Secrets Manager with caching and fallback to
 * environment variables for local development.
 *
 * @param secretName - Name of the secret (without environment prefix)
 * @param envVarName - Optional environment variable name for fallback
 * @returns Secret value as string
 * @throws Error if secret not found and no fallback available
 *
 * @example
 * // Get encryption key (falls back to ENCRYPTION_KEY env var)
 * const encryptionKey = await getSecret("encryption-key", "ENCRYPTION_KEY");
 *
 * @example
 * // Get Anthropic API key
 * const apiKey = await getSecret("anthropic-api-key", "ANTHROPIC_API_KEY");
 */
export async function getSecret(secretName: string, envVarName?: string): Promise<string> {
  const secretPath = getSecretPath(secretName);

  // Check cache first
  const cached = secretCache.get(secretPath);
  if (cached && Date.now() < cached.expiresAt) {
    logger.debug("Secret retrieved from cache", { secretPath });
    return cached.value;
  }

  // Try Secrets Manager if configured
  if (isSecretsManagerConfigured()) {
    try {
      const command = new GetSecretValueCommand({
        SecretId: secretPath,
      });

      const response = await secretsClient.send(command);

      if (!response.SecretString) {
        throw new Error("Secret has no string value");
      }

      const secretValue = response.SecretString;

      // Cache the secret
      secretCache.set(secretPath, {
        value: secretValue,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      logger.info("Secret retrieved from AWS Secrets Manager", {
        secretPath,
        cached: true,
      });

      return secretValue;
    } catch (error) {
      logger.error("Failed to retrieve secret from AWS Secrets Manager", error, {
        secretPath,
        hasEnvVarFallback: !!envVarName,
      });

      // Fall through to environment variable fallback
    }
  }

  // Fallback to environment variable (local development or Secrets Manager unavailable)
  if (envVarName && process.env[envVarName]) {
    logger.warn("Using environment variable fallback for secret", {
      secretPath,
      envVarName,
      reason: isSecretsManagerConfigured() ? "Secrets Manager retrieval failed" : "Secrets Manager not configured",
    });
    return process.env[envVarName]!;
  }

  // No secret available
  throw new Error(
    `Secret not found: ${secretPath}. ` +
      `Secrets Manager configured: ${isSecretsManagerConfigured()}. ` +
      `Environment variable fallback (${envVarName}): ${envVarName ? "not set" : "not provided"}`
  );
}

/**
 * Get a JSON secret from AWS Secrets Manager
 *
 * Retrieves and parses JSON secrets from AWS Secrets Manager.
 * Useful for secrets with multiple fields (e.g., OAuth credentials).
 *
 * @param secretName - Name of the secret (without environment prefix)
 * @returns Parsed JSON object
 * @throws Error if secret not found or invalid JSON
 *
 * @example
 * // Get Google OAuth credentials
 * const oauth = await getJsonSecret<{ clientId: string; clientSecret: string }>("google-oauth");
 * console.log(oauth.clientId, oauth.clientSecret);
 */
export async function getJsonSecret<T = Record<string, unknown>>(secretName: string): Promise<T> {
  const secretValue = await getSecret(secretName);

  try {
    return JSON.parse(secretValue) as T;
  } catch (error) {
    logger.error("Failed to parse JSON secret", error, { secretName });
    throw new Error(`Secret ${secretName} is not valid JSON`);
  }
}

/**
 * Clear the secret cache
 *
 * Useful for testing or forcing a refresh of cached secrets.
 */
export function clearSecretCache(): void {
  secretCache.clear();
  logger.info("Secret cache cleared");
}

/**
 * Preload frequently-used secrets into cache
 *
 * Call this at application startup to warm the cache and reduce
 * cold-start latency for first requests.
 *
 * @param secretNames - Array of secret names to preload
 *
 * @example
 * // In your app initialization
 * await preloadSecrets([
 *   "encryption-key",
 *   "anthropic-api-key",
 *   "nextauth-secret",
 * ]);
 */
export async function preloadSecrets(secretNames: string[]): Promise<void> {
  logger.info("Preloading secrets into cache", { count: secretNames.length });

  const results = await Promise.allSettled(
    secretNames.map(async (name) => {
      try {
        // Use environment variable name matching convention
        const envVarName = name.toUpperCase().replace(/-/g, "_");
        await getSecret(name, envVarName);
        return { name, success: true };
      } catch (error) {
        logger.warn("Failed to preload secret", error, { secretName: name });
        return { name, success: false };
      }
    })
  );

  const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
  const failed = results.length - successful;

  logger.info("Secret preloading complete", {
    total: secretNames.length,
    successful,
    failed,
  });
}

/**
 * Store or update a secret in AWS Secrets Manager
 *
 * Creates a new secret if it doesn't exist, or updates the value if it does.
 * Clears the local cache for this secret to ensure next read gets fresh value.
 *
 * @param secretName - Name of the secret (without environment prefix)
 * @param secretValue - The secret value to store
 *
 * @example
 * await putSecret("slack-bot-token-it", "xoxb-123456...");
 */
export async function putSecret(secretName: string, secretValue: string): Promise<void> {
  // Skip if not configured to use Secrets Manager
  if (!isSecretsManagerConfigured()) {
    logger.warn("Secrets Manager not configured, skipping putSecret", { secretName });
    return;
  }

  // Use the full secret name with environment prefix (reuse getSecretPath for consistency)
  const fullSecretName = getSecretPath(secretName);

  try {
    const command = new PutSecretValueCommand({
      SecretId: fullSecretName,
      SecretString: secretValue,
    });

    await secretsClient.send(command);
    logger.info("Secret stored in Secrets Manager", { secretName: fullSecretName });

    // Clear cache for this secret so next read gets fresh value
    secretCache.delete(fullSecretName);
  } catch (error) {
    logger.error("Failed to store secret in Secrets Manager", error, { secretName: fullSecretName });
    throw error;
  }
}
