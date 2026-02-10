/**
 * Unified API Client
 *
 * Provides consistent patterns for:
 * - Response parsing (handles both { data: { key: value } } and { key: value } formats)
 * - Error handling with typed error extraction
 * - CRUD operations via factory function
 */

// ============================================
// RESPONSE PARSING
// ============================================

/**
 * Parse API response data, handling multiple response formats.
 * This eliminates the repeated `result.data?.key ?? result.key ?? result` pattern.
 *
 * @param result - Raw JSON response from fetch
 * @param key - Optional key to extract from response (e.g., "skills", "profile")
 * @returns The extracted data of type T
 *
 * @example
 * // For array responses
 * const skills = parseApiData<Skill[]>(result, "skills");
 *
 * // For single object responses
 * const skill = parseApiData<Skill>(result, "skill");
 *
 * // When response is already the data
 * const data = parseApiData<MyType>(result);
 */
export function parseApiData<T>(result: unknown, key?: string): T {
  if (result === null || result === undefined) {
    return result as T;
  }

  if (typeof result !== "object") {
    return result as T;
  }

  const obj = result as Record<string, unknown>;

  // If key provided, try to extract it from data wrapper or direct
  if (key) {
    // Try { data: { key: value } } format first
    if (obj.data && typeof obj.data === "object") {
      const dataObj = obj.data as Record<string, unknown>;
      if (key in dataObj) {
        return dataObj[key] as T;
      }
    }
    // Try { key: value } format
    if (key in obj) {
      return obj[key] as T;
    }
  }

  // If no key or key not found, try unwrapping data
  if (obj.data !== undefined) {
    return obj.data as T;
  }

  // Return as-is
  return result as T;
}

// ============================================
// ERROR HANDLING
// ============================================

export class ApiRequestError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * Extract error message from API error response
 */
export function getApiErrorMessage(result: unknown, fallback = "An error occurred"): string {
  if (typeof result !== "object" || result === null) {
    return fallback;
  }

  const obj = result as Record<string, unknown>;

  // Handle { error: { message: "..." } }
  if (obj.error && typeof obj.error === "object") {
    const errorObj = obj.error as Record<string, unknown>;
    if (typeof errorObj.message === "string") {
      return errorObj.message;
    }
  }

  // Handle { error: "..." }
  if (typeof obj.error === "string") {
    return obj.error;
  }

  // Handle { message: "..." }
  if (typeof obj.message === "string") {
    return obj.message;
  }

  return fallback;
}

// ============================================
// FETCH WRAPPER
// ============================================

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Fetch wrapper with consistent error handling
 */
async function apiFetch<T>(
  url: string,
  options: FetchOptions = {},
  responseKey?: string
): Promise<T> {
  const { body, headers, ...rest } = options;

  const fetchOptions: RequestInit = {
    ...rest,
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    let errorBody: unknown;
    if (response.headers.get("content-type")?.includes("application/json")) {
      try {
        errorBody = await response.json();
      } catch {
        // Swallow JSON parse errors - we'll fall back to status message
      }
    }

    const errorMessage = getApiErrorMessage(
      errorBody,
      `Request failed with status ${response.status}`
    );

    throw new ApiRequestError(errorMessage, response.status, errorBody);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const result = await response.json();
  return parseApiData<T>(result, responseKey);
}

// ============================================
// CRUD CLIENT FACTORY
// ============================================

export interface ApiClientConfig<T, TCreate, TUpdate> {
  /** Base URL for the resource (e.g., "/api/skills") */
  baseUrl: string;
  /** Key used in API responses for single items (e.g., "skill") */
  singularKey: string;
  /** Key used in API responses for lists (e.g., "skills") */
  pluralKey: string;
  /** Optional transform function for items from API */
  transform?: (item: unknown) => T;
  /** Type helpers - not used at runtime, just for inference */
  _create?: TCreate;
  _update?: TUpdate;
}

export interface ApiClient<T, TCreate, TUpdate> {
  /** Fetch all items */
  fetchAll: (params?: URLSearchParams | Record<string, string>) => Promise<T[]>;
  /** Fetch a single item by ID */
  fetch: (id: string) => Promise<T | null>;
  /** Create a new item */
  create: (data: TCreate) => Promise<T>;
  /** Update an existing item */
  update: (id: string, data: TUpdate) => Promise<T>;
  /** Delete an item */
  delete: (id: string) => Promise<void>;
}

/**
 * Create a typed API client for a resource
 *
 * @example
 * ```ts
 * const skillApi = createApiClient<Skill, SkillCreate, SkillUpdate>({
 *   baseUrl: "/api/skills",
 *   singularKey: "skill",
 *   pluralKey: "skills",
 * });
 *
 * // Usage
 * const skills = await skillApi.fetchAll();
 * const skill = await skillApi.fetch("123");
 * const newSkill = await skillApi.create({ title: "New Skill", ... });
 * ```
 */
export function createApiClient<T, TCreate = Partial<T>, TUpdate = Partial<T>>(
  config: ApiClientConfig<T, TCreate, TUpdate>
): ApiClient<T, TCreate, TUpdate> {
  const { baseUrl, singularKey, pluralKey, transform } = config;

  const transformItem = (item: unknown): T => {
    return transform ? transform(item) : (item as T);
  };

  return {
    fetchAll: async (params) => {
      let url = baseUrl;
      if (params) {
        const searchParams =
          params instanceof URLSearchParams
            ? params
            : new URLSearchParams(params);
        const queryString = searchParams.toString();
        if (queryString) {
          url = `${baseUrl}?${queryString}`;
        }
      }
      const items = await apiFetch<unknown[]>(url, {}, pluralKey);
      return (items || []).map(transformItem);
    },

    fetch: async (id) => {
      try {
        const item = await apiFetch<unknown>(`${baseUrl}/${id}`, {}, singularKey);
        return item ? transformItem(item) : null;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },

    create: async (data) => {
      const item = await apiFetch<unknown>(
        baseUrl,
        { method: "POST", body: data },
        singularKey
      );
      return transformItem(item);
    },

    update: async (id, data) => {
      const item = await apiFetch<unknown>(
        `${baseUrl}/${id}`,
        { method: "PUT", body: data },
        singularKey
      );
      return transformItem(item);
    },

    delete: async (id) => {
      await apiFetch<void>(`${baseUrl}/${id}`, { method: "DELETE" });
    },
  };
}
