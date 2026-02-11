/**
 * Circuit Breaker Pattern Implementation
 *
 * Protects external API calls from cascading failures by:
 * 1. Tracking failure rates
 * 2. Opening circuit (failing fast) when threshold exceeded
 * 3. Attempting recovery after timeout period
 * 4. Using Redis for distributed state across instances
 *
 * Circuit States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is open, requests fail fast without calling service
 * - HALF_OPEN: Testing if service recovered, limited requests pass through
 */

import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  /** Service name for logging and metrics */
  name: string;
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time window in ms to count failures (default: 60000 = 1 minute) */
  failureWindow?: number;
  /** How long to wait before attempting recovery in ms (default: 30000 = 30 seconds) */
  recoveryTimeout?: number;
  /** Number of successful requests needed in HALF_OPEN to close circuit (default: 3) */
  successThreshold?: number;
  /** Request timeout in ms (default: 30000 = 30 seconds) */
  timeout?: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly serviceName: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class CircuitBreakerTimeoutError extends Error {
  constructor(message: string, public readonly serviceName: string) {
    super(message);
    this.name = "CircuitBreakerTimeoutError";
  }
}

// Redis client (lazy initialization, shared with rate limiter)
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

// In-memory fallback for development (not safe for multi-instance production)
const inMemoryState = new Map<string, CircuitBreakerState>();

/**
 * Circuit Breaker for protecting external API calls
 */
export class CircuitBreaker {
  private readonly config: Required<CircuitBreakerConfig>;
  private readonly stateKey: string;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      name: config.name,
      failureThreshold: config.failureThreshold,
      failureWindow: config.failureWindow ?? 60000, // 1 minute
      recoveryTimeout: config.recoveryTimeout ?? 30000, // 30 seconds
      successThreshold: config.successThreshold ?? 3,
      timeout: config.timeout ?? 30000, // 30 seconds
    };
    this.stateKey = `circuit:${config.name}`;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = await this.getState();

    // Check if circuit is open
    if (state.state === "OPEN") {
      const now = Date.now();
      if (now < state.nextAttemptTime) {
        // Circuit still open, fail fast
        logger.warn("Circuit breaker is OPEN, failing fast", {
          service: this.config.name,
          nextAttempt: new Date(state.nextAttemptTime).toISOString(),
        });
        throw new CircuitBreakerError(
          `Service ${this.config.name} is temporarily unavailable. Circuit breaker is OPEN.`,
          this.config.name,
          "OPEN"
        );
      }

      // Recovery timeout elapsed, transition to HALF_OPEN
      await this.transitionToHalfOpen();
    }

    // Execute the function with timeout
    try {
      const result = await this.executeWithTimeout(fn);
      await this.recordSuccess();
      return result;
    } catch (error) {
      await this.recordFailure();
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new CircuitBreakerTimeoutError(
                `Request to ${this.config.name} timed out after ${this.config.timeout}ms`,
                this.config.name
              )
            ),
          this.config.timeout
        )
      ),
    ]);
  }

  /**
   * Get current circuit breaker state
   */
  private async getState(): Promise<CircuitBreakerState> {
    const redisClient = getRedis();

    if (redisClient) {
      try {
        const data = await redisClient.get<CircuitBreakerState>(this.stateKey);
        if (data) {
          return data;
        }
      } catch (error) {
        logger.error("Failed to get circuit breaker state from Redis", error, {
          service: this.config.name,
        });
      }
    }

    // Fallback to in-memory state
    return (
      inMemoryState.get(this.stateKey) ?? {
        state: "CLOSED",
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      }
    );
  }

  /**
   * Save circuit breaker state
   */
  private async setState(state: CircuitBreakerState): Promise<void> {
    const redisClient = getRedis();

    if (redisClient) {
      try {
        // Store for 24 hours (circuits will auto-recover after this)
        await redisClient.setex(this.stateKey, 86400, state);
      } catch (error) {
        logger.error("Failed to save circuit breaker state to Redis", error, {
          service: this.config.name,
        });
      }
    }

    // Always update in-memory fallback
    inMemoryState.set(this.stateKey, state);
  }

  /**
   * Record successful execution
   */
  private async recordSuccess(): Promise<void> {
    const state = await this.getState();

    if (state.state === "HALF_OPEN") {
      state.successes++;

      if (state.successes >= this.config.successThreshold) {
        // Enough successes to close the circuit
        logger.info("Circuit breaker closing after successful recovery", {
          service: this.config.name,
          successes: state.successes,
        });

        await this.setState({
          state: "CLOSED",
          failures: 0,
          successes: 0,
          lastFailureTime: 0,
          nextAttemptTime: 0,
        });
      } else {
        // Still in HALF_OPEN, increment successes
        await this.setState(state);
      }
    } else if (state.state === "CLOSED") {
      // Reset failure count on success in CLOSED state
      if (state.failures > 0) {
        state.failures = 0;
        await this.setState(state);
      }
    }
  }

  /**
   * Record failed execution
   */
  private async recordFailure(): Promise<void> {
    const state = await this.getState();
    const now = Date.now();

    // Reset failure count if outside failure window
    if (now - state.lastFailureTime > this.config.failureWindow) {
      state.failures = 0;
    }

    state.failures++;
    state.lastFailureTime = now;

    if (state.state === "HALF_OPEN") {
      // Failure in HALF_OPEN immediately opens circuit again
      logger.warn("Circuit breaker reopening after failure in HALF_OPEN", {
        service: this.config.name,
      });

      await this.setState({
        state: "OPEN",
        failures: state.failures,
        successes: 0,
        lastFailureTime: now,
        nextAttemptTime: now + this.config.recoveryTimeout,
      });
    } else if (
      state.state === "CLOSED" &&
      state.failures >= this.config.failureThreshold
    ) {
      // Threshold exceeded, open the circuit
      logger.error("Circuit breaker opening due to failure threshold", {
        service: this.config.name,
        failures: state.failures,
        threshold: this.config.failureThreshold,
      });

      await this.setState({
        state: "OPEN",
        failures: state.failures,
        successes: 0,
        lastFailureTime: now,
        nextAttemptTime: now + this.config.recoveryTimeout,
      });
    } else {
      // Just record the failure
      await this.setState(state);
    }
  }

  /**
   * Transition circuit from OPEN to HALF_OPEN
   */
  private async transitionToHalfOpen(): Promise<void> {
    logger.info("Circuit breaker transitioning to HALF_OPEN", {
      service: this.config.name,
    });

    const state = await this.getState();
    state.state = "HALF_OPEN";
    state.successes = 0;
    await this.setState(state);
  }

  /**
   * Get current circuit state (for monitoring/debugging)
   */
  async getCurrentState(): Promise<CircuitBreakerState> {
    return this.getState();
  }

  /**
   * Manually reset circuit breaker (for admin use)
   */
  async reset(): Promise<void> {
    logger.info("Circuit breaker manually reset", {
      service: this.config.name,
    });

    await this.setState({
      state: "CLOSED",
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    });
  }
}

