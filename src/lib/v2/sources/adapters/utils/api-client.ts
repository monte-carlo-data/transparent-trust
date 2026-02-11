/**
 * API Client Utility
 *
 * Authenticated HTTP requests with error handling.
 */

import { logger } from '@/lib/logger';
import type { ApiRequestOptions } from './types';

interface ApiClientOptions {
  baseUrl: string;
  getAuthHeaders: () => Record<string, string> | Promise<Record<string, string>>;
  defaultHeaders?: Record<string, string>;
  /** Minimum ms between requests (default: 0) */
  minRequestInterval?: number;
  /** Max retries on rate limit (default: 3) */
  maxRetries?: number;
}

export class ApiClient {
  private baseUrl: string;
  private getAuthHeaders: () => Record<string, string> | Promise<Record<string, string>>;
  private defaultHeaders: Record<string, string>;
  private minRequestInterval: number;
  private maxRetries: number;
  private lastRequestTime: number = 0;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.getAuthHeaders = options.getAuthHeaders;
    this.defaultHeaders = options.defaultHeaders || {};
    this.minRequestInterval = options.minRequestInterval || 0;
    this.maxRetries = options.maxRetries ?? 3;
  }

  /**
   * Wait to respect rate limiting
   */
  private async throttle(): Promise<void> {
    if (this.minRequestInterval <= 0) return;

    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise((resolve) => setTimeout(resolve, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Make an authenticated request with rate limit handling
   */
  async request<T>(options: ApiRequestOptions): Promise<T> {
    const { endpoint, method = 'GET', body, headers = {} } = options;

    const url = `${this.baseUrl}${endpoint}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.throttle();

      const authHeaders = await this.getAuthHeaders();
      const finalHeaders = {
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
        ...authHeaders,
        ...headers,
      };

      try {
        const response = await fetch(url, {
          method,
          headers: finalHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        // Handle rate limiting with retry
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000);

          if (attempt < this.maxRetries) {
            logger.warn('Rate limited, retrying', { url, attempt, waitMs });
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `HTTP ${response.status}: ${response.statusText}\n${errorBody.substring(0, 500)}`
          );
        }

        const data: T = await response.json();
        return data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Only log and rethrow on final attempt
        if (attempt >= this.maxRetries) {
          logger.error('API request failed', { url, method, error: errorMessage, attempts: attempt + 1 });
          throw error;
        }

        // Retry on network errors
        if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 30000);
          logger.warn('Network error, retrying', { url, attempt, waitMs, error: errorMessage });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        throw error;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error(`Request failed after ${this.maxRetries} retries`);
  }

  /**
   * Make a GET request
   */
  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ endpoint, method: 'GET', headers });
  }

  /**
   * Make a POST request
   */
  async post<T>(endpoint: string, body?: Record<string, unknown>, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ endpoint, method: 'POST', body, headers });
  }

  /**
   * Make a PUT request
   */
  async put<T>(endpoint: string, body?: Record<string, unknown>, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ endpoint, method: 'PUT', body, headers });
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ endpoint, method: 'DELETE', headers });
  }
}
