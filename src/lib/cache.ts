import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

/**
 * Cache utility for Redis with in-memory fallback
 * Used for: prompt blocks, skills, document content, etc.
 */

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    redis = new Redis({ url, token });
    return redis;
  }

  return null;
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// In-memory fallback cache (for development or when Redis unavailable)
const inMemoryCache = new Map<string, { value: unknown; expiresAt: number }>();

// Cache key prefixes
export const CacheKeys = {
  PROMPT_BLOCKS: "cache:prompt:blocks",
  PROMPT_MODIFIERS: "cache:prompt:modifiers",
  SKILLS_ALL: "cache:skills:all",
  SKILLS_BY_DOMAIN: (domain: string) => `cache:skills:domain:${domain}`,
  DOCUMENT_CONTENT: (docId: string) => `cache:doc:${docId}`,
  URL_CONTENT: (urlHash: string) => `cache:url:${urlHash}`,
} as const;

// Default TTLs in seconds
export const CacheTTL = {
  PROMPT_BLOCKS: 3600, // 1 hour - prompts rarely change
  SKILLS: 14400, // 4 hours - skills are stable after initial build
  DOCUMENTS: 14400, // 4 hours - document content is stable
  URLS: 86400, // 24 hours - external URLs change rarely
} as const;

/**
 * Get a value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redisClient = getRedis();

  if (redisClient) {
    try {
      const value = await redisClient.get<T>(key);
      return value;
    } catch (error) {
      logger.warn("Redis cache get failed, falling back to memory", { key, error });
    }
  }

  // Fallback to in-memory
  const cached = inMemoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  // Clean up expired entry
  if (cached) {
    inMemoryCache.delete(key);
  }

  return null;
}

/**
 * Set a value in cache
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redisClient = getRedis();

  if (redisClient) {
    try {
      await redisClient.set(key, value, { ex: ttlSeconds });
      return;
    } catch (error) {
      logger.warn("Redis cache set failed, falling back to memory", { key, error });
    }
  }

  // Fallback to in-memory
  inMemoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(key: string): Promise<void> {
  const redisClient = getRedis();

  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.warn("Redis cache delete failed", { key, error });
    }
  }

  // Also delete from in-memory
  inMemoryCache.delete(key);
}

/**
 * Delete all keys matching a pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const redisClient = getRedis();

  if (redisClient) {
    try {
      // Upstash Redis scan with pattern
      let cursor: string | number = 0;
      do {
        const result: [string | number, string[]] = await redisClient.scan(cursor, { match: pattern, count: 100 });
        cursor = result[0];
        const keys = result[1];
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== 0 && cursor !== "0");
    } catch (error) {
      logger.warn("Redis cache pattern delete failed", { pattern, error });
    }
  }

  // Also clean in-memory cache
  const prefix = pattern.replace(/\*/g, "");
  for (const key of inMemoryCache.keys()) {
    if (key.startsWith(prefix)) {
      inMemoryCache.delete(key);
    }
  }
}

/**
 * Get or set a cached value (cache-aside pattern)
 * NOTE: Skips caching entirely when Redis is not configured to avoid stale data issues
 * with in-memory cache (invalidation doesn't work reliably without Redis)
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Skip caching entirely if Redis is not configured
  // In-memory cache invalidation is unreliable (pattern deletes don't work across requests)
  if (!isRedisConfigured()) {
    return fetchFn();
  }

  // Try to get from cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const value = await fetchFn();

  // Store in cache (don't await - fire and forget)
  cacheSet(key, value, ttlSeconds).catch((error) => {
    logger.warn("Failed to cache value", { key, error });
  });

  return value;
}

/**
 * Invalidate prompt-related caches (call after prompt edits)
 */
export async function invalidatePromptCache(): Promise<void> {
  await Promise.all([
    cacheDelete(CacheKeys.PROMPT_BLOCKS),
    cacheDelete(CacheKeys.PROMPT_MODIFIERS),
  ]);
  logger.info("Prompt cache invalidated");
}

/**
 * Invalidate skill-related caches (call after skill edits)
 */
export async function invalidateSkillCache(): Promise<void> {
  await cacheDelete(CacheKeys.SKILLS_ALL);
  await cacheDeletePattern(`${CacheKeys.SKILLS_ALL}:*`); // Delete all skill cache variations with query params
  await cacheDeletePattern("cache:skills:domain:*");
  logger.info("Skill cache invalidated");
}

/**
 * Warm up common caches (call on server startup or background job)
 */
export async function warmCache(
  warmers: { key: string; ttl: number; fetcher: () => Promise<unknown> }[]
): Promise<void> {
  const results = await Promise.allSettled(
    warmers.map(async ({ key, ttl, fetcher }) => {
      const value = await fetcher();
      await cacheSet(key, value, ttl);
      return key;
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  logger.info("Cache warming complete", { succeeded, failed, total: warmers.length });
}
