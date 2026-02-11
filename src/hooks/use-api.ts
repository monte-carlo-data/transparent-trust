/**
 * Generic API hooks for React Query
 *
 * Provides reusable hooks that eliminate boilerplate for:
 * - GET requests with caching (useApiQuery)
 * - POST/PUT/DELETE mutations (useApiMutation)
 *
 * Uses existing apiClient utilities for response parsing and error handling.
 *
 * @example
 * // Simple query
 * const { data, isLoading, error } = useApiQuery<Skill[]>({
 *   queryKey: ["skills"],
 *   url: "/api/skills",
 *   responseKey: "skills",
 * });
 *
 * @example
 * // Mutation with cache invalidation
 * const mutation = useApiMutation<Skill, SkillCreate>({
 *   url: "/api/skills",
 *   method: "POST",
 *   responseKey: "skill",
 *   invalidateKeys: [["skills"]],
 * });
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
  QueryKey,
} from "@tanstack/react-query";
import { parseApiData, getApiErrorMessage } from "@/lib/apiClient";

// ============================================
// TYPES
// ============================================

export interface ApiQueryOptions<TData>
  extends Omit<UseQueryOptions<TData, Error>, "queryKey" | "queryFn"> {
  /** Query key for caching */
  queryKey: QueryKey;
  /** API endpoint URL */
  url: string;
  /** Key to extract from response (e.g., "skills", "profile") */
  responseKey?: string;
  /** Transform function for response data */
  transform?: (data: unknown) => TData;
  /** URL params to append */
  params?: Record<string, string | number | boolean | undefined>;
}

export interface ApiMutationOptions<TData, TVariables>
  extends Omit<UseMutationOptions<TData, Error, TVariables, unknown>, "mutationFn"> {
  /** API endpoint URL (can include {id} placeholder) */
  url: string | ((variables: TVariables) => string);
  /** HTTP method */
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  /** Key to extract from response */
  responseKey?: string;
  /** Query keys to invalidate on success */
  invalidateKeys?: QueryKey[];
  /** Transform function for response data */
  transform?: (data: unknown) => TData;
}

// ============================================
// FETCH UTILITIES
// ============================================

/**
 * Build URL with query params
 */
function buildUrl(
  baseUrl: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params) return baseUrl;

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Execute API fetch with consistent error handling
 */
async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  responseKey?: string,
  transform?: (data: unknown) => T
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorMessage: string;
    try {
      const errorResult = await response.json();
      errorMessage = getApiErrorMessage(
        errorResult,
        `Request failed with status ${response.status}`
      );
    } catch {
      errorMessage = `Request failed with status ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const result = await response.json();
  const parsed = parseApiData<T>(result, responseKey);

  return transform ? transform(parsed) : parsed;
}

// ============================================
// HOOKS
// ============================================

/**
 * Generic query hook for GET requests
 *
 * @example
 * // Fetch list with automatic caching
 * const { data: skills } = useApiQuery<Skill[]>({
 *   queryKey: ["skills"],
 *   url: "/api/skills",
 *   responseKey: "skills",
 *   staleTime: 5 * 60 * 1000, // 5 minutes
 * });
 *
 * @example
 * // Fetch single item
 * const { data: skill } = useApiQuery<Skill>({
 *   queryKey: ["skill", id],
 *   url: `/api/skills/${id}`,
 *   responseKey: "skill",
 *   enabled: !!id,
 * });
 *
 * @example
 * // With URL params
 * const { data } = useApiQuery<SearchResult[]>({
 *   queryKey: ["search", query],
 *   url: "/api/search",
 *   params: { q: query, limit: 10 },
 *   responseKey: "results",
 * });
 */
export function useApiQuery<TData>({
  queryKey,
  url,
  responseKey,
  transform,
  params,
  ...options
}: ApiQueryOptions<TData>) {
  const fullUrl = buildUrl(url, params);

  return useQuery<TData, Error>({
    queryKey,
    queryFn: () => apiFetch<TData>(fullUrl, {}, responseKey, transform),
    ...options,
  });
}

/**
 * Generic mutation hook for POST/PUT/DELETE requests
 *
 * @example
 * // Create mutation
 * const createSkill = useApiMutation<Skill, SkillCreate>({
 *   url: "/api/skills",
 *   method: "POST",
 *   responseKey: "skill",
 *   invalidateKeys: [["skills"]],
 * });
 * createSkill.mutate({ title: "New Skill", content: "..." });
 *
 * @example
 * // Update mutation with dynamic URL
 * const updateSkill = useApiMutation<Skill, { id: string; data: SkillUpdate }>({
 *   url: (vars) => `/api/skills/${vars.id}`,
 *   method: "PUT",
 *   responseKey: "skill",
 *   invalidateKeys: [["skills"]],
 * });
 * updateSkill.mutate({ id: "123", data: { title: "Updated" } });
 *
 * @example
 * // Delete mutation
 * const deleteSkill = useApiMutation<void, string>({
 *   url: (id) => `/api/skills/${id}`,
 *   method: "DELETE",
 *   invalidateKeys: [["skills"]],
 * });
 * deleteSkill.mutate("123");
 */
export function useApiMutation<TData, TVariables = void>({
  url,
  method = "POST",
  responseKey,
  invalidateKeys,
  transform,
  ...options
}: ApiMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOptions } = options;

  return useMutation<TData, Error, TVariables, unknown>({
    mutationFn: async (variables) => {
      const resolvedUrl = typeof url === "function" ? url(variables) : url;

      const fetchOptions: RequestInit = {
        method,
        headers:
          method !== "DELETE" && variables !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
        body:
          method !== "DELETE" && variables !== undefined
            ? JSON.stringify(
                // If variables has a 'data' property, use that as body
                // Otherwise use variables directly
                typeof variables === "object" &&
                  variables !== null &&
                  "data" in variables
                  ? (variables as { data: unknown }).data
                  : variables
              )
            : undefined,
      };

      return apiFetch<TData>(resolvedUrl, fetchOptions, responseKey, transform);
    },
    onSuccess: async (data, variables, context) => {
      // Invalidate specified query keys
      if (invalidateKeys?.length) {
        await Promise.all(
          invalidateKeys.map((key) =>
            queryClient.invalidateQueries({ queryKey: key })
          )
        );
      }
      // Call user-provided onSuccess (only pass 3 args for compat)
      if (userOnSuccess) {
        // @ts-expect-error - TanStack Query v5 signature changed, this is backwards compatible
        userOnSuccess(data, variables, context);
      }
    },
    ...restOptions,
  });
}

// ============================================
// CONVENIENCE HOOKS
// ============================================

/**
 * Hook for fetching a list of items
 *
 * @example
 * const { data: skills } = useApiList<Skill>("/api/skills", "skills", ["skills"]);
 */
export function useApiList<TData>(
  url: string,
  responseKey: string,
  queryKey: QueryKey,
  options?: Omit<ApiQueryOptions<TData[]>, "url" | "responseKey" | "queryKey">
) {
  return useApiQuery<TData[]>({
    queryKey,
    url,
    responseKey,
    ...options,
  });
}

/**
 * Hook for fetching a single item by ID
 *
 * @example
 * const { data: skill } = useApiItem<Skill>("/api/skills", "skill", id);
 */
export function useApiItem<TData>(
  baseUrl: string,
  responseKey: string,
  id: string | undefined,
  options?: Omit<ApiQueryOptions<TData>, "url" | "responseKey" | "queryKey">
) {
  return useApiQuery<TData>({
    queryKey: [responseKey, id],
    url: `${baseUrl}/${id}`,
    responseKey,
    enabled: !!id,
    ...options,
  });
}
