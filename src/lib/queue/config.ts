/**
 * Background Job Queue Configuration
 *
 * Uses BullMQ + Redis (Upstash) for distributed job processing
 * Enables:
 * - Offloading heavy operations from HTTP requests
 * - Retries with exponential backoff
 * - Job persistence and crash recovery
 * - Distributed processing across multiple instances
 */

import { ConnectionOptions } from "bullmq";
import { logger } from "@/lib/logger";

/**
 * Get Redis connection options for BullMQ
 * Supports both Upstash Redis and AWS ElastiCache Redis
 */
export function getRedisConnection(): ConnectionOptions {
  // Option 1: AWS ElastiCache Redis (native Redis connection)
  const elasticacheHost = process.env.REDIS_HOST;
  const elasticachePort = process.env.REDIS_PORT;

  if (elasticacheHost && elasticachePort) {
    logger.info("Using AWS ElastiCache Redis for job queue");
    return {
      host: elasticacheHost,
      port: parseInt(elasticachePort, 10),
      // ElastiCache with TLS enabled
      tls: process.env.REDIS_TLS === "true" ? {} : undefined,
      // Auth token if TLS is enabled
      password: process.env.REDIS_AUTH_TOKEN,
      // Connection pool settings for production
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      enableOfflineQueue: false,
    };
  }

  // Option 2: Upstash Redis (also native Redis, not REST API)
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    logger.info("Using Upstash Redis for job queue");
    // Parse Upstash URL to get host and port
    const parsedUrl = new URL(upstashUrl);
    const host = parsedUrl.hostname;
    const port = parseInt(parsedUrl.port || "6379", 10);

    return {
      host,
      port,
      // Upstash uses TLS by default
      tls: parsedUrl.protocol === "https:" ? {} : undefined,
      // Use token as password (Upstash REST API auth)
      password: upstashToken,
      // Connection pool settings for production
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      enableOfflineQueue: false,
    };
  }

  // No Redis configured
  throw new Error(
    "Redis not configured. Set either:\n" +
    "  - REDIS_HOST and REDIS_PORT for AWS ElastiCache, or\n" +
    "  - UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for Upstash"
  );
}

/**
 * Check if Redis is configured for queue
 */
export function isQueueConfigured(): boolean {
  // Check for ElastiCache Redis
  const hasElastiCache = !!(process.env.REDIS_HOST && process.env.REDIS_PORT);

  // Check for Upstash Redis
  const hasUpstash = !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  return hasElastiCache || hasUpstash;
}

/**
 * Job queue names
 */
export const QUEUE_NAMES = {
  /** Heavy file processing (upload, parse, vectorization) */
  FILE_PROCESSING: "file-processing",
  /** Skill generation and refresh from documents */
  SKILL_GENERATION: "skill-generation",
  /** Contract analysis (LLM-based review) */
  CONTRACT_ANALYSIS: "contract-analysis",
  /** Bulk operations (import, export, sync) */
  BULK_OPERATIONS: "bulk-operations",
  /** Analytics and reporting */
  ANALYTICS: "analytics",
  /** Integration discovery (Slack, Zendesk, Notion) */
  INTEGRATION_DISCOVERY: "integration-discovery",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Default job options
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5000, // Start with 5 seconds
  },
  removeOnComplete: {
    age: 86400, // Keep completed jobs for 24 hours
    count: 1000, // Keep up to 1000 completed jobs
  },
  removeOnFail: {
    age: 604800, // Keep failed jobs for 7 days
  },
};

/**
 * Log queue event (centralized logging)
 */
export function logQueueEvent(
  event: string,
  queueName: string,
  jobId?: string,
  data?: Record<string, unknown>
): void {
  logger.info(`[Queue:${queueName}] ${event}`, {
    queueName,
    jobId,
    ...data,
  });
}

/**
 * Log queue error (centralized logging)
 */
export function logQueueError(
  event: string,
  queueName: string,
  error: Error,
  jobId?: string,
  data?: Record<string, unknown>
): void {
  logger.error(`[Queue:${queueName}] ${event}`, error, {
    queueName,
    jobId,
    ...data,
  });
}
