import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-v2";
import { logger } from "@/lib/logger";

// Initialize Redis client - uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
// Falls back to in-memory rate limiting if Redis not configured (development only)
let redis: Redis | null = null;
let redisWarningLogged = false;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    redis = new Redis({ url, token });
    return redis;
  }

  // Warn in production if Redis not configured (in-memory fallback is not safe for multi-instance)
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && !redisWarningLogged) {
    logger.warn(
      "Redis not configured in production - in-memory rate limiting is NOT safe for multi-instance deployments",
      { hint: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN" }
    );
    redisWarningLogged = true;
  }

  return null;
}

// In-memory fallback for development (not suitable for production with multiple instances)
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

function inMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const record = inMemoryStore.get(key);

  // Debug logging
  logger.debug("Rate limit check", {
    key,
    limit,
    windowMs,
    existingRecord: record ? { count: record.count, resetAt: record.resetAt, secondsUntilReset: Math.round((record.resetAt - now) / 1000) } : null,
    now,
  });

  if (!record || now > record.resetAt) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    logger.debug("Rate limit: new window started", { key, limit });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (record.count >= limit) {
    logger.warn("Rate limit exceeded", { key, count: record.count, limit, secondsUntilReset: Math.round((record.resetAt - now) / 1000) });
    return { success: false, remaining: 0, reset: record.resetAt };
  }

  record.count++;
  return { success: true, remaining: limit - record.count, reset: record.resetAt };
}

// Rate limit configurations by route type
export const rateLimitConfigs = {
  // LLM routes - high limit to catch abuse, Anthropic handles fine-grained limits
  llm: { requests: 100, window: "1m" as const }, // 100 requests per minute

  // Standard API routes
  standard: { requests: 100, window: "1m" as const }, // 100 requests per minute

  // Auth routes - prevent brute force
  auth: { requests: 5, window: "1m" as const }, // 5 requests per minute

  // Read-only routes - more lenient
  read: { requests: 200, window: "1m" as const }, // 200 requests per minute
} as const;

type RateLimitConfig = keyof typeof rateLimitConfigs;

// Create rate limiters (lazy initialization)
const rateLimiters = new Map<RateLimitConfig, Ratelimit>();

function getRateLimiter(config: RateLimitConfig): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) return null;

  if (!rateLimiters.has(config)) {
    const { requests, window } = rateLimitConfigs[config];
    rateLimiters.set(
      config,
      new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(requests, window),
        analytics: true,
        prefix: `ratelimit:${config}`,
      })
    );
  }

  return rateLimiters.get(config)!;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  error?: NextResponse;
}

/**
 * Check rate limit for a request
 * @param identifier - Unique identifier (usually user ID or IP)
 * @param config - Rate limit configuration to use
 * @returns RateLimitResult with success status and optional error response
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = "standard"
): Promise<RateLimitResult> {
  const limiter = getRateLimiter(config);

  if (limiter) {
    // Use Upstash Redis rate limiting
    const result = await limiter.limit(identifier);

    if (!result.success) {
      return {
        success: false,
        remaining: result.remaining,
        reset: result.reset,
        error: NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": String(rateLimitConfigs[config].requests),
              "X-RateLimit-Remaining": String(result.remaining),
              "X-RateLimit-Reset": String(result.reset),
              "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
            },
          }
        ),
      };
    }

    return { success: true, remaining: result.remaining, reset: result.reset };
  }

  // Fallback to in-memory rate limiting
  const windowMs = rateLimitConfigs[config].window === "1m" ? 60000 : 60000;
  const result = inMemoryRateLimit(
    `${config}:${identifier}`,
    rateLimitConfigs[config].requests,
    windowMs
  );

  if (!result.success) {
    return {
      success: false,
      remaining: result.remaining,
      reset: result.reset,
      error: NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimitConfigs[config].requests),
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(result.reset),
            "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
          },
        }
      ),
    };
  }

  return { success: true, remaining: result.remaining, reset: result.reset };
}

/**
 * Get rate limit identifier from request
 * Prefers user ID if authenticated, falls back to IP
 */
export async function getRateLimitIdentifier(request: Request): Promise<string> {
  // Try to get authenticated user
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      return `user:${session.user.id}`;
    }
  } catch {
    // Session lookup failed, use IP
  }

  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

/**
 * Higher-order function to wrap API route handlers with rate limiting
 */
export function withRateLimit(
  handler: (request: Request, context?: unknown) => Promise<NextResponse>,
  config: RateLimitConfig = "standard"
) {
  return async (request: Request, context?: unknown): Promise<NextResponse> => {
    const identifier = await getRateLimitIdentifier(request);
    const result = await checkRateLimit(identifier, config);

    if (!result.success && result.error) {
      return result.error;
    }

    const response = await handler(request, context);

    // Add rate limit headers to successful responses
    response.headers.set("X-RateLimit-Limit", String(rateLimitConfigs[config].requests));
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    response.headers.set("X-RateLimit-Reset", String(result.reset));

    return response;
  };
}