/**
 * Create circuit breaker instances for common services
 */
export const circuitBreakers = {
  anthropic: new CircuitBreaker({
    name: "anthropic",
    failureThreshold: 5,
    failureWindow: 60000, // 1 minute
    recoveryTimeout: 30000, // 30 seconds
    timeout: 300000, // 5 minutes (skill analysis with many URLs can be slow on AWS)
  }),

  salesforce: new CircuitBreaker({
    name: "salesforce",
    failureThreshold: 3,
    failureWindow: 60000,
    recoveryTimeout: 20000, // 20 seconds
    timeout: 30000, // 30 seconds
  }),

  snowflake: new CircuitBreaker({
    name: "snowflake",
    failureThreshold: 3,
    failureWindow: 60000,
    recoveryTimeout: 20000,
    timeout: 45000, // 45 seconds (queries can be slow)
  }),

  zendesk: new CircuitBreaker({
    name: "zendesk",
    failureThreshold: 3,
    failureWindow: 60000,
    recoveryTimeout: 20000,
    timeout: 30000, // 30 seconds
  }),

  slack: new CircuitBreaker({
    name: "slack",
    failureThreshold: 5,
    failureWindow: 60000,
    recoveryTimeout: 20000,
    timeout: 30000, // 30 seconds
  }),

  notion: new CircuitBreaker({
    name: "notion",
    failureThreshold: 5,
    failureWindow: 60000,
    recoveryTimeout: 20000,
    timeout: 30000, // 30 seconds
  }),
};

/**
 * Helper to wrap async functions with circuit breaker
 */
export function withCircuitBreaker<T extends unknown[], R>(
  breaker: CircuitBreaker,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return breaker.execute(() => fn(...args));
  };
}
