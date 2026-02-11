/**
 * Structured Logger
 *
 * A lightweight logger that provides structured logging for production.
 * In development, logs are human-readable. In production, logs are JSON-formatted
 * for easy parsing by log aggregation systems (Datadog, CloudWatch, etc.).
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *
 *   logger.info('User logged in', { userId: '123', email: 'user@example.com' });
 *   logger.error('Failed to process request', error, { requestId: 'abc' });
 *   logger.warn('Rate limit approaching', { remaining: 5, limit: 10 });
 *
 * In production, outputs:
 *   {"level":"info","message":"User logged in","userId":"123","email":"user@example.com","timestamp":"2025-12-15T..."}
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === 'production';

function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace
    };
  }
  return { errorValue: String(error) };
}

function log(level: LogLevel, message: string, contextOrError?: LogContext | Error, additionalContext?: LogContext) {
  const timestamp = new Date().toISOString();

  // Handle the case where contextOrError is an Error
  let context: LogContext = {};
  if (contextOrError instanceof Error) {
    context = { ...formatError(contextOrError), ...additionalContext };
  } else if (contextOrError) {
    context = { ...contextOrError, ...additionalContext };
  }

  if (isProduction) {
    // JSON structured output for production
    const entry: LogEntry = {
      level,
      message,
      timestamp,
      ...context,
    };

    // Use appropriate console method
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logFn(JSON.stringify(entry));
  } else {
    // Human-readable output for development
    const prefix = {
      debug: '🔍 DEBUG',
      info: 'ℹ️  INFO',
      warn: '⚠️  WARN',
      error: '❌ ERROR',
    }[level];

    const contextStr = Object.keys(context).length > 0
      ? `\n   ${JSON.stringify(context, null, 2).split('\n').join('\n   ')}`
      : '';

    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logFn(`${prefix} [${timestamp}] ${message}${contextStr}`);
  }
}

export const logger = {
  /**
   * Debug level - detailed information for debugging
   * Only use for development-time debugging
   */
  debug: (message: string, context?: LogContext) => {
    if (!isProduction) {
      log('debug', message, context);
    }
  },

  /**
   * Info level - general operational information
   * Use for significant events (user actions, API calls, etc.)
   */
  info: (message: string, context?: LogContext) => {
    log('info', message, context);
  },

  /**
   * Warn level - potentially problematic situations
   * Use for recoverable issues that should be monitored
   */
  warn: (message: string, errorOrContext?: Error | unknown | LogContext, context?: LogContext) => {
    if (errorOrContext instanceof Error || (errorOrContext && typeof errorOrContext === 'object' && 'message' in errorOrContext)) {
      log('warn', message, errorOrContext as Error, context);
    } else {
      log('warn', message, errorOrContext as LogContext);
    }
  },

  /**
   * Error level - error events that need attention
   * Use for exceptions and failures
   */
  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    if (error) {
      log('error', message, error as Error, context);
    } else {
      log('error', message, context);
    }
  },

  /**
   * Create a child logger with preset context
   * Useful for adding request-specific context to all logs
   */
  child: (baseContext: LogContext) => ({
    debug: (message: string, context?: LogContext) =>
      logger.debug(message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) =>
      logger.info(message, { ...baseContext, ...context }),
    warn: (message: string, errorOrContext?: Error | unknown | LogContext, context?: LogContext) =>
      logger.warn(message, errorOrContext, { ...baseContext, ...context }),
    error: (message: string, error?: Error | unknown, context?: LogContext) =>
      logger.error(message, error, { ...baseContext, ...context }),
  }),
};

/**
 * Create a request-scoped logger with request ID
 */
export function createRequestLogger(requestId: string, route?: string) {
  return logger.child({
    requestId,
    ...(route && { route }),
  });
}
